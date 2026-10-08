// Step 11L-F：深掘りの答えを Worker の /expand へ送る部分（EXPAND-AI）のテスト。実際の AI は呼ばない（fetch はスタブ）
// 成功・429・時間切れ・通信の失敗・JSON でない・決まりに合わない返事 のとき、どれも null（＝端末内の処理）になることを確かめる
// 実行: node --test test-expand-ai.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const HTML = readFileSync(new URL('./demo-world.html', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const section = (a, b) => { const i = HTML.indexOf(a), j = HTML.indexOf(b, i + 1); assert.ok(i >= 0 && j > i, `markers ${a} / ${b}`); return HTML.slice(i, j); };
const CORE = section('// VOCAB-CORE-BEGIN', '// VOCAB-CORE-END');
const EXPAND = section('// EXPAND-AI-BEGIN', '// EXPAND-AI-END');
const REVEAL = section('window.revealSecret = ()=>{', '\n};');
const WORKER_PATH = new URL('../tomori-vocabulary/worker.js', import.meta.url);

const FIELDS = { expression: 'これがいい', word: '輪郭', question: 'どのあたりが気になった？', answer: '丸いところが可愛い' };
const AI = { reflection: '丸さが、やわらかい感じを作っているのかも。', candidates: ['ころんと丸い形', 'ふっくらした丸み', 'やわらかな輪郭線'], axis: 'detail', safetyLevel: 'normal', supportMessage: null };

function storage() { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }; }
// fetch・タイマーを差しかえて読み込む。timers には、予約した待ち時間（ms）が入る
function load(fetchImpl, { enabled = true } = {}) {
  const timers = [];
  const fakeSetTimeout = (fn, ms) => { timers.push(ms); return setTimeout(fn, ms >= 3000 ? 5 : ms); };   // 5秒の打ち切りは、すぐに起こす
  const core = enabled ? CORE : CORE.replace('const VOCABULARY_AI_ENABLED = true;', 'const VOCABULARY_AI_ENABLED = false;');
  const win = {};
  const api = new Function('fetch', 'setTimeout', 'clearTimeout', 'sessionStorage', 'globalThis', 'window', 'performance', `
    ${core}
    ${EXPAND}
    return { fetchExpansion, validateExpandResponse, cancelExpansion, localExpandCare, isUrgentCare, EXPAND_API_URL, EXPAND_AI_TIMEOUT_MS, get abort() { return _expandAbort; } };`)(
    fetchImpl, fakeSetTimeout, clearTimeout, storage(), { crypto: globalThis.crypto }, win, performance);
  return { api, timers, diag: () => win.tomoriExpandDiag() };
}
function stub(respond) {
  const calls = [];
  const f = async (url, opts) => { calls.push({ url, opts, body: JSON.parse(opts.body) }); return respond(opts); };
  return { f, calls };
}
const json = (body, status = 200) => () => ({ ok: status >= 200 && status < 300, status, json: async () => body });

test('1. AI 成功：受けとめ・3つの言い方・axis を返す。送り先は /expand、送るのは4つの文字列と age・language だけ', async () => {
  const s = stub(json(AI));
  const { api, timers } = load(s.f);
  const r = await api.fetchExpansion(FIELDS);
  assert.deepEqual(r, { reflection: AI.reflection, candidates: AI.candidates, axis: 'detail' });
  assert.equal(s.calls.length, 1);
  assert.equal(s.calls[0].url, 'https://tomori-vocabulary.tomori-ryuto.workers.dev/expand');
  assert.equal(api.EXPAND_API_URL, 'https://tomori-vocabulary.tomori-ryuto.workers.dev/expand');
  assert.deepEqual(Object.keys(s.calls[0].body).sort(), ['age', 'answer', 'expression', 'language', 'question', 'word']);
  assert.match(s.calls[0].opts.headers['X-Tomori-Session'], /^[0-9a-f-]{36}$/);
  assert.ok(!/photo|image|name|userAgent|data:/i.test(JSON.stringify(s.calls[0].body)));
  assert.equal(api.EXPAND_AI_TIMEOUT_MS, 5000);
  assert.deepEqual(timers, [5000]);
  assert.equal(api.abort, null);
});

