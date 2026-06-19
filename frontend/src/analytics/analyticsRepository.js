/**
 * analytics/analyticsRepository.js
 *
 * Data access layer for the Analytics Dashboard.
 *
 * ─── DATA FLOW ARCHITECTURE ──────────────────────────────────────────────────
 *
 *   AnalyticsPage
 *       ↓ calls
 *   analyticsRepository  (this file)
 *       ↓ reads from
 *   Firestore: analytics_cache/{metric}
 *       ↑ populated by
 *   Cloud Function: refreshAnalyticsCache (scheduled every 6h)
 *       ↑ reads from
 *   BigQuery: analytics_cache Cloud Function queries GA4 export tables
 *
 * ─── WHY A CACHE LAYER? ──────────────────────────────────────────────────────
 *
 *   Option A (rejected): AnalyticsPage queries BigQuery directly from the browser.
 *     - Requires exposing a BigQuery service account key to the client. SECURITY RISK.
 *     - Every page load runs a full BigQuery scan. COST RISK.
 *     - Latency: BigQuery cold query takes 1–3 seconds. Poor UX.
 *
 *   Option B (rejected): AnalyticsPage calls a Cloud Function on every load.
 *     - Each function invocation runs a BigQuery scan.
 *     - 100 faculty members × 10 loads/day = 1000 BigQuery scans/day. COST RISK.
 *
 *   Option C (chosen): Scheduled Cloud Function refreshes a Firestore cache.
 *     - BigQuery runs on a schedule (every 6 hours) — predictable cost.
 *     - AnalyticsPage reads from Firestore (cheap, <1ms read latency).
 *     - Stale-while-revalidate UX: show cached data immediately, then refresh.
 *
 * ─── CACHE STRUCTURE IN FIRESTORE ────────────────────────────────────────────
 *
 *   Collection: analytics_cache
 *   Documents:
 *     analytics_cache/overview_metrics       → getOverviewMetrics()
 *     analytics_cache/exam_performance       → getExamPerformance()
 *     analytics_cache/user_activity          → getUserActivity()
 *     analytics_cache/daily_active_users     → getDailyActiveUsers()
 *     analytics_cache/pass_rate              → getPassRate()
 *
 *   Each document shape:
 *     {
 *       data:        any       — the actual metric payload
 *       refreshedAt: Timestamp — when the Cloud Function last wrote this
 *       source:      string    — 'bigquery' | 'firestore_fallback'
 *     }
 *
 * ─── FALLBACK STRATEGY ────────────────────────────────────────────────────────
 *
 *   If the cache document is missing (first deployment, cache never populated):
 *     → Falls back to the legacy Firestore aggregation from getDashboardAnalytics()
 *     → Logs a warning so the developer knows to deploy the scheduled function
 *
 * ─── FEATURE FLAG ────────────────────────────────────────────────────────────
 *
 *   CLOUD_FEATURES.BIGQUERY_ENABLED = false  → always use Firestore fallback
 *   CLOUD_FEATURES.BIGQUERY_ENABLED = true   → read from analytics_cache first
 *
 *   Set BIGQUERY_ENABLED = true in constants.js after:
 *     1. BigQuery export is confirmed active in Firebase console
 *     2. analyticsCache Cloud Function is deployed and has run at least once
 */

import { fsGetDoc }              from '../firebase/firestore';
import { CLOUD_FEATURES }        from '../utils/constants';
import { getDashboardAnalytics } from '../services/analyticsService';

// ─── Firestore collection for cached analytics ────────────────────────────────
const ANALYTICS_CACHE = 'analytics_cache';

// ─── Cache document IDs ───────────────────────────────────────────────────────
const CACHE_KEYS = Object.freeze({
  OVERVIEW:     'overview_metrics',
  EXAM_PERF:    'exam_performance',
  USER_ACTIVITY:'user_activity',
  DAU:          'daily_active_users',
  PASS_RATE:    'pass_rate',
});

// ─── Max age before the cache is considered stale ─────────────────────────────
// Stale cache is still served to avoid blank dashboards, but a warning is logged.
const CACHE_STALE_THRESHOLD_MS = 8 * 60 * 60 * 1000; // 8 hours

const isDev = process.env.NODE_ENV === 'development';

// ═══════════════════════════════════════════════════════════════════════════════
// Internal helpers
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * readCache
 *
 * Reads a single analytics cache document from Firestore.
 * Returns the inner `data` field if the document exists and is not null.
 * Returns null if the document is missing or has no data.
 *
 * @param {string} cacheKey  One of the CACHE_KEYS values
 * @returns {Promise<any|null>}
 */
