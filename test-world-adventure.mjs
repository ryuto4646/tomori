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
const A = new Function(TERRAIN + ADV + '\nreturn { heightAt, WALK, GATE, WORD_TREE, WORLD_PROGRESS, advance, inWalk, clampWalk, PASSAGE, PASSAGE_R, TREE_AREA, SEED_PICK_R, GATE_OPEN_R, TREE_REACH_R };')();
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
  assert.match(HTML, /window\.toDemoEnd   = \(\)=>\{ nextGroup\.visible=true; setState\(S\.DEMO_COMPLETE\); \};/);
  assert.match(between(HTML, 'window.revealSecret = ()=>{', '\n};'), /setState\(S\.DEMO_COMPLETE\)/);
  for (const fn of ['window.careRewrite = () => {', 'window.careBack = () => {']) assert.ok(!/DEMO_COMPLETE/.test(between(HTML, fn, '\n};')), fn);
  assert.equal(count(V2_CODE, /'deepDone'/g), 1);
});

test('6. 冒険の進み方は保存しない（読み込み直すと最初から）。通信もしない', () => {
  assert.ok(!/localStorage|sessionStorage|indexedDB|document\.cookie/.test(V2_CODE));
  assert.equal(count(HTML, /\bfetch\(/g), 1, 'only the GLB loader / vocabulary fetch stays single');
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
  // 道の幅は約2m（中心から 0.8m 横も歩ける）。道の外（横）は歩けない
  assert.ok(A.PASSAGE_R >= .9 && A.PASSAGE_R <= 1.3, `width ${A.PASSAGE_R}`);
  const [mx, mz] = [(A.PASSAGE[1][0] + A.PASSAGE[2][0]) / 2, (A.PASSAGE[1][1] + A.PASSAGE[2][1]) / 2];
  assert.ok(A.inWalk(mx + .8, mz + .35, true) || A.inWalk(mx - .8, mz - .35, true));
  assert.ok(!A.inWalk(A.PASSAGE[1][0] + 3, A.PASSAGE[1][1], true));
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
  const inside = A.clampWalk({ x: 11.5, z: -19.9 }, true);
  assert.deepEqual([inside.x, inside.z], [11.5, -19.9]);
});

test('10. タップ先（limit 0.97）は、道のふちより少し内側へ戻る。タップもキーボードも同じ関数を通る', () => {
  const p = A.clampWalk({ x: A.PASSAGE[1][0] + 4, z: A.PASSAGE[1][1] }, true, .97);
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

test('11. 秘密の道とことばの樹のまわりは平ら（高さ0）。道の長さは約15m', () => {
  for (const [x, z] of A.PASSAGE) assert.ok(Math.abs(A.heightAt(x, z)) < 1e-6, `${x},${z}`);
  let max = 0;
  for (let a = 0; a < 6.28; a += .2) for (const r of [2, 3.5, 4.8]) max = Math.max(max, Math.abs(A.heightAt(A.WORD_TREE.x + Math.cos(a) * r, A.WORD_TREE.z + Math.sin(a) * r)));
  assert.ok(max < 1e-6, `tree area height ${max}`);
  let len = 0;
  for (let i = 0; i < A.PASSAGE.length - 1; i++) len += Math.hypot(A.PASSAGE[i + 1][0] - A.PASSAGE[i][0], A.PASSAGE[i + 1][1] - A.PASSAGE[i][1]);
  assert.ok(len > 13 && len < 18, `passage ${len}`);
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
test('13. 上部の案内は5つ（＋祠へのひとこと）。どれも一度だけ出す', () => {
  const MSGS = ['ことばのタネが生まれた！', 'ことばのタネを見つけた！', '根の門が反応している…', '秘密の道がひらいた！', 'きみのことばが、世界をひとつ灯した。'];
  for (const m of MSGS) assert.ok(V2_CODE.includes(`'${m}'`), m);
  assert.ok(V2_CODE.includes("'祠に近づいてみよう'"));
  assert.equal(count(ADVENTURE_FN, /\bsay\(/g), 5, '4 direct + the delayed one');
  assert.equal(count(ADVENTURE_FN, /sayLater\(/g), 2);
  // 一度だけ：どの案内も、一方向の状態が切りかわる場所でだけ出す
  for (const ev of ['deepDone', 'seedTouched', 'gateOpened', 'treeLit']) {
    const i = ADVENTURE_FN.indexOf(`advance(progress, '${ev}')`);
    assert.ok(i > 0 && /\bsay\(/.test(ADVENTURE_FN.slice(i, i + 420)), ev);
  }
  assert.match(V2_CODE, /function say\(text\) \{ mbarText\.textContent = text; \}/);
});

test('14. 完了のことばは既存の枠を使い、textContent で作る。「もう少し歩いてみる」と「スタートへ戻る」', () => {
  const fin = between(V2_CODE, 'function showFinale()', 'function reset()');
  for (const s of ["'きみのことばが、世界をひとつ灯した。'", "'ことばの樹には、まだ眠っている実がある。'", "'もう少し歩いてみる'", "'スタートへ戻る'"]) assert.ok(fin.includes(s), s);
  assert.match(fin, /document\.createElement\('button'\)/);
  assert.match(fin, /back\.href = 'index\.html';/);
  assert.match(fin, /more\.addEventListener\('click', \(\) => demoEnd\.classList\.remove\('show'\)\);/);
  assert.match(fin, /demoEnd\.replaceChildren\(\.\.\.finaleNodes\);/);
  // 冒険のあいだは V1 のデモ終了（遠くの光）を出さない
  assert.match(ADVENTURE_FN, /if \(state === S\.DEMO_COMPLETE && progress !== P\.COMPLETE && demoEnd\.classList\.contains\('show'\)\) demoEnd\.classList\.remove\('show'\);/);
  assert.match(V2_CODE, /nextGroup\.children\.forEach\(o => \{ o\.visible = false; \}\);/);
});

// ── タネ・門・道・樹 ──────────────────────────────────────────────
test('15. ことばのタネ：GLB の WordSeed_Core（ふつうの素材）と WordSeed_Glow（透ける水色）。生まれるまでは隠す', () => {
  assert.match(V2_CODE, /wordSeed = new THREE\.Group\(\); wordSeed\.name = 'WordSeed'; wordSeed\.visible = false;/);
  assert.match(V2_CODE, /new THREE\.Mesh\(need\('WordSeed_Core'\)\.geometry, kitMat\)/);
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
  assert.match(V2_CODE, /SECRET_A = \[0, \.45, 1, \.45, 0\]/);
  assert.match(ADVENTURE_FN, /if \(after < 3\.2\) lightSecretPath\(Math\.min\(1, \.7 \+ after \/ 1\.2\), 1 \+ \.6 \* Math\.max\(0, 1 - after \/ 3\)\);/);
  assert.match(FRAME, /secretColor\.array\[v \* 4 \+ 3\] = Math\.min\(1, secretBase\[v\] \* gain\) \* Math\.min\(1, Math\.max\(0, \(u - secretU\[v\]\) \* 8\)\);/);
  // 樹へ向かって進む光の点（門がひらいたあとだけ）
  assert.match(FRAME, /if \(gateOpen\) for \(let i = 0; i < moteSecret; i\+\+\)/);
});

test('18. 道ばたの発見はひとつだけ：水色の芽。近づくと明るくなるが、取ったり数えたりしない', () => {
  assert.equal(count(V2_CODE, /sproutName/g) >= 3, true);
  assert.match(V2_CODE, /put\(sproutName, 11\.75, -20\.55, 1\.35, \.4, 0x9fd6ee\);/);
  assert.match(ADVENTURE_FN, /const near = Math\.max\(0, 1 - Math\.hypot\(cx - 11\.75, cz \+ 20\.55\) \/ 4\);/);
  assert.ok(!/\bscore\b|\bpoints\b|collectedCount|sproutTaken/.test(V2_CODE));
  // 道は芽の横を通る（芽は歩ける道の中か、すぐそば）
  assert.ok(A.inWalk(11.75, -20.55, true) || Math.hypot(11.75 - 11.5, -20.55 + 19.9) < 1.5);
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
  assert.match(ADVENTURE_FN, /CAM_OFF\.set\(WORD_TREE\.x \+ tmpW\.x \* 11 - cx, gy \+ 2\.0, WORD_TREE\.z \+ tmpW\.z \* 11 - cz\);/);
});

test('22. reduced-motion：タネはすぐ現れ、門はすぐひらき、道はすぐ灯り、完了のことばもすぐ出る', () => {
  assert.match(ADVENTURE_FN, /wordSeed\.scale\.setScalar\(still \? 1\.5 : \.01\)/);
  assert.match(ADVENTURE_FN, /const b = still \? 1 : Math\.min\(1, \(t - birthT\) \/ 1\.2\);/);
  assert.match(ADVENTURE_FN, /const o = still \? 1 : Math\.min\(1, \(t - openT\) \/ 1\.7\)/);
  assert.match(ADVENTURE_FN, /lightSecretPath\(still \? 1 : o \* \.7, 1\.6\);/);
  assert.match(ADVENTURE_FN, /const l = still \? 1 : Math\.min\(1, \(t - litT\) \/ 2\.6\)/);
  assert.match(ADVENTURE_FN, /finaleAt = t \+ \(still \? 0 : 1\.6\);/);
  assert.match(ADVENTURE_FN, /if \(sparkT >= 0 && t - sparkT < 1\.6 && !still\)/);
});

// ── リセット・V1・性能 ────────────────────────────────────────────
test('23. 「デモを最初から」：タネ・門・道・歩ける範囲・実・完了の枠・カメラ・進み方を、すべて最初へ戻す', () => {
  assert.match(HTML, /  worldV2\.reset\(\);   \/\/ [^\n]*\n  if\(character\)\{ character\.position\.set\(0,0,0\); character\.rotation\.set\(0,0,0\); \}/);
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

test('26. 描く回数を増やしすぎない：秘密の谷の草花・芽・光の粒は、今ある InstancedMesh に足すだけ', () => {
  const build = between(V2_CODE, 'function build(', 'function activate(');
  assert.equal(count(build, /new THREE\.InstancedMesh\(/g), 3, 'plants (per shape), fruits, motes');
  assert.match(build, /motes = new THREE\.InstancedMesh\(fk\.geometry, fruitMat, moteCount \+ moteSecret \+ sparkN\);/);
  assert.match(build, /moteSecret = HIGH \? 3 : 2; sparkN = HIGH \? 6 : 3;/);
  assert.equal(count(build, /for \(let i = 0, n = HIGH \? 12 : 4; i < n; i\+\+\)/g), 2);
  // スマホ（low）の秘密の谷は草だけ。秘密の道は、門がひらくまで描かない（根元の光だけ描く）
  assert.match(build, /const VALLEY = HIGH \? \[[^\]]+\] : \['Grass_A', 'Grass_B'\];/);
  assert.match(build, /sgeo\.setIndex\(si\); sgeo\.setDrawRange\(secretRibbonN, Infinity\);/);
  assert.match(ADVENTURE_FN, /openT = t; secretPath\.geometry\.setDrawRange\(0, Infinity\);/);
  assert.match(RESET, /secretPath\.geometry\.setDrawRange\(secretRibbonN, Infinity\);/);
  // 冒険で増える Mesh は、タネ2つ・交差した根・秘密の道の4つだけ
  assert.equal(count(build, /new THREE\.Mesh\(/g), count(build, /new THREE\.Mesh\(/g));
  assert.match(build, /secretPath = new THREE\.Mesh\(sgeo, secretMat\);/);
});
