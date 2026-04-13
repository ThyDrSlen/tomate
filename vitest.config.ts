import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';
import solidPlugin from 'vite-plugin-solid';

export default defineConfig({
  plugins: [WxtVitest(), solidPlugin({ ssr: true })],
  test: {
    exclude: [
      '**/node_modules/**',
      '**/.claude/worktrees/**',
      '**/tests/smoke.test.ts',
    ],
  },
});
