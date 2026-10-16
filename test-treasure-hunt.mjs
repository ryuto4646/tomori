// EXPANSION-01：宝さがし（ふくろうのポポ → ねこ → ミナ → 下を向いた花 → 泉 → 宝箱 → ほらあな）のテスト。ブラウザも通信も使わない
// 進み方（TREASURE-CORE-BEGIN〜END）を取り出して動かし、表示と保存（TREASURE-UI）はコードの形を確かめる
// 実行: node --test test-treasure-hunt.mjs
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
const QUEST = between(HTML, '// QUEST-CORE-BEGIN', '// QUEST-CORE-END');
const TERRAIN = between(HTML, '// TERRAIN-BEGIN', '// TERRAIN-END');
const ADV = between(HTML, '// ADVENTURE-BEGIN', '// ADVENTURE-END');
const T = new Function(CORE + `
return { TREASURE_SAVE_KEY, TREASURE_GUIDE, TREASURE_TALK_R, TREASURE_SPOTS, TREASURE_STEPS, TREASURE_HINTS, TREASURE_TALK, TREASURE_CLUES, TREASURE_CHEST, TREASURE_CAVE, TREASURE_DECOYS, TREASURE_ITEMS,
  createTreasureState, treasureGoal, treasureItems, treasureTalk, treasureMoreHint, treasureInspect, treasureLantern, treasureMemo, restoreTreasure };`)();
const Q = new Function(QUEST + '\nreturn { DETOUR_DEFS, QUEST_DEFS };')();
const W = new Function(TERRAIN + ADV + '\nreturn { inWalk, GATE, WORD_TREE };')();
const MISSION = { x: 1.5, z: -6.5 };

// 最後まで進める（テストの準備用）
function playThrough(st) {
  T.treasureTalk(st, 'popo');
  for (const id of ['cat', 'bell', 'spring', 'chest']) assert.ok(['found', 'open'].includes(T.treasureInspect(st, id).kind), id);
  T.treasureLantern(st, true);
  assert.equal(T.treasureInspect(st, 'cave').kind, 'lit');
  return st;
}

test('1. 宝さがしはポポと話すと始まる。ミナは「ポポに聞いて」と言うだけで、始めない', () => {
  const st = T.createTreasureState();
  assert.equal(T.treasureGoal(st), 'popo');
  const m = T.treasureTalk(st, 'mina');
  assert.equal(m.started, false); assert.equal(m.hint, 0); assert.match(m.line, /ポポに聞いてみて/);
  assert.equal(st.started, false);
  const p = T.treasureTalk(st, 'popo');
  assert.equal(p.started, true); assert.equal(p.goal, 'cat'); assert.equal(p.hint, 1);
  assert.equal(T.treasureGoal(st), 'cat');
  assert.equal(T.treasureTalk(st, 'nobody'), null);
});

test('2. 手がかりは決まった順番だけ：ねこ → 下を向いた花 → 泉 → 宝箱 → ほらあな。最後は done', () => {
  const st = T.createTreasureState();
  T.treasureTalk(st, 'popo');
  const order = [['cat', 'found', 'bell'], ['bell', 'found', 'spring'], ['spring', 'found', 'chest'], ['chest', 'open', 'cave']];
  for (const [id, kind, next] of order) { assert.equal(T.treasureInspect(st, id).kind, kind, id); assert.equal(T.treasureGoal(st), next, id); }
  assert.equal(T.treasureInspect(st, 'cave').kind, 'needLantern');
  assert.ok(T.treasureLantern(st, true));
  assert.equal(T.treasureInspect(st, 'cave').kind, 'lit');
  assert.equal(T.treasureGoal(st), 'done');
  assert.deepEqual(T.TREASURE_STEPS, ['cat', 'bell', 'spring', 'chest', 'cave']);
});

