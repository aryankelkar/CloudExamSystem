/**
 * constants.js — shared constants for Cloud Functions
 */

// Must match frontend/src/utils/constants.js PASS_THRESHOLD
const PASS_THRESHOLD = 50; // percentage

const COLLECTIONS = {
  USERS:           'users',
  EXAMS:           'exams',
  RESULTS:         'results',
  RESULTS_PENDING: 'results_pending',
};

const SUBCOLLECTIONS = {
  QUESTIONS: 'questions',
};

const EXAM_STATUS = {
  UPCOMING:  'upcoming',
  ACTIVE:    'active',
  COMPLETED: 'completed',
};

module.exports = {
  PASS_THRESHOLD,
  COLLECTIONS,
  SUBCOLLECTIONS,
  EXAM_STATUS,
};
