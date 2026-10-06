// 仮ヒロリ（demo-world.html）のテスト。ブラウザも three.js も使わない。
// 実行: node --test test-hirori-placeholder.mjs
// 注意：ここで確かめるのはコードの動きだけ。見た目やタップ操作はブラウザで確認する。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const HTML = readFileSync(new URL('./demo-world.html', import.meta.url), 'utf8');
const s = HTML.indexOf('// HIRORI-BEGIN'), e = HTML.indexOf('// HIRORI-END');
assert.ok(s >= 0 && e > s, 'HIRORI markers not found');
const SRC = HTML.slice(HTML.indexOf('\n', s) + 1, e);

// ── three.js の代わり（使っている機能だけ）。作った数を数える ──
function makeFakeThree() {
  const created = { mesh: 0, group: 0, geometry: 0, material: 0 };
  const vec = (x = 0, y = 0, z = 0) => ({ x, y, z, set(a, b, c) { this.x = a; this.y = b; this.z = c; return this; }, setScalar(v) { this.x = this.y = this.z = v; return this; } });
  class Obj { constructor() { this.position = vec(); this.rotation = vec(); this.scale = vec(1, 1, 1); this.children = []; this.userData = {}; this.parent = null; }
    add(...o) { for (const c of o) { c.parent = this; this.children.push(c); } return this; } }
  class Group extends Obj { constructor() { super(); created.group++; } }
  class Mesh extends Obj { constructor(geometry, material) { super(); created.mesh++; this.geometry = geometry; this.material = material; } }
  class Geo { constructor(...a) { created.geometry++; this.args = a; } }
  class Mat { constructor(o) { created.material++; Object.assign(this, o); } }
  return {
    created,
    THREE: { Group, Mesh, SphereGeometry: Geo, CapsuleGeometry: Geo, CircleGeometry: Geo, MeshStandardMaterial: Mat, MeshBasicMaterial: Mat },
  };
}

