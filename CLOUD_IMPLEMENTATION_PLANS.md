# Cloud Implementation Plans
## CloudExamSystem — GCP + Firebase Cloud Services

---

## Plan 1 — Cloud Functions Implementation

### Overview
Cloud Functions solve four critical problems from the audit:
1. **SEC-02** — Students can read `correctAnswer` directly from Firestore
2. **PERF-01** — Security rules call `get()` for role on every write (billed reads)
3. Orphaned questions sub-collection when an exam is deleted
4. Automated exam status transitions

---

### Setup

```bash
# Install Firebase CLI and initialise functions
npm install -g firebase-tools
firebase login
firebase init functions
# Select: TypeScript, ESLint: yes, Install deps: yes
cd functions
npm install firebase-admin firebase-functions
```

Directory structure to create:
```
functions/
├── src/
│   ├── index.ts          ← exports all functions
│   ├── submitExam.ts     ← server-side answer checking
│   ├── setUserRole.ts    ← set custom claims on registration
│   ├── deleteExam.ts     ← cascade delete questions sub-collection
│   └── updateExamStatus.ts ← scheduled status transitions
├── package.json
└── tsconfig.json
```

---

### Function 1: `setUserRoleClaim` (Firestore Trigger)

**Purpose:** Set Firebase Auth custom claims on user registration so security rules
can use `request.auth.token.role` instead of calling `get()` (fixes PERF-01).

**Trigger:** `onDocumentCreated('users/{uid}')`

**File:** `functions/src/setUserRole.ts`

```typescript
import { firestore } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';

export const setUserRoleClaim = firestore.onDocumentCreated(
  'users/{uid}',
  async (event) => {
    const uid = event.params.uid;
    const data = event.data?.data();
    if (!data?.role) return;

    // Set custom claim — now readable as request.auth.token.role in rules
    await admin.auth().setCustomUserClaims(uid, { role: data.role });
    console.log(`Custom claim role=${data.role} set for uid=${uid}`);
  }
);
```

**Firestore rules update after this is deployed** — replace `getUserRole()` with:

```javascript
// OLD (billed get() on every write)
function getUserRole() {
  return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role;
}

// NEW (free — reads from JWT token, no Firestore round-trip)
function getUserRole() {
  return request.auth.token.role;
}
```

**Frontend change required** — after login, force token refresh so new claim is visible:

```javascript
// In authService.js loginUser(), after signInWithEmailAndPassword:
await credential.user.getIdToken(true); // force refresh to load custom claims
```

---

### Function 2: `submitExam` (HTTP Callable)

**Purpose:** Server-side answer checking — correctAnswer never leaves the server.

**Trigger:** HTTPS Callable  
**File:** `functions/src/submitExam.ts`

```typescript
import { https } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { PASS_THRESHOLD } from './constants';

export const submitExam = https.onCall(async (request) => {
  if (!request.auth) {
    throw new https.HttpsError('unauthenticated', 'Must be logged in');
  }
  if (request.auth.token.role !== 'student') {
    throw new https.HttpsError('permission-denied', 'Students only');
  }

  const { examId, answers } = request.data as {
    examId: string;
    answers: Record<string, string>;
  };
  const studentId = request.auth.uid;
  const db = admin.firestore();

  // Guard: prevent double submission
  const existing = await db.collection('results')
    .where('examId', '==', examId)
    .where('studentId', '==', studentId)
    .limit(1).get();
  if (!existing.empty) {
    throw new https.HttpsError('already-exists', 'Exam already submitted');
  }

  // Fetch exam metadata
  const examDoc = await db.collection('exams').doc(examId).get();
  if (!examDoc.exists) {
    throw new https.HttpsError('not-found', 'Exam not found');
  }
  const exam = examDoc.data()!;

  // Fetch questions (correctAnswer stays server-side)
  const questionsSnap = await db
    .collection('exams').doc(examId).collection('questions').get();
  const questions = questionsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  // Calculate score
  let score = 0;
  let totalMarks = 0;
  questions.forEach((q: any) => {
    const marks = Number(q.marks) || 0;
    totalMarks += marks;
    if ((answers[q.id] || '').toUpperCase() === (q.correctAnswer || '').toUpperCase()) {
      score += marks;
    }
  });

  const percentage = totalMarks > 0 ? Math.round((score / totalMarks) * 100) : 0;
  const status = percentage >= PASS_THRESHOLD ? 'pass' : 'fail';

  // Write result — answers stored without correctAnswers exposure
  const resultRef = await db.collection('results').add({
    examId, studentId,
    studentName: request.auth.token.name || 'Student',
    examTitle: exam.title,
    subject: exam.subject,
    score, totalMarks, percentage, status,
    submittedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { resultId: resultRef.id, score, totalMarks, percentage, status };
});
```

**Frontend integration** — update `resultService.js`:

```javascript
// When CLOUD_FEATURES.CLOUD_FUNCTIONS_ENABLED === true:
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions(undefined, 'asia-south1');
const submitExamFn = httpsCallable(functions, 'submitExam');

export const submitResult = async ({ examId, answers, ...meta }) => {
  const { data } = await submitExamFn({ examId, answers });
  return { id: data.resultId, ...data };
};
```

---

### Function 3: `onExamDeleted` (Firestore Trigger)

**Purpose:** Cascade delete questions sub-collection when exam is deleted.

**File:** `functions/src/deleteExam.ts`

```typescript
import { firestore } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';

export const onExamDeleted = firestore.onDocumentDeleted(
  'exams/{examId}',
  async (event) => {
    const examId = event.params.examId;
    const db = admin.firestore();
    const batch = db.batch();

    const questionsSnap = await db
      .collection('exams').doc(examId).collection('questions').get();

    questionsSnap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    console.log(`Deleted ${questionsSnap.size} questions for exam ${examId}`);
  }
);
```

---

### Function 4: `recoverOrphanedUser` (HTTP Callable)

**Purpose:** Fix BUG-01 — if Firestore profile write failed after Auth creation.

**File:** `functions/src/recoverOrphanedUser.ts`

```typescript
import { https } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';

export const recoverOrphanedUser = https.onCall(async (request) => {
  if (!request.auth) {
    throw new https.HttpsError('unauthenticated', 'Must be logged in');
  }
  const uid = request.auth.uid;
  const { name, email, role } = request.data;

  const db = admin.firestore();
  const doc = await db.collection('users').doc(uid).get();
  if (doc.exists) return { alreadyExists: true };

  await db.collection('users').doc(uid).set({
    uid, name, email,
    role: ['student', 'faculty'].includes(role) ? role : 'student',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    recovered: true,
  });

  await admin.auth().setCustomUserClaims(uid, { role });
  return { recovered: true };
});
```

---

### `functions/src/index.ts` — Export all functions

```typescript
import * as admin from 'firebase-admin';
admin.initializeApp();

export { setUserRoleClaim } from './setUserRole';
export { submitExam }       from './submitExam';
export { onExamDeleted }    from './deleteExam';
export { recoverOrphanedUser } from './recoverOrphanedUser';
// export { updateExamStatus } from './updateExamStatus'; // added in Plan 2
```

### Deploy

```bash
firebase deploy --only functions
```

---

## Plan 2 — Cloud Scheduler Implementation

### Overview
Cloud Scheduler (via Cloud Functions scheduled triggers) automates exam lifecycle
management. Currently `computeExamStatus` recalculates status on every client read.
This plan moves status to a reliable server-side field updated on a schedule.

### Function 5: `updateExamStatuses` (Scheduled)

**Schedule:** Every 5 minutes  
**File:** `functions/src/updateExamStatus.ts`

```typescript
import { scheduler } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';

export const updateExamStatuses = scheduler.onSchedule(
  { schedule: 'every 5 minutes', timeZone: 'Asia/Kolkata' },
  async () => {
    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();

    // Find exams that should be active
    const toActivate = await db.collection('exams')
      .where('status', '==', 'upcoming')
      .where('startTime', '<=', now)
      .where('endTime', '>', now)
      .get();

    // Find exams that should be completed
    const toComplete = await db.collection('exams')
      .where('status', 'in', ['upcoming', 'active'])
      .where('endTime', '<=', now)
      .get();

    const batch = db.batch();

    toActivate.docs.forEach(doc => batch.update(doc.ref, { status: 'active' }));
    toComplete.docs.forEach(doc => batch.update(doc.ref, { status: 'completed' }));

    await batch.commit();

    console.log(
      `Status update: activated=${toActivate.size}, completed=${toComplete.size}`
    );
  }
);
```

**Frontend change after deployment:**  
Remove `computeExamStatus` calls from `getAllExams` and `getExamById`.
The `status` field in Firestore is now authoritative and updated server-side.

```javascript
// examService.js — after Cloud Scheduler is live:
export const getAllExams = async () => {
  const exams = await fsGetCollection(COLLECTIONS.EXAMS);
  // Remove: return exams.map((exam) => ({ ...exam, status: computeExamStatus(exam) }));
  return exams; // status field is server-managed
};
```

### Enabling Cloud Scheduler

Cloud Scheduler is automatically available with Cloud Functions v2.
No additional GCP setup required beyond enabling billing on the project.

```bash
# Enable required APIs if not already enabled
gcloud services enable cloudscheduler.googleapis.com
gcloud services enable cloudfunctions.googleapis.com
```

### Schedule Considerations

