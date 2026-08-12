import { MAX_UNIT_LENGTH } from '../config';
import { normalizeText } from './normalize';

/** 句点などの直後で分割する（区切り文字は前側に残す）。 */
const SENTENCE_BOUNDARY = /(?<=[。！？!?])/;

/**
 * 合成しやすい小さな音声単位へ分割する。
 *
 * 1 単位が `maxLength` を超えないようにし、
 * 一文そのものが長すぎる場合は文字数で強制分割する。
 */
export function splitShort(
  text: string | null | undefined,
  maxLength: number = MAX_UNIT_LENGTH,
): string[] {
  const normalized = normalizeText(text);

  if (!normalized) {
    return [];
  }

  if (normalized.length <= maxLength) {
    return [normalized];
  }

  const sentences = normalized.split(SENTENCE_BOUNDARY);
  const result: string[] = [];

  let current = '';

  for (const rawSentence of sentences) {
    const sentence = rawSentence.trim();

    if (!sentence) {
      continue;
    }

    // 現在の塊へ追加すると maxLength を超える
    if (current && current.length + sentence.length > maxLength) {
      result.push(current.trim());
      current = '';
    }

    // 一文そのものが長すぎる
    if (sentence.length > maxLength) {
      if (current) {
        result.push(current.trim());
        current = '';
      }

      for (let i = 0; i < sentence.length; i += maxLength) {
        const part = sentence.slice(i, i + maxLength).trim();

        if (part) {
          result.push(part);
        }
      }

      continue;
    }

    current += sentence;
  }

  if (current.trim()) {
    result.push(current.trim());
  }

  return result.filter(Boolean);
}