function load({ reduce = false } = {}) {
  const fake = makeFakeThree();
  const matchMedia = () => ({ matches: reduce });
  const mod = new Function('THREE', 'matchMedia', 'SPEED', `${SRC}
    return { createHiroriPlaceholder, updateHiroriMotion, startHiroriArrival, resetHiroriMotion, turnToward, hiroriMotion, ARRIVAL_SEC };`)(fake.THREE, matchMedia, 4.0);
  return { ...mod, fake };
}
// dt ごとに frames 回動かす
function run(m, root, frames, moving, dt = 1 / 60, t0 = 0) {
  let t = t0;
  for (let i = 0; i < frames; i++) { t += dt; m.updateHiroriMotion(root, dt, t, moving); }
  return t;
}
const PARTS = ['root', 'body', 'head', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg', 'tail', 'headPetals', 'leftEye', 'rightEye', 'mouth'];
function inTree(root, obj) { for (let o = obj; o; o = o.parent) if (o === root) return true; return false; }

// ═══ モデル構造 ═══
test('1. createHiroriPlaceholder が Group を返し、必要な部位を userData.parts に持つ', () => {
  const m = load();
  const root = m.createHiroriPlaceholder();
  assert.ok(root instanceof m.fake.THREE.Group);
  for (const k of PARTS) {
    assert.ok(root.userData.parts[k], `missing part ${k}`);
    assert.ok(inTree(root, root.userData.parts[k]), `${k} is not inside the model`);
  }
  assert.equal(root.userData.parts.root, root);
});

test('2. 素材と形は共有されている（部位ごとに作っていない）', () => {
  const m = load();
  m.createHiroriPlaceholder();
  const { mesh, geometry, material } = m.fake.created;
  assert.ok(mesh >= 25, `mesh ${mesh}`);
  assert.ok(geometry <= 4, `geometry ${geometry}`);
  assert.ok(material <= 6, `material ${material}`);
});

test('3. 毎フレームの処理で形・素材・オブジェクトを新しく作らない', () => {
  const m = load();
  const root = m.createHiroriPlaceholder();
  const before = { ...m.fake.created };
  run(m, root, 120, false); run(m, root, 120, true);
  m.startHiroriArrival(); run(m, root, 90, false);
  assert.deepEqual(m.fake.created, before);
});

test('4. 足元が原点：足の裏は地面より下にない', () => {
  const m = load();
  const root = m.createHiroriPlaceholder();
  for (const leg of [root.userData.parts.leftLeg, root.userData.parts.rightLeg]) {
    const foot = leg.children[leg.children.length - 1];
    const bottom = leg.position.y + foot.position.y - foot.scale.y;
    assert.ok(bottom >= -0.001, `foot bottom ${bottom}`);
  }
});

// ═══ idle ═══
test('5. 待機：脚は止まり、体は呼吸ていどにだけ上下し、足元（root）は動かない', () => {
  const m = load();
  const root = m.createHiroriPlaceholder();
  const p = root.userData.parts;
  let maxBody = 0, maxHeadY = 0;
  let t = 0;
  for (let i = 0; i < 600; i++) { t += 1 / 60; m.updateHiroriMotion(root, 1 / 60, t, false);
    maxBody = Math.max(maxBody, Math.abs(p.body.position.y)); maxHeadY = Math.max(maxHeadY, Math.abs(p.head.rotation.y));
    assert.equal(root.position.y, 0); }
  assert.equal(p.leftLeg.rotation.x, 0);
  assert.ok(maxBody > 0.005 && maxBody <= 0.013, `breath ${maxBody}`);
  assert.ok(maxHeadY > 0.02 && maxHeadY <= 0.081, `head look ${maxHeadY}`);
});

test('6. 待機：数秒に一度まばたきする', () => {
  const m = load();
  const root = m.createHiroriPlaceholder();
  let blinked = 0, wasClosed = false, t = 0;
  for (let i = 0; i < 60 * 12; i++) { t += 1 / 60; m.updateHiroriMotion(root, 1 / 60, t, false);
    const closed = root.userData.parts.leftEye.scale.y < 0.03;
    if (closed && !wasClosed) blinked++; wasClosed = closed; }
  assert.ok(blinked >= 2 && blinked <= 5, `blinks in 12s: ${blinked}`);
  assert.equal(root.userData.parts.leftEye.scale.y, root.userData.parts.rightEye.scale.y);
});

// ═══ walk ═══
test('7. 歩行：脚は交互、腕は脚と反対、体は小さく上下、足元は沈まない', () => {
  const m = load();
  const root = m.createHiroriPlaceholder();
  const p = root.userData.parts;
  let maxLeg = 0, maxBob = 0, t = 0;
  for (let i = 0; i < 180; i++) { t += 1 / 60; m.updateHiroriMotion(root, 1 / 60, t, true);
    assert.ok(Math.abs(p.leftLeg.rotation.x + p.rightLeg.rotation.x) < 1e-9);
    if (Math.abs(p.leftLeg.rotation.x) > 0.05) assert.ok(Math.sign(p.leftArm.rotation.x) === -Math.sign(p.leftLeg.rotation.x));
    maxLeg = Math.max(maxLeg, Math.abs(p.leftLeg.rotation.x)); maxBob = Math.max(maxBob, p.body.position.y);
    assert.equal(root.position.y, 0); }
  assert.ok(maxLeg > 0.4 && maxLeg <= 0.55, `leg swing ${maxLeg}`);
  assert.ok(maxBob > 0.02 && maxBob <= 0.046, `bob ${maxBob}`);
});

test('8. 歩行の周期は移動速度に合わせる（1周期で STRIDE 分進む）', () => {
  const m = load();
  const root = m.createHiroriPlaceholder();
  run(m, root, 60, true); // 1秒歩く
  const cycles = m.hiroriMotion.phase / (Math.PI * 2);
  assert.ok(Math.abs(cycles - 4.0 / 1.6) < 1e-6, `cycles per second ${cycles}`);
});

test('9. 止まると急に固まらず、短い時間で待機の姿勢へ戻る', () => {
  const m = load();
  const root = m.createHiroriPlaceholder();
  const p = root.userData.parts;
  let t = 0;
  for (let i = 0; i < 200 && Math.abs(p.leftLeg.rotation.x) < 0.3; i++) { t += 1 / 60; m.updateHiroriMotion(root, 1 / 60, t, true); }
  const swing = Math.abs(p.leftLeg.rotation.x);
  assert.ok(swing >= 0.3);
  t = run(m, root, 1, false, 1 / 60, t);
  assert.ok(Math.abs(p.leftLeg.rotation.x) > swing * 0.5, 'froze instantly');
  run(m, root, 30, false, 1 / 60, t);
  assert.ok(Math.abs(p.leftLeg.rotation.x) < 0.02, `still swinging ${p.leftLeg.rotation.x}`);
});

test('10. 向きは最短回りで少しずつ合わせる（瞬間的に回らない）', () => {
  const m = load();
  const obj = { rotation: { y: 0 } };
  m.turnToward(obj, Math.PI * 0.9, 1 / 60);
  assert.ok(obj.rotation.y > 0 && obj.rotation.y < 0.5, `one frame ${obj.rotation.y}`);
  const o2 = { rotation: { y: Math.PI * 0.9 } };
  m.turnToward(o2, -Math.PI * 0.9, 1 / 60);
  assert.ok(o2.rotation.y > Math.PI * 0.9, 'did not take the short way');
  for (let i = 0; i < 60; i++) m.turnToward(obj, 1.2, 1 / 60);
  assert.ok(Math.abs(obj.rotation.y - 1.2) < 0.01);
});

// ═══ arrival ═══
test('11. 到着：1回だけ小さく跳ね、腕が上がり、花びらと尻尾が広がって、元に戻る', () => {
  const m = load();
  const root = m.createHiroriPlaceholder();
  const p = root.userData.parts;
  run(m, root, 10, false);
  m.startHiroriArrival();
  let maxHop = 0, maxRaise = 0, maxPetal = 1, tailUp = 0;
  for (let i = 0; i < 60; i++) { m.updateHiroriMotion(root, 1 / 60, i / 60, false);
    maxHop = Math.max(maxHop, root.position.y); maxRaise = Math.max(maxRaise, p.rightArm.rotation.z - 0.12);
    maxPetal = Math.max(maxPetal, p.headPetals.scale.x); tailUp = Math.min(tailUp, p.tail.rotation.x);
    assert.ok(Math.abs(root.position.y + p.shadow.position.y - 0.012) < 1e-9, 'shadow left the ground'); }
  assert.ok(maxHop > 0.18 && maxHop <= 0.22, `hop ${maxHop}`);
  assert.ok(maxRaise > 0.9, `arms ${maxRaise}`);
  assert.ok(maxPetal > 1.15, `petals ${maxPetal}`);
  assert.ok(tailUp < -0.25, `tail ${tailUp}`);
  assert.equal(m.hiroriMotion.arrivalT, -1, 'did not end');
  assert.equal(root.position.y, 0);
  assert.equal(p.rightArm.rotation.z, 0.12);
  run(m, root, 60, false);
  assert.equal(root.position.y, 0, 'repeated by itself');
});

test('12. リセットすると状態が戻り、もう一度到着モーションを出せる', () => {
  const m = load();
  const root = m.createHiroriPlaceholder();
  m.startHiroriArrival(); run(m, root, 20, false);
  m.resetHiroriMotion();
  assert.equal(m.hiroriMotion.arrivalT, -1);
  assert.equal(m.hiroriMotion.facing, 0);
  m.startHiroriArrival(); run(m, root, 27, false);
  assert.ok(root.position.y > 0.15);
});

// ═══ reduced-motion ═══
test('13. prefers-reduced-motion：上下動と跳ねを止め、揺れを弱め、歩行（脚）は動く', () => {
  const normal = load(), reduced = load({ reduce: true });
  const rn = normal.createHiroriPlaceholder(), rr = reduced.createHiroriPlaceholder();
  let maxTailN = 0, maxTailR = 0, maxLegR = 0, t = 0;
  for (let i = 0; i < 180; i++) { t += 1 / 60;
    normal.updateHiroriMotion(rn, 1 / 60, t, true); reduced.updateHiroriMotion(rr, 1 / 60, t, true);
    maxTailN = Math.max(maxTailN, Math.abs(rn.userData.parts.tail.rotation.y));
    maxTailR = Math.max(maxTailR, Math.abs(rr.userData.parts.tail.rotation.y));
    maxLegR = Math.max(maxLegR, Math.abs(rr.userData.parts.leftLeg.rotation.x));
    assert.ok(Math.abs(rr.userData.parts.body.position.y) === 0, 'body bob under reduced motion'); }
  assert.ok(maxLegR > 0.4, `legs should still walk: ${maxLegR}`);
  assert.ok(maxTailR < maxTailN * 0.5, `tail ${maxTailR} vs ${maxTailN}`);
  reduced.startHiroriArrival();
  let maxRaiseR = 0;
  for (let i = 0; i < 60; i++) { reduced.updateHiroriMotion(rr, 1 / 60, i / 60, false);
    assert.ok(Math.abs(rr.position.y) === 0, 'hop under reduced motion');
    maxRaiseR = Math.max(maxRaiseR, rr.userData.parts.rightArm.rotation.z - 0.12); }
  assert.ok(maxRaiseR > 0.3 && maxRaiseR <= 0.5, `small arm raise ${maxRaiseR}`);
});

// ═══ 既存の処理とのつながり（ソースの確認。実際の動きはブラウザで確認） ═══
test('14. 既存の移動・到着・リセット・描画ループにつながっている', () => {
  assert.match(HTML, /character = createHiroriPlaceholder\(\);/);
  assert.match(HTML, /function triggerMission\(\)\{[\s\S]*?if\(!mixer\) startHiroriArrival\(\);[\s\S]*?setState\(S\.MISSION_FOUND\);/);
  assert.match(HTML, /function doReset\(\)\{[\s\S]*?resetHiroriMotion\(\);/);
  // Step 11L-A：Field ヒロリを読み込めたときはその動き、読み込めないときは仮ヒロリの動き
  assert.match(HTML, /if\(!mixer\)\{[\s\S]*?\(fieldHirori\.active\(\) \? fieldHirori\.update : updateHiroriMotion\)\(character, dt, t, walking\);/);
  assert.match(HTML, /turnToward\(character, hiroriMotion\.facing, dt\);/);
  assert.ok(!/mkPlaceholder/.test(HTML));
});

test('15. 移動速度・到着判定・カメラ追従・タップ判定は変えていない', () => {
  assert.match(HTML, /const SPEED=4\.0, ARRIVE=0\.6;/);
  assert.match(HTML, /const CAM_OFF = new THREE\.Vector3\(0, 5, 8\);/);
  assert.match(HTML, /camera\.position\.lerp\(character\.position\.clone\(\)\.add\(CAM_OFF\),\.08\);/);
  assert.match(HTML, /const hits=raycaster\.intersectObject\(ground\);/);
  assert.equal((HTML.match(/intersectObject/g) || []).length, 1);
});

test('16. GLB・外部素材・新しい通信に頼っていない', () => {
  assert.ok(!/\.glb|\.gltf|GLTFLoader\(|\.load\(/i.test(SRC));
  assert.ok(!/fetch\(|XMLHttpRequest|https?:/.test(SRC));
  const script = HTML.replace(/\/\/.*$/gm, '');
  assert.equal((script.match(/\bfetch\(/g) || []).length, 2, 'only the vocabulary fetch and the expand fetch (Step 11L-F)');
  assert.equal((HTML.match(/https:\/\/cdn\./g) || []).length, 2, 'no new CDN');
});

// ═══ Step 9B：ミッション地点と構図（ソースの確認。見え方はブラウザで確認） ═══
test('18. ミッション地点は MISSION_POS 1か所で決まり、リセットでも同じ場所に戻る', () => {
  assert.match(HTML, /const MISSION_POS = new THREE\.Vector3\(1\.5, 0, -6\.5\);/);
  assert.match(HTML, /mpGroup\.position\.copy\(MISSION_POS\); scene\.add\(mpGroup\);/);
  assert.match(HTML, /function doReset\(\)\{[\s\S]*?mpGroup\.position\.copy\(MISSION_POS\);/);
  assert.ok(!/mpGroup\.position\.set\(0,0,-8\)/.test(HTML));
});

test('19. 到着時：結晶の手前（1.3以上）で止まり、結晶の方を向き、映す角度を決める', () => {
  assert.match(HTML, /const ARRIVAL_MIN_GAP=1\.3;/);
  const tm = HTML.match(/function triggerMission\(\)\{([\s\S]*?)\n\}/)[1];
  assert.match(tm, /if\(gap<ARRIVAL_MIN_GAP\)/);
  assert.match(tm, /hiroriMotion\.facing=Math\.atan2\(toC\.x,toC\.z\);/);
  assert.match(tm, /chooseFocusSide\(\);[\s\S]*setState\(S\.MISSION_FOUND\);/);
});

test('20. 名前ラベルは、動けないとき（到着後・パネル表示中）は消す', () => {
  const fn = HTML.match(/function updateLabel\(\)\{([\s\S]*?)\n\}/)[1];
  assert.match(fn, /if\(!canMove\(\)\)\{charLabel\.style\.opacity='0';return;\}/);
});

test('21. 探索中のカメラ追従は元のまま。パネル中だけ構図を変え、動きを減らす設定では即座に落ち着く', () => {
  const fn = HTML.match(/function updateCamera\(dt\)\{([\s\S]*?)\n\}/)[1];
  assert.match(fn, /if\(!focus\)\{\s*camera\.position\.lerp\(character\.position\.clone\(\)\.add\(CAM_OFF\),\.08\);/);
  assert.match(fn, /const k=reduceMotionQuery\.matches\?1:1-Math\.exp\(-dt\/FOCUS_TAU\);/);
  assert.match(fn, /camera\.clearViewOffset\(\)/);
  assert.match(HTML, /updateCamera\(dt\);/);
});

test('17. VOCABULARY_AI_ENABLED は true（Step 10F：ローカルのデモ）で、定義は1か所だけ', () => {
  assert.match(HTML, /const VOCABULARY_AI_ENABLED = true;/);
  assert.equal((HTML.match(/VOCABULARY_AI_ENABLED =/g) || []).length, 1);
});
