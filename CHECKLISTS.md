# CloudExamSystem — Project Checklists

---

## Firebase Setup Checklist

- [ ] Go to Firebase Console → Project Settings → General
- [ ] Verify `cloudexamsystem-499512` project is active
- [ ] Enable **Email/Password** under Authentication → Sign-in method
- [ ] Go to Firestore Database → Create database in **production mode**
- [ ] Deploy Firestore security rules:
  ```
  firebase deploy --only firestore:rules
  ```
  (rules file: `firestore.rules` in project root)
- [ ] Verify Firestore indexes (create composite indexes if Firestore console warns):
  - `results` collection: `studentId ASC, submittedAt DESC`
  - `results` collection: `examId ASC, submittedAt DESC`
- [ ] Install Firebase CLI if not installed: `npm install -g firebase-tools`
- [ ] Login: `firebase login`
- [ ] Initialize project: `firebase init` → select Firestore, Hosting
- [ ] Set `.firebaserc` project to `cloudexamsystem-499512`

---

## Environment Setup Checklist

- [ ] Copy `.env.example` → `.env` in `frontend/`
- [ ] Fill in all `REACT_APP_FIREBASE_*` values from Firebase Console
- [ ] Confirm `.env` is listed in `.gitignore` (already done)
- [ ] Never commit `.env` to version control
- [ ] For production deployment, set environment variables in Firebase Hosting / CI pipeline

---

## Migration Checklist (Mock → Firebase)

### Auth
- [x] `authService.js` replaced — uses Firebase Auth
- [x] `AuthContext.jsx` created — persists session via `onAuthStateChanged`
- [x] `ProtectedRoute.jsx` rewritten — waits for auth loading state
- [x] Login no longer trusts form role — fetches role from Firestore
- [x] Register writes `users/{uid}` document to Firestore

### Exams
- [x] `examService.js` replaced — reads/writes Firestore `exams` collection
- [x] Questions stored in `exams/{id}/questions` sub-collection
- [x] `CreateExamPage` fixed — questions added once, not twice
- [x] `computeExamStatus()` calculates live status from timestamps

### Results
- [x] `resultService.js` replaced — uses Firestore `results` collection
- [x] `submitResult()` fetches questions from Firestore, not mock data
- [x] Score calculation is dynamic per question marks (no hardcoded 10)
- [x] CommonJS `require()` removed — ES modules only

### Analytics
- [x] `analyticsService.js` replaced — aggregates from Firestore data
- [x] Empty state handled gracefully (no data yet message)

### UI / UX
- [x] All `Loading...` text replaced with `<LoadingSpinner />` component
- [x] Navbar reads from `AuthContext`
- [x] Sidebar reads from `AuthContext`
- [x] ProfilePage saves name to Firestore
- [x] NotFoundPage missing `Home` import fixed
- [x] BillingPage labelled as Simulated GCP Billing Dashboard

---

## Testing Checklist

### Authentication
- [ ] Register as Student → verify Firestore `users` document created with `role: student`
- [ ] Register as Faculty → verify Firestore `users` document created with `role: faculty`
- [ ] Login as Student → lands on `/student`
- [ ] Login as Faculty → lands on `/faculty`
- [ ] Login with wrong password → shows error message
- [ ] Refresh browser while logged in → session restored, no redirect to login
- [ ] Student manually navigates to `/faculty` → redirected to `/student`
- [ ] Faculty manually navigates to `/student/exams` → redirected to `/faculty`
- [ ] Unauthenticated user navigates to `/student` → redirected to `/login`
- [ ] Logout → redirected to `/login`, session cleared

### Exam Flow
- [ ] Faculty creates exam with 3+ questions → appears in Manage Exams table
- [ ] Questions count is correct (not doubled)
- [ ] Student sees exam on dashboard
- [ ] Student starts exam → questions load from Firestore
- [ ] Timer counts down
- [ ] Timer reaching 0 → auto-submits exam
- [ ] Student answers all questions → submits → navigates to `/result/:id`
- [ ] Correct answers calculated dynamically based on question marks

### Results
- [ ] Result page shows correct score, percentage, and pass/fail
- [ ] Download report generates correct text file
- [ ] Student results page (`/student/results`) shows all their results
- [ ] Faculty results page shows all results across all students

### Analytics
- [ ] Faculty analytics page shows charts populated from Firestore
- [ ] Empty state shows info alert when no results exist

