/**
 * functions/src/bigquery/schema.js
 *
 * BigQuery dataset and table definitions for CloudExam analytics warehouse.
 *
 * Design decisions:
 *
 * PARTITIONING on submittedAt (DATE):
 *   BigQuery charges per byte scanned. Partitioning by submission date means
 *   a query like "last 30 days" only scans ~30 partitions instead of the full
 *   table. At 1000 submissions/day over 2 years that's a 24× cost reduction.
 *
 * CLUSTERING on (subject, examId):
 *   Within each partition, rows are physically co-located by subject first,
 *   then examId. Queries like "WHERE subject = 'DSA'" skip entire data blocks
 *   that don't contain DSA rows. This reduces bytes scanned by another 5-10×
 *   for subject-filtered analytics queries.
 *
 * Combined effect: a "subject performance last 30 days" query that would scan
 * 500MB on an unpartitioned/unclustered table may scan only 5-10MB here.
 */

"use strict";

const DATASET_ID = "cloudexam_analytics";
const LOCATION = "asia-south1";

/* ─── Table: exam_results ──────────────────────────────────────────────────── */

const EXAM_RESULTS_TABLE_ID = "exam_results";

const EXAM_RESULTS_SCHEMA = [
  {name: "resultId", type: "STRING", mode: "REQUIRED", description: "Firestore result document ID"},
  {name: "studentId", type: "STRING", mode: "REQUIRED", description: "Firebase Auth UID of student"},
  {name: "studentName", type: "STRING", mode: "NULLABLE", description: "Display name at submission time"},
  {name: "examId", type: "STRING", mode: "REQUIRED", description: "Firestore exam document ID"},
  {name: "examTitle", type: "STRING", mode: "NULLABLE", description: "Exam title at submission time"},
  {name: "subject", type: "STRING", mode: "NULLABLE", description: "Subject name — used for clustering"},
  {name: "score", type: "INTEGER", mode: "NULLABLE", description: "Marks obtained"},
  {name: "totalMarks", type: "INTEGER", mode: "NULLABLE", description: "Maximum possible marks"},
  {name: "percentage", type: "FLOAT", mode: "NULLABLE", description: "Score percentage 0-100"},
  {name: "status", type: "STRING", mode: "NULLABLE", description: "\"pass\" or \"fail\""},
  {name: "correctAnswers", type: "INTEGER", mode: "NULLABLE", description: "Number of correct answers"},
  {name: "wrongAnswers", type: "INTEGER", mode: "NULLABLE", description: "Number of wrong answers"},
  {name: "attemptNumber", type: "INTEGER", mode: "NULLABLE", description: "Which attempt this is (1-based)"},
  {name: "submittedAt", type: "TIMESTAMP", mode: "REQUIRED", description: "Partition column — submission timestamp"},
  {name: "syncedAt", type: "TIMESTAMP", mode: "NULLABLE", description: "When this row was inserted into BQ"},
];

const EXAM_RESULTS_METADATA = {
  timePartitioning: {
    type: "DAY",
    field: "submittedAt", // partition by submission date
  },
  clustering: {
    fields: ["subject", "examId"], // cluster within partition
  },
  description: "Exam submission results synced from Firestore. Partitioned by day, clustered by subject and examId.",
};

/* ─── Table: exam_events ───────────────────────────────────────────────────── */

const EXAM_EVENTS_TABLE_ID = "exam_events";

const EXAM_EVENTS_SCHEMA = [
  {name: "logId", type: "STRING", mode: "REQUIRED", description: "Firestore auditLogs document ID"},
  {name: "action", type: "STRING", mode: "REQUIRED", description: "Audit action name, e.g. EXAM_SUBMITTED"},
  {name: "userId", type: "STRING", mode: "NULLABLE", description: "Firebase Auth UID of actor"},
  {name: "userRole", type: "STRING", mode: "NULLABLE", description: "\"student\" or \"faculty\""},
  {name: "targetId", type: "STRING", mode: "NULLABLE", description: "ID of the affected entity"},
  {name: "targetType", type: "STRING", mode: "NULLABLE", description: "Type of the affected entity (exam, result, user)"},
  {name: "timestamp", type: "TIMESTAMP", mode: "REQUIRED", description: "Partition column — event timestamp"},
  {name: "syncedAt", type: "TIMESTAMP", mode: "NULLABLE", description: "When this row was inserted into BQ"},
];

const EXAM_EVENTS_METADATA = {
  timePartitioning: {
    type: "DAY",
    field: "timestamp",
  },
  clustering: {
    fields: ["action", "userRole"],
  },
  description: "Audit log events synced from Firestore auditLogs collection. Partitioned by day, clustered by action and userRole.",
};

/* ─── Exports ──────────────────────────────────────────────────────────────── */

module.exports = {
  DATASET_ID,
  LOCATION,
  EXAM_RESULTS_TABLE_ID,
  EXAM_RESULTS_SCHEMA,
  EXAM_RESULTS_METADATA,
  EXAM_EVENTS_TABLE_ID,
  EXAM_EVENTS_SCHEMA,
  EXAM_EVENTS_METADATA,
};
