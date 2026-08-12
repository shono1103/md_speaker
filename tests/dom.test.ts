import { describe, expect, it } from 'vitest';
import { getElementText, getTableCellText } from '../src/dom/extract';
import { getReadableRoot } from '../src/dom/root';

function first<T extends HTMLElement>(html: string, selector: string): T {
  document.body.innerHTML = html;

  return document.querySelector<T>(selector)!;
}

describe('getReadableRoot', () => {
  it('.markdown-body を返す', () => {
    document.body.innerHTML = '<div class="markdown-body"><p>a</p></div>';

    expect(getReadableRoot()?.className).toBe('markdown-body');
  });

  it('.markdown-body が無ければ null（body へ fallback しない）', () => {
    document.body.innerHTML = '<article><main><p>読んではいけない</p></main></article>';

    expect(getReadableRoot()).toBeNull();
  });
});

describe('getElementText', () => {
  it('script / style / button / nav / aside を除去する', () => {
    const element = first<HTMLElement>(
      `<p id="t">本文<button>押す</button><script>var a=1;</script><aside>補足</aside></p>`,
      '#t',
    );

    expect(getElementText(element)).toBe('本文');
  });

  it('li は直下の子リストを含めない', () => {
    const element = first<HTMLElement>('<ul><li id="t">親<ul><li>子</li></ul></li></ul>', '#t');

    expect(getElementText(element)).toBe('親');
  });

  it('li のインライン要素は含める', () => {
    const element = first<HTMLElement>('<ul><li id="t">親の<strong>強調</strong></li></ul>', '#t');

    expect(getElementText(element)).toBe('親の強調');
  });

  it('元の DOM を破壊しない', () => {
    const element = first<HTMLElement>('<p id="t">本文<button>押す</button></p>', '#t');

    getElementText(element);

    expect(element.querySelector('button')).not.toBeNull();
  });

  it('正規化も適用される', () => {
    const element = first<HTMLElement>('<p id="t">`code` と https://example.com</p>', '#t');

    expect(getElementText(element)).toBe('code と URLを省略します。');
  });
});

describe('getTableCellText', () => {
  it('画像を alt へ置き換える', () => {
    const cell = first<HTMLElement>(
      '<table><tr><td id="t"><img alt="図の説明" src="a.png"></td></tr></table>',
      '#t',
    );

    expect(getTableCellText(cell)).toBe('図の説明');
  });

  it('alt の無い画像は空文字になる', () => {
    const cell = first<HTMLElement>(
      '<table><tr><td id="t">値<img src="a.png"></td></tr></table>',
      '#t',
    );

    expect(getTableCellText(cell)).toBe('値');
  });
});