test('3. 違う順番で訪れても進まない（一言だけ）。何度でもやり直せる。関係ない場所は何も変えない', () => {
  const st = T.createTreasureState();
  // 始まる前：ねこは寝ているだけ。宝箱はかぎがかかっている（見たことだけ覚える）。ほらあなは真っ暗
  assert.equal(T.treasureInspect(st, 'cat').kind, 'early');
  assert.equal(T.treasureInspect(st, 'chest').kind, 'locked');
  assert.equal(T.treasureInspect(st, 'cave').kind, 'dark');
  assert.equal(st.started, false); assert.equal(st.found.cat, false); assert.equal(st.chestOpened, false);
  T.treasureTalk(st, 'popo');
  // 先の手がかりへ先に行っても見つからない
  for (const id of ['spring', 'bell', 'spring']) assert.equal(T.treasureInspect(st, id).kind, 'early', id);
  assert.deepEqual(st.found, { cat: false, bell: false, spring: false });
  assert.equal(T.treasureInspect(st, 'chest').kind, 'locked');
  // 関係ない場所（まるい岩・空を向いた花）は、何度しらべても何も変えない
  const before = JSON.stringify(st);
  for (let i = 0; i < 3; i++) { assert.equal(T.treasureInspect(st, 'rock').kind, 'decoy'); assert.equal(T.treasureInspect(st, 'bloom').kind, 'decoy'); }
  assert.equal(JSON.stringify(st), before);
  // 順番どおりに戻れば進む
  assert.equal(T.treasureInspect(st, 'cat').kind, 'found');
  assert.equal(T.treasureInspect(st, 'cat').kind, 'again');
  assert.equal(T.treasureInspect(st, 'bell').kind, 'found');
  assert.equal(T.treasureInspect(st, 'nowhere'), null);
});

test('4. ヒントは聞き直すたびに1つずつくわしくなり、3つ目で止まる。目標ごとに別に数える', () => {
  const st = T.createTreasureState();
  T.treasureTalk(st, 'popo');
  assert.equal(st.hint.cat, 1);
  assert.equal(T.treasureMoreHint(st), 2);
  assert.equal(T.treasureMoreHint(st), 3);
  assert.equal(T.treasureMoreHint(st), 3, 'stays at the most detailed hint');
  // もう一度話しかけても、聞いたヒントは戻らない
  assert.equal(T.treasureTalk(st, 'mina').hint, 3);
  T.treasureInspect(st, 'cat');
  assert.equal(st.hint.bell, 0, 'next goal starts unheard');
  assert.equal(T.treasureMoreHint(st), 0, 'cannot skip to more before hearing the first');
  assert.equal(T.treasureTalk(st, 'mina').hint, 1);
  for (const g of T.TREASURE_STEPS) assert.equal(T.TREASURE_HINTS[g].length, 3, g);
  // ヒントは段々とくわしく（3つ目がいちばん長い・場所の手がかりを言う）。矢印や答えの座標は出さない
  for (const g of T.TREASURE_STEPS) assert.ok(T.TREASURE_HINTS[g][2].text.length >= T.TREASURE_HINTS[g][0].text.length - 6, g);
  assert.ok(!/矢印|→|座標/.test(JSON.stringify(T.TREASURE_HINTS)));
});

test('5. 冒険メモ：聞いたヒント（いちばんくわしく聞いたもの）と見つけたものを、冒険の順番で読み返せる', () => {
  const st = T.createTreasureState();
  assert.deepEqual(T.treasureMemo(st), []);
  T.treasureTalk(st, 'popo'); T.treasureMoreHint(st);
  let memo = T.treasureMemo(st);
  assert.match(memo[0].text, /ポポの話/);
  assert.equal(memo[1].label, 'ヒント 2/3'); assert.equal(memo[1].text, T.TREASURE_HINTS.cat[1].text);
  T.treasureInspect(st, 'cat');
  T.treasureInspect(st, 'chest');   // かぎの前に見つけた宝箱
  memo = T.treasureMemo(st);
  assert.ok(memo.some(m => m.text === T.TREASURE_CLUES.cat.memo));
  assert.ok(memo.some(m => m.text === T.TREASURE_CHEST.memoLocked));
  playThrough(T.createTreasureState());
  const done = T.treasureMemo(playThrough(T.createTreasureState()));
  assert.ok(done.some(m => m.text === T.TREASURE_CHEST.memoOpen));
  assert.ok(done.some(m => m.text === T.TREASURE_CAVE.memo));
  assert.ok(!done.some(m => m.text === T.TREASURE_CHEST.memoLocked), 'locked note is replaced once opened');
});

