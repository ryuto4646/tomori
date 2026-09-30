// 新しいスタートページ（案A「世界への扉」）のテスト。ブラウザも通信も使わない
// Step 11C から、正本はルートの index.html（Step 11B の start.html をそのまま移したもの）。旧アプリは legacy-app.html
// 実行: node --test test-start-page.mjs
// START_PAGE_ROOT を指定すると、そのフォルダの index.html と画像を調べる（壊した一時コピーで、テストが失敗できるかを確かめるため）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const REPO = dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.START_PAGE_ROOT || REPO;
const START = join(ROOT, 'index.html');
const WEBP = join(ROOT, 'assets', 'tomori-world-gateway.webp');
const HTML = existsSync(START) ? readFileSync(START, 'utf8') : '';
const CSS = (HTML.match(/<style>([\s\S]*?)<\/style>/) || [, ''])[1];
const CSS_CODE = CSS.replace(/\/\*[\s\S]*?\*\//g, '');
const BODY = (HTML.match(/<body>([\s\S]*?)<\/body>/) || [, ''])[1];
const VISIBLE_TEXT = BODY.replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, '').replace(/\s+/g, '');
// 収録版タグの時点のファイル（demo-world.html などはそれと同じでなければならない）
const TAG = 'tv-recording-candidate-20260928';
// Step 11B で承認された start.html（このコミットの内容が、新しい index.html の正本）
const APPROVED = 'febcae9';
const gitShow = (rev, file) => execFileSync('git', ['show', `${rev}:${file}`], { cwd: REPO, maxBuffer: 64 * 1024 * 1024 }).toString('utf8');
const atTag = file => gitShow(TAG, file);
const normalize = s => s.replace(/\r\n/g, '\n');

test('1. index.html が、Step 11B で承認した新しいスタートページそのもの', () => {
  assert.ok(existsSync(START), 'index.html is missing');
  assert.match(HTML, /^<!DOCTYPE html>/i);
  if (ROOT === REPO) assert.equal(normalize(HTML), normalize(gitShow(APPROVED, 'start.html')));
});

test('2. start.html は残っていない（index.html だけが正本）', () => {
  assert.ok(!existsSync(join(REPO, 'start.html')));
});

test('2b. 旧アプリは legacy-app.html に、中身を削らずに保存されている', () => {
  const legacy = join(REPO, 'legacy-app.html');
  assert.ok(existsSync(legacy), 'legacy-app.html is missing');
  assert.equal(normalize(readFileSync(legacy, 'utf8')), normalize(atTag('index.html')));
  // 新しいスタートページから旧アプリへのリンクは置かない
  assert.ok(!HTML.includes('legacy-app'));
});

// Step 11D で demo-world.html に入れた変更は、WebGL が使えないときの画面（#no-webgl）の2か所だけ。
// この2か所を元に戻すと、収録版タグの時点のファイルとまったく同じになる
const NO_WEBGL_CSS_NEW = `/* 3D を使えないときだけ出す「3Dを使わずに続ける」。押しやすく、読みやすい濃さにする。
   非対応画面は、3D 用の UI（z-index:10）より前に出して、歩く案内やボタンを隠す */
#no-webgl { z-index:30; }
#no-webgl a {
  display:inline-flex; align-items:center; justify-content:center;
  min-height:48px; min-width:44px; padding:12px 24px; border-radius:24px;
  background:#4a7f24; color:#fff; font-size:16px; font-weight:bold; text-decoration:none;
}
#no-webgl a:focus-visible { outline:3px solid #3a3328; outline-offset:4px; }`;
const NO_WEBGL_CSS_OLD = '#no-webgl a { color:#7ab648; }';
const NO_WEBGL_LINK_NEW = '<a href="./legacy-app.html">3Dを使わずに続ける</a>';
const NO_WEBGL_LINK_OLD = '<a href="index.html">← 通常モードで続ける</a>';
const NO_WEBGL_FOCUS_NEW = `    document.getElementById('no-webgl').style.display = 'flex';
    // 後ろに隠れた 3D 用のボタンより先に、キーボードで「3Dを使わずに続ける」へ届くようにする
    document.querySelector('#no-webgl a').focus();`;
const NO_WEBGL_FOCUS_OLD = `    document.getElementById('no-webgl').style.display = 'flex';`;
const DEMO_NOW = () => normalize(readFileSync(join(REPO, 'demo-world.html'), 'utf8'));

test('3. demo-world.html は WebGL 非対応画面の3か所だけが変わり、起動ファイル・手順書は収録版タグのまま', () => {
  const now = DEMO_NOW();
  assert.equal(now.split(NO_WEBGL_CSS_NEW).length - 1, 1, 'new fallback CSS appears once');
  assert.equal(now.split(NO_WEBGL_LINK_NEW).length - 1, 1, 'new fallback link appears once');
  assert.equal(now.split(NO_WEBGL_FOCUS_NEW).length - 1, 1, 'fallback focus appears once');
  assert.equal(now.replace(NO_WEBGL_CSS_NEW, NO_WEBGL_CSS_OLD).replace(NO_WEBGL_LINK_NEW, NO_WEBGL_LINK_OLD).replace(NO_WEBGL_FOCUS_NEW, NO_WEBGL_FOCUS_OLD),
    normalize(atTag('demo-world.html')));
  for (const f of ['start-tv-demo.cmd', 'docs/TV_RECORDING_RUNBOOK.md']) {
    assert.equal(normalize(readFileSync(join(REPO, f), 'utf8')), normalize(atTag(f)), f);
  }
  // 「← アプリへ」は index.html を指したまま（新しいスタートページへ戻る）
  assert.match(readFileSync(join(REPO, 'demo-world.html'), 'utf8'), /id="btn-back"\s+onclick="window\.location\.href='index\.html'"/);
});

