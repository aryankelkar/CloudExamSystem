// Result Service — Firestore
//
// ─── CLOUD ARCHITECTURE NOTE ──────────────────────────────────────────────────
//
// NEW FLOW (cloud-native, secure):
//
//   ExamPage calls submitPendingResult()
//     ↓ writes to results_pending/{auto-id}
//     ↓ starts a Firestore listener on that pending document
//     ↓ evaluateExam Cloud Function triggers on results_pending creation
//     ↓ Cloud Function evaluates server-side (correctAnswer never exposed)
//     ↓ Cloud Function writes to results/{auto-id}
//     ↓ Cloud Function DELETES results_pending/{submissionId}
//     ↓ Firestore listener fires with type === 'removed'
//     ↓ ExamPage queries results where studentId == uid && examId == examId
//     ↓ Navigates to /result/:id
//
// OLD FLOW (client-side, insecure — kept as dead code, do not use):
//   submitResult() — evaluates answers in the browser using correctAnswer
//   from the Firestore questions sub-collection, which students can inspect.

import {
  doc,
  collection,
  addDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import {
  fsGetDoc,
  fsGetCollection,
  fsQueryWhere,
  fsQueryWhereOrderBy,
  db,
} from '../firebase/firestore';
import { COLLECTIONS } from '../firebase/collections';
import { computeStudentStats } from '../utils/resultUtils';

// ─── Cloud Submit (new secure flow) ──────────────────────────────────────────

/**
 * submitPendingResult
 *
 * Writes the student's answers to results_pending.
 * Returns a Promise that resolves with { resultId } once the Cloud Function
 * has evaluated the exam (signalled by the deletion of the pending document
 * and the appearance of the result in the results collection).
 *
 * @param {{
 *   examId: string,
 *   studentId: string,
 *   studentName: string,
 *   examTitle: string,
 *   subject: string,
 *   answers: Object
 * }} data
 * @param {{ onStatusChange?: (status: string) => void }} options
 * @returns {Promise<{ resultId: string }>}
 * @throws {Error} if evaluation times out or fails
 */
export const submitPendingResult = (data, options = {}) => {
  const { onStatusChange } = options;
  const TIMEOUT_MS = 60_000; // 60 seconds max wait for Cloud Function

  return new Promise(async (resolve, reject) => {
    let pendingDocId       = null;
    let unsubscribePending = null;
    let timeoutHandle      = null;
    let settled            = false;

    const settle = (fn) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutHandle);
      if (unsubscribePending) unsubscribePending();
      fn();
    };

    try {
      onStatusChange?.('submitting');

      // ── Step 1: Write to results_pending ──────────────────────────────
      const pendingRef = await addDoc(
        collection(db, COLLECTIONS.RESULTS_PENDING),
        {
          studentId:     data.studentId,
          examId:        data.examId,
          answers:       data.answers,
          studentName:   data.studentName   || 'Student',
          examTitle:     data.examTitle     || '',
          subject:       data.subject       || '',
          attemptNumber: data.attemptNumber ?? 1,
          submittedAt:   serverTimestamp(),
        }
      );

      pendingDocId = pendingRef.id;
      onStatusChange?.('evaluating');

      // ── Step 2: Listen for the pending document to be DELETED ──────────
      // The evaluateExam Cloud Function deletes the pending document AFTER
      // writing the result.  Deletion = evaluation complete.
      unsubscribePending = onSnapshot(
        doc(db, COLLECTIONS.RESULTS_PENDING, pendingDocId),
        async (snap) => {
          // Document was deleted → evaluation is done
          if (!snap.exists()) {
            onStatusChange?.('fetching');

            try {
              // ── Step 3: Query results for the new document ─────────────
              // Poll up to 5 times with exponential backoff (Firestore
              // replication may have a brief lag after the function writes).
              const resultId = await pollForResult(
                data.studentId,
                data.examId,
                5,
                500,
              );

              settle(() => resolve({ resultId }));
            } catch (pollErr) {
              settle(() => reject(pollErr));
            }
          }
        },
        (err) => {
          // Listener error (permissions, network, etc.)
          settle(() =>
            reject(new Error(`Submission listener failed: ${err.message}`))
          );
        }
      );

      // ── Step 4: Timeout guard ──────────────────────────────────────────
      // If the Cloud Function does not respond within TIMEOUT_MS, reject
      // so the UI can show an error instead of spinning forever.
      timeoutHandle = setTimeout(() => {
        settle(() =>
          reject(
            new Error(
              'Evaluation timed out. The Cloud Function may be cold-starting. ' +
              'Please try again in a moment.'
            )
          )
        );
      }, TIMEOUT_MS);

    } catch (err) {
      settle(() => reject(err));
    }
  });
};

/**
 * pollForResult
 *
 * Queries results where studentId == uid && examId == examId,
 * ordered by evaluatedAt descending to get the most recent evaluation.
 * Retries with exponential backoff to handle Firestore replication lag.
 *
 * @param {string} studentId
 * @param {string} examId
 * @param {number} maxAttempts
 * @param {number} initialDelayMs
 * @returns {Promise<string>} resultId
 */
const pollForResult = async (studentId, examId, maxAttempts, initialDelayMs) => {
  let delay = initialDelayMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // Capture the current delay value into a block-scoped const so the
    // async setTimeout callback closes over a stable value, not the mutable
    // `delay` variable (fixes ESLint no-loop-func warning).
    const waitMs = delay;
    await new Promise((r) => setTimeout(r, waitMs));
    delay = Math.min(delay * 2, 4000); // exponential backoff, cap at 4s

    const q = query(
      collection(db, COLLECTIONS.RESULTS),
      where('studentId', '==', studentId),
      where('examId',    '==', examId),
      orderBy('evaluatedAt', 'desc'),
      limit(1),
    );

    const snap = await getDocs(q);

    if (!snap.empty) {
      return snap.docs[0].id;
    }
  }

  throw new Error(
    'Result not found after evaluation. Check Cloud Function logs for errors.'
  );
};

// ─── Queries ──────────────────────────────────────────────────────────────────

export const getResultById = async (resultId) => {
  const result = await fsGetDoc(COLLECTIONS.RESULTS, resultId);
  if (!result) throw new Error('Result not found');
  return result;
};

export const getResultsByStudent = async (studentId) => {
  // Order by submittedAt descending directly in Firestore — no client-side sort needed.
  // Falls back to fsQueryWhere if the composite index is not yet deployed.
  try {
    return await fsQueryWhereOrderBy(
      COLLECTIONS.RESULTS,
      'studentId', '==', studentId,
      'submittedAt', 'desc',
    );
  } catch {
    // Index may not exist yet — fall back to unordered query
    return fsQueryWhere(COLLECTIONS.RESULTS, 'studentId', '==', studentId);
  }
};

export const getResultsByExam = async (examId) => {
  return fsQueryWhere(COLLECTIONS.RESULTS, 'examId', '==', examId);
};

export const getAllResults = async () => {
  return fsGetCollection(COLLECTIONS.RESULTS);
};

// ─── Student statistics ───────────────────────────────────────────────────────

export const getStudentStatistics = async (studentId) => {
  const results = await getResultsByStudent(studentId);
  return computeStudentStats(results);
};