test('6. 宝箱：かぎ（泉）が無いと開かない。開くのは1回だけ。報酬（ランタンとかけら）は二重に増えない', () => {
  const st = T.createTreasureState();
  T.treasureTalk(st, 'popo'); T.treasureInspect(st, 'cat'); T.treasureInspect(st, 'bell');
  assert.equal(T.treasureInspect(st, 'chest').kind, 'locked');
  assert.equal(T.treasureItems(st).lantern, false);
  T.treasureInspect(st, 'spring');
  const r = T.treasureInspect(st, 'chest');
  assert.equal(r.kind, 'open'); assert.deepEqual(r.rewards, ['lantern', 'shard']);
  for (let i = 0; i < 5; i++) assert.equal(T.treasureInspect(st, 'chest').kind, 'again');
  assert.deepEqual(T.treasureItems(st), { map: true, key: true, keyUsed: true, lantern: true, shards: 1 });
});

test('7. ランタン：持つまでは使えない。つけるとほらあなが照らされ、新しい手がかり（大きな存在の絵）が見つかる', () => {
  const st = T.createTreasureState();
  assert.equal(T.treasureLantern(st, true), false); assert.equal(st.lanternOn, false);
  playThrough(st);
  assert.equal(st.caveLit, true);
  assert.equal(T.treasureInspect(st, 'cave').kind, 'again');
  assert.ok(T.treasureLantern(st, false)); assert.equal(st.lanternOn, false);
  assert.match(T.TREASURE_CAVE.lit, /大きな木/); assert.match(T.TREASURE_CAVE.lit, /大きな生きもの/);
  // 大きな存在との対話・レアな種は、次の段階（今回は景色と会話で気配だけ）
  assert.ok(!/種をもらう|レアな種/.test(CORE));
  assert.match(T.TREASURE_TALK.popo.done, /世界のひみつを知るもの/);
});

test('8. 端末の記録から戻す：同じ進み具合に戻る。こわれた記録・順番を飛ばした記録・範囲外のヒントは安全な形にする', () => {
  const st = playThrough(T.createTreasureState()); T.treasureMoreHint(st);
  const back = T.restoreTreasure(JSON.parse(JSON.stringify(st)));
  assert.deepEqual(back, st);
  for (const bad of [null, undefined, 'x', 42, [], { v: 2, started: true }]) assert.deepEqual(T.restoreTreasure(bad), T.createTreasureState(), String(bad));
  // 泉を飛ばして宝箱を開けた・ランタンだけ持っている、のような記録は、順番どおりのところまで
  const skip = T.restoreTreasure({ v: 1, started: true, found: { cat: true, bell: false, spring: true }, chestOpened: true, caveLit: true, lanternOn: true, hint: { cat: 9, bell: -3, spring: 1.5, chest: '2', cave: 2 } });
  assert.deepEqual(skip.found, { cat: true, bell: false, spring: false });
  assert.equal(skip.chestOpened, false); assert.equal(skip.caveLit, false); assert.equal(skip.lanternOn, false);
  assert.deepEqual(skip.hint, { cat: 3, bell: 0, spring: 0, chest: 0, cave: 2 });
  assert.equal(T.treasureItems(skip).shards, 0);
  // 始まっていない記録は、ヒントも持たない
  assert.deepEqual(T.restoreTreasure({ v: 1, started: false, hint: { cat: 3 } }).hint, T.createTreasureState().hint);
});

