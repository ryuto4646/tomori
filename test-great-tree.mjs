// EXPANSION-03：巨木への道・大きな生きもの（オオネ）との対話・ひかりのつるのタネと橋のテスト。ブラウザも通信も使わない
// 進み方（TREASURE-CORE）と歩ける範囲（TERRAIN・ADVENTURE）を取り出して動かし、表示（TREASURE-UI・MISSION-HOLD）はコードの形を確かめる
// 実行: node --test test-great-tree.mjs
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
const HOLD = between(HTML, '// MISSION-HOLD-BEGIN', '// MISSION-HOLD-END');
const TERRAIN = between(HTML, '// TERRAIN-BEGIN', '// TERRAIN-END');
const ADV = between(HTML, '// ADVENTURE-BEGIN', '// ADVENTURE-END');
const T = new Function(CORE + `
return { TREASURE_SPOTS, TREASURE_HINTS, TREASURE_TALK, TREASURE_ITEMS, TREASURE_GUIDE, TREASURE_SHARDS, GREAT_PATH_SHARDS, GREAT_TEXT, GIANT_TALK, GIANT_TOPICS, GIANT_OTHER,
  createTreasureState, treasureGoal, greatGoal, hintGoal, treasureItems, treasureTalk, treasureMoreHint, treasureInspect, treasureLantern, treasureMemo, restoreTreasure,
  treasureShards, treasureGiantDone, treasurePlant, treasureArrive, giantTopics, giantReply };`)();
const W = new Function(TERRAIN + ADV + '\nreturn { heightAt, inWalk, clampWalk, GREAT, GREAT_ROUTE, GREAT_OPEN, GREAT_TOTAL, steerGreat, greatS, greatAt, WALK };')();
const open = (path, bridge) => { W.GREAT_OPEN.path = path; W.GREAT_OPEN.bridge = bridge; };

// 宝さがしを最後まで（ほらあなの絵まで）
function treasureDone(st = T.createTreasureState()) {
  T.treasureTalk(st, 'popo');
  for (const id of ['cat', 'bell', 'spring', 'chest']) T.treasureInspect(st, id);
  T.treasureLantern(st, true); T.treasureInspect(st, 'cave');
  assert.equal(st.caveLit, true);
  return st;
}
function walkAll(st) {
  assert.equal(T.treasureInspect(st, 'gate').kind, 'gateLit');
  assert.equal(T.treasureInspect(st, 'giant').kind, 'wake');
  assert.equal(T.treasureGiantDone(st), true);
  assert.equal(T.treasurePlant(st), true);
  assert.equal(T.treasureArrive(st), true);
  return st;
}

test('1. 順番：ほらあなの絵 → 門（かけらで道がひらく）→ 目をさます → 対話 → タネ → 植えて橋 → 向こう岸。飛ばせない', () => {
  const st = T.createTreasureState();
  assert.equal(T.greatGoal(st), 'locked');
  assert.equal(T.treasureInspect(st, 'gate').kind, 'gateEarly');
  assert.equal(T.treasureInspect(st, 'giant').kind, 'giantEarly');
  assert.equal(T.treasureInspect(st, 'plant').kind, 'plantEarly');
  assert.equal(T.treasureGiantDone(st), false); assert.equal(T.treasurePlant(st), false); assert.equal(T.treasureArrive(st), false);
  treasureDone(st);
  assert.equal(T.greatGoal(st), 'gate');
  assert.equal(T.treasureGiantDone(st), false, 'not before waking');
  assert.equal(T.treasureInspect(st, 'gate').kind, 'gateLit'); assert.equal(T.greatGoal(st), 'giant');
  assert.equal(T.treasureInspect(st, 'gate').kind, 'gateAgain');
  assert.equal(T.treasurePlant(st), false, 'no seed yet');
  assert.equal(T.treasureInspect(st, 'giant').kind, 'wake'); assert.equal(T.greatGoal(st), 'talk');
  assert.equal(T.treasureInspect(st, 'giant').kind, 'talk', 'talk again until finished');
  assert.equal(T.treasureGiantDone(st), true); assert.equal(T.greatGoal(st), 'plant');
  assert.equal(T.treasureInspect(st, 'plant').kind, 'plantReady');
  assert.equal(T.treasureArrive(st), false, 'no bridge yet');
  assert.equal(T.treasurePlant(st), true); assert.equal(T.greatGoal(st), 'cross');
  assert.equal(T.treasureInspect(st, 'plant').kind, 'plantAgain');
  assert.equal(T.treasureInspect(st, 'cairn').kind, 'cairnEarly');
  assert.equal(T.treasureArrive(st), true); assert.equal(T.greatGoal(st), 'end');
  assert.equal(T.treasureInspect(st, 'cairn').kind, 'cairn');
  const again = T.treasureInspect(st, 'giant'); assert.equal(again.kind, 'again'); assert.equal(again.stage, 'end');
});

