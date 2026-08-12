import { AivisClient } from './aivis/client';
import { MDTS_PORT, ROOT_SELECTOR } from './config';
import { getReadableRoot } from './dom/root';
import { gmHttpClient } from './infra/http';
import { storage } from './infra/storage';
import { createPanel } from './ui/panel';
import { Controls } from './ui/controls';

/**
 * エントリポイント。
 *
 * ここには起動ガードと組み立てだけを置き、ロジックは各層へ委譲する。
 */
async function main(): Promise<void> {
  const client = new AivisClient(gmHttpClient);
  const controls = new Controls(createPanel(), client, storage);

  controls.restoreSpeed();
  controls.refreshHeadings();

  if (!getReadableRoot()) {
    controls.setStatus(`対象 ${ROOT_SELECTOR} が見つかりません`);
  } else {
    controls.setStatus('AivisSpeechに接続中…');
  }

  try {
    if (!(await controls.loadSpeakers())) {
      return;
    }

    if (!getReadableRoot()) {
      controls.setStatus(`対象 ${ROOT_SELECTOR} が見つかりません`);
      return;
    }

    controls.showReady();
  } catch (error) {
    console.error('[AivisSpeech Reader]', error);

    controls.markSpeakerUnavailable();
    controls.setStatus('AivisSpeechを起動してください');
  }
}

if (location.port === MDTS_PORT) {
  void main();
}
