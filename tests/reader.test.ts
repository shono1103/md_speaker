import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SynthesisClient } from '../src/aivis/client';
import { getReadableRoot } from '../src/dom/root';
import { HeadingIndex } from '../src/model/headings';
import { TOP_KEY } from '../src/model/unit';
import { Reader, type PlaybackPort, type ReaderCallbacks } from '../src/player/reader';

/** 合成の完了タイミングを外から制御できる fake。 */
class FakeSynth implements SynthesisClient {
  readonly requested: string[] = [];
  private readonly pending: Array<() => void> = [];

  constructor(private readonly manual = false) {}

  async synthesize(text: string): Promise<Blob> {
    this.requested.push(text);

    if (!this.manual) {
      return new Blob([text]);
    }

    return new Promise<Blob>((resolve) => {
      this.pending.push(() => resolve(new Blob([text])));
    });
  }

  /** 先頭の合成を完了させる。 */
  resolveNext(): void {
    this.pending.shift()?.();
  }
}

/** 再生の完了タイミングを外から制御できる fake。 */
class FakePlayback implements PlaybackPort {
  readonly played: string[] = [];
  aborted = 0;

  private resolveCurrent: (() => void) | null = null;

  constructor(private readonly manual = false) {}

  async play(blob: Blob, isStale: () => boolean): Promise<void> {
    if (isStale()) {
      return;
    }

    this.played.push(await blob.text());

    if (!this.manual) {
      return;
    }

    return new Promise<void>((resolve) => {
      this.resolveCurrent = resolve;
    });
  }

  finishCurrent(): void {
    const resolve = this.resolveCurrent;

    this.resolveCurrent = null;
    resolve?.();
  }

  abort(): void {
    this.aborted++;
    this.finishCurrent();
  }
}

function recorder(): ReaderCallbacks & {
  statuses: string[];
  playing: boolean[];
  sections: string[];
} {
  const statuses: string[] = [];
  const playing: boolean[] = [];
  const sections: string[] = [];

  return {
    statuses,
    playing,
    sections,
    onStatus: (message) => statuses.push(message),
    onPlayingStateChange: (value) => playing.push(value),
    onSectionChange: (key) => sections.push(key),
  };
}

function setupDocument(html: string): HeadingIndex {
  document.body.innerHTML = html;

  return HeadingIndex.build(getReadableRoot());
}

const SIMPLE = `
  <div class="markdown-body">
    <h1>見出しA</h1>
    <p>一つ目。</p>
    <h2>見出しB</h2>
    <p>二つ目。</p>
  </div>
`;

describe('Reader.speak', () => {
  let headings: HeadingIndex;

  beforeEach(() => {
    headings = setupDocument(SIMPLE);
  });

  it('全ての unit を順番に再生する', async () => {
    const synth = new FakeSynth();
    const playback = new FakePlayback();
    const callbacks = recorder();

    await new Reader(synth, playback, callbacks).speak({
      startKey: TOP_KEY,
      speakerId: 1,
      speed: 1.2,
      headings,
    });

    expect(playback.played).toEqual(['見出しA', '一つ目。', '見出しB', '二つ目。']);
    expect(callbacks.statuses.at(-1)).toBe('完了');
    expect(callbacks.playing).toEqual([false, true, false]);
  });

  it('指定した見出しから開始する', async () => {
    const playback = new FakePlayback();

    await new Reader(new FakeSynth(), playback, recorder()).speak({
      startKey: 'H2:見出しB:1',
      speakerId: 1,
      speed: 1.2,
      headings,
    });

    expect(playback.played).toEqual(['見出しB', '二つ目。']);
  });

  it('再生中に次の音声を先読みする', async () => {
    const synth = new FakeSynth();
    const playback = new FakePlayback(true);
    const reader = new Reader(synth, playback, recorder());

    const done = reader.speak({ startKey: TOP_KEY, speakerId: 1, speed: 1.2, headings });

    // 1 つ目の再生が終わっていない時点で 2 つ目の合成が始まっている
    await vi.waitFor(() => {
      expect(playback.played).toEqual(['見出しA']);
      expect(synth.requested).toEqual(['見出しA', '一つ目。']);
    });

    playback.finishCurrent();
    await vi.waitFor(() => expect(playback.played.length).toBe(2));

    reader.stop();
    await done;
  });

  it('unit が無ければ何も再生しない', async () => {
    const emptyHeadings = setupDocument('<div class="markdown-body"></div>');
    const playback = new FakePlayback();
    const callbacks = recorder();

    await new Reader(new FakeSynth(), playback, callbacks).speak({
      startKey: TOP_KEY,
      speakerId: 1,
      speed: 1.2,
      headings: emptyHeadings,
    });

    expect(playback.played).toEqual([]);
    expect(callbacks.statuses).toContain('読み上げるテキストがありません');
  });

  it('speakerId が不正なら開始しない', async () => {
    const callbacks = recorder();

    await new Reader(new FakeSynth(), new FakePlayback(), callbacks).speak({
      startKey: TOP_KEY,
      speakerId: Number.NaN,
      speed: 1.2,
      headings,
    });

    expect(callbacks.statuses).toContain('音声モデルを選択してください');
    expect(callbacks.playing).toEqual([false]);
  });

  it('合成エラーをステータスへ出す', async () => {
    const failing: SynthesisClient = {
      async synthesize() {
        throw new Error('合成失敗');
      },
    };

    const callbacks = recorder();

    await new Reader(failing, new FakePlayback(), callbacks).speak({
      startKey: TOP_KEY,
      speakerId: 1,
      speed: 1.2,
      headings,
    });

    expect(callbacks.statuses.at(-1)).toBe('エラー: 合成失敗');
    expect(callbacks.playing.at(-1)).toBe(false);
  });

  it('読み上げ中のセクションを通知する', async () => {
    const callbacks = recorder();

    await new Reader(new FakeSynth(), new FakePlayback(), callbacks).speak({
      startKey: TOP_KEY,
      speakerId: 1,
      speed: 1.2,
      headings,
    });

    expect(callbacks.sections).toEqual([
      'H1:見出しA:1',
      'H1:見出しA:1',
      'H2:見出しB:1',
      'H2:見出しB:1',
    ]);
  });
});