test('2. かけら：今回は宝箱の1つで道がひらく。使っても減らない。冒険を足すときは TREASURE_SHARDS に足す', () => {
  assert.equal(T.GREAT_PATH_SHARDS, 1);
  assert.ok(Array.isArray(T.TREASURE_SHARDS) && T.TREASURE_SHARDS.length === 1 && Object.isFrozen(T.TREASURE_SHARDS));
  const st = walkAll(treasureDone());
  assert.equal(T.treasureItems(st).shards, 1, 'shard stays');
  assert.equal(T.treasureShards(st), 1);
});

test('3. タネ：対話を終えると1つ。二度目はもらえない。植えると0。植えるのは1回だけ（数を別に持たないので、なくなりも増えもしない）', () => {
  const st = treasureDone();
  T.treasureInspect(st, 'gate'); T.treasureInspect(st, 'giant');
  assert.equal(T.treasureItems(st).seed, 0);
  assert.equal(T.treasureGiantDone(st), true); assert.equal(T.treasureItems(st).seed, 1);
  assert.equal(T.treasureGiantDone(st), false); assert.equal(T.treasureItems(st).seed, 1);
  assert.equal(T.treasurePlant(st), true); assert.equal(T.treasureItems(st).seed, 0);
  assert.equal(T.treasurePlant(st), false); assert.equal(T.treasureItems(st).seed, 0);
  assert.equal(st.bridgeBuilt, true);
  assert.match(T.TREASURE_ITEMS.seed.name, /ひかりのつるのタネ/);
  assert.match(T.TREASURE_ITEMS.seed.words, /光る|青く光る/); assert.match(T.TREASURE_ITEMS.seed.words, /植える/);   // 見た目と使い方
});

test('4. 保存：前の記録（新しい項目なし）はそのまま読めて、続きから始まる。順番を飛ばした記録は、順番どおりのところまで', () => {
  const old = JSON.parse(JSON.stringify(treasureDone()));
  for (const k of ['pathOpen', 'giantAwake', 'giantTalked', 'bridgeBuilt', 'arrived']) delete old[k];
  delete old.hint.gate;
  const st = T.restoreTreasure(old);
  assert.equal(st.caveLit, true); assert.equal(st.pathOpen, false); assert.equal(st.hint.gate, 0);
  assert.equal(T.greatGoal(st), 'gate');
  const full = walkAll(treasureDone()); T.treasureTalk(full, 'popo');
  assert.deepEqual(T.restoreTreasure(JSON.parse(JSON.stringify(full))), full);
  // 宝箱を開けていないのに橋がある・話していないのに橋がある、のような記録
  const skip = T.restoreTreasure({ v: 1, started: true, found: { cat: true, bell: true, spring: true }, chestOpened: true, caveLit: true, pathOpen: true, giantAwake: false, giantTalked: true, bridgeBuilt: true, arrived: true, hint: { gate: 9 } });
  assert.equal(skip.pathOpen, true); assert.equal(skip.giantTalked, false); assert.equal(skip.bridgeBuilt, false); assert.equal(skip.arrived, false);
  assert.equal(skip.hint.gate, 3);
  const noCave = T.restoreTreasure({ v: 1, started: true, found: { cat: true, bell: true, spring: true }, chestOpened: true, caveLit: false, pathOpen: true, bridgeBuilt: true });
  assert.equal(noCave.pathOpen, false); assert.equal(noCave.bridgeBuilt, false);
});

