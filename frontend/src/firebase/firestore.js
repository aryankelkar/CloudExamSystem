// Firestore helper wrappers
// Abstraction layer — swap Firestore for any other DB without touching service files

import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  serverTimestamp,
  increment,
} from 'firebase/firestore';
import { db } from '../firebase';

// ─── Document helpers ─────────────────────────────────────────────────────────

export const fsSetDoc = (collectionPath, docId, data) =>
  setDoc(doc(db, collectionPath, docId), data);

export const fsGetDoc = async (collectionPath, docId) => {
  const snap = await getDoc(doc(db, collectionPath, docId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const fsAddDoc = (collectionPath, data) =>
  addDoc(collection(db, collectionPath), data);

export const fsUpdateDoc = (collectionPath, docId, data) =>
  updateDoc(doc(db, collectionPath, docId), data);

export const fsDeleteDoc = (collectionPath, docId) =>
  deleteDoc(doc(db, collectionPath, docId));

// ─── Query helpers ────────────────────────────────────────────────────────────

export const fsGetCollection = async (collectionPath) => {
  const snap = await getDocs(collection(db, collectionPath));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const fsQueryWhere = async (collectionPath, field, operator, value) => {
  const q = query(collection(db, collectionPath), where(field, operator, value));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

// ─── Exported primitives ──────────────────────────────────────────────────────
// Re-exported so service files never import directly from 'firebase/firestore'.
// Swapping the backend only requires changes in this one file.

export { serverTimestamp, increment, db };

// ─── Sub-collection helpers ───────────────────────────────────────────────────

export const fsGetSubCollection = async (parentPath, parentId, subCollection) => {
  const path = `${parentPath}/${parentId}/${subCollection}`;
  const snap = await getDocs(collection(db, path));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const fsAddDocToSubCollection = (parentPath, parentId, subCollection, data) => {
  const path = `${parentPath}/${parentId}/${subCollection}`;
  return addDoc(collection(db, path), data);
};

export const fsDeleteSubCollectionDoc = (parentPath, parentId, subCollection, docId) => {
  const path = `${parentPath}/${parentId}/${subCollection}`;
  return deleteDoc(doc(db, path, docId));
};

export const fsQueryOrderBy = async (collectionPath, field, direction = 'asc') => {
  const q = query(collection(db, collectionPath), orderBy(field, direction));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

// ─── Firestore query helpers with ordering ────────────────────────────────────

/**
 * Query with a where clause AND an orderBy in one shot.
 * Used by getResultsByStudent to get results sorted by submittedAt desc
 * directly from Firestore — avoids fetching all docs and sorting on the client.
 */
export const fsQueryWhereOrderBy = async (
  collectionPath,
  field,
  operator,
  value,
  orderField,
  orderDir = 'asc',
) => {
  const q = query(
    collection(db, collectionPath),
    where(field, operator, value),
    orderBy(orderField, orderDir),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};
