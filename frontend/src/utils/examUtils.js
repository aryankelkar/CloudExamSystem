import { EXAM_STATUS } from './constants';

/**
 * Determine the live status of an exam based on current time.
 * Falls back to the stored status field when times are unavailable.
 */
export const computeExamStatus = (exam) => {
  if (!exam.startTime || !exam.endTime) return exam.status || EXAM_STATUS.UPCOMING;

  const now = new Date();
  const start = exam.startTime?.toDate ? exam.startTime.toDate() : new Date(exam.startTime);
  const end = exam.endTime?.toDate ? exam.endTime.toDate() : new Date(exam.endTime);

  if (now < start) return EXAM_STATUS.UPCOMING;
  if (now >= start && now <= end) return EXAM_STATUS.ACTIVE;
  return EXAM_STATUS.COMPLETED;
};

/**
 * Format a Firestore Timestamp or ISO string to a human-readable string.
 */
export const formatExamDate = (timestamp) => {
  if (!timestamp) return 'Not set';
  const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleString();
};

/**
 * Map raw Firestore question options stored as an array back to the
 * labelled format the ExamPage expects: ['A) Option text', ...]
 */
export const formatOptions = (options = []) => {
  const labels = ['A', 'B', 'C', 'D'];
  return options.map((opt, i) => `${labels[i]}) ${opt}`);
};

/**
 * Validate that an exam form has all required fields.
 * Returns null on success or an error message string.
 */
export const validateExamForm = (examData) => {
  if (!examData.title?.trim()) return 'Exam title is required';
  if (!examData.subject?.trim()) return 'Subject is required';
  if (!examData.duration || Number(examData.duration) <= 0) return 'Duration must be a positive number';
  if (!examData.startTime) return 'Start time is required';
  if (!examData.endTime) return 'End time is required';

  const start = new Date(examData.startTime);
  const end = new Date(examData.endTime);
  if (end <= start) return 'End time must be after start time';

  return null;
};

/**
 * Validate a single MCQ question object.
 * Returns null on success or an error message string.
 */
export const validateQuestion = (q) => {
  if (!q.question?.trim()) return 'Question text is required';
  if (!q.optionA?.trim() || !q.optionB?.trim() || !q.optionC?.trim() || !q.optionD?.trim())
    return 'All four options are required';
  if (!['A', 'B', 'C', 'D'].includes(q.correctAnswer?.toUpperCase()))
    return 'Correct answer must be A, B, C, or D';
  if (!q.marks || Number(q.marks) <= 0) return 'Marks must be a positive number';
  return null;
};
