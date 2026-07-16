import { QueryClientProvider } from '@tanstack/react-query';
import type React from 'react';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { initFirebase } from '@/backend/firebase';
import { queryClient } from '@/backend/queryClient';
import { SessionProvider } from '@/features/auth/components/SessionProvider';
import { initSentry } from '@/services/logger';

type Props = { children: React.ReactNode };

/**
 * Root provider composition. Order matters:
 * 1. Sentry (crash reporting must be first)
 * 2. Firebase / App Check
 * 3. QueryClientProvider (TanStack Query)
 * 4. SessionProvider (Firebase Auth → Zustand)
 *
 * Phase 3 adds: nothing new here (chat/assistant state is Zustand, not context).
 */

initSentry(); // module-level: runs once before any component mounts

function FirebaseBootstrap({ children }: Props): React.JSX.Element {
  useEffect(() => {
    void initFirebase();
  }, []);

  return <>{children}</>;
}

export function RootProviders({ children }: Props): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <FirebaseBootstrap>
          <SessionProvider>{children}</SessionProvider>
        </FirebaseBootstrap>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
