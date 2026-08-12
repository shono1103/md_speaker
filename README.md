# md_speaker

[mdts](https://github.com/unhappychoice/mdts) で開いている Markdown を、
[AivisSpeech](https://aivis-project.com/) の音声で読み上げる Tampermonkey userscript です。

好きな見出しから読み上げを開始でき、停止した位置を覚えるので、
長いドキュメントを分けて聞けます。

- 読み上げ対象は `.markdown-body` のみ（サイドバーやツールバーは読みません）
- 見出し（h1〜h6）を選んでそこから開始。開始時にその位置までスクロール
- コードブロック・Mermaid 図・画像は「省略します」と告げてスキップ
- 表はヘッダー名を添えて「〇〇は、△△」の形で 1 行ずつ読み上げ
- 疑似ストリーミング（再生中に次の音声を生成）なので待ち時間が短い

AI Agent が生成した日本語の技術設計書を、画面を見続けずに耳からインプットするための構成です。

```text
AI Agent → 設計書.md → mdts → Chrome → Tampermonkey → AivisSpeech HTTP API → 音声再生
```

## 必要なもの

|                                               | 用途                        | 既定                     |
| --------------------------------------------- | --------------------------- | ------------------------ |
| [mdts](https://github.com/unhappychoice/mdts) | Markdown プレビューサーバー | `http://localhost:8521`  |
| [AivisSpeech](https://aivis-project.com/)     | ローカル音声合成エンジン    | `http://127.0.0.1:10101` |
| [Tampermonkey](https://www.tampermonkey.net/) | userscript マネージャ       | —                        |

## セットアップ

### 1. mdts を起動する

mdts は **(M)ark(d)own (T)ree (S)erver** の略で、
カレントディレクトリの Markdown をツリー表示でブラウザプレビューできる CLI です。
インストール不要で `npx` から使えます。

```bash
# Markdown のあるディレクトリで
npx mdts

# ディレクトリを指定する場合
npx mdts ./docs
```

`http://localhost:8521` が開きます。ファイルを保存すると自動でリロードされます。

> **注意**: このスクリプトはポート **8521**（mdts の既定ポート）でのみ動作します。
> `npx mdts --port 8000` のように変えている場合は、
> `src/config.ts` の `MDTS_PORT` を合わせて変更し、ビルドし直してください。

### 2. AivisSpeech を起動する

[AivisSpeech](https://aivis-project.com/) をインストールして起動します。
起動すると HTTP API サーバーが `http://127.0.0.1:10101` で立ち上がり、
このスクリプトはそこへ音声合成を依頼します。

音声モデルが 1 つも入っていないとパネルに「音声モデルが見つかりません」と出るので、
AivisSpeech 側でモデルを追加してください。

### 3. userscript をインストールする

Tampermonkey を入れた状態で、下記を開くとインストール画面が出ます。

**[md-speaker.user.js をインストール](https://github.com/shono1103/md_speaker/releases/latest/download/md-speaker.user.js)**

`@updateURL` を埋め込んでいるので、以降は Tampermonkey が自動で更新を拾います。

## 使い方

mdts のページを開くと、右下にパネルが出ます。

| 操作               | 説明                                                            |
| ------------------ | --------------------------------------------------------------- |
| **Voice**          | AivisSpeech から取得した話者 / スタイル。選択内容は保存されます |
| **速度**           | 0.7〜2.0 倍（既定 1.2）。`speedScale` として合成時に渡されます  |
| **開始位置**       | `.markdown-body` 内の見出し一覧。H レベル分インデントされます   |
| **▶ 読み上げ**     | 選択位置までスクロールし、そこから読み上げ開始                  |
| **■ 停止**         | 停止し、読んでいた見出しを開始位置へ書き戻します                |
| **↻ 見出しを更新** | mdts のライブリロードで内容が変わったときに押します             |

停止位置・速度・Voice は `localStorage` に保存されます。
開始位置は Markdown ファイルごとに別々に覚えます。

再開位置は行単位ではなく **見出し単位**です。
節の途中で止めても次回はその見出しの先頭から読み直します
（技術文書は少し前から聞き直す方が理解しやすいため）。

### 読み上げの扱い

| 要素                   | 動作                                                                |
| ---------------------- | ------------------------------------------------------------------- |
| 見出し / 段落 / リスト | 読み上げ                                                            |
| コードブロック         | 「コード例を省略します」                                            |
| Mermaid                | 「図を省略します」                                                  |
| 画像                   | alt を読み、画像自体は省略                                          |
| 表                     | 「表を読み上げます」→ ヘッダー名を添えて 1 行ずつ →「表は以上です」 |

長い文章は約 180 文字（`MAX_UNIT_LENGTH`）ごとに分割し、
1 チャンク先読みしながら再生します。

### 挙動を変えたい場合

`src/config.ts` の定数を変更して再ビルドします。

| 定数              | 既定                     | 意味                                                               |
| ----------------- | ------------------------ | ------------------------------------------------------------------ |
| `MDTS_PORT`       | `'8521'`                 | このポート以外では何もしない                                       |
| `AIVIS_URL`       | `http://127.0.0.1:10101` | AivisSpeech Engine（変更時は `@connect` も要変更）                 |
| `MAX_UNIT_LENGTH` | `180`                    | 1 チャンクの最大文字数。小さいほど初速が速く、リクエスト数は増える |
| `SCROLL_BEHAVIOR` | `'smooth'`               | `'auto'` にすると即座に移動                                        |
| `SCROLL_OFFSET`   | `48`                     | スクロール先と画面上端の余白 (px)                                  |

## 開発

```bash
pnpm install

pnpm dev         # Vite dev サーバー (HMR)
pnpm watch       # dist へ都度ビルド
pnpm build       # dist/md-speaker.user.js + .meta.js を生成し、メタデータを検証
pnpm typecheck
pnpm lint
pnpm test
```

### ローカルの変更を実機で試す

`pnpm dev` は開発サーバーからスクリプトを読み込む方式です。
うまく動かない場合は `pnpm watch` でビルドし、
Tampermonkey のエディタに `dist/md-speaker.user.js` の内容を貼るのが確実です。

### 構成

```
src/
  main.ts        起動ガードと組み立てのみ
  config.ts      ポート・URL・分割長などの定数
  infra/         GM_xmlhttpRequest ラッパ / localStorage
  aivis/         AivisSpeech クライアント (audio_query → synthesis)
  text/          正規化と音声単位への分割
  dom/           .markdown-body の特定・テキスト抽出・スクロール
  model/         見出し索引と読み上げ単位の generator
  player/        Audio 再生と疑似ストリーミング制御
  ui/            パネル DOM と配線（DOM を触るのはここだけ）
```

依存は `config / text / dom / infra` → `aivis` → `model` → `player` → `ui` → `main`
の一方向で、`player` 以下は DOM の `<select>` や `<button>` を一切知りません。
詳細は [docs/DESIGN.md](docs/DESIGN.md) を参照してください。

## リリース

`main` が緑になっていることを確認して、

```bash
npm version patch   # or minor / major
git push --follow-tags
```

`v*` タグの push で GitHub Actions が
`dist/md-speaker.user.js` と `.meta.js` を Release に添付します。
`releases/latest/download/...` は常に最新を指すため、
インストール済みの環境は自動で更新されます。

## ライセンス

[MIT](LICENSE)
