/**
 * analytics/constants.js
 *
 * Single source of truth for:
 *   - Event names      (EVENTS)
 *   - Parameter keys   (DIMENSIONS)
 *   - Schema shapes    (EVENT_SCHEMAS)
 *   - Validator        (validateEventParams)
 *
 * ─── BIGQUERY COMPATIBILITY RULES ────────────────────────────────────────────
 * All parameter values must be primitive types only:
 *   string | number | boolean
 *
 * Never pass: objects, arrays, null, undefined, Dates, Timestamps.
 * BigQuery silently drops non-primitive parameters — you won't get an error,
 * you'll just lose data. The validator below enforces this at runtime in dev.
 *
 * GA4 limits:
 *   Event name   : max 40 characters, snake_case
 *   Param key    : max 40 characters
 *   Param value  : max 100 characters (strings), any (numbers)
 *   Params/event : max 25
 */

// ═══════════════════════════════════════════════════════════════════════════════
// EVENT NAMES
// ═══════════════════════════════════════════════════════════════════════════════

export const EVENTS = Object.freeze({
  // Auth lifecycle
  USER_LOGIN:        'user_login',
  USER_LOGOUT:       'user_logout',
  USER_REGISTRATION: 'user_registration',

  // Exam lifecycle
  EXAM_CREATED:      'exam_created',
  EXAM_STARTED:      'exam_started',
  EXAM_SUBMITTED:    'exam_submitted',

  // Result lifecycle
  RESULT_VIEWED:     'result_viewed',

  // Session (internal — not sent to GA4 directly)
  SESSION_START:     'session_start',
  SESSION_HEARTBEAT: 'session_heartbeat',
});

// ═══════════════════════════════════════════════════════════════════════════════
// DIMENSION (PARAMETER) KEYS
// All GA4 param keys are snake_case, max 40 chars.
// ═══════════════════════════════════════════════════════════════════════════════

export const DIMENSIONS = Object.freeze({
  // Always-present base dimensions
  USER_ID:       'user_id',
  USER_ROLE:     'user_role',
  ENVIRONMENT:   'environment',
  APP_VERSION:   'app_version',
  TIMESTAMP_MS:  'timestamp_ms',
  SESSION_ID:    'session_id',

  // Event-specific dimensions
  EXAM_ID:       'exam_id',
  EXAM_TITLE:    'exam_title',
  EXAM_SUBJECT:  'exam_subject',
  SCORE:         'score',
  TOTAL_MARKS:   'total_marks',
  PERCENTAGE:    'percentage',
  PASS_STATUS:   'pass_status',  // 'pass' | 'fail'
  METHOD:        'method',       // e.g. 'email'
  DURATION_SECS: 'duration_secs',
});

// ═══════════════════════════════════════════════════════════════════════════════
// EVENT SCHEMAS
// Defines required dimensions per event — used by validateEventParams().
// Base dimensions (user_id, user_role, etc.) are added automatically in the
// fire() wrapper and are NOT listed here.
// ═══════════════════════════════════════════════════════════════════════════════

export const EVENT_SCHEMAS = Object.freeze({
  [EVENTS.USER_LOGIN]:        [DIMENSIONS.USER_ROLE],
  [EVENTS.USER_LOGOUT]:       [],
  [EVENTS.USER_REGISTRATION]: [DIMENSIONS.USER_ROLE, DIMENSIONS.METHOD],
  [EVENTS.EXAM_CREATED]:      [DIMENSIONS.EXAM_ID],
  [EVENTS.EXAM_STARTED]:      [DIMENSIONS.EXAM_ID, DIMENSIONS.EXAM_TITLE],
  [EVENTS.EXAM_SUBMITTED]:    [DIMENSIONS.EXAM_ID, DIMENSIONS.SCORE],
  [EVENTS.RESULT_VIEWED]:     [DIMENSIONS.EXAM_ID],
});

// ═══════════════════════════════════════════════════════════════════════════════
// SCHEMA VALIDATOR
// Only active in development — zero production overhead.
// ═══════════════════════════════════════════════════════════════════════════════

const isDev = process.env.NODE_ENV === 'development';

/**
 * validateEventParams
 *
 * Checks that:
 *   1. All required dimensions for this event are present.
 *   2. Every value is a primitive (string | number | boolean).
 *   3. No value is null or undefined.
 *
 * Logs a warning in development — never throws, never blocks.
 *
 * @param {string} eventName
 * @param {Object} params
 * @returns {boolean} true = valid, false = schema violation found
 */
export const validateEventParams = (eventName, params) => {
  if (!isDev) return true;

  const requiredKeys = EVENT_SCHEMAS[eventName];
  if (requiredKeys === undefined) {
    console.warn(`[Analytics] Unknown event name: "${eventName}"`);
    return false;
  }

  let valid = true;

  // Check required keys are present
  for (const key of requiredKeys) {
    if (!(key in params)) {
      console.warn(`[Analytics] Event "${eventName}" is missing required param: "${key}"`);
      valid = false;
    }
  }

  // Check all values are BigQuery-safe primitives
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined) {
      console.warn(
        `[Analytics] Event "${eventName}" param "${key}" is null/undefined. ` +
        'BigQuery will drop this field. Use a sentinel string like "unknown" instead.'
      );
      valid = false;
    } else if (typeof value === 'object') {
      console.warn(
        `[Analytics] Event "${eventName}" param "${key}" is a non-primitive (${typeof value}). ` +
        'BigQuery will drop this field. Serialize to string or extract primitive fields.'
      );
      valid = false;
    }
  }

  return valid;
};
