import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AivisClient } from '../src/aivis/client';
import { SCROLL_OFFSET } from '../src/config';
import type { HttpClient } from '../src/infra/http';
import { storage } from '../src/infra/storage';
import { TOP_KEY } from '../src/model/unit';
import { Controls } from '../src/ui/controls';
import { createPanel, type PanelElements } from '../src/ui/panel';

const FIXTURE = readFileSync(resolve('tests/fixtures/markdown-body.html'), 'utf8');

const SPEAKERS = [
  { name: '話者A', styles: [{ id: 11, name: 'ノーマル' }] },
  { name: '話者B', styles: [{ id: 22, name: '通常' }] },
];

function fakeHttp(speakers: unknown = SPEAKERS): HttpClient {
  return {
    async text() {
      return JSON.stringify(speakers);
    },
    async binary() {
      return new ArrayBuffer(8);
    },
  };
}

function setup(html = FIXTURE): { ui: PanelElements; controls: Controls } {
  document.body.innerHTML = html;

  const ui = createPanel();
  const controls = new Controls(ui, new AivisClient(fakeHttp()), storage);

  return { ui, controls };
}

describe('Controls', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('初期状態では停止ボタンだけ無効', () => {
    const { ui } = setup();

    expect(ui.stopButton.disabled).toBe(true);
    expect(ui.playButton.disabled).toBe(false);
    expect(ui.headingSelect.disabled).toBe(false);
  });

  it('見出しを更新するとプルダウンに「先頭から」+ 見出しが並ぶ', () => {
    const { ui, controls } = setup();

    controls.refreshHeadings();

    expect([...ui.headingSelect.options].map((option) => option.value)).toEqual([
      TOP_KEY,
      'H1:はじめに:1',
      'H2:使い方:1',
      'H2:使い方:2',
    ]);
    expect(ui.headingInfo.textContent).toBe('全 3 見出し');
  });

  it('markdown-body が無ければ「対象なし」', () => {
    const { ui, controls } = setup('<div>no markdown body</div>');

    controls.refreshHeadings();

    expect(ui.headingInfo.textContent).toBe('対象なし');
    expect(ui.headingSelect.value).toBe(TOP_KEY);
  });

  it('保存済みの開始位置を復元する', () => {
    storage.setHeading('H2:使い方:2');

    const { ui, controls } = setup();

    controls.refreshHeadings();

    expect(ui.headingSelect.value).toBe('H2:使い方:2');
  });

  it('保存済みの見出しが消えていれば先頭へ戻す', () => {
    storage.setHeading('H2:存在しない見出し:1');

    const { ui, controls } = setup();

    controls.refreshHeadings();

    expect(ui.headingSelect.value).toBe(TOP_KEY);
  });

  it('preferredValue が保存値より優先される', () => {
    storage.setHeading('H1:はじめに:1');

    const { ui, controls } = setup();

    controls.refreshHeadings({ preferredValue: 'H2:使い方:1' });

    expect(ui.headingSelect.value).toBe('H2:使い方:1');
  });

  it('開始位置を変更すると保存され、ステータスへ反映される', () => {
    const { ui, controls } = setup();

    controls.refreshHeadings();

    ui.headingSelect.value = 'H2:使い方:1';
    ui.headingSelect.dispatchEvent(new Event('change'));

    expect(storage.getHeading()).toBe('H2:使い方:1');
    expect(ui.statusElement.textContent).toBe('開始位置: 2. 使い方');
  });

  it('速度スライダーの操作を保存する', () => {
    const { ui } = setup();

    ui.speedInput.value = '1.7';
    ui.speedInput.dispatchEvent(new Event('input'));

    expect(storage.getSpeed()).toBe('1.7');
    expect(ui.speedLabel.textContent).toBe('1.7');
  });

  it('保存済みの速度を復元する', () => {
    storage.setSpeed('0.9');

    const { ui, controls } = setup();

    controls.restoreSpeed();

    expect(ui.speedInput.value).toBe('0.9');
    expect(ui.speedLabel.textContent).toBe('0.9');
  });

  it('範囲外の速度は復元しない', () => {
    storage.setSpeed('9.9');

    const { ui, controls } = setup();

    controls.restoreSpeed();

    expect(ui.speedInput.value).toBe('1.2');
  });

  it('Voice 一覧を話者 / スタイルで埋める', async () => {
    const { ui, controls } = setup();

    await expect(controls.loadSpeakers()).resolves.toBe(true);

    expect(
      [...ui.speakerSelect.options].map((option) => [option.value, option.textContent]),
    ).toEqual([
      ['11', '話者A / ノーマル'],
      ['22', '話者B / 通常'],
    ]);
  });

  it('保存済みの Voice を復元し、変更を保存する', async () => {
    storage.setSpeaker('22');

    const { ui, controls } = setup();

    await controls.loadSpeakers();
    expect(ui.speakerSelect.value).toBe('22');

    ui.speakerSelect.value = '11';
    ui.speakerSelect.dispatchEvent(new Event('change'));

    expect(storage.getSpeaker()).toBe('11');
  });

  it('音声モデルが空なら false を返す', async () => {
    document.body.innerHTML = FIXTURE;

    const ui = createPanel();
    const controls = new Controls(ui, new AivisClient(fakeHttp([])), storage);

    await expect(controls.loadSpeakers()).resolves.toBe(false);
    expect(ui.statusElement.textContent).toBe('音声モデルが見つかりません');
  });

  it('見出しを更新ボタンで件数を表示する', () => {
    const { ui } = setup();

    ui.refreshButton.click();

    expect(ui.statusElement.textContent).toBe('見出しを更新しました / 全 3');
  });

  it('再生していないときは停止ボタンを押せない', () => {
    const { ui } = setup();

    ui.stopButton.click();

    expect(ui.statusElement.textContent).toBe('準備中');
  });

  it('停止すると次回の開始位置をステータスへ出す', () => {
    const { ui, controls } = setup();

    controls.refreshHeadings();

    ui.headingSelect.value = 'H2:使い方:2';
    ui.headingSelect.dispatchEvent(new Event('change'));

    // 停止ボタンは再生中のみ有効なので、その状態を再現する
    ui.stopButton.disabled = false;
    ui.stopButton.click();

    expect(ui.statusElement.textContent).toBe('停止 / 次回: 3. 使い方');
    expect(storage.getHeading()).toBe('H2:使い方:2');
  });

  it('読み上げ開始で選択した見出しへスクロールする', async () => {
    const scrollTo = vi.fn();

    window.scrollTo = scrollTo;

    const { ui, controls } = setup();

    await controls.loadSpeakers();
    controls.refreshHeadings();

    ui.headingSelect.value = 'H2:使い方:1';

    const heading = controls.headings.findByKey('H2:使い方:1')!.element;

    heading.getBoundingClientRect = () => ({ top: 640, bottom: 660, height: 20 }) as DOMRect;

    ui.playButton.click();

    await vi.waitFor(() => expect(scrollTo).toHaveBeenCalled());

    expect(scrollTo).toHaveBeenCalledWith({ top: 640 - SCROLL_OFFSET, behavior: 'smooth' });
  });

  it('「先頭から」なら本文の先頭へスクロールする', async () => {
    const scrollTo = vi.fn();

    window.scrollTo = scrollTo;

    const { ui, controls } = setup();

    await controls.loadSpeakers();
    controls.refreshHeadings();

    ui.headingSelect.value = TOP_KEY;

    const root = document.querySelector<HTMLElement>('.markdown-body')!;

    root.getBoundingClientRect = () => ({ top: 120, bottom: 900, height: 780 }) as DOMRect;

    ui.playButton.click();

    await vi.waitFor(() => expect(scrollTo).toHaveBeenCalled());

    expect(scrollTo).toHaveBeenCalledWith({ top: 120 - SCROLL_OFFSET, behavior: 'smooth' });
  });

  it('パネルは .markdown-body の外に置かれる', () => {
    const { ui } = setup();

    expect(ui.panel.closest('.markdown-body')).toBeNull();
    expect(ui.panel.getAttribute('data-aivis-ui')).toBe('true');
  });
});