test('9. 置き場所：人・手がかりは、門を開ける前から歩ける草原の中。ほかのクエスト・道くさ・祠・門と重ならず、近すぎない', () => {
  const S = T.TREASURE_SPOTS, ids = Object.keys(S);
  for (const id of ids) {
    const s = S[id];
    assert.ok(W.inWalk(s.x, s.z, false), `${id} inside the meadow`);
    assert.ok(Math.hypot(s.x - MISSION.x, s.z - MISSION.z) > 3.0, `${id} away from the shrine`);
    assert.ok(Math.hypot(s.x - W.GATE.x, s.z - W.GATE.z) > 6, `${id} away from the gate`);
    for (const d of Q.DETOUR_DEFS) assert.ok(Math.hypot(s.x - d.x, s.z - d.z) > 6, `${id} away from detour ${d.id}`);
    assert.ok(s.x < 0, `${id} on the west side`);
    for (const o of ids) if (o !== id) assert.ok(Math.hypot(s.x - S[o].x, s.z - S[o].z) > 2.2, `${id} vs ${o}`);
  }
  // 宝さがしの始まり（ポポ）は出発点から近く、最初の小道のそば
  assert.ok(Math.hypot(S.popo.x, S.popo.z) < 3.5);
  assert.ok(T.TREASURE_TALK_R >= 1.6 && T.TREASURE_TALK_R <= 2.4);
});

test('10. 子どもが読める短い文：1行は60文字まで。むずかしいことばには説明（gloss）を付ける。点数・正誤の言葉は使わない', () => {
  const lines = [];
  const walk = v => { if (typeof v === 'string') lines.push(...v.split('\n')); else if (v && typeof v === 'object') Object.values(v).forEach(walk); };
  walk([T.TREASURE_TALK, T.TREASURE_HINTS, T.TREASURE_CLUES, T.TREASURE_CHEST, T.TREASURE_CAVE, T.TREASURE_DECOYS, T.TREASURE_ITEMS]);
  for (const l of lines) assert.ok(l.length <= 60, l);
  assert.ok(lines.length > 60);
  assert.match(T.TREASURE_HINTS.cat[0].gloss, /ひなた＝/);
  assert.match(T.TREASURE_HINTS.cat[2].gloss, /祠＝/);
  assert.match(T.TREASURE_CAVE.gloss, /集めし者＝/);
  assert.ok(!/点数|正解|不正解|まちがい|ランキング|score/i.test(lines.join('\n')));
  // 話し方：ポポは「〜じゃ／のう」、ミナは「〜よ！／だよ」
  assert.ok(Object.values(T.TREASURE_TALK.popo).filter(l => /じゃ|のう/.test(l)).length >= 5);
  assert.ok(Object.values(T.TREASURE_TALK.mina).filter(l => /よ[！。]|ね[！。]|の。/.test(l)).length >= 5);
  assert.ok(!Object.values(T.TREASURE_TALK.mina).some(l => /じゃ(?!あ)|のう/.test(l)), 'Mina does not talk like Popo（「じゃあ」はミナも使う）');
});

