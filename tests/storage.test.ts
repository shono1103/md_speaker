import { describe, expect, it } from 'vitest';
import { storage } from '../src/infra/storage';

/**
 * キー文字列は既存ユーザーの設定と直結しているので、
 * 変更を検知できるようリテラルで固定して検証する。
 */
describe('storage', () => {
  it('開始位置は Markdown ごとのキーへ保存される', () => {
    storage.setHeading('H2:使い方:1');

    const key = `mdts-aivis-reader:heading:${location.pathname}${location.search}`;

    expect(localStorage.getItem(key)).toBe('H2:使い方:1');
    expect(storage.getHeading()).toBe('H2:使い方:1');
  });

  it('速度は文書をまたいで共有される', () => {
    storage.setSpeed('1.5');

    expect(localStorage.getItem('mdts-aivis-reader:speed')).toBe('1.5');
    expect(storage.getSpeed()).toBe('1.5');
  });

  it('Voice は文書をまたいで共有される', () => {
    storage.setSpeaker('888753760');

    expect(localStorage.getItem('mdts-aivis-reader:speaker')).toBe('888753760');
    expect(storage.getSpeaker()).toBe('888753760');
  });

  it('未保存なら null', () => {
    expect(storage.getHeading()).toBeNull();
    expect(storage.getSpeed()).toBeNull();
    expect(storage.getSpeaker()).toBeNull();
  });
});
