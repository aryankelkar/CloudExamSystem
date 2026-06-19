/**
 * bigqueryAnalytics.js
 *
 * Cloud Function Gen 2 — HTTPS Callable
 * Exposes BigQuery analytics to the frontend via Firebase callable functions.
 *
 * Functions exported:
 *   getFacultyAnalytics  — faculty dashboard summary + chart data from BQ
 *   getStudentAnalytics  — per-student performance analytics from BQ
 *
 * Security:
 *   Both functions require Firebase Auth.
 *   getFacultyAnalytics  — requires role === 'faculty' (verified via custom claim)
 *   getStudentAnalytics  — requires auth; students can only query their own data
 *
 * Frontend usage:
 *   import { getFunctions, httpsCallable } from 'firebase/functions';
 *   const functions = getFunctions(app, 'asia-south1');
 *   const getAnalytics = httpsCallable(functions, 'getFacultyAnalytics');
 *   const { data } = await getAnalytics({ dayRange: 90 });
 */

"use strict";

const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {logger} = require("firebase-functions");
const {runQuery} = require("./bigquery/client");
const {
  FACULTY_DASHBOARD,
  STUDENT_ANALYTICS,
  STUDENT_IMPROVEMENT,
  SUBJECT_PERFORMANCE,
  EXAM_PARTICIPATION,
  TOP_STUDENTS,
  MONTHLY_TRENDS,
  DIFFICULT_EXAMS,
  EXAM_ATTEMPT_COUNTS,
} = require("./bigquery/queries");

const REGION = "asia-south1";

/* ─── Auth helpers ─────────────────────────────────────────────────────────── */

const requireAuth = (auth) => {
  if (!auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }
};

const requireFaculty = (auth) => {
  requireAuth(auth);
  const role = auth.token?.role;
  if (role !== "faculty") {
    throw new HttpsError("permission-denied", "Faculty access required.");
  }
};

/* ─── getFacultyAnalytics ──────────────────────────────────────────────────── */

/**
 * Returns comprehensive analytics data for the faculty dashboard.
 *
 * Input:  { dayRange?: number }  defaults to 90 days
 * Output: {
 *   summary:            { totalExams, totalSubmissions, totalStudents, averageScore, passRate, topSubject, hardestExam },
 *   subjectPerformance: Array<{ subject, avg_score_pct, pass_rate_pct, total_submissions, ... }>,
 *   examParticipation:  Array<{ examId, examTitle, participants, avg_score, ... }>,
 *   topStudents:        Array<{ studentId, studentName, avg_score_pct, ... }>,
 *   monthlyTrends:      Array<{ month, total_submissions, avg_score_pct, ... }>,
 *   difficultExams:     Array<{ examId, examTitle, avg_score_pct, pass_rate_pct, ... }>,
 *   examAttempts:       Array<{ examId, examTitle, total_submissions, ... }>,
 * }
 */
