import { GM_xmlhttpRequest } from '$';

export interface RequestOptions {
  method?: 'GET' | 'POST';
  url: string;
  data?: string | null;
  headers?: Record<string, string>;
}

/**
 * 差し替え可能な HTTP 境界。
 *
 * テストではこのインターフェースを満たす fake を渡す。
 */
export interface HttpClient {
  text(options: RequestOptions): Promise<string>;
  binary(options: RequestOptions): Promise<ArrayBuffer>;
}

type ResponseType = 'text' | 'arraybuffer';

function send(options: RequestOptions, responseType: ResponseType): Promise<unknown> {
  const { method = 'GET', url, data = null, headers = {} } = options;

  return new Promise((resolve, reject) => {
    GM_xmlhttpRequest({
      method,
      url,
      headers,
      responseType,

      // exactOptionalPropertyTypes 下では undefined を渡せないため、
      // 本文があるときだけ data を含める。
      ...(data === null ? {} : { data }),

      onload(response) {
        if (response.status >= 200 && response.status < 300) {
          resolve(responseType === 'text' ? response.responseText : response.response);
          return;
        }

        reject(new Error(`HTTP ${response.status}: ${response.statusText}`));
      },

      onerror(error) {
        const detail = (error as { error?: string } | undefined)?.error || 'unknown error';

        reject(new Error(`AivisSpeechへの接続に失敗しました: ${detail}`));
      },
    });
  });
}

/**
 * GM_xmlhttpRequest による実装。
 *
 * userscript から 127.0.0.1 の AivisSpeech を叩くため、
 * fetch ではなく GM API を使う（@connect 済み）。
 */
export const gmHttpClient: HttpClient = {
  async text(options) {
    return (await send(options, 'text')) as string;
  },

  async binary(options) {
    return (await send(options, 'arraybuffer')) as ArrayBuffer;
  },
};
