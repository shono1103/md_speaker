import { AIVIS_URL } from '../config';
import type { HttpClient } from '../infra/http';
import type { AudioQuery, Speaker, SynthesisResult } from './types';

/**
 * 音声合成だけを行う最小の境界。
 *
 * Reader はこの型にしか依存しないので、テストでは fake を渡せる。
 */
export interface SynthesisClient {
  synthesize(text: string, speakerId: number, speed: number): Promise<Blob>;
}

export class AivisClient implements SynthesisClient {
  constructor(
    private readonly http: HttpClient,
    private readonly baseUrl: string = AIVIS_URL,
  ) {}

  async getSpeakers(): Promise<Speaker[]> {
    const body = await this.http.text({ url: `${this.baseUrl}/speakers` });

    return JSON.parse(body) as Speaker[];
  }

  async synthesize(text: string, speakerId: number, speed: number): Promise<Blob> {
    const queryBody = await this.http.text({
      method: 'POST',
      url: `${this.baseUrl}/audio_query?speaker=${speakerId}&text=${encodeURIComponent(text)}`,
    });

    const query = JSON.parse(queryBody) as AudioQuery;

    query.speedScale = speed;

    const audio = await this.http.binary({
      method: 'POST',
      url: `${this.baseUrl}/synthesis?speaker=${speakerId}`,
      data: JSON.stringify(query),
      headers: { 'Content-Type': 'application/json' },
    });

    return new Blob([audio], { type: 'audio/wav' });
  }
}

/**
 * 先読み中に停止された場合でも、
 * Promise rejection が未処理にならないよう Result 化する。
 */
export function startSynthesis(
  client: SynthesisClient,
  text: string,
  speakerId: number,
  speed: number,
): Promise<SynthesisResult> {
  return client.synthesize(text, speakerId, speed).then(
    (blob) => ({ ok: true, blob }) as const,
    (error: unknown) => ({ ok: false, error }) as const,
  );
}
