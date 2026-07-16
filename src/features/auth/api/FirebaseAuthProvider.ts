import auth from '@react-native-firebase/auth';
import type { FirebaseAuthTypes } from '@react-native-firebase/auth';

import type { UserId } from '@/types';

import type { AuthProvider } from '../services/AuthProvider';
import type { AppUser } from '../types';

function toAppUser(user: FirebaseAuthTypes.User): AppUser {
  return {
    uid: user.uid as UserId,
    email: user.email ?? '',
    displayName: user.displayName,
    isAnonymous: user.isAnonymous,
  };
}

export const firebaseAuthProvider: AuthProvider = {
  async signIn(email, password) {
    const { user } = await auth().signInWithEmailAndPassword(email, password);
    return toAppUser(user);
  },

  async signUp(email, password, displayName) {
    const { user } = await auth().createUserWithEmailAndPassword(email, password);
    await user.updateProfile({ displayName });
    // Reload so displayName is reflected in the returned user object.
    await user.reload();
    const refreshed = auth().currentUser;
    if (!refreshed) throw new Error('User not found after sign-up.');
    return toAppUser(refreshed);
  },

  async signOut() {
    await auth().signOut();
  },

  async resetPassword(email) {
    await auth().sendPasswordResetEmail(email);
  },

  async getSession() {
    const user = auth().currentUser;
    return user ? toAppUser(user) : null;
  },

  onSessionChange(callback) {
    return auth().onAuthStateChanged((user) => {
      callback(user ? toAppUser(user) : null);
    });
  },
};
