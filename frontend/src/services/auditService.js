/**
 * services/auditService.js
 *
 * Centralised audit logging service.
 *
 * ─── WHAT THIS IS ────────────────────────────────────────────────────────────
 *
 * Every meaningful user action (login, exam start, submission, etc.) writes a
 * tamper-evident record to the `auditLogs` Firestore collection. Audit logs
 * are append-only — nothing in the frontend ever reads or modifies them.
 *
 * ─── DOCUMENT SCHEMA ─────────────────────────────────────────────────────────
 *
 *   auditLogs/{auto-id}:
 *   {
 *     action:     string,           — one of AUDIT_ACTIONS.*
 *     userId:     string,           — Firebase Auth UID ('anonymous' if unknown)
 *     userRole:   string,           — 'student' | 'faculty' | 'unknown'
 *     targetId:   string | null,    — Firestore ID of the subject (examId, resultId…)
 *     targetType: string | null,    — 'exam' | 'result' | 'user' | null
 *     metadata:   object,           — flat, BigQuery-safe key/value pairs
 *     timestamp:  Timestamp,        — Firestore server timestamp (authoritative)
 *   }
 *
 * ─── DESIGN DECISIONS ────────────────────────────────────────────────────────
 *
 * 1. Fire-and-forget:
 *    logAuditEvent() never throws. It returns void and all errors are caught
 *    internally. A logging failure must never block a user-facing action.
 *
 * 2. Deduplication:
 *    A per-tab in-memory Set tracks keys of the form `action::targetId::userId`.
 *    Entries are kept for DEDUP_WINDOW_MS (3 s) to absorb React StrictMode
 *    double-invocations and useEffect re-runs without creating duplicate records.
 *    This is the same pattern used in analytics/session.js.
 *
 * 3. Metadata is always a plain object:
 *    Callers may pass any flat object. Non-primitive values (objects, arrays)
 *    are stripped before writing — Firestore accepts them but BigQuery export
 *    drops nested structures silently. We convert known complex values to
 *    strings rather than lose the data.
 *
 * 4. Timestamps are always server-side:
 *    The `timestamp` field uses Firestore serverTimestamp() — it is set by the
 *    Firestore server, not the client clock. This prevents clock-skew and makes
 *    the logs trustworthy for compliance purposes.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────
 *
 *   import { logAuditEvent }  from '../services/auditService';
 *   import { AUDIT_ACTIONS }  from '../utils/auditActions';
 *
 *   // Fire-and-forget — do NOT await
 *   logAuditEvent({
 *     action:     AUDIT_ACTIONS.EXAM_STARTED,
 *     userId:     currentUser.uid,
 *     userRole:   role,
 *     targetId:   exam.id,
 *     targetType: 'exam',
 *     metadata:   { examTitle: exam.title, subject: exam.subject },
 *   });
 *
 * ─── COLLECTION SECURITY RULES ───────────────────────────────────────────────
 *
 * Add this to firestore.rules to allow authenticated writes but no reads from
 * the client (audit logs should only be read via the Firebase Admin SDK or BQ):
 *
 *   match /auditLogs/{docId} {
 *     allow create: if request.auth != null;
 *     allow read, update, delete: if false;
 *   }
 */

import { collection, addDoc } from 'firebase/firestore';
import { serverTimestamp, db }  from '../firebase/firestore';

// ─── Collection name ──────────────────────────────────────────────────────────
const AUDIT_COLLECTION = 'auditLogs';

// ─── Deduplication ────────────────────────────────────────────────────────────
// Prevents duplicate records from React StrictMode double-invocations and
// useEffect re-runs. Same 3-second window used by analytics/session.js.
const DEDUP_WINDOW_MS = 3000;
const _dedupMap = new Map(); // Map<dedupKey, lastWrittenTimestamp>

const _isDuplicate = (action, userId, targetId) => {
  const key  = `${action}::${userId}::${String(targetId ?? '')}`;
  const now  = Date.now();
  const last = _dedupMap.get(key) ?? 0;

  if (now - last < DEDUP_WINDOW_MS) return true;

  _dedupMap.set(key, now);
  return false;
};

// ─── Metadata sanitiser ───────────────────────────────────────────────────────

/**
 * _sanitiseMetadata
 *
 * Strips non-primitive values from a metadata object before writing to
 * Firestore. BigQuery GA4 export silently drops nested objects/arrays so
 * we convert known complex types to strings rather than lose the data.
 *
 * Allowed through as-is: string, number, boolean.
 * Converted to string:   Date objects.
 * Stripped entirely:     plain objects, arrays, null, undefined.
 *
 * @param {Object} meta
 * @returns {Object}
 */
const _sanitiseMetadata = (meta = {}) => {
  const safe = {};
  for (const [key, value] of Object.entries(meta)) {
    if (value === null || value === undefined) continue;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      safe[key] = value;
    } else if (value instanceof Date) {
      safe[key] = value.toISOString();
    } else if (typeof value === 'object') {
      // Flatten one level: { examData: { title: 'X' } } → not useful, skip
      // Callers should extract primitives before passing metadata.
      if (process.env.NODE_ENV === 'development') {
        console.warn(
          `[AuditService] metadata key "${key}" is a non-primitive and will be stripped. ` +
          'Extract primitive values before calling logAuditEvent().'
        );
      }
    }
  }
  return safe;
};

// ═══════════════════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * logAuditEvent
 *
 * Writes an audit record to the `auditLogs` Firestore collection.
 * Always fire-and-forget — never await this call.
 * Never throws — all errors are caught internally.
 *
 * @param {{
 *   action:      string,         — required: one of AUDIT_ACTIONS.*
 *   userId:      string,         — required: Firebase Auth UID
 *   userRole:    string,         — required: 'student' | 'faculty' | 'unknown'
 *   targetId:    string | null,  — optional: Firestore doc ID of the subject
 *   targetType:  string | null,  — optional: 'exam' | 'result' | 'user'
 *   metadata:    Object,         — optional: flat key/value context
 * }} params
 * @returns {void}  — fire-and-forget, no return value
 */
export const logAuditEvent = ({
  action,
  userId     = 'anonymous',
  userRole   = 'unknown',
  targetId   = null,
  targetType = null,
  metadata   = {},
}) => {
  // Dedup check — synchronous, returns before any async work
  if (_isDuplicate(action, userId, targetId)) return;

  // Write is async but we intentionally do not await — fire-and-forget
  (async () => {
    try {
      await addDoc(collection(db, AUDIT_COLLECTION), {
        action:     String(action),
        userId:     String(userId),
        userRole:   String(userRole),
        targetId:   targetId   != null ? String(targetId)   : null,
        targetType: targetType != null ? String(targetType) : null,
        metadata:   _sanitiseMetadata(metadata),
        timestamp:  serverTimestamp(),
      });
    } catch (err) {
      // Never propagate — audit failure must not disrupt user flow
      if (process.env.NODE_ENV === 'development') {
        console.error('[AuditService] Failed to write audit log:', err);
      }
    }
  })();
};
