/**
 * analytics/analyticsService.js  — Production-grade refactor
 *
 * ─── ARCHITECTURE ────────────────────────────────────────────────────────────
 *
 * This module replaces services/analyticsService.js for event tracking only.
 * Dashboard data aggregation has been moved to analyticsRepository.js.
 *
 * Event tracking responsibilities:
 *   1. Enrich every event with base dimensions (user_id, role, env, version,
 *      session_id, timestamp_ms).
 *   2. Deduplicate events via session.js to prevent React StrictMode double-fires
 *      and route-change re-mounts from inflating counts.
 *   3. Validate params against EVENT_SCHEMAS in development — BigQuery-safety
 *      warnings logged, never thrown to the caller.
 *   4. Fire to Firebase Analytics (GA4) via the async analyticsPromise to
 *      prevent the crash described in firebase.js.
 *   5. Manage session lifecycle — heartbeat, session_start, session cleanup.
 *
 * ─── USAGE GUIDE ─────────────────────────────────────────────────────────────
 *
 *   import { analytics } from '../analytics/analyticsService';
 *
 *   // Auth
 *   analytics.login(userId, role);
 *   analytics.registration(userId, role);
 *   analytics.logout(userId);
 *
 *   // Exam lifecycle
 *   analytics.examCreated(userId, role, examId);
 *   analytics.examStarted(userId, role, examId, examTitle);
 *   analytics.examSubmitted(userId, role, examId, score, totalMarks, percentage, passStatus);
 *
 *   // Results
 *   analytics.resultViewed(userId, role, examId);
 *
 * ─── BACKWARD COMPATIBILITY ──────────────────────────────────────────────────
 *
 * Named function exports (trackLogin, trackExamStarted, etc.) are re-exported
 * from this module with the same signatures as the old analyticsService.js.
 * Existing call sites in authService.js and ExamPage.jsx continue working
 * without modification.
 *
 * ─── ENV VARIABLES USED ──────────────────────────────────────────────────────
 *
 *   REACT_APP_ENV          — 'development' | 'staging' | 'production'
 *                            Falls back to process.env.NODE_ENV if absent.
 *   REACT_APP_VERSION      — Semantic version string e.g. '1.2.3'
 *                            Falls back to '0.0.0' if absent.
 */

import { logEvent, setUserId, setUserProperties } from 'firebase/analytics';
import { analyticsPromise }  from '../firebase';
import {
  EVENTS,
  DIMENSIONS,
  validateEventParams,
}                            from './constants';
import {
  getSessionId,
  isDuplicateEvent,
  startHeartbeat,
  clearSession,
}                            from './session';

// ═══════════════════════════════════════════════════════════════════════════════
// Environment constants — read once at module load
// ═══════════════════════════════════════════════════════════════════════════════

const ENV         = process.env.REACT_APP_ENV     || process.env.NODE_ENV || 'development';
const APP_VERSION = process.env.REACT_APP_VERSION || '0.0.0';
const IS_DEV      = process.env.NODE_ENV === 'development';

// ═══════════════════════════════════════════════════════════════════════════════
// Base dimensions
// Added to every event automatically — call sites never need to supply these.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * buildBaseDimensions
 *
 * Returns the flat, BigQuery-safe base dimensions every event must carry.
 *
 * @param {string} userId   Firebase Auth UID (or 'anonymous' when not signed in)
 * @param {string} userRole 'student' | 'faculty' | 'unknown'
 * @returns {Object}
 */
const buildBaseDimensions = (userId = 'anonymous', userRole = 'unknown') => ({
  [DIMENSIONS.USER_ID]:      String(userId),
  [DIMENSIONS.USER_ROLE]:    String(userRole),
  [DIMENSIONS.ENVIRONMENT]:  ENV,
  [DIMENSIONS.APP_VERSION]:  APP_VERSION,
  [DIMENSIONS.TIMESTAMP_MS]: Date.now(),           // integer — BigQuery TIMESTAMP-safe
  [DIMENSIONS.SESSION_ID]:   getSessionId(),
});

// ═══════════════════════════════════════════════════════════════════════════════
// Core dispatcher
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * fire — internal event dispatcher.
 *
 * Responsibilities:
 *   1. Await analyticsPromise (non-blocking — Promise is already resolving)
 *   2. Guard against null (analytics unavailable in this environment)
 *   3. Validate params in development
 *   4. Call logEvent()
 *   5. Never throw — analytics must never break app flow
 *
 * @param {string} eventName
 * @param {Object} params   Already merged with base dimensions by the caller
 */
