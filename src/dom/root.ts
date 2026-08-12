import { ROOT_SELECTOR } from '../config';

/**
 * 読み上げ対象のルート要素。
 *
 * 重要:
 *   .markdown-body 以外は絶対に読み上げ対象にしない。
 *   article / main / body などへの fallback も行わない。
 */
export function getReadableRoot(doc: Document = document): HTMLElement | null {
  return doc.querySelector<HTMLElement>(ROOT_SELECTOR);
}
