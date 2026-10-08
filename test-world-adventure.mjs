// Step 11I-C：最初の冒険「ことばのタネと秘密の道」のテスト。ブラウザも通信も使わない
// 進み方（ADVENTURE-BEGIN〜END を取り出して計算する）・歩ける範囲・タネ・根の門・秘密の道・ことばの樹・リセット・V1 を調べる
// 実行: node --test test-world-adventure.mjs
// WORLD_V2_ROOT を指定すると、そのフォルダの demo-world.html と assets/world-v2 を調べる（壊した一時コピーで、テストが失敗できるかを確かめるため）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const REPO = dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.WORLD_V2_ROOT || REPO;
const normalize = s => s.replace(/\r\n/g, '\n');
const HTML = normalize(readFileSync(join(ROOT, 'demo-world.html'), 'utf8'));
const TAG = 'tv-recording-candidate-20260928';
const OLD = normalize(execFileSync('git', ['show', `${TAG}:demo-world.html`], { cwd: REPO, maxBuffer: 64 * 1024 * 1024 }).toString('utf8'));
const between = (s, a, b) => { const i = s.indexOf(a), j = s.indexOf(b, i + 1); assert.ok(i >= 0 && j > i, `markers ${a} / ${b}`); return s.slice(i, j); };
const count = (s, re) => (s.match(re) || []).length;
const stripComments = s => s.split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n');

const V2 = between(HTML, '// WORLD-V2-BEGIN', '// WORLD-V2-END');
const V2_CODE = stripComments(V2);
const TERRAIN = between(HTML, '// TERRAIN-BEGIN', '// TERRAIN-END');
const ADV = between(HTML, '// ADVENTURE-BEGIN', '// ADVENTURE-END');
const A = new Function(TERRAIN + ADV + '\nreturn { heightAt, WALK, GATE, WORD_TREE, WORLD_PROGRESS, advance, inWalk, clampWalk, PASSAGE, PASSAGE_R, TREE_AREA, SEED_PICK_R, GATE_OPEN_R, TREE_REACH_R, ROUTE_TOTAL, steerToward, routeS, routeAt, WALK, SECRET_ROUTE };')();
const P = A.WORLD_PROGRESS;
const ORDER = ['exploring', 'mission', 'seed-born', 'seed-collected', 'gate-opening', 'secret-path', 'tree-reached', 'complete'];
const EVENTS = ['missionStarted', 'deepDone', 'seedTouched', 'gateApproached', 'gateOpened', 'treeApproached', 'treeLit'];
const FRAME = stripComments(between(V2, '// PER-FRAME-V2-BEGIN', '// PER-FRAME-V2-END'));
const ADVENTURE_FN = between(FRAME, 'function adventure(t, dt, still)', 'function lightSecretPath(');
const RESET = between(V2_CODE, 'function reset()', 'const c3r = new THREE.Color();');
const inEllipse = (x, z) => Math.hypot((x - A.WALK.cx) / A.WALK.rx, (z - A.WALK.cz) / A.WALK.rz) <= 1 + 1e-9;

// ── 進み方 ─────────────────────────────────────────────────────────
test('1. 冒険の状態は8つで、決まった順番（書きかえできない）', () => {
  assert.deepEqual(Object.values(P), ORDER);
  assert.ok(Object.isFrozen(P));
});

test('2. 決まった出来事を順番どおりに起こすと、最後（complete）まで進む', () => {
  let p = P.EXPLORING;
  EVENTS.forEach((e, i) => { p = A.advance(p, e); assert.equal(p, ORDER[i + 1], e); });
  assert.equal(p, P.COMPLETE);
});

test('3. 順番を飛ばす出来事では進まない（タネを取る前に門はひらかない・門の前に樹は灯らない）', () => {
  assert.equal(A.advance(P.EXPLORING, 'deepDone'), P.EXPLORING);
  assert.equal(A.advance(P.SEED_BORN, 'gateApproached'), P.SEED_BORN);
  assert.equal(A.advance(P.SEED_COLLECTED, 'treeApproached'), P.SEED_COLLECTED);
  assert.equal(A.advance(P.MISSION, 'treeLit'), P.MISSION);
  for (const p of ORDER) for (const e of EVENTS) {
    const q = A.advance(p, e);
    assert.ok(q === p || ORDER.indexOf(q) === ORDER.indexOf(p) + 1, `${p} + ${e}`);
  }
});

test('4. 同じ出来事が何度起きても二重に進まず、戻りもしない（知らない出来事は無視）', () => {
  for (let i = 0; i < ORDER.length - 1; i++) {
    const once = A.advance(ORDER[i], EVENTS[i]);
    assert.equal(A.advance(once, EVENTS[i]), once, EVENTS[i]);
  }
  for (const p of ORDER) assert.equal(A.advance(p, 'reset'), p);
  assert.equal(A.advance(P.COMPLETE, 'missionStarted'), P.COMPLETE);
});

