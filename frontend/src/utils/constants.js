// Application-wide constants

export const ROLES = {
  STUDENT: 'student',
  FACULTY: 'faculty',
};

export const EXAM_STATUS = {
  ACTIVE: 'active',
  UPCOMING: 'upcoming',
  COMPLETED: 'completed',
};

export const RESULT_STATUS = {
  PASS: 'pass',
  FAIL: 'fail',
};

export const PASS_THRESHOLD = 50; // percent

// Cloud architecture readiness flags — set to true when the real service is wired up
export const CLOUD_FEATURES = {
  CLOUD_FUNCTIONS_ENABLED: true,   // evaluateExam, setUserRoleClaim, deleteExamCascade
  // Set BIGQUERY_ENABLED = true after:
  //   1. Firebase → BigQuery export is active (Firebase Console → Integrations)
  //   2. refreshAnalyticsCache Cloud Function is deployed and has run at least once
  //      (analytics_cache Firestore documents must exist with data != null)
  //   3. BQ_DATASET env var is set in Cloud Functions config
  BIGQUERY_ENABLED: false,
  CLOUD_SCHEDULER_ENABLED: false,  // set true after Cloud Scheduler is configured
  CLOUD_STORAGE_ENABLED: false,
  LOOKER_STUDIO_ENABLED: false,
};

export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  STUDENT: '/student',
  STUDENT_EXAMS: '/student/exams',
  STUDENT_RESULTS: '/student/results',
  STUDENT_PROFILE: '/student/profile',
  FACULTY: '/faculty',
  FACULTY_CREATE_EXAM: '/faculty/create-exam',
  FACULTY_MANAGE_EXAMS: '/faculty/manage-exams',
  FACULTY_RESULTS: '/faculty/results',
  FACULTY_ANALYTICS: '/faculty/analytics',
  FACULTY_PROFILE: '/faculty/profile',
  EXAM: '/exam/:id',
  RESULT: '/result/:id',
};
