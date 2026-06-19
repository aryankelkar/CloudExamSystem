# CloudExam BigQuery Integration — Deployment Guide

## Architecture Overview

```
Student submits exam
        ↓
  Firestore: results/{resultId}       ←─ source of truth (operational DB)
        ↓  onCreate trigger
  syncResultToBigQuery (Cloud Fn)
        ↓  streaming insert
  BigQuery: cloudexam_analytics.exam_results   ←─ analytics warehouse

Audit event fires
        ↓
  Firestore: auditLogs/{logId}
        ↓  onCreate trigger
  syncAuditLogToBigQuery (Cloud Fn)
        ↓  streaming insert
  BigQuery: cloudexam_analytics.exam_events

Every 6 hours:
  refreshAnalyticsCache (Scheduled Fn)
        ↓  runs BQ queries
  Firestore: analytics_cache/{metric}   ←─ dashboard reads from here
```

---

## Step 1 — Prerequisites

```bash
# Authenticate with GCP
gcloud auth login
gcloud auth application-default login

# Set your project
gcloud config set project YOUR_PROJECT_ID

# Enable required APIs
gcloud services enable bigquery.googleapis.com
gcloud services enable cloudfunctions.googleapis.com
gcloud services enable cloudscheduler.googleapis.com
```

---

## Step 2 — Install dependencies

```bash
cd CloudExamSystem/functions
npm install
```

Verify `@google-cloud/bigquery` is in `package.json`:
```json
"@google-cloud/bigquery": "^7.9.1"
```

---

## Step 3 — Create BigQuery dataset and tables

```bash
cd CloudExamSystem/functions
node scripts/setupBigQuery.js
```

Expected output:
```
▶  Dataset: cloudexam_analytics (asia-south1)
   ✓  Dataset created: cloudexam_analytics
▶  Table: cloudexam_analytics.exam_results
   ✓  Table created: exam_results
   ℹ  Partitioned by: submittedAt (DAY)
   ℹ  Clustered by: subject, examId
▶  Table: cloudexam_analytics.exam_events
   ✓  Table created: exam_events
   ℹ  Partitioned by: timestamp (DAY)
   ℹ  Clustered by: action, userRole
✅  BigQuery infrastructure ready.
```

---

## Step 4 — Grant IAM permissions

Replace `YOUR_PROJECT_ID` with your actual project ID.

```bash
PROJECT_ID=YOUR_PROJECT_ID
SA="${PROJECT_ID}@appspot.gserviceaccount.com"

# BigQuery write access for sync functions
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA}" \
  --role="roles/bigquery.dataEditor"

# BigQuery job execution for analytics queries
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA}" \
  --role="roles/bigquery.jobUser"

# Firestore access (already required by other functions)
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA}" \
  --role="roles/datastore.user"
```

---

## Step 5 — Deploy Cloud Functions

### Deploy all BigQuery functions at once:
```bash
cd CloudExamSystem
firebase deploy --only \
  functions:syncResultToBigQuery,\
  functions:syncAuditLogToBigQuery,\
  functions:getFacultyAnalytics,\
  functions:getStudentAnalytics,\
  functions:refreshAnalyticsCache
```

### Deploy individually:
```bash
# Sync triggers
firebase deploy --only functions:syncResultToBigQuery
firebase deploy --only functions:syncAuditLogToBigQuery

# Analytics callables
firebase deploy --only functions:getFacultyAnalytics
firebase deploy --only functions:getStudentAnalytics

# Scheduled cache refresh
firebase deploy --only functions:refreshAnalyticsCache
```

---

## Step 6 — Verify data flow

### Submit a test exam, then verify BQ received the row:
```bash
bq query --use_legacy_sql=false \
  'SELECT resultId, studentName, examTitle, percentage, status, submittedAt
   FROM `YOUR_PROJECT_ID.cloudexam_analytics.exam_results`
   ORDER BY submittedAt DESC
   LIMIT 5'
```

### Verify audit events:
```bash
bq query --use_legacy_sql=false \
  'SELECT action, userId, userRole, timestamp
   FROM `YOUR_PROJECT_ID.cloudexam_analytics.exam_events`
   ORDER BY timestamp DESC
   LIMIT 10'
```

### Manually trigger cache refresh (for testing):
```bash
# Call the scheduled function via HTTP emulator or Firebase Console
firebase functions:shell
# Then: refreshAnalyticsCache.run()
```

---

