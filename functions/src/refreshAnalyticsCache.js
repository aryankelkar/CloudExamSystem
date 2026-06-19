/**
 * functions/src/refreshAnalyticsCache.js
 *
 * Cloud Function Gen 2 — Scheduled Analytics Cache Refresh
 *
 * ─── PURPOSE ──────────────────────────────────────────────────────────────────
 *
 * Runs on a schedule (every 6 hours) to:
 *   1. Query BigQuery cloudexam_analytics dataset for fresh metrics
 *   2. Write results to Firestore: analytics_cache/{metric}
 *   3. AnalyticsPage reads from Firestore (cheap, <1ms) instead of BQ
 *
 * Data source:
 *   cloudexam_analytics.exam_results  — synced by syncResultToBigQuery
 *   cloudexam_analytics.exam_events   — synced by syncAuditLogToBigQuery
 *
 * This is NOT a GA4 export query — it queries the Firestore-synced warehouse.
 *
 * Cost pattern:
 *   BigQuery runs 4 times/day regardless of user count.
 *   AnalyticsPage reads from Firestore — free at this scale.
 *
 * ─── FIRESTORE OUTPUT ────────────────────────────────────────────────────────
 *
 *   analytics_cache/overview_metrics      → getOverviewMetrics()
 *   analytics_cache/exam_performance      → getExamPerformance()
 *   analytics_cache/user_activity         → getUserActivity()
 *   analytics_cache/pass_rate             → getPassRate()
 *   analytics_cache/top_students          → top students chart
 *   analytics_cache/subject_performance   → subject breakdown chart
 *   analytics_cache/average_marks         → average marks bar chart
 *
 * ─── DEPLOYMENT ──────────────────────────────────────────────────────────────
 *
 *   firebase deploy --only functions:refreshAnalyticsCache
 *
 * ─── IAM ─────────────────────────────────────────────────────────────────────
 *
 *   Cloud Functions service account needs:
 *     roles/bigquery.dataViewer   on cloudexam_analytics dataset
 *     roles/bigquery.jobUser      on the project
 *     roles/datastore.user        on the project
 */

"use strict";

const {onSchedule} = require("firebase-functions/v2/scheduler");
const {getFirestore, FieldValue} = require("firebase-admin/firestore");
const {runQuery} = require("./bigquery/client");
const {
  OVERVIEW_METRICS,
  EXAM_PARTICIPATION,
  MONTHLY_TRENDS,
  PASS_RATE_BY_SUBJECT,
  TOP_STUDENTS_CACHE,
  AVERAGE_MARKS_BY_SUBJECT,
  SUBJECT_PERFORMANCE,
} = require("./bigquery/queries");

const CACHE_COLLECTION = "analytics_cache";
const DAY_RANGE = 90; // default look-back window for cache queries

/* ─── Cache writer ────────────────────────────────────────────────────────── */

const writeCache = async (db, docId, data) => {
  await db.collection(CACHE_COLLECTION).doc(docId).set({
    data,
    refreshedAt: FieldValue.serverTimestamp(),
    source: "bigquery",
  });
  console.info(`[refreshAnalyticsCache] Cache written: ${docId} (${Array.isArray(data) ? data.length + " rows" : "object"})`);
};

/* ─── Scheduled function ──────────────────────────────────────────────────── */

