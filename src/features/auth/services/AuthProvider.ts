import type { AppUser } from '../types';

/**
 * Auth service interface. Screens and hooks consume this; never call
 * @react-native-firebase/auth directly outside the concrete implementation.
 *
 * Phase 5: GoogleSignInAuthProvider will implement this same interface —
 * no screen or hook changes required when it's added.
 */
export interface AuthProvider {
  signIn(email: string, password: string): Promise<AppUser>;
  signUp(email: string, password: string, displayName: string): Promise<AppUser>;
  signOut(): Promise<void>;
  resetPassword(email: string): Promise<void>;
  getSession(): Promise<AppUser | null>;
  onSessionChange(callback: (user: AppUser | null) => void): () => void;
}
