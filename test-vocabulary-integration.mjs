// demo-world.html の AI語彙接続部分のテスト（実APIは呼ばない）
// 実行: node --test test-vocabulary-integration.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const HTML = readFileSync(new URL('./demo-world.html', import.meta.url), 'utf8');

function section(begin, end) {
  const s = HTML.indexOf(begin);
  const e = HTML.indexOf(end);
  assert.ok(s >= 0 && e > s, `marker ${begin} not found`);
  return HTML.slice(HTML.indexOf('\n', s) + 1, e);
}
const CORE_SHIPPED = section('// VOCAB-CORE-BEGIN', '// VOCAB-CORE-END');
const SWITCH_OFF = 'const VOCABULARY_AI_ENABLED = false;';
assert.ok(CORE_SHIPPED.includes(SWITCH_OFF), 'shipped file must have the AI switch off');
// 通信まわりのテストは、スイッチを入れた状態で動かす
const CORE = CORE_SHIPPED.replace(SWITCH_OFF, 'const VOCABULARY_AI_ENABLED = true;');
const DOM  = section('// VOCAB-DOM-BEGIN',  '// VOCAB-DOM-END');

// ── 最小限の偽DOM ──────────────────────────────────────────────
class FakeNode {
  constructor(tag, text = null) {
    this.tagName = tag; this._text = text; this.children = [];
    this.dataset = {}; this.style = {}; this.className = '';
    this.innerHTMLUsed = false;
    const cls = new Set();
    this.classList = { add: c => cls.add(c), remove: c => cls.delete(c), contains: c => cls.has(c) };
  }
  appendChild(n) { this.children.push(n); return n; }
  get textContent() {
    return this.children.length ? this.children.map(c => c.textContent).join('') : (this._text ?? '');
  }
  set textContent(v) { this.children = []; this._text = String(v); }
  set innerHTML(v) { this.innerHTMLUsed = true; }
  all() { return [this, ...this.children.flatMap(c => c.all())]; }
}
function makeDocument() {
  const byId = {};
  for (const id of ['words-quote', 'word-cards', 'secret-q-text', 'secret-t-title']) {
    byId[id] = new FakeNode('div');
  }
  return {
    byId,
    getElementById: id => byId[id] ?? null,
    createElement: tag => new FakeNode(tag),
    createTextNode: t => new FakeNode('#text', t),
    querySelectorAll: () => [],
  };
}

