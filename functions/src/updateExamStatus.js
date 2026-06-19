/**
 * updateExamStatus.js — Cloud Function: updateExamStatus  (idempotent, retry-safe)
 *
 * ─── WHY onRequest INSTEAD OF onCall ─────────────────────────────────────────
 *
 * onCall() wraps the Firebase callable protocol — it expects a specific JSON
 * envelope and an Authorization header issued by the Firebase client SDK.
 * Cloud Scheduler sends a plain HTTP POST (with an OIDC token, not a Firebase
 * SDK token), so onCall() rejects every Scheduler invocation before the
 * business logic ever runs.
 *
 * onRequest() receives a standard Express-style (req, res) and works with:
 *   • Cloud Scheduler (OIDC token in Authorization header)
 *   • Direct HTTP (curl, Postman, browser)
 *   • Future monitoring/alerting webhooks
 *
 * ─── IDEMPOTENCY DESIGN ───────────────────────────────────────────────────────
 *
 * Cloud Scheduler fires this function every 5 minutes.  Concurrent or repeated
 * calls must not write to documents already in the correct state.
 *
 *   ✓ upcoming → active   only when exam.status === 'upcoming'
 *   ✓ active  → completed only when exam.status === 'active'
 *   ✗ never write to a document already in the target state
 *
 * Calling the function 10 times in a row produces identical Firestore state
 * to calling it once.  Extra calls just increment `skipped`.
 *
 * ─── RESPONSE SHAPE ──────────────────────────────────────────────────────────
 *
 *   HTTP 200:
 *   {
 *     success:          true,
 *     updatedUpcoming:  number,   // upcoming → active transitions made
 *     updatedCompleted: number,   // active → completed transitions made
 *     skipped:          number,   // exams already in the correct state
 *   }
 *
 *   HTTP 500:
 *   { success: false, message: string }
 *
 * ─── CLOUD SCHEDULER SETUP ───────────────────────────────────────────────────
 *
 *   gcloud scheduler jobs create http update-exam-status \
 *     --location=asia-south1 \
 *     --schedule="every 5 minutes" \
 *     --uri="https://asia-south1-YOUR_PROJECT_ID.cloudfunctions.net/updateExamStatus" \
 *     --message-body="{}" \
 *     --oidc-service-account-email="YOUR_SA@YOUR_PROJECT.iam.gserviceaccount.com" \
 *     --oidc-token-audience="https://asia-south1-YOUR_PROJECT_ID.cloudfunctions.net/updateExamStatus"
 *
 * ─── DEPLOYMENT ──────────────────────────────────────────────────────────────
 *
 *   firebase deploy --only functions:updateExamStatus
 */

const {onRequest} = require("firebase-functions/v2/https");
const {logger} = require("firebase-functions");
const {getFirestore, FieldValue} = require("firebase-admin/firestore");
const {COLLECTIONS, EXAM_STATUS} = require("./utils/constants");

// Firestore write-batch limit is 500 — stay well below it.
const BATCH_SIZE = 400;

exports.updateExamStatus = onRequest(
    {
      region: "asia-south1",
      invoker: "public", // allows Cloud Scheduler OIDC requests and direct HTTP calls
    },
    async (req, res) => {
    // ── Log every invocation for audit trail ─────────────────────────────────
      logger.info("Scheduler invocation received", {
        method: req.method,
        timestamp: new Date().toISOString(),
      });

      const db = getFirestore();
      const now = new Date();

      let updatedUpcoming = 0;
      let updatedCompleted = 0;
      let skipped = 0;

      try {
      // ── Fetch all exams ───────────────────────────────────────────────────
        const snap = await db.collection(COLLECTIONS.EXAMS).get();

        if (snap.empty) {
          logger.info("updateExamStatus: no exams found — nothing to do");
          return res.status(200).json({
            success: true,
            updatedUpcoming: 0,
            updatedCompleted: 0,
            skipped: 0,
          });
        }

        logger.info("updateExamStatus: exams fetched", {count: snap.docs.length});

        // ── Batch processing ──────────────────────────────────────────────────
        let batch = db.batch();
        let batchCount = 0;

        const flushBatch = async () => {
          if (batchCount > 0) {
            await batch.commit();
            logger.info("updateExamStatus: batch committed", {writes: batchCount});
            batch = db.batch();
            batchCount = 0;
          }
        };

        for (const doc of snap.docs) {
          const exam = doc.data();

          // ── Parse timestamps ───────────────────────────────────────────────
          const startTime = exam.startTime?.toDate ?
          exam.startTime.toDate() :
          new Date(exam.startTime);
          const endTime = exam.endTime?.toDate ?
          exam.endTime.toDate() :
          new Date(exam.endTime);

          // Skip exams with unparseable dates — log and move on
          if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
            logger.warn("updateExamStatus: skipping exam — invalid date fields", {
              examId: doc.id,
              startTime: exam.startTime,
              endTime: exam.endTime,
            });
            skipped += 1;
            continue;
          }

          // ════════════════════════════════════════════════════════════════════
          // IDEMPOTENT STATUS TRANSITIONS
          // Only write when the current stored status requires a change.
          // ════════════════════════════════════════════════════════════════════

          // Transition: upcoming → active
          if (exam.status === EXAM_STATUS.UPCOMING && startTime <= now && endTime > now) {
            batch.update(doc.ref, {
              status: EXAM_STATUS.ACTIVE,
              updatedAt: FieldValue.serverTimestamp(),
            });
            updatedUpcoming += 1;
            batchCount += 1;

            logger.info("updateExamStatus: queuing upcoming → active", {
              examId: doc.id,
              title: exam.title,
            });

            // Transition: active → completed
          } else if (exam.status === EXAM_STATUS.ACTIVE && endTime <= now) {
            batch.update(doc.ref, {
              status: EXAM_STATUS.COMPLETED,
              updatedAt: FieldValue.serverTimestamp(),
            });
            updatedCompleted += 1;
            batchCount += 1;

            logger.info("updateExamStatus: queuing active → completed", {
              examId: doc.id,
              title: exam.title,
            });

            // No transition needed — already in correct state
          } else {
            skipped += 1;
            logger.info("updateExamStatus: exam already in correct state — skipped", {
              examId: doc.id,
              status: exam.status,
            });
          }

          // Flush before hitting the batch size limit
          if (batchCount >= BATCH_SIZE) {
            await flushBatch();
          }
        }

        // Commit any remaining writes
        await flushBatch();

        // ── Completion log ────────────────────────────────────────────────────
        logger.info("Scheduler execution completed", {
          updatedUpcoming,
          updatedCompleted,
          skipped,
        });

        return res.status(200).json({
          success: true,
          updatedUpcoming,
          updatedCompleted,
          skipped,
        });
      } catch (error) {
        logger.error("updateExamStatus: unhandled error", {
          message: error.message,
          stack: error.stack,
        });

        return res.status(500).json({
          success: false,
          message: error.message,
        });
      }
    },
);