test('2. 429・500・通信の失敗・JSON でない・時間切れ は、作り直さず1回で null（端末内の処理へ）', async () => {
  for (const [label, respond] of [
    ['429', json({ error: 'Too many requests', code: 'RATE_LIMITED' }, 429)],
    ['502', json({ error: 'Invalid AI response', code: 'INVALID_AI_RESPONSE' }, 502)],
    ['network', () => { throw new TypeError('Failed to fetch'); }],
    ['bad json', () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('x'); } })],
    ['timeout', opts => new Promise((_, rej) => opts.signal.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError'))))],
  ]) {
    const s = stub(respond);
    const { api } = load(s.f);
    assert.equal(await api.fetchExpansion(FIELDS), null, label);
    assert.equal(s.calls.length, 1, `no retry: ${label}`);
    assert.equal(api.abort, null, label);
  }
});

// 決まりに合わない返事（Worker を通り抜けても、ブラウザでもう一度止める）
const BAD = [
  ['少ない', { ...AI, candidates: AI.candidates.slice(0, 2) }],
  ['多い', { ...AI, candidates: [...AI.candidates, 'まんまる'] }],
  ['受けとめが長い', { ...AI, reflection: 'あ'.repeat(46) }],
  ['候補が長い', { ...AI, candidates: ['あ'.repeat(19), 'ふっくらした丸み', 'やわらかな輪郭線'] }],
  ['オウム返し', { ...AI, reflection: '丸いところが可愛いんだね。' }],
  ['答えと同じ候補', { ...AI, candidates: ['丸いところが可愛い', 'ふっくらした丸み', 'やわらかな輪郭線'] }],
  ['カードと同じ候補', { ...AI, candidates: ['輪郭', 'ふっくらした丸み', 'やわらかな輪郭線'] }],
  ['重なり', { ...AI, candidates: ['ふっくらした丸み', 'ふっくらした 丸み', 'やわらかな輪郭線'] }],
  ['ほめ言葉だけ', { ...AI, reflection: 'すごいね！' }],
  ['HTML', { ...AI, reflection: '<b>丸さ</b>に目が向いたね' }],
  ['URL', { ...AI, candidates: ['https://x.test', 'ふっくらした丸み', 'やわらかな輪郭線'] }],
  ['採点', { ...AI, reflection: '正解！丸さに気づけたね。' }],
  ['写真の断定', { ...AI, reflection: '写真には黄色いひよこが写っているね。' }],
  ['axis', { ...AI, axis: 'feeling' }],
  ['care（urgent が無い）', { reflection: null, candidates: [], axis: null, safetyLevel: 'care', supportMessage: 'x' }],
  ['入力に無い特徴', { ...AI, candidates: ['つぶらな目玉と丸い体', 'ふっくらした丸み', 'やわらかな輪郭線'] }],
  ['入力に無い色', { ...AI, reflection: '黄色い丸さが、やさしい感じを作っているのかも。' }],
  ['形', ['ころんと丸い形']],
];

test('3. 決まりに合わない返事（少ない・多い・長い・オウム返し・重なり・ほめ言葉だけ・HTML・URL・採点・写真の断定・care）は null', async () => {
  for (const [label, body] of BAD) {
    const s = stub(json(body));
    const { api } = load(s.f);
    assert.equal(await api.fetchExpansion(FIELDS), null, label);
  }
});

test('4. Worker の検証（validateExpansion）とブラウザの検証は、同じ返事に同じ判断をする', { skip: !existsSync(WORKER_PATH) }, async () => {
  const { validateExpansion } = await import(WORKER_PATH);
  const { api } = load(async () => { throw new Error('unused'); });
  for (const [label, body] of [['ok', AI], ...BAD.filter(([l]) => !l.startsWith('care'))]) {
    assert.equal(validateExpansion(body, FIELDS).ok, api.validateExpandResponse(body, FIELDS) !== null, label);
  }
});

test('5. AI を止めているとき・空の項目があるときは送らずに null。明示的な危険の表現は、送らずに端末内で care（AI を止めていても）', async () => {
  const s = stub(json(AI));
  assert.equal(await load(s.f, { enabled: false }).api.fetchExpansion(FIELDS), null);
  assert.deepEqual(await load(s.f).api.fetchExpansion({ ...FIELDS, answer: '死にたい' }), { care: true, urgent: false });
  assert.deepEqual(await load(s.f, { enabled: false }).api.fetchExpansion({ ...FIELDS, answer: '今から死にたい' }), { care: true, urgent: true });
  assert.equal(await load(s.f).api.fetchExpansion({ ...FIELDS, word: '' }), null);
  assert.equal(s.calls.length, 0);
});

