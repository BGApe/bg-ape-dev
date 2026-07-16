import firestore from '@react-native-firebase/firestore';

/**
 * Shared Firestore instance.
 * Offline persistence is enabled by default in @react-native-firebase on mobile.
 *
 * Import this (not @react-native-firebase/firestore directly) in repositories
 * so the instance config stays in one place.
 */
export { firestore };

/** Firestore server timestamp sentinel — use in setDoc / updateDoc calls. */
export const serverTimestamp = firestore.FieldValue.serverTimestamp;
