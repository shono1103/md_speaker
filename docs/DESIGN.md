# 設計

元は 1 ファイルの userscript でした。
Vite で分割・CI/CD 化するにあたり、**そのまま分割すると循環参照になる 3 箇所**を
先に解消しています。ここがこの構成の主眼です。

## 依存方向

```
config ─┐
text  ──┤
dom   ──┼──► model ──► player ──► ui ──► main
        └─ infra ──► aivis ──┘
```

矢印の逆向き参照を作らないこと。特に `player` 以下は
`<select>` / `<button>` / `localStorage` を一切知りません。

## 解消した 3 つの結合

### 1. ロジックが UI 要素を直参照していた

元のコードでは `speak()` / `stop()` が `setStatus()` / `setPlayingState()` を、
`refreshHeadingSelect()` が `headingSelect` / `headingInfo` を直接叩いていました。

`Reader` はコールバックだけを持ちます。

```ts
export interface ReaderCallbacks {
  onStatus(message: string): void;
  onPlayingStateChange(playing: boolean): void;
  onSectionChange(sectionKey: string): void;
}
```

`ui/controls.ts` が `Reader` を生成し、
`onStatus` → ステータス表示、`onSectionChange` → `localStorage` 保存と
プルダウンへの反映を担当します。

副産物として、元の `stop(showStatus, updateSelect)` のフラグ引数が消えました。
「開始位置プルダウンを書き戻すか」は UI 側の判断であり、Reader の関心ではないためです。

### 2. `headingEntries` がモジュールグローバルな可変配列だった

`getUnitsFromRoot()` がクロージャ経由でこれを読んでいたため、
`model` と `ui` が相互に依存していました。

`HeadingIndex` クラスへ閉じ、`getUnitsFromRoot(root, headings, startHeading)` として
**引数で渡す**形にしています。同名見出しの出現回数カウントもこのクラス内です。

### 3. `runId` / `currentPlayback` がモジュールグローバルだった

`runId` は `Reader` の private field、
`currentPlayback` は `Playback` クラスの private field へ移しました。

`Playback#play(blob, isStale)` は
再生完了または停止で resolve し、再生失敗のみ reject します。
`abort()` は保持している `finish` を呼んで待機中の Promise を解放します。

## 意図的に変えていないもの

- **`runId` による世代管理**（`AbortController` へは置き換えていない）
  疑似ストリーミングの先読みと停止時の未処理 rejection 回避は元の実装が既に正しく、
  振る舞いを変えずに構造だけを移したかったため。
- **`startSynthesis()` の Result 化**
  先読み中に停止された場合、その合成 Promise は誰も await しません。
  reject させると unhandled rejection になるので、`{ ok, blob | error }` へ包んでいます。
- **`localStorage` のキー文字列**
  変更すると既存ユーザーの「開始位置 / 速度 / Voice」設定が失われます。
  `tests/storage.test.ts` でリテラル固定して検証しています。
- **`.markdown-body` 以外を読まない方針**
  `article` / `main` / `body` へのフォールバックは意図的に持ちません。
  mdts のサイドバーやツールバーを読み上げてしまうためです。

## 単一ファイル出力の制約

userscript は 1 ファイルでなければならないため IIFE 出力です。

- top-level await は使えません（現状すべて async 関数内なので影響なし）
- dynamic import は使えません（コード分割が発生する）
- `scripts/verify-metadata.mjs` が `dist` に想定外の `.js` が出ていないかを検査します

## CI が守っているもの

`typecheck` / `lint` / `test` に加えて、`verify-metadata.mjs` が
ビルド成果物のメタデータブロックを検証します。

- `@version` が `package.json` と一致
- `@grant GM_xmlhttpRequest` がある
- `@connect 127.0.0.1` がある — **これが欠けると通信が全滅する**
- `@match` が想定どおり、`@updateURL` / `@downloadURL` が `https://` で始まる
- `dist` に余分な `.js` がない

メタデータの欠落は「ビルドは通るのに実行時に壊れる」典型なので、
CI で止める価値が最も高い項目です。

## テストの注意点

jsdom は `innerText` を実装していないため、`happy-dom` を使っています。
それでも `innerText` の改行整形は実機と完全には一致しないため、
`dom/extract.ts` の挙動は最終的に mdts 上での実機確認で担保します。

## mdts ページの判定

起動ガード (`main.ts`) はポート番号を見ません。
mdts の既定ポート 8521 は `--port` で変えられるうえ、
使用中なら mdts 自身が次のポートへずらして listen します。
「8521 なら mdts」は成立しません。

代わりに `dom/mdts.ts` が「mdts が配信しているページか」を DOM から判定します。

1. `<title>` に `mdts` を含む → それだけで mdts と確定
   （mdts のフロントエンドは title を書き換えないため、どのファイルを開いていても残る）
2. そうでなければ、index.html の骨格
   （`/markdown.css` / `/bundle.js` / `#root`）が **すべて** 揃ったときだけ mdts と見なす

2 を「すべて」にしているのは、目印が単独ではありふれていて
他のローカル開発サーバーにも一致してしまうためです
（無関係なページにパネルが出ると邪魔になる）。

判定に `.markdown-body` の有無は使えません。
mdts は SPA で本文を API 取得後に描画するため、
`document-idle` の時点では存在しないことがあります。

## スクロールの実装方針

mdts は三分割レイアウトで、本文が内側のペインをスクロールします。
`window.scrollTo` だけでは動かないため、
`dom/scroll.ts` が縦スクロール可能な最も近い祖先を探し、
見つかればそのペイン、無ければ `window` をスクロールします。

呼び出すのは `ui/controls.ts` のみです。
`player` 層はスクロールを知りません（読み上げ位置の管理と表示位置は別の関心事）。

## 今後の拡張余地

構成上入れやすいが、現時点では持っていないもの。

- **技術用語辞書** — `OIDC` / `MCP` / `RAG` / `PostgreSQL` / `Kubernetes` などの読み方補正。
  `text/normalize.ts` の前段に置ける
- **現在位置への自動追従スクロール** — 現在は読み上げ開始時のみジャンプする。
  `Reader` の `onSectionChange` を使えば追従できる
- **一時停止 / 再開** — 現在の停止は読み上げ処理そのものを終了する。
  `Playback` に pause/resume を足し、`Reader` の generator を保持すればプレイヤー形式にできる
- `.markdown-body` への `MutationObserver`（mdts のライブリロード時に見出しを自動更新。現在は手動ボタン）
- パネルの Shadow DOM 化（mdts のテーマ CSS との干渉を完全に排除）
- `AIVIS_URL` の UI 設定化（ホストを変える場合は `@connect` も要変更）
