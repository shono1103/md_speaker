import { describe, expect, it, vi } from 'vitest';
import { AivisClient, startSynthesis, type SynthesisClient } from '../src/aivis/client';
import { gmHttpClient } from '../src/infra/http';
import type { HttpClient, RequestOptions } from '../src/infra/http';

function fakeHttp(overrides: Partial<HttpClient> = {}): HttpClient & { calls: RequestOptions[] } {
  const calls: RequestOptions[] = [];

  return {
    calls,
    async text(options) {
      calls.push(options);

      if (options.url.includes('/speakers')) {
        return JSON.stringify([{ name: 'テスト話者', styles: [{ id: 1, name: 'ノーマル' }] }]);
      }

      return JSON.stringify({ speedScale: 1.0, pitchScale: 0 });
    },
    async binary(options) {
      calls.push(options);
      return new ArrayBuffer(8);
    },
    ...overrides,
  };
}

describe('AivisClient', () => {
  it('speakers をパースする', async () => {
    const client = new AivisClient(fakeHttp());

    await expect(client.getSpeakers()).resolves.toEqual([
      { name: 'テスト話者', styles: [{ id: 1, name: 'ノーマル' }] },
    ]);
  });

  it('audio_query の speedScale を上書きして synthesis へ送る', async () => {
    const http = fakeHttp();
    const client = new AivisClient(http);

    const blob = await client.synthesize('こんにちは', 42, 1.5);

    expect(blob.type).toBe('audio/wav');

    const [queryCall, synthesisCall] = http.calls;

    expect(queryCall?.url).toContain('/audio_query?speaker=42');
    expect(queryCall?.url).toContain(encodeURIComponent('こんにちは'));

    expect(synthesisCall?.url).toContain('/synthesis?speaker=42');
    expect(JSON.parse(synthesisCall?.data ?? '{}')).toMatchObject({
      speedScale: 1.5,
      pitchScale: 0,
    });
  });

  it('テキストを URL エンコードする', async () => {
    const http = fakeHttp();

    await new AivisClient(http).synthesize('a&b=c', 1, 1.0);

    expect(http.calls[0]?.url).toContain('a%26b%3Dc');
  });
});

describe('gmHttpClient', () => {
  it('2xx を resolve する', async () => {
    globalThis.GM_xmlhttpRequest = vi.fn((details: unknown) => {
      (details as { onload: (r: unknown) => void }).onload({
        status: 200,
        statusText: 'OK',
        responseText: 'ok',
      });
    });

    await expect(gmHttpClient.text({ url: 'http://127.0.0.1:10101/speakers' })).resolves.toBe('ok');
  });

  it('非 2xx は HTTP エラーとして reject する', async () => {
    globalThis.GM_xmlhttpRequest = vi.fn((details: unknown) => {
      (details as { onload: (r: unknown) => void }).onload({
        status: 422,
        statusText: 'Unprocessable Entity',
      });
    });

    await expect(gmHttpClient.text({ url: 'http://127.0.0.1:10101/x' })).rejects.toThrow(
      'HTTP 422: Unprocessable Entity',
    );
  });

  it('接続失敗は日本語メッセージで reject する', async () => {
    globalThis.GM_xmlhttpRequest = vi.fn((details: unknown) => {
      (details as { onerror: (e: unknown) => void }).onerror({ error: 'ECONNREFUSED' });
    });

    await expect(gmHttpClient.text({ url: 'http://127.0.0.1:10101/x' })).rejects.toThrow(
      'AivisSpeechへの接続に失敗しました: ECONNREFUSED',
    );
  });
});

describe('startSynthesis', () => {
  it('成功を ok:true で包む', async () => {
    const synth: SynthesisClient = {
      async synthesize() {
        return new Blob(['x']);
      },
    };

    await expect(startSynthesis(synth, 'a', 1, 1)).resolves.toMatchObject({ ok: true });
  });

  it('失敗を reject させず ok:false で包む（未処理 rejection 防止）', async () => {
    const error = new Error('boom');

    const synth: SynthesisClient = {
      async synthesize() {
        throw error;
      },
    };

    await expect(startSynthesis(synth, 'a', 1, 1)).resolves.toEqual({ ok: false, error });
  });
});