// ── 読み込み ───────────────────────────────────────────────────
function fakeStorage() {
  const m = new Map();
  return { map: m, getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
}
function loadCore(fetchImpl, { storage = fakeStorage(), core = CORE, crypto = globalThis.crypto } = {}) {
  const factory = new Function('fetch', 'setTimeout', 'clearTimeout', 'sessionStorage', 'globalThis', `
    ${core}
    return {
      VOCABULARY_API_URL, FALLBACK_WORDS, FALLBACK_FOLLOW_UP, CARE_MESSAGE,
      validateVocabResponse, fetchVocabulary, resetVocabState, getVocabSessionId,
      get result() { return _vocabResult; }, get abort() { return _vocabAbort; },
      set fallback(v) { _vocabFallback = v; },
    };`);
  return factory(fetchImpl, setTimeout, clearTimeout, storage, { crypto });
}
function loadDom(doc, { vocabResult = null, vocabFallback = false } = {}) {
  const factory = new Function('document', `
    ${CORE}
    _vocabResult = ${JSON.stringify(vocabResult)};
    _vocabFallback = ${vocabFallback};
    const S = { WORDS_READY: 'WORDS_READY', WORD_SELECTED: 'WORD_SELECTED' };
    let state = 'WORDS_READY', chosenWord = '';
    const setState = () => {}, doWorldChange = () => {};
    ${DOM}
    return { buildWords };`);
  return factory(doc);
}

// ── テストデータ ───────────────────────────────────────────────
const NORMAL = {
  words: [
    { word: 'あたたかい', reading: 'あたたかい', description: '心がほっとするような感じ' },
    { word: '鮮やか', reading: 'あざやか', description: '目にぱっと入ってくる明るい色' },
    { word: 'まぶしい', reading: 'まぶしい', description: '光が強くて目を細めたくなる' },
  ],
  followUpQuestion: 'その赤は、どんな音がしそう？',
  safetyLevel: 'normal',
  supportMessage: null,
};
const CARE = { words: [], followUpQuestion: null, safetyLevel: 'care', supportMessage: 'x' };
const clone = o => JSON.parse(JSON.stringify(o));

function okFetch(body, status = 200) {
  const calls = [];
  const fn = async (url, opts) => {
    calls.push({ url, opts });
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  };
  fn.calls = calls;
  return fn;
}

// ── 1. 通信の成功・失敗 ───────────────────────────────────────
test('1. 正常応答は ok を返し、AI語彙を保持する', async () => {
  const c = loadCore(okFetch(NORMAL));
  assert.equal(await c.fetchVocabulary('やばい'), 'ok');
  assert.equal(c.result.words[0].word, 'あたたかい');
});

test('2. care応答は care を返し、語彙は保持しない', async () => {
  const c = loadCore(okFetch(CARE));
  assert.equal(await c.fetchVocabulary('つらい'), 'care');
  assert.equal(c.result, null);
});

for (const status of [404, 500, 502]) {
  test(`3-${status}. HTTP ${status} はフォールバック`, async () => {
    const c = loadCore(okFetch({ error: 'x' }, status));
    assert.equal(await c.fetchVocabulary('やばい'), 'fallback');
  });
}

test('4. ネットワークエラーはフォールバック', async () => {
  const c = loadCore(async () => { throw new TypeError('Failed to fetch'); });
  assert.equal(await c.fetchVocabulary('やばい'), 'fallback');
});

test('5. JSONでない応答はフォールバック', async () => {
  const c = loadCore(async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError(); } }));
  assert.equal(await c.fetchVocabulary('やばい'), 'fallback');
});

test('6. 6秒タイムアウトで中断してフォールバック', async () => {
  let delay = null;
  const fakeSetTimeout = (fn, ms) => { delay = ms; fn(); return 0; };
  const hang = (url, opts) => new Promise((_, reject) => {
    if (opts.signal.aborted) reject(new DOMException('aborted', 'AbortError'));
    opts.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
  });
  const factory = new Function('fetch', 'setTimeout', 'clearTimeout',
    `${CORE}; return { fetchVocabulary };`);
  const c = factory(hang, fakeSetTimeout, () => {});
  assert.equal(await c.fetchVocabulary('やばい'), 'fallback');
  assert.equal(delay, 6000);
});

// ── 2. 送信内容 ───────────────────────────────────────────────
test('7. 送信するのは expression/mission/age/language だけ（写真・音声は送らない）', async () => {
  const f = okFetch(NORMAL);
  await loadCore(f).fetchVocabulary('やばい');
  const body = JSON.parse(f.calls[0].opts.body);
  assert.deepEqual(Object.keys(body).sort(), ['age', 'expression', 'language', 'mission']);
  assert.equal(f.calls[0].opts.method, 'POST');
  assert.ok(!/photo|audio|base64/i.test(f.calls[0].opts.body));
});

test('8. 200文字を超える入力は200文字に切って送る', async () => {
  const f = okFetch(NORMAL);
  await loadCore(f).fetchVocabulary('あ'.repeat(250));
  assert.equal(JSON.parse(f.calls[0].opts.body).expression.length, 200);
});

test('9. 送信先は /vocabulary', async () => {
  const f = okFetch(NORMAL);
  await loadCore(f).fetchVocabulary('やばい');
  assert.ok(f.calls[0].url.endsWith('/vocabulary'));
});

