import { MDTS_SHELL_SELECTORS, MDTS_TITLE_PATTERN } from '../config';

/**
 * mdts が配信しているページかどうか。
 *
 * 重要:
 *   ポート番号では判定しない。
 *   mdts の既定ポート 8521 は `--port` で変えられるうえ、
 *   使用中なら mdts 自身が次のポートへずらして listen する。
 *
 * mdts の index.html は SPA の骨格だけを返し、本文は後から描画される。
 * そのため本文 (.markdown-body) の有無ではなく、
 * 骨格に含まれる目印で判定する（起動直後でも判定できる）。
 */
export function isMdtsPage(doc: Document = document): boolean {
  // title だけは他のローカルサーバーと衝突しないため単独で確定させる。
  if (MDTS_TITLE_PATTERN.test(doc.title)) {
    return true;
  }

  return MDTS_SHELL_SELECTORS.every((selector) => doc.querySelector(selector) !== null);
}
