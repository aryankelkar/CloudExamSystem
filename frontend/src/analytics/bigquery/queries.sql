-- =============================================================================
-- BigQuery SQL Queries — Cloud Examination System Analytics
-- =============================================================================
--
-- Dataset:   firebase-project-id.analytics_XXXXXXXXX
-- Tables:    events_YYYYMMDD  (GA4 daily export, partitioned by _TABLE_SUFFIX)
-- Region:    asia-south1 (Mumbai) — match your Firebase/BigQuery dataset region
--
-- ─── COST OPTIMISATION NOTES ─────────────────────────────────────────────────
--
-- 1. ALWAYS use _TABLE_SUFFIX filter with a date range.
--    GA4 exports ~1 table per day. Without a suffix filter BigQuery scans ALL
--    historical tables = full table scan = maximum cost.
--
-- 2. UNNEST(event_params) only when you need a specific param key.
--    GA4 stores event parameters as an ARRAY<STRUCT> (event_params).
--    Each UNNEST call materialises the full array — expensive at scale.
--    Use the ep_str() / ep_int() macros below to fetch one key at a time
--    with a WHERE filter on `key` BEFORE unnesting the full value.
--
-- 3. Use partition pruning: event_date is the partition column.
--    Filter on event_date OR _TABLE_SUFFIX to enable pruning.
--
-- 4. Use APPROX_COUNT_DISTINCT for cardinality estimates (DAU, unique students).
--    It's 2% error tolerance vs exact COUNT(DISTINCT) which requires a full sort.
--    For dashboards, 2% error is acceptable and costs ~10x less.
--
-- 5. All queries below use the last 90 days by default.
--    Adjust the _TABLE_SUFFIX range to match your dashboard time window.
--
-- ─── PARAMETER EXTRACTION MACROS ─────────────────────────────────────────────
--
-- GA4 params are stored as ARRAY<STRUCT<key STRING, value STRUCT<...>>>.
-- Use these subquery patterns to extract values safely.
--
-- String param:
--   (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'param_name')
--
-- Integer param:
--   (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'param_name')
--
-- Float param:
--   (SELECT value.double_value FROM UNNEST(event_params) WHERE key = 'param_name')
--
-- ─── REPLACE BEFORE RUNNING ──────────────────────────────────────────────────
--   your-project-id   → your Firebase/GCP project ID
--   analytics_XXXXXXXXX  → your GA4 Analytics property numeric ID (found in
--                          BigQuery console under your project dataset)
-- =============================================================================


-- =============================================================================
-- QUERY 1: Overview Metrics
-- Faculty Dashboard summary cards
-- Returns: total_students, total_faculty, total_exams_created,
--          total_exams_started, total_exams_submitted,
--          average_score, pass_percentage
-- Scheduled refresh: every 6 hours
-- Estimated scan: ~200MB per 90 days for typical exam system scale
-- =============================================================================

SELECT
  -- ── User counts ────────────────────────────────────────────────────────────
  COUNTIF(event_name = 'user_registration'
    AND (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'user_role') = 'student'
  ) AS total_students_registered,

  COUNTIF(event_name = 'user_registration'
    AND (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'user_role') = 'faculty'
  ) AS total_faculty_registered,

  -- ── Exam lifecycle funnel ──────────────────────────────────────────────────
  COUNTIF(event_name = 'exam_created')    AS total_exams_created,
  COUNTIF(event_name = 'exam_started')    AS total_exams_started,
  COUNTIF(event_name = 'exam_submitted')  AS total_exams_submitted,

  -- ── Scoring ───────────────────────────────────────────────────────────────
  ROUND(
    AVG(
      CASE WHEN event_name = 'exam_submitted'
      THEN (SELECT value.double_value FROM UNNEST(event_params) WHERE key = 'percentage')
      END
    ), 2
  ) AS average_score_percentage,

  ROUND(
    COUNTIF(
      event_name = 'exam_submitted'
      AND (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'pass_status') = 'pass'
    ) * 100.0
    / NULLIF(COUNTIF(event_name = 'exam_submitted'), 0),
    2
  ) AS pass_percentage

FROM
  `your-project-id.analytics_XXXXXXXXX.events_*`

WHERE
  -- ── Partition pruning — last 90 days ───────────────────────────────────────
  -- _TABLE_SUFFIX is the date suffix of the partitioned table (YYYYMMDD).
  -- FORMAT_DATE produces a string like '20250101' which BigQuery can compare
  -- directly to _TABLE_SUFFIX without casting — this enables partition pruning.
  _TABLE_SUFFIX BETWEEN
    FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE('Asia/Kolkata'), INTERVAL 90 DAY))
    AND
    FORMAT_DATE('%Y%m%d', CURRENT_DATE('Asia/Kolkata'))

  -- ── Environment filter — only count production events ─────────────────────
  AND (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'environment')
      = 'production'
