import { onCall, HttpsError } from 'firebase-functions/v2/https';

/**
 * Stub callable — verifies the Functions plumbing works end to end.
 * Phase 5: Replace with the real Vertex AI in Firebase (Gemini) implementation.
 *
 * TODO: Add rate limiting before public launch.
 * TODO: Add idempotency key handling.
 */
export const assistantPing = onCall(
  {
    region: 'europe-west10',
    enforceAppCheck: true, // rejects requests without a valid App Check token
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be signed in.');
    }

    return { ok: true, uid: request.auth.uid, ts: Date.now() };
  },
);
