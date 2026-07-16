/**
 * Design tokens — single source of truth for colors, spacing, typography, radius.
 * Import this into tailwind.config.js to keep Tailwind classes in sync.
 * Use token values in non-NativeWind contexts (e.g. StyleSheet, chart configs).
 */

export const colors = {
  brand: {
    primary: '#4F46E5',
    primaryForeground: '#FFFFFF',
    secondary: '#6366F1',
  },
  surface: {
    background: '#0F0F0F',
    card: '#1A1A1A',
    cardBorder: '#2A2A2A',
    input: '#1F1F1F',
  },
  text: {
    primary: '#F9F9F9',
    secondary: '#A3A3A3',
    muted: '#525252',
  },
  status: {
    error: '#EF4444',
    success: '#22C55E',
    warning: '#F59E0B',
    info: '#3B82F6',
  },
  chat: {
    userBubble: '#4F46E5',
    userBubbleForeground: '#FFFFFF',
    assistantBubble: '#1A1A1A',
    assistantBubbleForeground: '#F9F9F9',
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
} as const;

export const radius = {
  sm: 4,
  md: 8,
  lg: 16,
  full: 9999,
} as const;

export const typography = {
  fontSize: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 24,
    '2xl': 32,
  },
  fontWeight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
} as const;

export const tokens = { colors, spacing, radius, typography } as const;
export type Tokens = typeof tokens;
