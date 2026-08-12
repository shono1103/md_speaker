import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { getReadableRoot } from '../src/dom/root';
import { HeadingIndex } from '../src/model/headings';
import { getUnitsFromRoot } from '../src/model/units';
import { TOP_KEY } from '../src/model/unit';

const FIXTURE = readFileSync(resolve('tests/fixtures/markdown-body.html'), 'utf8');

function setup(): { root: HTMLElement; headings: HeadingIndex } {
  document.body.innerHTML = FIXTURE;

  const root = getReadableRoot()!;

  return { root, headings: HeadingIndex.build(root) };
}

function texts(root: HTMLElement, headings: HeadingIndex, start: HTMLElement | null = null) {
  return [...getUnitsFromRoot(root, headings, start)].map((unit) => unit.text);
}

describe('getUnitsFromRoot', () => {
  let root: HTMLElement;
  let headings: HeadingIndex;

  beforeEach(() => {
    ({ root, headings } = setup());
  });

  it('先頭から全体を読み上げ単位へ変換する', () => {
    expect(texts(root, headings)).toEqual([
      'はじめに',
      'これは導入の段落です。',
      '使い方',
      '段落その二。',
      '親項目です',
      '子項目です',
      'もう一つの項目',
      'コード例を省略します。',
      '図を省略します。',
      '画像があります。構成図。画像を省略します。',
      '表を読み上げます。',
      '項目は、速度。値は、1.2。',
      '項目は、ポート。値は、8521。',
      '表は以上です。',
      '使い方',
      '同名見出しのあとの段落。',
    ]);
  });

  it('親 li は子リストのテキストを含まない（二重読み防止）', () => {
    const units = texts(root, headings);

    expect(units).toContain('親項目です');
    expect(units.filter((text) => text.includes('子項目です'))).toEqual(['子項目です']);
  });

  it('pre の中身は読まず、代替文に置き換える', () => {
    const units = texts(root, headings);

    expect(units).toContain('コード例を省略します。');
    expect(units.some((text) => text.includes('const a = 1'))).toBe(false);
  });

  it('mermaid の中身は読まない', () => {
    const units = texts(root, headings);

    expect(units).toContain('図を省略します。');
    expect(units.some((text) => text.includes('graph TD'))).toBe(false);
  });

  it('表はヘッダー行をデータ行として読まない', () => {
    const units = texts(root, headings);

    expect(units.filter((text) => text === '項目は、項目。値は、値。')).toEqual([]);
  });

  it('パネル UI のテキストは読み上げない', () => {
    const units = texts(root, headings);

    expect(units.some((text) => text.includes('読み上げてはいけない'))).toBe(false);
  });

  it('開始見出しより前を skip する', () => {
    const start = headings.findByKey('H2:使い方:1')!.element;

    const units = texts(root, headings, start);

    expect(units[0]).toBe('使い方');
    expect(units).not.toContain('これは導入の段落です。');
    expect(units).toContain('同名見出しのあとの段落。');
  });

  it('同名見出しの 2 つ目から開始できる', () => {
    const start = headings.findByKey('H2:使い方:2')!.element;

    expect(texts(root, headings, start)).toEqual(['使い方', '同名見出しのあとの段落。']);
  });

  it('見出し配下の unit に sectionKey が付く', () => {
    const units = [...getUnitsFromRoot(root, headings, null)];

    expect(units[0]?.sectionKey).toBe('H1:はじめに:1');
    expect(units[1]?.sectionKey).toBe('H1:はじめに:1');
    expect(units.at(-1)?.sectionKey).toBe('H2:使い方:2');
  });

  it('見出しより前のコンテンツは文書先頭に属する', () => {
    document.body.innerHTML = `
      <div class="markdown-body">
        <p>見出しの前の段落。</p>
        <h1>あとの見出し</h1>
      </div>
    `;

    const localRoot = getReadableRoot()!;
    const localHeadings = HeadingIndex.build(localRoot);

    const units = [...getUnitsFromRoot(localRoot, localHeadings, null)];

    expect(units[0]).toMatchObject({ sectionKey: TOP_KEY, sectionText: '文書先頭' });
  });

  it('alt のない画像は代替文のみ', () => {
    document.body.innerHTML = '<div class="markdown-body"><img src="a.png"></div>';

    const localRoot = getReadableRoot()!;

    expect(texts(localRoot, HeadingIndex.build(localRoot))).toEqual(['画像を省略します。']);
  });

  it('ヘッダーなしの表はセル値をそのまま読む', () => {
    document.body.innerHTML = `
      <div class="markdown-body">
        <table><tr><td>あ</td><td>い</td></tr></table>
      </div>
    `;

    const localRoot = getReadableRoot()!;

    expect(texts(localRoot, HeadingIndex.build(localRoot))).toEqual([
      '表を読み上げます。',
      'あ。い。',
      '表は以上です。',
    ]);
  });

  it('generator は必要な分だけ評価する', () => {
    const iterator = getUnitsFromRoot(root, headings, null);

    expect(iterator.next().value?.text).toBe('はじめに');
    // ここで残りは未評価のまま
    expect(iterator.next().value?.text).toBe('これは導入の段落です。');
  });
});
