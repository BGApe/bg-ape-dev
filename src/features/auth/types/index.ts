import type { UserId } from '@/types';

export type AppUser = {
  uid: UserId;
  email: string;
  displayName: string | null;
  isAnonymous: boolean;
};

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';