// ── 3. 応答の検証 ─────────────────────────────────────────────
test('10. 語彙が2件しかない応答は不正', () => {
  const d = clone(NORMAL); d.words.pop();
  assert.equal(loadCore(okFetch(d)).validateVocabResponse(d), false);
});

test('11. 語彙が重複している応答は不正', () => {
  const d = clone(NORMAL); d.words[2].word = d.words[0].word;
  assert.equal(loadCore(okFetch(d)).validateVocabResponse(d), false);
});

test('12. description が61文字の応答は不正', () => {
  const d = clone(NORMAL); d.words[0].description = 'あ'.repeat(61);
  assert.equal(loadCore(okFetch(d)).validateVocabResponse(d), false);
});

test('13. followUpQuestion が36文字なら不正、35文字なら正常', () => {
  const c = loadCore(okFetch(NORMAL));
  const d = clone(NORMAL);
  d.followUpQuestion = 'あ'.repeat(36);
  assert.equal(c.validateVocabResponse(d), false);
  d.followUpQuestion = 'あ'.repeat(35);
  assert.equal(c.validateVocabResponse(d), true);
});

test('14. safetyLevel が未知の値なら不正（フォールバック）', async () => {
  const d = clone(NORMAL); d.safetyLevel = 'unknown';
  assert.equal(await loadCore(okFetch(d)).fetchVocabulary('やばい'), 'fallback');
});

test('15. care なのに語彙が入っている応答は不正', () => {
  const d = clone(CARE); d.words = NORMAL.words;
  assert.equal(loadCore(okFetch(d)).validateVocabResponse(d), false);
});

// ── 4. 画面の構築（安全なDOM） ─────────────────────────────────
test('16. AI語彙で3枚のカードができ、ルビはDOMで組み立てる', () => {
  const doc = makeDocument();
  loadDom(doc, { vocabResult: NORMAL }).buildWords('やばい');
  const cards = doc.byId['word-cards'].children;
  assert.equal(cards.length, 3);
  const ruby = cards[1].all().find(n => n.tagName === 'ruby');
  const rt = ruby.children.find(n => n.tagName === 'rt');
  assert.equal(rt.textContent, 'あざやか');
  assert.equal(ruby.children[0].textContent, '鮮やか');
});

test('17. AIの文字列にHTMLが混ざっても文字として扱い、innerHTMLは使わない', () => {
  const doc = makeDocument();
  const d = clone(NORMAL);
  d.words[0].description = '<img src=x onerror=alert(1)>';
  loadDom(doc, { vocabResult: d }).buildWords('<b>やばい</b>');
  const nodes = Object.values(doc.byId).flatMap(n => n.all());
  assert.ok(nodes.every(n => !n.innerHTMLUsed));
  assert.ok(nodes.every(n => n.tagName !== 'img' && n.tagName !== 'b'));
  assert.ok(doc.byId['word-cards'].textContent.includes('<img src=x onerror=alert(1)>'));
});

test('18. AIの深掘り質問が深掘りパネルに入る', () => {
  const doc = makeDocument();
  loadDom(doc, { vocabResult: NORMAL }).buildWords('やばい');
  assert.equal(doc.byId['secret-q-text'].textContent, NORMAL.followUpQuestion);
  assert.equal(doc.byId['secret-t-title'].textContent, NORMAL.followUpQuestion);
});

test('19. フォールバック時は固定の3語と固定の質問を出し、案内文は1回だけ', () => {
  const doc = makeDocument();
  loadDom(doc, { vocabFallback: true }).buildWords('やばい');
  const words = doc.byId['word-cards'].children.map(c => c.dataset.wordText);
  assert.deepEqual(words, ['鮮やか', '燃えるよう', '少しさびしげ']);
  assert.equal(doc.byId['secret-q-text'].textContent, 'この赤は、何に似ている？');
  const quote = doc.byId['words-quote'].textContent;
  assert.equal(quote.split('今日は、トモリが見つけたことばを見てみよう。').length - 1, 1);
});

