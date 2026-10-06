// Step 11L-C：スマホで質問パネルが二重に見え、答えたあとも残る不具合の回帰テスト。ブラウザも通信も使わない
// 原因：iPhone はキーボードを出すとページを上へずらす。出ていないパネルは「下へずらす」だけで隠していたので、ずれた画面に入って見えたまま残った
// 実行: node --test test-mobile-panels.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = process.env.MOBILE_PANELS_ROOT || dirname(fileURLToPath(import.meta.url));
const HTML = readFileSync(join(ROOT, 'demo-world.html'), 'utf8').replace(/\r\n/g, '\n');
const between = (s, a, b) => { const i = s.indexOf(a), j = s.indexOf(b, i + 1); assert.ok(i >= 0 && j > i, `markers ${a} / ${b}`); return s.slice(i, j); };
const APPLY = between(HTML, 'function applyUI() {', '\nfunction openPanel(');
const OPEN = between(HTML, 'function openPanel(id) {', '\n}\n');
const REVEAL = between(HTML, 'window.revealSecret = ()=>{', '\n};');
const FINISH = between(HTML, 'function finishSecret(){', '\n}\n');
const RESET = between(HTML, 'function doReset(){', '\n}\n');

// 深掘りの答えを送る処理と、決めたあとの処理を、画面の代わりの小さな部品で動かす（判定・広げる処理は呼んだ回数だけ数える）
function makeEnv(stateName = 'SECRET_UNLOCKED', kind = 'ok') {
  const els = {}, log = { timeouts: [], blooms: 0, scrolls: 0, expands: 0, hints: 0 };
  const el = id => els[id] || (els[id] = { id, value: '', inert: false, attrs: {}, blurred: 0, classes: new Set(['show']),
    classList: { add: c => els[id].classes.add(c), remove: c => els[id].classes.delete(c), contains: c => els[id].classes.has(c), toggle: (c, on) => on ? els[id].classes.add(c) : els[id].classes.delete(c) },
    setAttribute: (k, v) => { els[id].attrs[k] = v; }, blur: () => { els[id].blurred++; } });
  const S = { SECRET_UNLOCKED: 'SECRET_UNLOCKED', DEMO_COMPLETE: 'DEMO_COMPLETE' };
  const fn = new Function('document', 'S', 'ctxState', 'worldTimeout', 'mkFlower', 'flowerGroup', 'bloomSeq', 'resetPageScroll', 'nextGroup', 'setState', 'classifyAnswer', 'showSecretHint', 'showExpansion',
    `let state = ctxState; let secretSent = false, secretDone = false; const window = {};
     ${REVEAL}\n};
     ${FINISH}\n}
     return { send: () => window.revealSecret(), finish: () => finishSecret(), sent: () => secretSent, done: () => secretDone };`);
  const api = fn({ getElementById: el }, S, S[stateName] || stateName, (f, ms) => log.timeouts.push(ms), () => ({}), { add: () => {} }, () => { log.blooms++; }, () => { log.scrolls++; }, {}, () => {},
    () => ({ kind }), () => { log.hints++; }, () => { log.expands++; });
  return { els, el, log, api };
}

test('1. 出ていないパネルは見えない（下へずらすだけにしない）。出ているパネルだけが見える', () => {
  assert.match(HTML, /\.panel \{[^}]*visibility:hidden;\s*\}/);
  assert.match(HTML, /\.panel\.show \{ transform:translateY\(0\); visibility:visible;/);
  // 下へ戻る動き（0.4秒）のあとで消える。出るときはすぐ見える
  assert.match(HTML, /transition:transform \.4s cubic-bezier\(\.22,\.68,0,1\.2\), visibility 0s linear \.4s;/);
  assert.match(HTML, /padding:20px 20px calc\(36px \+ env\(safe-area-inset-bottom, 0px\)\);/);
});

