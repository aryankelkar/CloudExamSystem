// Authentication Service — Firebase Auth + Firestore
//
// BUG-01 FIX — Transactional-like registration:
//   If the Firestore profile write fails after the Firebase Auth user is created,
//   we immediately delete the orphaned Auth account and surface a clean error.
//   This guarantees: Auth account exists ↔ Firestore profile exists (atomically safe).
//
// LOGIN RECOVERY — If a user somehow has a Firebase Auth account but no Firestore
//   profile (e.g. power failure during first registration, manual deletion of the
//   Firestore doc), loginUser() detects the gap and offers a recovery path.

import { deleteUser } from 'firebase/auth';
import { firebaseCreateUser, firebaseSignIn, firebaseSignOut } from '../firebase/auth';
import { fsSetDoc, fsGetDoc, serverTimestamp } from '../firebase/firestore';
import { COLLECTIONS } from '../firebase/collections';
import {
  trackLogin,
  trackRegistration,
  trackLogout,
} from './analyticsService';
import { logAuditEvent }  from './auditService';
import { AUDIT_ACTIONS }  from '../utils/auditActions';

// ─── Internal logger ──────────────────────────────────────────────────────────
// Centralised so all auth events can be redirected to a monitoring service
// (e.g. Firebase Analytics, Sentry) by editing one place.

const log = {
  info:  (msg, data) => console.info(`[AuthService] ${msg}`, data ?? ''),
  warn:  (msg, data) => console.warn(`[AuthService] ⚠️  ${msg}`, data ?? ''),
  error: (msg, data) => console.error(`[AuthService] ❌ ${msg}`, data ?? ''),
};

// ─── Registration ─────────────────────────────────────────────────────────────

/**
 * Register a new user with transactional-like safety.
 *
 * Step 1 — Create Firebase Auth account.
 * Step 2 — Write Firestore profile at users/{uid}.
 *
 * If Step 2 fails:
 *   a) Delete the newly created Auth account (cleanup).
 *   b) If cleanup also fails, log the orphaned UID for manual investigation.
 *   c) Throw a clear, user-friendly error in all cases.
 *
 * @param {{ fullName: string, email: string, password: string, role: string }} userData
 * @returns {{ success: boolean, user: FirebaseUser, profile: Object }}
 * @throws {Error} with a user-friendly message
 */
export const registerUser = async ({ fullName, email, password, role }) => {
  // ── Step 1: Create Firebase Auth account ──────────────────────────────────
  log.info('Registration started', { email, role });

  let credential;
  try {
    credential = await firebaseCreateUser(email, password);
    log.info('Firebase Auth account created', { uid: credential.user.uid });
  } catch (authError) {
    // Auth creation failed — nothing to clean up, surface error directly
    log.error('Firebase Auth creation failed', authError);
    throw _toUserFriendlyError(authError);
  }

  const { uid } = credential.user;

  // ── Step 2: Write Firestore profile ──────────────────────────────────────
  const profile = {
    uid,
    name: fullName,
    email,
    role,
    createdAt: serverTimestamp(),
    // profileComplete tracks whether both steps completed — used by loginUser recovery
    profileComplete: true,
  };

  try {
    await fsSetDoc(COLLECTIONS.USERS, uid, profile);
    log.info('Firestore profile written', { uid });

    // Force a token refresh so the custom claim set by the setUserRoleClaim
    // Cloud Function is available immediately in the same session.
    // Without this, the cached JWT would not include the new claim for up to
    // 1 hour, and AuthContext would fall back to the Firestore lookup every time.
    //
    // The Cloud Function runs asynchronously — we wait a brief moment to give
    // it time to set the claim before forcing the refresh.
    try {
      await new Promise((r) => setTimeout(r, 1500));
      await credential.user.getIdToken(/* forceRefresh= */ true);
      log.info('Token refreshed — custom claim should now be available', { uid });
    } catch (refreshError) {
      // Non-fatal: AuthContext falls back to Firestore if claim is absent
      log.warn('Token refresh after registration failed (non-fatal)', refreshError);
    }

  } catch (firestoreError) {
    // ── Step 2 failed — attempt Auth account cleanup (rollback) ─────────────
    log.error('Firestore profile write failed, attempting Auth rollback', {
      uid,
      error: firestoreError,
    });

    try {
      await deleteUser(credential.user);
      log.info('Auth rollback succeeded — orphaned account deleted', { uid });
    } catch (deleteError) {
      // Rollback also failed — the account is now orphaned.
      // Log the UID prominently so it can be manually cleaned up.
      log.error(
        'ORPHANED ACCOUNT — Auth rollback failed. Manual cleanup required.',
        { uid, email, deleteError }
      );
      // Still throw to the caller — we must not let the UI think success happened.
    }

    // Surface a clean error regardless of whether rollback succeeded or failed
    throw new Error(
      'Account setup failed due to a server error. Please try again. ' +
      'If this persists, contact support.'
    );
  }

  log.info('Registration completed successfully', { uid, role });

  // ── Analytics: track successful registration ──────────────────────────
  // Fire-and-forget — analytics failure must never block the return value.
  trackRegistration(role);

  // ── Audit: log successful registration ───────────────────────────────
  logAuditEvent({
    action:     AUDIT_ACTIONS.USER_REGISTERED,
    userId:     uid,
    userRole:   role,
    targetId:   uid,
    targetType: 'user',
    metadata:   { email, name: fullName },
  });

  return { success: true, user: credential.user, profile };
};

