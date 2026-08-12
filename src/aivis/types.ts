export interface SpeakerStyle {
  id: number;
  name: string;
}

export interface Speaker {
  name: string;
  speaker_uuid?: string;
  styles: SpeakerStyle[];
}

/**
 * AivisSpeech (VOICEVOX 互換) の audio_query レスポンス。
 *
 * 実際のフィールドは多いが、こちらで書き換えるのは speedScale のみ。
 */
export interface AudioQuery {
  speedScale: number;
  [key: string]: unknown;
}

/** 合成結果。stop 時に例外を投げないよう Result 化して扱う。 */
export type SynthesisResult = { ok: true; blob: Blob } | { ok: false; error: unknown };
