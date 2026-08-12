import { defineConfig } from 'vite';
import monkey from 'vite-plugin-monkey';

const REPO = 'shono1103/md_speaker';
const RELEASE_BASE = `https://github.com/${REPO}/releases/latest/download`;

export default defineConfig({
  plugins: [
    monkey({
      entry: 'src/main.ts',
      userscript: {
        name: 'mdts AivisSpeech Reader',
        namespace: 'local.aivis.mdts',
        description: 'Read only mdts .markdown-body with AivisSpeech from a selected heading',
        author: 'shono1103',
        match: ['http://localhost/*', 'http://127.0.0.1/*'],
        connect: ['127.0.0.1'],
        grant: ['GM_xmlhttpRequest'],
        'run-at': 'document-idle',
        noframes: true,
        downloadURL: `${RELEASE_BASE}/md-speaker.user.js`,
        updateURL: `${RELEASE_BASE}/md-speaker.meta.js`,
      },
      build: {
        fileName: 'md-speaker.user.js',
        metaFileName: true,
        // @grant はコード走査で補完されるが、CI 側 (verify-metadata) でも必須項目を検証する。
        autoGrant: true,
      },
      server: {
        open: false,
      },
    }),
  ],
  build: {
    // userscript は単一ファイルでなければならない。
    target: 'esnext',
    minify: false,
  },
});