exports.refreshAnalyticsCache = onSchedule(
    {
      schedule: "every 6 hours",
      timeZone: "Asia/Kolkata",
      region: "asia-south1",
      timeoutSeconds: 300,
      memory: "256MiB",
    },
    async () => {
      const start = Date.now();
      const db = getFirestore();
      const p = {dayRange: DAY_RANGE}; // named params shared by all queries

      console.info("[refreshAnalyticsCache] Starting scheduled cache refresh.");

      /* Run all BQ queries in parallel */
      const results = await Promise.allSettled([
        runQuery(OVERVIEW_METRICS, p), // [0]
        runQuery(EXAM_PARTICIPATION, p), // [1]
        runQuery(MONTHLY_TRENDS, p), // [2]
        runQuery(PASS_RATE_BY_SUBJECT, p), // [3]
        runQuery(TOP_STUDENTS_CACHE, p), // [4]
        runQuery(AVERAGE_MARKS_BY_SUBJECT, p), // [5]
        runQuery(SUBJECT_PERFORMANCE, p), // [6]
      ]);

      const [
        overviewRes,
        examPerfRes,
        monthlyRes,
        passRateRes,
        topStudentsRes,
        avgMarksRes,
        subjectPerfRes,
      ] = results;

      const writes = [];
      let failCount = 0;

      /* ── overview_metrics ── */
      if (overviewRes.status === "fulfilled") {
        const row = overviewRes.value[0] ?? {};
        writes.push(writeCache(db, "overview_metrics", {
          totalStudents: Number(row.total_students ?? 0),
          totalExams: Number(row.total_exams ?? 0),
          totalExamsSubmitted: Number(row.total_submissions ?? 0),
          averageScore: Number(row.average_score ?? 0),
          passPercentage: Number(row.pass_percentage ?? 0),
        }));
      } else {
        failCount++;
        console.error("[refreshAnalyticsCache] overview_metrics failed:", overviewRes.reason?.message);
      }

      /* ── exam_performance ── */
      if (examPerfRes.status === "fulfilled") {
        const rows = (examPerfRes.value ?? []).map((r) => ({
          examId: r.examId,
          exam: r.examTitle,
          participants: Number(r.participants ?? 0),
          completed: Number(r.completed_pass ?? 0) + Number(r.completed_fail ?? 0),
          avgScore: Number(r.avg_score ?? 0),
          passRate: Number(r.pass_rate ?? 0),
        }));
        writes.push(writeCache(db, "exam_performance", rows));
      } else {
        failCount++;
        console.error("[refreshAnalyticsCache] exam_performance failed:", examPerfRes.reason?.message);
      }

      /* ── user_activity (monthly trends) ── */
      if (monthlyRes.status === "fulfilled") {
        const rows = (monthlyRes.value ?? []).map((r) => ({
          month: r.month,
          exams: Number(r.total_submissions ?? 0),
          students: Number(r.unique_students ?? 0),
        }));
        writes.push(writeCache(db, "user_activity", rows));
      } else {
        failCount++;
        console.error("[refreshAnalyticsCache] user_activity failed:", monthlyRes.reason?.message);
      }

      /* ── pass_rate ── */
      if (passRateRes.status === "fulfilled") {
        const rows = (passRateRes.value ?? []).map((r) => ({
          subject: r.subject,
          pass: Number(r.passed ?? 0),
          fail: Number(r.total ?? 0) - Number(r.passed ?? 0),
          passRate: Number(r.pass_rate_pct ?? 0),
        }));
        writes.push(writeCache(db, "pass_rate", rows));
      } else {
        failCount++;
        console.error("[refreshAnalyticsCache] pass_rate failed:", passRateRes.reason?.message);
      }

      /* ── top_students ── */
      if (topStudentsRes.status === "fulfilled") {
        const rows = (topStudentsRes.value ?? []).map((r) => ({
          studentId: r.studentId,
          name: r.studentName,
          score: Number(r.score ?? 0),
          exams: Number(r.exams_taken ?? 0),
        }));
        writes.push(writeCache(db, "top_students", rows));
      } else {
        failCount++;
        console.error("[refreshAnalyticsCache] top_students failed:", topStudentsRes.reason?.message);
      }

      /* ── average_marks (by subject bar chart) ── */
      if (avgMarksRes.status === "fulfilled") {
        const rows = (avgMarksRes.value ?? []).map((r) => ({
          subject: r.subject,
          average: Number(r.average ?? 0),
          students: Number(r.students ?? 0),
        }));
        writes.push(writeCache(db, "average_marks", rows));
      } else {
        failCount++;
        console.error("[refreshAnalyticsCache] average_marks failed:", avgMarksRes.reason?.message);
      }

      /* ── subject_performance ── */
      if (subjectPerfRes.status === "fulfilled") {
        const rows = (subjectPerfRes.value ?? []).map((r) => ({
          subject: r.subject,
          score: Number(r.avg_score_pct ?? 0),
          students: Number(r.unique_students ?? 0),
          passRate: Number(r.pass_rate_pct ?? 0),
        }));
        writes.push(writeCache(db, "subject_performance", rows));
      } else {
        failCount++;
        console.error("[refreshAnalyticsCache] subject_performance failed:", subjectPerfRes.reason?.message);
      }

      await Promise.all(writes);

      const durationMs = Date.now() - start;
      console.info(
          `[refreshAnalyticsCache] Done. ` +
      `${writes.length} cache docs written, ${failCount} queries failed. ` +
      `Duration: ${durationMs}ms`,
      );
    },
);