test('2. 状態が変わるたびに、すべてのパネルを閉じて、さわれない・読み上げない状態にする。出すのは今の状態のパネル1つだけ', () => {
  assert.match(APPLY, /document\.querySelectorAll\('\.panel'\)\.forEach\(p => \{ p\.classList\.remove\('show'\); p\.inert = true; p\.setAttribute\('aria-hidden', 'true'\); \}\);/);
  assert.match(OPEN, /el\.inert = false; el\.removeAttribute\('aria-hidden'\);/);
  // 予約したあとに状態が先へ進んでいたら出さない（古いパネルが出直さない）
  assert.match(OPEN, /requestAnimationFrame\(\(\) => \{ if \(state === at\) el\.classList\.add\('show'\); \}\);/);
  // どの状態でも openPanel は1回まで
  const cases = APPLY.split('case S.').slice(1);
  for (const c of cases) assert.ok((c.match(/openPanel\(/g) || []).length <= 1, c.slice(0, 30));
});

test('3. 送ると、同じパネルの中で受けとめと候補へ切りかえる（問いを2つ出さない）。決めたら、すぐパネルを閉じてタネへ進む', () => {
  const env = makeEnv(); env.el('secret-input').value = '丸いところが可愛い';
  env.api.send();
  assert.equal(env.log.expands, 1, 'expansion step shown');
  assert.equal(env.el('secret-input').blurred, 1);
  assert.equal(env.log.scrolls, 1);
  assert.equal(env.log.blooms, 0, 'no seed before the word is decided');
  env.api.finish();
  const p = env.el('panel-secret-t');
  assert.ok(!p.classes.has('show') && p.inert && p.attrs['aria-hidden'] === 'true', 'panel closed');
  assert.equal(env.log.blooms, 1); assert.deepEqual(env.log.timeouts, [900]);
});

test('4. 連打・Enter と押すの重なりでも、広げる段階も、タネへ進むのも1回だけ', () => {
  const env = makeEnv(); env.el('secret-input').value = '丸いところが可愛い';
  env.api.send(); env.api.send(); env.api.send();
  assert.equal(env.log.expands, 1);
  env.api.finish(); env.api.finish();
  assert.equal(env.log.blooms, 1); assert.deepEqual(env.log.timeouts, [900]);
});

test('5. 空の答え・ほかの状態では送らない。短すぎる・記号だけの答えは、案内を出して進まない', () => {
  const empty = makeEnv(); empty.el('secret-input').value = '   ';
  empty.api.send(); assert.equal(empty.log.expands + empty.log.hints, 0);
  const other = makeEnv('DEMO_COMPLETE'); other.el('secret-input').value = 'ある';
  other.api.send(); assert.equal(other.log.expands, 0);
  for (const kind of ['symbol', 'repeat', 'placeholder', 'one-known', 'one-unknown']) {
    const e = makeEnv('SECRET_UNLOCKED', kind); e.el('secret-input').value = 'x';
    e.api.send(); assert.equal(e.log.hints, 1, kind); assert.equal(e.log.expands, 0, kind); assert.equal(e.api.sent(), false, kind);
  }
});


test('6. Enter で送る。日本語の変換を確定する Enter（isComposing・229）と Shift+Enter では送らない', () => {
  const kd = between(HTML, "document.getElementById('secret-input').addEventListener('keydown', e => {", '\n});');
  assert.match(kd, /if \(e\.key !== 'Enter' \|\| e\.shiftKey \|\| e\.isComposing \|\| e\.keyCode === 229\) return;/);
  assert.match(kd, /e\.preventDefault\(\); window\.revealSecret\(\);/);
  const run = ev => { let sent = 0; const window = { revealSecret: () => sent++ }; new Function('e', 'window', kd.slice(kd.indexOf('{') + 1))({ preventDefault() {}, ...ev }, window); return sent; };
  assert.equal(run({ key: 'Enter' }), 1);
  assert.equal(run({ key: 'Enter', isComposing: true }), 0);
  assert.equal(run({ key: 'Enter', keyCode: 229 }), 0);
  assert.equal(run({ key: 'Enter', shiftKey: true }), 0);
  assert.equal(run({ key: 'a' }), 0);
});

test('7. ずれたページを戻す：状態が変わったとき・入力欄からフォーカスが外れたとき（別の入力欄へ移るときは戻さない）', () => {
  assert.match(APPLY, /resetPageScroll\(\);/);
  assert.match(HTML, /function resetPageScroll\(\) \{\s*if \(window\.scrollY \|\| document\.scrollingElement\.scrollTop\) \{ window\.scrollTo\(0, 0\); document\.scrollingElement\.scrollTop = 0; \}/);
  assert.match(HTML, /document\.addEventListener\('focusout', e => \{/);
  assert.match(HTML, /if \(!a \|\| !\/\^\(TEXTAREA\|INPUT\)\$\/\.test\(a\.tagName\)\) resetPageScroll\(\);/);
});

test('8. 答える画面へ入るたび・リセットで、問いの画面を最初の形へ戻す（答え・候補・選んだしるしを消す）', () => {
  assert.match(HTML, /window\.toSecretText = \(\)=>\{ restoreSecretPanel\(\); setState\(S\.SECRET_UNLOCKED\); \};/);
  assert.match(RESET, /restoreSecretPanel\(\);/);
  assert.match(RESET, /setState\(S\.EXPLORE\);/);
  assert.match(HTML, /function restoreSecretPanel\(\) \{\s*secretSent = false; secretDone = false;/);
});

test('9. care・429・端末内の候補の流れは、同じパネルと同じ閉じ方を使う（通信は増やさない）', () => {
  assert.match(between(HTML, 'function applyUI() {', '\nfunction openPanel('), /case S\.WORDS_READY:\s*openPanel\('panel-words'\);/);
  assert.match(FINISH, /worldTimeout\(\(\)=>\{ nextGroup\.visible=true; setState\(S\.DEMO_COMPLETE\); \},900\);/);
  assert.equal((HTML.match(/\bfetch\(/g) || []).length, 1, 'no new network');
});
