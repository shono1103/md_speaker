import type { AivisClient } from '../aivis/client';
import { ROOT_SELECTOR, SPEED_DEFAULT, SPEED_MAX, SPEED_MIN } from '../config';
import { getReadableRoot } from '../dom/root';
import type { Storage } from '../infra/storage';
import { formatHeadingLabel, HeadingIndex } from '../model/headings';
import { TOP_KEY } from '../model/unit';
import { Playback } from '../player/playback';
import { Reader } from '../player/reader';
import type { PanelElements } from './panel';

const NOT_FOUND_MESSAGE = `対象 ${ROOT_SELECTOR} が見つかりません`;

/**
 * パネル UI と Reader の配線。
 *
 * DOM を触るのはこの層だけ。Reader / model は UI を知らない。
 */
export class Controls {
  #headings = HeadingIndex.empty();

  readonly #reader: Reader;

  constructor(
    private readonly ui: PanelElements,
    private readonly client: AivisClient,
    private readonly storage: Storage,
  ) {
    this.#reader = new Reader(client, new Playback(), {
      onStatus: (message) => this.setStatus(message),
      onPlayingStateChange: (playing) => this.setPlayingState(playing),
      onSectionChange: (sectionKey) => this.storage.setHeading(sectionKey),
    });

    this.#bindEvents();

    // 停止ボタンは再生中のみ有効。
    this.setPlayingState(false);
  }

  // ================================================================
  // Status
  // ================================================================

  setStatus(message: string): void {
    this.ui.statusElement.textContent = message;
  }

  private setPlayingState(playing: boolean): void {
    this.ui.playButton.disabled = playing;
    this.ui.stopButton.disabled = !playing;
    this.ui.headingSelect.disabled = playing;
    this.ui.speakerSelect.disabled = playing;
    this.ui.speedInput.disabled = playing;
    this.ui.refreshButton.disabled = playing;
  }

  // ================================================================
  // Heading select
  // ================================================================

  /** .markdown-body から見出しを取り直し、プルダウンを作り直す。 */
  refreshHeadings({ preferredValue = null }: { preferredValue?: string | null } = {}): void {
    const root = getReadableRoot();
    const select = this.ui.headingSelect;

    select.innerHTML = '';
    select.appendChild(this.createOption(TOP_KEY, '先頭から'));

    if (!root) {
      this.#headings = HeadingIndex.empty();
      this.ui.headingInfo.textContent = '対象なし';
      select.value = TOP_KEY;
      return;
    }

    this.#headings = HeadingIndex.build(root);

    for (const entry of this.#headings.all()) {
      select.appendChild(this.createOption(entry.key, formatHeadingLabel(entry)));
    }

    // 選択位置復元
    const available = new Set([...select.options].map((option) => option.value));

    const selected = [preferredValue, this.storage.getHeading(), TOP_KEY].find(
      (value) => value && available.has(value),
    );

    select.value = selected ?? TOP_KEY;

    this.ui.headingInfo.textContent = `全 ${this.#headings.length} 見出し`;
  }

  get headings(): HeadingIndex {
    return this.#headings;
  }

  private createOption(value: string, label: string): HTMLOptionElement {
    const option = document.createElement('option');

    option.value = value;
    option.textContent = label;

    return option;
  }

  // ================================================================
  // Speaker select
  // ================================================================

  /** Voice 一覧を取得して埋める。取得できなければ false。 */
  async loadSpeakers(): Promise<boolean> {
    const speakers = await this.client.getSpeakers();
    const select = this.ui.speakerSelect;

    select.innerHTML = '';

    for (const speaker of speakers) {
      for (const style of speaker.styles) {
        select.appendChild(this.createOption(String(style.id), `${speaker.name} / ${style.name}`));
      }
    }

    if (select.options.length === 0) {
      select.innerHTML = '';
      select.appendChild(this.createOption('', '音声モデルがありません'));
      this.setStatus('音声モデルが見つかりません');
      return false;
    }

    const saved = this.storage.getSpeaker();

    if (saved && [...select.options].some((option) => option.value === saved)) {
      select.value = saved;
    }

    return true;
  }

  markSpeakerUnavailable(): void {
    this.ui.speakerSelect.innerHTML = '';
    this.ui.speakerSelect.appendChild(this.createOption('', '接続できません'));
  }

  // ================================================================
  // Speed
  // ================================================================

  restoreSpeed(): void {
    const saved = Number(this.storage.getSpeed());

    if (Number.isFinite(saved) && saved >= SPEED_MIN && saved <= SPEED_MAX) {
      this.ui.speedInput.value = String(saved);
      this.ui.speedLabel.textContent = String(saved);
    }
  }

  // ================================================================
  // Events
  // ================================================================

  #bindEvents(): void {
    const { speedInput, speedLabel, speakerSelect, headingSelect } = this.ui;

    speedInput.addEventListener('input', () => {
      speedLabel.textContent = speedInput.value;
      this.storage.setSpeed(speedInput.value);
    });

    speakerSelect.addEventListener('change', () => {
      this.storage.setSpeaker(speakerSelect.value);
    });

    headingSelect.addEventListener('change', () => {
      const key = headingSelect.value || TOP_KEY;

      this.#reader.setSection(key);
      this.storage.setHeading(key);
      this.setStatus(`開始位置: ${this.#headings.labelForKey(key)}`);
    });

    this.ui.playButton.addEventListener('click', () => {
      void this.play();
    });

    this.ui.stopButton.addEventListener('click', () => {
      this.stop();
    });

    this.ui.refreshButton.addEventListener('click', () => {
      const preferredValue = headingSelect.value || TOP_KEY;

      this.#reader.stop();
      this.refreshHeadings({ preferredValue });

      this.setStatus(
        getReadableRoot()
          ? `見出しを更新しました / 全 ${this.#headings.length}`
          : NOT_FOUND_MESSAGE,
      );
    });
  }

  // ================================================================
  // Play / Stop
  // ================================================================

  private async play(): Promise<void> {
    // ユーザーがプルダウンで指定した位置を先に確保しておく。
    const requestedStartKey = this.ui.headingSelect.value || TOP_KEY;

    if (!getReadableRoot()) {
      this.setStatus(NOT_FOUND_MESSAGE);
      return;
    }

    // mdts 側で Markdown が更新されている可能性があるため、
    // 再生開始直前に h1〜h6 を取り直す。
    this.refreshHeadings({ preferredValue: requestedStartKey });

    const startKey = this.ui.headingSelect.value || TOP_KEY;

    this.storage.setHeading(startKey);

    await this.#reader.speak({
      startKey,
      speakerId: Number(this.ui.speakerSelect.value),
      speed: Number(this.ui.speedInput.value) || SPEED_DEFAULT,
      headings: this.#headings,
    });
  }

  private stop(): void {
    this.#reader.stop();

    // 停止ボタンの場合は、現在読んでいた見出しをプルダウンへ反映する。
    const currentKey = this.#reader.currentSectionKey;

    if (this.#headings.hasKey(currentKey)) {
      this.ui.headingSelect.value = currentKey;
    }

    const nextKey = this.ui.headingSelect.value || TOP_KEY;

    this.storage.setHeading(nextKey);
    this.setStatus(`停止 / 次回: ${this.#headings.labelForKey(nextKey)}`);
  }

  /** 起動直後の案内文。 */
  showReady(): void {
    this.setStatus(`準備完了 / 開始: ${this.#headings.labelForKey(this.ui.headingSelect.value)}`);
  }
}
