// LANGUAGE-01：冒険の中で出会う言い回しのテスト。ブラウザも通信も使わない
// 出会う → 景色で意味がわかる → 別の場面でもう一度出会う → 自分で使う、がデータとして用意されているかを確かめる
// 実行: node --test test-language.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = dirname(fileURLToPath(import.meta.url));
const HTML = readFileSync(join(ROOT, 'demo-world.html'), 'utf8').replace(/\r\n/g, '\n');
const between = (s, a, b) => { const i = s.indexOf(a), j = s.indexOf(b, i + 1); assert.ok(i >= 0 && j > i, `markers ${a} / ${b}`); return s.slice(i, j); };
const code = s => s.split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n');
const CORE = between(HTML, '// TREASURE-CORE-BEGIN', '// TREASURE-CORE-END');
const UI = between(HTML, '// TREASURE-UI-BEGIN', '// TREASURE-UI-END');
const T = new Function(CORE + `
return { WORDS, wordsIn, treasureMeetWords, createTreasureState, restoreTreasure, treasureTalk, treasureMoreHint, treasureInspect, treasureLantern,
  TREASURE_HINTS, TREASURE_TALK, TREASURE_CLUES, TREASURE_CHEST, TREASURE_DECOYS, TREASURE_ITEMS, TREASURE_GUIDE, GREAT_TEXT, GIANT_TALK, GIANT_TOPICS, TREASURE_SPOTS };`)();
const texts = v => { const out = []; const walk = x => { if (typeof x === 'string') out.push(x); else if (x && typeof x === 'object') Object.values(x).forEach(walk); }; walk(v); return out; };
const ALL = texts([T.TREASURE_HINTS, T.TREASURE_TALK, T.TREASURE_CLUES, T.TREASURE_CHEST, T.TREASURE_DECOYS, T.TREASURE_ITEMS, T.TREASURE_GUIDE, T.GREAT_TEXT, T.GIANT_TALK]);
const ASPECTS = T.GIANT_TOPICS.flatMap(t => t.aspects);

test('1. 言い回しは6つ。どれも、読み方（必要なら）と短い意味を持ち、子どもが読める長さ', () => {
  assert.equal(T.WORDS.length, 6);
  assert.deepEqual(T.WORDS.map(w => w.id), ['madoromu', 'utsumuku', 'honoka', 'mabayui', 'sashikomu', 'kirameku']);
  for (const w of T.WORDS) {
    assert.ok(w.meaning.length >= 6 && w.meaning.length <= 30, w.word);
    assert.ok(w.forms.length && w.forms.every(f => w.word.startsWith(f) || w.word.includes(f)), w.word);
    if (/[一-龯]/.test(w.word)) assert.ok(w.reading, `${w.word} needs a reading`);
  }
  assert.ok(Object.isFrozen(T.WORDS));
});

test('2. どの言い回しも、2つ以上の場面で出会い（はじめて＋もう一度）、オオネに伝える答えでも使える', () => {
  for (const w of T.WORDS) {
    const scenes = ALL.filter(s => T.wordsIn(s).includes(w.id));
    assert.ok(scenes.length >= 2, `${w.word} appears in ${scenes.length} scenes`);
    assert.ok(ASPECTS.some(a => T.wordsIn(a).includes(w.id)), `${w.word} can be used when telling Oone`);
  }
});

test('3. 代表：「ほのかに」が門の手がかり。「まばゆく」とくらべられ、まばゆい花をしらべても罰はなく、進みもしない', () => {
  assert.match(T.TREASURE_HINTS.gate[0].text, /ほのかに光る花のそば/);
  assert.match(T.TREASURE_HINTS.gate[1].text, /まばゆく/);
  assert.match(T.GREAT_TEXT.gateEarly, /ほのかに光っている/);
  assert.match(T.GREAT_TEXT.gateLit, /まばゆく輝いた/);
  assert.match(T.TREASURE_GUIDE.giant, /ほのかに灯る石/);
  const st = T.createTreasureState();
  T.treasureTalk(st, 'popo'); for (const id of ['cat', 'bell', 'spring', 'chest']) T.treasureInspect(st, id); T.treasureLantern(st, true); T.treasureInspect(st, 'cave');
  const before = JSON.stringify(st);
  const r = T.treasureInspect(st, 'dazzle');
  assert.equal(r.kind, 'decoy'); assert.equal(r.hint, true); assert.equal(JSON.stringify(st), before, 'nothing changes');
  assert.match(T.GREAT_TEXT.dazzleHint, /ほのかに光る花/);
  assert.equal(T.treasureInspect(st, 'gate').kind, 'gateLit', 'the gate opens without typing any word');
  assert.equal(T.treasureInspect(st, 'dazzle').hint, false, 'the comparing line is only while searching');
  assert.deepEqual(T.GIANT_TOPICS.find(t => t.id === 'gate').aspects.slice(0, 2), ['ほのかに光っていた花', 'まばゆく輝いたもよう']);
});

