import type { HeadingEntry } from './headings';

/** 「先頭から」を表す特別なキー。 */
export const TOP_KEY = '__TOP__';

export const TOP_LABEL = '文書先頭';

/** 音声合成 1 回分の読み上げ単位。 */
export interface ReadUnit {
  text: string;
  sectionKey: string;
  sectionText: string;
  sectionIndex: number | null;
  sectionLevel: number | null;
}

export function makeUnit(text: string, section: HeadingEntry | null = null): ReadUnit {
  return {
    text,
    sectionKey: section?.key ?? TOP_KEY,
    sectionText: section?.text ?? TOP_LABEL,
    sectionIndex: section?.index ?? null,
    sectionLevel: section?.level ?? null,
  };
}
