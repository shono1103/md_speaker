import { describe, expect, it } from 'vitest';
import { normalizeText } from '../src/text/normalize';
import { splitShort } from '../src/text/split';

describe('normalizeText', () => {
  it('空入力は空文字', () => {
    expect(normalizeText('')).toBe('');
    expect(normalizeText(null)).toBe('');
    expect(normalizeText(undefined)).toBe('');
  });

  it('URL を読み上げ用の文へ置き換える', () => {
    expect(normalizeText('詳細は https://example.com/a/b?c=d を参照')).toBe(
      '詳細は URLを省略します。 を参照',
    );
  });

  it('フェンス付きコードブロックを除去する', () => {
    expect(normalizeText('前\n```js\nconst a = 1;\n```\n後')).toBe('前\n\n後');
  });

  it('インラインコードのバッククォートを外す', () => {
    expect(normalizeText('`npm run build` を実行')).toBe('npm run build を実行');
  });

  it('zero width character を除去する', () => {
    const zwsp = '\u200B';
    const bom = '\uFEFF';

    expect(normalizeText(`あ${zwsp}い${bom}う`)).toBe('あいう');
  });

  it('連続空白と 3 行以上の空行を圧縮する', () => {
    expect(normalizeText('a   \t b')).toBe('a b');
    expect(normalizeText('a\n\n\n\n\nb')).toBe('a\n\nb');
  });
});

describe('splitShort', () => {
  it('maxLength 以下ならそのまま 1 単位', () => {
    expect(splitShort('短い文です。', 180)).toEqual(['短い文です。']);
  });

  it('句点の直後で分割し、区切り文字を残す', () => {
    const text = `${'あ'.repeat(6)}。${'い'.repeat(6)}。`;

    expect(splitShort(text, 10)).toEqual([`${'あ'.repeat(6)}。`, `${'い'.repeat(6)}。`]);
  });

  it('各単位が maxLength を超えない', () => {
    const text = Array.from({ length: 20 }, (_, i) => `文${i}です。`).join('');

    for (const chunk of splitShort(text, 30)) {
      expect(chunk.length).toBeLessThanOrEqual(30);
    }
  });

  it('一文が長すぎる場合は文字数で強制分割する', () => {
    const chunks = splitShort('あ'.repeat(25), 10);

    expect(chunks).toEqual(['あ'.repeat(10), 'あ'.repeat(10), 'あ'.repeat(5)]);
  });

  it('分割しても内容は保持される', () => {
    const text = Array.from({ length: 12 }, (_, i) => `第${i}文。`).join('');

    expect(splitShort(text, 12).join('')).toBe(text);
  });

  it('空文字は空配列', () => {
    expect(splitShort('   ', 10)).toEqual([]);
  });
});
