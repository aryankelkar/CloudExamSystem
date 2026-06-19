import React from 'react';
import { Routes, Route } from 'react-router-dom';
import ProtectedRoute from '../components/ProtectedRoute';
import { ROLES } from '../utils/constants';
import useAuth from '../hooks/useAuth';

// Public Pages
import LandingPage from '../pages/LandingPage';
import LoginPage from '../pages/LoginPage';
import RegisterPage from '../pages/RegisterPage';
import NotFoundPage from '../pages/NotFoundPage';

// Layouts
import StudentLayout from '../layouts/StudentLayout';
import FacultyLayout from '../layouts/FacultyLayout';

// Student Pages
import StudentDashboard from '../pages/StudentDashboard';
import AvailableExamsPage from '../pages/AvailableExamsPage';
import ExamPage from '../pages/ExamPage';
import ResultPage from '../pages/ResultPage';
import ProfilePage from '../pages/ProfilePage';

// Faculty Pages
import FacultyDashboard from '../pages/FacultyDashboard';
import CreateExamPage from '../pages/CreateExamPage';
import ManageExamPage from '../pages/ManageExamPage';
import EditExamPage from '../pages/EditExamPage';
import ViewExamPage from '../pages/ViewExamPage';
import AnalyticsPage from '../pages/AnalyticsPage';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const StudentRoute = ({ children }) => (
  <ProtectedRoute requiredRole={ROLES.STUDENT}>
    <StudentLayout>{children}</StudentLayout>
  </ProtectedRoute>
);

const FacultyRoute = ({ children }) => (
  <ProtectedRoute requiredRole={ROLES.FACULTY}>
    <FacultyLayout>{children}</FacultyLayout>
  </ProtectedRoute>
);

/**
 * RoleLayout — picks StudentLayout or FacultyLayout based on the current
 * user's role. Used for routes accessible by both roles (e.g. /result/:id)
 * so each role sees their own sidebar and navigation, not the student shell.
 */
const RoleLayout = ({ children }) => {
  // useAuth is called here; this component always renders inside AuthProvider.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { role } = useAuth();
  return role === ROLES.FACULTY
    ? <FacultyLayout>{children}</FacultyLayout>
    : <StudentLayout>{children}</StudentLayout>;
};

// ─── Routes ───────────────────────────────────────────────────────────────────

const AppRoutes = () => (
  <Routes>
    {/* Public */}
    <Route path="/" element={<LandingPage />} />
    <Route path="/login" element={<LoginPage />} />
    <Route path="/register" element={<RegisterPage />} />

    {/* Student */}
    <Route path="/student" element={<StudentRoute><StudentDashboard /></StudentRoute>} />
    <Route path="/student/exams" element={<StudentRoute><AvailableExamsPage /></StudentRoute>} />
    <Route path="/student/results" element={<StudentRoute><ResultPage /></StudentRoute>} />
    <Route path="/student/profile" element={<StudentRoute><ProfilePage /></StudentRoute>} />

    {/* Faculty */}
    <Route path="/faculty" element={<FacultyRoute><FacultyDashboard /></FacultyRoute>} />
    <Route path="/faculty/create-exam" element={<FacultyRoute><CreateExamPage /></FacultyRoute>} />
    <Route path="/faculty/manage-exams" element={<FacultyRoute><ManageExamPage /></FacultyRoute>} />
    <Route path="/faculty/edit-exam/:examId" element={<FacultyRoute><EditExamPage /></FacultyRoute>} />
    <Route path="/faculty/view-exam/:examId" element={<FacultyRoute><ViewExamPage /></FacultyRoute>} />
    <Route path="/faculty/results" element={<FacultyRoute><ResultPage /></FacultyRoute>} />
    <Route path="/faculty/analytics" element={<FacultyRoute><AnalyticsPage /></FacultyRoute>} />
  
    <Route path="/faculty/profile" element={<FacultyRoute><ProfilePage /></FacultyRoute>} />

    {/* Exam — student only */}
    <Route
      path="/exam/:id"
      element={
        <ProtectedRoute requiredRole={ROLES.STUDENT}>
          <StudentLayout><ExamPage /></StudentLayout>
        </ProtectedRoute>
      }
    />

    {/* Single result — any authenticated user.
        Layout is chosen based on the user's role so faculty see FacultyLayout
        and students see StudentLayout. ProtectedRoute (no requiredRole) allows
        both roles through; the layout wrapper handles the visual shell. */}
    <Route
      path="/result/:id"
      element={
        <ProtectedRoute>
          <RoleLayout><ResultPage /></RoleLayout>
        </ProtectedRoute>
      }
    />

    {/* 404 */}
    <Route path="*" element={<NotFoundPage />} />
  </Routes>
);

export default AppRoutes;
