// 世界変化の演出（demo-world.html）のテスト。ブラウザも three.js も使わず、偽の時計で動かす。
// 実行: node --test test-world-effects.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const HTML = readFileSync(new URL('./demo-world.html', import.meta.url), 'utf8');
function section(begin, end) {
  const s = HTML.indexOf(begin), e = HTML.indexOf(end);
  assert.ok(s >= 0 && e > s, `marker ${begin} not found`);
  return HTML.slice(HTML.indexOf('\n', s) + 1, e);
}
const CORE = section('// VOCAB-CORE-BEGIN', '// VOCAB-CORE-END');
const WORLD = section('// WORLD-FX-BEGIN', '// WORLD-FX-END');
const DOM = section('// VOCAB-DOM-BEGIN', '// VOCAB-DOM-END');

// ── 偽の時計（setTimeout / requestAnimationFrame / Date.now）──
function makeClock() {
  let now = 0, seq = 0;
  const timers = new Map(), frames = new Map();
  return {
    now: () => now,
    setTimeout: (fn, ms) => { const id = ++seq; timers.set(id, { at: now + (ms || 0), fn }); return id; },
    clearTimeout: id => { timers.delete(id); },
    requestAnimationFrame: fn => { const id = ++seq; frames.set(id, fn); return id; },
    cancelAnimationFrame: id => { frames.delete(id); },
    advance(ms, step = 16) {
      const end = now + ms;
      while (now < end) {
        now = Math.min(end, now + step);
        const fs = [...frames]; frames.clear();
        for (const [, f] of fs) f(now);
        for (const [id, t] of [...timers].sort((a, b) => a[1].at - b[1].at)) {
          if (t.at <= now && timers.has(id)) { timers.delete(id); t.fn(); }
        }
      }
    },
    pending: () => timers.size + frames.size,
  };
}

// ── 偽のDOM ──
class Node {
  constructor(tag, text = null) { this.tagName = tag; this._text = text; this.children = []; this.dataset = {}; this.style = {}; this.className = ''; this.parent = null;
    this.innerHTMLWrites = 0; const cls = new Set(); this.classList = { add: c => cls.add(c), remove: c => cls.delete(c), contains: c => cls.has(c) }; }
  appendChild(n) { n.parent = this; this.children.push(n); return n; }
  replaceChildren(...ns) { this.children = []; this._text = null; ns.forEach(n => this.appendChild(n)); }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(c => c !== this); }
  get textContent() { return this.children.length ? this.children.map(c => c.textContent).join('') : (this._text ?? ''); }
  set textContent(v) { this.children = []; this._text = String(v); }
  set innerHTML(v) { this.innerHTMLWrites++; }
  all() { return [this, ...this.children.flatMap(c => c.all())]; }
}
function makeDocument() {
  const ids = {};
  for (const id of ['overlay-world', 'word-announce', 'words-quote', 'words-pick-title', 'words-pick-sub', 'word-cards', 'secret-q-text', 'secret-t-title']) ids[id] = new Node('div');
  const body = new Node('body');
  return {
    ids, body,
    getElementById: id => ids[id] ?? null,
    createElement: tag => new Node(tag),
    createTextNode: t => new Node('#text', t),
    querySelectorAll: sel => sel === '.light-ring' ? body.children.filter(n => n.className === 'light-ring')
      : sel === '.word-card' ? ids['word-cards'].children : [],
  };
}

// ── 偽の3D（見える・見えない、花の大きさ）──
function makeWorld() {
  const flower = () => { const f = { history: [], scale: { v: 0, setScalar(s) { this.v = s; f.history.push(s); } } }; return f; };
  const mainFlowers = Array.from({ length: 12 }, flower), redFlowers = Array.from({ length: 18 }, flower);
  const flowerGroup = { children: [...mainFlowers, ...redFlowers], remove(f) { this.children = this.children.filter(c => c !== f); } };
  return { vineGroup: { visible: true }, newPath: { visible: false }, secretGroup: { visible: false }, nextGroup: { visible: false }, mainFlowers, redFlowers, flowerGroup };
}

