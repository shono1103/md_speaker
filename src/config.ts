/**
 * 全体設定。
 *
 * ここ以外に定数を散らさない。
 */

/** mdts が listen しているポート。これ以外のページでは何もしない。 */
export const MDTS_PORT = '8521';

/**
 * 読み上げ対象はこれだけ。
 *
 * article / main / body へのフォールバックは行わない。
 */
export const ROOT_SELECTOR = '.markdown-body';

export const AIVIS_URL = 'http://127.0.0.1:10101';

/**
 * 小さいほど最初の発声が速い。
 * ただし AivisSpeech へのリクエスト回数は増える。
 */
export const MAX_UNIT_LENGTH = 180;

/**
 * 読み上げ開始時のスクロール挙動。
 *
 * 即座に移動させたい場合は 'auto' にする。
 */
export const SCROLL_BEHAVIOR: ScrollBehavior = 'smooth';

/** スクロール先と画面上端との余白 (px)。 */
export const SCROLL_OFFSET = 48;

/** 速度スライダーの範囲。 */
export const SPEED_MIN = 0.7;
export const SPEED_MAX = 2.0;
export const SPEED_STEP = 0.1;
export const SPEED_DEFAULT = 1.2;
