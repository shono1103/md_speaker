import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { getReadableRoot } from '../src/dom/root';
import { formatHeadingLabel, HeadingIndex } from '../src/model/headings';
import { TOP_KEY } from '../src/model/unit';

const FIXTURE = readFileSync(resolve('tests/fixtures/markdown-body.html'), 'utf8');

function buildIndex(): HeadingIndex {
  document.body.innerHTML = FIXTURE;

  return HeadingIndex.build(getReadableRoot());
}

describe('HeadingIndex', () => {
  let index: HeadingIndex;

  beforeEach(() => {
    index = buildIndex();
  });

  it('.markdown-body 内の見出しだけを拾う', () => {
    expect(index.all().map((entry) => entry.text)).toEqual([
      'はじめに',
      '使い方',
      '使い方',
      // パネル内の p は見出しではないので含まれない
    ]);
  });

  it('level と index を持つ', () => {
    const [first, second] = index.all();

    expect(first).toMatchObject({ level: 1, index: 1 });
    expect(second).toMatchObject({ level: 2, index: 2 });
  });

  it('同名見出しを出現回数で区別する', () => {
    const keys = index.all().map((entry) => entry.key);

    expect(keys).toEqual(['H1:はじめに:1', 'H2:使い方:1', 'H2:使い方:2']);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('前方に見出しが増えてもキーがズレない', () => {
    const before = index.findByKey('H2:使い方:2');

    const root = getReadableRoot()!;
    const inserted = document.createElement('h2');

    inserted.textContent = '前提';
    root.prepend(inserted);

    const after = HeadingIndex.build(root).findByKey('H2:使い方:2');

    expect(after?.text).toBe(before?.text);
    // index (表示用の通し番号) はズレるが、キーで同じ見出しを引ける
    expect(after?.index).not.toBe(before?.index);
  });

  it('markdown-body がなければ空', () => {
    document.body.innerHTML = '<div>no markdown body</div>';

    const empty = HeadingIndex.build(getReadableRoot());

    expect(empty.length).toBe(0);
    expect(empty.hasKey('H1:はじめに:1')).toBe(false);
  });

  it('TOP_KEY は常に有効なキー', () => {
    expect(index.hasKey(TOP_KEY)).toBe(true);
    expect(index.findByKey(TOP_KEY)).toBeNull();
    expect(index.labelForKey(TOP_KEY)).toBe('文書先頭');
  });

  it('未知のキーは不明な見出しとして扱う', () => {
    expect(index.labelForKey('H9:none:1')).toBe('不明な見出し');
  });

  it('要素から逆引きできる', () => {
    const h1 = getReadableRoot()!.querySelector('h1')!;

    expect(index.findByElement(h1)?.key).toBe('H1:はじめに:1');
  });
});

describe('formatHeadingLabel', () => {
  it('H レベルに応じて NBSP でインデントする', () => {
    const index = buildIndex();
    const [h1, h2] = index.all();

    expect(formatHeadingLabel(h1!)).toBe('1. [H1] はじめに');
    expect(formatHeadingLabel(h2!)).toBe(`${'\u00A0'.repeat(2)}2. [H2] 使い方`);
  });
});