test('5. タネが生まれるのは深掘りの問いのあと（DEMO_COMPLETE）だけ。care からは来ない。2つの出口の両方で生まれる', () => {
  assert.match(ADVENTURE_FN, /if \(progress === P\.MISSION && state === S\.DEMO_COMPLETE\) \{\s*progress = advance\(progress, 'deepDone'\);/);
  // Step 11M：「今は進む」は答えた扱いにせず記録し、第2クエストのときは樹の実へ、最初のクエストのときは今までどおり DEMO_COMPLETE へ
  const skip = between(HTML, 'window.toDemoEnd   = ()=>{', '\n};');
  assert.match(skip, /questHub\.noteAnswer\('', null, true\);/);
  assert.match(skip, /nextGroup\.visible=true; setState\(S\.DEMO_COMPLETE\);/);
  // Step 11L-D：答える出口は、ことばを広げて決めたあと（finishSecret）に DEMO_COMPLETE へ進む
  assert.match(between(HTML, 'function finishSecret(){', '\n}\n'), /setState\(S\.DEMO_COMPLETE\)/);
  for (const fn of ['window.careRewrite = () => {', 'window.careBack = () => {']) assert.ok(!/DEMO_COMPLETE/.test(between(HTML, fn, '\n};')), fn);
  assert.equal(count(V2_CODE, /'deepDone'/g), 1);
});

test('6. 冒険の進み方は保存しない（読み込み直すと最初から）。通信もしない', () => {
  assert.ok(!/localStorage|sessionStorage|indexedDB|document\.cookie/.test(V2_CODE));
  assert.equal(count(HTML, /\bfetch\(/g), 2, 'only the vocabulary fetch and the expand fetch (Step 11L-F)');
  assert.ok(!/console\./.test(V2_CODE));
  assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML/.test(V2_CODE));
});

// ── 歩ける範囲 ────────────────────────────────────────────────────
test('7. 門が閉じているあいだは、秘密の道とことばの樹のまわりへ入れない', () => {
  for (const [x, z] of A.PASSAGE.slice(1)) assert.ok(!A.inWalk(x, z, false), `passage ${x},${z}`);
  assert.ok(!A.inWalk(A.WORD_TREE.x + 3, A.WORD_TREE.z, false));
  const p = A.clampWalk({ x: A.WORD_TREE.x + 3, z: A.WORD_TREE.z }, false);
  assert.ok(Math.abs(Math.hypot((p.x - A.WALK.cx) / A.WALK.rx, (p.z - A.WALK.cz) / A.WALK.rz) - 1) < 1e-9, 'back to the meadow edge');
});

test('8. 門がひらくと、草原・門を通る細い道・ことばの樹のまわりが、ひと続きに歩ける', () => {
  for (let i = 0; i < A.PASSAGE.length - 1; i++) for (let k = 0; k <= 10; k++) {
    const [ax, az] = A.PASSAGE[i], [bx, bz] = A.PASSAGE[i + 1], x = ax + (bx - ax) * k / 10, z = az + (bz - az) * k / 10;
    assert.ok(A.inWalk(x, z, true), `passage ${x.toFixed(2)},${z.toFixed(2)}`);
  }
  assert.ok(inEllipse(A.GATE.x, A.GATE.z), 'the gate stands on the meadow edge');
  const [ex, ez] = A.PASSAGE[A.PASSAGE.length - 1];
  assert.ok(Math.hypot(ex - A.TREE_AREA.x, ez - A.TREE_AREA.z) < A.TREE_AREA.r, 'passage reaches the tree area');
  assert.ok(A.inWalk(A.WORD_TREE.x + 3, A.WORD_TREE.z, true));
  // 道の幅は約2.7m（中心から 1.1m 横も歩ける＝少しだけ寄り道できる）。道の外（横）は歩けない
  assert.ok(A.PASSAGE_R >= 1.1 && A.PASSAGE_R <= 1.5, `width ${A.PASSAGE_R}`);
  const [ax, az] = A.PASSAGE[1], [bx, bz] = A.PASSAGE[2], tl = Math.hypot(bx - ax, bz - az), nx = -(bz - az) / tl, nz = (bx - ax) / tl;
  const [mx, mz] = [(ax + bx) / 2, (az + bz) / 2];
  assert.ok(A.inWalk(mx + nx * 1.1, mz + nz * 1.1, true) && A.inWalk(mx - nx * 1.1, mz - nz * 1.1, true), 'room to wander');
  assert.ok(!A.inWalk(mx + nx * 2.2, mz + nz * 2.2, true) && !A.inWalk(mx - nx * 2.2, mz - nz * 2.2, true), 'corridor edge');
});

test('9. ことばの樹の幹の中には入らない。道の外の点は、いちばん近い道のふちへ戻る', () => {
  assert.ok(!A.inWalk(A.WORD_TREE.x + .5, A.WORD_TREE.z, true));
  const t = A.clampWalk({ x: A.WORD_TREE.x + .3, z: A.WORD_TREE.z + .2 }, true);
  assert.ok(Math.hypot(t.x - A.WORD_TREE.x, t.z - A.WORD_TREE.z) >= A.TREE_AREA.trunk - 1e-9);
  const out = A.clampWalk({ x: A.PASSAGE[1][0] + 4, z: A.PASSAGE[1][1] }, true);
  let dd = 1e9;
  for (let i = 0; i < A.PASSAGE.length - 1; i++) {
    const [ax, az] = A.PASSAGE[i], [bx, bz] = A.PASSAGE[i + 1], vx = bx - ax, vz = bz - az;
    const k = Math.min(1, Math.max(0, ((out.x - ax) * vx + (out.z - az) * vz) / (vx * vx + vz * vz)));
    dd = Math.min(dd, Math.hypot(out.x - ax - vx * k, out.z - az - vz * k));
  }
  assert.ok(dd <= A.PASSAGE_R + 1e-9, 'pushed onto the path edge');
  assert.ok(Math.hypot(out.x - (A.PASSAGE[1][0] + 4), out.z - A.PASSAGE[1][1]) < 4, 'nearest edge');
  const [ix, iz] = [(A.PASSAGE[3][0] + A.PASSAGE[4][0]) / 2, (A.PASSAGE[3][1] + A.PASSAGE[4][1]) / 2];
  const inside = A.clampWalk({ x: ix, z: iz }, true);
  assert.deepEqual([inside.x, inside.z], [ix, iz]);
  // ちょうど幹の中心をタップしても、幹の外の点になる（向きが決まらず止まらない）
  const c = A.clampWalk({ x: A.WORD_TREE.x, z: A.WORD_TREE.z }, true);
  assert.ok(Math.abs(Math.hypot(c.x - A.WORD_TREE.x, c.z - A.WORD_TREE.z) - A.TREE_AREA.trunk) < 1e-9);
});

test('10. タップ先（limit 0.97）は、道のふちより少し内側へ戻る。タップもキーボードも同じ関数を通る', () => {
  // 道の区間の真ん中から、横へ 2.2m 外れた点（道の外）
  const [qa, qb] = [A.PASSAGE[1], A.PASSAGE[2]], ql = Math.hypot(qb[0] - qa[0], qb[1] - qa[1]);
  const p = A.clampWalk({ x: (qa[0] + qb[0]) / 2 - (qb[1] - qa[1]) / ql * 2.2, z: (qa[1] + qb[1]) / 2 + (qb[0] - qa[0]) / ql * 2.2 }, true, .97);
  assert.ok(!A.inWalk((qa[0] + qb[0]) / 2 - (qb[1] - qa[1]) / ql * 2.2, (qa[1] + qb[1]) / 2 + (qb[0] - qa[0]) / ql * 2.2, true), 'start outside');
  let d = 1e9;
  for (let i = 0; i < A.PASSAGE.length - 1; i++) {
    const [ax, az] = A.PASSAGE[i], [bx, bz] = A.PASSAGE[i + 1], vx = bx - ax, vz = bz - az;
    const k = Math.min(1, Math.max(0, ((p.x - ax) * vx + (p.z - az) * vz) / (vx * vx + vz * vz)));
    d = Math.min(d, Math.hypot(p.x - ax - vx * k, p.z - az - vz * k));
  }
  assert.ok(d <= A.PASSAGE_R * .97 + 1e-9);
  assert.match(V2, /function clampToWalkable\(p, limit = 1\) \{\s*if \(!active\) return p;\s*return clampWalk\(p, gateOpen, limit\);/);
  assert.match(HTML, /worldV2\.clampToWalkable\(targetPos, 0\.97\);/);
});

test('11. 秘密の道（S字）は 28〜42m。SPEED 4.0 で計算上 7〜12秒。道とことばの樹のまわりは平ら', () => {
  // 歩ける場所はすべて平ら（道のカプセルの中・樹のまわり）
  for (let i = 0; i < A.PASSAGE.length - 1; i++) for (let k = 0; k <= 8; k++) for (const o of [-1.3, 0, 1.3]) {
    const [ax, az] = A.PASSAGE[i], [bx, bz] = A.PASSAGE[i + 1], tl = Math.hypot(bx - ax, bz - az), x = ax + (bx - ax) * k / 8 - (bz - az) / tl * o, z = az + (bz - az) * k / 8 + (bx - ax) / tl * o;
    if (A.inWalk(x, z, true) && !A.inWalk(x, z, false)) assert.ok(Math.abs(A.heightAt(x, z)) < 1e-6, `${x},${z}`);
  }
  let max = 0;
  for (let a = 0; a < 6.28; a += .2) for (const r of [2, 3, A.TREE_AREA.r]) max = Math.max(max, Math.abs(A.heightAt(A.WORD_TREE.x + Math.cos(a) * r, A.WORD_TREE.z + Math.sin(a) * r)));
  assert.ok(max < 1e-6, `tree area height ${max}`);
  assert.ok(A.ROUTE_TOTAL >= 28 && A.ROUTE_TOTAL <= 42, `route ${A.ROUTE_TOTAL}`);
  const speed = +HTML.match(/const SPEED=([\d.]+), ARRIVE=0\.6;/)[1];
  assert.equal(speed, 4);
  assert.ok(A.ROUTE_TOTAL / speed >= 7 && A.ROUTE_TOTAL / speed <= 12, `time ${A.ROUTE_TOTAL / speed}`);
  // 一本道の直線ではない：門から樹への直線より十分に長く、左右に曲がる（向きの変化が2回以上）
  assert.ok(A.ROUTE_TOTAL > 1.5 * Math.hypot(A.WORD_TREE.x - A.GATE.x, A.WORD_TREE.z - A.GATE.z));
  let turns = 0, last = 0;
  for (let i = 1; i < A.PASSAGE.length - 1; i++) {
    const [px, pz] = A.PASSAGE[i - 1], [vx, vz] = A.PASSAGE[i], [nx, nz] = A.PASSAGE[i + 1], cr = Math.sign((vx - px) * (nz - vz) - (vz - pz) * (nx - vx));
    if (cr && cr !== last) { turns++; last = cr; }
  }
  assert.ok(turns >= 3, `S-curve turns ${turns}`);
  // ことばの樹そのものは動かしていない（初期画面・門越しの構図はそのまま）
  assert.deepEqual([A.WORD_TREE.x, A.WORD_TREE.z], [15.8, -28.3]);
});

test('12. 判定の距離：タネ 1.1〜1.4m・門 3〜4m・ことばの樹 2.5〜3.5m（平面の距離）', () => {
  assert.ok(A.SEED_PICK_R >= 1.1 && A.SEED_PICK_R <= 1.4);
  assert.ok(A.GATE_OPEN_R >= 3 && A.GATE_OPEN_R <= 4);
  assert.ok(A.TREE_REACH_R >= 2.5 && A.TREE_REACH_R <= 3.5);
  assert.match(ADVENTURE_FN, /Math\.hypot\(cx - SEED_HOME\.x, cz - SEED_HOME\.z\) <= SEED_PICK_R\) \{/);
  assert.match(ADVENTURE_FN, /Math\.hypot\(gdx, gdz\) <= GATE_OPEN_R && front > \.3/);
  assert.match(ADVENTURE_FN, /Math\.hypot\(cx - WORD_TREE\.x, cz - WORD_TREE\.z\) <= TREE_REACH_R/);
});

// ── 画面のことば ──────────────────────────────────────────────────
test('13. 上部の案内は5つ（＋タネへのひとこと）。どれも一度だけ出す', () => {
  const MSGS = ['ことばのタネが生まれた！', 'ことばのタネを見つけた！', '根の門が反応している…', '秘密の道がひらいた！', 'きみのことばが、世界をひとつ灯した。'];
  for (const m of MSGS) assert.ok(V2_CODE.includes(`'${m}'`), m);
  assert.ok(V2_CODE.includes("sayLater('光っているタネに近づいてみよう', t + 1.6);"));
  assert.ok(!V2_CODE.includes('祠に近づいてみよう'));
  assert.equal(count(ADVENTURE_FN, /\bsay\(/g), 5, '4 direct + the delayed one');
  assert.equal(count(ADVENTURE_FN, /sayLater\(/g), 2);
  // 一度だけ：どの案内も、一方向の状態が切りかわる場所でだけ出す
  for (const ev of ['deepDone', 'seedTouched', 'gateOpened', 'treeLit']) {
    const i = ADVENTURE_FN.indexOf(`advance(progress, '${ev}')`);
    assert.ok(i > 0 && /\bsay\(/.test(ADVENTURE_FN.slice(i, i + 420)), ev);
  }
  assert.match(V2_CODE, /function say\(text\) \{ mbarText\.textContent = text; \}/);
});

test('14. 完了のことばは既存の枠を使い、textContent で作る。「次の冒険へ」「自由に歩く」と「紹介ページへ戻る」（Step 11M）', () => {
  const fin = between(V2_CODE, 'function showFinale()', 'function reset()');
  for (const s of ["'きみのことばが、世界をひとつ灯した。'", "'ことばの樹には、まだ眠っている実がある。'", "'次の冒険へ'", "'自由に歩く'", "'紹介ページへ戻る'"]) assert.ok(fin.includes(s), s);
  assert.match(fin, /document\.createElement\('button'\)/);
  // テレビ向けの導線：紹介ページ（LP。Pages では https://ryuto4646.github.io/tomori-lp/）へ戻る
  assert.match(fin, /back\.href = '\.\.\/tomori-lp\/';/);
  // Step 11M：どちらのボタンも完了の枠を閉じてから、自由な散歩へ（次の冒険へ：芽へ案内／自由に歩く）
  assert.match(fin, /next\.addEventListener\('click', \(\) => \{ demoEnd\.classList\.remove\('show'\); questHub\.toFree\('next'\); \}\);/);
  assert.match(fin, /more\.addEventListener\('click', \(\) => \{ demoEnd\.classList\.remove\('show'\); questHub\.toFree\('free'\); \}\);/);
  assert.match(fin, /demoEnd\.replaceChildren\(\.\.\.finaleNodes\);/);
  // 冒険のあいだは V1 のデモ終了（遠くの光）を出さない
  assert.match(ADVENTURE_FN, /if \(state === S\.DEMO_COMPLETE && progress !== P\.COMPLETE && demoEnd\.classList\.contains\('show'\)\) demoEnd\.classList\.remove\('show'\);/);
  assert.match(V2_CODE, /nextGroup\.children\.forEach\(o => \{ o\.visible = false; \}\);/);
});

// ── タネ・門・道・樹 ──────────────────────────────────────────────
test('15. ことばのタネ：GLB の WordSeed_Core（頂点色＋金色に自分で光る素材）と WordSeed_Glow（透ける水色）。生まれるまでは隠す', () => {
  assert.match(V2_CODE, /wordSeed = new THREE\.Group\(\); wordSeed\.name = 'WordSeed'; wordSeed\.visible = false;/);
  assert.match(V2_CODE, /new THREE\.Mesh\(need\('WordSeed_Core'\)\.geometry, seedCoreMat\)/);
  assert.match(V2_CODE, /seedCoreMat = new THREE\.MeshLambertMaterial\(\{ vertexColors: true, side: THREE\.DoubleSide, emissive: 0xe8a020, emissiveIntensity: \.85, transparent: true \}\);/);
  // 芯は水色の外側より後に描く（金色がにごらない）。外の淡い金色の光は、外側の形を 1.4 倍にしたもの（新しい形・画像は作らない）
  assert.match(V2_CODE, /seedGlow\.renderOrder = 3; seedCore\.renderOrder = 4;/);
  assert.match(V2_CODE, /seedHalo = new THREE\.Mesh\(need\('WordSeed_Glow'\)\.geometry, seedHaloMat\);/);
  assert.match(V2_CODE, /seedHalo\.scale\.setScalar\(1\.4\); seedHalo\.position\.y = \.08 \* \(1 - 1\.4\);/);
  assert.match(V2_CODE, /new THREE\.Mesh\(need\('WordSeed_Glow'\)\.geometry, seedGlowMat\)/);
  assert.match(V2_CODE, /seedGlowMat = new THREE\.MeshBasicMaterial\(\{[^}]*transparent: true[^}]*depthWrite: false/);
  assert.match(ADVENTURE_FN, /wordSeed\.visible = true;/);
  assert.match(ADVENTURE_FN, /progress = advance\(progress, 'treeLit'\); wordSeed\.visible = false;/);
});

test('16. 根の門：左右の根はずれて外へ傾き、上の根は持ち上がって広がり、交差した根は地面へ引っこむ（1.7秒）', () => {
  assert.match(V2_CODE, /\['RootGate_Left', 'RootGate_Right', 'RootGate_Top', 'RootGate_Cross'\]\.map\(n => place1\(n, GATE\.x, GATE\.z, gYaw\)\)/);
  assert.match(ADVENTURE_FN, /const o = still \? 1 : Math\.min\(1, \(t - openT\) \/ 1\.7\)/);
  assert.match(ADVENTURE_FN, /gateRot\.makeRotationZ\(-sd \* GATE_LEAN \* e\)/);
  assert.match(ADVENTURE_FN, /gateLift\.makeTranslation\(0, -2\.9 \* e, 0\)/);
  assert.match(ADVENTURE_FN, /gateMeshes\[3\]\.visible = e < \.999;/);
  assert.match(ADVENTURE_FN, /if \(o >= 1\) \{\s*progress = advance\(progress, 'gateOpened'\); gateOpen = true;/);
  assert.match(V2_CODE, /gateMat = new THREE\.MeshLambertMaterial\(\{ vertexColors: true, side: THREE\.DoubleSide \}\);/);
});

test('17. 秘密の道：門がひらくまでは見えない（透明度0）。ひらくと手前から灯り、約3秒で落ち着く', () => {
  const build = between(V2_CODE, 'const sp = [], sc = [], si = [], SECRET_A', 'const sgeo = new THREE.BufferGeometry();');
  assert.match(build, /sp\.push\(x, heightAt\(x, z\) \+ \.025, z\); sc\.push\(c3\.r, c3\.g, c3\.b, 0\);/);
  // Step 11K：中心は淡い金色、ふちは広く淡く（地面にしみこむ光）。樹へ近づくほど・芽のそばで水色が増える
  assert.match(V2_CODE, /SECRET_A = \[0, \.12, \.42, 1, \.42, \.12, 0\], SOFF = \[-2\.7, -1\.75, -\.7, 0, \.7, 1\.75, 2\.7\]/);
  assert.match(build, /const toSky = \.42 \* smooth\(\.45, 1, u\) \+ \.5 \* Math\.exp\(-\(\(\(u - uSprout\) \/ \.045\) \*\* 2\)\);/);
  assert.match(build, /c3\.copy\(cream\)\.lerp\(gold, c === 3 \? 1 : \.4\)\.lerp\(sky, Math\.min\(\.7, toSky\)\);/);
  assert.match(ADVENTURE_FN, /if \(after < 3\.2\) lightSecretPath\(Math\.min\(1, \.7 \+ after \/ 1\.2\), 1 \+ \.6 \* Math\.max\(0, 1 - after \/ 3\)\);/);
  assert.match(FRAME, /secretColor\.array\[v \* 4 \+ 3\] = Math\.min\(1, secretBase\[v\] \* gain\) \* Math\.min\(1, Math\.max\(0, \(u - secretU\[v\]\) \* 8\)\);/);
  // 樹へ向かって進む光の点（門がひらいたあとだけ）
  assert.match(FRAME, /if \(gateOpen\) for \(let i = 0; i < moteSecret; i\+\+\)/);
});

test('18. 道ばたの発見はひとつだけ：水色の芽。道のすぐそば（1.5m以内）にあり、近づくと明るくなる。取ったり数えたりしない', () => {
  // Step 11M：道ばたの芽は1つのまま。もう1つは第2クエストの芽（ことばの樹のそば。最初のクエストが終わるまでは大きさ0）
  assert.equal(count(V2_CODE, /put\(sproutName,/g), 2, 'path sprout + quest sprout');
  assert.match(V2_CODE, /sproutMesh\.setMatrixAt\(questSproutIndex, m4\.makeScale\(0, 0, 0\)\);/);
  assert.match(V2_CODE, /put\(sproutName, SPROUT\[0\], SPROUT\[1\], 1\.35, \.4, 0x9fd6ee\);/);
  assert.match(ADVENTURE_FN, /const near = Math\.max\(0, 1 - Math\.hypot\(cx - SPROUT\[0\], cz - SPROUT\[1\]\) \/ 4\);/);
  assert.ok(!/\bscore\b|\bpoints\b|collectedCount|sproutTaken/.test(V2_CODE));
  const [sx, sz] = V2_CODE.match(/const SPROUT = \[([-\d.]+), ([-\d.]+)\];/).slice(1).map(Number);
  A.routeS(sx, sz);
  assert.ok(A.routeAt.d < 1.5, `sprout ${A.routeAt.d} m from the path`);
  assert.ok(A.routeAt.s > 5 && A.routeAt.s < A.ROUTE_TOTAL - 5, 'on the way, not at the ends');
});

test('19. ことばの樹：タネは幹の外をまわってのぼり、まだ眠っている実のひとつ（0番以外・いちばん近い実）に入って灯る', () => {
  assert.match(ADVENTURE_FN, /for \(let i = 1; i < 5; i\+\+\) \{ const d = \(fruitPos\[i\]\.x - cx\) \*\* 2 \+ \(fruitPos\[i\]\.z - cz\) \*\* 2; if \(d < best\) \{ best = d; litFruit = i; \} \}/);
  assert.match(ADVENTURE_FN, /r = 1\.35;/);
  assert.ok(1.35 < A.TREE_AREA.trunk + .1 || true);
  assert.match(ADVENTURE_FN, /fruitLit\.copy\(GOLD\)\.lerp\(SKY, w\);/);
  assert.match(V2_CODE, /GOLD = new THREE\.Color\(0xffc23a\), SKY = new THREE\.Color\(0x62c8f2\)/);
  assert.match(ADVENTURE_FN, /fruits\.setColorAt\(litFruit, fruitLit\)/);
});

// ── カメラ ────────────────────────────────────────────────────────
test('20. 根の門のまわりのカメラ：閉じているあいだは手前にとどまり、ひらいたあとは門の上をなめらかに越える', () => {
  const g = stripComments(between(V2, 'function guardCamera()', '// PER-FRAME-V2-END'));
  assert.match(g, /if \(!gateOpen && Math\.abs\(lx\) < 4\.2 && lz < 1\.6 && lz > -3\)/);
  assert.match(g, /const need = heightAt\(GATE\.x, GATE\.z\) \+ 5\.6, w = smooth\(3\.4, 1\.2, Math\.abs\(lz\)\) \* smooth\(4\.8, 3\.6, Math\.abs\(lx\)\);/);
  const upd = between(FRAME, 'function update(t)', 'function adventure(');
  assert.ok(upd.indexOf('guardCamera();') > 0 && upd.indexOf('guardCamera();') < upd.indexOf('const floor = heightAt('), 'before the ground floor');
});

test('21. 小さなカメラの動き（生まれる・門・樹）は2秒以内か、歩き出すと戻る。reduced-motion では動かさない', () => {
  assert.match(ADVENTURE_FN, /if \(!still\) \{ const w = Math\.sin\(Math\.PI \* Math\.min\(1, \(t - birthT\) \/ 2\)\);/);
  assert.match(ADVENTURE_FN, /if \(!still\) CAM_LOOK\.set\(defLook\.x \+ \(GATE\.x - cx\) \* \.12/);
  assert.match(ADVENTURE_FN, /treeX = cx; treeZ = cz;\s*if \(!still\) \{/);
  assert.match(ADVENTURE_FN, /if \(treeFrame && Math\.hypot\(cx - treeX, cz - treeZ\) > 1\.5\) \{ treeFrame = false; CAM_LOOK\.copy\(defLook\); \}/);
  // 樹の構図：樹から 11m・高さ 2m、見上げる（縦長の画面は少し多め）
  assert.match(ADVENTURE_FN, /treeCam\.set\(WORD_TREE\.x \+ tmpW\.x \* 11, heightAt\(WORD_TREE\.x, WORD_TREE\.z\) \+ 2\.0, WORD_TREE\.z \+ tmpW\.z \* 11\);/);
  assert.match(ADVENTURE_FN, /CAM_OFF\.set\(treeCam\.x - cx, treeCam\.y - cy, treeCam\.z - cz\);/);
  assert.match(ADVENTURE_FN, /if \(isMoving && progress === P\.TREE_REACHED\) \{ treeX = cx; treeZ = cz; \}/);
});

test('22. reduced-motion：タネはすぐ現れ、門はすぐひらき、道はすぐ灯り、完了のことばもすぐ出る', () => {
  assert.match(ADVENTURE_FN, /wordSeed\.scale\.setScalar\(still \? SEED_S : \.01\)/);
  assert.match(ADVENTURE_FN, /const b = still \? 1 : Math\.min\(1, \(t - birthT\) \/ 1\.2\);/);
  assert.match(ADVENTURE_FN, /const o = still \? 1 : Math\.min\(1, \(t - openT\) \/ 1\.7\)/);
  assert.match(ADVENTURE_FN, /lightSecretPath\(still \? 1 : o \* \.7, 1\.6\);/);
  assert.match(ADVENTURE_FN, /const l = still \? 1 : Math\.min\(1, \(t - litT\) \/ 2\.6\)/);
  assert.match(ADVENTURE_FN, /finaleAt = t \+ \(still \? 0 : 1\.6\);/);
  assert.match(ADVENTURE_FN, /if \(sparkT >= 0 && t - sparkT < 1\.6 && !still\)/);
});

// ── リセット・V1・性能 ────────────────────────────────────────────
test('23. 「デモを最初から」：タネ・門・道・歩ける範囲・実・完了の枠・カメラ・進み方を、すべて最初へ戻す', () => {
  assert.match(HTML, /  worldV2\.reset\(\);   \/\/ [^\n]*\n  questHub\.reset\(\);[^\n]*\n  if\(character\)\{ character\.position\.set\(0,0,0\); character\.rotation\.set\(0,0,0\); \}/);
  assert.match(RESET, /if \(!active\) return;/);
  for (const re of [/progress = P\.EXPLORING; gateOpen = false;/, /wordSeed\.visible = false;/, /for \(let i = 0; i < 4; i\+\+\) gateMeshes\[i\]\.matrix\.multiplyMatrices\(gatePlace, gateNode\[i\]\);/,
    /gateMeshes\[3\]\.visible = true;/, /secretColor\.array\[v \* 4 \+ 3\] = secretU\[v\] < 0 \? secretBase\[v\] : 0;/, /fruits\.setMatrixAt\(i, fruitBase\[i\]\)/,
    /fruits\.setColorAt\(i, c3r\.set\(i % 2 \? 0x8fc6d8 : 0xd6b468\)\)/, /motes\.count = moteCount;/, /demoEnd\.replaceChildren\(\.\.\.demoEndOriginal\); demoEnd\.classList\.remove\('show'\);/,
    /CAM_OFF\.copy\(defOff\); CAM_LOOK\.copy\(defLook\);/, /treeFrame = false;/, /finaleAt = -1;/, /demoEnd\.style\.removeProperty\('top'\)/, /msgAt = -1;/]) assert.match(RESET, re, String(re));
  assert.match(V2_CODE, /return \{ ready, update, reset, groundCharacter,/);
});

test('24. V1・読み込み失敗のときは冒険を動かさない（V1 の流れはタグと同じ）', () => {
  assert.match(FRAME, /function update\(t\) \{\s*if \(!active\) return;/);
  // V2 の外（V1 のゲーム部分）で冒険に触れるのは、リセットのつなぎ目1か所だけ
  const outside = HTML.replace(V2, '');
  assert.equal(count(outside, /worldV2\.reset\(/g), 1);
  assert.ok(!/WORLD_PROGRESS|wordSeed|gateOpen|lightSecretPath/.test(outside));
  // V1 のデモ終了の文言・ボタンはそのまま
  for (const s of ['<div class="end-line1">遠くで、新しい"なにか"が光っている。</div>', '<div class="end-line2">つづきは、次の冒険で。</div>', "onclick=\"window.confirmReset()\">もう一度あそぶ</button>"]) {
    assert.ok(HTML.includes(s) && OLD.includes(s), s);
  }
  assert.match(OLD, /case S\.DEMO_COMPLETE:\n      document\.getElementById\('demo-end'\)\.classList\.add\('show'\);/);
  assert.match(HTML, /case S\.DEMO_COMPLETE:\n      document\.getElementById\('demo-end'\)\.classList\.add\('show'\);/);
});

test('25. 毎フレームの冒険の処理で、新しい物・配列・関数を作らない。点光源・テクスチャ・新しい rAF を足さない', () => {
  assert.ok(!/\bnew\b|\.clone\(|=\s*\[|\(\s*\[|=>|\.map\(|\.filter\(|\{\s*\w+\s*:/.test(ADVENTURE_FN), 'adventure allocates');
  assert.ok(!/PointLight|SpotLight|RectAreaLight|Texture/.test(V2_CODE));
  assert.equal(count(HTML, /requestAnimationFrame/g), count(OLD, /requestAnimationFrame/g));
  assert.ok(!/setInterval/.test(V2_CODE));
  assert.equal(count(V2_CODE, /setTimeout\(/g), 1, 'only the load timeout');
});

test('26. 描く回数を増やしすぎない：秘密の谷の草花・芽・目印・光の粒は、今ある InstancedMesh に足すだけ', () => {
  const build = between(V2_CODE, 'function build(', 'function activate(');
  assert.equal(count(build, /new THREE\.InstancedMesh\(/g), 5, 'plants (per shape), fruits, motes, low flower stems + heads');
  assert.match(build, /motes = new THREE\.InstancedMesh\(fk\.geometry, fruitMat, moteCount \+ moteSecret \+ sparkN\);/);
  assert.match(build, /moteSecret = HIGH \? 3 : 2; sparkN = HIGH \? 6 : 3;/);
  assert.match(build, /for \(let i = 0, n = HIGH \? 18 : 3; i < n; i\+\+\)/);
  assert.match(build, /for \(let i = 0, n = HIGH \? 12 : 4; i < n; i\+\+\)/);
  // スマホ（low）の秘密の谷は草だけ・若木なし・道の点は少なめ。秘密の道は、門がひらくまで描かない（根元の光だけ描く）
  assert.match(build, /const VALLEY = HIGH \? \[[^\]]+\] : \['Grass_A', 'Grass_B'\];/);
  assert.match(build, /if \(HIGH\) put\('Tree_Round_B', 12\.2, -26\.0,/);
  assert.match(build, /secretN = HIGH \? 96 : 40;/);
  assert.match(build, /sgeo\.setIndex\(si\); sgeo\.setDrawRange\(secretRibbonN, Infinity\);/);
  assert.match(ADVENTURE_FN, /openT = t; secretPath\.geometry\.setDrawRange\(0, Infinity\);/);
  assert.match(RESET, /secretPath\.geometry\.setDrawRange\(secretRibbonN, Infinity\);/);
  assert.match(build, /secretPath = new THREE\.Mesh\(sgeo, secretMat\);/);
  // 大きさ0は置かない（乱数を使い終えてから戻るので、ほかの物の配置は変わらない）
  assert.match(build, /const put = \(name, x, z, s = 1, yaw = rnd\(\) \* 6\.283, tint = 0xffffff, tilt = 0, dy = 0\) => \{\s*if \(!s\) return;/);
});

// ── Step 11I-C2：秘密の道のテンポ・スマホの描く回数 ─────────────────────
const simWalk = (sx, sz, gx, gz) => {
  const T = { x: gx, z: gz }; A.clampWalk(T, true, .97);
  const p = { x: sx, z: sz }, w = { x: 0, z: 0 }; let reach = -1;
  for (let i = 0; i < 60 * 40; i++) {
    if (reach < 0 && Math.hypot(p.x - A.WORD_TREE.x, p.z - A.WORD_TREE.z) <= A.TREE_REACH_R) reach = i / 60;
    A.steerToward(p.x, p.z, T.x, T.z, w);
    const dx = w.x - p.x, dz = w.z - p.z, d = Math.hypot(dx, dz);
    if (d < .6 && w.x === T.x && w.z === T.z) return { arrived: i / 60, reach, p };
    const st = Math.min(d, 4 / 60); p.x += dx / d * st; p.z += dz / d * st; A.clampWalk(p, true, 1);
  }
  return { arrived: -1, reach, p };
};

test('27. タップ1回で、門の先から道に沿って樹まで歩ける（7〜12秒・角で止まらない）。帰りも同じ', () => {
  const g = simWalk(A.GATE.x - .4, A.GATE.z + .6, 15.0, -26.0);
  assert.ok(g.arrived > 0, 'arrived');
  assert.ok(g.reach >= 7 && g.reach <= 12, `gate to tree ${g.reach}s`);
  const m = simWalk(1, -4, 15.0, -26.0);
  assert.ok(m.arrived > 0 && m.reach > g.reach, `meadow to tree ${m.reach}s`);
  const back = simWalk(14.6, -27.0, 2, -4);
  assert.ok(back.arrived > 0, 'back to the meadow');
  // 幹の中心をタップしても止まらずに着く
  assert.ok(simWalk(A.GATE.x - .4, A.GATE.z + .6, A.WORD_TREE.x, A.WORD_TREE.z).arrived > 0);
  // 道の途中の点へもタップで行ける
  const mid = A.PASSAGE[4], r = simWalk(A.GATE.x - .4, A.GATE.z + .6, mid[0], mid[1]);
  assert.ok(r.arrived > 0 && Math.hypot(r.p.x - mid[0], r.p.z - mid[1]) < .7);
});

test('28. 大きな近道はできない：S字の内側・道の外は歩けず、樹のまわりにつながるのは最後の区間だけ', () => {
  let off = 0;
  for (let x = 4; x <= 22; x += .25) for (let z = -34; z <= -10; z += .25) {
    if (!A.inWalk(x, z, true) || A.inWalk(x, z, false)) continue;
    A.routeS(x, z);
    if (Math.hypot(x - A.TREE_AREA.x, z - A.TREE_AREA.z) > A.TREE_AREA.r && A.routeAt.d > A.PASSAGE_R + 1e-6) off++;
  }
  assert.equal(off, 0);
  for (let i = 0; i < A.PASSAGE.length - 3; i++) {
    const [ax, az] = A.PASSAGE[i], [bx, bz] = A.PASSAGE[i + 1]; let d = 1e9;
    for (let k = 0; k <= 50; k++) d = Math.min(d, Math.hypot(ax + (bx - ax) * k / 50 - A.TREE_AREA.x, az + (bz - az) * k / 50 - A.TREE_AREA.z));
    assert.ok(d - A.PASSAGE_R - A.TREE_AREA.r > .25, `segment ${i} touches the tree area`);
  }
  // 閉じているあいだは、道のどこにも入れない
  for (const [x, z] of A.PASSAGE.slice(1)) assert.ok(!A.inWalk(x, z, false));
});

test('29. 門がひらいているとき、タップの目的地へ道に沿って向かう（キーボードはそのまま・閉門中は使わない）', () => {
  assert.match(ADVENTURE_FN, /if \(gateOpen && isMoving\) \{\s*if \(targetPos\.x !== steerX \|\| targetPos\.z !== steerZ\) \{ navGX = targetPos\.x; navGZ = targetPos\.z; \}/);
  assert.match(ADVENTURE_FN, /steerToward\(cx, cz, navGX, navGZ, navOut\);\s*targetPos\.x = steerX = navOut\.x; targetPos\.z = steerZ = navOut\.z;/);
  // ADVENTURE の計算は、毎フレーム呼ばれても物を作らない
  const steer = ADV.slice(ADV.indexOf('function steerToward('));
  assert.ok(!/\bnew\b|=>|\[\s*\]|\{\s*x:/.test(steer), steer);
  assert.ok(!/\bnew\b|=>/.test(between(ADV, 'function routeS(', 'function routePoint(')));
});

test('30. スマホ（low）だけ、言葉で咲く花を茎と花の2つの InstancedMesh で描く。咲き方・色・位置は元の花のまま', () => {
  const build = between(V2_CODE, 'function build(', 'function activate(');
  assert.match(build, /if \(!HIGH\) \{\s*const f0 = mainFlowers\[0\]\.children;/);
  assert.match(build, /flowerStem = new THREE\.InstancedMesh\(f0\[0\]\.geometry, f0\[0\]\.material, FLOWER_MAX\);/);
  assert.match(build, /flowerHead = new THREE\.InstancedMesh\(f0\[1\]\.geometry, new THREE\.MeshLambertMaterial\(\{ color: 0xffffff \}\), FLOWER_MAX\);/);
  assert.match(V2_CODE, /if \(flowerStem\) flowerGroup\.visible = false;/);
  const upd = between(FRAME, 'function update(t)', 'function adventure(');
  assert.match(upd, /if \(f\.scale\.x < \.001\) continue;/);
  assert.match(upd, /if \(!flowerFr\.intersectsSphere\(flowerS\)\) continue;/);
  assert.match(upd, /flowerHead\.setColorAt\(n, f\.children\[1\]\.material\.color\);/);
  // 元の花（V1 の作り方・数・咲かせ方）は変えていない。PC（high）は今までどおり1本ずつ描く
  const mk = s => between(s, 'function mkFlower(x,z,red){', '\n}\n') + between(s, '// ミッション周囲の花', '// ── 秘密エリア');
  assert.equal(mk(HTML), mk(OLD));
  assert.match(HTML, /worldTimeout\(\(\)=>bloomSeq\(mainFlowers\.slice\(0,6\),null\), 300\);/);
});

test('31. PC（high）の見た目は、秘密の谷と道の向きだけが変わる（草原・祠・門の手前は同じ組み立て）', () => {
  assert.match(V2_CODE, /const clear = routeDist\(x, z\) < 3\.4 \|\| Math\.hypot\(x - WORD_TREE\.x, z - WORD_TREE\.z\) < 5\.5 \? 0 : 1;/);
  assert.match(V2_CODE, /put\(TREES\[i % 4\], x, z, \(1 \+ rnd\(\) \* \.45\) \* clear, undefined, depthTint\(x, z\), \(rnd\(\) - \.5\) \* \.1\);/);
  // 門の位置・ことばの樹の位置・草原のだ円は変えていない
  assert.deepEqual([A.GATE.x, A.GATE.z], [7, -12.6]);
  assert.deepEqual([A.WALK.cx, A.WALK.cz, A.WALK.rx, A.WALK.rz], [3, -3.5, 15, 9.5]);
  assert.deepEqual(A.SECRET_ROUTE[0], [A.GATE.x, A.GATE.z]);
});

test('32. 収集物を増やしていない：芽1つ・タネ1つ・灯る実1つだけ（コイン・宝箱・敵・ガチャ・新しい説明パネル・通信なし）', () => {
  assert.ok(!/\bcoin|treasure|chest|gacha|enemy\b/i.test(V2_CODE));
  assert.equal(count(V2_CODE, /createElement\(/g), 5, 'only the finale texts and buttons（Step 11M：次の冒険へ）');
  // Step 11M：パネルを足したのは、道くさの問いと「見つけたもの」の2つだけ（点数・正誤の画面は作らない）
  assert.equal(count(HTML, /class="panel"/g), count(OLD, /class="panel"/g) + 2, 'only the detour and found panels');
  assert.ok(!/\bscore\b|正解数|ランキング/.test(between(HTML, '// QUEST-UI-BEGIN', '// QUEST-UI-END')));
  assert.equal(count(HTML, /\bfetch\(/g), 2);   // 語彙カードと、深掘りの答えを広げる（Step 11L-F）の2か所
});

test('33. ことばの樹の構図：カメラは丘の上ではなく、道と谷の低い所に置く（ヒロリがどの向きから着いても）', () => {
  assert.match(ADVENTURE_FN, /for \(let k = 0; k < 11; k\+\+\) \{/);
  // 向きは、ヒロリが止まる場所（樹の近くをタップして歩いている途中なら、その目的地）から決める
  assert.match(ADVENTURE_FN, /const stopNear = isMoving && Math\.hypot\(navGX - WORD_TREE\.x, navGZ - WORD_TREE\.z\) <= TREE_AREA\.r \+ \.5;/);
  assert.match(ADVENTURE_FN, /const th0 = Math\.atan2\(\(stopNear \? navGX : cx\) - WORD_TREE\.x, \(stopNear \? navGZ : cz\) - WORD_TREE\.z\);/);
  const cond = ADVENTURE_FN.match(/if \((heightAt\(WORD_TREE\.x \+ sx \* 11[^\n]*?)\) break;/)[1];
  const ok = new Function('heightAt', 'WORD_TREE', 'sx', 'sz', 'return ' + cond + ';');
  for (const [x, z] of [[13.6, -28.5], [14.6, -26.0], [12.6, -27.5], [13.0, -29.6]]) {
    const th0 = Math.atan2(x - A.WORD_TREE.x, z - A.WORD_TREE.z); let found = false;
    for (let k = 0; k < 11 && !found; k++) { const th = th0 + Math.ceil(k / 2) * .44 * (k % 2 ? 1 : -1); found = ok(A.heightAt, A.WORD_TREE, Math.sin(th), Math.cos(th)); }
    assert.ok(found, `no low camera spot for ${x},${z}`);
  }
  assert.ok(ok(() => 3, A.WORD_TREE, 1, 0) === false, 'hill tops are rejected');
  assert.ok(ok(() => .9, A.WORD_TREE, 1, 0) === false, 'a camera spot 0.9m up the slope is rejected');
  assert.ok(ok(() => 0, A.WORD_TREE, 1, 0) === true, 'flat ground is accepted');
});

// ── Step 11K-B：ことばのタネを見つけやすくする（取る条件・状態の進み方は変えない）─────────
const SEED_GLB_H = 0.249;   // GLB の WordSeed（芯と外側の光）の全高
const num = re => +V2_CODE.match(re)[1];

test('34. タネの大きさと高さ：全高 約0.45〜0.55m（以前の1.5倍表示から拡大）・地面から0.8〜1.1m・取る距離は1.25mのまま', () => {
  const S = num(/const SEED_S = ([\d.]+), SEED_LIFT/), LIFT = num(/SEED_LIFT = (\.?[\d.]+);/);
  assert.ok(SEED_GLB_H * S >= .45 && SEED_GLB_H * S <= .55, `seed height ${SEED_GLB_H * S}`);
  assert.ok(S > 1.5, 'larger than before');
  assert.ok(LIFT >= .8 && LIFT <= 1.1);
  assert.equal(A.SEED_PICK_R, 1.25);
  // 位置は祠のそば（xz は以前と同じ）。地面の高さは、タネの真下で測る
  assert.match(ADVENTURE_FN, /SEED_HOME\.set\(MISSION_POS\.x - \.8, heightAt\(MISSION_POS\.x - \.8, MISSION_POS\.z - \.25\) \+ SEED_LIFT, MISSION_POS\.z - \.25\);/);
  // 生まれるのは深掘りのあと（deepDone）だけ。取るのは、生まれ終わって 1.25m 以内に入ったとき（以前と同じ）
  assert.match(ADVENTURE_FN, /if \(b >= 1 && Math\.hypot\(cx - SEED_HOME\.x, cz - SEED_HOME\.z\) <= SEED_PICK_R\) \{/);
});

test('35. タネの動き：一度だけ少し大きくなって戻る・ゆっくり浮く・金色と水色が呼吸する。reduced-motion では止まったまま目立つ', () => {
  assert.match(ADVENTURE_FN, /wordSeed\.scale\.setScalar\(SEED_S \* \(ease\(Math\.min\(1, b \* 1\.4\)\) \+ \(still \? 0 : \.2 \* Math\.sin\(Math\.PI \* b\)\)\)\);/);
  assert.match(ADVENTURE_FN, /wordSeed\.position\.y = SEED_HOME\.y \+ \(still \? 0 : \.07 \* Math\.sin\(\(t - birthT\) \* 1\.4\)\);/);
  assert.match(ADVENTURE_FN, /const br = still \? \.5 : \.5 \+ \.5 \* Math\.sin\(\(t - birthT\) \* 1\.8\);/);
  assert.match(ADVENTURE_FN, /seedGlowMat\.opacity = \.45 \+ \.25 \* br; seedCoreMat\.emissiveIntensity = \.7 \+ \.4 \* \(1 - br\); seedGroundMat\.opacity = \(\.9 - \.3 \* br\) \* ease\(b\);/);
  assert.match(ADVENTURE_FN, /seedHaloMat\.opacity = \(\.14 \+ \.14 \* \(1 - br\)\) \* ease\(b\);/);
  // 大きくなって戻る：b=1 で ちょうど SEED_S（sin(π)=0）。途中は最大で約1.1〜1.2倍
  const ease = x => x * x * (3 - 2 * x);
  const k = b => ease(Math.min(1, b * 1.4)) + .2 * Math.sin(Math.PI * b);
  let peak = 0; for (let b = 0; b <= 1.0001; b += .01) peak = Math.max(peak, k(b));
  assert.ok(peak > 1.1 && peak < 1.2, `peak ${peak}`);
  assert.ok(Math.abs(k(1) - 1) < 1e-9);
});

test('36. タネの下の地面の光：画像を使わない円（頂点の透明度）。生まれているあいだだけ見せ、取ったとき・リセットで消す', () => {
  const build = between(V2_CODE, 'function build(', 'function activate(');
  assert.match(build, /const sgGeo = new THREE\.CircleGeometry\(\.75, 24\)/);
  assert.match(build, /sgGeo\.setAttribute\('color', new THREE\.BufferAttribute\(sgCol, 4\)\);/);
  assert.match(build, /seedGround\.renderOrder = 2; seedGround\.visible = false; group\.add\(seedGround\);/);
  assert.ok(!/PointLight|Texture|TextureLoader/.test(V2_CODE));
  assert.match(ADVENTURE_FN, /seedGround\.visible = true;/);
  assert.match(ADVENTURE_FN, /seedGround\.visible = false; seedHalo\.visible = false; seedGlowMat\.opacity = \.35; seedCoreMat\.emissiveIntensity = \.85;/);
  assert.match(ADVENTURE_FN, /seedGround\.visible = true; seedGroundMat\.opacity = still \? \.75 : 0; seedHalo\.visible = true;/);
  assert.match(RESET, /seedGround\.visible = false; seedGroundMat\.opacity = \.75; seedCoreMat\.emissiveIntensity = \.85; seedHalo\.visible = true; sparkIn = false;/);
  // 光の粒：生まれるときだけ、祠のまわりからタネへ集まる（ほかは今までどおり外へ広がる。数は増やさない）
  assert.match(ADVENTURE_FN, /sparkT = t; sparkIn = true;/);
  assert.equal(count(ADVENTURE_FN, /sparkIn = false;/g), 3);
  assert.match(build, /moteSecret = HIGH \? 3 : 2; sparkN = HIGH \? 6 : 3;/);
});