| Use Case | Schedule | Notes |
|----------|----------|-------|
| Exam status updates | `every 5 minutes` | Acceptable lag for exam start |
| Daily analytics snapshot | `0 2 * * *` (2 AM IST) | Export to BigQuery |
| Weekly billing report | `0 9 * * 1` (9 AM Monday) | Email summary |
| Monthly cleanup | `0 0 1 * *` | Archive old results |

---

## Plan 3 — BigQuery Implementation

### Overview
BigQuery enables analytics that are impossible to compute efficiently in Firestore:
- Monthly trends over time
- Question-level difficulty analysis
- Student performance cohorts
- Export for Looker Studio dashboards

### Step 1: Enable Firestore BigQuery Extension

The easiest path — no custom ETL code required.

```bash
firebase ext:install firebase/firestore-bigquery-export

# Configure:
# Collection path: results
# Dataset ID: cloudexam_analytics
# Table name prefix: results
# Project ID: cloudexamsystem-499512
```

Repeat for `exams` collection:

```bash
firebase ext:install firebase/firestore-bigquery-export
# Collection path: exams
# Dataset ID: cloudexam_analytics
# Table name prefix: exams
```

This extension streams every Firestore write to BigQuery in real time.

### Step 2: BigQuery Tables (auto-created by extension)

```
cloudexam_analytics.results_raw_changelog  ← all write events
cloudexam_analytics.results_raw_latest     ← latest state of each document
cloudexam_analytics.exams_raw_latest       ← latest state of each exam
```

### Step 3: Create Analytics Views

Run these in BigQuery Console → SQL Editor:

```sql
-- View: Monthly exam and student counts
CREATE OR REPLACE VIEW `cloudexamsystem-499512.cloudexam_analytics.monthly_trends` AS
SELECT
  FORMAT_DATE('%Y-%m', DATE(TIMESTAMP_MILLIS(CAST(
    JSON_VALUE(data, '$.submittedAt._seconds') AS INT64) * 1000))
  ) AS month,
  COUNT(DISTINCT document_id) AS total_submissions,
  COUNT(DISTINCT JSON_VALUE(data, '$.studentId')) AS unique_students,
  AVG(CAST(JSON_VALUE(data, '$.percentage') AS FLOAT64)) AS avg_percentage,
  COUNTIF(JSON_VALUE(data, '$.status') = 'pass') AS pass_count,
  COUNTIF(JSON_VALUE(data, '$.status') = 'fail') AS fail_count
FROM `cloudexamsystem-499512.cloudexam_analytics.results_raw_latest`
WHERE operation != 'DELETE'
GROUP BY month
ORDER BY month DESC;
```

```sql
-- View: Subject performance over time
CREATE OR REPLACE VIEW `cloudexam_analytics.subject_performance` AS
SELECT
  JSON_VALUE(data, '$.subject') AS subject,
  COUNT(*) AS total_attempts,
  AVG(CAST(JSON_VALUE(data, '$.percentage') AS FLOAT64)) AS avg_score,
  COUNTIF(JSON_VALUE(data, '$.status') = 'pass') AS pass_count,
  ROUND(
    COUNTIF(JSON_VALUE(data, '$.status') = 'pass') * 100.0 / COUNT(*), 2
  ) AS pass_rate_pct
FROM `cloudexam_analytics.results_raw_latest`
WHERE operation != 'DELETE'
GROUP BY subject
ORDER BY avg_score DESC;
```

```sql
-- View: Student leaderboard
CREATE OR REPLACE VIEW `cloudexam_analytics.student_leaderboard` AS
SELECT
  JSON_VALUE(data, '$.studentId') AS student_id,
  JSON_VALUE(data, '$.studentName') AS student_name,
  COUNT(*) AS exams_taken,
  AVG(CAST(JSON_VALUE(data, '$.percentage') AS FLOAT64)) AS avg_score,
  MAX(CAST(JSON_VALUE(data, '$.percentage') AS FLOAT64)) AS highest_score,
  COUNTIF(JSON_VALUE(data, '$.status') = 'pass') AS exams_passed
FROM `cloudexam_analytics.results_raw_latest`
WHERE operation != 'DELETE'
GROUP BY student_id, student_name
ORDER BY avg_score DESC;
```

### Step 4: Cloud Function — Query BigQuery from Frontend

```typescript
// functions/src/getBigQueryAnalytics.ts
import { https } from 'firebase-functions/v2';
import { BigQuery } from '@google-cloud/bigquery';

const bq = new BigQuery({ projectId: 'cloudexamsystem-499512' });

export const getMonthlyTrends = https.onCall(async (request) => {
  if (!request.auth) {
    throw new https.HttpsError('unauthenticated', 'Must be logged in');
  }
  if (request.auth.token.role !== 'faculty') {
    throw new https.HttpsError('permission-denied', 'Faculty only');
  }

  const [rows] = await bq.query({
    query: `SELECT * FROM \`cloudexam_analytics.monthly_trends\` ORDER BY month DESC LIMIT 12`,
    location: 'US',
  });

  return { trends: rows };
});
```

### Step 5: Frontend Integration

```javascript
// analyticsService.js — when CLOUD_FEATURES.BIGQUERY_ENABLED === true
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions(undefined, 'asia-south1');
const getMonthlyTrendsFn = httpsCallable(functions, 'getMonthlyTrends');

