/**
 * functions/src/bigquery/queries.js
 *
 * All analytics SQL queries for CloudExam BigQuery warehouse.
 *
 * Table references:
 *   cloudexam_analytics.exam_results  — partitioned by submittedAt, clustered by subject, examId
 *   cloudexam_analytics.exam_events   — partitioned by timestamp, clustered by action, userRole
 *
 * Query parameters use @name syntax (BigQuery named parameters).
 * All queries include a dayRange parameter to leverage partition pruning.
 *
 * Cost notes:
 *   Every WHERE clause on the partition column (submittedAt, timestamp) prunes
 *   partitions — BigQuery only scans data within the specified date range.
 *   The clustering columns (subject, examId) further reduce bytes scanned
 *   when those fields appear in WHERE or GROUP BY.
 */

"use strict";

const {DATASET_ID, EXAM_RESULTS_TABLE_ID} = require("./schema");

const R = `\`${DATASET_ID}.${EXAM_RESULTS_TABLE_ID}\``; // exam_results shorthand
// exam_events table referenced directly in EXAM_EVENTS_TABLE_ID for sync functions

/* ─── 1. Subject Performance ──────────────────────────────────────────────── */

/**
 * Average score and pass rate per subject.
 * Partition pruned by submittedAt date range.
 * Clustering on subject means BQ skips non-matching subject blocks.
 */
const SUBJECT_PERFORMANCE = `
  SELECT
    subject,
    COUNT(*)                                          AS total_submissions,
    ROUND(AVG(percentage), 2)                         AS avg_score_pct,
    COUNTIF(status = 'pass')                          AS pass_count,
    COUNTIF(status = 'fail')                          AS fail_count,
    ROUND(COUNTIF(status = 'pass') * 100.0
          / NULLIF(COUNT(*), 0), 2)                   AS pass_rate_pct,
    ROUND(AVG(score), 2)                              AS avg_raw_score,
    ROUND(AVG(totalMarks), 2)                         AS avg_total_marks,
    COUNT(DISTINCT studentId)                         AS unique_students,
    COUNT(DISTINCT examId)                            AS unique_exams
  FROM ${R}
  WHERE submittedAt >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL @dayRange DAY)
    AND subject IS NOT NULL
  GROUP BY subject
  ORDER BY avg_score_pct DESC
`;

/* ─── 2. Pass Rate by Subject ─────────────────────────────────────────────── */

const PASS_RATE_BY_SUBJECT = `
  SELECT
    subject,
    COUNT(*)                                     AS total,
    COUNTIF(status = 'pass')                     AS passed,
    ROUND(COUNTIF(status = 'pass') * 100.0
          / NULLIF(COUNT(*), 0), 2)              AS pass_rate_pct
  FROM ${R}
  WHERE submittedAt >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL @dayRange DAY)
    AND subject IS NOT NULL
  GROUP BY subject
  ORDER BY pass_rate_pct DESC
`;

/* ─── 3. Top Students (by average score) ─────────────────────────────────── */

const TOP_STUDENTS = `
  SELECT
    studentId,
    studentName,
    COUNT(*)                                     AS total_exams_taken,
    ROUND(AVG(percentage), 2)                    AS avg_score_pct,
    COUNTIF(status = 'pass')                     AS exams_passed,
    ROUND(COUNTIF(status = 'pass') * 100.0
          / NULLIF(COUNT(*), 0), 2)              AS pass_rate_pct,
    MAX(percentage)                              AS best_score_pct,
    MIN(percentage)                              AS lowest_score_pct
  FROM ${R}
  WHERE submittedAt >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL @dayRange DAY)
    AND studentId IS NOT NULL
  GROUP BY studentId, studentName
  HAVING total_exams_taken >= 1
  ORDER BY avg_score_pct DESC
  LIMIT @topN
`;

/* ─── 4. Difficult Exams (lowest average score) ───────────────────────────── */