function load() {
  const clock = makeClock(), doc = makeDocument(), w = makeWorld();
  const fetchCalls = [];
  const fetch = async (...a) => { fetchCalls.push(a); throw new Error('no network in tests'); };
  const app = new Function('document', 'setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'Date', 'fetch',
    'vineGroup', 'newPath', 'secretGroup', 'nextGroup', 'mainFlowers', 'redFlowers', 'flowerGroup', 'innerWidth', 'innerHeight', 'worldV2', `
    ${CORE}
    ${WORLD}
    const S = { WORDS_READY: 'WORDS_READY', WORD_SELECTED: 'WORD_SELECTED', SECRET_QUESTION: 'SECRET_QUESTION', EXPLORE: 'EXPLORE' };
    let state = 'WORDS_READY', chosenWord = '';
    const stateLog = [];
    function setState(s) { state = s; stateLog.push(s); }
    ${DOM}
    return { buildWords, resetWorldState, cancelWorldEffects, doWorldChange,
      setResult(r) { _vocabResult = r; _vocabFallback = !r; }, get state() { return state; }, set state(v) { state = v; },
      stateLog, get gen() { return _worldEffectGen; }, VOCABULARY_AI_ENABLED };`)(
    doc, clock.setTimeout, clock.clearTimeout, clock.requestAnimationFrame, clock.cancelAnimationFrame, { now: clock.now }, fetch,
    w.vineGroup, w.newPath, w.secretGroup, w.nextGroup, w.mainFlowers, w.redFlowers, w.flowerGroup, 375, 812, { isActive: () => false });   // V1 の世界の演出（Step 11N：V2 では V1 の道・赤い花を出さない）
  return { app, clock, doc, w, fetchCalls };
}
// 画面の「リセット」と同じ順番：世界を戻してから、探索の状態へ
function reset(env) { env.app.resetWorldState(); env.app.state = 'EXPLORE'; }
function pickFirstCard(env) {
  env.app.state = 'WORDS_READY';
  env.doc.ids['word-cards'].children[0].onclick();
}
const allFlowers = w => [...w.mainFlowers, ...w.redFlowers];
const bloomCount = f => { let n = 0, prev = 0; for (const v of f.history) { if (prev < 1 && v >= 1) n++; prev = v; } return n; };

test('1. HTMLのような語を選んでも、要素にならず文字として表示される', () => {
  const env = load();
  const evil = '<img src=x onerror=alert(1)>';
  env.app.setResult({ words: [{ word: evil, reading: '<b>よみ</b>', description: '<script>x</script>' }, { word: 'b', reading: 'b', description: 'b' }, { word: 'c', reading: 'c', description: 'c' }], followUpQuestion: 'その時、どんな音がした？' });
  env.app.buildWords('<i>入力</i>');
  pickFirstCard(env);
  env.clock.advance(500);
  const ann = env.doc.ids['word-announce'];
  assert.equal(ann.textContent, '『' + evil + '』が、世界をひらいた。');
  const tags = ann.all().map(n => n.tagName).filter(t => t !== 'div');
  assert.deepEqual([...new Set(tags)].sort(), ['#text', 'br']);
  const nodes = Object.values(env.doc.ids).flatMap(n => n.all());
  assert.ok(nodes.every(n => n.innerHTMLWrites === 0), 'innerHTML was written');
  assert.ok(!nodes.some(n => ['img', 'script', 'b', 'i'].includes(n.tagName)));
  assert.ok(env.doc.ids['overlay-world'].classList.contains('show'));
});

test('2. 選んだ直後（花が咲き始めたころ）にリセットし、演出より長く待っても花は残らない', () => {
  const env = load();
  env.app.setResult(null); env.app.buildWords('やばい');
  pickFirstCard(env);
  env.clock.advance(1100);                       // 400ms後に世界変化、300/700ms後に花が咲き始める
  assert.ok(allFlowers(env.w).some(f => f.scale.v > 0), 'blooming should have started');
  reset(env);
  assert.ok(allFlowers(env.w).every(f => f.scale.v === 0));
  env.clock.advance(10000);
  assert.ok(allFlowers(env.w).every(f => f.scale.v === 0), 'a flower came back after reset');
  assert.equal(env.w.vineGroup.visible, true);
  assert.equal(env.w.newPath.visible, false);
  assert.equal(env.w.secretGroup.visible, false);
  assert.equal(env.doc.ids['overlay-world'].classList.contains('show'), false);
  assert.equal(env.doc.ids['word-announce'].textContent, '');
  assert.equal(env.app.state, 'EXPLORE', 'old SECRET_QUESTION came back');
  assert.equal(env.clock.pending(), 0, 'timers left behind');
});

