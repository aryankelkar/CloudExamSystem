# CloudExamSystem — Analytics Event Catalogue

Firebase Analytics events stream automatically to BigQuery when the BigQuery
export link is enabled in the Firebase Console.

Each event becomes a row in:
```
<project_id>.analytics_<property_id>.events_YYYYMMDD
```

---

## Event Reference

### `user_login`

Fired after a successful email/password login.

| Parameter | Type   | Description                  | Example       |
|-----------|--------|------------------------------|---------------|
| `role`    | string | Role of the authenticated user | `"student"` |

**Source:** `authService.js → loginUser()`  
**BigQuery use:** Daily active users by role, login frequency trends.

---

### `user_registration`

Fired after a new user's Firestore profile is successfully written (both Auth
account and profile document exist — registration is complete).

| Parameter | Type   | Description                        | Example      |
|-----------|--------|------------------------------------|--------------|
| `role`    | string | Role chosen during registration    | `"faculty"`  |
| `method`  | string | Sign-up method (always `"email"`)  | `"email"`    |

**Source:** `authService.js → registerUser()`  
**BigQuery use:** Registration funnel, role distribution over time.

---

### `exam_created`

Fired after a faculty member successfully creates an exam and all questions
are persisted to Firestore.

| Parameter | Type   | Description                        | Example              |
|-----------|--------|------------------------------------|----------------------|
| `exam_id` | string | Firestore document ID of the exam  | `"abc123xyz"`        |

**Source:** `CreateExamPage.jsx → handleSubmit()`  
**BigQuery use:** Exam creation rate, content growth tracking.

---

### `exam_started`

Fired when a student's ExamPage finishes loading and the exam is presented.
Signals the start of a student's active exam session.

| Parameter   | Type   | Description                         | Example              |
|-------------|--------|-------------------------------------|----------------------|
| `exam_id`   | string | Firestore document ID of the exam   | `"abc123xyz"`        |
| `exam_title`| string | Human-readable title of the exam    | `"Cloud Computing"`  |

**Source:** `ExamPage.jsx → useEffect (load)`  
**BigQuery use:** Exam popularity, start-to-submit funnel analysis.

---

### `exam_submitted`

Fired after the Cloud Function (`evaluateExam`) successfully evaluates the
submission and the `resultId` is returned to the frontend.

| Parameter | Type   | Description                                      | Example       |
|-----------|--------|--------------------------------------------------|---------------|
| `exam_id` | string | Firestore document ID of the exam                | `"abc123xyz"` |
| `score`   | number | Obtained marks as evaluated by the Cloud Function | `42`         |

**Source:** `ExamPage.jsx → confirmSubmit()`  
**BigQuery use:** Submission completion rate, average score per exam,
drop-off between `exam_started` and `exam_submitted`.

> **Note:** `score` is `0` at submission time because evaluation is
> asynchronous on the server. The actual score is visible in the `result`
> Firestore document and can be joined with this event via `exam_id` in
> BigQuery.

---

### `result_viewed`

Fired when a single result document is successfully fetched and displayed on
`ResultPage` (route: `/result/:id`).

| Parameter | Type   | Description                             | Example       |
|-----------|--------|-----------------------------------------|---------------|
| `exam_id` | string | The `examId` stored on the result doc   | `"abc123xyz"` |

**Source:** `ResultPage.jsx → useEffect (load)`  
**BigQuery use:** Result engagement rate, percentage of students who view
their result after submitting.

---

### `user_logout`

Fired immediately before `firebaseSignOut()` is called, while the analytics
session is still active.

| Parameter | Type | Description |
|-----------|------|-------------|
| *(none)*  | —    | No additional parameters needed |

**Source:** `authService.js → logoutUser()`  
**BigQuery use:** Session length estimation, logout frequency.

---

## BigQuery Schema Notes

All parameters are **primitive types only** (string, number, boolean).
No objects, arrays, or nested structures are ever passed — Firebase drops
non-primitive parameters silently.

Parameter names use **snake_case** to match GA4 and BigQuery column naming
conventions. GA4 reserved parameter names (`name`, `value`, `currency`,
`items`) are intentionally avoided.

### Joining with Firestore exports

`exam_id` maps directly to Firestore `exams/{examId}` document IDs, enabling
BigQuery joins between the `events_*` analytics tables and Firestore export
tables when the Firestore BigQuery extension is enabled.

---

## Enabling BigQuery Export

1. Firebase Console → Project Settings → Integrations → BigQuery
2. Click **Link** → select your GCP project
3. Enable **Include advertising ID** if applicable
4. Events begin streaming within 24 hours
5. Daily export tables: `analytics_<property_id>.events_YYYYMMDD`
6. Intraday streaming tables (Spark/Blaze plan): `events_intraday_YYYYMMDD`

---

## Sample BigQuery Queries

### Daily registrations by role
```sql
SELECT
  DATE(TIMESTAMP_MICROS(event_timestamp)) AS date,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'role') AS role,
  COUNT(*) AS registrations
FROM `<project>.analytics_<id>.events_*`
WHERE event_name = 'user_registration'
GROUP BY date, role
ORDER BY date DESC;
```

### Exam start-to-submit funnel
```sql
WITH started AS (
  SELECT
    (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'exam_id') AS exam_id,
    COUNT(DISTINCT user_pseudo_id) AS started_count
  FROM `<project>.analytics_<id>.events_*`
  WHERE event_name = 'exam_started'
  GROUP BY exam_id
),
submitted AS (
  SELECT
    (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'exam_id') AS exam_id,
    COUNT(DISTINCT user_pseudo_id) AS submitted_count
  FROM `<project>.analytics_<id>.events_*`
  WHERE event_name = 'exam_submitted'
  GROUP BY exam_id
)
SELECT
  s.exam_id,
  s.started_count,
  COALESCE(sub.submitted_count, 0) AS submitted_count,
  ROUND(SAFE_DIVIDE(COALESCE(sub.submitted_count, 0), s.started_count) * 100, 1) AS completion_pct
FROM started s
LEFT JOIN submitted sub USING (exam_id)
ORDER BY completion_pct ASC;
```

### Average score per exam
```sql
SELECT
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'exam_id') AS exam_id,
  AVG((SELECT value.int_value  FROM UNNEST(event_params) WHERE key = 'score'))  AS avg_score,
  COUNT(*) AS total_submissions
FROM `<project>.analytics_<id>.events_*`
WHERE event_name = 'exam_submitted'
GROUP BY exam_id
ORDER BY avg_score DESC;
```