describe('Reader.stop', () => {
  let headings: HeadingIndex;

  beforeEach(() => {
    headings = setupDocument(SIMPLE);
  });

  it('停止後は残りを再生せず、ステータスも書き換えない', async () => {
    const playback = new FakePlayback(true);
    const callbacks = recorder();
    const reader = new Reader(new FakeSynth(), playback, callbacks);

    const done = reader.speak({ startKey: TOP_KEY, speakerId: 1, speed: 1.2, headings });

    await vi.waitFor(() => expect(playback.played).toEqual(['見出しA']));

    const statusCount = callbacks.statuses.length;
    const abortedBefore = playback.aborted;

    reader.stop();
    await done;

    expect(playback.played).toEqual(['見出しA']);
    expect(playback.aborted).toBe(abortedBefore + 1);
    // 古い async 処理が「完了」などを書き込まないこと
    expect(callbacks.statuses.length).toBe(statusCount);
    expect(callbacks.playing.at(-1)).toBe(false);
  });

  it('停止位置を currentSectionKey として保持する', async () => {
    const playback = new FakePlayback(true);
    const reader = new Reader(new FakeSynth(), playback, recorder());

    const done = reader.speak({ startKey: TOP_KEY, speakerId: 1, speed: 1.2, headings });

    await vi.waitFor(() => expect(playback.played).toEqual(['見出しA']));

    reader.stop();
    await done;

    expect(reader.currentSectionKey).toBe('H1:見出しA:1');
  });

  it('連続 speak では前の再生を打ち切る', async () => {
    const playback = new FakePlayback(true);
    const reader = new Reader(new FakeSynth(), playback, recorder());

    const first = reader.speak({ startKey: TOP_KEY, speakerId: 1, speed: 1.2, headings });

    await vi.waitFor(() => expect(playback.played).toEqual(['見出しA']));

    const second = reader.speak({
      startKey: 'H2:見出しB:1',
      speakerId: 1,
      speed: 1.2,
      headings,
    });

    await first;
    await vi.waitFor(() => expect(playback.played).toEqual(['見出しA', '見出しB']));

    reader.stop();
    await second;

    expect(playback.aborted).toBeGreaterThanOrEqual(2);
  });

  it('setSection で開始位置を差し替えられる', () => {
    const reader = new Reader(new FakeSynth(), new FakePlayback(), recorder());

    reader.setSection('H2:見出しB:1');
    expect(reader.currentSectionKey).toBe('H2:見出しB:1');

    reader.setSection('');
    expect(reader.currentSectionKey).toBe(TOP_KEY);
  });
});
