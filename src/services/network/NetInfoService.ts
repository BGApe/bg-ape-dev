import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

/**
 * Subscribe to network connectivity changes.
 * Returns an unsubscribe function.
 */
export function subscribeToNetInfo(callback: (isConnected: boolean) => void): () => void {
  return NetInfo.addEventListener((state) => {
    callback(state.isConnected ?? false);
  });
}

/**
 * Hook: returns current network connectivity status.
 * Starts as `true` (optimistic) until first NetInfo event.
 */
export function useNetworkStatus(): boolean {
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsConnected(state.isConnected ?? false);
    });
    return unsubscribe;
  }, []);

  return isConnected;
}
