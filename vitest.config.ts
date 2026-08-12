import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      // userscript ビルド時のみ実体がある GM API を stub へ差し替える
      $: fileURLToPath(new URL('./tests/stubs/monkey-client.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'happy-dom',
    setupFiles: ['tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
    css: true,
  },
});
