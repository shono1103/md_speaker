/**
 * 読み上げ用のテキスト正規化。
 */

/** URL は長々と読み上げない。 */
const URL_PATTERN = /https?:\/\/[^\s]+/g;

/** フェンス付きコードブロックの残骸。 */
const FENCED_CODE_PATTERN = /```[\s\S]*?```/g;

/** インラインコードのバッククォート。 */
const INLINE_CODE_PATTERN = /`([^`]+)`/g;

/** ZWSP / ZWNJ / ZWJ / BOM。 */
const ZERO_WIDTH_PATTERN = /[\u200B-\u200D\uFEFF]/g;

export function normalizeText(text: string | null | undefined): string {
  if (!text) {
    return '';
  }

  return (
    text
      .replace(URL_PATTERN, ' URLを省略します。 ')
      .replace(FENCED_CODE_PATTERN, '')
      .replace(INLINE_CODE_PATTERN, '$1')
      .replace(ZERO_WIDTH_PATTERN, '')

      // 空白整理
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  );
}