const DIFFICULT_EXAMS = `
  SELECT
    examId,
    examTitle,
    subject,
    COUNT(*)                                     AS total_submissions,
    ROUND(AVG(percentage), 2)                    AS avg_score_pct,
    ROUND(COUNTIF(status = 'pass') * 100.0
          / NULLIF(COUNT(*), 0), 2)              AS pass_rate_pct,
    COUNT(DISTINCT studentId)                    AS unique_students
  FROM ${R}
  WHERE submittedAt >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL @dayRange DAY)
    AND examId IS NOT NULL
  GROUP BY examId, examTitle, subject
  HAVING total_submissions >= @minSubmissions
  ORDER BY avg_score_pct ASC
  LIMIT @topN
`;

/* ─── 5. Exam Attempt Counts ──────────────────────────────────────────────── */

const EXAM_ATTEMPT_COUNTS = `
  SELECT
    examId,
    examTitle,
    subject,
    COUNT(*)                        AS total_submissions,
    COUNT(DISTINCT studentId)       AS unique_students,
    ROUND(COUNT(*) * 1.0
          / NULLIF(COUNT(DISTINCT studentId), 0), 2) AS avg_attempts_per_student,
    MAX(attemptNumber)              AS max_attempt_number,
    COUNTIF(status = 'pass')        AS total_passes,
    COUNTIF(status = 'fail')        AS total_fails
  FROM ${R}
  WHERE submittedAt >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL @dayRange DAY)
    AND examId IS NOT NULL
  GROUP BY examId, examTitle, subject
  ORDER BY total_submissions DESC
`;

/* ─── 6. Monthly Submission Trends ───────────────────────────────────────── */

const MONTHLY_TRENDS = `
  SELECT
    FORMAT_TIMESTAMP('%Y-%m', submittedAt)  AS month,
    COUNT(*)                                AS total_submissions,
    COUNT(DISTINCT studentId)               AS unique_students,
    COUNT(DISTINCT examId)                  AS unique_exams,
    ROUND(AVG(percentage), 2)               AS avg_score_pct,
    COUNTIF(status = 'pass')                AS pass_count,
    COUNTIF(status = 'fail')                AS fail_count,
    ROUND(COUNTIF(status = 'pass') * 100.0
          / NULLIF(COUNT(*), 0), 2)         AS pass_rate_pct
  FROM ${R}
  WHERE submittedAt >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL @dayRange DAY)
  GROUP BY month
  ORDER BY month ASC
`;

/* ─── 7. Faculty Analytics Dashboard ─────────────────────────────────────── */

const FACULTY_DASHBOARD = `
  SELECT
    COUNT(DISTINCT examId)                    AS total_exams,
    COUNT(*)                                  AS total_submissions,
    COUNT(DISTINCT studentId)                 AS total_students,
    ROUND(AVG(percentage), 2)                 AS average_score,
    ROUND(COUNTIF(status = 'pass') * 100.0
          / NULLIF(COUNT(*), 0), 2)           AS pass_rate,
    (
      SELECT subject
      FROM ${R} inner_r
      WHERE inner_r.submittedAt >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL @dayRange DAY)
        AND inner_r.subject IS NOT NULL
      GROUP BY subject
      ORDER BY AVG(percentage) DESC
      LIMIT 1
    )                                         AS top_subject,
    (
      SELECT examTitle
      FROM ${R} inner_r
      WHERE inner_r.submittedAt >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL @dayRange DAY)
        AND inner_r.examId IS NOT NULL
      GROUP BY examId, examTitle
      HAVING COUNT(*) >= 2
      ORDER BY AVG(percentage) ASC
      LIMIT 1
    )                                         AS hardest_exam
  FROM ${R}
  WHERE submittedAt >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL @dayRange DAY)
`;

/* ─── 8. Student Analytics (per student) ─────────────────────────────────── */

