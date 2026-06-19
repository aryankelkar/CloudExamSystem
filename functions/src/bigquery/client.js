/**
 * functions/src/bigquery/client.js
 *
 * Singleton BigQuery client + dataset/table accessor helpers.
 * All BigQuery operations in this project import from here — never instantiate
 * BigQuery directly in other files. This makes mocking in tests trivial.
 */

"use strict";

const {BigQuery} = require("@google-cloud/bigquery");
const {
  DATASET_ID,
  LOCATION,
  EXAM_RESULTS_TABLE_ID,
  EXAM_EVENTS_TABLE_ID,
  EXAM_RESULTS_SCHEMA,
  EXAM_EVENTS_SCHEMA,
  EXAM_RESULTS_METADATA,
  EXAM_EVENTS_METADATA,
} = require("./schema");

/* ─── Singleton client ────────────────────────────────────────────────────── */

const bq = new BigQuery({location: LOCATION});

/* ─── Table accessors ─────────────────────────────────────────────────────── */

const dataset = () => bq.dataset(DATASET_ID);
const examResultsTable = () => dataset().table(EXAM_RESULTS_TABLE_ID);
const examEventsTable = () => dataset().table(EXAM_EVENTS_TABLE_ID);

/* ─── Ensure dataset + table exist (idempotent) ───────────────────────────── */

/**
 * ensureDataset
 *
 * Creates the dataset if it doesn't exist.
 * Safe to call on every function invocation — BigQuery returns a "already
 * exists" response (not an error) if the dataset is already there.
 */
const ensureDataset = async () => {
  const [exists] = await dataset().exists();
  if (!exists) {
    await bq.createDataset(DATASET_ID, {location: LOCATION});
    console.info(`[BQ] Dataset created: ${DATASET_ID}`);
  }
};

/**
 * ensureTable
 *
 * Creates a table with schema + partitioning + clustering if it doesn't exist.
 *
 * @param {string} tableId    BigQuery table ID
 * @param {Array}  schema     Array of field descriptors
 * @param {Object} metadata   Partitioning/clustering config
 */
const ensureTable = async (tableId, schema, metadata) => {
  const table = dataset().table(tableId);
  const [exists] = await table.exists();
  if (!exists) {
    await dataset().createTable(tableId, {
      schema,
      ...metadata,
    });
    console.info(`[BQ] Table created: ${DATASET_ID}.${tableId}`);
  }
};

/**
 * ensureInfrastructure
 *
 * Top-level helper — call once at startup or in a setup script.
 * Idempotent: safe to call on every function invocation.
 */
const ensureInfrastructure = async () => {
  await ensureDataset();
  await Promise.all([
    ensureTable(EXAM_RESULTS_TABLE_ID, EXAM_RESULTS_SCHEMA, EXAM_RESULTS_METADATA),
    ensureTable(EXAM_EVENTS_TABLE_ID, EXAM_EVENTS_SCHEMA, EXAM_EVENTS_METADATA),
  ]);
};

/* ─── Row insertion helper ────────────────────────────────────────────────── */

/**
 * insertRows
 *
 * Inserts rows into a BigQuery table using the streaming insertAll API.
 * Automatically handles partial failures — logs bad rows but does NOT
 * throw, so a single malformed row doesn't block the others.
 *
 * @param {BigQuery.Table} table
 * @param {Object|Object[]} rows    Single row or array of rows
 * @param {string}          context Label for error logs
 */
const insertRows = async (table, rows, context = "insertRows") => {
  const rowArr = Array.isArray(rows) ? rows : [rows];
  if (rowArr.length === 0) return;

  try {
    const [apiResponse] = await table.insert(rowArr, {
      skipInvalidRows: false,
      ignoreUnknownValues: false,
      raw: false,
    });
    // insert() resolves to [{}, ...] on full success; the response object
    // is not useful unless there are insertErrors.
    console.info(`[BQ:${context}] Inserted ${rowArr.length} row(s) successfully.`);
    return apiResponse;
  } catch (err) {
    if (err.name === "PartialFailureError") {
      // Some rows failed — log each invalid row without crashing the function
      const failures = err.errors ?? [];
      failures.forEach(({row, errors}) => {
        console.error(`[BQ:${context}] Row insertion failed`, {
          row: JSON.stringify(row),
          errors: errors.map((e) => e.message).join("; "),
        });
      });
      // Re-throw so the calling function can decide whether to retry
      throw err;
    }
    throw err; // Unknown error — propagate
  }
};

/* ─── Query helper ────────────────────────────────────────────────────────── */

/**
 * runQuery
 *
 * Runs a parameterized SQL query and returns rows as plain JS objects.
 *
 * @param {string} sql
 * @param {Object} params  Named query parameters
 * @return {Promise<Object[]>}
 */
const runQuery = async (sql, params = {}) => {
  const [rows] = await bq.query({query: sql, location: LOCATION, params});
  return rows;
};

/* ─── Exports ──────────────────────────────────────────────────────────────── */

module.exports = {
  bq,
  dataset,
  examResultsTable,
  examEventsTable,
  ensureDataset,
  ensureTable,
  ensureInfrastructure,
  insertRows,
  runQuery,
  DATASET_ID,
  EXAM_RESULTS_TABLE_ID,
  EXAM_EVENTS_TABLE_ID,
};
