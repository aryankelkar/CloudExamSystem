/**
 * syncResultToBigQuery.js
 *
 * Cloud Function Gen 2 — Firestore trigger
 * Fires on:  results/{resultId}  onCreate
 *
 * Responsibility:
 *   When the evaluateExam function writes a graded result to Firestore,
 *   this function immediately streams one row into:
 *     cloudexam_analytics.exam_results
 *
 * Architecture:
 *   Firestore (operational) ─→ BigQuery (analytics warehouse)
 *
 *   Firestore remains the source of truth for the application.
 *   BigQuery receives a copy of every result for analytics queries.
 *   The two stores are eventually consistent — BQ row arrives within seconds.
 *
 * Idempotency:
 *   Firestore onDocumentCreated fires exactly once per document creation.
 *   If the function crashes before inserting, Firebase retries (retry: true).
 *   BigQuery streaming insert is NOT idempotent — a retry could insert a
 *   duplicate row.
 *
 *   Mitigation:
 *   - The resultId is inserted as a field. Downstream BQ queries can use
 *     SELECT DISTINCT resultId or deduplicate before aggregation.
 *   - For production, consider using BQ Storage Write API with a
 *     COMMITTED stream which supports exactly-once semantics.
 *   - retry: false here because a partial insert is less harmful than a
 *     duplicate row. Failed syncs are recoverable via backfill.
 *
 * IAM required:
 *   Cloud Functions service account needs:
 *     roles/bigquery.dataEditor  on cloudexam_analytics dataset
 *     roles/bigquery.jobUser     on the project
 */

"use strict";

const {onDocumentCreated} = require("firebase-functions/v2/firestore");
const {logger} = require("firebase-functions");
const {COLLECTIONS} = require("./utils/constants");
const {examResultsTable, insertRows, ensureInfrastructure} = require("./bigquery/client");

// Ensure tables exist once per cold start — cheap exists() check.
let infraReady = false;
const getInfra = async () => {
  if (!infraReady) {
    await ensureInfrastructure();
    infraReady = true;
  }
};

exports.syncResultToBigQuery = onDocumentCreated(
    {
      document: `${COLLECTIONS.RESULTS}/{resultId}`,
      region: "asia-south1",
      retry: false, // see idempotency note above
      timeoutSeconds: 60,
      memory: "256MiB",
    },
    async (event) => {
      const resultId = event.params.resultId;
      const data = event.data?.data();

      if (!data) {
        logger.warn("[syncResultToBigQuery] Empty snapshot — skipping", {resultId});
        return;
      }

      logger.info("[syncResultToBigQuery] Syncing result to BigQuery", {
        resultId,
        studentId: data.studentId,
        examId: data.examId,
      });

      try {
        await getInfra();

        /* Convert Firestore Timestamp → JS Date → ISO string for BQ TIMESTAMP */
        const toISO = (ts) => {
          if (!ts) return null;
          if (ts?.toDate) return ts.toDate().toISOString();
          return new Date(ts).toISOString();
        };

        const row = {
          resultId,
          studentId: data.studentId ?? null,
          studentName: data.studentName ?? null,
          examId: data.examId ?? null,
          examTitle: data.examTitle ?? null,
          subject: data.subject ?? null,
          // ── MARKS — never used as question counts ──────────────────────
          score: data.obtainedMarks != null ? Number(data.obtainedMarks) :
            (data.score != null ? Number(data.score) : null),
          totalMarks: data.totalMarks != null ? Number(data.totalMarks) : null,
          percentage: data.percentage != null ? parseFloat(data.percentage) : null,
          status: data.status ?? null,
          // ── QUESTION COUNTS — never used as marks ──────────────────────
          correctAnswers: data.correctAnswers != null ? Number(data.correctAnswers) : null,
          wrongAnswers: data.wrongAnswers != null ? Number(data.wrongAnswers) : null,
          attemptNumber: data.attemptNumber != null ? Number(data.attemptNumber) : 1,
          submittedAt: toISO(data.submittedAt) ?? new Date().toISOString(),
          syncedAt: new Date().toISOString(),
        };

        /* Validate required fields before sending to BQ */
        if (!row.studentId || !row.examId || !row.submittedAt) {
          logger.error("[syncResultToBigQuery] Missing required fields — skipping BQ insert", {
            resultId,
            hasStudentId: !!row.studentId,
            hasExamId: !!row.examId,
            hasSubmittedAt: !!row.submittedAt,
          });
          return;
        }

        await insertRows(examResultsTable(), row, `result:${resultId}`);

        logger.info("[syncResultToBigQuery] Row inserted successfully", {
          resultId,
          studentId: row.studentId,
          examId: row.examId,
          percentage: row.percentage,
        });
      } catch (err) {
      // Log error but do NOT re-throw — a failed BQ sync should not affect
      // the student's result in Firestore. Analytics can be backfilled.
        logger.error("[syncResultToBigQuery] Failed to insert row", {
          resultId,
          error: err.message,
          stack: err.stack,
        });
      }
    },
);
