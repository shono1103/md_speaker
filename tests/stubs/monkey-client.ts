/**
 * `$` (vite-plugin-monkey/dist/client) のテスト用 stub。
 *
 * 実行時にグローバルへ差されたモックへ委譲する。
 */
type GmRequest = (details: unknown) => unknown;

export const GM_xmlhttpRequest: GmRequest = (details) => {
  const fn = (globalThis as { GM_xmlhttpRequest?: GmRequest }).GM_xmlhttpRequest;

  if (!fn) {
    throw new Error('GM_xmlhttpRequest is not mocked');
  }

  return fn(details);
};
