/**
 * analytics/session.js
 *
 * Lightweight client-side session manager for analytics.
 *
 * ─── WHAT THIS SOLVES ────────────────────────────────────────────────────────
 *
 * GA4's built-in session tracking can be unreliable in SPAs:
 *  - Page navigations don't trigger a new pageview unless you send one manually
 *  - Tab-switching and background/foreground transitions confuse session timing
 *  - Firebase Analytics session_id is not directly accessible for joining in BQ
 *
 * This module provides:
 *   1. A stable session_id (UUID) stored in sessionStorage.
 *      sessionStorage is tab-scoped — each new tab = new session, same as GA4.
 *
 *   2. Session start tracking — fires once per session on first interaction.
 *
 *   3. Heartbeat tracking — fires every HEARTBEAT_INTERVAL_MS while the tab is
 *      active. This lets BigQuery compute session duration reliably by looking
 *      at the gap between the last heartbeat and the next event.
 *
 *   4. Duplicate event deduplication — a per-tab Map tracks the last timestamp
 *      of each event. Events fired more than once within DEDUP_WINDOW_MS are
 *      silently dropped. This prevents double-fires from React StrictMode
 *      double-invocation, hot-reload re-mounts, and routing edge cases.
 *
 * ─── STORAGE KEYS ────────────────────────────────────────────────────────────
 *
 * sessionStorage.exam_analytics_session_id  — UUID string, cleared on tab close
 * sessionStorage.exam_analytics_session_ts  — ISO timestamp of session start
 *
 * ─── THREAD SAFETY ───────────────────────────────────────────────────────────
 *
 * JavaScript is single-threaded. The module-level variables are process-global
 * for the browser tab and are safe to read/write without locks.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════════════════════

/** How often to send a session heartbeat while the tab is active. */
const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Minimum gap between identical events to be considered distinct.
 * Events fired more than once within this window (same event name + same examId)
 * are deduplicated. Prevents React StrictMode double-fires and route-change
 * double-tracks (e.g. exam_started firing twice when ExamPage mounts twice).
 */
const DEDUP_WINDOW_MS = 3000; // 3 seconds

const SESSION_ID_KEY = 'exam_analytics_session_id';
const SESSION_TS_KEY = 'exam_analytics_session_ts';

// ═══════════════════════════════════════════════════════════════════════════════
// Module-level state
// ═══════════════════════════════════════════════════════════════════════════════

/** Map<dedupKey, lastFiredTimestamp> — lives for the tab lifetime only. */
const _dedupMap = new Map();

/** Heartbeat interval handle — stored so it can be cleared on logout. */
let _heartbeatHandle = null;

// ═══════════════════════════════════════════════════════════════════════════════
// UUID generator
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate a RFC 4122 v4 UUID.
 * Uses crypto.randomUUID() when available (all modern browsers),
 * falls back to Math.random() concatenation for old environments.
 *
 * @returns {string}
 */
const generateUUID = () => {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

// ═══════════════════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * getSessionId
 *
 * Returns the current tab's session ID.
 * Creates and persists a new UUID if one doesn't exist yet.
 *
 * @returns {string} UUID
 */
export const getSessionId = () => {
  try {
    let id = sessionStorage.getItem(SESSION_ID_KEY);
    if (!id) {
      id = generateUUID();
      sessionStorage.setItem(SESSION_ID_KEY, id);
      sessionStorage.setItem(SESSION_TS_KEY, new Date().toISOString());
    }
    return id;
  } catch {
    // sessionStorage blocked (private mode, browser extension, etc.)
    // Return a runtime-only UUID — not persisted, but consistent for this call
    return generateUUID();
  }
};

/**
 * isDuplicateEvent
 *
 * Returns true if the same event + dedup key combination was fired within
 * DEDUP_WINDOW_MS. Records the current timestamp for future dedup checks.
 *
 * @param {string} eventName
 * @param {string} dedupKey   e.g. examId for exam events, userId for auth events
 * @returns {boolean}
 */
export const isDuplicateEvent = (eventName, dedupKey = '') => {
  const key       = `${eventName}::${dedupKey}`;
  const now       = Date.now();
  const lastFired = _dedupMap.get(key) ?? 0;

  if (now - lastFired < DEDUP_WINDOW_MS) {
    return true; // duplicate
  }

  _dedupMap.set(key, now);
  return false;
};

/**
 * startHeartbeat
 *
 * Starts the periodic session heartbeat.
 * The heartbeat fires an event every HEARTBEAT_INTERVAL_MS while the tab
 * is visible. Uses the Page Visibility API to pause heartbeats when the
 * tab is backgrounded (avoids inflating DAU counts).
 *
 * The `fireFn` callback is provided by analyticsService.js to avoid a
 * circular import (session.js → analyticsService.js → session.js).
 *
 * Safe to call multiple times — only one interval runs at a time.
 *
 * @param {(eventName: string, params: object) => void} fireFn
 */
export const startHeartbeat = (fireFn) => {
  if (_heartbeatHandle !== null) return; // already running

  _heartbeatHandle = setInterval(() => {
    // Pause heartbeats when tab is not visible
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      return;
    }
    fireFn('session_heartbeat', { session_id: getSessionId() });
  }, HEARTBEAT_INTERVAL_MS);
};

/**
 * stopHeartbeat
 *
 * Stops the session heartbeat. Call on logout.
 */
export const stopHeartbeat = () => {
  if (_heartbeatHandle !== null) {
    clearInterval(_heartbeatHandle);
    _heartbeatHandle = null;
  }
};

/**
 * clearSession
 *
 * Removes session data from sessionStorage and clears the dedup map.
 * Call on logout to ensure the next login starts a fresh session.
 */
export const clearSession = () => {
  try {
    sessionStorage.removeItem(SESSION_ID_KEY);
    sessionStorage.removeItem(SESSION_TS_KEY);
  } catch {
    // sessionStorage may be blocked — ignore
  }
  _dedupMap.clear();
  stopHeartbeat();
};
