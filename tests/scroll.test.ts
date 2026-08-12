import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SCROLL_OFFSET } from '../src/config';
import { scrollToElement } from '../src/dom/scroll';

/** happy-dom はレイアウトを持たないため矩形を差し込む。 */
function stubRect(element: HTMLElement, top: number): void {
  element.getBoundingClientRect = () => ({ top, bottom: top + 20, height: 20 }) as DOMRect;
}

/** overflow / scrollHeight を持つスクロール可能なペインを作る。 */
function makeScrollablePane(): { pane: HTMLElement; target: HTMLElement } {
  document.body.innerHTML = `
    <div id="pane" style="overflow-y: auto">
      <div class="markdown-body"><h2 id="target">見出し</h2></div>
    </div>
  `;

  const pane = document.querySelector<HTMLElement>('#pane')!;
  const target = document.querySelector<HTMLElement>('#target')!;

  Object.defineProperty(pane, 'scrollHeight', { value: 2000, configurable: true });
  Object.defineProperty(pane, 'clientHeight', { value: 500, configurable: true });
  pane.scrollTop = 100;
  pane.scrollTo = vi.fn();

  stubRect(pane, 0);

  return { pane, target };
}

describe('scrollToElement', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    window.scrollTo = vi.fn();
  });

  it('スクロール可能な祖先ペインがあればそれをスクロールする', () => {
    const { pane, target } = makeScrollablePane();

    stubRect(target, 400);
    scrollToElement(target);

    // scrollTop(100) + rect.top(400) - paneTop(0) - offset
    expect(pane.scrollTo).toHaveBeenCalledWith({
      top: 500 - SCROLL_OFFSET,
      behavior: 'smooth',
    });
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it('スクロール可能な祖先が無ければ window をスクロールする', () => {
    document.body.innerHTML = '<div class="markdown-body"><h2 id="target">見出し</h2></div>';

    const target = document.querySelector<HTMLElement>('#target')!;

    stubRect(target, 300);
    Object.defineProperty(window, 'scrollY', { value: 200, configurable: true });

    scrollToElement(target);

    expect(window.scrollTo).toHaveBeenCalledWith({
      top: 500 - SCROLL_OFFSET,
      behavior: 'smooth',
    });
  });

  it('負の位置へはスクロールしない', () => {
    document.body.innerHTML = '<div class="markdown-body"><h1 id="target">先頭</h1></div>';

    const target = document.querySelector<HTMLElement>('#target')!;

    stubRect(target, 0);
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });

    scrollToElement(target);

    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });

  it('behavior と offset を上書きできる', () => {
    document.body.innerHTML = '<div class="markdown-body"><h2 id="target">見出し</h2></div>';

    const target = document.querySelector<HTMLElement>('#target')!;

    stubRect(target, 300);
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });

    scrollToElement(target, { behavior: 'auto', offset: 0 });

    expect(window.scrollTo).toHaveBeenCalledWith({ top: 300, behavior: 'auto' });
  });

  it('スクロールしないペイン (scrollHeight <= clientHeight) は無視する', () => {
    const { pane, target } = makeScrollablePane();

    Object.defineProperty(pane, 'scrollHeight', { value: 400, configurable: true });
    Object.defineProperty(pane, 'clientHeight', { value: 500, configurable: true });

    stubRect(target, 300);
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });

    scrollToElement(target);

    expect(pane.scrollTo).not.toHaveBeenCalled();
    expect(window.scrollTo).toHaveBeenCalled();
  });
});