test('5. ポポ・ミナ・冒険メモ：門のヒント（聞くたびにくわしく）。そのあとは道の進み具合のひとこと。書いたことばはメモに残らない', () => {
  const st = treasureDone();
  const p = T.treasureTalk(st, 'popo');
  assert.equal(p.goal, 'gate'); assert.equal(p.hint, 1); assert.match(p.line, /同じもよう/);
  assert.equal(T.hintGoal(st), 'gate');
  assert.equal(T.treasureMoreHint(st), 2); assert.equal(T.treasureMoreHint(st), 3); assert.equal(T.treasureMoreHint(st), 3);
  assert.match(T.TREASURE_HINTS.gate[2].text, /古い門/);
  assert.match(T.treasureMemo(st).map(m => m.text).join('\n'), /古い門/);
  assert.equal(T.treasureTalk(st, 'mina').goal, 'gate');
  T.treasureInspect(st, 'gate');
  for (const [step, re] of [['giant', /待っておる/], ['talk', /ことばを聞く/], ['plant', /植える場所/], ['cross', /光の橋/], ['end', /空にうかぶ島/]]) {
    if (step === 'talk') T.treasureInspect(st, 'giant');
    if (step === 'plant') T.treasureGiantDone(st);
    if (step === 'cross') T.treasurePlant(st);
    if (step === 'end') T.treasureArrive(st);
    const r = T.treasureTalk(st, 'popo'); assert.equal(r.goal, null, step); assert.match(r.line, re, step);
    assert.ok(T.TREASURE_GUIDE[step], step);
  }
  const memo = T.treasureMemo(st).map(m => m.text).join('\n');
  for (const k of ['memoPath', 'memoGiant', 'memoTalk', 'memoBridge', 'memoArrive']) assert.ok(memo.includes(T.GREAT_TEXT[k]), k);
  assert.ok(!/ヒント 3\/3/.test(T.treasureMemo(st).filter(m => /古い門を、しらべて/.test(m.text)).map(m => m.label).join('')), 'gate hint hidden after opening');
});

test('6. 対話の答え：出会ったものだけを選べる（＋ほかのこと）。固定の受けとめは、正しい・上手を言わない', () => {
  const st = T.createTreasureState();
  assert.deepEqual(T.giantTopics(st).map(t => t.id), ['other']);
  const done = walkAll(treasureDone());
  assert.deepEqual(T.giantTopics(done).map(t => t.id), ['cat', 'bell', 'spring', 'chest', 'mural', 'gate', 'popo', 'other'], 'not met mina yet');
  T.treasureTalk(done, 'mina');
  assert.deepEqual(T.giantTopics(done).map(t => t.id), ['cat', 'bell', 'spring', 'chest', 'mural', 'gate', 'popo', 'mina', 'other']);
  for (const t of T.giantTopics(done)) { assert.equal(t.aspects.length, 3, t.id); for (const a of t.aspects) assert.ok(a.length <= 14, a); }
  for (const r of [T.giantReply('ねこ', 'ねむっているすがた', false), T.giantReply('ねこ', '', true)]) {
    assert.ok(!/正解|不正解|まちが|間違|上手|すごい|えらい|点/.test(r), r);
    assert.ok(Array.from(r).length <= 60, r);
  }
  assert.match(T.GIANT_TALK.ask1, /何が気になった/); assert.match('ねこ' + T.GIANT_TALK.ask2, /どんなところが気になった/);
  for (const l of T.GIANT_TALK.wake) for (const row of l.split('\n')) assert.ok(Array.from(row).length <= 45, row);   // 短く、少しずつ
});