;


-- =============================================================================
-- QUERY 2: Daily Active Users (DAU) — Last 30 Days
-- Line chart: unique users who fired any event per day
-- Uses APPROX_COUNT_DISTINCT for cost efficiency (2% error is fine for DAU)
-- =============================================================================

SELECT
  event_date                            AS date,            -- 'YYYYMMDD'
  APPROX_COUNT_DISTINCT(user_pseudo_id) AS daily_active_users,
  APPROX_COUNT_DISTINCT(
    CASE WHEN (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'user_role') = 'student'
    THEN user_pseudo_id END
  )                                     AS daily_active_students,
  APPROX_COUNT_DISTINCT(
    CASE WHEN (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'user_role') = 'faculty'
    THEN user_pseudo_id END
  )                                     AS daily_active_faculty

FROM
  `your-project-id.analytics_XXXXXXXXX.events_*`

WHERE
  _TABLE_SUFFIX BETWEEN
    FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE('Asia/Kolkata'), INTERVAL 30 DAY))
    AND
    FORMAT_DATE('%Y%m%d', CURRENT_DATE('Asia/Kolkata'))

  AND (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'environment')
      = 'production'

GROUP BY
  event_date

ORDER BY
  event_date ASC
;


-- =============================================================================
-- QUERY 3: Most Attempted Exams — Top 20
-- Bar chart: exam title vs number of starts and completions
-- Funnel: started → submitted (drop-off = abandonment rate)
-- =============================================================================

SELECT
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'exam_id')    AS exam_id,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'exam_title') AS exam_title,

  COUNTIF(event_name = 'exam_started')   AS total_started,
  COUNTIF(event_name = 'exam_submitted') AS total_submitted,

  ROUND(
    COUNTIF(event_name = 'exam_submitted') * 100.0
    / NULLIF(COUNTIF(event_name = 'exam_started'), 0),
    2
  ) AS completion_rate_pct,

  ROUND(
    AVG(
      CASE WHEN event_name = 'exam_submitted'
      THEN (SELECT value.double_value FROM UNNEST(event_params) WHERE key = 'percentage')
      END
    ), 2
  ) AS avg_score_pct

FROM
  `your-project-id.analytics_XXXXXXXXX.events_*`

WHERE
  _TABLE_SUFFIX BETWEEN
    FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE('Asia/Kolkata'), INTERVAL 90 DAY))
    AND
    FORMAT_DATE('%Y%m%d', CURRENT_DATE('Asia/Kolkata'))

  AND event_name IN ('exam_started', 'exam_submitted')

  AND (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'environment')
      = 'production'

  -- Only rows where exam_id is present — filters out null exam_id rows cheaply
  -- before the GROUP BY materialises
  AND (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'exam_id')
      IS NOT NULL

GROUP BY
  exam_id,
  exam_title

ORDER BY
  total_started DESC

LIMIT 20
;


-- =============================================================================
-- QUERY 4: Pass Rate by Exam
-- Table: exam_id, exam_title, total_submitted, pass_count, fail_count, pass_rate
-- =============================================================================

SELECT
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'exam_id')    AS exam_id,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'exam_title') AS exam_title,

  COUNT(*)                                                          AS total_submitted,

  COUNTIF(
    (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'pass_status') = 'pass'
  )                                                                 AS pass_count,

  COUNTIF(
    (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'pass_status') = 'fail'
  )                                                                 AS fail_count,

  ROUND(
    COUNTIF(
      (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'pass_status') = 'pass'
    ) * 100.0 / COUNT(*),
    2
  )                                                                 AS pass_rate_pct,

  ROUND(
    AVG(SELECT value.double_value FROM UNNEST(event_params) WHERE key = 'percentage'),
    2
  )                                                                 AS avg_percentage

FROM
  `your-project-id.analytics_XXXXXXXXX.events_*`

WHERE
  _TABLE_SUFFIX BETWEEN
    FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE('Asia/Kolkata'), INTERVAL 90 DAY))
    AND
    FORMAT_DATE('%Y%m%d', CURRENT_DATE('Asia/Kolkata'))

  AND event_name = 'exam_submitted'

  AND (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'environment')
      = 'production'

GROUP BY
  exam_id,
  exam_title

ORDER BY
  total_submitted DESC
;


-- =============================================================================
-- QUERY 5: Recent Activity Feed — Last 50 Submissions
-- Ordered by event_timestamp DESC for the activity feed widget
-- =============================================================================

