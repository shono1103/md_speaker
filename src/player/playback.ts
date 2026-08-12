/**
 * Audio 1 本の再生を扱う。
 *
 * 停止時に再生中の Promise を確実に解放するため、
 * resolve 用の finish をここで保持する。
 */
export class Playback {
  #current: { audio: HTMLAudioElement; finish: () => void } | null = null;

  /** 再生完了 (または abort) で resolve する。再生失敗のみ reject。 */
  play(blob: Blob, isStale: () => boolean): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (isStale()) {
        resolve();
        return;
      }

      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);

      let settled = false;

      const cleanup = (): void => {
        if (this.#current?.audio === audio) {
          this.#current = null;
        }

        URL.revokeObjectURL(url);
      };

      const finish = (): void => {
        if (settled) {
          return;
        }

        settled = true;
        cleanup();
        resolve();
      };

      const fail = (error: unknown): void => {
        if (settled) {
          return;
        }

        settled = true;
        cleanup();
        reject(error instanceof Error ? error : new Error(String(error)));
      };

      this.#current = { audio, finish };

      audio.onended = finish;
      audio.onerror = () => fail(new Error('音声の再生に失敗しました'));

      audio.play().catch(fail);
    });
  }

  /** 再生を止め、play() の Promise を resolve させる。 */
  abort(): void {
    const current = this.#current;

    if (!current) {
      return;
    }

    try {
      current.audio.pause();
      current.audio.currentTime = 0;
    } catch {
      // ignore
    }

    current.finish();
  }
}
