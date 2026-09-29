// start.html（新しいスタートページ・案A「世界への扉」）のテスト。ブラウザも通信も使わない
// 実行: node --test test-start-page.mjs
// START_PAGE_ROOT を指定すると、そのフォルダの start.html と画像を調べる（壊した一時コピーで、テストが失敗できるかを確かめるため）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const REPO = dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.START_PAGE_ROOT || REPO;
const START = join(ROOT, 'start.html');
const WEBP = join(ROOT, 'assets', 'tomori-world-gateway.webp');
const HTML = existsSync(START) ? readFileSync(START, 'utf8') : '';
const CSS = (HTML.match(/<style>([\s\S]*?)<\/style>/) || [, ''])[1];
const CSS_CODE = CSS.replace(/\/\*[\s\S]*?\*\//g, '');
const BODY = (HTML.match(/<body>([\s\S]*?)<\/body>/) || [, ''])[1];
const VISIBLE_TEXT = BODY.replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, '').replace(/\s+/g, '');
// 収録版タグの時点のファイル（index.html と demo-world.html はそれと同じでなければならない）
const TAG = 'tv-recording-candidate-20260928';
const atTag = file => execFileSync('git', ['show', `${TAG}:${file}`], { cwd: REPO, maxBuffer: 64 * 1024 * 1024 }).toString('utf8');
const normalize = s => s.replace(/\r\n/g, '\n');

test('1. start.html がある', () => {
  assert.ok(existsSync(START), 'start.html is missing');
  assert.match(HTML, /^<!DOCTYPE html>/i);
});

test('2. index.html は収録版タグから変わっていない', () => {
  assert.equal(normalize(readFileSync(join(REPO, 'index.html'), 'utf8')), normalize(atTag('index.html')));
});

test('3. demo-world.html は収録版タグから変わっていない', () => {
  assert.equal(normalize(readFileSync(join(REPO, 'demo-world.html'), 'utf8')), normalize(atTag('demo-world.html')));
});

test('4・5. CTA はふつうの a 要素で、行き先は ./demo-world.html（JavaScript で移動しない）', () => {
  const ctas = [...BODY.matchAll(/<a\b[^>]*class="cta"[^>]*>([\s\S]*?)<\/a>/g)];
  assert.equal(ctas.length, 1, 'exactly one CTA link');
  assert.match(ctas[0][0], /href="\.\/demo-world\.html"/);
  assert.ok(!/<button\b/i.test(BODY), 'no button element for the CTA');
  assert.ok(!/<script\b/i.test(HTML), 'no script at all');
  assert.ok(!/\bon[a-z]+\s*=/i.test(BODY), 'no inline event handlers');
});

test('6. 主コピー・補助文・ボタンの文面が決めたとおり', () => {
  assert.ok(VISIBLE_TEXT.includes('きみの「気になった」が、世界をひらく。'));
  assert.ok(VISIBLE_TEXT.includes('写真の中で見つけたことを、ことばにしてみよう。'));
  assert.ok(VISIBLE_TEXT.includes('正解は、ひとつじゃない。'));
  assert.match(BODY, /<a class="cta" href="\.\/demo-world\.html">冒険をはじめる<\/a>/);
  assert.ok(VISIBLE_TEXT.includes('TOMORI'));
});

test('7. 子どもの画面に、AI・回答例・PIN・先生用画面・支援や費用・前の版の言葉を出さない', () => {
  const ng = ['AI', 'ＡＩ', 'やばい', 'すごい', 'うれしい', 'かなしい', 'こわい', '例：', 'PIN', '暗証', '先生', '支援', '寄付', '費用', '料金',
    'ダッシュボード', 'コイン', 'ガチャ', 'インベントリ', 'ミッション', '探究', '分析', '保護者', 'サポーター'];
  for (const w of ng) assert.ok(!VISIBLE_TEXT.includes(w), `visible text contains ${w}`);
  // 大人向けの導線はまだ置かない（空のリンクも、押せない文字も無い）
  assert.equal((BODY.match(/<a\b/g) || []).length, 1, 'only the CTA link');
  assert.ok(!/href="#?"|href="#"/.test(BODY));
});

test('8. 外部 URL・fetch・Worker・Three.js・CDN・外部フォント・解析ツールが無い', () => {
  const urls = [...HTML.matchAll(/\b(?:https?:)?\/\/[^\s"')<>]+/g)].map(m => m[0]);
  assert.deepEqual(urls, [], 'external URLs: ' + urls.join(', '));
  for (const w of ['fetch(', 'XMLHttpRequest', 'workers.dev', 'tomori-api', 'tomori-vocabulary', 'three', 'THREE', 'cdn', 'jsdelivr', 'googleapis', 'gstatic', '@import', '@font-face', 'gtag', 'analytics', 'importmap', 'navigator.sendBeacon']) {
    assert.ok(!HTML.includes(w), `contains ${w}`);
  }
  // 読み込む物は、ローカルの画像1枚と空のアイコンだけ
  const refs = [...HTML.matchAll(/(?:src|href)="([^"]+)"|url\("?([^")]+)"?\)/g)].map(m => m[1] || m[2]);
  assert.deepEqual(refs.sort(), ['./demo-world.html', 'assets/tomori-world-gateway.webp', 'data:,'].sort());
});

test('9. Cookie・localStorage・sessionStorage・IndexedDB を使わない', () => {
  for (const w of ['cookie', 'localStorage', 'sessionStorage', 'indexedDB']) assert.ok(!HTML.includes(w), w);
});

test('10. viewport は拡大を禁止していない', () => {
  const vp = HTML.match(/<meta name="viewport" content="([^"]+)">/);
  assert.ok(vp, 'viewport meta');
  assert.ok(!/user-scalable\s*=\s*(no|0)/i.test(vp[1]));
  assert.ok(!/maximum-scale\s*=\s*1(\.0)?\b/i.test(vp[1]));
  assert.match(HTML, /<html lang="ja">/);
});

test('11. h1 は1つで、main と文書の骨組みがある', () => {
  assert.equal((BODY.match(/<h1\b/g) || []).length, 1);
  assert.equal((BODY.match(/<main\b/g) || []).length, 1);
  assert.match(HTML, /<title>[^<]+<\/title>/);
  // 風景は装飾なので読み上げない
  assert.match(BODY, /<div class="scene" aria-hidden="true">/);
});

test('12. :focus-visible で、はっきりした枠を出す', () => {
  const m = CSS_CODE.match(/\.cta:focus-visible\s*\{([^}]*)\}/);
  assert.ok(m, '.cta:focus-visible rule');
  assert.match(m[1], /outline:\s*3px solid/);
});

