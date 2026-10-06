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
const RESET = between(HTML, 'function doReset(){', '\n}\n');

// 深掘りの答えを送る処理を、画面の代わりの小さな部品で動かす
function makeEnv(stateName = 'SECRET_UNLOCKED') {
  const els = {}, log = { timeouts: [], blooms: 0, scrolls: 0 };
  const el = id => els[id] || (els[id] = { id, value: '', inert: false, attrs: {}, blurred: 0, classes: new Set(['show']),
    classList: { add: c => els[id].classes.add(c), remove: c => els[id].classes.delete(c), contains: c => els[id].classes.has(c), toggle: (c, on) => on ? els[id].classes.add(c) : els[id].classes.delete(c) },
    setAttribute: (k, v) => { els[id].attrs[k] = v; }, blur: () => { els[id].blurred++; } });
  const S = { SECRET_UNLOCKED: 'SECRET_UNLOCKED', DEMO_COMPLETE: 'DEMO_COMPLETE' };
  const ctx = { state: S[stateName] || stateName, secretSent: false };
  const fn = new Function('document', 'S', 'ctx', 'worldTimeout', 'mkFlower', 'flowerGroup', 'bloomSeq', 'resetPageScroll', 'nextGroup', 'setState',
    `let state = ctx.state; let secretSent = ctx.secretSent; const window = {};
     ${REVEAL}\n};
     return { send: () => { window.revealSecret(); ctx.secretSent = secretSent; }, sent: () => secretSent };`);
  const api = fn({ getElementById: el }, S, ctx, (f, ms) => log.timeouts.push(ms), () => ({}), { add: () => {} }, () => { log.blooms++; }, () => { log.scrolls++; }, {}, () => {});
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

test('3. 送るとすぐ質問パネルを閉じる（花が咲き終わるのを待たない）。キーボードを閉じ、ずれたページを戻す', () => {
  const env = makeEnv(); env.el('secret-input').value = '可愛い';
  env.api.send();
  const p = env.el('panel-secret-t');
  assert.ok(!p.classes.has('show') && p.inert && p.attrs['aria-hidden'] === 'true', 'panel closed');
  assert.equal(env.el('secret-input').blurred, 1);
  assert.equal(env.log.scrolls, 1);
  assert.ok(env.el('btn-secret-next').classes.has('btn-disabled'));
});

test('4. 連打・Enter と押すの重なりでも、送るのは1回だけ（花も状態の切りかえも1回）', () => {
  const env = makeEnv(); env.el('secret-input').value = '可愛い';
  env.api.send(); env.api.send(); env.api.send();
  assert.equal(env.log.blooms, 1);
  assert.deepEqual(env.log.timeouts, [900]);
  assert.equal(env.api.sent(), true);
});

test('5. 空の答え・ほかの状態では送らない', () => {
  const empty = makeEnv(); empty.el('secret-input').value = '   ';
  empty.api.send(); assert.equal(empty.log.blooms, 0); assert.ok(empty.el('panel-secret-t').classes.has('show'));
  const other = makeEnv('DEMO_COMPLETE'); other.el('secret-input').value = 'ある';
  other.api.send(); assert.equal(other.log.blooms, 0);
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

test('8. 答える画面へ入るたび・リセットで、送った印を戻す（2回目の冒険でも送れる。古い質問は残らない）', () => {
  assert.match(HTML, /window\.toSecretText = \(\)=>\{ secretSent = false; setState\(S\.SECRET_UNLOCKED\); \};/);
  assert.match(RESET, /secretSent = false;/);
  assert.match(RESET, /setState\(S\.EXPLORE\);/);
});

test('9. care・429・端末内の候補の流れは、同じパネルと同じ閉じ方を使う（ほかの変更はない）', () => {
  // care も言葉カードも panel-words（1つ）。状態が変わると applyUI がすべて閉じる
  assert.match(APPLY, /case S\.WORDS_READY:\s*openPanel\('panel-words'\);/);
  assert.match(REVEAL, /worldTimeout\(\(\)=>\{ nextGroup\.visible=true; setState\(S\.DEMO_COMPLETE\); \},900\);/);
  assert.equal((HTML.match(/\bfetch\(/g) || []).length, 1, 'no new network');
});
