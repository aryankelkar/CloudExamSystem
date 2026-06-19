/**
 * syncAuditLogToBigQuery.js
 *
 * Cloud Function Gen 2 — Firestore trigger
 * Fires on:  auditLogs/{logId}  onCreate
 *
 * Responsibility:
 *   Streams every new audit log document into:
 *     cloudexam_analytics.exam_events
 *
 * This gives the analytics warehouse a complete event stream:
 *   USER_LOGIN, USER_REGISTERED, EXAM_CREATED, EXAM_STARTED,
 *   EXAM_SUBMITTED, RESULT_VIEWED, USER_LOGOUT
 *
 * These events enable:
 *   - User activity analysis (logins over time)
 *   - Exam funnel analysis (started vs submitted)
 *   - Content engagement (which exams are viewed most)
 *
 * IAM required:
 *   roles/bigquery.dataEditor  on cloudexam_analytics dataset
 *   roles/bigquery.jobUser     on the project
 */

"use strict";

const {onDocumentCreated} = require("firebase-functions/v2/firestore");
const {logger} = require("firebase-functions");
const {examEventsTable, insertRows, ensureInfrastructure} = require("./bigquery/client");

const AUDIT_LOGS_COLLECTION = "auditLogs";

let infraReady = false;
const getInfra = async () => {
  if (!infraReady) {
    await ensureInfrastructure();
    infraReady = true;
  }
};

exports.syncAuditLogToBigQuery = onDocumentCreated(
    {
      document: `${AUDIT_LOGS_COLLECTION}/{logId}`,
      region: "asia-south1",
      retry: false,
      timeoutSeconds: 60,
      memory: "256MiB",
    },
    async (event) => {
      const logId = event.params.logId;
      const data = event.data?.data();

      if (!data) {
        logger.warn("[syncAuditLogToBigQuery] Empty snapshot — skipping", {logId});
        return;
      }

      logger.info("[syncAuditLogToBigQuery] Syncing audit log to BigQuery", {
        logId,
        action: data.action,
        userId: data.userId,
      });

      try {
        await getInfra();

        const toISO = (ts) => {
          if (!ts) return null;
          if (ts?.toDate) return ts.toDate().toISOString();
          return new Date(ts).toISOString();
        };

        /* Resolve timestamp — auditLogs use 'timestamp' field */
        const eventTimestamp =
        toISO(data.timestamp) ??
        toISO(data.createdAt) ??
        new Date().toISOString();

        const row = {
          logId,
          action: data.action ?? null,
          userId: data.userId ?? null,
          userRole: data.userRole ?? null,
          targetId: data.targetId ?? data.metadata?.examId ?? null,
          targetType: data.targetType ?? null,
          timestamp: eventTimestamp,
          syncedAt: new Date().toISOString(),
        };

        if (!row.action || !row.timestamp) {
          logger.error("[syncAuditLogToBigQuery] Missing required fields — skipping", {
            logId,
            hasAction: !!row.action,
            hasTimestamp: !!row.timestamp,
          });
          return;
        }

        await insertRows(examEventsTable(), row, `audit:${logId}`);

        logger.info("[syncAuditLogToBigQuery] Row inserted successfully", {
          logId,
          action: row.action,
          userId: row.userId,
        });
      } catch (err) {
        logger.error("[syncAuditLogToBigQuery] Failed to insert row", {
          logId,
          error: err.message,
          stack: err.stack,
        });
      }
    },
);
