/**
 * firebase.js — Firebase application initialisation
 *
 * ─── ANALYTICS CRASH — ROOT CAUSE ────────────────────────────────────────────
 *
 * The original code called getAnalytics(app) unconditionally at module load
 * time, as a top-level statement:
 *
 *   export const analytics = getAnalytics(app);   // ← throws synchronously
 *
 * getAnalytics() throws (does not return null, does not warn — throws) in
 * any of these three situations:
 *
 *   1. measurementId is absent from the Firebase config.
 *      Firebase Analytics requires a measurementId (the G-XXXXXXXX value
 *      from Google Analytics). If REACT_APP_FIREBASE_MEASUREMENT_ID is
 *      missing from the .env file, the config object has no measurementId
 *      field and getAnalytics() throws immediately.
 *
 *   2. The browser blocks third-party cookies / localStorage.
 *      Safari ITP, Firefox ETP, and some Chrome extensions prevent
 *      Firebase Analytics from initialising. getAnalytics() detects this
 *      and throws.
 *
 *   3. The page is not served over HTTPS (or localhost).
 *      Analytics requires a secure context. Plain HTTP deployments throw.
 *
 * Because this is a top-level module statement, the throw propagates out of
 * the module evaluation entirely. React never gets to mount. The result is
 * a blank white screen with a JavaScript error in the console — the most
 * severe possible failure mode, caused by a non-critical feature (analytics).
 *
 * ─── THE FIX ─────────────────────────────────────────────────────────────────
 *
 * Firebase provides isSupported() — an async function that resolves to true
 * or false based on whether the current environment can run Analytics.
 * It checks browser APIs, cookie policies, and HTTPS — all the things that
 * can cause getAnalytics() to throw.
 *
 * The fix:
 *   1. Call isSupported() first (async, awaited).
 *   2. Only call getAnalytics() if isSupported() resolves to true AND
 *      measurementId is present in the config.
 *   3. Export a Promise<Analytics|null> instead of Analytics|null, so
 *      callers that need the analytics instance await it rather than using
 *      it synchronously.
 *   4. Wrap getAnalytics() in its own try/catch so any unexpected throw
 *      (e.g. a browser extension interfering mid-check) is caught locally
 *      and logged without crashing the app.
 *
 * ─── PRODUCTION SAFETY ───────────────────────────────────────────────────────
 *
 * - auth and db are still initialised synchronously. They do not depend on
 *   Analytics and are not affected by this change.
 *
 * - analyticsPromise resolves to null when Analytics is unavailable.
 *   Any consumer that calls logEvent() or similar should await this promise
 *   and check for null before calling Analytics methods.
 *
 * - The app works identically in all cases where Analytics is unavailable:
 *   exam-taking, authentication, results, dashboards — all unaffected.
 *
 * - No changes are required in any other file. Nothing currently imports
 *   `analytics` from this module. If it is used in future, the pattern is:
 *
 *       import { analyticsPromise } from '../firebase';
 *       const analytics = await analyticsPromise;
 *       if (analytics) logEvent(analytics, 'event_name', { ... });
 */

import { initializeApp }  from 'firebase/app';
import { getAuth }        from 'firebase/auth';
import { getFirestore }   from 'firebase/firestore';
import { getFunctions }   from 'firebase/functions';
import { getAnalytics, isSupported } from 'firebase/analytics';

// ─── Config ───────────────────────────────────────────────────────────────────
// Values read from environment variables — never hardcoded.
// See .env.example for the required variable names.

const firebaseConfig = {
  apiKey:            process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain:        process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.REACT_APP_FIREBASE_APP_ID,
  // measurementId is optional — Analytics degrades gracefully when absent
  measurementId:     process.env.REACT_APP_FIREBASE_MEASUREMENT_ID,
};

// ─── Core services (synchronous — always available) ──────────────────────────

const app = initializeApp(firebaseConfig);

export const auth      = getAuth(app);
export const db        = getFirestore(app);

// ─── Cloud Functions client — region: asia-south1 ────────────────────────────
//
// All Cloud Functions in this project are deployed to asia-south1 (Mumbai).
// Passing the region to getFunctions() ensures httpsCallable() targets the
// correct regional endpoint instead of the default us-central1.
//
// Usage:
//   import { functions } from '../firebase';
//   import { httpsCallable } from 'firebase/functions';
//   const updateExamStatus = httpsCallable(functions, 'updateExamStatus');

export const functions = getFunctions(app, 'asia-south1');

// ─── Analytics (async — may be unavailable) ───────────────────────────────────
//
// analyticsPromise resolves to:
//   Analytics instance  — when supported and measurementId is present
//   null               — when unsupported, measurementId absent, or any error
//
// The promise is created once at module load. Awaiting it multiple times
// is safe — Promise caches its resolved value.

export const analyticsPromise = (async () => {
  // Guard 1 — measurementId must be present in config.
  // No measurementId means no Google Analytics property is linked;
  // initialising Analytics without one would throw immediately.
  if (!firebaseConfig.measurementId) {
    console.info('[Firebase] Analytics disabled — measurementId not configured.');
    return null;
  }

  // Guard 2 — browser / environment must support Analytics.
  // isSupported() checks: IndexedDB availability, cookie policy, HTTPS context.
  // It resolves to false (does not throw) when unsupported.
  let supported;
  try {
    supported = await isSupported();
  } catch (err) {
    // isSupported() itself errored — treat as unsupported
    console.warn('[Firebase] Analytics isSupported() check failed:', err);
    return null;
  }

  if (!supported) {
    console.info('[Firebase] Analytics disabled — not supported in this environment.');
    return null;
  }

  // Guard 3 — final initialisation wrapped in try/catch.
  // Catches any edge case where isSupported() returned true but
  // getAnalytics() still throws (browser extension interference, etc.).
  try {
    const analyticsInstance = getAnalytics(app);
    console.info('[Firebase] Analytics initialised.');
    return analyticsInstance;
  } catch (err) {
    console.warn('[Firebase] Analytics initialisation failed:', err);
    return null;
  }
})();

export default app;
