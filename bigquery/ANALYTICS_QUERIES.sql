-- ============================================================
--  CloudExam BigQuery Analytics Reference Queries
--  Dataset: cloudexam_analytics
--  Region:  asia-south1
--
--  All queries use partition pruning (WHERE submittedAt >= ...)
--  and benefit from clustering on (subject, examId).
--
--  Replace @dayRange with an integer (e.g. 30, 90, 365)
--  Replace @studentId with a Firebase Auth UID string
-- ============================================================


-- ─────────────────────────────────────────────────────────────
-- 1. Subject Performance
--    Average score and pass rate per subject.
--    Partition pruned + clustering on subject makes this cheap.
-- ─────────────────────────────────────────────────────────────
SELECT
  subject,
  COUNT(*)                                          AS total_submissions,
  ROUND(AVG(percentage), 2)                         AS avg_score_pct,
  COUNTIF(status = 'pass')                          AS pass_count,
  COUNTIF(status = 'fail')                          AS fail_count,
  ROUND(COUNTIF(status = 'pass') * 100.0
        / NULLIF(COUNT(*), 0), 2)                   AS pass_rate_pct,
  COUNT(DISTINCT studentId)                         AS unique_students,
  COUNT(DISTINCT examId)                            AS unique_exams
FROM `cloudexam_analytics.exam_results`
WHERE submittedAt >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 90 DAY)
  AND subject IS NOT NULL
GROUP BY subject
ORDER BY avg_score_pct DESC;


-- ─────────────────────────────────────────────────────────────
-- 2. Pass Rate per Subject
-- ─────────────────────────────────────────────────────────────
SELECT
  subject,
  COUNT(*)                                     AS total,
  COUNTIF(status = 'pass')                     AS passed,
  ROUND(COUNTIF(status = 'pass') * 100.0
        / NULLIF(COUNT(*), 0), 2)              AS pass_rate_pct
FROM `cloudexam_analytics.exam_results`
WHERE submittedAt >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 90 DAY)
  AND subject IS NOT NULL
GROUP BY subject
ORDER BY pass_rate_pct DESC;


-- ─────────────────────────────────────────────────────────────
-- 3. Top 10 Students by Average Score
-- ─────────────────────────────────────────────────────────────
SELECT
  studentId,
  studentName,
  COUNT(*)                                     AS total_exams_taken,
  ROUND(AVG(percentage), 2)                    AS avg_score_pct,
  COUNTIF(status = 'pass')                     AS exams_passed,
  ROUND(COUNTIF(status = 'pass') * 100.0
        / NULLIF(COUNT(*), 0), 2)              AS pass_rate_pct,
  MAX(percentage)                              AS best_score_pct
FROM `cloudexam_analytics.exam_results`
WHERE submittedAt >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 90 DAY)
  AND studentId IS NOT NULL
GROUP BY studentId, studentName
HAVING total_exams_taken >= 1
ORDER BY avg_score_pct DESC
LIMIT 10;


-- ─────────────────────────────────────────────────────────────
-- 4. Difficult Exams (lowest average score)
--    Clustering on examId makes this efficient.
-- ─────────────────────────────────────────────────────────────
SELECT
  examId,
  examTitle,
  subject,
  COUNT(*)                                     AS total_submissions,
  ROUND(AVG(percentage), 2)                    AS avg_score_pct,
  ROUND(COUNTIF(status = 'pass') * 100.0
        / NULLIF(COUNT(*), 0), 2)              AS pass_rate_pct,
  COUNT(DISTINCT studentId)                    AS unique_students
FROM `cloudexam_analytics.exam_results`
WHERE submittedAt >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 90 DAY)
  AND examId IS NOT NULL
GROUP BY examId, examTitle, subject
HAVING total_submissions >= 2
ORDER BY avg_score_pct ASC
LIMIT 10;


-- ─────────────────────────────────────────────────────────────
-- 5. Exam Attempt Counts
--    How many times each exam has been submitted.
-- ─────────────────────────────────────────────────────────────
SELECT
  examId,
  examTitle,
  subject,
  COUNT(*)                                                        AS total_submissions,
  COUNT(DISTINCT studentId)                                       AS unique_students,
  ROUND(COUNT(*) * 1.0 / NULLIF(COUNT(DISTINCT studentId), 0), 2) AS avg_attempts_per_student,
  MAX(attemptNumber)                                              AS max_attempt_seen,
  COUNTIF(status = 'pass')                                        AS total_passes
FROM `cloudexam_analytics.exam_results`
WHERE submittedAt >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 90 DAY)
  AND examId IS NOT NULL
GROUP BY examId, examTitle, subject
ORDER BY total_submissions DESC;


