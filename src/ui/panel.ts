import { SPEED_DEFAULT, SPEED_MAX, SPEED_MIN, SPEED_STEP } from '../config';
import { TOP_KEY } from '../model/unit';
import './panel.css';

export interface PanelElements {
  panel: HTMLDivElement;
  speakerSelect: HTMLSelectElement;
  speedInput: HTMLInputElement;
  speedLabel: HTMLElement;
  headingSelect: HTMLSelectElement;
  headingInfo: HTMLElement;
  statusElement: HTMLElement;
  playButton: HTMLButtonElement;
  stopButton: HTMLButtonElement;
  refreshButton: HTMLButtonElement;
}

const TEMPLATE = `
  <div class="mdts-aivis-title">🔊 AivisSpeech</div>

  <div class="mdts-aivis-label">Voice</div>
  <select data-el="speaker">
    <option value="">音声モデル取得中...</option>
  </select>

  <div class="mdts-aivis-row">
    <span>速度</span>
    <span><span data-el="speed-label">${SPEED_DEFAULT}</span>x</span>
  </div>
  <input
    data-el="speed"
    type="range"
    min="${SPEED_MIN}"
    max="${SPEED_MAX}"
    step="${SPEED_STEP}"
    value="${SPEED_DEFAULT}"
  >

  <div class="mdts-aivis-row">
    <span>開始位置</span>
    <span data-el="heading-info" class="mdts-aivis-heading-info"></span>
  </div>
  <select data-el="heading">
    <option value="${TOP_KEY}">先頭から</option>
  </select>

  <div class="mdts-aivis-controls">
    <button data-el="play">▶ 読み上げ</button>
    <button data-el="stop">■ 停止</button>
  </div>

  <button data-el="refresh" class="mdts-aivis-refresh">↻ 見出しを更新</button>

  <div data-el="status" class="mdts-aivis-status">準備中</div>
`;

function pick<T extends HTMLElement>(panel: HTMLElement, name: string): T {
  const element = panel.querySelector<T>(`[data-el="${name}"]`);

  if (!element) {
    throw new Error(`panel element not found: ${name}`);
  }

  return element;
}

/** パネルを body へ挿入し、要素参照を返す。 */
export function createPanel(): PanelElements {
  const panel = document.createElement('div');

  panel.className = 'mdts-aivis-panel';

  // .markdown-body 外なので、そもそも読み上げ対象にはならない。
  panel.setAttribute('data-aivis-ui', 'true');
  panel.innerHTML = TEMPLATE;

  document.body.appendChild(panel);

  return {
    panel,
    speakerSelect: pick<HTMLSelectElement>(panel, 'speaker'),
    speedInput: pick<HTMLInputElement>(panel, 'speed'),
    speedLabel: pick(panel, 'speed-label'),
    headingSelect: pick<HTMLSelectElement>(panel, 'heading'),
    headingInfo: pick(panel, 'heading-info'),
    statusElement: pick(panel, 'status'),
    playButton: pick<HTMLButtonElement>(panel, 'play'),
    stopButton: pick<HTMLButtonElement>(panel, 'stop'),
    refreshButton: pick<HTMLButtonElement>(panel, 'refresh'),
  };
}
