// Step 11P：視点を回す・寄る／引く（CAMERA-USER）のテスト。ブラウザは使わない
// 実行: node --test test-camera-user.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = dirname(fileURLToPath(import.meta.url));
const HTML = readFileSync(join(ROOT, 'demo-world.html'), 'utf8').replace(/\r\n/g, '\n');
const between = (s, a, b) => { const i = s.indexOf(a), j = s.indexOf(b, i + 1); assert.ok(i >= 0 && j > i, `markers ${a} / ${b}`); return s.slice(i, j); };
const CU = between(HTML, '// CAMERA-USER-BEGIN', '// CAMERA-USER-END');

// ブロックを取り出して、まわりを最小限のスタブで動かす（回す・寄せる・戻す・範囲）
function makeCam({ movable = true, framed = false } = {}) {
  const listeners = {}, docL = {}, winL = {};
  const on = map => (type, fn) => { (map[type] = map[type] || []).push(fn); };
  const canvas = { addEventListener: on(listeners) };
  const btn = { cls: new Set(), classList: { toggle(c, v) { v ? btn.cls.add(c) : btn.cls.delete(c); }, remove(c) { btn.cls.delete(c); } }, addEventListener: (t, fn) => { btn.click = fn; } };
  const keys = {};
  class V3 { constructor() { this.x = this.y = this.z = 0; } set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; } }
  const CAM_OFF = new V3().set(0, 3.4, 8.2);
  const env = { canvas, keys, CAM_OFF, THREE: { Vector3: V3 }, canMove: () => movable, worldV2: { cameraFramed: () => framed },
    reduceMotionQuery: { matches: true }, innerWidth: 400, document: { getElementById: () => btn, addEventListener: on(docL) }, addEventListener: on(winL) };
  const cam = new Function(...Object.keys(env), CU + '\nreturn camUser;')(...Object.values(env));
  return { cam, listeners, btn, keys, CAM_OFF };
}
const touches = pts => ({ touches: pts.map(([x, y]) => ({ clientX: x, clientY: y })), preventDefault() {} });

test('1. 最初は元の構図（CAM_OFF そのもの）。「視点をもどす」は出ない', () => {
  const { cam, btn } = makeCam();
  cam.step(.016);
  const o = cam.offset();
  assert.deepEqual([o.x, o.y, o.z], [0, 3.4, 8.2]);
  assert.equal(btn.cls.has('show'), false);
});

test('2. 2本指：左右になぞるとまわりを回る、広げると寄る。距離は 0.55〜1.6 倍に収まる。そのあいだの指の離れはタップにしない', () => {
  const { cam, listeners, btn } = makeCam();
  listeners.touchstart[0](touches([[100, 300], [200, 300]]));
  listeners.touchmove[0](touches([[150, 300], [250, 300]]));          // 中点が右へ 50px
  cam.step(.016); assert.ok(Math.abs(cam.yaw() + Math.PI * 50 / 400) < 1e-9);
  listeners.touchmove[0](touches([[100, 300], [300, 300]]));          // 広げる（100→200px）＝寄る
  cam.step(.016); assert.ok(Math.abs(cam.zoom() - .55) < 1e-9, 'zoom clamps at 0.55');
  for (let i = 0; i < 10; i++) { listeners.touchmove[0](touches([[190, 300], [210, 300]])); listeners.touchmove[0](touches([[100, 300], [300, 300]])); }
  for (let i = 0; i < 20; i++) listeners.touchmove[0](touches([[100, 300], [300, 300]].map(([x, y], k) => [200 + (k ? 1 : -1) * 1, y])));
  cam.step(.016); assert.ok(cam.zoom() <= 1.6 + 1e-9 && cam.zoom() >= .55 - 1e-9);
  assert.equal(btn.cls.has('show'), true, 'reset button appears');
  assert.equal(cam.wasGesture({ touches: [{}] }), true, 'second finger lifting is not a tap');
  assert.equal(cam.wasGesture({ touches: [] }), true, 'last finger lifting is not a tap');
  assert.equal(cam.wasGesture({ touches: [] }), false, 'a later one-finger tap walks as before');
  btn.click(); cam.step(.016);
  assert.equal(cam.yaw(), 0); assert.equal(cam.zoom(), 1);
});

test('3. 1本指のタップは、視点を動かさない（今までどおり「そこへ歩く」）', () => {
  const { cam, listeners } = makeCam();
  listeners.touchstart[0](touches([[100, 300]]));
  listeners.touchmove[0](touches([[160, 300]]));
  cam.step(.016);
  assert.equal(cam.yaw(), 0); assert.equal(cam.zoom(), 1);
  assert.equal(cam.wasGesture({ touches: [] }), false);
});