exports.getFacultyAnalytics = onCall(
    {region: REGION, timeoutSeconds: 120, memory: "256MiB"},
    async ({data, auth}) => {
      requireFaculty(auth);

      const dayRange = Math.min(Number(data?.dayRange ?? 90), 365);
      const topN = Math.min(Number(data?.topN ?? 10), 50);
      const minSubmissions = Math.max(Number(data?.minSubmissions ?? 2), 1);

      logger.info("[getFacultyAnalytics] Querying BigQuery", {
        uid: auth.uid, dayRange, topN,
      });

      try {
      /* Run all queries in parallel — BigQuery handles concurrency well */
        const [
          summaryRows,
          subjectRows,
          participationRows,
          topStudentRows,
          trendRows,
          difficultRows,
          attemptRows,
        ] = await Promise.all([
          runQuery(FACULTY_DASHBOARD, {dayRange}),
          runQuery(SUBJECT_PERFORMANCE, {dayRange}),
          runQuery(EXAM_PARTICIPATION, {dayRange}),
          runQuery(TOP_STUDENTS, {dayRange, topN}),
          runQuery(MONTHLY_TRENDS, {dayRange}),
          runQuery(DIFFICULT_EXAMS, {dayRange, topN, minSubmissions}),
          runQuery(EXAM_ATTEMPT_COUNTS, {dayRange}),
        ]);

        const summary = summaryRows[0] ?? {};

        logger.info("[getFacultyAnalytics] Queries complete", {
          subjectCount: subjectRows.length,
          examCount: participationRows.length,
          topStudentCount: topStudentRows.length,
          monthCount: trendRows.length,
        });

        return {
          summary: {
            totalExams: Number(summary.total_exams ?? 0),
            totalSubmissions: Number(summary.total_submissions ?? 0),
            totalStudents: Number(summary.total_students ?? 0),
            averageScore: Number(summary.average_score ?? 0),
            passRate: Number(summary.pass_rate ?? 0),
            topSubject: summary.top_subject ?? null,
            hardestExam: summary.hardest_exam ?? null,
          },
          subjectPerformance: subjectRows.map((r) => ({
            subject: r.subject,
            avgScore: Number(r.avg_score_pct ?? 0),
            passRate: Number(r.pass_rate_pct ?? 0),
            totalSubmissions: Number(r.total_submissions ?? 0),
            uniqueStudents: Number(r.unique_students ?? 0),
            uniqueExams: Number(r.unique_exams ?? 0),
          })),
          examParticipation: participationRows.map((r) => ({
            examId: r.examId,
            examTitle: r.examTitle,
            participants: Number(r.participants ?? 0),
            completed: Number(r.completed_pass ?? 0) + Number(r.completed_fail ?? 0),
            avgScore: Number(r.avg_score ?? 0),
            passRate: Number(r.pass_rate ?? 0),
          })),
          topStudents: topStudentRows.map((r) => ({
            studentId: r.studentId,
            name: r.studentName,
            score: Number(r.avg_score_pct ?? 0),
            examsTaken: Number(r.total_exams_taken ?? 0),
            passRate: Number(r.pass_rate_pct ?? 0),
          })),
          monthlyTrends: trendRows.map((r) => ({
            month: r.month,
            exams: Number(r.total_submissions ?? 0),
            students: Number(r.unique_students ?? 0),
            avgScore: Number(r.avg_score_pct ?? 0),
            passRate: Number(r.pass_rate_pct ?? 0),
          })),
          difficultExams: difficultRows.map((r) => ({
            examId: r.examId,
            examTitle: r.examTitle,
            subject: r.subject,
            avgScore: Number(r.avg_score_pct ?? 0),
            passRate: Number(r.pass_rate_pct ?? 0),
            submissions: Number(r.total_submissions ?? 0),
          })),
          examAttempts: attemptRows.map((r) => ({
            examId: r.examId,
            examTitle: r.examTitle,
            totalSubmissions: Number(r.total_submissions ?? 0),
            uniqueStudents: Number(r.unique_students ?? 0),
            avgAttemptsPerStudent: Number(r.avg_attempts_per_student ?? 0),
          })),
        };
      } catch (err) {
        logger.error("[getFacultyAnalytics] BigQuery error", {
          uid: auth.uid,
          message: err.message,
          stack: err.stack,
        });
        throw new HttpsError("internal", `Analytics query failed: ${err.message}`);
      }
    },
);

/* ─── getStudentAnalytics ──────────────────────────────────────────────────── */

/**
 * Returns per-student analytics.
 * Students can only query their own data.
 * Faculty can query any student by passing { studentId }.
 *
 * Input:  { studentId?: string, dayRange?: number }
 * Output: {
 *   totalAttempts:    number,
 *   averageScore:     number,
 *   passRate:         number,
 *   bestSubject:      string | null,
 *   weakestSubject:   string | null,
 *   uniqueExams:      number,
 *   improvementTrend: Array<{ examId, examTitle, attemptNumber, percentage, status, submittedAt }>,
 * }
 */
exports.getStudentAnalytics = onCall(
    {region: REGION, timeoutSeconds: 120, memory: "256MiB"},
    async ({data, auth}) => {
      requireAuth(auth);

      const role = auth.token?.role;
      const dayRange = Math.min(Number(data?.dayRange ?? 90), 365);

      /* Students query themselves; faculty may query any studentId */
      let studentId;
      if (role === "faculty") {
        studentId = data?.studentId;
        if (!studentId) {
          throw new HttpsError("invalid-argument", "studentId is required for faculty queries.");
        }
      } else {
      /* Students always get their own data — ignore any passed studentId */
        studentId = auth.uid;
      }

      logger.info("[getStudentAnalytics] Querying BigQuery", {
        requesterUid: auth.uid, studentId, dayRange,
      });

      try {
        const [summaryRows, trendRows] = await Promise.all([
          runQuery(STUDENT_ANALYTICS, {studentId, dayRange}),
          runQuery(STUDENT_IMPROVEMENT, {studentId, dayRange}),
        ]);

        const summary = summaryRows[0] ?? {};

        const toISO = (bqTs) => {
          if (!bqTs) return null;
          if (bqTs?.value) return bqTs.value;
          return String(bqTs);
        };

        return {
          totalAttempts: Number(summary.total_attempts ?? 0),
          averageScore: Number(summary.average_score ?? 0),
          passRate: Number(summary.pass_rate ?? 0),
          uniqueExams: Number(summary.unique_exams_attempted ?? 0),
          bestSubject: summary.best_subject ?? null,
          weakestSubject: summary.weakest_subject ?? null,
          improvementTrend: trendRows.map((r) => ({
            examId: r.examId,
            examTitle: r.examTitle,
            subject: r.subject,
            attemptNumber: Number(r.attemptNumber ?? 1),
            percentage: Number(r.percentage ?? 0),
            status: r.status,
            submittedAt: toISO(r.submittedAt),
          })),
        };
      } catch (err) {
        logger.error("[getStudentAnalytics] BigQuery error", {
          studentId,
          message: err.message,
          stack: err.stack,
        });
        throw new HttpsError("internal", `Student analytics query failed: ${err.message}`);
      }
    },
);