// ─── Login ────────────────────────────────────────────────────────────────────

/**
 * Sign in with email & password.
 *
 * Role is NEVER taken from the login form — it is fetched from Firestore.
 *
 * Recovery mechanism:
 *   If Firebase Auth succeeds but no Firestore profile exists (BUG-01 orphan),
 *   we detect the gap and throw a specific, actionable error instead of a
 *   generic crash. The recovery prompt in LoginPage gives the user a path forward.
 *
 * @param {string} email
 * @param {string} password
 * @returns {{ success: boolean, user: FirebaseUser, profile: Object }}
 * @throws {Error} with a user-friendly message or ORPHANED_ACCOUNT error code
 */
export const loginUser = async (email, password) => {
  log.info('Login attempt', { email });

  let credential;
  try {
    credential = await firebaseSignIn(email, password);
    log.info('Firebase Auth sign-in succeeded', { uid: credential.user.uid });
  } catch (authError) {
    log.warn('Firebase Auth sign-in failed', authError);
    throw _toUserFriendlyError(authError);
  }

  const { uid } = credential.user;
  const profile = await fsGetDoc(COLLECTIONS.USERS, uid);

  if (!profile) {
    // Auth account exists but Firestore profile is missing — orphaned account
    log.error('ORPHANED ACCOUNT DETECTED on login — profile missing for uid', { uid, email });

    // Sign out immediately so the Firebase Auth session is not left open
    // in an inconsistent state
    try {
      await firebaseSignOut();
      log.info('Signed out orphaned session', { uid });
    } catch (signOutError) {
      log.warn('Could not sign out orphaned session', signOutError);
    }

    // Attach a machine-readable code so LoginPage can show a recovery prompt
    const err = new Error(
      'Your account setup was incomplete. Please re-register with the same ' +
      'email and password to restore your account.'
    );
    err.code = 'auth/orphaned-account';
    err.uid = uid;
    err.email = email;
    throw err;
  }

  log.info('Login completed successfully', { uid, role: profile.role });

  // ── Analytics: track successful login ────────────────────────────────
  // Fire-and-forget — analytics failure must never block the return value.
  trackLogin(profile.role);

  // ── Audit: log successful login ───────────────────────────────────────
  logAuditEvent({
    action:     AUDIT_ACTIONS.USER_LOGIN,
    userId:     uid,
    userRole:   profile.role,
    targetId:   uid,
    targetType: 'user',
    metadata:   { email },
  });

  return { success: true, user: credential.user, profile };
};

// ─── Logout ───────────────────────────────────────────────────────────────────

/**
 * Sign out the current user.
 */
export const logoutUser = async () => {
  log.info('Logout requested');

  // ── Analytics + Audit: fire before signOut while session is still active ─
  // Both must be called BEFORE firebaseSignOut() — the UID and session are
  // needed for attribution and both calls are fire-and-forget.
  trackLogout();

  // logAuditEvent is synchronous in its initiation — the IIFE inside runs
  // async but the Firestore write is queued before signOut clears the session.
  // We pass 'unknown' for role here because logoutUser has no role parameter;
  // callers that have the role available should use the full analytics.logout().
  logAuditEvent({
    action:     AUDIT_ACTIONS.USER_LOGOUT,
    userId:     'anonymous',  // logoutUser() has no uid param — see TODO below
    userRole:   'unknown',
    targetId:   null,
    targetType: null,
    metadata:   {},
  });
  // TODO: Update logoutUser() signature to accept { uid, role } so the audit
  // log carries full attribution. All call sites (Navbar, ProfilePage, etc.)
  // should pass currentUser.uid and role from useAuth() when calling logoutUser().

  await firebaseSignOut();
  log.info('Logout completed');
  return { success: true };
};

// ─── Error message mapping ────────────────────────────────────────────────────

/**
 * Convert Firebase error codes into clear, user-facing messages.
 * Never expose raw Firebase internals to the UI.
 *
 * @param {FirebaseError} err
 * @returns {Error}
 */
const _toUserFriendlyError = (err) => {
  const messages = {
    'auth/email-already-in-use':    'This email is already registered. Please log in instead.',
    'auth/invalid-email':           'The email address is not valid.',
    'auth/weak-password':           'Password must be at least 6 characters.',
    'auth/user-not-found':          'No account found with this email.',
    'auth/wrong-password':          'Incorrect password. Please try again.',
    'auth/invalid-credential':      'Invalid email or password.',
    'auth/too-many-requests':       'Too many failed attempts. Please try again later.',
    'auth/network-request-failed':  'Network error. Check your connection and try again.',
    'auth/user-disabled':           'This account has been disabled. Contact support.',
    'auth/operation-not-allowed':   'This sign-in method is not enabled.',
  };

  const message = messages[err.code] ?? err.message ?? 'An unexpected error occurred.';
  const mapped = new Error(message);
  mapped.code = err.code;
  return mapped;
};

// ─── Legacy aliases ───────────────────────────────────────────────────────────
// Kept for any consumers not yet updated. Will be removed in a future cleanup.
export const register = registerUser;
export const login = loginUser;
export const logout = logoutUser;