test('13. prefers-reduced-motion で、装飾の動きをすべて止める', () => {
  const m = CSS_CODE.match(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/);
  assert.ok(m, 'reduced-motion block');
  assert.match(m[1], /animation:\s*none !important/);
  assert.match(m[1], /transition:\s*none !important/);
  // 動きは、光のゆらぎ1つだけ（点滅のような速い動きにしない）
  const anims = [...CSS_CODE.matchAll(/animation:\s*([a-z-]+)\s+([\d.]+)s/g)];
  assert.deepEqual(anims.map(a => a[1]), ['glow']);
  assert.ok(Number(anims[0][2]) >= 4, 'glow is slow');
});

test('14. 文字の大きさはどこでも 12px 以上', () => {
  const sizes = [...CSS_CODE.matchAll(/font-size:\s*([^;]+);/g)].map(m => m[1].trim());
  assert.ok(sizes.length > 5);
  for (const s of sizes) {
    const px = s.match(/^([\d.]+)px$/);
    assert.ok(px, `font-size must be plain px: ${s}`);
    assert.ok(Number(px[1]) >= 12, `font-size too small: ${s}`);
  }
});

test('15. CTA は、どの画面幅でも高さ・幅 44px 以上', () => {
  const heights = [...CSS_CODE.matchAll(/\.cta\s*\{[^}]*?min-height:\s*(\d+)px/g)].map(m => Number(m[1]));
  assert.ok(heights.length >= 1);
  for (const h of heights) assert.ok(h >= 44, `min-height ${h}`);
  assert.match(CSS_CODE, /\.cta\s*\{[^}]*min-width:\s*44px/);
});

test('16・17. WebP は 250KB 以下で、壊れていない（RIFF/WEBP・幅と高さを読める）', () => {
  assert.ok(existsSync(WEBP), 'webp missing');
  const size = statSync(WEBP).size;
  assert.ok(size > 1024 && size <= 250 * 1024, `size ${size}`);
  const b = readFileSync(WEBP);
  assert.equal(b.toString('ascii', 0, 4), 'RIFF');
  assert.equal(b.toString('ascii', 8, 12), 'WEBP');
  assert.equal(b.readUInt32LE(4) + 8, b.length, 'RIFF size matches file size');
  const chunk = b.toString('ascii', 12, 16);
  let w, h;
  if (chunk === 'VP8 ') { w = b.readUInt16LE(26) & 0x3fff; h = b.readUInt16LE(28) & 0x3fff; assert.equal(b.readUIntBE(23, 3), 0x9d012a, 'VP8 start code'); }
  else if (chunk === 'VP8L') { const v = b.readUInt32LE(21); w = (v & 0x3fff) + 1; h = ((v >> 14) & 0x3fff) + 1; }
  else if (chunk === 'VP8X') { w = b.readUIntLE(24, 3) + 1; h = b.readUIntLE(27, 3) + 1; }
  else assert.fail('unknown webp chunk ' + chunk);
  // PC の左 55%（2倍の画面）とスマホの上半分で、ぼけない大きさ
  assert.ok(w >= 1200 && h >= 1500, `${w}x${h}`);
});

test('18. 画像が読めなくても、CSS の空・草原・光のグラデーションで成り立つ', () => {
  const m = CSS_CODE.match(/\.scene\s*\{([\s\S]*?)\n\}/);
  assert.ok(m);
  assert.match(m[1], /url\("assets\/tomori-world-gateway\.webp"\),\s*radial-gradient\([\s\S]*?\),\s*linear-gradient\(to bottom, var\(--sky\)/);
  assert.match(m[1], /background-color:\s*var\(--sky\)/);
});

test('19. 決めた色を使う（主ボタンは #4a7f24 に白い文字）', () => {
  for (const [k, v] of [['--sky', '#a8d8ea'], ['--sky-pale', '#a9dbe6'], ['--cream', '#fef9f0'], ['--frame', '#e8d4a0'], ['--ink', '#3a3328'], ['--coral', '#e9786e'], ['--cta', '#4a7f24']]) {
    assert.match(CSS_CODE, new RegExp(`${k}:\\s*${v};`), k);
  }
  const cta = CSS_CODE.match(/\.cta\s*\{([^}]*)\}/)[1];
  assert.match(cta, /background:\s*var\(--cta\)/);
  assert.match(cta, /color:\s*#fff;/);
});
