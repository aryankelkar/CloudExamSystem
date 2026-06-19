/**
 * deleteExamCascade.js — Cloud Function: deleteExamCascade  (idempotent, retry-safe)
 *
 * ─── IDEMPOTENCY DESIGN ───────────────────────────────────────────────────────
 *
 * Problem: retry: true means Firebase can re-invoke this function if it crashes
 * while batch-deleting questions (e.g. after 3 of 10 batches complete).
 *
 * The naive risk:
 *   Retry A deletes batches 1–3 → crashes → Retry B starts
 *   Retry B tries to delete the same batches → documents already gone
 *   → does Firestore throw? NO — deleting a non-existent document is a no-op
 *
 * Firestore Admin SDK behaviour (confirmed):
 *   batch.delete(ref) where the document does not exist succeeds silently.
 *   No exception is thrown. The batch.commit() succeeds.
 *
 * Therefore deleteExamCascade is already inherently idempotent at the Firestore
 * level.  The refactor adds:
 *
 *   1. An explicit empty-subcollection check at the start of each retry.
 *      If all questions are already gone, log and return immediately rather
 *      than entering the batch-delete loop unnecessarily.
 *
 *   2. Structured logger.info / logger.warn / logger.error throughout.
 *
 *   3. Clear commentary explaining why the retry is safe.
 *
 * ─── WHY CASCADE IS NEEDED ────────────────────────────────────────────────────
 *
 * Firestore does NOT auto-delete sub-collections when a parent document is
 * deleted.  Orphaned questions remain billable.  This function runs
 * asynchronously after the client delete, keeping the UI instant.
 *
 * ─── TRIGGER ─────────────────────────────────────────────────────────────────
 *
 *   Firestore onDocumentDeleted("exams/{examId}")
 */

const {onDocumentDeleted} = require("firebase-functions/v2/firestore");
const {logger} = require("firebase-functions");
const {getFirestore} = require("firebase-admin/firestore");
const {COLLECTIONS, SUBCOLLECTIONS} = require("./utils/constants");

// ─── Batch-delete helper (idempotent by Firestore design) ────────────────────

/**
 * Delete all documents in a sub-collection using Firestore batch writes.
 *
 * Idempotency guarantee: Firestore silently ignores deletes of documents
 * that no longer exist — no error is thrown, batch.commit() succeeds.
 * This makes it safe to re-run after a partial failure.
 *
 * @param {string} parentPath    e.g. 'exams'
 * @param {string} parentId      e.g. 'abc123'
 * @param {string} subCollection e.g. 'questions'
 * @return {Promise<number>}    Total documents deleted across all batches
 */
const batchDeleteSubCollection = async (parentPath, parentId, subCollection) => {
  const db = getFirestore();
  const collRef = db.collection(parentPath).doc(parentId).collection(subCollection);

  let totalDeleted = 0;
  let batchNumber = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    // Fetch up to 100 document refs.  If the sub-collection is already empty
    // (fully deleted by a prior run), snap.empty === true and we exit.
    const snap = await collRef.limit(100).get();

    if (snap.empty) break;

    batchNumber += 1;
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();

    totalDeleted += snap.docs.length;

    logger.info("deleteExamCascade: batch committed", {
      batchNumber,
      deletedInBatch: snap.docs.length,
      totalDeleted,
    });
  }

  return totalDeleted;
};

// ─── Cloud Function ───────────────────────────────────────────────────────────

exports.deleteExamCascade = onDocumentDeleted(
    {
      document: `${COLLECTIONS.EXAMS}/{examId}`,
      region: "asia-south1",
      retry: true, // safe — deleting already-deleted docs is a Firestore no-op
    },
    async (event) => {
      const examId = event.params.examId;
      const examData = event.data?.data();

      logger.info("deleteExamCascade: invocation started", {
        examId,
        examTitle: examData?.title ?? "(title unavailable)",
      });

      try {
      // ══════════════════════════════════════════════════════════════════
      // IDEMPOTENCY CHECK — peek at the sub-collection before entering loop
      // ══════════════════════════════════════════════════════════════════
      // On a retry after a full first-run success, the sub-collection is
      // already empty.  A single limit(1) fetch confirms this cheaply and
      // lets us exit without opening any batch-delete loop.

        const db = getFirestore();
        const peekSnap = await db
            .collection(COLLECTIONS.EXAMS)
            .doc(examId)
            .collection(SUBCOLLECTIONS.QUESTIONS)
            .limit(1)
            .get();

        if (peekSnap.empty) {
          logger.info("deleteExamCascade: sub-collection already empty — no-op (idempotent exit)", {
            examId,
          });
          return;
        }

        // ── Sub-collection has documents — proceed with deletion ──────────
        logger.info("deleteExamCascade: questions found — starting batch delete", {examId});

        const totalDeleted = await batchDeleteSubCollection(
            COLLECTIONS.EXAMS,
            examId,
            SUBCOLLECTIONS.QUESTIONS,
        );

        logger.info("deleteExamCascade: cascade delete complete", {
          examId,
          totalDeleted,
        });
      } catch (error) {
        logger.error("deleteExamCascade: unhandled error — will retry", {
          examId,
          message: error.message,
          stack: error.stack,
        });
        // Re-throw → Firebase retries with exponential backoff.
        // The next retry will safely re-enter batchDeleteSubCollection and
        // pick up from wherever the previous run left off (because the loop
        // always queries the live state of the sub-collection, not an offset).
        throw error;
      }
    },
);
