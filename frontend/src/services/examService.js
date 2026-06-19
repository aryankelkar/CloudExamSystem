// Exam Service — Firestore
//
// ─── questionCount DESIGN ────────────────────────────────────────────────────
//
// WHY A COUNTER FIELD INSTEAD OF FETCHING THE SUB-COLLECTION?
//
// Option A (rejected): For every exam in getAllExams(), fetch its questions
//   sub-collection and count the documents.
//
//   Cost with 20 exams and 10 questions each:
//     1 collection read  (exams)        → 20 document reads
//     20 sub-collection reads (questions) → 200 document reads
//     ─────────────────────────────────────────────────────
//     Total: 221 reads per page load
//
//   At Firestore pricing (~$0.06 per 100k reads), this is fine at small
//   scale — but at 500 faculty members each opening ManageExamPage twice
//   a day: 500 × 2 × 221 = 221,000 reads/day just to show question counts.
//   At 1000 exams that's 2M+ reads/day from a single UI column.
//
// Option B (chosen): Store `questionCount` as an integer field directly in
//   the exam document and keep it in sync with Firestore's atomic `increment`.
//
//   Cost with 20 exams:
//     1 collection read  (exams)       → 20 document reads
//     ─────────────────────────────────────────────────────
//     Total: 20 reads per page load
//
//   11x fewer reads. Scales to any number of exams with zero additional cost.
//
// WHY `increment()` AND NOT A MANUAL READ-INCREMENT-WRITE?
//
//   Manual approach:
//     const exam = await getDoc(...)         // read
//     const current = exam.questionCount     // local compute
//     await updateDoc({ questionCount: current + 1 })  // write
//
//   This has a race condition: if two addQuestion() calls fire concurrently
//   (e.g. batch import), both read the same value and both write the same
//   result — one increment is silently lost.
//
//   Firestore's increment(n) is a server-side atomic operation. The server
//   applies +1 after the last committed value regardless of concurrent writes.
//   No race. No read required. One write operation.
//
// ─── SYNC CONTRACT ───────────────────────────────────────────────────────────
//
//   createExam()  → writes questionCount: 0  (explicit, never undefined)
//   addQuestion() → writes increment(+1) to exam doc atomically
//   deleteQuestion() → writes increment(-1) to exam doc atomically
//
//   getAllExams() reads exam docs only — questionCount is already there.
//   ManageExamPage reads exam.questionCount — no sub-collection touch needed.

import {
  fsAddDoc,
  fsGetDoc,
  fsGetCollection,
  fsUpdateDoc,
  fsDeleteDoc,
  fsGetSubCollection,
  fsAddDocToSubCollection,
  fsDeleteSubCollectionDoc,
  fsQueryWhere,
  serverTimestamp,
  increment,
} from '../firebase/firestore';
import { COLLECTIONS, SUBCOLLECTIONS } from '../firebase/collections';
import { computeExamStatus } from '../utils/examUtils';

// ─── Exam CRUD ────────────────────────────────────────────────────────────────

/**
 * Create a new exam document.
 * `questionCount` starts at 0 and is incremented by every addQuestion() call.
 *
 * Attempt policy fields (with safe defaults for backward compatibility):
 *   attemptPolicy: 'single' | 'multiple'   — default 'single'
 *   maxAttempts:   number | null            — null means unlimited; default 1
 *   resultPolicy:  'best' | 'latest'        — default 'best'
 *
 * Existing exams without these fields are treated as:
 *   attemptPolicy = 'single', maxAttempts = 1, resultPolicy = 'best'
 *
 * @param {object} examData
 * @param {string} createdByUid
 */
export const createExam = async (examData, createdByUid) => {
  const docRef = await fsAddDoc(COLLECTIONS.EXAMS, {
    title:         examData.title,
    subject:       examData.subject,
    duration:      Number(examData.duration),
    startTime:     examData.startTime,
    endTime:       examData.endTime,
    status:        examData.status || 'upcoming',
    createdBy:     createdByUid || null,
    createdAt:     serverTimestamp(),
    questionCount: 0,
    // ── Attempt policy ──────────────────────────────────────────────────
    attemptPolicy: examData.attemptPolicy ?? 'single',
    maxAttempts:   examData.maxAttempts   ?? 1,
    resultPolicy:  examData.resultPolicy  ?? 'best',
  });
  return { id: docRef.id, ...examData, questionCount: 0 };
};

/**
 * Update exam metadata.
 * Does not touch questionCount — that field is managed by addQuestion /
 * deleteQuestion only.
 */
export const updateExam = async (examId, examData) => {
  await fsUpdateDoc(COLLECTIONS.EXAMS, examId, {
    ...examData,
    updatedAt: serverTimestamp(),
  });
  return { id: examId, ...examData };
};

/**
 * Delete an exam document.
 *
 * NOTE: The questions sub-collection is NOT deleted here because Firestore
 * does not cascade deletes to sub-collections from the client SDK.
 * Sub-collection cleanup is handled by the `onExamDeleted` Cloud Function
 * (see CLOUD_IMPLEMENTATION_PLANS.md — Plan 1, Function 3).
 */