test('7. 場所：門は草原のはし（閉じていても、しらべられる距離）。オオネ・途切れた道・うずまきの石は巨木への道の上', () => {
  const S = T.TREASURE_SPOTS, G = W.GREAT;
  assert.deepEqual([S.gate.x, S.gate.z], [G.gate.x, G.gate.z]);
  open(false, false);
  const near = W.clampWalk({ x: S.gate.x, z: S.gate.z }, false);
  assert.ok(Math.hypot(near.x - S.gate.x, near.z - S.gate.z) < 1.6, 'gate reachable from the meadow edge');
  for (const id of ['giant', 'plant', 'cairn']) assert.ok(!W.inWalk(S[id].x, S[id].z, false), `${id} closed`);
  open(true, true);
  for (const id of ['giant', 'plant', 'cairn']) {
    const p = W.clampWalk({ x: S[id].x, z: S[id].z }, false);
    assert.ok(Math.hypot(p.x - S[id].x, p.z - S[id].z) <= 2.0 - .2, `${id} reachable (${p.x.toFixed(2)},${p.z.toFixed(2)})`);
  }
  for (const id of Object.keys(S)) for (const o of Object.keys(S)) if (o !== id) assert.ok(Math.hypot(S[id].x - S[o].x, S[id].z - S[o].z) > 2.2, `${id} vs ${o}`);
  open(false, false);
});

test('8. 歩ける範囲：ひらくまで門の先へ行けない。ひらくと道と広場。橋ができるまで川は渡れない。幹とオオネの体には入らない', () => {
  const R = W.GREAT_ROUTE, G = W.GREAT, mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  open(false, false);
  for (const p of R.slice(1)) assert.ok(!W.inWalk(p[0], p[1], false), `closed ${p}`);
  open(true, false);
  for (let i = 0; i < G.bridgeFrom; i++) assert.ok(W.inWalk(...mid(R[i], R[i + 1]), false), `path ${i}`);
  assert.ok(W.inWalk(G.clearing.x + 3, G.clearing.z + 1, false), 'clearing');
  assert.ok(!W.inWalk(...mid(R[G.bridgeFrom], R[G.bridgeFrom + 1]), false), 'river closed');
  assert.ok(!W.inWalk(G.overlook.x, G.overlook.z, false), 'far bank closed');
  assert.ok(!W.inWalk(G.tree.x + .5, G.tree.z, false) && !W.inWalk(G.being.x, G.being.z + .3, false), 'trunk and body');
  const pushed = W.clampWalk({ x: G.being.x + .2, z: G.being.z }, false);
  assert.ok(Math.hypot(pushed.x - G.being.x, pushed.z - G.being.z) >= G.being.r - 1e-9);
  // 川の上（橋の外）から向こう岸へ近道できない
  const off = W.clampWalk({ x: G.river[1][0], z: G.river[1][1] + 3 }, false);
  assert.ok(Math.hypot(off.x - G.overlook.x, off.z - G.overlook.z) > G.overlook.r, 'no shortcut over the water');
  open(true, true);
  assert.ok(W.inWalk(...mid(R[G.bridgeFrom], R[G.bridgeFrom + 1]), false), 'bridge');
  assert.ok(W.inWalk(G.overlook.x, G.overlook.z, false), 'far bank');
  const [bx, bz] = mid(R[G.bridgeFrom], R[G.bridgeFrom + 1]), ux = (R[G.bridgeFrom + 1][0] - R[G.bridgeFrom][0]), uz = (R[G.bridgeFrom + 1][1] - R[G.bridgeFrom][1]), ul = Math.hypot(ux, uz);
  assert.ok(W.inWalk(bx - uz / ul * .5, bz + ux / ul * .5, false), 'on the bridge');
  assert.ok(!W.inWalk(bx - uz / ul * 1.2, bz + ux / ul * 1.2, false) && !W.inWalk(bx + uz / ul * 1.2, bz - ux / ul * 1.2, false), 'the water beside the bridge');
  open(false, false);
});