### Profile
- [ ] Profile page loads user name and email from Firestore
- [ ] Edit name → Save → Firestore updated
- [ ] Role and email fields are read-only

### Security Rules
- [ ] Student cannot read another student's result in Firestore Console
- [ ] Faculty cannot update `role` field in user document
- [ ] Unauthenticated request to Firestore is denied

---

## Cloud Computing Preparation Checklist

These items are architecturally prepared but not yet implemented:

- [ ] **Cloud Functions**: Abstraction layer in `firebase/firestore.js` —
      replace `fsQueryWhere` for analytics with a Cloud Function call
      when `CLOUD_FEATURES.CLOUD_FUNCTIONS_ENABLED = true`

- [ ] **BigQuery**: Replace `analyticsService.js` implementations with
      BigQuery REST API calls when `CLOUD_FEATURES.BIGQUERY_ENABLED = true`

- [ ] **Cloud Scheduler**: Trigger status updates (`active`/`completed`)
      via a Cloud Function scheduled to run every minute

- [ ] **Cloud Storage**: Add image upload support to exam questions
      (field already present in schema design)

- [ ] **Looker Studio**: Connect to BigQuery export of `results` collection
      for advanced visualisation

- [ ] **Delete sub-collections**: Implement a Cloud Function triggered
      `onDelete` for `exams` to cascade delete `questions` sub-collection

---

## Idempotency & Retry-Safety Checklist (Phase 2 Cloud Functions)

Verify all four functions survive Firebase automatic retries without
side-effects (duplicate data, redundant writes, or broken state).

---

### evaluateExam — duplicate-result prevention

**Setup:** Deploy updated functions. Create a student account, assign an active exam.

- [ ] **Normal path**
  - Submit exam as a student → spinner shows "Evaluating exam securely…"
  - Result page loads → verify `cloudEvaluated: true` in Firestore
  - Firestore `results` collection has exactly **one** document with
    `submissionId == <the pending doc ID>`
  - `results_pending` document is deleted after evaluation

- [ ] **Idempotency Layer 1 — pre-flight check**
  - In Firestore Console: manually re-create the `results_pending` document
    with the same `submissionId` that was already evaluated
  - Observe Cloud Function logs → should print:
    `"evaluateExam: submission already processed (pre-check) — safe exit"`
  - Verify **no second result document** is created in `results`

- [ ] **Idempotency Layer 2 — transaction guard**
  - Check that result documents use a deterministic ID: `eval_<submissionId>`
  - Confirm only one document with that ID exists even after manual retrigger
  - In Firestore Console: try to manually create a second doc with the same
    deterministic ID → Firestore will reject (document already exists)

- [ ] **Partial failure simulation**
  - (Optional) Use Firebase Emulator: throw an error in the function after
    the result is written but before `results_pending` is deleted
  - Trigger a retry (re-create the pending doc)
  - Verify: Layer 1 detects the existing result and exits — no duplicate written
  - Verify: pending doc is cleaned up on the retry run

---

### setUserRoleClaim — no redundant claim writes

**Setup:** Register a new student and faculty account.

- [ ] **Normal path**
  - Register → check Firebase Console → Authentication → select user →
    Custom Claims should show `{"role":"student"}` (or `"faculty"`)
  - On next login → no Firestore read needed for role (check Network tab)

- [ ] **Idempotency — claim already set**
  - In Firebase Console → Authentication → manually add the same claim
    `{"role":"student"}` to an existing user
  - Simulate a retry: delete and re-create the `users/{uid}` document in
    Firestore with the same role
  - Cloud Function logs should print:
    `"setUserRoleClaim: claim already set correctly — no-op (idempotent exit)"`
  - Verify `setCustomUserClaims()` is **not** called again (no Auth write)

- [ ] **Role change detection**
  - Change a user's role field in Firestore to a different value
    (would only happen in a manual migration scenario)
  - Cloud Function fires → logs:
    `"setUserRoleClaim: updating custom claim"` with previousRole and newRole
  - Verify claim is updated correctly

- [ ] **Invalid role guard**
  - Create a `users/{uid}` document with `role: "admin"` (not in VALID_ROLES)
  - Cloud Function logs: `"setUserRoleClaim: invalid or missing role — skipping"`
  - No claim is written, no error thrown, no retry triggered

---

### deleteExamCascade — safe on already-empty sub-collection

