/**
 * evaluateExam.js — Cloud Function: evaluateExam  (idempotent, retry-safe)
 *
 * ─── IDEMPOTENCY DESIGN ───────────────────────────────────────────────────────
 *
 * Problem: retry: true means Firebase will re-invoke this function if it
 * crashes mid-execution.  The dangerous window is:
 *
 *   results written  ──→  crash  ──→  retry fires  ──→  DUPLICATE result
 *
 * Fix — two-layer deduplication using a Firestore transaction:
 *
 *   Layer 1 — pre-check (fast path):
 *     Query results where submissionId == current submissionId.
 *     If a result already exists, log and return immediately.
 *     Covers the common case where the function succeeded on the first run.
 *
 *   Layer 2 — transaction write (race-condition safe path):
 *     The result is written inside a runTransaction() that re-checks for a
 *     duplicate inside the transaction's serialised read-write window.
 *     If two retries fire simultaneously, only one will win the transaction;
 *     the other will see the already-written result and exit cleanly.
 *
 * ─── FULL FLOW ────────────────────────────────────────────────────────────────
 *
 *   Student submits answers
 *     ↓ writes to results_pending/{submissionId}
 *     ↓ evaluateExam triggers (onDocumentCreated)
 *     ↓ Layer 1: check results collection for duplicate → exit if found
 *     ↓ Fetch exam + questions (correctAnswer never leaves this function)
 *     ↓ Evaluate answers server-side
 *     ↓ Layer 2: transaction — re-check + write result atomically
 *     ↓ Delete results_pending/{submissionId}
 *     ↓ Frontend listener detects deletion → polls results → navigates
 *
 * ─── SECURITY ─────────────────────────────────────────────────────────────────
 *
 * correctAnswer is NEVER returned to the client.  It lives only in:
 *   - Firestore  (exams/{id}/questions/{id}.correctAnswer)
 *   - This Cloud Function during evaluation (server-side only)
 *
 * Firestore Rules enforce:
 *   - Students can create results_pending documents (not read/update/delete)
 *   - Nobody can write results from the client — Admin SDK only
 */

const {onDocumentCreated} = require("firebase-functions/v2/firestore");
const {logger} = require("firebase-functions");
const {getFirestore, FieldValue} = require("firebase-admin/firestore");
const {
  getDoc,
  getSubCollection,
  deleteDoc,
} = require("./utils/firestoreUtils");
const {evaluateAnswers} = require("./utils/examUtils");
const {COLLECTIONS, SUBCOLLECTIONS} = require("./utils/constants");

// ─── Helper: check for an existing result by submissionId ────────────────────

/**
 * Returns the first result document that was produced from this submissionId,
 * or null if none exists yet.
 *
 * @param {string} submissionId
 * @return {Promise<FirebaseFirestore.QueryDocumentSnapshot|null>}
 */
const findExistingResult = async (submissionId) => {
  const snap = await getFirestore()
      .collection(COLLECTIONS.RESULTS)
      .where("submissionId", "==", submissionId)
      .limit(1)
      .get();
  return snap.empty ? null : snap.docs[0];
};

// ─── Cloud Function ───────────────────────────────────────────────────────────