test('3b. 収録版タグは 1890884 を指したまま・AI スイッチは true のまま', () => {
  const tagCommit = execFileSync('git', ['rev-parse', '--short', `${TAG}^{commit}`], { cwd: REPO }).toString().trim();
  assert.equal(tagCommit, '1890884');
  assert.match(readFileSync(join(REPO, 'demo-world.html'), 'utf8'), /const VOCABULARY_AI_ENABLED = true;/);
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

// ── Step 11D：WebGL が使えないときは、旧アプリ（legacy-app.html）へ進む ─────────────────
const STEP11C = 'e099fa3';
const noWebglBlock = () => (DEMO_NOW().match(/<div id="no-webgl"[^>]*>([\s\S]*?)<\/div>/) || [, ''])[1];

test('20. WebGL 非対応画面の文字は「3Dを使わずに続ける」で、ふつうの a 要素', () => {
  const block = noWebglBlock();
  const links = [...block.matchAll(/<a\b([^>]*)>([^<]*)<\/a>/g)];
  assert.equal(links.length, 1);
  assert.equal(links[0][2], '3Dを使わずに続ける');
  assert.ok(!/onclick|javascript:/i.test(block), 'no script in the fallback link');
});

test('21. その行き先は ./legacy-app.html で、index.html を指していない（ループしない）', () => {
  const block = noWebglBlock();
  assert.match(block, /<a href="\.\/legacy-app\.html">/);
  assert.ok(!/index\.html/.test(block), 'fallback must not point to index.html');
  assert.ok(existsSync(join(REPO, 'legacy-app.html')));
});

test('22. ふだんの「← アプリへ」は index.html、新しい index の CTA は ./demo-world.html のまま', () => {
  assert.match(DEMO_NOW(), /<button id="btn-back"\s+onclick="window\.location\.href='index\.html'">← アプリへ<\/button>/);
  if (ROOT === REPO) assert.match(HTML, /<a class="cta" href="\.\/demo-world\.html">冒険をはじめる<\/a>/);
});

test('23. legacy-app.html は収録版タグ時点の旧 index と同じ、index.html と WebP は Step 11C から変わっていない', () => {
  assert.equal(normalize(readFileSync(join(REPO, 'legacy-app.html'), 'utf8')), normalize(atTag('index.html')));
  assert.equal(normalize(readFileSync(join(REPO, 'index.html'), 'utf8')), normalize(gitShow(STEP11C, 'index.html')));
  const blobNow = execFileSync('git', ['hash-object', 'assets/tomori-world-gateway.webp'], { cwd: REPO }).toString().trim();
  const blobThen = execFileSync('git', ['rev-parse', `${STEP11C}:assets/tomori-world-gateway.webp`], { cwd: REPO }).toString().trim();
  assert.equal(blobNow, blobThen);
});

test('24. AI スイッチは true、収録版タグは 1890884 のまま', () => {
  assert.match(DEMO_NOW(), /const VOCABULARY_AI_ENABLED = true;/);
  assert.equal(execFileSync('git', ['rev-parse', '--short', `${TAG}^{commit}`], { cwd: REPO }).toString().trim(), '1890884');
});

test('25. innerHTML への代入や console の出力を増やしていない', () => {
  const count = (s, re) => (s.match(re) || []).length;
  const then = normalize(atTag('demo-world.html'));
  for (const re of [/\.innerHTML\s*=/g, /console\.[a-z]+\(/g, /<script\b/g, /onclick=/g]) {
    assert.equal(count(DEMO_NOW(), re), count(then, re), String(re));
  }
});

test('26. 非対応画面を出したときは、リンクへフォーカスを移す（WebGL チェックの catch の中だけ）', () => {
  const check = DEMO_NOW().match(/\/\/ ── WebGL チェック[\s\S]*?\}\)\(\);/)[0];
  assert.match(check, /catch \{[\s\S]*style\.display = 'flex';[\s\S]*document\.querySelector\('#no-webgl a'\)\.focus\(\);[\s\S]*throw new Error\('no webgl'\);/);
  assert.equal((DEMO_NOW().match(/\.focus\(\)/g) || []).length - (normalize(atTag('demo-world.html')).match(/\.focus\(\)/g) || []).length, 1);
});

test('27. 非対応画面は 3D 用の UI（z-index:10）より前に出る', () => {
  assert.match(DEMO_NOW(), /#no-webgl \{ z-index:30; \}/);
  assert.match(DEMO_NOW(), /#ui \{[^}]*z-index:10;/);
});
