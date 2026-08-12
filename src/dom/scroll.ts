import { SCROLL_BEHAVIOR, SCROLL_OFFSET } from '../config';

const SCROLLABLE_OVERFLOW = /^(auto|scroll|overlay)$/;

/**
 * 縦スクロール可能な最も近い祖先。
 *
 * mdts は三分割レイアウトで、本文が内側のペインをスクロールする。
 * window.scrollTo だけでは動かないためこれを探す。
 */
function scrollableAncestor(element: HTMLElement): HTMLElement | null {
  let current = element.parentElement;

  while (current && current !== document.body) {
    const { overflowY } = getComputedStyle(current);

    if (SCROLLABLE_OVERFLOW.test(overflowY) && current.scrollHeight > current.clientHeight) {
      return current;
    }

    current = current.parentElement;
  }

  return null;
}

export interface ScrollOptions {
  behavior?: ScrollBehavior;
  offset?: number;
}

/**
 * 要素を画面上端 + offset の位置へスクロールする。
 *
 * 内側ペインをスクロールする mdts と、
 * 文書全体がスクロールする場合の両方に対応する。
 */
export function scrollToElement(element: HTMLElement, options: ScrollOptions = {}): void {
  const behavior = options.behavior ?? SCROLL_BEHAVIOR;
  const offset = options.offset ?? SCROLL_OFFSET;

  const rect = element.getBoundingClientRect();
  const container = scrollableAncestor(element);

  if (container) {
    const containerRect = container.getBoundingClientRect();
    const top = container.scrollTop + rect.top - containerRect.top - offset;

    container.scrollTo({ top: Math.max(0, top), behavior });

    return;
  }

  window.scrollTo({ top: Math.max(0, rect.top + window.scrollY - offset), behavior });
}
