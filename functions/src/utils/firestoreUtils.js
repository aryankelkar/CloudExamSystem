/**
 * firestoreUtils.js
 *
 * Shared Firestore Admin SDK helpers for Cloud Functions.
 * All functions use the Admin SDK — not the client SDK.
 *
 * ─── IDEMPOTENCY NOTES ────────────────────────────────────────────────────────
 *
 * deleteDoc() — Firestore Admin SDK silently succeeds when deleting a
 *   document that does not exist.  No error is thrown.  This makes every
 *   caller of deleteDoc() inherently retry-safe.
 *
 * deleteSubCollectionAll() — Each iteration fetches the live sub-collection
 *   state.  If a prior run already deleted some batches, the loop simply
 *   skips those and picks up the remaining documents.  Safe to re-run.
 *
 * getDocRef() — Returns a raw DocumentReference so callers can use it inside
 *   runTransaction() without going through the helper layer.
 */

const { getFirestore, FieldValue } = require('firebase-admin/firestore');

// ─── Single document helpers ──────────────────────────────────────────────────

/**
 * Fetch a single document.
 * Returns { id, ...data } or null when the document does not exist.
 */
const getDoc = async (collectionPath, docId) => {
  const snap = await getFirestore().collection(collectionPath).doc(docId).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() };
};

/**
 * Return a raw DocumentReference.
 * Required when the caller needs to use the ref inside a runTransaction().
 */
const getDocRef = (collectionPath, docId) =>
  getFirestore().collection(collectionPath).doc(docId);

/**
 * Set a document at a known path (full overwrite).
 */
const setDoc = (collectionPath, docId, data) =>
  getFirestore().collection(collectionPath).doc(docId).set(data);

/**
 * Add a document with an auto-generated ID.
 * Returns the DocumentReference (with .id).
 */
const addDoc = (collectionPath, data) =>
  getFirestore().collection(collectionPath).add(data);

/**
 * Update specific fields on an existing document.
 */
const updateDoc = (collectionPath, docId, data) =>
  getFirestore().collection(collectionPath).doc(docId).update(data);

/**
 * Delete a single document.
 *
 * Idempotency: Firestore Admin SDK does NOT throw when the document does not
 * exist — the delete is silently treated as a no-op.  This means every
 * caller is safe to invoke on retry without additional guards.
 */
const deleteDoc = (collectionPath, docId) =>
  getFirestore().collection(collectionPath).doc(docId).delete();

// ─── Collection query helpers ─────────────────────────────────────────────────

/**
 * Fetch all documents in a top-level collection.
 */
const getCollection = async (collectionPath) => {
  const snap = await getFirestore().collection(collectionPath).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

/**
 * Query a collection: field op value.
 * Returns an array of { id, ...data } objects.
 */
const queryWhere = async (collectionPath, field, op, value) => {
  const snap = await getFirestore()
    .collection(collectionPath)
    .where(field, op, value)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

/**
 * Fetch all documents in a sub-collection.
 */
const getSubCollection = async (parentPath, parentId, subCollection) => {
  const snap = await getFirestore()
    .collection(parentPath)
    .doc(parentId)
    .collection(subCollection)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

// ─── Sub-collection bulk-delete helper ───────────────────────────────────────

/**
 * Batch-delete all documents in a sub-collection.
 *
 * Idempotency: safe to re-run after a partial failure.
 *   - Each iteration queries the live sub-collection state.
 *   - If a prior run already deleted some batches, this picks up the rest.
 *   - batch.delete(ref) on a non-existent document is a Firestore no-op.
 *
 * @param {string} parentPath    e.g. 'exams'
 * @param {string} parentId      e.g. 'abc123'
 * @param {string} subCollection e.g. 'questions'
 * @returns {Promise<number>}    Total documents deleted in this invocation
 */
const deleteSubCollectionAll = async (parentPath, parentId, subCollection) => {
  const db      = getFirestore();
  const collRef = db.collection(parentPath).doc(parentId).collection(subCollection);

  let deleted = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const snap = await collRef.limit(100).get();
    if (snap.empty) break;

    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();

    deleted += snap.docs.length;
  }

  return deleted;
};

// ─── Exported primitives ──────────────────────────────────────────────────────

const serverTimestamp = () => FieldValue.serverTimestamp();

module.exports = {
  getDoc,
  getDocRef,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  getCollection,
  queryWhere,
  getSubCollection,
  deleteSubCollectionAll,
  serverTimestamp,
  FieldValue,
};