-- ─────────────────────────────────────────────────────────────
-- 6. Monthly Submission Trends
-- ─────────────────────────────────────────────────────────────
SELECT
  FORMAT_TIMESTAMP('%Y-%m', submittedAt)  AS month,
  COUNT(*)                                AS total_submissions,
  COUNT(DISTINCT studentId)               AS unique_students,
  COUNT(DISTINCT examId)                  AS unique_exams,
  ROUND(AVG(percentage), 2)               AS avg_score_pct,
  ROUND(COUNTIF(status = 'pass') * 100.0
        / NULLIF(COUNT(*), 0), 2)         AS pass_rate_pct
FROM `cloudexam_analytics.exam_results`
WHERE submittedAt >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 365 DAY)
GROUP BY month
ORDER BY month ASC;


-- ─────────────────────────────────────────────────────────────
-- 7. Faculty Dashboard Summary
-- ─────────────────────────────────────────────────────────────
SELECT
  COUNT(DISTINCT examId)                    AS total_exams,
  COUNT(*)                                  AS total_submissions,
  COUNT(DISTINCT studentId)                 AS total_students,
  ROUND(AVG(percentage), 2)                 AS average_score,
  ROUND(COUNTIF(status = 'pass') * 100.0
        / NULLIF(COUNT(*), 0), 2)           AS pass_rate
FROM `cloudexam_analytics.exam_results`
WHERE submittedAt >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 90 DAY);


-- ─────────────────────────────────────────────────────────────
-- 8. Student Analytics (replace @studentId with a real UID)
-- ─────────────────────────────────────────────────────────────
SELECT
  studentId,
  studentName,
  COUNT(*)                                  AS total_attempts,
  ROUND(AVG(percentage), 2)                 AS average_score,
  ROUND(COUNTIF(status = 'pass') * 100.0
        / NULLIF(COUNT(*), 0), 2)           AS pass_rate,
  COUNT(DISTINCT examId)                    AS unique_exams_attempted
FROM `cloudexam_analytics.exam_results`
WHERE studentId = @studentId
  AND submittedAt >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 90 DAY)
GROUP BY studentId, studentName;


-- ─────────────────────────────────────────────────────────────
-- 9. Student Improvement Trend (per attempt per exam)
-- ─────────────────────────────────────────────────────────────
SELECT
  examTitle,
  subject,
  attemptNumber,
  percentage,
  status,
  submittedAt
FROM `cloudexam_analytics.exam_results`
WHERE studentId = @studentId
  AND submittedAt >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 180 DAY)
ORDER BY examId, attemptNumber ASC;


-- ─────────────────────────────────────────────────────────────
-- 10. Audit Event Counts by Action (last 30 days)
-- ─────────────────────────────────────────────────────────────
SELECT
  action,
  COUNT(*)                        AS event_count,
  COUNT(DISTINCT userId)          AS unique_users,
  MIN(timestamp)                  AS first_seen,
  MAX(timestamp)                  AS last_seen
FROM `cloudexam_analytics.exam_events`
WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
GROUP BY action
ORDER BY event_count DESC;


-- ─────────────────────────────────────────────────────────────
-- 11. Exam Funnel: Started vs Submitted
--     Uses audit events to measure drop-off.
-- ─────────────────────────────────────────────────────────────
SELECT
  targetId                                                      AS examId,
  COUNTIF(action = 'EXAM_STARTED')                              AS started,
  COUNTIF(action = 'EXAM_SUBMITTED')                            AS submitted,
  ROUND(COUNTIF(action = 'EXAM_SUBMITTED') * 100.0
        / NULLIF(COUNTIF(action = 'EXAM_STARTED'), 0), 2)       AS completion_rate_pct
FROM `cloudexam_analytics.exam_events`
WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 90 DAY)
  AND action IN ('EXAM_STARTED', 'EXAM_SUBMITTED')
  AND targetId IS NOT NULL
GROUP BY examId
ORDER BY started DESC;


-- ─────────────────────────────────────────────────────────────
-- 12. Looker Studio: Subject Performance Chart data
--     (connect directly via BQ Data Source in Looker Studio)
-- ─────────────────────────────────────────────────────────────
SELECT
  subject,
  ROUND(AVG(percentage), 2)               AS avg_score,
  ROUND(COUNTIF(status = 'pass') * 100.0
        / NULLIF(COUNT(*), 0), 2)         AS pass_rate,
  COUNT(*)                                AS submissions
FROM `cloudexam_analytics.exam_results`
WHERE submittedAt >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 90 DAY)
  AND subject IS NOT NULL
GROUP BY subject
ORDER BY avg_score DESC;