test('9. 地形：巨木への道・広場・向こう岸・川は平らで、坂は12°以下。草原の中と、草原の外の丘は前のまま', () => {
  const R = W.GREAT_ROUTE, G = W.GREAT, slope = (x, z) => { const dx = (W.heightAt(x + .05, z) - W.heightAt(x - .05, z)) / .1, dz = (W.heightAt(x, z + .05) - W.heightAt(x, z - .05)) / .1; return Math.atan(Math.hypot(dx, dz)) * 180 / Math.PI; };
  let worst = 0;
  for (let i = 0; i < R.length - 1; i++) for (let k = 0; k <= 30; k++) { const x = R[i][0] + (R[i + 1][0] - R[i][0]) * k / 30, z = R[i][1] + (R[i + 1][1] - R[i][1]) * k / 30; worst = Math.max(worst, slope(x, z)); }
  assert.ok(worst <= 12, `route slope ${worst.toFixed(1)}`);
  for (const a of [G.clearing, G.overlook]) for (let k = 0; k < 16; k++) { const x = a.x + Math.cos(k) * a.r * .9, z = a.z + Math.sin(k) * a.r * .9; assert.ok(Math.abs(W.heightAt(x, z)) < .05, `flat ${x},${z}`); }
  for (const p of G.river) assert.ok(Math.abs(W.heightAt(p[0], p[1])) < .05, 'river flat');
  assert.ok(W.heightAt(-18, -14) > 1 && W.heightAt(0, -24) > 1, 'hills outside');
});