const fire = async (eventName, params = {}) => {
  try {
    // Schema validation — dev only, zero prod overhead
    validateEventParams(eventName, params);

    const analyticsInstance = await analyticsPromise;
    if (!analyticsInstance) return; // unavailable — degrade gracefully

    logEvent(analyticsInstance, eventName, params);

    if (IS_DEV) {
      console.debug(`[Analytics] ${eventName}`, params);
    }
  } catch (err) {
    // Swallow all errors — analytics must NEVER break app functionality
    if (IS_DEV) {
      console.error(`[Analytics] Failed to track "${eventName}":`, err);
    }
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// Analytics service object
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * analytics
 *
 * Public API for event tracking. All methods are fire-and-forget:
 * they return void and never throw.
 *
 * Pattern for every method:
 *   1. Build base dimensions (userId, role, env, version, session, timestamp)
 *   2. Check deduplication window — drop silently if duplicate
 *   3. Merge base + event-specific params
 *   4. Call fire()
 */
export const analytics = {

  // ──────────────────────────────────────────────────────────────────────────
  // Session management
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * initSession
   *
   * Call once after a user signs in (from authService.loginUser or
   * registerUser). Sets Firebase Analytics user properties for GA4 audience
   * segmentation and BigQuery attribution, then starts the heartbeat.
   *
   * @param {string} userId
   * @param {string} userRole
   */
  initSession(userId, userRole) {
    analyticsPromise.then((instance) => {
      if (!instance) return;
      try {
        // GA4 user-scoped properties — persist across sessions in GA4 reports
        setUserId(instance, userId);
        setUserProperties(instance, {
          user_role:   String(userRole),
          environment: ENV,
          app_version: APP_VERSION,
        });
      } catch (err) {
        if (IS_DEV) console.error('[Analytics] setUserId/setUserProperties failed:', err);
      }
    });

    // Start session heartbeat — passes fire() as callback to avoid circular import
    startHeartbeat((eventName, params) => fire(eventName, params));

    // Fire session_start (not deduped — every new session should record this)
    fire(EVENTS.SESSION_START, {
      ...buildBaseDimensions(userId, userRole),
    });
  },

  /**
   * endSession
   *
   * Call before firebaseSignOut(). Stops the heartbeat and clears session state
   * so the next login starts a fresh session with a new session_id.
   */
  endSession() {
    clearSession();
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Auth events
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * login
   * GA4 event: user_login
   *
   * @param {string} userId
   * @param {string} userRole  'student' | 'faculty'
   */
  login(userId, userRole) {
    if (isDuplicateEvent(EVENTS.USER_LOGIN, userId)) return;
    fire(EVENTS.USER_LOGIN, {
      ...buildBaseDimensions(userId, userRole),
      [DIMENSIONS.USER_ROLE]: String(userRole ?? 'unknown'),
    });
    this.initSession(userId, userRole);
  },

  /**
   * registration
   * GA4 event: user_registration
   *
   * @param {string} userId
   * @param {string} userRole
   */
  registration(userId, userRole) {
    if (isDuplicateEvent(EVENTS.USER_REGISTRATION, userId)) return;
    fire(EVENTS.USER_REGISTRATION, {
      ...buildBaseDimensions(userId, userRole),
      [DIMENSIONS.USER_ROLE]: String(userRole ?? 'unknown'),
      [DIMENSIONS.METHOD]:    'email',
    });
    this.initSession(userId, userRole);
  },

  /**
   * logout
   * GA4 event: user_logout
   * Must be called BEFORE firebaseSignOut() while the session is active.
   *
   * @param {string} userId
   * @param {string} userRole
   */
  logout(userId, userRole) {
    fire(EVENTS.USER_LOGOUT, {
      ...buildBaseDimensions(userId, userRole),
    });
    this.endSession();
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Exam lifecycle events
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * examCreated
   * GA4 event: exam_created
   *
   * @param {string} userId
   * @param {string} userRole
   * @param {string} examId
   */
  examCreated(userId, userRole, examId) {
    if (isDuplicateEvent(EVENTS.EXAM_CREATED, examId)) return;
    fire(EVENTS.EXAM_CREATED, {
      ...buildBaseDimensions(userId, userRole),
      [DIMENSIONS.EXAM_ID]: String(examId ?? ''),
    });
  },

  /**
   * examStarted
   * GA4 event: exam_started
   *
   * @param {string} userId
   * @param {string} userRole
   * @param {string} examId
   * @param {string} examTitle
   */
  examStarted(userId, userRole, examId, examTitle = '') {
    if (isDuplicateEvent(EVENTS.EXAM_STARTED, examId)) return;
    fire(EVENTS.EXAM_STARTED, {
      ...buildBaseDimensions(userId, userRole),
      [DIMENSIONS.EXAM_ID]:    String(examId    ?? ''),
      [DIMENSIONS.EXAM_TITLE]: String(examTitle ?? ''),
    });
  },

  /**
   * examSubmitted
   * GA4 event: exam_submitted
   *
   * @param {string} userId
   * @param {string} userRole
   * @param {string} examId
   * @param {number} score        Marks obtained
   * @param {number} totalMarks   Total possible marks
   * @param {number} percentage   Computed percentage (0–100)
   * @param {string} passStatus   'pass' | 'fail'
   */
  examSubmitted(userId, userRole, examId, score = 0, totalMarks = 0, percentage = 0, passStatus = 'fail') {
    // Exam submission must NOT be deduped — re-submission after error is valid.
    // We only dedup within DEDUP_WINDOW_MS to catch double-fires from React re-renders.
    if (isDuplicateEvent(EVENTS.EXAM_SUBMITTED, examId)) return;
    fire(EVENTS.EXAM_SUBMITTED, {
      ...buildBaseDimensions(userId, userRole),
      [DIMENSIONS.EXAM_ID]:    String(examId      ?? ''),
      [DIMENSIONS.SCORE]:      Number(score       ?? 0),
      [DIMENSIONS.TOTAL_MARKS]:Number(totalMarks  ?? 0),
      [DIMENSIONS.PERCENTAGE]: Number(percentage  ?? 0),
      [DIMENSIONS.PASS_STATUS]:String(passStatus  ?? 'fail'),
    });
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Result events
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * resultViewed
   * GA4 event: result_viewed
   *
   * @param {string} userId
   * @param {string} userRole
   * @param {string} examId
   */
  resultViewed(userId, userRole, examId) {
    if (isDuplicateEvent(EVENTS.RESULT_VIEWED, examId)) return;
    fire(EVENTS.RESULT_VIEWED, {
      ...buildBaseDimensions(userId, userRole),
      [DIMENSIONS.EXAM_ID]: String(examId ?? ''),
    });
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// Backward-compatible named exports
//
// These maintain the exact same signatures as the old analyticsService.js so
// that existing call sites (authService.js, ExamPage.jsx, ResultPage.jsx) work
// without modification.
//
// Limitation: the old signatures don't pass userId/role, so these shims use
// 'anonymous' / 'unknown' as sentinels. Call sites should be updated to pass
// the userId and role for full BigQuery attribution over time.
// The TODO comments mark exactly where to make those updates.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @deprecated Use analytics.login(userId, role) for full attribution.
 * TODO: Update authService.js loginUser() to pass credential.user.uid
 */
export const trackLogin = (userRole) =>
  analytics.login('anonymous', userRole ?? 'unknown');

/**
 * @deprecated Use analytics.registration(userId, role) for full attribution.
 * TODO: Update authService.js registerUser() to pass credential.user.uid
 */
export const trackRegistration = (userRole) =>
  analytics.registration('anonymous', userRole ?? 'unknown');

/**
 * @deprecated Use analytics.examCreated(userId, role, examId).
 * TODO: Update CreateExamPage to pass currentUser.uid and role
 */
export const trackExamCreated = (examId) =>
  analytics.examCreated('anonymous', 'faculty', examId);

/**
 * @deprecated Use analytics.examStarted(userId, role, examId, examTitle).
 * TODO: Update ExamPage.jsx to pass currentUser.uid and role from useAuth()
 */
export const trackExamStarted = (examId, examTitle) =>
  analytics.examStarted('anonymous', 'student', examId, examTitle);

/**
 * @deprecated Use analytics.examSubmitted(userId, role, examId, score, totalMarks, percentage, passStatus).
 * TODO: Update ExamPage.jsx confirmSubmit() — resultId is available, fetch result from Firestore
 */
export const trackExamSubmitted = (examId, score) =>
  analytics.examSubmitted('anonymous', 'student', examId, score, 0, 0, 'unknown');

/**
 * @deprecated Use analytics.resultViewed(userId, role, examId).
 * TODO: Update ResultPage.jsx to pass currentUser.uid and role
 */
export const trackResultViewed = (examId) =>
  analytics.resultViewed('anonymous', 'unknown', examId);

/**
 * @deprecated Use analytics.logout(userId, role).
 * TODO: Update authService.js logoutUser() to pass currentUser.uid and role
 */
export const trackLogout = () =>
  analytics.logout('anonymous', 'unknown');
