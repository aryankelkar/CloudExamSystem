/**
 * index.js — Cloud Functions entry point
 *
 * All functions use Firebase Functions Gen 2.
 *
 * Functions exported:
 *   evaluateExam            — Firestore trigger: grades exam on submission
 *   setUserRoleClaim        — Firestore trigger: sets Auth custom claim on user creation
 *   deleteExamCascade       — Firestore trigger: cleans up questions when exam deleted
 *   updateExamStatus        — HTTPS onRequest: transitions exam statuses by time
 *   refreshAnalyticsCache   — Scheduled: refreshes BQ → Firestore analytics cache
 *   syncResultToBigQuery    — Firestore trigger: streams results → BQ exam_results
 *   syncAuditLogToBigQuery  — Firestore trigger: streams audit logs → BQ exam_events
 *   getFacultyAnalytics     — HTTPS Callable: faculty dashboard from BigQuery
 *   getStudentAnalytics     — HTTPS Callable: student performance from BigQuery
 */

const {initializeApp} = require("firebase-admin/app");

// Initialise Firebase Admin SDK once for all functions.
initializeApp();

// ─── Function exports ─────────────────────────────────────────────────────────

const {evaluateExam} = require("./src/evaluateExam");
const {setUserRoleClaim} = require("./src/setUserRoleClaim");
const {deleteExamCascade} = require("./src/deleteExamCascade");
const {updateExamStatus} = require("./src/updateExamStatus");
const {refreshAnalyticsCache} = require("./src/refreshAnalyticsCache");
const {syncResultToBigQuery} = require("./src/syncResultToBigQuery");
const {syncAuditLogToBigQuery} = require("./src/syncAuditLogToBigQuery");
const {getFacultyAnalytics, getStudentAnalytics} = require("./src/bigqueryAnalytics");

module.exports = {
  evaluateExam,
  setUserRoleClaim,
  deleteExamCascade,
  updateExamStatus,
  refreshAnalyticsCache,
  syncResultToBigQuery,
  syncAuditLogToBigQuery,
  getFacultyAnalytics,
  getStudentAnalytics,
};
