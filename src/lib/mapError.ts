import { Copy } from '@/constants/copy';

export type UserFacingError = {
  message: string;
  /** Original error code from Firebase, network layer, etc. */
  code?: string;
};

function messageForCode(code: string): string {
  switch (code) {
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-credential':
      return Copy.errors.auth.invalidCredentials;
    case 'auth/email-already-in-use':
      return Copy.errors.auth.emailInUse;
    case 'auth/weak-password':
      return Copy.errors.auth.weakPassword;
    case 'auth/too-many-requests':
      return Copy.errors.auth.tooManyRequests;
    case 'auth/network-request-failed':
      return Copy.errors.network;
    default:
      return Copy.errors.generic;
  }
}

/**
 * Maps any thrown value to a user-presentable error.
 * All async boundaries (queries, mutations, use-cases) run caught errors
 * through this function before surfacing them in UI.
 */
export function mapError(error: unknown): UserFacingError {
  if (error instanceof Error) {
    const asRecord = error as unknown as Record<string, unknown>;
    const code = asRecord['code'];
    if (typeof code === 'string') {
      return { message: messageForCode(code), code };
    }
    return { message: error.message || Copy.errors.generic };
  }
  if (typeof error === 'string') {
    return { message: error };
  }
  return { message: Copy.errors.generic };
}