export const getMonthlyTrends = async () => {
  if (!CLOUD_FEATURES.BIGQUERY_ENABLED) return [];
  const { data } = await getMonthlyTrendsFn();
  return data.trends;
};
```

---

## Plan 4 — Looker Studio Implementation

### Overview
Looker Studio (formerly Data Studio) provides a free drag-and-drop dashboard
connected directly to BigQuery. No code required after BigQuery is set up.

### Prerequisites
- Plan 3 (BigQuery) must be complete
- GCP project billing enabled
- BigQuery views created (see Plan 3 Step 3)

### Step 1: Connect Looker Studio to BigQuery

1. Go to [lookerstudio.google.com](https://lookerstudio.google.com)
2. Click **Create → Data Source**
3. Select **BigQuery** connector
4. Authorise with the GCP service account
5. Select project: `cloudexamsystem-499512`
6. Select dataset: `cloudexam_analytics`
7. Connect to view: `monthly_trends`, `subject_performance`, `student_leaderboard`

### Step 2: Recommended Report Structure

**Page 1 — Executive Summary**
- Scorecard: Total Exams, Total Students, Overall Pass Rate, Average Score
- Time series: Monthly submissions trend (line chart from `monthly_trends`)
- Pie chart: Overall Pass vs Fail ratio

**Page 2 — Subject Analytics**
- Bar chart: Average score by subject (from `subject_performance`)
- Table: Subject, Total Attempts, Pass Rate, Avg Score (sortable)
- Heatmap: Subject performance by month

**Page 3 — Student Performance**
- Table: Student Leaderboard (from `student_leaderboard`)
- Bar chart: Score distribution (group into ranges 0–50, 50–70, 70–90, 90–100)
- Scatter plot: Exams Taken vs Average Score

**Page 4 — Exam Analytics**
- Table: Exam list with participant count and average score
- Bar chart: Participation rate per exam
- Filter control: Date range selector

### Step 3: Embed in Application (Optional)

Generate an embed code from Looker Studio and embed in `AnalyticsPage.jsx`:

```jsx
// AnalyticsPage.jsx — when CLOUD_FEATURES.LOOKER_STUDIO_ENABLED === true
const LookerEmbed = () => (
  <Paper sx={{ p: 0, overflow: 'hidden', borderRadius: 2 }}>
    <iframe
      title="CloudExam Analytics"
      width="100%"
      height="600"
      src="https://lookerstudio.google.com/embed/reporting/YOUR_REPORT_ID/page/YOUR_PAGE_ID"
      frameBorder="0"
      style={{ border: 0 }}
      allowFullScreen
      sandbox="allow-storage-access-by-user-activation allow-scripts
               allow-same-origin allow-popups allow-popups-to-escape-sandbox"
    />
  </Paper>
);
```

### Step 4: Access Control

In Looker Studio → Share → Manage Access:
- **Faculty users:** View access (share by Google account or domain)
- **Public:** No access
- For production: use service account + scheduled refresh instead of live query

### Estimated Cost (GCP Free Tier)

| Service | Free Tier | Estimated Usage |
|---------|-----------|-----------------|
| BigQuery queries | 1 TB/month free | Analytics queries ~1 MB/run |
| BigQuery storage | 10 GB/month free | Results data <1 GB for years |
| Firestore BigQuery extension | Charged per Firestore operation | Same as existing ops |
| Cloud Functions invocations | 2M/month free | Well within limits |
| Cloud Scheduler | 3 jobs free | Using 1 job |
| Looker Studio | Free | No cost |

**Estimated monthly cost at 500 students: < ₹50 above existing Firebase costs.**

---

## Implementation Priority Order

1. **BUG-01 Fix** — `setUserRoleClaim` Cloud Function + `recoverOrphanedUser` (security critical)
2. **BUG-04 Fix** — `useCallback` on `handleTimeUp` in `ExamPage` (data integrity)
3. **BUG-02 Fix** — Keep `loading=true` until role resolved in `AuthContext`
4. **PERF-01 Fix** — Switch security rules to use `request.auth.token.role` after custom claims deployed
5. **Cloud Scheduler** — `updateExamStatuses` (operational reliability)
6. **`submitExam` Cloud Function** — server-side scoring (SEC-02 mitigation)
7. **BigQuery Extension** — install Firestore export extension
8. **BigQuery Views** — create analytics views
9. **Looker Studio** — connect and build dashboards
10. **`onExamDeleted`** — cascade cleanup (data hygiene)
