import type { UserId } from '@/types';

export type UserProfile = {
  uid: UserId;
  displayName: string;
  email: string;
  createdAt: number;
  updatedAt: number;
};

export type UpdateProfileInput = {
  displayName: string;
};
