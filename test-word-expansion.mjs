// Step 11L-D：深掘りの答えを受けとめて、ことばを一段広げる段階のテスト。ブラウザも通信も使わない
// 判定・広げる処理（WORD-EXPAND-BEGIN〜END）を取り出して動かし、画面の作り方（WORD-EXPAND-UI）をコードから確かめる
// 実行: node --test test-word-expansion.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = process.env.WORD_EXPANSION_ROOT || dirname(fileURLToPath(import.meta.url));
const HTML = readFileSync(join(ROOT, 'demo-world.html'), 'utf8').replace(/\r\n/g, '\n');
const between = (s, a, b) => { const i = s.indexOf(a), j = s.indexOf(b, i + 1); assert.ok(i >= 0 && j > i, `markers ${a} / ${b}`); return s.slice(i, j); };
const CORE = between(HTML, '// WORD-EXPAND-BEGIN', '// WORD-EXPAND-END');
const UI = between(HTML, '// WORD-EXPAND-UI', '\nlet secretSent = false;');
const X = new Function(CORE + '\nreturn { classifyAnswer, aspectOf, expandAnswer, finalLine, EXPAND_ASPECTS, EXPAND_SPECIAL, EXPAND_ONE_KNOWN, EXPAND_START };')();
const MOVES = new Set(['detail', 'reason', 'compare', 'evidence', 'imagination']);
const BANNED = /すごいね|いいね|よく気づいたね|って感じたんだね|と思ったんだね/;

test('1〜5. 進めない答え：空・空白だけ・記号だけ・絵文字だけ・同じ文字だけ・入力欄の見本そのまま・読みとれない1文字', () => {
  assert.equal(X.classifyAnswer('').kind, 'empty');
  assert.equal(X.classifyAnswer('   　 ').kind, 'empty');
  for (const t of ['！', '!!', '。、', '…', '？？', '・']) assert.equal(X.classifyAnswer(t).kind, 'symbol', t);
  for (const t of ['😀', '🌸🌸', '✨']) assert.equal(X.classifyAnswer(t).kind, 'symbol', t);
  for (const t of ['ああああ', 'wwww', 'んん']) assert.equal(X.classifyAnswer(t).kind, 'repeat', t);
  assert.equal(X.classifyAnswer('思ったことを書いてみよう').kind, 'placeholder');
  for (const t of ['あ', 'ん', 'w', 'x', '？あ']) assert.equal(X.classifyAnswer(t).kind, 'one-unknown', t);
  // 読みとれない1文字には、色・形・気持ちを足す書き出しを出す
  assert.deepEqual(X.EXPAND_START.map(x => x[0]), ['色を足す', '形を足す', '気持ちを足す']);
});

test('6. 意味のある1文字（赤・丸・光）は、こばまず、ことばを足す例を3つ出す', () => {
  assert.deepEqual(X.classifyAnswer('赤').words, ['赤い色', '明るい赤', '燃えるような赤']);
  assert.deepEqual(X.classifyAnswer('丸').words, ['丸い形', 'ころんと丸い', 'やわらかく丸い']);
  assert.deepEqual(X.classifyAnswer('光').words, ['やさしい光', 'きらきらした光', 'あたたかい光']);
  assert.equal(X.classifyAnswer('赤！').kind, 'one-known');
  assert.match(UI, /'「' \+ c\.ch \+ '」って感じたんだね。もうひとこと足すと、もっと伝わりそう！'/);
  assert.ok(!/間違い|短すぎ/.test(UI));
});

test('7. 意味のある答えは、復唱で終わらない：観点・程度・理由を一段深めるひとことを出す（すごいね・いいね だけにしない）', () => {
  const cases = { '丸いところが可愛い': 'shape', '赤い': 'color', 'ゆっくり動いていた': 'motion', '寂しそう': 'story', '寝ているところが、安心しているように見えた': 'story' };
  for (const [t, aspect] of Object.entries(cases)) {
    assert.equal(X.classifyAnswer(t).kind, 'ok', t);
    const ex = X.expandAnswer(t, 'observation', null);
    assert.ok(ex.insight && Array.from(ex.insight).length <= 45, t);
    assert.ok(!ex.insight.includes(t) && !BANNED.test(ex.insight), `no echo: ${t}`);
    assert.ok(MOVES.has(ex.move), t);
  }
  assert.equal(X.expandAnswer('赤い', 'observation').insight, '同じ赤でも、明るさや深さで印象が変わるよ。');
  assert.equal(X.expandAnswer('丸いところが可愛い', 'observation').insight, '丸さが、やわらかく親しみやすい印象を作っているのかも。');
  assert.equal(X.expandAnswer('ゆっくり動いていた', 'observation').insight, '速さに気づくと、その生き物の気分まで想像できそう。');
  assert.equal(X.expandAnswer('寂しそう', 'feeling').insight, '表情や姿勢のどこから、そう感じたのだろう？');
  // 端末の中の、観点ごとのひとこと（AI を使えないときも、復唱しない）
  for (const a of Object.values(X.EXPAND_ASPECTS)) { assert.ok(!BANNED.test(a.insight)); assert.ok(MOVES.has(a.move)); }
  for (const [, v] of X.EXPAND_SPECIAL) { assert.ok(!BANNED.test(v.insight)); assert.ok(MOVES.has(v.move)); }
});

