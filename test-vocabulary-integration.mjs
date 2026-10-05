// demo-world.html の AI語彙接続部分のテスト（実APIは呼ばない）
// 実行: node --test test-vocabulary-integration.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const HTML = readFileSync(new URL('./demo-world.html', import.meta.url), 'utf8');
// 参照元（tomori-vocabulary）。無い環境では照合テストだけ飛ばす
const WORKER_PATH = new URL('../tomori-vocabulary/worker.js', import.meta.url);

function section(begin, end) {
  const s = HTML.indexOf(begin);
  const e = HTML.indexOf(end);
  assert.ok(s >= 0 && e > s, `marker ${begin} not found`);
  return HTML.slice(HTML.indexOf('\n', s) + 1, e);
}
const CORE_SHIPPED = section('// VOCAB-CORE-BEGIN', '// VOCAB-CORE-END');
const SWITCH_OFF = 'const VOCABULARY_AI_ENABLED = false;';
const SWITCH_ON = 'const VOCABULARY_AI_ENABLED = true;';
// Step 10F：ローカルのデモ用に、出荷ファイルのスイッチは true
assert.ok(CORE_SHIPPED.includes(SWITCH_ON), 'shipped file must have the AI switch on (local demo)');
// 緊急停止（false に戻したとき）の動きも確かめ続ける
const CORE_OFF = CORE_SHIPPED.replace(SWITCH_ON, SWITCH_OFF);
// 通信まわりのテストは、スイッチを入れた状態で動かす
const CORE = CORE_SHIPPED;
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
  for (const id of ['words-quote', 'words-pick-title', 'words-pick-sub', 'word-cards', 'secret-q-text', 'secret-t-title']) {
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
      VOCABULARY_API_URL, VOCABULARY_AI_ENABLED, FALLBACK_FOLLOW_UP, CARE_SUPPORT_MESSAGE,
      DETERMINISTIC_CARE_PATTERNS, normalizeForSafety, detectDeterministicCare,
      detectLocalResponseMode, buildLocalVocabularyFallback, buildLocalCareResponse,
      validateVocabResponse, fetchVocabulary, resetVocabState, getVocabSessionId,
      get result() { return _vocabResult; }, get abort() { return _vocabAbort; },
      get fallback() { return _vocabFallback; }, set fallback(v) { _vocabFallback = v; },
      get care() { return _vocabCare; },
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
  responseMode: 'feeling',
  words: [
    { word: 'あたたかい', reading: 'あたたかい', description: '心がほっとするような感じ' },
    { word: '鮮やか', reading: 'あざやか', description: '目にぱっと入ってくる明るい色' },
    { word: 'まぶしい', reading: 'まぶしい', description: '光が強くて目を細めたくなる' },
  ],
  followUpQuestion: 'そのとき、どんな音がしていた？',
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
test('16. AI語彙で3枚のカードができ、見出しはルビなしの文字だけ（読みはデータに残す）', () => {
  const doc = makeDocument();
  loadDom(doc, { vocabResult: NORMAL }).buildWords('やばい');
  const cards = doc.byId['word-cards'].children;
  assert.equal(cards.length, 3);
  assert.ok(!cards.some(c => c.all().some(n => n.tagName === 'ruby' || n.tagName === 'rt')));
  assert.equal(cards[1].all().find(n => n.className === 'word-title').textContent, '鮮やか');
  assert.equal(cards[1].dataset.wordReading, 'あざやか');
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

const NOTE = '今日は、トモリが見つけた言葉から選んでみよう。';

test('19. フォールバック時は端末内の3語と mode 別の質問を出し、案内文は1回だけ', () => {
  const doc = makeDocument();
  loadDom(doc, { vocabFallback: true }).buildWords('やばい');
  const words = doc.byId['word-cards'].children.map(c => c.dataset.wordText);
  assert.deepEqual(words, ['びっくりした', '気になった', '心が動いた']);
  assert.equal(doc.byId['secret-q-text'].textContent, 'どんなところで、そう感じたのかな？');
  const quote = doc.byId['words-quote'].textContent;
  assert.equal(quote.split(NOTE).length - 1, 1);
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
  assert.match(m[1], /msgEl\.textContent = buildLocalCareResponse\(\)\.supportMessage/);
  assert.ok(!/data\.supportMessage|_vocabResult|innerHTML/.test(m[1].replace(/\/\/.*$/gm, '')));
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

test('30. 緊急停止スイッチを false に戻せば fetch を1回も呼ばず、端末内の語へ切り替える', async () => {
  const f = okFetch(NORMAL);
  const factory = new Function('fetch', 'setTimeout', 'clearTimeout',
    `${CORE_OFF}; return { fetchVocabulary, get result() { return _vocabResult; } };`);
  const c = factory(f, setTimeout, clearTimeout);
  assert.equal(await c.fetchVocabulary('やばい'), 'fallback');
  assert.equal(c.result.responseMode, 'feeling');
  assert.equal(await c.fetchVocabulary('つらい'), 'fallback');
  assert.equal(f.calls.length, 0);
});

test('31. スイッチは fetch より前に判定している（false に戻すだけで止まる）', () => {
  const fn = CORE_SHIPPED.match(/async function fetchVocabulary\(expression\) \{([\s\S]*?)\n\}/)[1];
  const guard = fn.indexOf('if (!VOCABULARY_AI_ENABLED) return useLocalVocabulary(expression);');
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
  const c = loadCore(f, { storage, crypto, core: CORE_OFF });
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

test('36. 429 のときは端末内の3語へ切り替える', async () => {
  const f = okFetch({ error: 'Too many requests', code: 'RATE_LIMITED' }, 429);
  const c = loadCore(f);
  assert.equal(await c.fetchVocabulary('やばい'), 'fallback');
  assert.equal(c.fallback, true);
  assert.deepEqual(c.result.words.map(w => w.word), ['びっくりした', '気になった', '心が動いた']);
  const doc = makeDocument();
  loadDom(doc, { vocabFallback: true }).buildWords('やばい');
  assert.deepEqual(doc.byId['word-cards'].children.map(x => x.dataset.wordText), ['びっくりした', '気になった', '心が動いた']);
});

test('37. 429 が続いても案内文は1回だけ', () => {
  const doc = makeDocument();
  const dom = loadDom(doc, { vocabFallback: true });
  dom.buildWords('やばい');
  dom.buildWords('やばい');
  const quote = doc.byId['words-quote'].textContent;
  assert.equal(quote.split(NOTE).length - 1, 1);
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

// ── Step 9F：3つの入力モードと端末内フォールバック ─────────────────
const HEADINGS = {
  feeling:     ['気もちに近い言葉を見つけよう', '今の感じに近いものを、1つ選んでみよう。'],
  observation: ['どこに目が止まったのかな？', 'もう少し見てみたいところを、1つ選んでみよう。'],
  story:       ['この場面を、もう少し言葉にしてみよう', 'いちばん近い言葉を、1つ選んでみよう。'],
};
const withMode = mode => ({ ...clone(NORMAL), responseMode: mode });
const shipped = () => loadCore(okFetch(NORMAL), { core: CORE_SHIPPED });

test('43. 送り先は tomori-vocabulary の Worker で、AIスイッチは true（ローカルのデモ）', () => {
  const c = shipped();
  assert.equal(c.VOCABULARY_API_URL, 'https://tomori-vocabulary.tomori-ryuto.workers.dev/vocabulary');
  assert.equal(c.VOCABULARY_AI_ENABLED, true);
  // 停止した旧 API（tomori-api）の URL は、公開するファイルに書かない
  assert.ok(!/tomori-api\.[a-z0-9-]+\.workers\.dev/.test(HTML));
});

test('44. AIスイッチが false なら、どの入力でも fetch 0回・sessionStorage 0件', async () => {
  const f = okFetch(NORMAL);
  const storage = fakeStorage();
  const c = loadCore(f, { storage, core: CORE_OFF });
  for (const e of ['やばい', 'おじさん', 'ねこが寝ていた', 'わからない', '死にたい']) await c.fetchVocabulary(e);
  assert.equal(f.calls.length, 0);
  assert.equal(storage.map.size, 0);
});

test('45. 気もちの言葉は feeling、名前だけは observation、出来事は story', () => {
  const c = shipped();
  for (const e of ['やばい', 'すごい', 'きれい', 'かわいい', 'うれしい', '楽しい', 'さびしい', '悲しい', 'こわい', 'びっくり',
    'うざい', 'むかつく', 'イライラ', 'キモい', '気持ち悪い', 'なつかしい', '落ち着く', '好き', '嫌い', 'やばいくらい空がきれい']) {
    assert.equal(c.detectLocalResponseMode(e), 'feeling', e);
  }
  for (const e of ['おじさん', 'ねこ', '木', '空', '電車', 'わからない', 'なんとなく', '何も思わない', '']) {
    assert.equal(c.detectLocalResponseMode(e), 'observation', e);
  }
  for (const e of ['ねこが寝ていた', '人が歩いていた', '友達が走ってきた', '空が赤くなった', '雨が降ってきた']) {
    assert.equal(c.detectLocalResponseMode(e), 'story', e);
  }
});

test('46. feeling は気もちの種類ごとに3語を選ぶ', () => {
  const c = shipped();
  const words = e => c.buildLocalVocabularyFallback(e, 'm').words.map(w => w.word);
  assert.deepEqual(words('やばい'), ['びっくりした', '気になった', '心が動いた']);
  assert.deepEqual(words('すごい'), ['びっくりした', '気になった', '心が動いた']);
  assert.deepEqual(words('きれい'), ['目を奪われる', '息をのむ', '心が動く']);
  assert.deepEqual(words('かわいい'), ['心がはずむ', 'わくわくする', 'ほっとする']);
  assert.deepEqual(words('むかつく'), ['いらだつ', 'もどかしい', 'くやしい']);
  assert.deepEqual(words('キモい'), ['ぞわっとする', 'ぶきみ', '苦手']);
  assert.deepEqual(words('こわい'), ['ぎょっとする', 'どきどきする', '不安']);
  assert.deepEqual(words('なつかしい'), ['穏やか', 'なつかしい', '落ち着く']);
  assert.deepEqual(words('悲しい'), ['心細い', 'しんみりする', 'さびしい']);
});

test('47. observation は見る観点だけを示し、気もちや外見を作らない', () => {
  const c = shipped();
  const fb = e => c.buildLocalVocabularyFallback(e, 'm');
  assert.deepEqual(fb('おじさん').words.map(w => w.word), ['表情', 'しぐさ', 'まなざし']);
  assert.deepEqual(fb('ねこ').words.map(w => w.word), ['表情', 'しぐさ', 'まなざし']);
  assert.deepEqual(fb('木').words.map(w => w.word), ['色合い', '輪郭', 'たたずまい']);
  assert.deepEqual(fb('わからない').words.map(w => w.word), ['色', '形', '動き']);
  assert.equal(fb('わからない').followUpQuestion, '最初に目に入ったのは、どこかな？');
  assert.equal(fb('おじさん').followUpQuestion, 'もう少し見てみたいところはある？');
  for (const e of ['おじさん', 'ねこ', '木', 'わからない', 'ぴかぴか']) {
    const d = fb(e);
    assert.equal(d.responseMode, 'observation');
    for (const w of d.words) assert.ok(!/気もち|気持ち|うれし|かなし|悲し|さびし|こわ|やさし|きれい|かわい/.test(w.word + w.description), `${e}: ${w.word}`);
  }
});

test('48. story は様子・変化・流れで、原因・気もち・結末を足さない', () => {
  const c = shipped();
  for (const e of ['ねこが寝ていた', '人が歩いていた', '友達が走ってきた', '空が赤くなった', '雨が降ってきた']) {
    const d = c.buildLocalVocabularyFallback(e, 'm');
    assert.equal(d.responseMode, 'story');
    assert.deepEqual(d.words.map(w => w.word), ['様子', '変化', '流れ']);
    assert.equal(d.followUpQuestion, 'そのあと、どうなったと思う？');
    for (const w of d.words) assert.ok(!/気もち|気持ち|から|ので|ため|終わ|最後/.test(w.description), w.word);
  }
});

test('49. 端末内の候補はどれも Worker と同じ形の決まりを満たす', () => {
  const c = shipped();
  for (const e of ['やばい', 'かわいい', 'むかつく', 'キモい', 'こわい', 'なつかしい', '悲しい', 'おじさん', '木', 'わからない', 'ねこが寝ていた']) {
    const d = c.buildLocalVocabularyFallback(e, 'm');
    assert.equal(c.validateVocabResponse(d), true, e);
    for (const w of d.words) assert.ok(/^[^。]*。$/.test(w.description), `description は1文: ${w.word}`);
  }
});

test('50. responseMode は小文字の3種類だけ受け取る（normal のとき）', () => {
  const c = shipped();
  for (const m of ['feeling', 'observation', 'story']) assert.equal(c.validateVocabResponse(withMode(m)), true, m);
  const missing = clone(NORMAL); delete missing.responseMode;
  for (const bad of [missing, withMode(1), withMode(['feeling']), withMode('Feeling'), withMode('FEELING'), withMode('emotion'), withMode(null), withMode('')]) {
    assert.equal(c.validateVocabResponse(bad), false, JSON.stringify(bad.responseMode));
  }
  assert.equal(c.validateVocabResponse(CARE), true, 'care には responseMode は要らない');
});

test('51. responseMode が不正な AI 応答は、端末内の候補へ切り替える', async () => {
  for (const bad of [withMode('Feeling'), withMode(3), withMode(['story'])]) {
    const c = loadCore(okFetch(bad));
    assert.equal(await c.fetchVocabulary('ねこが寝ていた'), 'fallback');
    assert.equal(c.fallback, true);
    assert.equal(c.result.responseMode, 'story');
  }
});

test('52. AI の3つの mode で、見出し・補助文・Worker の深掘り質問が出る', async () => {
  for (const mode of ['feeling', 'observation', 'story']) {
    const c = loadCore(okFetch(withMode(mode)));
    assert.equal(await c.fetchVocabulary('ねこ'), 'ok');
    const doc = makeDocument();
    loadDom(doc, { vocabResult: c.result }).buildWords('ねこ');
    assert.equal(doc.byId['words-pick-title'].textContent, HEADINGS[mode][0]);
    assert.equal(doc.byId['words-pick-sub'].textContent, HEADINGS[mode][1]);
    assert.equal(doc.byId['secret-q-text'].textContent, NORMAL.followUpQuestion);
    assert.ok(!doc.byId['words-quote'].textContent.includes(NOTE), 'AI 成功時は案内文を出さない');
  }
});

test('53. フォールバックの見出しと深掘り質問も mode に合わせる', () => {
  const cases = [['やばい', 'feeling', 'どんなところで、そう感じたのかな？'],
    ['きれい', 'feeling', 'どのあたりで、そう感じたのかな？'],
    ['おじさん', 'observation', 'もう少し見てみたいところはある？'],
    ['ねこが寝ていた', 'story', 'そのあと、どうなったと思う？'],
    ['わからない', 'observation', '最初に目に入ったのは、どこかな？']];
  for (const [e, mode, q] of cases) {
    const c = shipped();
    const doc = makeDocument();
    loadDom(doc, { vocabResult: c.buildLocalVocabularyFallback(e, 'm'), vocabFallback: true }).buildWords(e);
    assert.equal(doc.byId['words-pick-title'].textContent, HEADINGS[mode][0], e);
    assert.equal(doc.byId['words-pick-sub'].textContent, HEADINGS[mode][1], e);
    assert.equal(doc.byId['secret-q-text'].textContent, q, e);
    assert.equal(doc.byId['secret-t-title'].textContent, q, e);
    assert.equal(doc.byId['words-quote'].textContent, `「${e}」${NOTE}`);
  }
});

test('54. 明示的な care 表現は、AIスイッチが true でも送らず・IDも作らず care にする', async () => {
  for (const e of ['死にたい', 'シニタイ', 'し に た い', '自分を傷つけたい', '殴られてる', '家に帰るのが怖い']) {
    const f = okFetch(NORMAL);
    const storage = fakeStorage();
    const c = loadCore(f, { storage });
    assert.equal(await c.fetchVocabulary(e), 'care', e);
    assert.equal(f.calls.length, 0, e);
    assert.equal(storage.map.size, 0, e);
    assert.equal(c.result, null);
    assert.equal(c.care, true);
  }
  const c = shipped();
  assert.deepEqual(c.buildLocalCareResponse(),
    { safetyLevel: 'care', words: [], followUpQuestion: null, supportMessage: 'とてもつらい気もちなんだね。ひとりでかかえず、近くの信頼できる大人に話してね。' });
  for (const e of ['死ぬほど楽しい', 'ゲームで死んだ', '学校に行きたくない']) assert.equal(c.detectDeterministicCare(e), false, e);
});

test('55. care の規則・正規化・固定文は tomori-vocabulary の worker.js と同じ', { skip: !existsSync(WORKER_PATH) && 'tomori-vocabulary が見つからない' }, () => {
  const w = readFileSync(WORKER_PATH, 'utf8').replace(/\r\n/g, '\n');
  const start = w.indexOf('// ゼロ幅文字（ZWSP');
  const e1 = w.indexOf('export function detectDeterministicCare');
  const workerBlock = w.slice(start, w.indexOf('\n}\n', e1) + 2).replace(/^export function/gm, 'function');
  const html = HTML.replace(/\r\n/g, '\n');
  assert.ok(html.includes(workerBlock), '安全判定の部分が参照元とずれている');
  const msg = w.match(/const CARE_SUPPORT_MESSAGE =\s*'([^']*)'/)[1];
  assert.equal(shipped().CARE_SUPPORT_MESSAGE, msg);
  assert.equal(shipped().DETERMINISTIC_CARE_PATTERNS.length, 20);
});

test('56. care 画面は語彙カード・見出しを隠し、固定文だけを出す', () => {
  const m = HTML.match(/function showCarePanel\(\)\s*\{([\s\S]*?)\n\}/)[1];
  assert.match(m, /setWordsAreaVisible\(false\)/);
  const v = HTML.match(/function setWordsAreaVisible\(show\) \{([\s\S]*?)\n\}/)[1];
  for (const id of ['words-quote', 'words-pick-title', 'words-pick-sub', 'word-cards']) assert.ok(v.includes(`'${id}'`), id);
  const t = HTML.match(/window\.toWords = async \(\)=>\{([\s\S]*?)\n\};/)[1];
  assert.match(t, /if \(result === 'care'\) \{\s*showCarePanel\(\);\s*return;\s*\}/);
});

test('57. ページ全体で innerHTML への代入が0件、console.log は DEBUG_LOG の中だけ', () => {
  assert.equal((HTML.match(/\.innerHTML\s*=/g) || []).length, 0);
  assert.match(HTML, /const DEBUG_LOG = false;/);
  const stripped = HTML
    .replace(/if \(DEBUG_LOG\) \{[^}]*\}/g, '')
    .replace(/if \(DEBUG_LOG\) console\.log\([^;]*\);/g, '');
  assert.equal((stripped.match(/console\.log/g) || []).length, 0);
});

test('58. ひらがなの語にも漢字の語にもルビを付けない（不統一の解消）', () => {
  const doc = makeDocument();
  const c = loadCore(okFetch(NORMAL), { core: CORE_SHIPPED });
  loadDom(doc, { vocabResult: c.buildLocalVocabularyFallback('むかつく', 'm'), vocabFallback: true }).buildWords('むかつく');
  const [a, b] = doc.byId['word-cards'].children;
  assert.ok(!a.all().some(n => n.tagName === 'ruby' || n.tagName === 'rt'), 'いらだつ');
  assert.equal(a.all().find(n => n.className === 'word-title').textContent, 'いらだつ');
  assert.ok(!b.all().some(n => n.tagName === 'ruby'), 'もどかしい');
  doc.byId['word-cards'].textContent = '';
  loadDom(doc, { vocabResult: c.buildLocalVocabularyFallback('木', 'm'), vocabFallback: true }).buildWords('木');
  const card = doc.byId['word-cards'].children[1];
  assert.ok(!card.all().some(n => n.tagName === 'ruby' || n.tagName === 'rt'));
  assert.equal(card.all().find(n => n.className === 'word-title').textContent, '輪郭');
  assert.equal(card.dataset.wordReading, 'りんかく');
});

// ── Step 9G：「やばい」単独の中立化と、存在文の扱い ─────────────────
const NEUTRAL = ['びっくりした', '気になった', '心が動いた'];
const BANK_OF = {
  wonder: ['目を奪われる', '息をのむ', '心が動く'], joy: ['心がはずむ', 'わくわくする', 'ほっとする'],
  fear: ['ぎょっとする', 'どきどきする', '不安'], dislike: ['ぞわっとする', 'ぶきみ', '苦手'],
  being: ['表情', 'しぐさ', 'まなざし'], thing: ['色合い', '輪郭', 'たたずまい'], scene: ['様子', '変化', '流れ'],
};

test('59. 表のとおりに mode と3語が決まる', () => {
  const c = shipped();
  const table = [
    ['やばい', 'feeling', NEUTRAL, 'どんなところで、そう感じたのかな？'],
    ['ヤバい！', 'feeling', NEUTRAL, 'どんなところで、そう感じたのかな？'],
    ['空がきれいでやばい', 'feeling', BANK_OF.wonder, 'どのあたりで、そう感じたのかな？'],
    ['こわくてやばい', 'feeling', BANK_OF.fear, 'どのあたりで、そう感じたのかな？'],
    ['うれしくてやばい', 'feeling', BANK_OF.joy, 'どのあたりで、そう感じたのかな？'],
    ['キモくてやばい', 'feeling', BANK_OF.dislike, 'どのあたりで、そう感じたのかな？'],
    ['おじさんがいた', 'observation', BANK_OF.being, 'もう少し見てみたいところはある？'],
    ['ねこがいた', 'observation', BANK_OF.being, 'もう少し見てみたいところはある？'],
    ['人がいる', 'observation', BANK_OF.being, 'もう少し見てみたいところはある？'],
    ['木があった', 'observation', BANK_OF.thing, 'もう少し見てみたいところはある？'],
    ['電車が見えた', 'observation', BANK_OF.thing, 'もう少し見てみたいところはある？'],
    ['花がある', 'observation', BANK_OF.thing, 'もう少し見てみたいところはある？'],
    ['ねこが寝ていた', 'story', BANK_OF.scene, 'そのあと、どうなったと思う？'],
    ['人が歩いていた', 'story', BANK_OF.scene, 'そのあと、どうなったと思う？'],
    ['友達が走ってきた', 'story', BANK_OF.scene, 'そのあと、どうなったと思う？'],
    ['空が赤くなった', 'story', BANK_OF.scene, 'そのあと、どうなったと思う？'],
    ['雨が降ってきた', 'story', BANK_OF.scene, 'そのあと、どうなったと思う？'],
  ];
  for (const [e, mode, words, q] of table) {
    const d = c.buildLocalVocabularyFallback(e, 'm');
    assert.equal(c.detectLocalResponseMode(e), mode, e);
    assert.equal(d.responseMode, mode, e);
    assert.deepEqual(d.words.map(w => w.word), words, e);
    assert.equal(d.followUpQuestion, q, e);
    assert.equal(c.validateVocabResponse(d), true, e);
  }
});

test('60. 「やばい」の中立の3語は、良い・悪い・美しさを決めつけない', () => {
  const d = shipped().buildLocalVocabularyFallback('やばい', 'm');
  for (const w of d.words) {
    assert.ok(!/きれい|美し|うれし|楽し|こわ|怖|いや|悲し|感動|すてき|最高|最悪/.test(w.word + w.description), w.word);
    assert.ok(/^[^。]*。$/.test(w.description) && w.description.length <= 30, w.description);
  }
});

test('61. 「〜ていた」の文字だけでは決めず、見つけただけの文は observation', () => {
  const c = shipped();
  // 末尾が「いた」でも、助詞のすぐ後ろなら存在文
  assert.equal(c.detectLocalResponseMode('おじさんがいた'), 'observation');
  // 見えた・いた の前に動作があれば story
  assert.equal(c.detectLocalResponseMode('ねこが寝ているのが見えた'), 'story');
  assert.equal(c.detectLocalResponseMode('ねこがねていた'), 'story');
  // 動作も存在も分からない名前だけの入力は observation
  assert.equal(c.detectLocalResponseMode('ぴかぴか'), 'observation');
});

test('62. care は mode 判定より先で、存在文・「やばい」付きでも固定の支援文になる', async () => {
  for (const e of ['死にたい', '死にたいくらいやばい']) {
    const f = okFetch(NORMAL);
    const storage = fakeStorage();
    const c = loadCore(f, { storage });
    assert.equal(await c.fetchVocabulary(e), 'care', e);
    assert.equal(f.calls.length, 0);
    assert.equal(storage.map.size, 0);
    assert.equal(c.result, null);
  }
});

test('63. AI が成功したときは、端末内の判定で上書きしない', async () => {
  const d = withMode('story');
  const c = loadCore(okFetch(d));
  assert.equal(await c.fetchVocabulary('やばい'), 'ok');
  const doc = makeDocument();
  loadDom(doc, { vocabResult: c.result }).buildWords('やばい');
  assert.deepEqual(doc.byId['word-cards'].children.map(x => x.dataset.wordText), NORMAL.words.map(w => w.word));
  assert.equal(doc.byId['words-pick-title'].textContent, HEADINGS.story[0]);
  assert.equal(doc.byId['secret-q-text'].textContent, NORMAL.followUpQuestion);
});

// ── Step 10A：「すごい」単独も中立にする・喜びの語群 ─────────────────
test('64. 「すごい」単独は中立、ほかの手がかりがあればその語群', () => {
  const c = shipped();
  const neutralQ = 'どんなところで、そう感じたのかな？', feelQ = 'どのあたりで、そう感じたのかな？';
  const table = [
    ['すごい', NEUTRAL, neutralQ], ['すごかった', NEUTRAL, neutralQ], ['スゴい！', NEUTRAL, neutralQ], ['やばい', NEUTRAL, neutralQ],
    ['すごくきれい', BANK_OF.wonder, feelQ], ['すごくこわい', BANK_OF.fear, feelQ],
    ['すごくうれしい', BANK_OF.joy, feelQ], ['すごくキモい', BANK_OF.dislike, feelQ],
  ];
  for (const [e, words, q] of table) {
    const d = c.buildLocalVocabularyFallback(e, 'm');
    assert.equal(d.responseMode, 'feeling', e);
    assert.deepEqual(d.words.map(w => w.word), words, e);
    assert.equal(d.followUpQuestion, q, e);
    assert.equal(c.validateVocabResponse(d), true, e);
  }
  // observation・story・care の判定は変わらない
  assert.deepEqual(c.buildLocalVocabularyFallback('おじさんがいた', 'm').words.map(w => w.word), BANK_OF.being);
  assert.deepEqual(c.buildLocalVocabularyFallback('ねこが寝ていた', 'm').words.map(w => w.word), BANK_OF.scene);
  assert.equal(c.detectDeterministicCare('死にたい'), true);
});

test('65. 喜びの語群は「心がはずむ／わくわくする／ほっとする」で、人物・動物・外見を決めつけない', () => {
  const d = shipped().buildLocalVocabularyFallback('うれしい', 'm');
  assert.deepEqual(d.words.map(w => w.word), ['心がはずむ', 'わくわくする', 'ほっとする']);
  assert.equal(d.words[1].reading, 'わくわくする');
  for (const w of d.words) {
    assert.ok(/^[^。]*。$/.test(w.description) && w.description.length <= 30, w.description);
    assert.ok(!/人|ひと|動物|ねこ|いぬ|かわい|愛らし|見た目|顔|姿/.test(w.word + w.description), w.word);
  }
});

// ── Step 10B：「すご」を語の一部として拾わない ─────────────────
test('66. 「すごい」の活用形だけを中立にし、「すごろく」などの語の一部には反応しない', () => {
  const c = shipped();
  const table = [
    ['すごい', 'feeling', NEUTRAL], ['すごかった', 'feeling', NEUTRAL], ['スゴい', 'feeling', NEUTRAL],
    ['すごくきれい', 'feeling', BANK_OF.wonder], ['すごくこわい', 'feeling', BANK_OF.fear],
    ['すごろく', 'observation', ['色', '形', '動き']],
    ['すごろくがあった', 'observation', null],
    ['すごろくで遊んでいた', 'story', BANK_OF.scene],
  ];
  for (const [e, mode, words] of table) {
    const d = c.buildLocalVocabularyFallback(e, 'm');
    assert.equal(c.detectLocalResponseMode(e), mode, e);
    assert.equal(d.responseMode, mode, e);
    if (words) assert.deepEqual(d.words.map(w => w.word), words, e);
    assert.equal(c.validateVocabResponse(d), true, e);
  }
  assert.equal(c.detectDeterministicCare('すごろく'), false);
});

// ── Step 10F：スイッチ true（ローカルのデモ）──────────────────────
test('67. 出荷ファイル（スイッチ true）でも、care 判定は fetch・ID作成・sessionStorage より先', async () => {
  const f = okFetch(NORMAL);
  const storage = fakeStorage();
  let uuidCalls = 0;
  const crypto = { randomUUID: () => { uuidCalls++; return globalThis.crypto.randomUUID(); } };
  const c = loadCore(f, { storage, crypto, core: CORE_SHIPPED });
  assert.equal(await c.fetchVocabulary('自分を傷つけたい'), 'care');
  assert.equal(f.calls.length, 0);
  assert.equal(uuidCalls, 0);
  assert.equal(storage.map.size, 0);
  // 続けて普通の入力を送ると、そこで初めて ID を作って1回だけ送る
  assert.equal(await c.fetchVocabulary('やばい'), 'ok');
  assert.equal(f.calls.length, 1);
  assert.equal(uuidCalls, 1);
  assert.match(headerOf(f.calls[0]), UUID4);
  assert.deepEqual(Object.keys(JSON.parse(f.calls[0].opts.body)).sort(), ['age', 'expression', 'language', 'mission']);
});

test('68. 400・403 のときも端末内の候補へ切り替え、エラー本文は画面に出さない', async () => {
  for (const [status, body] of [[400, { error: 'expression must not be blank' }], [403, { error: 'Origin not allowed', code: 'ORIGIN_NOT_ALLOWED' }],
    [502, { error: 'Invalid AI response', code: 'INVALID_AI_RESPONSE', diagnosticCode: 'JSON_PARSE_ERROR' }]]) {
    const c = loadCore(okFetch(body, status), { core: CORE_SHIPPED });
    assert.equal(await c.fetchVocabulary('おじさん'), 'fallback', String(status));
    assert.equal(c.fallback, true);
    assert.equal(c.result.responseMode, 'observation');
    const doc = makeDocument();
    loadDom(doc, { vocabResult: c.result, vocabFallback: true }).buildWords('おじさん');
    const shown = Object.values(doc.byId).map(n => n.textContent).join('');
    assert.ok(!/Origin not allowed|blank|diagnosticCode|JSON_PARSE_ERROR|INVALID/.test(shown), String(status));
    assert.equal(shown.split(NOTE).length - 1, 1);
  }
});

test('69. 成功・失敗・care のどれでも、入力や応答を console へ出さない', async () => {
  const logs = []; const orig = {};
  for (const k of ['log', 'warn', 'error', 'info', 'debug', 'trace']) { orig[k] = console[k]; console[k] = (...a) => logs.push(a.map(String).join(' ')); }
  try {
    await loadCore(okFetch(NORMAL), { core: CORE_SHIPPED }).fetchVocabulary('やばい');
    await loadCore(okFetch({ error: 'x' }, 429), { core: CORE_SHIPPED }).fetchVocabulary('やばい');
    await loadCore(async () => { throw new TypeError('Failed to fetch'); }, { core: CORE_SHIPPED }).fetchVocabulary('やばい');
    await loadCore(okFetch(withMode('Feeling')), { core: CORE_SHIPPED }).fetchVocabulary('やばい');
    await loadCore(okFetch(NORMAL), { core: CORE_SHIPPED }).fetchVocabulary('自分を傷つけたい');
    const doc = makeDocument();
    loadDom(doc, { vocabResult: NORMAL }).buildWords('やばい');
  } finally { for (const k of Object.keys(orig)) console[k] = orig[k]; }
  assert.deepEqual(logs, []);
});

// ── Step 10G：答えを限定しないミッション ───────────────────────────
const MISSION = '気になったものを、ひとつ見つけよう';
const MISSION_SUB_TEXT = '見たもの・起きたこと・感じたこと。どこからでも大丈夫。';
// 利用者に見える HTML（script・style・コメントを除いた本文）
const VISIBLE_HTML = HTML.slice(HTML.indexOf('<body'), HTML.indexOf('<script type="importmap">'))
  .replace(/<!--[\s\S]*?-->/g, '');
const APPLY_SRC = HTML.match(/function applyMissionCopy\(\) \{[\s\S]*?\n\}/)[0];

test('70. 古い「赤」のミッションが、画面にも送信本文にもソースにも残っていない', async () => {
  assert.ok(!HTML.includes('心があたたかくなる赤'));
  assert.ok(!HTML.includes('この赤は'));
  assert.ok(!/赤/.test(VISIBLE_HTML.replace(/<[^>]+>/g, '')), 'visible text mentions 赤');
  const f = okFetch(NORMAL);
  await loadCore(f, { core: CORE_SHIPPED }).fetchVocabulary('木');
  assert.ok(!f.calls[0].opts.body.includes('赤'));
});

test('71. 中心文・補助文・入力の問い・placeholder が決めた文面（定数と HTML の両方）', () => {
  const c = shipped();
  const src = CORE_SHIPPED;
  assert.match(src, /const VOCAB_MISSION = '気になったものを、ひとつ見つけよう';/);
  assert.match(src, /const MISSION_SUB = '見たもの・起きたこと・感じたこと。どこからでも大丈夫。';/);
  assert.match(src, /const EXPR_QUESTION = '何が気になった？';/);
  assert.match(src, /const EXPR_PLACEHOLDER = '見つけたことを、そのまま教えてね';/);
  assert.equal((VISIBLE_HTML.match(/class="panel-title mission-title">気になったものを、<br>ひとつ見つけよう</g) || []).length, 2);
  assert.ok(VISIBLE_HTML.includes(`class="panel-desc mission-sub">${MISSION_SUB_TEXT}<`));
  assert.ok(VISIBLE_HTML.includes('<span id="expr-question">何が気になった？</span>'));
  assert.ok(VISIBLE_HTML.includes('placeholder="見つけたことを、そのまま教えてね"'));
  assert.equal(c.FALLBACK_FOLLOW_UP, 'もう少し見てみたいところはある？');
});

test('72. 画面に回答例（やばい・おじさん・ねこ・例：）を出さない。入力画面は気持ちだけを求めない', () => {
  const text = VISIBLE_HTML.replace(/<[^>]+>/g, ' ');
  const placeholders = [...VISIBLE_HTML.matchAll(/placeholder="([^"]*)"/g)].map(m => m[1]).join(' ');
  for (const w of ['やばい', 'おじさん', 'ねこ', '例：']) assert.ok(!(text + placeholders).includes(w), w);
  const expr = VISIBLE_HTML.slice(VISIBLE_HTML.indexOf('id="panel-expr"'), VISIBLE_HTML.indexOf('id="panel-words"'));
  assert.ok(!/どんな感じ|感じたことを|気もち|気持ち/.test(expr), 'expression panel asks for feelings');
});

test('73. Worker へ送る mission は画面の中心文と同じで、本文は4項目だけ', async () => {
  const f = okFetch(NORMAL);
  await loadCore(f, { core: CORE_SHIPPED }).fetchVocabulary('ねこが寝ていた');
  const body = JSON.parse(f.calls[0].opts.body);
  assert.deepEqual(Object.keys(body).sort(), ['age', 'expression', 'language', 'mission']);
  assert.equal(body.mission, MISSION);
  assert.ok(!/photo|image|base64|audio|voice|name|history/i.test(f.calls[0].opts.body));
});

test('74. applyMissionCopy は定数から文面を入れ、「、」のあとで改行する（DOM だけ・innerHTML なし）', () => {
  const titles = [new FakeNode('div'), new FakeNode('div')], subs = [new FakeNode('div')];
  const q = new FakeNode('span'), vs = new FakeNode('div'), inp = { placeholder: '' };
  const doc = {
    querySelectorAll: sel => sel === '.mission-title' ? titles : sel === '.mission-sub' ? subs : [],
    getElementById: id => ({ 'expr-question': q, 'expr-input': inp, 'voice-sub': vs })[id] ?? null,
    createElement: tag => new FakeNode(tag), createTextNode: t => new FakeNode('#text', t),
  };
  new Function('document', `${CORE_SHIPPED}\n${APPLY_SRC}\napplyMissionCopy();`)(doc);
  for (const t of titles) {
    assert.equal(t.textContent, MISSION);
    assert.deepEqual(t.children.map(n => n.tagName), ['#text', 'br', '#text']);
    assert.ok(!t.innerHTMLUsed);
  }
  assert.equal(subs[0].textContent, MISSION_SUB_TEXT);
  assert.equal(q.textContent, '何が気になった？');
  assert.equal(inp.placeholder, '見つけたことを、そのまま教えてね');
  assert.equal(vs.textContent, '見つけたことを、そのまま話してね');
  assert.ok(!/innerHTML|console\./.test(APPLY_SRC));
});

test('75. スイッチは true のまま。3つの mode・care・429 の動きは変わらない', async () => {
  assert.equal(shipped().VOCABULARY_AI_ENABLED, true);
  for (const [mode, e] of [['feeling', 'やばい'], ['observation', 'おじさん'], ['story', 'ねこが寝ていた']]) {
    const c = loadCore(okFetch(withMode(mode)), { core: CORE_SHIPPED });
    assert.equal(await c.fetchVocabulary(e), 'ok');
    const doc = makeDocument();
    loadDom(doc, { vocabResult: c.result }).buildWords(e);
    assert.equal(doc.byId['words-pick-title'].textContent, HEADINGS[mode][0]);
    assert.equal(doc.byId['word-cards'].children.length, 3);
  }
  const careFetch = okFetch(NORMAL);
  assert.equal(await loadCore(careFetch, { core: CORE_SHIPPED }).fetchVocabulary('自分を傷つけたい'), 'care');
  assert.equal(careFetch.calls.length, 0);
  const rl = loadCore(okFetch({ error: 'x', code: 'RATE_LIMITED' }, 429), { core: CORE_SHIPPED });
  assert.equal(await rl.fetchVocabulary('やばい'), 'fallback');
  assert.deepEqual(rl.result.words.map(w => w.word), NEUTRAL);
});

// ── Step 10I：スマホ幅で上のボタンと状態表示を重ねない ─────────────────
test('76. スマホ幅（600px 以下）では、ボタン2つを1段目、状態表示を2段目に分ける', () => {
  const m = HTML.match(/@media \(max-width: 600px\) \{([\s\S]*?)\n\}/);
  assert.ok(m, 'mobile media query missing');
  const css = m[1];
  // 1段目：上から safe area か 8px、高さ 44px 以上 → 下端は 8 + 44 = 52px
  assert.match(css, /#btn-back, #btn-reset \{\s*top:max\(8px, env\(safe-area-inset-top\)\);\s*min-height:44px; min-width:44px;/);
  assert.match(css, /#btn-back  \{ left:max\(8px, env\(safe-area-inset-left\)\); \}/);
  assert.match(css, /#btn-reset \{ right:max\(8px, env\(safe-area-inset-right\)\); \}/);
  // 2段目：同じ基準から 52px 下（ボタンの下端 + 8px のすき間）で、画面幅からはみ出さない
  assert.match(css, /#mission-bar \{\s*top:calc\(max\(8px, env\(safe-area-inset-top\)\) \+ 52px\);\s*width:max-content; min-width:0; max-width:calc\(100vw - 24px\);/);
  const buttonBottom = 8 + 44, barTop = 8 + 52;
  assert.ok(barTop > buttonBottom, 'rows must not intersect');
  // JavaScript で位置を動かしていない（CSS だけ）
  assert.ok(!/btn-reset'\)\.style\.(top|left|right)|mission-bar'\)\.style\.(top|left)/.test(HTML));
});

test('77. PC の上部 UI の配置は変わっていない（ふだんのルール）', () => {
  assert.match(HTML, /#mission-bar \{\n  position:absolute; top:12px; left:50%; transform:translateX\(-50%\);/);
  assert.match(HTML, /#btn-reset \{\n  position:absolute; top:12px; right:12px;/);
  assert.match(HTML, /#btn-back \{\n  position:absolute; top:52px; left:12px;/);
  assert.match(HTML, /min-width:190px; max-width:88vw;/);
});