const STUDENT_ANALYTICS = `
  SELECT
    studentId,
    studentName,
    COUNT(*)                                  AS total_attempts,
    ROUND(AVG(percentage), 2)                 AS average_score,
    ROUND(COUNTIF(status = 'pass') * 100.0
          / NULLIF(COUNT(*), 0), 2)           AS pass_rate,
    COUNT(DISTINCT examId)                    AS unique_exams_attempted,
    (
      SELECT subject FROM ${R} s
      WHERE s.studentId = outer_r.studentId
        AND s.submittedAt >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL @dayRange DAY)
        AND s.subject IS NOT NULL
      GROUP BY subject
      ORDER BY AVG(percentage) DESC
      LIMIT 1
    )                                         AS best_subject,
    (
      SELECT subject FROM ${R} s
      WHERE s.studentId = outer_r.studentId
        AND s.submittedAt >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL @dayRange DAY)
        AND s.subject IS NOT NULL
      GROUP BY subject
      ORDER BY AVG(percentage) ASC
      LIMIT 1
    )                                         AS weakest_subject
  FROM ${R} outer_r
  WHERE studentId = @studentId
    AND submittedAt >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL @dayRange DAY)
  GROUP BY studentId, studentName
`;

/* ─── 9. Student Improvement Trend (attempt-by-attempt) ──────────────────── */

const STUDENT_IMPROVEMENT = `
  SELECT
    examId,
    examTitle,
    subject,
    attemptNumber,
    percentage,
    status,
    submittedAt
  FROM ${R}
  WHERE studentId = @studentId
    AND submittedAt >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL @dayRange DAY)
  ORDER BY examId, attemptNumber ASC
`;

/* ─── 10. Overview Metrics (for analytics cache) ─────────────────────────── */

const OVERVIEW_METRICS = `
  SELECT
    COUNT(DISTINCT studentId)   AS total_students,
    COUNT(DISTINCT examId)      AS total_exams,
    COUNT(*)                    AS total_submissions,
    ROUND(AVG(percentage), 2)   AS average_score,
    ROUND(COUNTIF(status = 'pass') * 100.0
          / NULLIF(COUNT(*), 0), 2)  AS pass_percentage
  FROM ${R}
  WHERE submittedAt >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL @dayRange DAY)
`;

/* ─── 11. Exam Participation (for analytics cache charts) ────────────────── */

const EXAM_PARTICIPATION = `
  SELECT
    examId,
    examTitle,
    COUNT(*)                        AS participants,
    COUNTIF(status = 'pass')        AS completed_pass,
    COUNTIF(status = 'fail')        AS completed_fail,
    ROUND(AVG(percentage), 2)       AS avg_score,
    ROUND(COUNTIF(status = 'pass') * 100.0
          / NULLIF(COUNT(*), 0), 2) AS pass_rate
  FROM ${R}
  WHERE submittedAt >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL @dayRange DAY)
    AND examId IS NOT NULL
  GROUP BY examId, examTitle
  ORDER BY participants DESC
  LIMIT 20
`;

/* ─── 12. Top Students for cache ─────────────────────────────────────────── */

const TOP_STUDENTS_CACHE = `
  SELECT
    studentId,
    studentName,
    ROUND(AVG(percentage), 2)  AS score,
    COUNT(*)                   AS exams_taken
  FROM ${R}
  WHERE submittedAt >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL @dayRange DAY)
    AND studentId IS NOT NULL
  GROUP BY studentId, studentName
  ORDER BY score DESC
  LIMIT 10
`;

/* ─── 13. Average marks by subject (for cache charts) ───────────────────── */

const AVERAGE_MARKS_BY_SUBJECT = `
  SELECT
    subject,
    ROUND(AVG(percentage), 2)  AS average,
    COUNT(*)                   AS students
  FROM ${R}
  WHERE submittedAt >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL @dayRange DAY)
    AND subject IS NOT NULL
  GROUP BY subject
  ORDER BY average DESC
`;

/* ─── Exports ──────────────────────────────────────────────────────────────── */

module.exports = {
  SUBJECT_PERFORMANCE,
  PASS_RATE_BY_SUBJECT,
  TOP_STUDENTS,
  DIFFICULT_EXAMS,
  EXAM_ATTEMPT_COUNTS,
  MONTHLY_TRENDS,
  FACULTY_DASHBOARD,
  STUDENT_ANALYTICS,
  STUDENT_IMPROVEMENT,
  OVERVIEW_METRICS,
  EXAM_PARTICIPATION,
  TOP_STUDENTS_CACHE,
  AVERAGE_MARKS_BY_SUBJECT,
};
