import { beforeEach, vi } from 'vitest';

/**
 * userscript の GM API はテスト環境に存在しないため、
 * グローバルへモックを差しておく（vitest.config.ts で `$` も stub 済み）。
 */
declare global {
  var GM_xmlhttpRequest: ReturnType<typeof vi.fn>;
}

beforeEach(() => {
  globalThis.GM_xmlhttpRequest = vi.fn();
  localStorage.clear();
});
