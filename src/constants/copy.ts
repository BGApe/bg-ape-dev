/**
 * All user-facing copy in one place.
 * In Phase 4, replace values with t('key') from i18next — the key structure
 * here maps directly to the i18n namespace/key hierarchy.
 */
export const Copy = {
  app: {
    name: 'BG Ape',
  },
  auth: {
    signIn: 'Sign in',
    signUp: 'Create account',
    signOut: 'Sign out',
    emailLabel: 'Email',
    passwordLabel: 'Password',
    forgotPassword: 'Forgot password?',
    noAccount: "Don't have an account?",
    alreadyHaveAccount: 'Already have an account?',
    resetEmailSent: 'Password reset email sent.',
  },
  chat: {
    inputPlaceholder: 'Ask about a game…',
    sendButton: 'Send',
    emptyState: 'Ask for a game recommendation or a quick-start rules guide.',
    sending: 'Sending…',
    errorRetry: 'Tap to retry',
  },
  account: {
    title: 'Account',
    displayNameLabel: 'Display name',
    emailLabel: 'Email',
    saveButton: 'Save changes',
    editProfile: 'Edit profile',
    profileUpdated: 'Profile updated.',
  },
  errors: {
    generic: 'Something went wrong. Please try again.',
    network: 'No internet connection. Please check your connection.',
    auth: {
      invalidCredentials: 'Invalid email or password.',
      emailInUse: 'This email address is already in use.',
      weakPassword: 'Password must be at least 6 characters.',
      tooManyRequests: 'Too many attempts. Please try again later.',
    },
    assistant: {
      unavailable: 'Assistant is unavailable. Please try again.',
    },
  },
} as const;
