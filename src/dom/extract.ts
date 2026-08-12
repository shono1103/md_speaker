import { normalizeText } from '../text/normalize';

/** UI 系の非読み上げ要素。 */
const NOISE_SELECTOR = ['script', 'style', 'button', 'nav', 'aside'].join(',');

/**
 * 要素の可視テキスト。
 *
 * innerText は改行整形が効くので優先し、
 * 未実装環境 (テスト用 DOM など) では textContent へ落とす。
 */
function visibleText(element: HTMLElement): string {
  return normalizeText(element.innerText || element.textContent || '');
}

export function getElementText(element: HTMLElement): string {
  const clone = element.cloneNode(true) as HTMLElement;

  clone.querySelectorAll(NOISE_SELECTOR).forEach((node) => node.remove());

  // --------------------------------------------------------------
  // li
  //
  // 親 li のテキストに子 ul/ol まで含めると、
  // 子 li を後でもう一度読むことになる。
  //
  // そのため直下の子リストを削除する。
  // --------------------------------------------------------------
  if (element.tagName === 'LI') {
    clone.querySelectorAll(':scope > ul, :scope > ol').forEach((node) => node.remove());
  }

  return visibleText(clone);
}

export function getTableCellText(cell: HTMLElement): string {
  const clone = cell.cloneNode(true) as HTMLElement;

  clone.querySelectorAll('script, style, button').forEach((node) => node.remove());

  // セル内画像は alt へ
  clone.querySelectorAll('img').forEach((img) => {
    const alt = img.getAttribute('alt')?.trim() || '';

    img.replaceWith(document.createTextNode(alt));
  });

  return visibleText(clone);
}