test('4. パネルを出す場面・ことばの樹の構図のあいだは、視点を動かさない（ボタンも出さない）', () => {
  for (const opt of [{ movable: false }, { framed: true }]) {
    const { cam, listeners, btn, keys } = makeCam(opt);
    listeners.touchstart[0](touches([[100, 300], [200, 300]]));
    listeners.touchmove[0](touches([[200, 300], [300, 300]]));
    keys.q = true; cam.step(.5);
    assert.equal(cam.yaw(), 0); assert.equal(btn.cls.has('show'), false);
  }
});

test('5. PC：ホイールで寄る／引く、Q／E で回る。回したら、キーで歩く向きも画面にそろう', () => {
  const { cam, listeners, keys } = makeCam();
  listeners.wheel[0]({ deltaY: 300, preventDefault() {} }); cam.step(.016);
  assert.ok(cam.zoom() > 1, 'wheel down zooms out');
  keys.q = true; cam.step(.5); keys.q = false;
  assert.ok(Math.abs(cam.yaw() - .9) < 1e-9);
  const v = { x: 0, z: -1 }; cam.turnInput(v);   // W（奥へ）を、回した向きへ
  const o = cam.offset();
  assert.ok(Math.abs(v.x * o.x + v.z * o.z + Math.hypot(o.x, o.z)) < 1e-9, 'forward key points away from the camera');
});

test('6. 組み込み：樹の構図のあいだは決めた構図。タップの判定・デモのリセット・iPhone の画面拡大', () => {
  assert.match(HTML, /camera\.position\.lerp\(character\.position\.clone\(\)\.add\(worldV2\.cameraFramed\(\)\?CAM_OFF:camUser\.offset\(character\.position\.x,character\.position\.z\)\),\.08\);/);
  assert.match(HTML, /cameraFramed: \(\) => treeFrame/);
  assert.match(HTML, /canvas\.addEventListener\('touchend',e=>\{e\.preventDefault\(\);if\(camUser\.wasGesture\(e\)\)return;onTap\(e\);\},\{passive:false\}\);/);
  assert.match(HTML, /resetHiroriMotion\(\); camUser\.reset\(\);/);
  assert.match(HTML, /kd\.normalize\(\); camUser\.turnInput\(kd\);/);
  assert.match(CU, /document\.addEventListener\('gesturestart',e=>e\.preventDefault\(\)\);/);
  assert.match(HTML, /<button id="btn-view-reset" type="button">視点をもどす<\/button>/);
  // 毎フレームの step・offset は新しい物を作らない
  const per = between(CU, 'function step(dt){', 'function reset(){');
  assert.ok(!/\bnew\b|=>/.test(per));
  assert.ok(!/requestAnimationFrame|setInterval|setTimeout/.test(CU));
});

test('7. 視点を変えているとき、ヒロリとカメラのあいだに木があれば、木の手前まで寄せる。元の視点では今までどおり（寄せない）', () => {
  const run = (yawSet, spots) => {
    const listeners = {};
    const on = map => (type, fn) => { (map[type] = map[type] || []).push(fn); };
    const btn = { classList: { toggle() {}, remove() {} }, addEventListener: (t, fn) => { btn.click = fn; } };
    class V3 { constructor() { this.x = this.y = this.z = 0; } set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; } }
    const keys = {}, env = { canvas: { addEventListener: on(listeners) }, keys, CAM_OFF: new V3().set(0, 3.4, 8.2), THREE: { Vector3: V3 }, canMove: () => true,
      worldV2: { cameraFramed: () => false, isActive: () => true, occluders: () => spots }, TREE_SPOTS: [], TREE_RADIUS: 1.6,
      reduceMotionQuery: { matches: true }, innerWidth: 400, document: { getElementById: () => btn, addEventListener() {} }, addEventListener() {} };
    const cam = new Function(...Object.keys(env), CU + '\nreturn camUser;')(...Object.values(env));
    if (yawSet) { keys.q = true; cam.step(yawSet / 1.8); keys.q = false; }
    let o; for (let i = 0; i < 80; i++) o = cam.offset(0, 0);
    return Math.hypot(o.x, o.z);
  };
  const full = Math.hypot(0, 8.2);
  assert.ok(Math.abs(run(0, [[0, 4, 1.6]]) - full) < 1e-6, 'default view is never pulled in');
  const yaw = .5, dir = [Math.sin(yaw) * 0 + 8.2 * Math.sin(yaw), 8.2 * Math.cos(yaw)].map(v => v / 8.2);   // 回したときのカメラの向き（XZ）
  assert.ok(Math.abs(run(yaw, []) - full) < 1e-6, 'no tree, no pull');
  const near = run(yaw, [[dir[0] * 5, dir[1] * 5, 1.6]]);
  assert.ok(near < 5 - 1.6 && near > full * .35 - 1e-9, `pulled in front of the tree: ${near.toFixed(2)}`);
  assert.ok(Math.abs(run(yaw, [[dir[0] * 5 + 6, dir[1] * 5, 1.6]]) - full) < 1e-6, 'a tree off the line does not pull');
});