test('10. 道に沿って歩く：草原から巨木・向こう岸へ、角で止まらずに着く（タップ1回）。帰りも同じ。毎フレームの計算で物を作らない', () => {
  open(true, true);
  const walk = (from, to) => {
    const p = { x: from[0], z: from[1] }, o = { x: 0, z: 0 };
    for (let i = 0; i < 900; i++) {
      W.steerGreat(p.x, p.z, to[0], to[1], o);
      const dx = o.x - p.x, dz = o.z - p.z, d = Math.hypot(dx, dz);
      if (Math.hypot(to[0] - p.x, to[1] - p.z) < .6) return i;
      const st = Math.min(.055, d); p.x += dx / d * st; p.z += dz / d * st; W.clampWalk(p, false);
    }
    return -1;
  };
  const toTree = walk([-4, -6], [W.GREAT.clearing.x + 1.5, W.GREAT.clearing.z + 1]);
  assert.ok(toTree > 0, 'meadow → clearing'); assert.ok(toTree * .055 / 3.3 < 14, `${(toTree * .055 / 3.3).toFixed(1)}s`);
  assert.ok(walk([W.GREAT.clearing.x + 1.5, W.GREAT.clearing.z + 1], [W.GREAT.overlook.x, W.GREAT.overlook.z]) > 0, 'clearing → far bank (bridge)');
  assert.ok(walk([W.GREAT.overlook.x, W.GREAT.overlook.z], [-2, -5]) > 0, 'far bank → meadow');
  const steer = ADV.slice(ADV.indexOf('function greatS('));
  assert.ok(!/\bnew\b|=>|\[\s*\]|\{\s*x:/.test(steer), 'no allocation while steering');
  open(false, false);
});

test('11. 対話の画面：「あとで・冒険にもどる」で閉じられる（待つあいだも）。閉じているあいだの返事は「続ける」まで出さない。世代番号で古い返事を捨てる', () => {
  const ui = code(UI);
  assert.match(HOLD, /GIANT: 'panel-giant'/);
  assert.match(HOLD, /const where = state === S\.GIANT \? treasure\.holdSpot\(\)/);
  assert.match(HOLD, /heldState: \(\) => hold && hold\.state/);
  const send = ui.slice(ui.indexOf('function giantSend('), ui.indexOf('function giantVoice('));
  assert.match(send, /if \(gs\.sending\) return;/);
  assert.match(send, /if \(missionHold\) await missionHold\.whenOpen\(\);\s*if \(gen !== giantGen \|\| !gs \|\| gs\.step !== 'wait'\) return;/);
  assert.match(send, /const care = localExpandCare\(/);
  assert.match(send, /if \(!typed\) \{ gs\.reply = giantReply\(label, aspect, false\);/, 'choosing only works without AI');
  assert.match(ui, /function reset\(\) \{[\s\S]*?giantGen\+\+; gs = null;/);
  assert.match(ui, /if \(id === 'giant' && heldGiant\(\)\) \{ missionHold\.resume\(\); return; \}/, 'the giant resumes, does not restart');
  // 書いたことばは端末に残さない（保存は st だけ。gs は保存しない）
  assert.ok(!/JSON\.stringify\(gs|localStorage[\s\S]{0,40}gs/.test(ui));
  assert.ok(!/giant-input/.test(CORE));
});

test('12. 植える・受け取るは1回だけ（保存は演出の前）。演出は3D を見せてから説明。動きを減らす設定にもそろう', () => {
  const ui = code(UI);
  assert.match(ui, /function plantSeed\(\) \{\s*if \(state !== S\.TALK \|\| openId !== 'plant' \|\| !treasurePlant\(st\)\) return;\s*save\(\);/);
  assert.match(ui, /else if \(step === 'reply'\) \{ if \(treasureGiantDone\(st\)\) save\(\);/);
  assert.match(ui, /const EV_DUR = \{ chest: 2\.4, cave: 3\.6, path: 2\.8, wake: 3\.4, bridge: 3\.6, arrive: 2\.6 \};/);
  assert.match(ui, /ev = \{ kind, t: 0, dur: still\(\) \? \.6 : EV_DUR\[kind\] \};/);
  assert.match(ui, /if \(kind === 'wake'\) \{ giantBegin\('wake'\); setState\(S\.GIANT\); \}/);
  assert.match(ui, /if \(r && \(r\.kind === 'gateLit' \|\| r\.kind === 'wake'\)\) \{ save\(\); startEvent/);
  // 新しいテクスチャは作らない（光の模様は、かべの絵の光る層を使う）・点光源なし・新しい描画ループなし
  const great = ui.slice(ui.indexOf('function buildGreat('), ui.indexOf('function lightStones('));
  assert.ok(!/Texture\(|PointLight|SpotLight|requestAnimationFrame|setInterval|setTimeout/.test(great));
  assert.match(great, /const glowTex = fx\.muralGlow\.material\.map;/);
});

test('13. もちもの・上の知らせ・リセットの確認：タネの見た目と使い方、道の案内、巨木への冒険も消えると伝える', () => {
  assert.match(UI, /if \(it\.seed\) rows\.push\(\[TREASURE_ITEMS\.seed\.icon, TREASURE_ITEMS\.seed\.name, TREASURE_ITEMS\.seed\.words\]\);/);
  assert.match(UI, /TREASURE_GUIDE\[g === 'done' && greatGoal\(st\) !== 'locked' \? greatGoal\(st\) : g\]/);
  assert.match(HTML, /confirm\('デモを最初からやり直しますか？\\n宝さがしと巨木への冒険の記録、もちものも消えます。'\)/);
  // 会話の文は短い行で（子どもが読める）
  for (const v of Object.values(T.GREAT_TEXT)) for (const row of v.split('\n')) assert.ok(Array.from(row).length <= 60, row);
});