test('20. 長い入力は画面上で40文字に切る', () => {
  const doc = makeDocument();
  loadDom(doc, { vocabResult: NORMAL }).buildWords('あ'.repeat(60));
  assert.ok(doc.byId['words-quote'].textContent.includes('あ'.repeat(40) + '…'));
  assert.ok(!doc.byId['words-quote'].textContent.includes('あ'.repeat(41)));
});

// ── 5. care とリセット（HTMLの静的確認） ───────────────────────
test('21. care の表示はフロント側の固定文を textContent で使う（Workerの文面は表示しない）', () => {
  const m = HTML.match(/function showCarePanel\(\)\s*\{([\s\S]*?)\n\}/);
  assert.ok(m);
  assert.match(m[1], /msgEl\.textContent = CARE_MESSAGE/);
  assert.ok(!/supportMessage|innerHTML/.test(m[1].replace(/\/\/.*$/gm, '')));
  assert.match(HTML, /onclick="window\.careRewrite\(\)">書きなおす</);
  assert.match(HTML, /onclick="window\.careBack\(\)">冒険にもどる</);
});

test('22. リセットで通信を中断し、世代番号を進め、care・待機表示を消す', () => {
  const m = HTML.match(/function doReset\(\)\{([\s\S]*?)\n\}/);
  assert.ok(m);
  for (const s of ['_vocabGen++', 'resetVocabState()',
    "getElementById('vocab-care').classList.remove('show')",
    "getElementById('vocab-loading').classList.remove('show')"]) {
    assert.ok(m[1].includes(s), `doReset must contain ${s}`);
  }
});

test('23. 古い応答はリセット後に画面を書き換えない（toWords が世代番号を確認する）', () => {
  const m = HTML.match(/window\.toWords = async \(\)=>\{([\s\S]*?)\n\};/);
  assert.ok(m);
  assert.match(m[1], /const gen = \+\+_vocabGen;\s*const result = await fetchVocabulary\(v\);\s*if \(gen !== _vocabGen\) return;/);
});

test('24. resetVocabState は進行中の通信を中断する', async () => {
  let aborted = false;
  const hang = (url, opts) => new Promise((_, reject) => {
    opts.signal.addEventListener('abort', () => { aborted = true; reject(new Error('abort')); });
  });
  const c = loadCore(hang);
  const p = c.fetchVocabulary('やばい');
  c.resetVocabState();
  assert.equal(await p, 'fallback');
  assert.ok(aborted);
});

test('25. 二重送信防止：送信開始時にボタンを無効化する', () => {
  const m = HTML.match(/window\.toWords = async \(\)=>\{([\s\S]*?)\n\};/);
  assert.match(m[1], /btnNext\.classList\.add\('btn-disabled'\)[\s\S]*fetchVocabulary/);
});

