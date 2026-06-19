/**
 * utils/auditActions.js
 *
 * Centralised audit action constants.
 *
 * Every call to logAuditEvent() must use one of these constants as the `action`
 * value — never a raw string. This guarantees:
 *   1. Consistent spelling across the codebase (no 'user_login' vs 'userLogin' drift)
 *   2. Refactoring safety — rename here and the compiler catches every usage
 *   3. Queryability — Firestore queries on the `action` field work reliably
 *
 * Naming convention: NOUN_VERB in SCREAMING_SNAKE_CASE.
 * The stored string value uses the same snake_case for BigQuery / Firestore query
 * compatibility.
 */

export const AUDIT_ACTIONS = Object.freeze({
  // ── Auth lifecycle ──────────────────────────────────────────────────────────
  USER_REGISTERED: 'user_registered',
  USER_LOGIN:      'user_login',
  USER_LOGOUT:     'user_logout',

  // ── Exam lifecycle ──────────────────────────────────────────────────────────
  EXAM_CREATED:    'exam_created',
  EXAM_UPDATED:    'exam_updated',
  EXAM_DELETED:    'exam_deleted',
  EXAM_STARTED:    'exam_started',
  EXAM_SUBMITTED:  'exam_submitted',

  // ── Result lifecycle ────────────────────────────────────────────────────────
  RESULT_VIEWED:   'result_viewed',
});
