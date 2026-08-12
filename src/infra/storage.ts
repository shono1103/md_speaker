/**
 * localStorage のキー設計と読み書き。
 *
 * 重要:
 *   キー文字列を変更すると、利用者の「開始位置 / 速度 / Voice」設定が失われる。
 *   移行時は必ず後方互換を保つこと。
 */

const STORAGE_PREFIX = 'mdts-aivis-reader';

/** 開始位置は Markdown ごとに分ける。 */
function documentKey(): string {
  return `${location.pathname}${location.search}`;
}

function headingKey(): string {
  return `${STORAGE_PREFIX}:heading:${documentKey()}`;
}

const SPEED_KEY = `${STORAGE_PREFIX}:speed`;
const SPEAKER_KEY = `${STORAGE_PREFIX}:speaker`;

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    // Private Browsing など localStorage が使えない環境
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // 保存できなくても読み上げ自体は継続させる
  }
}

export const storage = {
  getHeading(): string | null {
    return read(headingKey());
  },

  setHeading(value: string): void {
    write(headingKey(), value);
  },

  getSpeed(): string | null {
    return read(SPEED_KEY);
  },

  setSpeed(value: string): void {
    write(SPEED_KEY, value);
  },

  getSpeaker(): string | null {
    return read(SPEAKER_KEY);
  },

  setSpeaker(value: string): void {
    write(SPEAKER_KEY, value);
  },
};

export type Storage = typeof storage;