test('4. 出会った言い回しと場面を記録する（同じ場面は1回・6場面まで・前の記録も読める）。書いたことばは残さない', () => {
  const st = T.createTreasureState();
  assert.deepEqual(st.words, {});
  assert.deepEqual(T.treasureMeetWords(st, 'ほのかに光る花と、まばゆく輝く花', 'ポポ'), ['honoka', 'mabayui']);
  assert.deepEqual(T.treasureMeetWords(st, 'ほのかに', 'ポポ'), []);
  T.treasureMeetWords(st, 'ほのかに', '古い石の門');
  assert.deepEqual(st.words.honoka, ['ポポ', '古い石の門']);
  for (let i = 0; i < 10; i++) T.treasureMeetWords(st, 'ほのかに', 'ばしょ' + i);
  assert.equal(st.words.honoka.length, 6);
  const back = T.restoreTreasure(JSON.parse(JSON.stringify({ ...st, v: 1 })));
  assert.deepEqual(back.words, st.words);
  const bad = T.restoreTreasure({ v: 1, words: { honoka: ['a', 3, '', 'x'.repeat(40)], unknown: ['z'], mabayui: 'no' } });
  assert.deepEqual(bad.words, { honoka: ['a'] });
  assert.deepEqual(T.restoreTreasure({ v: 1, started: true }).words, {}, 'old saves have no words');
});

test('5. ことばの説明は押したときだけ開く。冒険メモに「出会ったことば」。オオネで選んだ言い回しの意味が、その下に出る', () => {
  const ui = code(UI);
  assert.match(ui, /el\('talk-gloss'\)\.textContent = notes\.join\('\\n'\); el\('talk-gloss'\)\.style\.display = 'none';/);
  assert.match(ui, /el\('btn-talk-words'\)\.addEventListener\('click'/);
  assert.match(HTML, /id="btn-talk-words"[^>]*aria-expanded="false"/);
  assert.match(ui, /'出会った場面：' \+ st\.words\[w\.id\]\.join\('・'\)/);
  assert.match(ui, /const sel = gs\.aspect \? wordsIn\(gs\.aspect\) : \[\];/);
  assert.match(ui, /treasureMeetWords\(st, \(gs\.aspect \|\| ''\) \+ '\\n' \+ typed, 'オオネに伝えた'\)/);
});

test('6. 景色で意味がわかる：まばゆい花（明るく強く）・ほのかな花（うすくゆっくり）・差し込む光の筋・きらめく水面・まどろむねこ', () => {
  const ui = code(UI);
  assert.match(ui, /'Gate_FaintFlowers'/); assert.match(ui, /'Dazzle_Flowers'/);
  assert.match(ui, /great\.faint\.forEach\(\(g, i\) => \{ g\.material\.opacity = calm \? \.3 : \.24 \+ \.1 \* Math\.sin\(t \* 1\.1 \+ i\); \}\);/);
  assert.match(ui, /great\.dazzle\.forEach\(\(g, i\) => \{ g\.material\.opacity = calm \? \.95 : \.8 \+ \.2/);
  assert.match(ui, /'Clearing_Sunbeam'/);
  assert.match(ui, /great\.twinkle = new THREE\.InstancedMesh/);
  assert.match(ui, /catHead\.rotation\.z = \(t % 4\.3\) < \.18/);
});

test('7. 手間を減らす：演出はタップで先へ（ごほうびは先に保存）。オオネのところへもどったら、すぐ問い。文字の入力なしで最後まで進める', () => {
  const ui = code(UI);
  assert.match(ui, /canvas\.addEventListener\('pointerup', \(\) => \{ if \(ev && state === S\.EVENT && ev\.t > \.8\) ev\.t = Math\.max\(ev\.t, ev\.dur - \.25\); \}\);/);
  assert.match(ui, /step: from === 'wake' \? 'wake0' : 'ask1', back: from !== 'wake'/);
  assert.ok(!/'back'\) \{ line/.test(ui));
  // 選ぶだけで返事（固定のことば）→ タネ
  assert.match(ui, /if \(!typed\) \{ gs\.reply = giantReply\(label, aspect, false\);/);
  for (const t of T.GIANT_TOPICS) assert.equal(t.aspects.length, 3, t.id);
});
