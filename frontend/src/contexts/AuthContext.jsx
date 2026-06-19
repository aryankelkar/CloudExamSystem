/**
 * AuthContext.jsx
 *
 * ─── CUSTOM CLAIMS ARCHITECTURE ──────────────────────────────────────────────
 *
 * Role is now read from Firebase Auth custom claims instead of a Firestore lookup:
 *
 *   Old flow:
 *     onAuthStateChanged → getDoc(users/{uid}) → extract role
 *     = 1 Firestore read on every page load / refresh
 *
 *   New flow:
 *     onAuthStateChanged → user.getIdTokenResult() → claims.role
 *     = 0 Firestore reads for role resolution
 *     = Role is signed into the JWT — tamper-proof
 *
 * The setUserRoleClaim Cloud Function sets the custom claim when a users
 * document is created.  On first registration, we force a token refresh
 * (getIdToken(true)) after the profile is written to make the claim
 * available immediately without waiting for the 1-hour token cache to expire.
 *
 * Backward compatibility:
 *   If claims.role is null (sessions created before custom claims were
 *   introduced, or the Cloud Function hasn't run yet), the code falls back
 *   to a Firestore profile read.  This ensures a seamless migration.
 *
 * ─── LOADING STATE CONTRACT ────────────────────────────────────────────────────
 *
 * `loading` stays TRUE until BOTH of these complete:
 *   1. onAuthStateChanged has fired for the first time
 *   2. If a session exists, getIdTokenResult() AND any fallback Firestore read
 *      have settled
 *
 * loading === true   → render nothing meaningful
 * loading === false  → currentUser, role, userProfile are ALL stable
 *
 * ─── STATE TRANSITIONS ────────────────────────────────────────────────────────
 *
 *  Case A — no existing session:
 *    loading=false, currentUser=null, role=null, userProfile=null
 *
 *  Case B — session found, claim exists:
 *    loading=false, currentUser=<User>, role='student'|'faculty',
 *    userProfile=null (Firestore profile only loaded when needed)
 *
 *  Case C — session found, no claim yet (backward compat / first login):
 *    Falls back to Firestore read → same final state as B if profile exists
 *
 *  Case D — session found, Firestore fallback also fails:
 *    loading=false, currentUser=<User>, role=null, profileError=<Error>
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';
import { firebaseOnAuthStateChanged } from '../firebase/auth';
import { fsGetDoc } from '../firebase/firestore';
import { COLLECTIONS } from '../firebase/collections';

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext(null);

// ─── Initial state ────────────────────────────────────────────────────────────

const INITIAL_STATE = {
  currentUser:  null,
  role:         null,
  userProfile:  null,
  loading:      true,
  profileError: null,
};

// ─── Provider ─────────────────────────────────────────────────────────────────

export const AuthProvider = ({ children }) => {
  const [authState, setAuthState] = useState(INITIAL_STATE);

  /**
   * Atomic state update — called exactly once per auth event to prevent
   * intermediate render states (see original BUG-02 explanation).
   */
  const setResolved = useCallback((partial) => {
    setAuthState((prev) => ({ ...prev, ...partial, loading: false }));
  }, []);

  useEffect(() => {
    const unsubscribe = firebaseOnAuthStateChanged(async (firebaseUser) => {

      // ── Case A: No session ────────────────────────────────────────────
      if (!firebaseUser) {
        setResolved({
          currentUser:  null,
          role:         null,
          userProfile:  null,
          profileError: null,
        });
        return;
      }

      // ── Session exists: resolve role ──────────────────────────────────
      try {
        // Step 1: Try to get role from custom claim (Phase 2 architecture).
        // forceRefresh=false uses the cached token — fast, no network call.
        const tokenResult = await firebaseUser.getIdTokenResult(false);
        const claimsRole  = tokenResult.claims?.role ?? null;

        if (claimsRole) {
          // ── Case B: Claim is present — no Firestore read needed ────────
          setResolved({
            currentUser:  firebaseUser,
            role:         claimsRole,
            // userProfile lazily loaded — components that need the full
            // profile (e.g. ProfilePage) fetch it themselves via the service.
            // This keeps the auth bootstrap fast.
            userProfile:  null,
            profileError: null,
          });
          return;
        }

        // ── Case C: No claim yet — fall back to Firestore lookup ──────────
        // This covers:
        //   a) Sessions created before custom claims were introduced
        //   b) The setUserRoleClaim Cloud Function hasn't run yet
        //      (there's a brief delay between user creation and claim propagation)
        console.info(
          '[AuthContext] No role claim found, falling back to Firestore profile lookup.',
          { uid: firebaseUser.uid }
        );

        const profile = await fsGetDoc(COLLECTIONS.USERS, firebaseUser.uid);

        setResolved({
          currentUser:  firebaseUser,
          role:         profile?.role ?? null,
          userProfile:  profile ?? null,
          profileError: null,
        });

      } catch (err) {
        // ── Case D: Both claim read and Firestore read failed ─────────────
        console.error('[AuthContext] Failed to resolve user role:', err);

        setResolved({
          currentUser:  firebaseUser,
          role:         null,
          userProfile:  null,
          profileError: err,
        });
      }
    });

    return unsubscribe;
  }, [setResolved]);

  return (
    <AuthContext.Provider value={authState}>
      {children}
    </AuthContext.Provider>
  );
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useAuthContext = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuthContext must be used inside <AuthProvider>');
  }
  return ctx;
};

export default AuthContext;
