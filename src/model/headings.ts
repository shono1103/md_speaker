import { normalizeText } from '../text/normalize';
import { TOP_KEY, TOP_LABEL } from './unit';

const HEADING_SELECTOR = 'h1, h2, h3, h4, h5, h6';

const UNTITLED = '(無題の見出し)';

export interface HeadingEntry {
  /** 保存用キー。`Hタグ:テキスト:同名出現回数` */
  key: string;
  /** 1 始まりの通し番号（表示用）。 */
  index: number;
  /** 1〜6。 */
  level: number;
  text: string;
  element: HTMLElement;
}

/**
 * .markdown-body 内の h1〜h6 の索引。
 *
 * かつてモジュールグローバルだった headingEntries をここへ閉じる。
 * これにより model 層が UI を参照しなくなる。
 */
export class HeadingIndex {
  private constructor(private readonly entries: readonly HeadingEntry[]) {}

  static empty(): HeadingIndex {
    return new HeadingIndex([]);
  }

  /** ルート直下から h1〜h6 を収集する。 */
  static build(root: HTMLElement | null): HeadingIndex {
    if (!root) {
      return HeadingIndex.empty();
    }

    const headings = [...root.querySelectorAll<HTMLElement>(HEADING_SELECTOR)];

    // 同名見出し対策
    const occurrences = new Map<string, number>();

    const entries = headings.map((element, index): HeadingEntry => {
      const level = Number(element.tagName.slice(1));

      const text = normalizeText(element.innerText || element.textContent || '') || UNTITLED;

      // ----------------------------------------------------------
      // 数字 index だけで保存すると、
      // 前方に見出しが増えた際にズレる。
      //
      // Hタグ + テキスト + 同名出現回数 を保存キーにする。
      // ----------------------------------------------------------
      const baseKey = `${element.tagName}:${text}`;
      const occurrence = (occurrences.get(baseKey) ?? 0) + 1;

      occurrences.set(baseKey, occurrence);

      return {
        key: `${baseKey}:${occurrence}`,
        index: index + 1,
        level,
        text,
        element,
      };
    });

    return new HeadingIndex(entries);
  }

  get length(): number {
    return this.entries.length;
  }

  all(): readonly HeadingEntry[] {
    return this.entries;
  }

  findByKey(key: string | null | undefined): HeadingEntry | null {
    if (!key || key === TOP_KEY) {
      return null;
    }

    return this.entries.find((entry) => entry.key === key) ?? null;
  }

  findByElement(element: Element): HeadingEntry | null {
    return this.entries.find((entry) => entry.element === element) ?? null;
  }

  hasKey(key: string): boolean {
    return key === TOP_KEY || this.entries.some((entry) => entry.key === key);
  }

  /** ステータス表示用のラベル。 */
  labelForKey(key: string | null | undefined): string {
    if (!key || key === TOP_KEY) {
      return TOP_LABEL;
    }

    const entry = this.findByKey(key);

    if (!entry) {
      return '不明な見出し';
    }

    return `${entry.index}. ${entry.text}`;
  }
}

/** H レベルに応じてプルダウンでインデント表示する。 */
export function formatHeadingLabel(entry: HeadingEntry): string {
  const indent = '\u00A0\u00A0'.repeat(Math.max(0, entry.level - 1));

  return `${indent}${entry.index}. [H${entry.level}] ${entry.text}`;
}
