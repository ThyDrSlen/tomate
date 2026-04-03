import type { Config } from 'tailwindcss';

export default {
  content: ['./entrypoints/**/*.{html,ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
} satisfies Config;
