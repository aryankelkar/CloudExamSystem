/**
 * setUserRoleClaim.js — Cloud Function: setUserRoleClaim  (idempotent, retry-safe)
 *
 * ─── IDEMPOTENCY DESIGN ───────────────────────────────────────────────────────
 *
 * Problem: retry: true means Firebase can re-invoke this function after a
 * transient failure.  Without a guard, every retry would call:
 *
 *   setCustomUserClaims(uid, { role })
 *
 * ...even if the claim was already correctly set on a previous run.
 * While this is not catastrophically harmful, it generates unnecessary writes
 * to Firebase Auth, triggers token invalidation on the user's active sessions,
 * and introduces confusing log noise.
 *
 * Fix — read-before-write claim check:
 *
 *   1. Call admin.auth().getUser(uid) to read the current token claims.
 *   2. If user.customClaims?.role === the role from Firestore:
 *        → log "Claims already set" and return immediately.
 *   3. Only call setCustomUserClaims() if the role is missing or different.
 *
 * This makes the function fully safe to retry any number of times.
 *
 * ─── TOKEN REFRESH FLOW ──────────────────────────────────────────────────────
 *
 * Firebase Auth tokens are cached for up to 1 hour.  The frontend (AuthContext)
 * calls user.getIdToken(true) after registration to force an immediate token
 * refresh, making the new claim available without waiting for cache expiry.
 *
 * For existing sessions (login after claim is already set), AuthContext reads
 * claims.role from getIdTokenResult() which hits the cached token — no Firestore
 * read required.
 *
 * ─── TRIGGER ─────────────────────────────────────────────────────────────────
 *
 *   Firestore onDocumentCreated("users/{uid}")
 *   Fires once when the users/{uid} document is first created at registration.
 */

const {onDocumentCreated} = require("firebase-functions/v2/firestore");
const {getAuth} = require("firebase-admin/auth");
const {logger} = require("firebase-functions");

const VALID_ROLES = ["student", "faculty"];

exports.setUserRoleClaim = onDocumentCreated(
    {
      document: "users/{uid}",
      region: "asia-south1",
      retry: true, // safe with read-before-write idempotency guard
    },
    async (event) => {
      const uid = event.params.uid;
      const userData = event.data?.data();

      // ── Guard: empty trigger payload ──────────────────────────────────────
      if (!userData) {
        logger.error("setUserRoleClaim: empty snapshot — cannot set claim", {uid});
        return; // do not throw — retrying will never produce data
      }

      const desiredRole = userData.role;

      logger.info("setUserRoleClaim: invocation started", {uid, desiredRole});

      // ── Validate role value ───────────────────────────────────────────────
      if (!desiredRole || !VALID_ROLES.includes(desiredRole)) {
        logger.error("setUserRoleClaim: invalid or missing role field — skipping", {
          uid,
          desiredRole,
          validRoles: VALID_ROLES,
        });
        // Do not throw — a bad role value won't be fixed by retrying
        return;
      }

      try {
      // ══════════════════════════════════════════════════════════════════
      // IDEMPOTENCY CHECK — read current claims before writing
      // ══════════════════════════════════════════════════════════════════
      // getUser() fetches the live Auth record including any existing claims.
      // This is the canonical read-before-write pattern for custom claims.

        let authUser;
        try {
          authUser = await getAuth().getUser(uid);
        } catch (getUserError) {
        // The Auth user may not exist yet in rare edge cases (e.g. Firestore
        // write succeeded but Auth creation hadn't fully propagated).
        // Re-throw so Firebase retries after a delay.
          logger.error("setUserRoleClaim: getUser() failed — will retry", {
            uid,
            message: getUserError.message,
          });
          throw getUserError;
        }

        const currentClaims = authUser.customClaims ?? {};
        const currentRole = currentClaims.role ?? null;

        // ── Already correct — nothing to do ──────────────────────────────
        if (currentRole === desiredRole) {
          logger.info("setUserRoleClaim: claim already set correctly — no-op (idempotent exit)", {
            uid,
            role: desiredRole,
            currentClaims,
          });
          return;
        }

        // ── Role is absent or different — update the claim ────────────────
        logger.info("setUserRoleClaim: updating custom claim", {
          uid,
          previousRole: currentRole,
          newRole: desiredRole,
        });

        // Preserve any other existing claims (e.g. admin flags added manually)
        // by merging rather than replacing the entire claims object.
        const updatedClaims = {...currentClaims, role: desiredRole};
        await getAuth().setCustomUserClaims(uid, updatedClaims);

        logger.info("setUserRoleClaim: custom claim set successfully", {
          uid,
          role: desiredRole,
          updatedClaims,
        });
      } catch (error) {
        logger.error("setUserRoleClaim: unhandled error — will retry", {
          uid,
          desiredRole,
          message: error.message,
          stack: error.stack,
        });
        throw error; // re-throw → Firebase retries with exponential backoff
      }
    },
);
