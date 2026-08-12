#!/usr/bin/env node
/**
 * ビルド成果物の userscript メタデータブロックを検証する。
 *
 * メタデータの欠落は「ビルドは通るのに実行時に壊れる」典型なので、
 * CI で必ず止める。特に @connect が欠けると通信が全て失敗する。
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DIST = 'dist';
const USER_JS = 'md-speaker.user.js';
const META_JS = 'md-speaker.meta.js';

const REQUIRED = {
  grant: ['GM_xmlhttpRequest'],
  connect: ['127.0.0.1'],
  match: ['http://localhost/*', 'http://127.0.0.1/*'],
};

const SINGLE = ['name', 'namespace', 'version', 'downloadURL', 'updateURL'];

const errors = [];

function fail(message) {
  errors.push(message);
}

/** メタデータブロックを `{ key: string[] }` へパースする。 */
function parseMetadata(source, label) {
  const start = source.indexOf('// ==UserScript==');
  const end = source.indexOf('// ==/UserScript==');

  if (start === -1 || end === -1 || end < start) {
    fail(`${label}: メタデータブロックが見つかりません`);
    return null;
  }

  const meta = {};

  for (const line of source.slice(start, end).split('\n')) {
    const matched = /^\s*\/\/\s*@(\S+)\s*(.*)$/.exec(line);

    if (!matched) {
      continue;
    }

    const [, key, value] = matched;

    (meta[key] ??= []).push(value.trim());
  }

  return meta;
}

function checkMetadata(meta, label, expectedVersion) {
  for (const key of SINGLE) {
    const values = meta[key] ?? [];

    if (values.length !== 1 || !values[0]) {
      fail(`${label}: @${key} が 1 行だけ存在すること (実際: ${JSON.stringify(values)})`);
    }
  }

  for (const [key, expected] of Object.entries(REQUIRED)) {
    const values = meta[key] ?? [];

    for (const item of expected) {
      if (!values.includes(item)) {
        fail(`${label}: @${key} に "${item}" がありません (実際: ${JSON.stringify(values)})`);
      }
    }
  }

  const version = meta.version?.[0];

  if (version && version !== expectedVersion) {
    fail(`${label}: @version ${version} が package.json の ${expectedVersion} と一致しません`);
  }

  for (const key of ['downloadURL', 'updateURL']) {
    const url = meta[key]?.[0] ?? '';

    if (url && !url.startsWith('https://')) {
      fail(`${label}: @${key} は https:// で始まること (実際: ${url})`);
    }
  }
}

// ------------------------------------------------------------------

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));

let files;

try {
  files = readdirSync(DIST);
} catch {
  console.error(`${DIST}/ がありません。先に vite build を実行してください。`);
  process.exit(1);
}

// userscript は単一ファイルでなければならない（コード分割の検知）。
const jsFiles = files.filter((file) => file.endsWith('.js'));
const unexpected = jsFiles.filter((file) => file !== USER_JS && file !== META_JS);

if (unexpected.length > 0) {
  fail(`dist に想定外の JS があります (コード分割の可能性): ${unexpected.join(', ')}`);
}

for (const [file, label] of [
  [USER_JS, 'user.js'],
  [META_JS, 'meta.js'],
]) {
  if (!files.includes(file)) {
    fail(`${label}: ${join(DIST, file)} が出力されていません`);
    continue;
  }

  const source = readFileSync(join(DIST, file), 'utf8');
  const meta = parseMetadata(source, label);

  if (meta) {
    checkMetadata(meta, label, pkg.version);
  }
}

if (errors.length > 0) {
  console.error('userscript メタデータの検証に失敗しました:');

  for (const error of errors) {
    console.error(`  - ${error}`);
  }

  process.exit(1);
}

console.log(`userscript メタデータ検証 OK (version ${pkg.version})`);