test('6. リセット（cancelExpansion）で送信を止める。止めたあとは null', async () => {
  const s = stub(opts => new Promise((_, rej) => opts.signal.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError')))));
  const { api } = load(s.f);
  const p = api.fetchExpansion(FIELDS);
  await new Promise(r => setTimeout(r, 0));
  assert.ok(api.abort);
  api.cancelExpansion();
  assert.equal(await p, null);
  assert.equal(api.abort, null);
});

test('7. 画面：くわしい答えだけ AI へ1回送る。待つ間は問いの画面のまま（「考え中」を出さない）。古い返事は使わない', () => {
  assert.match(REVEAL, /if\(state !== S\.SECRET_UNLOCKED \|\| secretSent\) return;/);
  assert.match(REVEAL, /secretSent = true;/);
  assert.ok(REVEAL.indexOf('secretSent = true;') < REVEAL.indexOf('fetchExpansion('), 'guard before sending');
  assert.match(REVEAL, /if\(c\.kind !== 'ok'\)\{ showExpansion\(text, c\); return; \}/);
  assert.match(REVEAL, /if\(gen !== _expandGen \|\| state !== S\.SECRET_UNLOCKED \|\| secretDone\) return;/);
  assert.match(REVEAL, /showExpansion\(text, c, ai\);/);
  assert.ok(!/考え中|考えています|AI|読み込み中|[Ll]oading/.test(REVEAL.replace(/\/\/.*$/gm, '').replace(/fetchExpansion|_expandGen/g, '')));
  // AI の返事も端末内の処理も、同じ showCandidates で、同じボタン（3つ＋自分の言葉のまま＋これにする）を出す
  assert.match(HTML, /const ex = ai \? \{ insight: ai\.reflection, move: ai\.axis, words: ai\.candidates \} : expandAnswer\(text, mode, aspect\);/);
  // 答える画面へ入るたび・リセットで、送信を止めて世代を進める
  assert.match(HTML, /function restoreSecretPanel\(\) \{\s*secretSent = false; secretDone = false;\s*_expandGen\+\+; cancelExpansion\(\);/);
  // 子どもの答え・AI の文は textContent で出す（HTML として入れない）
  assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|console\./.test(EXPAND));
});

test('8. 5秒をすぎてから届いた返事は使わない（null のまま）。自動で送り直さない', async () => {
  const s = stub(() => new Promise(r => setTimeout(() => r({ ok: true, status: 200, json: async () => AI }), 40)));   // 打ち切りを無視して、あとから届く
  const { api } = load(s.f);
  assert.equal(await api.fetchExpansion(FIELDS), null);
  await new Promise(r => setTimeout(r, 60));
  assert.equal(s.calls.length, 1);
});

test('9. Worker の care の形（urgent つき）を受け取る。形がちがう care は null', async () => {
  const CARE = { reflection: null, candidates: [], axis: null, safetyLevel: 'care', urgent: true, supportMessage: 'x' };
  for (const [body, want] of [[CARE, { care: true, urgent: true }], [{ ...CARE, urgent: false }, { care: true, urgent: false }],
    [{ ...CARE, urgent: 'yes' }, null], [{ ...CARE, candidates: ['a'] }, null], [{ safetyLevel: 'care' }, null]]) {
    const { api } = load(stub(json(body)).f);
    assert.deepEqual(await api.fetchExpansion(FIELDS), want, JSON.stringify(body));
  }
});

test('10. 端末内の安全判定は、表記ゆれ（カタカナ・全角・空白・記号）にも当たる。差し迫った危険は urgent', () => {
  const { api } = load(async () => { throw new Error('unused'); });
  for (const t of ['死にたい', 'シニタイ', 'し に た い', '死・に・た・い', '自分を傷つけたい']) assert.deepEqual(api.localExpandCare({ expression: 'x', answer: t }), { care: true, urgent: false }, t);
  for (const t of ['今から死にたい', '家で殴られている', '家に帰るのが怖い', 'いますぐ消えたい']) assert.equal(api.localExpandCare({ expression: 'x', answer: t }).urgent, true, t);
  for (const t of ['丸いところが可愛い', '死ぬほど笑った', 'ゲームで死んだ']) assert.equal(api.localExpandCare({ expression: 'x', answer: t }), null, t);
});

test('11. Worker と同じ「入力に無い特徴」の語の一覧・差し迫った危険の規則を使う', { skip: !existsSync(WORKER_PATH) }, () => {
  const W = readFileSync(WORKER_PATH, 'utf8').replace(/\r\n/g, '\n');
  const list = (src, name) => src.slice(src.indexOf(name), src.indexOf('].map', src.indexOf(name))).replace(/\/\/.*$/gm, '').match(/'[^']+'/g);
  assert.deepEqual(list(HTML, 'const EXPAND_AI_UNGROUNDED'), list(W, 'const EXPAND_UNGROUNDED_WORDS'));
  const pats = (src, name) => src.slice(src.indexOf(name), src.indexOf('];', src.indexOf(name))).match(/\/.+?\/,/g);
  assert.deepEqual(pats(HTML, 'const EXPAND_URGENT_PATTERNS'), pats(W, 'const URGENT_CARE_PATTERNS'));
});

test('12. 開発用の記録：時間切れ・通信の失敗・HTTP エラー・Worker の検査不合格・アプリの検査不合格・成功を分けて残す。入力や AI の文は残さない', async () => {
  const cases = [
    ['timeout', opts => new Promise((_, rej) => opts.signal.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError'))))],
    ['network', () => { throw new TypeError('Failed to fetch'); }],
    ['http_429', json({ error: 'Too many requests', code: 'RATE_LIMITED' }, 429)],
    ['http_500', json({ error: 'x', code: 'UPSTREAM_ERROR' }, 500)],
    ['worker_invalid', json({ error: 'Invalid AI response', code: 'INVALID_AI_RESPONSE', diagnosticCode: 'CANDIDATE_INVALID' }, 502)],
    ['bad_json', () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('x'); } })],
    ['app_invalid', json({ ...AI, candidates: ['つぶらな目玉と丸い体', 'ふっくらした丸み', 'やわらかな輪郭線'] })],
    ['ok', json(AI)],
  ];
  for (const [reason, respond] of cases) {
    const s = stub(respond);
    const { api, diag } = load(s.f);
    await api.fetchExpansion({ ...FIELDS, scene: 'detour' });
    const d = diag();
    assert.equal(d.length, 1, reason);
    assert.equal(d[0].reason, reason);
    assert.equal(d[0].scene, 'detour');
    assert.ok(Number.isFinite(d[0].ms));
    if (reason === 'worker_invalid') assert.equal(d[0].code, 'CANDIDATE_INVALID');
    assert.ok(!JSON.stringify(d).includes(FIELDS.answer) && !JSON.stringify(d).includes('丸'), 'no input or AI text');
    assert.equal(s.calls.length, 1, 'no retry');
  }
  // 送らなかったとき（危険の表現は端末内の care）
  const s = stub(json(AI)); const { api, diag } = load(s.f);
  await api.fetchExpansion({ ...FIELDS, answer: '死にたい' });
  assert.deepEqual(diag().map(e => e.reason), ['care_local']); assert.equal(s.calls.length, 0);
  assert.ok(!/console\./.test(EXPAND));
});

test('13. 道くさでは、答えを引いて考えを足した受けとめを受け取る（Worker と同じ）。深掘りでは今までどおりオウム返しとして受け取らない', async () => {
  const fields = { expression: 'ふしぎな香りの花を見つけた', word: 'なまえの花', question: 'この香りに、名前をつけるなら？', answer: 'ひみつのにおい' };
  const ok = { ...AI, reflection: '「ひみつのにおい」って、どんな景色が浮かぶ香りかな。', candidates: ['ないしょの香り', 'こっそり香る花', 'ひみつめいた香り'] };
  const { api } = load(async () => { throw new Error('unused'); });
  assert.ok(api.validateExpandResponse(ok, { ...fields, scene: 'detour' }));
  assert.equal(api.validateExpandResponse({ ...ok, reflection: 'ひみつのにおいだね。' }, { ...fields, scene: 'detour' }), null);
  assert.equal(api.validateExpandResponse(ok, fields), null, 'quest keeps the strict rule');
});