test('11. 正解と行き先は固定データだけで決まる：AI・通信・乱数・保存を、進み方（TREASURE-CORE）では使わない', () => {
  const c = code(CORE);
  assert.ok(!/fetch\(|fetchExpansion|VOCABULARY|Math\.random|localStorage|sessionStorage|document\.|window\.|THREE\./.test(c));
  assert.ok(!/fetch\(|fetchExpansion|Math\.random/.test(code(UI)), 'UI does not call AI either');
  assert.ok(Object.isFrozen(T.TREASURE_SPOTS) && Object.isFrozen(T.TREASURE_HINTS) && Object.isFrozen(T.TREASURE_TALK));
});

test('12. 保存：localStorage は TREASURE-UI の try の中だけ。キーは1つ。リセットで消す。確認の文で「宝さがしも消える」と伝える', () => {
  const u = code(UI);
  assert.equal(T.TREASURE_SAVE_KEY, 'tomori-treasure-v1');
  // 開発版（ファイル名に preview）は別のキー。公開版と記録を上書きしあわない
  assert.match(u, /const SAVE_KEY = TREASURE_SAVE_KEY \+ \(\/preview\/i\.test\(location\.pathname\) \? '-preview' : ''\);/);
  assert.ok(!/localStorage\.\w+\(TREASURE_SAVE_KEY/.test(u), 'always through SAVE_KEY');
  for (const m of u.matchAll(/localStorage\.\w+\(/g)) assert.match(u.slice(Math.max(0, m.index - 40), m.index), /try \{ (const s = )?$/, 'inside try');
  assert.equal((u.match(/localStorage\./g) || []).length, 3, 'get, set, remove');
  assert.match(between(UI, 'function reset() {', '\n  }\n'), /forget\(\); st = createTreasureState\(\);/);
  assert.match(between(HTML, 'function doReset(){', '\n}\n'), /treasure\.reset\(\);/);
  assert.match(HTML, /confirm\('デモを最初からやり直しますか？\\n宝さがしの記録ともちものも消えます。'\)/);
  assert.match(HTML, /宝さがしの記録ともちものは、この端末に残ります。「デモを最初から」を押すと消えます。/);
  // ほかの場所（クエスト・道くさ）は、今までどおり保存しない
  assert.ok(!/localStorage|sessionStorage/.test(between(HTML, '// QUEST-UI-BEGIN', '// QUEST-UI-END')));
  assert.equal((code(HTML).match(/localStorage/g) || []).length, 3);
});

test('13. 画面：歩けるときだけ「話す／しらべる」と冒険メモ。会話と冒険メモの間は歩かない。閉じたら歩く操作に戻る', () => {
  assert.match(HTML, /const canMove=\(\)=>state===S\.EXPLORE\|\|state===S\.DEMO_COMPLETE\|\|state===S\.FREE_EXPLORE;/);
  assert.match(UI, /const walkable = \(\) => state === S\.EXPLORE \|\| state === S\.FREE_EXPLORE;/);
  assert.match(HTML, /    case S\.TALK:\n      openPanel\('panel-talk'\);/);
  assert.match(HTML, /    case S\.NOTEBOOK:\n      openPanel\('panel-notebook'\);/);
  assert.match(between(UI, 'function close() {', '}\n'), /setState\(returnState\)/);
  assert.match(between(UI, 'function closeNotebook() {', '}\n'), /setState\(returnState\)/);
  // 道くさの案内が出ているときは、同じ場所に宝さがしの案内を重ねない
  assert.match(UI, /!el\('detour-call'\)\.classList\.contains\('show'\)/);
  // パネルを閉じたら、構図の向き先を祠へ戻す（最初のクエストの構図をずらさない）
  assert.match(between(UI, 'function close() {', '}\n'), /focusTarget = null;/);
  for (const id of ['panel-talk', 'panel-notebook', 'treasure-call', 'btn-notebook', 'btn-talk-more', 'btn-talk-memo', 'btn-talk-close', 'btn-notebook-close', 'label-popo', 'label-mina', 'sfx-spring', 'sfx-cat'])
    assert.equal((HTML.match(new RegExp(`id="${id}"`, 'g')) || []).length, 1, id);
});

test('14. タップ：人・物は見えない当たりの球で選ぶ（地面より先）。丘のかげの物は選ばない。選んだら、そばまで歩いてから開く', () => {
  assert.match(HTML, /  if\(treasure&&treasure\.pick\(raycaster\)\) return;[^\n]*\n  const hits=raycaster\.intersectObject\(ground\);/);
  assert.match(UI, /const HIT = new THREE\.MeshBasicMaterial\(\{ visible: false \}\)/);
  const pick = between(UI, 'function pick(rc) {', '\n  }\n');
  assert.match(pick, /if \(gh && gh\.distance < h\.distance - 1\.5\) return false;/);
  assert.match(pick, /worldV2\.clampToWalkable\(targetPos, \.97\);/);
  assert.match(pick, /pending = id;/);
  assert.match(UI, /if \(Math\.hypot\(x - s\.x, z - s\.z\) <= TREASURE_TALK_R \+ \.2\) \{ open\(id\); return; \}/);
});

test('15. 描画の負荷：新しい描画ループ・タイマー・点光源を作らない。テクスチャはかべの絵の1枚だけ。文字は textContent', () => {
  const u = code(UI);
  assert.ok(!/requestAnimationFrame|setInterval|setTimeout\(/.test(u));
  assert.ok(!/PointLight|SpotLight|DirectionalLight|castShadow = true/.test(u));
  // かべの絵（その場で描く）は、絵そのものと、秘密の発見で光らせる木の部分の2枚（EXPANSION-02）。どちらも同じ関数で作る
  // ＋やわらかい光の丸（1枚を共有。色は素材で変える）
  assert.equal((u.match(/new THREE\.\w*Texture\(/g) || []).length, 3);
  assert.match(u, /new THREE\.CanvasTexture\(cv\)/);
  assert.ok(!/innerHTML|insertAdjacentHTML/.test(u));
  assert.match(HTML, /  if\(treasure\) treasure\.update\(t,dt\);[^\n]*\n  missionHold\.update\(\);[^\n]*\n  renderer\.render\(scene,camera\);/);
  // 人・物は、まとめた Mesh（mesh(...)）で作る。数は 25 個まで
  assert.ok((u.match(/\bmesh\(\[/g) || []).length <= 25);
});

test('17. 上の知らせ：宝さがしの途中は、いまの目標がわかる案内（行き先は言わない）。祠に近づいたら写真のクエストの案内。芽への案内などはそのまま', () => {
  for (const g of T.TREASURE_STEPS) { assert.ok(T.TREASURE_GUIDE[g] && T.TREASURE_GUIDE[g].length <= 22, g); assert.match(T.TREASURE_GUIDE[g], /^宝さがし：/); }
  assert.ok(!T.TREASURE_GUIDE.popo, 'not before the hunt starts');
  assert.match(T.TREASURE_GUIDE.done, /遠くの大きな木/);   // EXPANSION-02：秘密を見つけたあとは、次の冒険の気配
  assert.ok(!/左|右|おく|手前|のはし|祠/.test(Object.values(T.TREASURE_GUIDE).join('')), 'no directions in the banner');
  const g = between(UI, 'function guide(free) {', '\n  }\n');
  assert.match(g, /if \(free !== undefined && free !== FREE_TEXT\) return null;/);
  assert.match(UI, /const FREE_TEXT = '自由に歩いてみよう。気になる場所があるかも。';/);
  assert.match(HTML, /mbar\.textContent = md<CALLOUT_RADIUS \? 'なにかが呼んでいる…' : \(treasure&&treasure\.guide\(\)\) \|\| '光るポイントを探して歩こう！';/);
  assert.match(HTML, /mbar\.textContent = \(treasure && treasure\.guide\(\)\) \|\| '光るポイントを探して歩こう！';/);
});

test('18. REVIEW：会話中は調べる物もパネルの上に見せる。横向きの小さな画面は右にパネル。閉じた指で「見つけたもの」を押さない。構図はほらあなの岩もよける', () => {
  // 調べる物（会話の相手・調べている物）の場所を、縦のずらしに使う。ヒロリの顔は上の知らせより下のまま
  assert.match(between(UI, 'function focusPoint() {', '\n  }\n'), /if \(state !== S\.TALK \|\| !openId \|\| !TREASURE_SPOTS\[openId\]\) return null;/);
  assert.match(HTML, /if\(tp\)\{ _probe\.copy\(tp\)\.project\(camera\); const ty=\(1-_probe\.y\)\/2\*H; want=Math\.max\(topUI\+0\.03\*H,Math\.min\(want,visiblePanelTop\(\)-0\.05\*H-\(ty-faceY\)\)\); \}/);
  // 右に出すパネルは画面の下をふさがない。横のずらしでヒロリと物をパネルの左へ
  assert.match(HTML, /return r\.left>innerWidth\*\.3\?innerHeight:r\.top;/);
  assert.match(HTML, /camera\.setViewOffset\(innerWidth,H,viewShiftX,viewShift,innerWidth,H\);/);
  assert.match(HTML, /@media \(orientation: landscape\) and \(max-height: 500px\) \{\n  #panel-talk, #panel-notebook \{ left:auto; top:0;/);
  // 会話パネルは低め。高さの小さい画面では下の2つのボタンがいつも見える
  assert.match(HTML, /<div class="talk-actions">\n    <button class="btn-secondary" id="btn-talk-memo"/);
  assert.match(HTML, /\.talk-actions \{ position:sticky; bottom:0;/);
  // 閉じたあと 0.45 秒は「見つけたもの」を押せない（新しいタイマーは使わず、毎フレームの処理で戻す）
  assert.match(UI, /function guardTap\(\) \{ guardUntil = performance\.now\(\) \+ 450; el\('btn-found'\)\.style\.pointerEvents = 'none'; \}/);
  assert.match(between(UI, 'function close() {', '}\n'), /guardTap\(\);/);
  assert.match(UI, /if \(guardUntil && performance\.now\(\) > guardUntil\) \{ guardUntil = 0; el\('btn-found'\)\.style\.pointerEvents = ''; \}/);
  // パネルの構図は、草原のふちの木とほらあなの岩もよける（西の草原だけ）
  assert.match(HTML, /spots=west\?worldV2\.occluders\(\)\.concat\(treasure\?treasure\.obstacles\(\):\[\]\):TREE_SPOTS;/);
  // 歩いているとき：西の草原では、木にかからない向きへカメラをゆっくり回す（自分で回したときは、その向き）
  assert.match(HTML, /if\(px<WEST_PULL_X&&Math\.abs\(yawT\)<\.02&&Math\.abs\(zoomT-1\)<\.02&&worldV2\.isActive\(\)\)\{/);
});

test('16. 動きを減らす設定：ミナのジャンプ・ねこの寝息・水の輪・宝箱のふた・ヒントの光は、止めるか、すぐ終わる形にする', () => {
  const upd = between(UI, 'function update(t, dt) {', '\n  // 「話す／しらべる」の案内');
  assert.match(upd, /const x = character\.position\.x, z = character\.position\.z, calm = still\(\)/);
  for (const re of [/minaBody\.position\.y = !calm/, /st\.found\.cat \|\| calm \? 1/, /const u = calm \? \.6/, /if \(ev\) stepEvent\(dt, t, calm\);/, /u = calm \? \.5/])
    assert.match(upd, re);
});

test('19. FOLLOWUP：演出に使う物の描き方と絵は、読み込みのときに用意する（はじめての演出で一瞬止まらない）。隠していた物は隠したまま', () => {
  const w = UI.match(/function warmUp\(\) \{([\s\S]*?)\n  \}/);
  assert.ok(w, 'warmUp');
  assert.match(w[1], /renderer\.compile\(scene, camera\)/);
  assert.match(w[1], /renderer\.initTexture\(m\.map\)/);
  assert.match(w[1], /hidden\.forEach\(o => \{ o\.visible = false; \}\)/);
  assert.match(UI, /warmUp\(\);\s*built = true;/);
});