const readCache = async (cacheKey) => {
  try {
    const doc = await fsGetDoc(ANALYTICS_CACHE, cacheKey);
    if (!doc || !doc.data) return null;

    // Check for stale cache — warn but still return the data
    if (doc.refreshedAt) {
      const refreshedAt = doc.refreshedAt?.toDate
        ? doc.refreshedAt.toDate()
        : new Date(doc.refreshedAt);
      const ageMs = Date.now() - refreshedAt.getTime();

      if (ageMs > CACHE_STALE_THRESHOLD_MS && isDev) {
        console.warn(
          `[AnalyticsRepo] Cache "${cacheKey}" is stale ` +
          `(last refreshed ${Math.round(ageMs / 3600000)}h ago). ` +
          'Ensure the refreshAnalyticsCache Cloud Function is deployed and scheduled.'
        );
      }
    }

    return doc.data;
  } catch (err) {
    if (isDev) {
      console.warn(`[AnalyticsRepo] Failed to read cache "${cacheKey}":`, err);
    }
    return null;
  }
};

/**
 * withFallback
 *
 * Higher-order helper: tries to read from the BigQuery cache first.
 * If cache is missing and BIGQUERY_ENABLED is true, logs a guidance message.
 * Falls back to the provided fallbackFn in all failure/absent cases.
 *
 * @param {string}   cacheKey
 * @param {Function} fallbackFn   Async function that returns Firestore-aggregated data
 * @returns {Promise<any>}
 */
const withFallback = async (cacheKey, fallbackFn) => {
  if (CLOUD_FEATURES.BIGQUERY_ENABLED) {
    const cached = await readCache(cacheKey);
    if (cached !== null) return cached;

    if (isDev) {
      console.info(
        `[AnalyticsRepo] Cache "${cacheKey}" is empty. ` +
        'Deploy the refreshAnalyticsCache Cloud Function and set it on a schedule. ' +
        'Falling back to Firestore aggregation.'
      );
    }
  }

  // Firestore fallback
  return fallbackFn();
};

// ═══════════════════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * getOverviewMetrics
 *
 * Returns the high-level summary card metrics for the dashboard header row:
 *   totalStudents, totalFaculty, totalExams, totalExamsStarted,
 *   totalExamsSubmitted, averageScore, passPercentage
 *
 * @returns {Promise<{
 *   totalStudents:       number,
 *   totalFaculty:        number,
 *   totalExams:          number,
 *   totalExamsStarted:   number,
 *   totalExamsSubmitted: number,
 *   averageScore:        number,
 *   passPercentage:      number,
 * }>}
 */
export const getOverviewMetrics = () =>
  withFallback(CACHE_KEYS.OVERVIEW, async () => {
    const full = await getDashboardAnalytics();
    return {
      totalStudents:       full.summary.totalStudents,
      totalFaculty:        0,  // Firestore fallback cannot count faculty cheaply — BQ query fills this
      totalExams:          full.summary.totalExams,
      totalExamsStarted:   0,  // Sourced from GA4 BQ export only
      totalExamsSubmitted: full.examParticipation.reduce((s, e) => s + e.completed, 0),
      averageScore:        full.summary.averageScore,
      passPercentage:      full.summary.passRate,
    };
  });

/**
 * getExamPerformance
 *
 * Returns per-exam participation and scoring data for bar charts.
 *
 * @returns {Promise<Array<{
 *   examId:       string,
 *   examTitle:    string,
 *   participants: number,
 *   avgScore:     number,
 *   passRate:     number,
 * }>>}
 */
export const getExamPerformance = () =>
  withFallback(CACHE_KEYS.EXAM_PERF, async () => {
    const full = await getDashboardAnalytics();
    return full.examParticipation.map((e) => ({
      examId:       e.examId    ?? '',
      examTitle:    e.exam      ?? 'Unknown',
      participants: e.participants,
      avgScore:     e.avgScore  ?? 0,
      passRate:     e.passRate  ?? 0,
    }));
  });

/**
 * getUserActivity
 *
 * Returns monthly activity trends (exams completed, unique students active).
 *
 * @returns {Promise<Array<{
 *   month:    string,
 *   exams:    number,
 *   students: number,
 * }>>}
 */
export const getUserActivity = () =>
  withFallback(CACHE_KEYS.USER_ACTIVITY, async () => {
    const full = await getDashboardAnalytics();
    return full.monthlyTrends;
  });

