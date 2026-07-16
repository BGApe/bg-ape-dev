import { firebase } from '@react-native-firebase/app';
// Side-effect import: augments FirebaseApp with .functions(region?) method.
import type { HttpsCallableResult } from '@react-native-firebase/functions';
import '@react-native-firebase/functions';

import { FUNCTIONS_REGION } from '@/config/firebaseConfig';

/**
 * Factory for type-safe HTTPS Callable function clients pinned to FUNCTIONS_REGION.
 *
 * Usage:
 *   const ping = callable<void, { ok: boolean }>('assistantPing');
 *   const result = await ping();
 */
export function callable<TData, TResult>(name: string) {
  const fn = firebase.app().functions(FUNCTIONS_REGION).httpsCallable(name);
  // The augmented httpsCallable lacks generic forwarding; assert the result type
  // which is safe because callers of `callable<TData, TResult>` own the contract.
  return (data?: TData): Promise<TResult> =>
    fn(data).then((res: HttpsCallableResult<unknown>) => res.data as TResult);
}
