import { getElementText } from '../dom/extract';
import { getReadableRoot } from '../dom/root';
import { splitShort } from '../text/split';
import type { HeadingEntry, HeadingIndex } from './headings';
import { readTableUnits } from './table';
import { makeUnit, type ReadUnit } from './unit';

const BLOCK_SELECTOR = [
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'p',
  'li',
  'pre',
  'table',
  'img',
  '.mermaid',
].join(',');

const HEADING_TAG = /^H[1-6]$/;

/**
 * .markdown-body を読み上げ単位へ変換する。
 *
 * 重要:
 *   root は必ず .markdown-body。
 *   この querySelectorAll も .markdown-body 配下しか走査しない。
 */
export function* getUnitsFromRoot(
  root: HTMLElement,
  headings: HeadingIndex,
  startHeading: HTMLElement | null = null,
): Generator<ReadUnit> {
  const elements = [...root.querySelectorAll<HTMLElement>(BLOCK_SELECTOR)];

  let started = startHeading === null;

  /** 現在所属する見出し。 */
  let currentSection: HeadingEntry | null = null;

  for (const element of elements) {
    // ============================================================
    // 選択された見出しに到達するまで skip
    // ============================================================
    if (!started) {
      if (element === startHeading) {
        started = true;
      } else {
        continue;
      }
    }

    // ============================================================
    // table 内部
    //
    // table 本体で処理するので内部要素は skip
    // ============================================================
    if (element.closest('table') && element.tagName !== 'TABLE') {
      continue;
    }

    // ============================================================
    // pre 内部
    // ============================================================
    if (element.closest('pre') && element.tagName !== 'PRE') {
      continue;
    }

    // ============================================================
    // Mermaid 内部
    // ============================================================
    const parentMermaid = element.closest('.mermaid');

    if (parentMermaid && parentMermaid !== element) {
      continue;
    }

    // ============================================================
    // li 内部
    //
    // 親 li がテキストを担当する。
    // ただしネストされた子 li 自体は独立して読み上げる。
    // ============================================================
    if (element.parentElement?.closest('li') && element.tagName !== 'LI') {
      continue;
    }

    // ============================================================
    // h1〜h6
    // ============================================================
    if (HEADING_TAG.test(element.tagName)) {
      // この見出しから currentSection を切り替える
      currentSection = headings.findByElement(element);

      for (const chunk of splitShort(getElementText(element))) {
        yield makeUnit(chunk, currentSection);
      }

      continue;
    }

    // ============================================================
    // Mermaid
    // ============================================================
    if (element.classList?.contains('mermaid')) {
      yield makeUnit('図を省略します。', currentSection);
      continue;
    }

    // ============================================================
    // Code Block
    // ============================================================
    if (element.tagName === 'PRE') {
      yield makeUnit('コード例を省略します。', currentSection);
      continue;
    }

    // ============================================================
    // Table
    // ============================================================
    if (element.tagName === 'TABLE') {
      yield* readTableUnits(element as HTMLTableElement, currentSection);
      continue;
    }

    // ============================================================
    // Image
    // ============================================================
    if (element.tagName === 'IMG') {
      const alt = element.getAttribute('alt')?.trim();

      yield makeUnit(
        alt ? `画像があります。${alt}。画像を省略します。` : '画像を省略します。',
        currentSection,
      );

      continue;
    }

    // ============================================================
    // 通常文章 / List Item
    // ============================================================
    const text = getElementText(element);

    if (!text) {
      continue;
    }

    for (const chunk of splitShort(text)) {
      yield makeUnit(chunk, currentSection);
    }
  }
}

/** 開始見出しキーから読み上げ単位を得る。 */
export function* getReadableUnits(headings: HeadingIndex, startKey: string): Generator<ReadUnit> {
  const root = getReadableRoot();

  if (!root) {
    return;
  }

  const startHeading = headings.findByKey(startKey)?.element ?? null;

  yield* getUnitsFromRoot(root, headings, startHeading);
}
