/**
 * services/analyticsService.js
 *
 * ─── MIGRATION SHIM ───────────────────────────────────────────────────────────
 *
 * Event tracking has been moved to analytics/analyticsService.js (production
 * refactor). This file re-exports all named functions from the new location
 * so existing call sites (authService.js, ExamPage.jsx, etc.) work unchanged.
 *
 * Dashboard data aggregation (getDashboardAnalytics) remains here as the
 * Firestore fallback consumed by analyticsRepository.js when BigQuery cache
 * is unavailable.
 *
 * ─── MIGRATION PATH ──────────────────────────────────────────────────────────
 *
 * Update call sites to the new path as you touch each file:
 *
 *   OLD:  import { trackLogin } from '../services/analyticsService';
 *   NEW:  import { analytics }  from '../analytics/analyticsService';
 *         analytics.login(userId, role);
 *
 * Once all call sites are migrated, this shim can be deleted.
 */

// ─── All imports must come first (import/first rule) ─────────────────────────

import { fsGetCollection }  from '../firebase/firestore';
import { getAllExams }       from './examService';
import { COLLECTIONS }      from '../firebase/collections';
import { RESULT_STATUS }    from '../utils/constants';

// ─── Re-export event tracking from the new location ──────────────────────────
// Named exports maintain the exact same API as the old analyticsService.js.

export {
  analytics,
  trackLogin,
  trackRegistration,
  trackExamCreated,
  trackExamStarted,
  trackExamSubmitted,
  trackResultViewed,
  trackLogout,
} from '../analytics/analyticsService';

// ═══════════════════════════════════════════════════════════════════════════════
// Dashboard data aggregation — Firestore fallback
//
// This function is consumed by analyticsRepository.js when the BigQuery cache
// is unavailable (BIGQUERY_ENABLED = false, or cache not yet populated).
// When BIGQUERY_ENABLED = true and the cache is warm, this function is never
// called — analyticsRepository reads from analytics_cache directly.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * getDashboardAnalytics
 *
 * Reads results and exams from Firestore and computes aggregated dashboard
 * metrics used by AnalyticsPage charts.
 *
 * Returns a complete object in all cases — arrays default to [] and numbers
 * to 0 when there is no data, so chart components never need null-guards.
 *
 * @returns {Promise<{
 *   summary:            { totalExams, totalStudents, averageScore, passRate },
 *   passFail:           { pass, fail },
 *   averageMarks:       Array<{ subject, average }>,
 *   topStudents:        Array<{ name, score }>,
 *   examParticipation:  Array<{ examId, exam, participants, completed }>,
 *   subjectPerformance: Array<{ subject, score, students }>,
 *   monthlyTrends:      Array<{ month, exams, students }>,
 * }>}
 */
export const getDashboardAnalytics = async () => {
  const [results, exams] = await Promise.all([
    fsGetCollection(COLLECTIONS.RESULTS),
    getAllExams(),
  ]);

  if (results.length === 0) {
    return _emptyAnalytics(exams.length);
  }

  // ── summary ───────────────────────────────────────────────────────────────
  const uniqueStudents  = new Set(results.map((r) => r.studentId));
  const totalStudents   = uniqueStudents.size;
  const totalPercentage = results.reduce((sum, r) => sum + (r.percentage ?? 0), 0);
  const averageScore    = Math.round(totalPercentage / results.length);
  const passCount       = results.filter((r) => r.status === RESULT_STATUS.PASS).length;
  const failCount       = results.length - passCount;
  const passRate        = Math.round((passCount / results.length) * 100);

  // ── passFail ──────────────────────────────────────────────────────────────
  const passFail = { pass: passCount, fail: failCount };

  // ── averageMarks by subject ───────────────────────────────────────────────
  const subjectBuckets = {};
  for (const r of results) {
    const subj = r.subject || 'Unknown';
    if (!subjectBuckets[subj]) subjectBuckets[subj] = [];
    subjectBuckets[subj].push(r.percentage ?? 0);
  }

  const averageMarks = Object.entries(subjectBuckets).map(([subject, pcts]) => ({
    subject,
    average: Math.round(pcts.reduce((s, p) => s + p, 0) / pcts.length),
  }));

  // ── topStudents — top 5 by average percentage ─────────────────────────────
  const studentBuckets = {};
  for (const r of results) {
    if (!r.studentId) continue;
    if (!studentBuckets[r.studentId]) {
      studentBuckets[r.studentId] = { name: r.studentName || 'Unknown', pcts: [] };
    }
    studentBuckets[r.studentId].pcts.push(r.percentage ?? 0);
  }

  const topStudents = Object.values(studentBuckets)
    .map(({ name, pcts }) => ({
      name,
      score: Math.round(pcts.reduce((s, p) => s + p, 0) / pcts.length),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  // ── examParticipation ─────────────────────────────────────────────────────
  const examParticipationMap = {};
  for (const r of results) {
    if (!r.examId) continue;
    if (!examParticipationMap[r.examId]) {
      examParticipationMap[r.examId] = {
        examId:       r.examId,
        exam:         (r.examTitle || r.examId).substring(0, 20),
        participants: 0,
        completed:    0,
      };
    }
    examParticipationMap[r.examId].participants += 1;
    examParticipationMap[r.examId].completed    += 1;
  }

  const examParticipation = Object.values(examParticipationMap)
    .sort((a, b) => b.participants - a.participants)
    .slice(0, 8);

  // ── subjectPerformance ────────────────────────────────────────────────────
  const subjectPerformance = Object.entries(subjectBuckets).map(([subject, pcts]) => ({
    subject,
    score:    Math.round(pcts.reduce((s, p) => s + p, 0) / pcts.length),
    students: pcts.length,
  }));

  // ── monthlyTrends ─────────────────────────────────────────────────────────
  const monthlyMap = {};
  for (const r of results) {
    const raw = r.evaluatedAt ?? r.submittedAt ?? null;
    if (!raw) continue;
    const date = raw?.toDate ? raw.toDate() : new Date(raw);
    if (isNaN(date.getTime())) continue;
    const label = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    if (!monthlyMap[label]) {
      monthlyMap[label] = { month: label, exams: 0, studentSet: new Set() };
    }
    monthlyMap[label].exams += 1;
    monthlyMap[label].studentSet.add(r.studentId);
  }

  const monthlyTrends = Object.values(monthlyMap)
    .sort((a, b) => new Date(a.month) - new Date(b.month))
    .map(({ month, exams, studentSet }) => ({
      month,
      exams,
      students: studentSet.size,
    }));

  return {
    summary: { totalExams: exams.length, totalStudents, averageScore, passRate },
    passFail,
    averageMarks,
    topStudents,
    examParticipation,
    subjectPerformance,
    monthlyTrends,
  };
};

// ─── Empty-state shape ────────────────────────────────────────────────────────

const _emptyAnalytics = (totalExams = 0) => ({
  summary:            { totalExams, totalStudents: 0, averageScore: 0, passRate: 0 },
  passFail:           { pass: 0, fail: 0 },
  averageMarks:       [],
  topStudents:        [],
  examParticipation:  [],
  subjectPerformance: [],
  monthlyTrends:      [],
});
