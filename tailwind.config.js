const { tokens } = require('./src/theme/tokens');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        brand: tokens.colors.brand,
        surface: tokens.colors.surface,
        'text-primary': tokens.colors.text.primary,
        'text-secondary': tokens.colors.text.secondary,
        'text-muted': tokens.colors.text.muted,
        'status-error': tokens.colors.status.error,
        'status-success': tokens.colors.status.success,
        'status-warning': tokens.colors.status.warning,
        'chat-user': tokens.colors.chat.userBubble,
        'chat-user-fg': tokens.colors.chat.userBubbleForeground,
        'chat-assistant': tokens.colors.chat.assistantBubble,
        'chat-assistant-fg': tokens.colors.chat.assistantBubbleForeground,
      },
      borderRadius: {
        sm: `${tokens.radius.sm}px`,
        md: `${tokens.radius.md}px`,
        lg: `${tokens.radius.lg}px`,
      },
    },
  },
  plugins: [],
};
