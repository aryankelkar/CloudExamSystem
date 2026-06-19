/**
 * ProtectedRoute.jsx
 *
 * ─── DECISION TREE ────────────────────────────────────────────────────────────
 *
 *  loading === true
 *    └─ Render <LoadingSpinner> — auth state is not yet known.
 *       NEVER make a routing decision while loading.
 *
 *  loading === false, currentUser === null
 *    └─ Redirect to /login — not authenticated.
 *
 *  loading === false, currentUser set, profileError set
 *    └─ Render an inline error — authenticated but profile unreadable.
 *       We do NOT redirect to /login because the user IS authenticated.
 *       Redirecting would create a confusing loop (Firebase auto-restores
 *       the session, which triggers the Firestore read again, which fails
 *       again, which redirects again…).
 *
 *  loading === false, currentUser set, role === null, no profileError
 *    └─ This means the Firestore profile exists but has no role field.
 *       Treat as a profile configuration error and show a message.
 *
 *  loading === false, currentUser set, role set, requiredRole provided,
 *  role !== requiredRole
 *    └─ Redirect to the user's own correct dashboard.
 *       e.g. a student hitting /faculty/* → sent to /student.
 *
 *  loading === false, currentUser set, role set, role matches requiredRole
 *  (or no requiredRole required)
 *    └─ Render children — access granted.
 *
 * ─── BUG-02 FIX ───────────────────────────────────────────────────────────────
 *
 * The previous implementation read `loading` from AuthContext but that flag
 * was set to false BEFORE the Firestore profile read completed (in some React
 * batching scenarios) because three separate setState calls were used:
 *
 *   setCurrentUser(user)   ← render 1: user set, role still null
 *   setRole(profile.role)  ← render 2: both set
 *   setLoading(false)      ← render 3: loading cleared
 *
 * Between render 1 and render 2, ProtectedRoute saw:
 *   currentUser !== null (authenticated)
 *   role === null        (no role yet)
 *   requiredRole = 'faculty'
 *   → role !== requiredRole → redirect to /student ← WRONG
 *
 * The fix in AuthContext.jsx merges all four values into a SINGLE setState call,
 * so the race window no longer exists.  ProtectedRoute here adds a secondary
 * guard: it will never redirect based on role while role is null and there is
 * no profileError — it waits and shows a spinner instead.
 */

import React from 'react';
import { Navigate } from 'react-router-dom';
import { Box, Typography, Button } from '@mui/material';
import { ErrorOutline } from '@mui/icons-material';
import useAuth from '../hooks/useAuth';
import LoadingSpinner from './LoadingSpinner';
import { ROLES } from '../utils/constants';

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Guards a route by authentication and optional role.
 *
 * @param {object}  props
 * @param {React.ReactNode} props.children    - Page to render when access is granted
 * @param {'student'|'faculty'} [props.requiredRole]
 *   When omitted, any authenticated user may access the route.
 */
const ProtectedRoute = ({ children, requiredRole }) => {
  const { currentUser, role, loading, profileError } = useAuth();

  // ── 1. Auth state is not yet resolved — wait ──────────────────────────────
  // loading stays true until BOTH onAuthStateChanged AND the Firestore read
  // are done.  Never route-switch until the full picture is available.
  if (loading) {
    return <LoadingSpinner message="Verifying session…" />;
  }

  // ── 2. Not authenticated ──────────────────────────────────────────────────
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  // ── 3. Authenticated but Firestore profile read failed ───────────────────
  // The user has a valid Firebase Auth session but we could not read their
  // Firestore profile (network error, Firestore rules, etc.).
  // Show a recoverable error state — do NOT redirect to /login.
  if (profileError) {
    return (
      <ProfileErrorState
        message="Could not load your profile. Please check your connection and try again."
        onRetry={() => window.location.reload()}
      />
    );
  }

  // ── 4. Authenticated but role field is missing from the profile ──────────
  // Profile document exists but role field is absent — data integrity issue.
  // (Different from profileError — the read succeeded but data is malformed.)
  if (currentUser && !role) {
    return (
      <ProfileErrorState
        message="Your account profile is incomplete. Please contact support."
        onRetry={null}
      />
    );
  }

  // ── 5. Role-based access enforcement ─────────────────────────────────────
  // At this point: currentUser is set, role is set, loading is false.
  // Safe to compare roles and redirect if needed.
  if (requiredRole && role !== requiredRole) {
    const redirect = role === ROLES.FACULTY ? '/faculty' : '/student';
    return <Navigate to={redirect} replace />;
  }

  // ── 6. Access granted ─────────────────────────────────────────────────────
  return children;
};

// ─── Profile error state ──────────────────────────────────────────────────────

/**
 * Shown when the user is authenticated but their Firestore profile could not
 * be loaded or is incomplete.  Full-viewport, centred layout.
 */
const ProfileErrorState = ({ message, onRetry }) => (
  <Box
    sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      gap: 2,
      px: 2,
      textAlign: 'center',
    }}
  >
    <ErrorOutline sx={{ fontSize: 56, color: 'warning.main' }} />
    <Typography variant="h6" fontWeight="bold">
      Profile Unavailable
    </Typography>
    <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 360 }}>
      {message}
    </Typography>
    {onRetry && (
      <Button variant="contained" onClick={onRetry}>
        Retry
      </Button>
    )}
  </Box>
);

export default ProtectedRoute;