**Setup:** Create an exam with 5 questions. Delete the exam from the UI.

- [ ] **Normal path**
  - Delete exam → Cloud Function logs: `"cascade delete complete"` with
    `totalDeleted: 5`
  - Verify `exams/{examId}/questions` sub-collection is empty in Firestore Console

- [ ] **Idempotency — sub-collection already empty**
  - Trigger a retry: in Firestore, re-fire the trigger by observing the log
    (or use Firebase Emulator to replay the event)
  - Cloud Function logs:
    `"deleteExamCascade: sub-collection already empty — no-op (idempotent exit)"`
  - No errors thrown, no batch operations attempted

- [ ] **Partial batch failure**
  - Create an exam with 250 questions (spans 3 batches of 100)
  - Delete exam → verify all 250 questions are removed
  - Confirm function handles large sub-collections without timeout

- [ ] **Exam with no questions**
  - Create and immediately delete an exam that has zero questions
  - Cloud Function logs: `"sub-collection already empty — no-op (idempotent exit)"`
  - No errors

---

### updateExamStatus — no redundant status writes

**Setup:** Create exams with startTime/endTime in different states.

- [ ] **Normal transitions**
  - Create an exam with `startTime` = 2 minutes ago, `endTime` = 1 hour from now,
    `status: "upcoming"`
  - Call the function → verify status changes to `"active"`
  - Return value includes `updatedUpcoming: 1`

- [ ] **Idempotency — repeated calls**
  - Call the function again immediately (exam is now `"active"`)
  - Function skips the exam → logs: `"exam already in correct state — skipped"`
  - Return value includes `skipped: 1`, `updatedUpcoming: 0`
  - Verify Firestore doc has **one** `updatedAt` timestamp (not two identical writes)

- [ ] **active → completed transition**
  - Create an exam with `endTime` = 2 minutes ago, `status: "active"`
  - Call function → status changes to `"completed"`
  - Call function again → exam is skipped (already completed)

- [ ] **Scheduler simulation**
  - Call `updateExamStatus` 5 times in quick succession (simulate scheduler firing)
  - Verify final Firestore state is identical to calling it once
  - `skipped` count increases on each subsequent call

- [ ] **Return value verification**
  - Check that every call returns `{ updatedUpcoming, updatedCompleted, skipped }`
    where `skipped + updatedUpcoming + updatedCompleted == total valid exams`

---

### General retry-safety (all functions)

- [x] **Deploy warning acknowledged** — Firebase prints the following on every deploy
      that includes a function with `retry: true`. This is **expected and not an error**:
      ```
      ! functions: The following functions will newly be retried in case of failure:
        deleteExamCascade(asia-south1), evaluateExam(asia-south1), setUserRoleClaim(asia-south1)
      ```
      All three functions are fully idempotent. Retries are safe by design:
      - `evaluateExam`      — two-layer deduplication (pre-check query + transaction)
      - `setUserRoleClaim`  — read-before-write claim check (no-op if already set)
      - `deleteExamCascade` — Firestore delete of non-existent doc is a silent no-op

- [ ] Deploy with `firebase deploy --only functions` — confirm no deploy errors
- [ ] Firebase Console → Functions → all 4 functions show status "ACTIVE"
- [ ] Check Logs Explorer for any `logger.error()` entries after a full test run
- [ ] Verify no duplicate documents in `results` collection after stress-testing submit flow

---

## Deployment Commands

```bash
# Deploy only Cloud Functions
firebase deploy --only functions

# Deploy Firestore rules
firebase deploy --only firestore:rules

# Deploy everything
firebase deploy

# ── Region migration: delete old us-central1 deployments ─────────────────────
# If functions were previously deployed without an explicit region (defaulting
# to us-central1), delete those orphaned deployments after redeploying to
# asia-south1.  Firebase will not auto-delete the old region copies.
firebase functions:delete evaluateExam     --region us-central1 --force
firebase functions:delete setUserRoleClaim --region us-central1 --force
firebase functions:delete deleteExamCascade --region us-central1 --force
firebase functions:delete updateExamStatus  --region us-central1 --force

# View function logs (last 50 lines)
firebase functions:log --limit 50

# View logs for a specific function
firebase functions:log --only evaluateExam

# Confirm deployed region in Firebase Console:
# Firebase Console → Functions → verify all 4 show "(asia-south1)"
```