## Step 7 — Enable frontend analytics from BigQuery

In `frontend/src/utils/constants.js`:
```js
export const CLOUD_FEATURES = {
  BIGQUERY_ENABLED: true,   // ← change from false to true
  ...
};
```

The `analyticsRepository.js` in the frontend will now:
1. First try reading from `analytics_cache` (Firestore, populated by `refreshAnalyticsCache`)
2. Fall back to live Firestore aggregation if cache is empty

---

## Step 8 — Connect Looker Studio

1. Go to [lookerstudio.google.com](https://lookerstudio.google.com)
2. Click **Create** → **Report**
3. Choose **BigQuery** as data source
4. Select your project → `cloudexam_analytics` dataset

### Recommended charts:

| Chart Type      | Dimension         | Metric          | Table                |
|----------------|-------------------|-----------------|----------------------|
| Bar Chart       | subject           | avg(percentage) | exam_results         |
| Pie Chart       | status            | count(*)        | exam_results         |
| Line Chart      | month(submittedAt)| count(*)        | exam_results         |
| Table           | studentName       | avg(percentage) | exam_results (top 10)|
| Bar Chart       | examTitle         | avg(percentage) | exam_results (bottom)|
| Scorecard       | -                 | count(studentId distinct) | exam_results |

### Useful Looker Studio calculated fields:
```
Pass Rate = COUNTIF(status = "pass") / COUNT(*) * 100
Avg Score = AVG(percentage)
```

### Date range filter:
- Use `submittedAt` as the date range dimension
- Set default to "Last 90 days"
- This leverages BQ partition pruning automatically

---

## Cost Optimisation Explanation

### Partitioning on `submittedAt` (DATE)
BigQuery charges **$5 per TB scanned**. Without partitioning, every query
scans the entire `exam_results` table. With daily partitioning on `submittedAt`:

- A "last 30 days" query scans only 30 partitions
- A "last 90 days" query scans only 90 partitions
- A query for a specific date scans only 1 partition

At 1000 submissions/day over 2 years (730K rows), a 90-day query scans
~12% of the data instead of 100%. **Cost reduction: ~8×.**

### Clustering on `subject, examId`
Within each partition, BQ physically co-locates rows with the same subject.
A query like `WHERE subject = 'Data Structures'` skips entire data blocks
for other subjects without scanning them.

Combined with partitioning, a subject-specific 30-day query might scan
1-5% of what an unoptimized table would require. **Additional reduction: ~5-10×.**

### Scheduled cache refresh (not per-user queries)
Without caching, every faculty dashboard load would run a full BQ scan.
With the 6-hour cache:
- **Before:** 100 faculty × 10 loads/day = 1000 BQ scans/day
- **After:** 4 BQ scans/day (scheduled)
- **Cost reduction: 250×**

### Streaming insert vs batch load
`syncResultToBigQuery` uses streaming insertAll, which has a small per-row
cost ($0.01 per 200MB inserted). For an exam platform at typical scale
(thousands of submissions), this is negligible compared to query costs.
If you scale to millions of submissions, switch to BigQuery Storage Write API
with COMMITTED streams for lower cost and exactly-once semantics.

---

## Function Summary

| Function               | Trigger          | Purpose                           |
|------------------------|------------------|-----------------------------------|
| syncResultToBigQuery   | results onCreate | Streams result → BQ exam_results  |
| syncAuditLogToBigQuery | auditLogs onCreate | Streams audit → BQ exam_events  |
| refreshAnalyticsCache  | Scheduled 6h     | BQ → Firestore analytics_cache    |
| getFacultyAnalytics    | HTTPS Callable   | BQ queries for faculty dashboard  |
| getStudentAnalytics    | HTTPS Callable   | BQ queries for student profile    |

---

## Backfilling existing data

If you have existing results in Firestore that pre-date this integration,
run this one-time backfill script:

```bash
# First, export Firestore results collection to GCS
gcloud firestore export gs://YOUR_BUCKET/firestore-export \
  --collection-ids=results

# Then load into BigQuery
bq load --source_format=DATASTORE_BACKUP \
  cloudexam_analytics.exam_results \
  gs://YOUR_BUCKET/firestore-export/all_namespaces/kind_results/*.export_metadata
```

Note: Firestore export schema differs from the BQ table schema — you may
need a Dataflow job for a clean transform. For small datasets (<100K rows),
a script that reads Firestore and calls the BQ streaming API directly is simpler.