test('3. 古い世代の予約は、リセット後の画面も3D世界も変えない（語の選択直後＝世界変化の前に戻した場合）', () => {
  const env = load();
  env.app.setResult(null); env.app.buildWords('やばい');
  pickFirstCard(env);
  env.clock.advance(200);                        // 400ms の待ちの途中
  const genBefore = env.app.gen;
  reset(env);
  assert.equal(env.app.gen, genBefore + 1);
  env.clock.advance(6000);
  assert.equal(env.doc.ids['word-announce'].textContent, '');
  assert.equal(env.doc.ids['overlay-world'].classList.contains('show'), false);
  assert.equal(env.doc.body.children.length, 0, 'light ring appeared');
  assert.equal(env.w.vineGroup.visible, true);
  assert.ok(!env.app.stateLog.includes('WORD_SELECTED'));
  assert.ok(allFlowers(env.w).every(f => f.history.every(v => v === 0)), 'a flower grew from the old generation');
});

test('4. リセット後の2回目では、花がそれぞれ1回だけ咲く', () => {
  const env = load();
  env.app.setResult(null); env.app.buildWords('やばい');
  pickFirstCard(env); env.clock.advance(1100); reset(env);
  allFlowers(env.w).forEach(f => { f.history.length = 0; });
  env.app.buildWords('きれい');
  pickFirstCard(env);
  env.clock.advance(20000);
  for (const f of env.w.redFlowers) assert.equal(bloomCount(f), 1);
  env.w.mainFlowers.slice(0, 6).forEach(f => assert.equal(bloomCount(f), 1));
  env.w.mainFlowers.slice(6).forEach(f => assert.equal(f.history.length, 0));
  assert.equal(env.app.state, 'SECRET_QUESTION');
  assert.equal(env.app.stateLog.filter(s => s === 'SECRET_QUESTION').length, 1);
});

test('5. 端末内の語・通常の表示は今までどおり（ルビは付けない）', () => {
  const env = load();
  env.app.setResult(null); env.app.buildWords('きれい');
  const cards = env.doc.ids['word-cards'].children;
  assert.deepEqual(cards.map(c => c.dataset.wordText), ['目を奪われる', '息をのむ', '心が動く']);
  // Step 11K-B：ルビは付けない。見出しは漢字のまま、読みはデータに残る
  assert.ok(!cards[0].all().some(n => n.tagName === 'ruby' || n.tagName === 'rt'));
  assert.equal(cards[0].all().find(n => n.className === 'word-title').textContent, '目を奪われる');
  assert.equal(cards[0].dataset.wordReading, 'めをうばわれる');
  pickFirstCard(env); env.clock.advance(500);
  assert.equal(env.doc.ids['word-announce'].textContent, '『目を奪われる』が、世界をひらいた。');
});

test('6. スイッチが true でも、カード選択・世界変化・リセットでは fetch は0回', () => {
  const env = load();
  assert.equal(env.app.VOCABULARY_AI_ENABLED, true);
  env.app.setResult(null); env.app.buildWords('やばい');
  pickFirstCard(env); env.clock.advance(4000); reset(env); env.clock.advance(4000);
  assert.equal(env.fetchCalls.length, 0);
});

test('7. リセットは演出を最初に止め、世界変化の予約はすべて世代つきの関数を通る', () => {
  const reset = HTML.match(/function doReset\(\)\{([\s\S]*?)\n\}/)[1];
  assert.match(reset, /^\s*stopVoice\(\);\s*\/\/[^\n]*\n\s*resetWorldState\(\);/);
  const worldCode = WORLD.replace(/\/\/.*$/gm, '');
  const bodies = worldCode.replace(/function worldTimeout[\s\S]*?\n\}\nfunction worldFrame[\s\S]*?\n\}\nfunction cancelWorldEffects[\s\S]*?\n\}/, '');
  assert.ok(!/\bsetTimeout\(|\brequestAnimationFrame\(/.test(bodies), 'raw timer inside world effects');
  assert.ok(!/innerHTML/.test(worldCode));
  assert.match(DOM, /worldTimeout\(\(\) => \{\s*setState\(S\.WORD_SELECTED\);\s*doWorldChange\(word\);/);
  assert.match(HTML, /worldTimeout\(\(\)=>\{ nextGroup\.visible=true; setState\(S\.DEMO_COMPLETE\); \},900\);/);
  const script = HTML.replace(/\/\/.*$/gm, '');
  assert.equal((script.match(/\.innerHTML\s*=/g) || []).length, 0, 'innerHTML assignment remains');
});