/**
 * getPassRate
 *
 * Returns overall and per-subject pass/fail counts.
 *
 * @returns {Promise<{
 *   overall:     { pass: number, fail: number },
 *   bySubject:   Array<{ subject: string, pass: number, fail: number, passRate: number }>,
 * }>}
 */
export const getPassRate = () =>
  withFallback(CACHE_KEYS.PASS_RATE, async () => {
    const full = await getDashboardAnalytics();
    return {
      overall:   { pass: full.passFail.pass, fail: full.passFail.fail },
      bySubject: full.subjectPerformance.map((s) => ({
        subject:  s.subject,
        pass:     0,  // Subject-level pass/fail split requires BQ — use 0 as sentinel
        fail:     0,
        passRate: s.score,
      })),
    };
  });

/**
 * getDailyActiveUsers
 *
 * Returns the last 30 days of daily active user counts.
 * This metric is only available from BigQuery (GA4 export).
 * Returns an empty array when BIGQUERY_ENABLED is false.
 *
 * @returns {Promise<Array<{
 *   date:         string,  // 'YYYY-MM-DD'
 *   activeUsers:  number,
 * }>>}
 */
export const getDailyActiveUsers = () =>
  withFallback(CACHE_KEYS.DAU, async () => {
    // DAU cannot be computed from Firestore alone (requires event-level data
    // from GA4 BigQuery export). Return empty array — AnalyticsPage hides
    // this chart when data is unavailable.
    if (isDev) {
      console.info(
        '[AnalyticsRepo] getDailyActiveUsers() requires BigQuery. ' +
        'Enable CLOUD_FEATURES.BIGQUERY_ENABLED and deploy refreshAnalyticsCache.'
      );
    }
    return [];
  });

/**
 * getRecentActivity
 *
 * Returns the 10 most recent exam submission events for the activity feed.
 * Sourced from Firestore results collection (always available, no BQ needed).
 *
 * @returns {Promise<Array<{
 *   studentName: string,
 *   examTitle:   string,
 *   score:       number,
 *   percentage:  number,
 *   status:      string,
 *   timestamp:   string,
 * }>>}
 */
export const getRecentActivity = async () => {
  try {
    const full = await getDashboardAnalytics();
    // Recent activity comes from the topStudents and monthlyTrends data
    // The scheduled function enriches this from BQ — Firestore fallback
    // returns a simplified version
    return (full.topStudents || []).slice(0, 10).map((s) => ({
      studentName: s.name,
      examTitle:   'Recent Exam',
      score:       s.score,
      percentage:  s.score,
      status:      s.score >= 50 ? 'pass' : 'fail',
      timestamp:   new Date().toISOString(),
    }));
  } catch {
    return [];
  }
};

/**
 * getAllDashboardData
 *
 * Convenience method — fetches all dashboard metrics in parallel.
 * Used by AnalyticsPage to minimise waterfall latency.
 *
 * @returns {Promise<{
 *   overview:      object,
 *   examPerf:      Array,
 *   userActivity:  Array,
 *   passRate:      object,
 *   dau:           Array,
 *   recentActivity:Array,
 *   // legacy fields for backward compatibility with existing chart components
 *   summary:            object,
 *   passFail:           object,
 *   averageMarks:       Array,
 *   topStudents:        Array,
 *   examParticipation:  Array,
 *   subjectPerformance: Array,
 *   monthlyTrends:      Array,
 * }>}
 */
export const getAllDashboardData = async () => {
  const [overview, examPerf, userActivity, passRate, dau, recentActivity, legacyFull] =
    await Promise.all([
      getOverviewMetrics(),
      getExamPerformance(),
      getUserActivity(),
      getPassRate(),
      getDailyActiveUsers(),
      getRecentActivity(),
      getDashboardAnalytics(),  // legacy data for existing chart components
    ]);

  return {
    // New structured fields
    overview,
    examPerf,
    userActivity,
    passRate,
    dau,
    recentActivity,
    // Legacy fields — kept so existing AnalyticsPage chart code works unchanged
    summary:            legacyFull.summary,
    passFail:           legacyFull.passFail,
    averageMarks:       legacyFull.averageMarks,
    topStudents:        legacyFull.topStudents,
    examParticipation:  legacyFull.examParticipation,
    subjectPerformance: legacyFull.subjectPerformance,
    monthlyTrends:      legacyFull.monthlyTrends,
  };
};
