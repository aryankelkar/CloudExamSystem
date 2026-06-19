// Firestore collection name constants
// Centralised so renaming never requires a project-wide search

export const COLLECTIONS = {
  USERS:            'users',
  EXAMS:            'exams',
  RESULTS:          'results',
  RESULTS_PENDING:  'results_pending',
  ANALYTICS_CACHE:  'analytics_cache',  // written by refreshAnalyticsCache Cloud Function
};

export const SUBCOLLECTIONS = {
  QUESTIONS: 'questions',
};