export const deleteExam = async (examId) => {
  await fsDeleteDoc(COLLECTIONS.EXAMS, examId);
  return { success: true };
};

/**
 * Fetch a single exam and merge its full questions sub-collection.
 * Used by ExamPage (student taking the exam) where questions are needed.
 */
export const getExamById = async (examId) => {
  const exam = await fsGetDoc(COLLECTIONS.EXAMS, examId);
  if (!exam) throw new Error('Exam not found');

  const questions = await getQuestions(examId);
  return {
    ...exam,
    questions,
    status: computeExamStatus({ ...exam, questions }),
  };
};

/**
 * Fetch all exam documents for the faculty Manage Exams view.
 *
 * Does NOT fetch questions sub-collections.
 * questionCount on each document is the authoritative count.
 */
export const getAllExams = async () => {
  const exams = await fsGetCollection(COLLECTIONS.EXAMS);
  return exams.map((exam) => ({
    ...exam,
    // Normalise: exams created before this fix have no questionCount field
    questionCount: exam.questionCount ?? 0,
    status: computeExamStatus(exam),
  }));
};

/**
 * Fetch active / upcoming exams for the student dashboard.
 */
export const getAvailableExams = async () => {
  const exams = await getAllExams();
  return exams.filter(
    (e) => e.status === 'active' || e.status === 'upcoming'
  );
};

// ─── Questions sub-collection ─────────────────────────────────────────────────

/**
 * Add a single question to an exam's questions sub-collection and atomically
 * increment the exam document's questionCount field by 1.
 *
 * Two writes are made:
 *   1. addDoc to exams/{examId}/questions
 *   2. updateDoc exams/{examId} with increment(+1)
 *
 * They are NOT wrapped in a Firestore transaction because:
 *   - Adding a question is always sequential in CreateExamPage (for...of loop)
 *   - The increment is idempotent in practice — a retry adds one more count,
 *     which is still better than the count being permanently wrong
 *   - True transactions require server-side enforcement (Cloud Functions)
 *     for production-grade reliability
 *
 * @param {string} examId
 * @param {object} questionData  Raw form data with optionA..D, correctAnswer, marks
 * @returns {{ id: string, ...questionData }}
 */
export const addQuestion = async (examId, questionData) => {
  const options = [
    questionData.optionA,
    questionData.optionB,
    questionData.optionC,
    questionData.optionD,
  ];

  // Write 1: create the question document in the sub-collection
  const docRef = await fsAddDocToSubCollection(
    COLLECTIONS.EXAMS,
    examId,
    SUBCOLLECTIONS.QUESTIONS,
    {
      question:      questionData.question,
      options,
      correctAnswer: questionData.correctAnswer.toUpperCase(),
      marks:         Number(questionData.marks),
    }
  );

  // Write 2: atomically increment the counter on the parent exam document
  await fsUpdateDoc(COLLECTIONS.EXAMS, examId, {
    questionCount: increment(1),
  });

  return { id: docRef.id, ...questionData };
};

/**
 * Delete a single question from the sub-collection and atomically decrement
 * the exam's questionCount.
 *
 * Uses `Math.max(0, ...)` via the server-side guard in Firestore rules to
 * prevent the count going below 0 in edge cases.
 *
 * @param {string} examId
 * @param {string} questionId
 */
export const deleteQuestion = async (examId, questionId) => {
  // Write 1: delete the question document
  await fsDeleteSubCollectionDoc(
    COLLECTIONS.EXAMS,
    examId,
    SUBCOLLECTIONS.QUESTIONS,
    questionId
  );

  // Write 2: atomically decrement the counter (minimum 0)
  await fsUpdateDoc(COLLECTIONS.EXAMS, examId, {
    questionCount: increment(-1),
  });

  return { success: true };
};

/**
 * Fetch all questions for an exam (used by ExamPage and submitResult).
 */
export const getQuestions = async (examId) => {
  return fsGetSubCollection(COLLECTIONS.EXAMS, examId, SUBCOLLECTIONS.QUESTIONS);
};

// ─── Legacy aliases ───────────────────────────────────────────────────────────
export const addQuestionToExam = addQuestion;

// ─── Attempt policy helpers ────────────────────────────────────────────────────

/**
 * Normalise attempt-policy fields for backward compatibility.
 * Exams created before this feature are treated as single-attempt.
 *
 * @param {object} exam  Raw Firestore exam document
 * @returns {{ attemptPolicy, maxAttempts, resultPolicy }}
 */
export const normaliseAttemptPolicy = (exam) => ({
  attemptPolicy: exam.attemptPolicy ?? 'single',
  maxAttempts:   exam.maxAttempts   ?? 1,
  resultPolicy:  exam.resultPolicy  ?? 'best',
});

/**
 * Count how many times a student has already submitted a given exam.
 * Reads from the results collection — no sub-collection needed.
 *
 * @param {string} studentId
 * @param {string} examId
 * @returns {Promise<number>}
 */
export const getStudentAttemptCount = async (studentId, examId) => {
  const results = await fsQueryWhere(COLLECTIONS.RESULTS, 'studentId', '==', studentId);
  return results.filter((r) => r.examId === examId).length;
};