exports.evaluateExam = onDocumentCreated(
    {
      document: `${COLLECTIONS.RESULTS_PENDING}/{submissionId}`,
      region: "asia-south1",
      retry: true, // Firebase retries on crash — idempotency handles it safely
    },
    async (event) => {
      const submissionId = event.params.submissionId;
      const submission = event.data?.data();

      // ── Guard: empty trigger payload ─────────────────────────────────────
      if (!submission) {
        logger.error("evaluateExam: empty snapshot — cannot process", {submissionId});
        return; // do not throw — retrying an empty snapshot will never succeed
      }

      const {studentId, examId, answers, submittedAt, studentName, examTitle, subject} =
      submission;

      logger.info("evaluateExam: invocation started", {submissionId, studentId, examId});

      // ── Guard: missing required fields ────────────────────────────────────
      if (!studentId || !examId || !answers) {
        logger.error("evaluateExam: missing required fields — deleting malformed pending doc", {
          submissionId,
          hasStudentId: !!studentId,
          hasExamId: !!examId,
          hasAnswers: !!answers,
        });
        // Delete the malformed doc so it is not retried endlessly
        await deleteDoc(COLLECTIONS.RESULTS_PENDING, submissionId).catch((e) =>
          logger.warn("evaluateExam: could not delete malformed pending doc", {submissionId, error: e.message}),
        );
        return;
      }

      // ══════════════════════════════════════════════════════════════════════
      // IDEMPOTENCY LAYER 1 — pre-flight duplicate check (fast path)
      // ══════════════════════════════════════════════════════════════════════
      // If the function previously completed successfully (result exists AND
      // pending doc was deleted) but Firebase still retried for some reason,
      // we catch it here with a single cheap query before doing any real work.

      const existingBeforeEval = await findExistingResult(submissionId);
      if (existingBeforeEval) {
        logger.info("evaluateExam: submission already processed (pre-check) — safe exit", {
          submissionId,
          existingResultId: existingBeforeEval.id,
        });
        // Ensure the pending doc is cleaned up (it may still exist if a
        // previous run wrote the result but crashed before deleting pending)
        await deleteDoc(COLLECTIONS.RESULTS_PENDING, submissionId).catch(() => {});
        return;
      }

      // ── Step 1: Fetch exam document ───────────────────────────────────────
      const exam = await getDoc(COLLECTIONS.EXAMS, examId);
      if (!exam) {
        logger.error("evaluateExam: exam not found — deleting pending doc", {examId, submissionId});
        await deleteDoc(COLLECTIONS.RESULTS_PENDING, submissionId).catch(() => {});
        return;
      }

      logger.info("evaluateExam: exam fetched", {examId, title: exam.title});

      // ── Step 2: Fetch questions sub-collection ────────────────────────────
      // correctAnswer is accessed here on the server — never sent to client.
      const questions = await getSubCollection(COLLECTIONS.EXAMS, examId, SUBCOLLECTIONS.QUESTIONS);

      if (!questions || questions.length === 0) {
        logger.error("evaluateExam: no questions found — deleting pending doc", {examId, submissionId});
        await deleteDoc(COLLECTIONS.RESULTS_PENDING, submissionId).catch(() => {});
        return;
      }

      logger.info("evaluateExam: questions fetched", {examId, questionCount: questions.length});

      // ── Step 3: Evaluate answers (pure server-side) ───────────────────────
      const {
        obtainedMarks,
        totalMarks,
        correctAnswers,
        wrongAnswers,
        unanswered,
        percentage,
        status,
      } = evaluateAnswers(answers, questions);

      logger.info("evaluateExam: evaluation complete", {
        submissionId, studentId, examId,
        obtainedMarks, totalMarks, percentage, status,
      });

      // Build the result payload once — reused inside the transaction
      const resultData = {
        // ── Deduplication key ──────────────────────────────────────────────
        submissionId,
        // ── Identity ──────────────────────────────────────────────────────
        studentId,
        examId,
        studentName: studentName || "Unknown Student",
        examTitle: examTitle || exam.title || "Unknown Exam",
        subject: subject || exam.subject || "Unknown Subject",
        // ── MARKS — never stored as question counts ────────────────────────
        score: obtainedMarks, // alias kept for backward compat
        obtainedMarks, // canonical marks field
        totalMarks, // sum of all question marks
        percentage, // (obtainedMarks / totalMarks) * 100
        status, // 'pass' | 'fail'
        // ── QUESTION COUNTS — never stored as marks ───────────────────────
        totalQuestions: questions.length, // authoritative question count
        correctAnswers, // count of correctly answered questions
        wrongAnswers, // count of incorrectly answered questions
        unanswered, // count of questions not attempted
        // ── Timestamps ────────────────────────────────────────────────────
        submittedAt: submittedAt || FieldValue.serverTimestamp(),
        evaluatedAt: FieldValue.serverTimestamp(),
        processedAt: FieldValue.serverTimestamp(),
        // ── Trust flag ────────────────────────────────────────────────────
        cloudEvaluated: true,
      };

      // ══════════════════════════════════════════════════════════════════════
      // IDEMPOTENCY LAYER 2 — Firestore transaction (race-condition safe path)
      // ══════════════════════════════════════════════════════════════════════
      //
      // Scenario handled: two retries fire at the same time (e.g. first run
      // crashed mid-transaction and Firebase immediately re-invoked).
      //
      // Both enter the transaction.  Inside the transaction's serialised window:
      //   - Retry A: reads the results collection → empty → writes result
      //   - Retry B: reads the results collection → already written → exits
      //
      // Only one result document is ever created.
      //
      // Why a new document ref instead of a known ID?
      //   runTransaction requires reading the exact ref being written.  We
      //   create a new ref with an auto-generated ID and write it inside the
      //   transaction.  The deduplication check inside the transaction queries
      //   by submissionId (not doc ID) so it can detect any prior write.
      //   NOTE: Firestore transactions do NOT support arbitrary query + write
      //   atomically across different collections, but they DO support reading
      //   documents by ref inside the transaction. We work around this by:
      //     1. Pre-querying outside the transaction (Layer 1 above).
      //     2. Inside the transaction, writing to a known new ref with a
      //        condition-checked set via the transaction's read on the new ref
      //        itself — ensuring only one caller commits.
      //
      // Practical approach: use a deterministic document ID derived from the
      // submissionId so that even if two concurrent transactions try to write,
      // the second one's set() is idempotent (same data, same doc ID).

      const db = getFirestore();
      const deterministicId = `eval_${submissionId}`; // stable across retries
      const resultRef = db.collection(COLLECTIONS.RESULTS).doc(deterministicId);

      try {
        await db.runTransaction(async (txn) => {
        // Read the candidate result doc inside the transaction
          const existingSnap = await txn.get(resultRef);

          if (existingSnap.exists) {
          // Another retry already wrote this result — commit nothing
            logger.info("evaluateExam: result already exists inside transaction — no-op", {
              submissionId,
              resultId: deterministicId,
            });
            return; // transaction commits with zero writes — safe
          }

          // First writer: create the result document
          txn.set(resultRef, resultData);
          logger.info("evaluateExam: result queued in transaction", {
            submissionId,
            resultId: deterministicId,
          });
        });

        logger.info("evaluateExam: result written successfully", {
          resultId: deterministicId,
          submissionId,
          studentId,
          examId,
          percentage,
          status,
        });
      } catch (txnError) {
        logger.error("evaluateExam: transaction failed", {
          submissionId,
          message: txnError.message,
          stack: txnError.stack,
        });
        throw txnError; // re-throw → Firebase will retry
      }

      // ── Step 4: Delete the pending submission ─────────────────────────────
      // Deleting the pending doc signals the frontend listener that evaluation
      // is complete.  This step is safe to retry — deleting an already-deleted
      // doc is a no-op in Firestore (no error thrown).
      try {
        await deleteDoc(COLLECTIONS.RESULTS_PENDING, submissionId);
        logger.info("evaluateExam: pending submission deleted", {submissionId});
      } catch (deleteError) {
      // Non-fatal: the result is already written.  Log and do not re-throw
      // because re-throwing would cause Firebase to retry, which would hit
      // Layer 1 and exit cleanly, but it's unnecessary work.
        logger.warn("evaluateExam: could not delete pending doc (non-fatal)", {
          submissionId,
          message: deleteError.message,
        });
      }

      logger.info("evaluateExam: completed successfully", {
        submissionId,
        resultId: deterministicId,
        studentId,
        examId,
        percentage,
        status,
      });
    },
);