test('27. 非表示の「デモ終了」表示が語彙カードのタップをふさがない', () => {
  const base = HTML.match(/#demo-end \{([\s\S]*?)\}/)[1];
  const shown = HTML.match(/#demo-end\.show \{([^}]*)\}/)[1];
  assert.match(base, /pointer-events:none/);
  assert.match(shown, /pointer-events:all/);
});

test('28. care の文面は改行どおりに表示する', () => {
  assert.match(HTML.match(/\.care-msg \{([\s\S]*?)\}/)[1], /white-space:pre-line/);
});

test('29. 「冒険にもどる」後は、離れてから近づくとミッションが再び始まる', () => {
  const back = HTML.match(/window\.careBack = \(\) => \{([\s\S]*?)\n\};/)[1];
  assert.match(back, /missionTriggered = false;\s*missionNeedsLeave = true;/);
  assert.match(HTML, /if\(md<MISSION_RADIUS\)\{\s*if\(!missionNeedsLeave\) triggerMission\(\);\s*\} else \{\s*missionNeedsLeave=false;/);
  const reset = HTML.match(/function doReset\(\)\{([\s\S]*?)\n\}/)[1];
  assert.match(reset, /missionNeedsLeave=false/);
});

test('30. 緊急停止スイッチが false なら fetch を1回も呼ばず、固定の語へ切り替える', async () => {
  const f = okFetch(NORMAL);
  const factory = new Function('fetch', 'setTimeout', 'clearTimeout',
    `${CORE_SHIPPED}; return { fetchVocabulary, get result() { return _vocabResult; } };`);
  const c = factory(f, setTimeout, clearTimeout);
  assert.equal(await c.fetchVocabulary('やばい'), 'fallback');
  assert.equal(await c.fetchVocabulary('つらい'), 'fallback');
  assert.equal(f.calls.length, 0);
  assert.equal(c.result, null);
});

test('31. 出荷ファイルではスイッチは false で、fetch より前に判定している', () => {
  const fn = CORE_SHIPPED.match(/async function fetchVocabulary\(expression\) \{([\s\S]*?)\n\}/)[1];
  const guard = fn.indexOf("if (!VOCABULARY_AI_ENABLED) return 'fallback';");
  assert.ok(guard >= 0);
  assert.ok(guard < fn.indexOf('fetch(VOCABULARY_API_URL'));
});

// ── Step 8C：匿名セッションID ──────────────────────────────────
const UUID4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const headerOf = call => call.opts.headers['X-Tomori-Session'];

test('32. スイッチが false のときは fetch 0回・匿名IDを作らず保存もしない', async () => {
  const f = okFetch(NORMAL);
  const storage = fakeStorage();
  let uuidCalls = 0;
  const crypto = { randomUUID: () => { uuidCalls++; return globalThis.crypto.randomUUID(); } };
  const c = loadCore(f, { storage, crypto, core: CORE_SHIPPED });
  assert.equal(await c.fetchVocabulary('やばい'), 'fallback');
  assert.equal(f.calls.length, 0);
  assert.equal(uuidCalls, 0);
  assert.equal(storage.map.size, 0);
});

test('33. スイッチが true のときだけ X-Tomori-Session が付く', async () => {
  const f = okFetch(NORMAL);
  await loadCore(f).fetchVocabulary('やばい');
  assert.match(headerOf(f.calls[0]), UUID4);
  assert.deepEqual(Object.keys(f.calls[0].opts.headers).sort(), ['Content-Type', 'X-Tomori-Session']);
});

test('34. 本文は4項目だけで、匿名IDは本文に入らない', async () => {
  const f = okFetch(NORMAL);
  await loadCore(f).fetchVocabulary('やばい');
  const body = JSON.parse(f.calls[0].opts.body);
  assert.deepEqual(Object.keys(body).sort(), ['age', 'expression', 'language', 'mission']);
  assert.ok(!f.calls[0].opts.body.includes(headerOf(f.calls[0])));
});

test('35. 写真・音声・名前・履歴は本文にもヘッダーにも入らない', async () => {
  const f = okFetch(NORMAL);
  await loadCore(f).fetchVocabulary('やばい');
  const all = f.calls[0].opts.body + JSON.stringify(f.calls[0].opts.headers);
  assert.ok(!/photo|image|base64|audio|voice|name|history|record|school/i.test(all));
});

test('36. 429 のときは固定の3語へ切り替える', async () => {
  const f = okFetch({ error: 'Too many requests', code: 'RATE_LIMITED' }, 429);
  const c = loadCore(f);
  assert.equal(await c.fetchVocabulary('やばい'), 'fallback');
  assert.equal(c.result, null);
  const doc = makeDocument();
  loadDom(doc, { vocabFallback: true }).buildWords('やばい');
  assert.deepEqual(doc.byId['word-cards'].children.map(x => x.dataset.wordText), ['鮮やか', '燃えるよう', '少しさびしげ']);
});

test('37. 429 が続いても案内文は1回だけ', () => {
  const doc = makeDocument();
  const dom = loadDom(doc, { vocabFallback: true });
  dom.buildWords('やばい');
  dom.buildWords('やばい');
  const quote = doc.byId['words-quote'].textContent;
  assert.equal(quote.split('今日は、トモリが見つけたことばを見てみよう。').length - 1, 1);
  assert.ok(!/429|Too many|RATE_LIMITED/.test(quote + doc.byId['word-cards'].textContent));
});

test('38. 同じタブ（sessionStorage）の中では同じIDを使い続ける', async () => {
  const f = okFetch(NORMAL);
  const storage = fakeStorage();
  const c1 = loadCore(f, { storage });
  await c1.fetchVocabulary('やばい');
  await c1.fetchVocabulary('きれい');
  const c2 = loadCore(f, { storage }); // ページを読み込み直した想定
  await c2.fetchVocabulary('すごい');
  const ids = f.calls.map(headerOf);
  assert.equal(new Set(ids).size, 1);
  assert.equal(storage.map.get('tomori.vocabSession'), ids[0]);
  const other = okFetch(NORMAL);
  await loadCore(other, { storage: fakeStorage() }).fetchVocabulary('やばい'); // 別のタブ
  assert.notEqual(headerOf(other.calls[0]), ids[0]);
});

test('39. IDに個人情報や入力文が入らない（ランダムなUUIDだけ）', async () => {
  const f = okFetch(NORMAL);
  const storage = fakeStorage();
  const c = loadCore(f, { storage });
  await c.fetchVocabulary('たろう 小学3年 さくら小');
  const id = headerOf(f.calls[0]);
  assert.match(id, UUID4);
  assert.deepEqual([...storage.map.keys()], ['tomori.vocabSession']);
  assert.ok(!HTML.includes('document.cookie'));
  const core = CORE_SHIPPED.replace(/\/\/.*$/gm, '');
  assert.ok(!/localStorage/.test(core));
});

test('40. リセットしても同じIDのまま、次の通信も正常に進む', async () => {
  const f = okFetch(NORMAL);
  const c = loadCore(f);
  assert.equal(await c.fetchVocabulary('やばい'), 'ok');
  c.resetVocabState();
  assert.equal(c.result, null);
  assert.equal(await c.fetchVocabulary('きれい'), 'ok');
  assert.equal(headerOf(f.calls[0]), headerOf(f.calls[1]));
});

test('41. randomUUID が無い端末でも安全なIDを作り、crypto が無ければ送らない', async () => {
  const f = okFetch(NORMAL);
  await loadCore(f, { crypto: { getRandomValues: a => globalThis.crypto.getRandomValues(a) } }).fetchVocabulary('やばい');
  assert.match(headerOf(f.calls[0]), UUID4);
  const g = okFetch(NORMAL);
  assert.equal(await loadCore(g, { crypto: null }).fetchVocabulary('やばい'), 'fallback');
  assert.equal(g.calls.length, 0);
});

test('42. 保存された値が壊れていたら使わず、作り直す', async () => {
  const f = okFetch(NORMAL);
  const storage = fakeStorage();
  storage.setItem('tomori.vocabSession', '<script>taro</script>');
  await loadCore(f, { storage }).fetchVocabulary('やばい');
  assert.match(headerOf(f.calls[0]), UUID4);
  assert.match(storage.map.get('tomori.vocabSession'), UUID4);
});

test('26. 語彙部分に innerHTML・console.log・APIキーがない', () => {
  for (const src of [CORE, DOM]) {
    const code = src.replace(/\/\/.*$/gm, '');
    assert.ok(!/innerHTML/.test(code));
    assert.ok(!/console\.log/.test(code));
    assert.ok(!/sk-ant-|ANTHROPIC_API_KEY|x-api-key/i.test(code));
  }
});
