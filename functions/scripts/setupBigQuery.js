/**
 * scripts/setupBigQuery.js
 *
 * One-time setup script — creates the BigQuery dataset and tables.
 * Run this ONCE before deploying the sync functions.
 *
 * Usage:
 *   cd functions
 *   node scripts/setupBigQuery.js
 *
 * Prerequisites:
 *   1. Install dependencies:   npm install
 *   2. Authenticate:           gcloud auth application-default login
 *   3. Set project:            gcloud config set project YOUR_PROJECT_ID
 *
 * The script is fully idempotent — safe to re-run if it fails partway through.
 */

'use strict';

const { BigQuery }  = require('@google-cloud/bigquery');
const {
  DATASET_ID,
  LOCATION,
  EXAM_RESULTS_TABLE_ID,
  EXAM_EVENTS_TABLE_ID,
  EXAM_RESULTS_SCHEMA,
  EXAM_EVENTS_SCHEMA,
  EXAM_RESULTS_METADATA,
  EXAM_EVENTS_METADATA,
} = require('../src/bigquery/schema');

const bq = new BigQuery({ location: LOCATION });

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

const step = (msg) => console.log(`\n▶  ${msg}`);
const ok   = (msg) => console.log(`   ✓  ${msg}`);
const info = (msg) => console.log(`   ℹ  ${msg}`);

/* ─── Dataset ─────────────────────────────────────────────────────────────── */

async function ensureDataset() {
  step(`Dataset: ${DATASET_ID} (${LOCATION})`);
  const dataset = bq.dataset(DATASET_ID);
  const [exists] = await dataset.exists();

  if (exists) {
    ok(`Dataset already exists — skipping creation.`);
    return dataset;
  }

  const [created] = await bq.createDataset(DATASET_ID, {
    location: LOCATION,
    description: 'CloudExam analytics warehouse. ' +
      'Contains exam results and audit events synced from Firestore.',
  });
  ok(`Dataset created: ${DATASET_ID}`);
  return created;
}

/* ─── Tables ──────────────────────────────────────────────────────────────── */

async function ensureTable(tableId, schema, metadata) {
  step(`Table: ${DATASET_ID}.${tableId}`);
  const table = bq.dataset(DATASET_ID).table(tableId);
  const [exists] = await table.exists();

  if (exists) {
    ok(`Table already exists — skipping creation.`);

    // Print current row count so operator can verify data is flowing
    const countSql = `SELECT COUNT(*) AS total FROM \`${DATASET_ID}.${tableId}\``;
    try {
      const [rows] = await bq.query({ query: countSql, location: LOCATION });
      info(`Current row count: ${rows[0]?.total ?? 'unknown'}`);
    } catch {
      info(`Could not count rows (table may be empty or partitioned).`);
    }
    return;
  }

  await bq.dataset(DATASET_ID).createTable(tableId, { schema, ...metadata });
  ok(`Table created: ${tableId}`);
  info(`Partitioned by: ${metadata.timePartitioning.field} (${metadata.timePartitioning.type})`);
  info(`Clustered by: ${metadata.clustering.fields.join(', ')}`);
}

/* ─── IAM notice ──────────────────────────────────────────────────────────── */

function printIAMInstructions(projectId) {
  const sa = `${projectId}@appspot.gserviceaccount.com`;
  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IAM permissions required for Cloud Functions
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Grant these roles to your Cloud Functions service account:

  Service Account: ${sa}

  gcloud projects add-iam-policy-binding ${projectId} \\
    --member="serviceAccount:${sa}" \\
    --role="roles/bigquery.dataEditor"

  gcloud projects add-iam-policy-binding ${projectId} \\
    --member="serviceAccount:${sa}" \\
    --role="roles/bigquery.jobUser"

  gcloud projects add-iam-policy-binding ${projectId} \\
    --member="serviceAccount:${sa}" \\
    --role="roles/datastore.user"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
}

/* ─── Main ────────────────────────────────────────────────────────────────── */

async function main() {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║   CloudExam BigQuery Setup                       ║');
  console.log('╚══════════════════════════════════════════════════╝');

  // Detect project from ADC
  const [projectId] = await bq.getProjectId ? [await bq.getProjectId()] : ['YOUR_PROJECT_ID'];
  info(`GCP Project: ${projectId}`);
  info(`BQ Location: ${LOCATION}`);

  await ensureDataset();
  await ensureTable(EXAM_RESULTS_TABLE_ID, EXAM_RESULTS_SCHEMA, EXAM_RESULTS_METADATA);
  await ensureTable(EXAM_EVENTS_TABLE_ID,  EXAM_EVENTS_SCHEMA,  EXAM_EVENTS_METADATA);

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅  BigQuery infrastructure ready.');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  console.log(`
Next steps:
  1. Grant IAM permissions (see below)
  2. Deploy Cloud Functions:
       firebase deploy --only functions:syncResultToBigQuery,functions:syncAuditLogToBigQuery,functions:getFacultyAnalytics,functions:getStudentAnalytics,functions:refreshAnalyticsCache
  3. Submit a test exam to verify data flows into BigQuery
  4. Run a verification query:
       bq query --use_legacy_sql=false \\
         'SELECT COUNT(*) FROM \`${DATASET_ID}.${EXAM_RESULTS_TABLE_ID}\`'
`);

  printIAMInstructions(projectId);
}

main().catch((err) => {
  console.error('\n❌  Setup failed:', err.message);
  console.error(err.stack);
  process.exit(1);
});
