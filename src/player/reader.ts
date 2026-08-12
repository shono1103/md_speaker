import { startSynthesis, type SynthesisClient } from '../aivis/client';
import type { SynthesisResult } from '../aivis/types';
import type { HeadingIndex } from '../model/headings';
import { getReadableUnits } from '../model/units';
import { TOP_KEY, type ReadUnit } from '../model/unit';

export interface ReaderCallbacks {
  onStatus(message: string): void;
  onPlayingStateChange(playing: boolean): void;
  /** 読み上げ中のセクションが変わったとき。UI 側で保存や表示に使う。 */
  onSectionChange(sectionKey: string): void;
}

export interface SpeakOptions {
  startKey: string;
  speakerId: number;
  speed: number;
  /** 再生開始直前に見出しを取り直したもの。 */
  headings: HeadingIndex;
}

export interface PlaybackPort {
  play(blob: Blob, isStale: () => boolean): Promise<void>;
  abort(): void;
}

/**
 * 読み上げ本体。
 *
 * UI 要素を一切参照せず、callbacks 経由でのみ外へ通知する。
 */
export class Reader {
  /** 新しい読み上げ / 停止ごとに増やし、古い async 処理を無効化する。 */
  #runId = 0;

  #currentSectionKey: string = TOP_KEY;

  constructor(
    private readonly synth: SynthesisClient,
    private readonly playback: PlaybackPort,
    private readonly callbacks: ReaderCallbacks,
  ) {}

  get currentSectionKey(): string {
    return this.#currentSectionKey;
  }

  async speak({ startKey, speakerId, speed, headings }: SpeakOptions): Promise<void> {
    // 以前の再生を停止する（開始位置の書き戻しは UI 側の責務）。
    this.stop();

    if (!Number.isFinite(speakerId)) {
      this.callbacks.onStatus('音声モデルを選択してください');
      return;
    }

    this.#currentSectionKey = startKey;

    // ----------------------------------------------------------------
    // Generator
    //
    // この時点では全文を文字列化しない。
    // next() された分だけ変換される。
    // ----------------------------------------------------------------
    const iterator = getReadableUnits(headings, startKey);

    let current = iterator.next();

    if (current.done) {
      this.callbacks.onStatus('読み上げるテキストがありません');
      return;
    }

    const localRunId = ++this.#runId;
    const isStale = (): boolean => localRunId !== this.#runId;

    this.callbacks.onPlayingStateChange(true);

    try {
      this.callbacks.onStatus(`最初の音声を生成中… / ${headings.labelForKey(startKey)}`);

      // 最初のチャンクだけ生成
      let currentSynthesis: Promise<SynthesisResult> | null = startSynthesis(
        this.synth,
        current.value.text,
        speakerId,
        speed,
      );

      // --------------------------------------------------------------
      // 疑似ストリーミング
      //
      // current を再生している間に next を生成する。
      // --------------------------------------------------------------
      while (!current.done && currentSynthesis) {
        if (isStale()) {
          return;
        }

        const currentUnit: ReadUnit = current.value;

        const synthesisResult = await currentSynthesis;

        if (isStale()) {
          return;
        }

        if (!synthesisResult.ok) {
          throw synthesisResult.error;
        }

        // 次の Unit を取得。
        // generator なので、表ならここで「次の 1 行」だけ変換される。
        const next = iterator.next();

        // 現在の音声を再生する前に、次の音声生成を開始する。
        const nextSynthesis = next.done
          ? null
          : startSynthesis(this.synth, next.value.text, speakerId, speed);

        this.#rememberSection(currentUnit);

        this.callbacks.onStatus(`再生中: ${currentUnit.sectionText}`);

        // この await の間に nextSynthesis が裏で進む。
        await this.playback.play(synthesisResult.blob, isStale);

        current = next;
        currentSynthesis = nextSynthesis;
      }

      if (!isStale()) {
        this.callbacks.onStatus('完了');
      }
    } catch (error) {
      if (isStale()) {
        return;
      }

      console.error('[AivisSpeech Reader]', error);

      this.callbacks.onStatus(`エラー: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      if (!isStale()) {
        this.callbacks.onPlayingStateChange(false);
      }
    }
  }

  /** 再生を停止し、古い async 処理を無効化する。 */
  stop(): void {
    this.#runId++;
    this.playback.abort();
    this.callbacks.onPlayingStateChange(false);
  }

  /** 開始位置を外部（プルダウン操作など）から更新する。 */
  setSection(sectionKey: string): void {
    this.#currentSectionKey = sectionKey || TOP_KEY;
  }

  #rememberSection(unit: ReadUnit): void {
    this.#currentSectionKey = unit.sectionKey || TOP_KEY;

    // 再生中にも通知しておく。
    // 停止ボタンだけでなく、ページを閉じた場合でも
    // 次回ある程度近い見出しから再開できる。
    this.callbacks.onSectionChange(this.#currentSectionKey);
  }
}