test('8. 感想だけの答え（可愛い・きれい）は、先に「形・色・動き」のどれかを聞く。選ぶと、その観点の候補になる', () => {
  for (const t of ['可愛い', 'かわいい', 'きれい', 'とても可愛い', 'すごい']) assert.equal(X.classifyAnswer(t).kind, 'vague', t);
  assert.match(UI, /'どんなところが、そう感じさせたのかな？'/);
  assert.match(UI, /EXPAND_ASK\.forEach/);
  assert.deepEqual(X.expandAnswer('可愛い', 'observation', 'shape').words, ['ころんと丸くて可愛い', 'ふっくらして可愛い', 'やわらかな輪郭が可愛い']);
  assert.deepEqual(X.expandAnswer('可愛い', 'observation', 'color').words, ['明るい色が可愛い', 'あたたかい色が可愛い', '目をひく色合いが可愛い']);
  // 十分くわしい答えには、問いを足さずに候補へ進む
  assert.equal(X.classifyAnswer('丸いところが可愛い').kind, 'ok');
});

test('9. 候補は3つ（重ならない・18文字以内・入力より長いか別の言い方）。最後に「自分の言葉のまま」を必ず置く', () => {
  const inputs = ['丸いところが可愛い', '赤い', 'ゆっくり動いていた', '寂しそう', '寝ているところが、安心しているように見えた', '大きい', 'うれしい', '飛びそう'];
  for (const t of inputs) for (const mode of ['feeling', 'observation', 'story']) {
    const w = X.expandAnswer(t, mode, null).words;
    assert.equal(w.length, 3, t); assert.equal(new Set(w).size, 3, t);
    for (const x of w) { assert.ok(Array.from(x).length <= 18, x); assert.ok(x !== t, x); assert.ok(!/[<>&]/.test(x), x); }
  }
  assert.match(UI, /\.concat\(\[\{ word: null, label: '自分の言葉のまま' \}\]\)/);
  assert.equal(X.aspectOf('ゆっくり歩く', 'observation'), 'motion');
  assert.equal(X.aspectOf('なにか', 'feeling'), 'feeling');
  assert.equal(X.aspectOf('なにか', 'story'), 'story');
});

test('10. タネは、ことばを決めたあとにだけ生まれる（送っただけでは生まれない）', () => {
  const reveal = between(HTML, 'window.revealSecret = ()=>{', '\n};');
  assert.ok(!/setState\(S\.DEMO_COMPLETE\)|bloomSeq/.test(reveal), 'not on send');
  assert.match(reveal, /if\(c\.kind !== 'ok' && c\.kind !== 'vague'\)\{ showSecretHint\(c\); return; \}/);
  assert.match(reveal, /showExpansion\(text, c\);/);
  assert.match(UI, /const ok = secretChip\('これにする', 'btn-primary btn-disabled', \(\) => \{ if \(picked\) confirmSecretWord\(text, picked\.word\); \}\);/);
  assert.match(UI, /worldTimeout\(finishSecret, 1600\);/);
  assert.match(between(HTML, 'function finishSecret(){', '\n}\n'), /if\(state !== S\.SECRET_UNLOCKED \|\| secretDone\) return;\s*secretDone = true;/);
});

test('11. 子どもの答え・候補・ひとことは textContent で出す（HTML として入れない）。通信・保存・console を足さない', () => {
  const code = CORE + UI;
  assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write/.test(code));
  assert.ok(!/fetch\(|XMLHttpRequest|localStorage|sessionStorage|console\./.test(code));
  assert.match(UI, /b\.textContent = text;/);
  assert.match(UI, /d\.textContent = finalLine\(text, chosen\);/);
  // 通信は WORD-EXPAND の外（EXPAND-AI・Step 11L-F）にだけ足す。全体では語彙カードと /expand の2か所
  assert.equal((HTML.match(/\bfetch\(/g) || []).length, 2);
});

test('12. 決めたあとのことば：広げたことばを選んだときと、自分の言葉のままのとき（長い答えは22文字で切る）', () => {
  assert.equal(X.finalLine('可愛い', 'ころんと丸くて可愛い'), '「可愛い」から「ころんと丸くて可愛い」へ、ことばが広がった！');
  assert.equal(X.finalLine('丸いところが可愛い', null), '「丸いところが可愛い」。きみが見つけた、大切なことばだね。');
  const long = 'あいうえおかきくけこさしすせそたちつてとなにぬねの';
  assert.ok(X.finalLine(long, null).startsWith('「' + Array.from(long).slice(0, 22).join('') + '…」'));
});

test('13. 同じパネルの中で切りかえる：問いの部品を隠してから、受けとめと候補を出す（問いを同時に2つ出さない）', () => {
  assert.match(UI, /secretQuestionParts\(\)\.forEach\(e => \{ if \(e\) e\.style\.display = 'none'; \}\);/);
  assert.match(UI, /function restoreSecretPanel\(\) \{\s*secretSent = false; secretDone = false;/);
  // 候補が多くても、パネルの中だけがスクロールする（.panel は max-height:82vh; overflow-y:auto）
  assert.match(HTML, /max-height:82vh; overflow-y:auto;/);
});