SELECT
  TIMESTAMP_MICROS(event_timestamp)                                                AS submitted_at,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'user_id')     AS user_id,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'user_role')   AS user_role,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'exam_id')     AS exam_id,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'exam_title')  AS exam_title,
  (SELECT value.int_value    FROM UNNEST(event_params) WHERE key = 'score')       AS score,
  (SELECT value.int_value    FROM UNNEST(event_params) WHERE key = 'total_marks') AS total_marks,
  (SELECT value.double_value FROM UNNEST(event_params) WHERE key = 'percentage')  AS percentage,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'pass_status') AS pass_status,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'session_id')  AS session_id

FROM
  `your-project-id.analytics_XXXXXXXXX.events_*`

WHERE
  _TABLE_SUFFIX BETWEEN
    FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE('Asia/Kolkata'), INTERVAL 7 DAY))
    AND
    FORMAT_DATE('%Y%m%d', CURRENT_DATE('Asia/Kolkata'))

  AND event_name = 'exam_submitted'

  AND (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'environment')
      = 'production'

ORDER BY
  event_timestamp DESC

LIMIT 50
;


-- =============================================================================
-- QUERY 6: Exam Submission Funnel — Login → Exam Start → Exam Submit
-- Funnel analysis: what % of logins lead to exam completion?
-- Uses user_pseudo_id to track the same user across events
-- =============================================================================

WITH user_events AS (
  SELECT
    user_pseudo_id,
    MAX(CASE WHEN event_name = 'user_login'      THEN 1 ELSE 0 END) AS did_login,
    MAX(CASE WHEN event_name = 'exam_started'    THEN 1 ELSE 0 END) AS did_start,
    MAX(CASE WHEN event_name = 'exam_submitted'  THEN 1 ELSE 0 END) AS did_submit
  FROM
    `your-project-id.analytics_XXXXXXXXX.events_*`
  WHERE
    _TABLE_SUFFIX BETWEEN
      FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE('Asia/Kolkata'), INTERVAL 30 DAY))
      AND
      FORMAT_DATE('%Y%m%d', CURRENT_DATE('Asia/Kolkata'))

    AND (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'environment')
        = 'production'

    AND (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'user_role')
        = 'student'
  GROUP BY
    user_pseudo_id
)

SELECT
  COUNTIF(did_login  = 1)                                              AS step1_logged_in,
  COUNTIF(did_start  = 1)                                              AS step2_started_exam,
  COUNTIF(did_submit = 1)                                              AS step3_submitted_exam,

  ROUND(COUNTIF(did_start  = 1) * 100.0 / NULLIF(COUNTIF(did_login  = 1), 0), 2) AS login_to_start_pct,
  ROUND(COUNTIF(did_submit = 1) * 100.0 / NULLIF(COUNTIF(did_start  = 1), 0), 2) AS start_to_submit_pct,
  ROUND(COUNTIF(did_submit = 1) * 100.0 / NULLIF(COUNTIF(did_login  = 1), 0), 2) AS login_to_submit_pct

FROM user_events
;


-- =============================================================================
-- QUERY 7: Score Distribution Buckets
-- Histogram: how many students scored 0–10, 10–20, … 90–100?
-- =============================================================================

SELECT
  CASE
    WHEN percentage < 10  THEN '0–10'
    WHEN percentage < 20  THEN '10–20'
    WHEN percentage < 30  THEN '20–30'
    WHEN percentage < 40  THEN '30–40'
    WHEN percentage < 50  THEN '40–50'
    WHEN percentage < 60  THEN '50–60'
    WHEN percentage < 70  THEN '60–70'
    WHEN percentage < 80  THEN '70–80'
    WHEN percentage < 90  THEN '80–90'
    ELSE                       '90–100'
  END                          AS score_bucket,
  COUNT(*)                     AS student_count,
  ROUND(AVG(percentage), 2)   AS avg_in_bucket

FROM (
  SELECT
    (SELECT value.double_value FROM UNNEST(event_params) WHERE key = 'percentage') AS percentage
  FROM
    `your-project-id.analytics_XXXXXXXXX.events_*`
  WHERE
    _TABLE_SUFFIX BETWEEN
      FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE('Asia/Kolkata'), INTERVAL 90 DAY))
      AND
      FORMAT_DATE('%Y%m%d', CURRENT_DATE('Asia/Kolkata'))

    AND event_name = 'exam_submitted'

    AND (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'environment')
        = 'production'
)

GROUP BY score_bucket
ORDER BY MIN(percentage) ASC
;
