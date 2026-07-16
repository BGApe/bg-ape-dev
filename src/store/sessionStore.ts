import { create } from 'zustand';

import type { AppUser } from '@/features/auth/types';

type SessionState = {
  user: AppUser | null;
  /** true until the first onAuthStateChanged event fires. */
  isLoading: boolean;
  setUser: (user: AppUser | null) => void;
  setLoading: (loading: boolean) => void;
};

export const useSessionStore = create<SessionState>()((set) => ({
  user: null,
  isLoading: true,
  setUser: (user) => set({ user }),
  setLoading: (isLoading) => set({ isLoading }),
}));
