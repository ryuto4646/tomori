// FLOW-02：移動のもどかしさと、自動表示による中断を減らす。ブラウザも通信も使わない
// 速さと歩幅を2倍・場所どうしの間を2倍・近づいただけでは開かない・小さな「調べる／はじめる」・木を透かす
// 実行: node --test test-flow02.mjs
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
const V2 = between(HTML, '// WORLD-V2-BEGIN', '// WORLD-V2-END');
const TERRAIN = between(HTML, '  // TERRAIN-BEGIN', '  // TERRAIN-END');
const ADV = between(HTML, '  // ADVENTURE-BEGIN', '  // ADVENTURE-END');
const T = new Function(CORE + '\nreturn { TREASURE_SPOTS, TREASURE_TALK_R };')();
const W = new Function(TERRAIN + ADV + '\nreturn { WALK, GATE, WORD_TREE, GREAT, inWalk };')();
const num = re => +HTML.match(re)[1];

// 前（LANGUAGE-01 まで）の場所
const OLD = { popo: [-1.7, -2.6], mina: [-5.6, 1.6], cat: [-1.8, -9.8], bell: [-9.4, -1.9], spring: [-8.8, -7.6], chest: [-11.0, -5.6], cave: [-5.2, -11.0], rock: [-4.0, -3.0], bloom: [-6.8, -3.6], dazzle: [-6.4, -8.2] };

test('1. 速さと歩幅を2倍。足を動かす速さ（1秒あたりの歩数）は前と同じ', () => {
  const speed = num(/const SPEED=([\d.]+), ARRIVE=0\.6;/), rig = num(/const STRIDE_RIG = ([\d.]+),/), units = num(/const STRIDE_UNITS = ([\d.]+);/);
  assert.equal(speed, 6.6);
  assert.equal(rig, 3.0); assert.equal(units, 3.2);
  assert.ok(Math.abs(speed / rig - 3.3 / 1.5) < 1e-9, 'rigged Hirori: same cadence');
  assert.ok(Math.abs(speed / units - 3.3 / 1.6) < 1e-9, 'placeholder: same cadence');
  // 足を前後に大きく出し、着地の前後をゆっくりにして、足がすべって見えにくくする。跳ねは小さく
  assert.ok(num(/RIG_REACH = ([\d.]+),/) > .1 && num(/STEP_BOB = ([\d.]+),/) <= .05);
  // 行き過ぎない：1コマで進む量は、残りの距離まで
  assert.match(HTML, /multiplyScalar\(Math\.min\(SPEED\*dt\*fieldHirori\.pace\(\),dist\)\)/);
});

test('2. 場所どうしの間をおよそ2倍に。人・物・調べる範囲の大きさは変えない', () => {
  const S = T.TREASURE_SPOTS, ids = Object.keys(OLD);
  let r = 0, n = 0;
  for (const a of ids) for (const b of ids) if (a < b) {
    const now = Math.hypot(S[a].x - S[b].x, S[a].z - S[b].z), old = Math.hypot(OLD[a][0] - OLD[b][0], OLD[a][1] - OLD[b][1]);
    r += now / old; n++;
  }
  assert.ok(Math.abs(r / n - 2) < .05, `average ratio ${r / n}`);
  assert.equal(T.TREASURE_TALK_R, 2.0, 'the call distance is not scaled');
  assert.match(HTML, /const TREE_SPOTS=\[\[-10,-12\]/);
  assert.deepEqual([W.WALK.rx, W.WALK.rz], [30, 19]);
  // 新しい速さで歩く時間は、前とほぼ同じ（遠くなっただけで、面倒にはしない）
  const order = ['popo', 'cat', 'bell', 'spring', 'chest', 'cave'];
  let now = 0, old = 0;
  for (let i = 1; i < order.length; i++) { const a = order[i - 1], b = order[i]; now += Math.hypot(S[a].x - S[b].x, S[a].z - S[b].z); old += Math.hypot(OLD[a][0] - OLD[b][0], OLD[a][1] - OLD[b][1]); }
  assert.ok(Math.abs(now / 6.6 - old / 3.3) < .5, `walk ${(now / 6.6).toFixed(1)}s vs ${(old / 3.3).toFixed(1)}s`);
  // 草原の「場所と場所のあいだ」に小さな木立と花（人・物・道・出発点の前はあける。乱数は別の列）
  assert.match(V2, /let s2 = 917331;/);
  assert.match(V2, /spots\.some\(s => Math\.hypot\(x - s\.x, z - s\.z\) < 4\.5\)/);
  // 門は草原のふちのすぐ外（タップで近づいて止まった場所から、閉じていても、しらべられる）
  const e = Math.hypot((W.GREAT.gate.x - W.WALK.cx) / W.WALK.rx, (W.GREAT.gate.z - W.WALK.cz) / W.WALK.rz);
  assert.ok(e > 1 && e < 1.06, `gate ${e}`);
});

test('3. 近づいただけでは開かない：写真のクエスト・第2クエストの芽・道くさは、押したときだけ', () => {
  const anim = HTML.match(/function animate\(\)\{([\s\S]*?)\n\}/)[1];
  assert.ok(!/triggerMission\(/.test(anim), 'shrine');
  const qu = between(HTML, '// QUEST-UI-BEGIN', '// QUEST-UI-END'), upd = between(qu, '  function update(t) {', '\n  }\n');
  assert.ok(!/startSecond\(|openDetour\(/.test(code(upd)), 'sprout / detour');
  assert.match(UI, /\['btn-treasure-open', \(\) => \{ if \(near === 'mission'\) \{ if \(missionCallable\(\)\) triggerMission\(\); \} else if \(near === 'sprout'\) questHub\.startSecond\(\); else if \(near\) open\(near\); \}\]/);
  assert.match(UI, /el\('treasure-call-text'\)\.textContent = near === 'mission' \? '光るポイントがある' : '新しい芽が光っている';/);
  // 「着いた！」をくり返し出さない
  assert.ok(!/光るポイントに着いた|新しい芽に着いた/.test(HTML));
  // 「あとで・冒険にもどる」と「続ける」はそのまま。あとで閉じたあいだは、同じ場所で「はじめる」を出さない（「続ける」が出る）
  assert.match(UI, /const missionCallable = \(\) => state === S\.EXPLORE && !missionTriggered && !\(missionHold && missionHold\.held\(\)\);/);
  assert.match(HTML, /b\.textContent = 'あとで・冒険にもどる';/);
  assert.match(HTML, /el\('btn-hold-resume'\)\.addEventListener\('click', resume\);/);
});

// 近くの1か所を選ぶ処理を、そのまま取り出して動かす（木・岩・ヒロリの向きは、ここで決める）
function makeChooser({ occluders = [], obstacles = [] } = {}) {
  const src = between(UI, '  const CALL_KEEP', '  function update(t, dt) {');
  const f = new Function('TREASURE_SPOTS', 'TREASURE_TALK_R', 'hiroriMotion', 'S', 'mpGroup', 'questHub', 'worldV2', 'OBSTACLES', 'env',
    `let near = null; const state = env.state; let missionTriggered = false; const missionHold = null;
     ${src}
     return { step(x, z, dt) { near = chooseNear(x, z, dt); return near; }, canSee };`);
  const spots = { a: { x: 0, z: 0 }, b: { x: 3, z: 0 } };
  const hm = { facing: 0 };
  const c = f(spots, 2.0, hm, { EXPLORE: 'EXPLORE' }, { position: { x: 99, z: 99 } }, { sproutCall: () => null }, { occluders: () => occluders }, obstacles, { state: 'FREE' });
  return { c, hm };
}

test('4. 調べる案内：近くて見えるときだけ。境目でちらつかない。通り過ぎると1回出て1回消える', () => {
  const { c, hm } = makeChooser();
  hm.facing = Math.PI / 2;   // +x へ歩く
  const seq = [];
  for (let x = -4; x <= 1.2; x += .05) { const n = c.step(x, 1.4, 1 / 60); if (seq[seq.length - 1] !== n) seq.push(n); }
  assert.deepEqual(seq.slice(0, 2), [null, 'a']);
  // 境目（2.0m）の前後を小さく行ったり来たりしても、出たり消えたりしない（2.6m まで保つ）
  const { c: c2 } = makeChooser(); let flips = 0, last = c2.step(-1.95, 0, 1 / 60);
  for (let i = 0; i < 60; i++) { const n = c2.step(i % 2 ? -1.95 : -2.25, 0, 1 / 60); if (n !== last) flips++; last = n; }
  assert.equal(flips, 0);
  assert.equal(c2.step(-2.7, 0, 1 / 60), null, 'gone when clearly away');
});

test('5. 木の幹・岩の向こうの相手には出さない。2つ近いときは、近くて前にあるほう。切りかえは、はっきり近いときだけ', () => {
  const { c } = makeChooser({ occluders: [[-1, 0, 1.6]] });
  assert.equal(c.step(-1.9, 0, 1 / 60), null, 'trunk between');
  assert.equal(c.canSee(-1.9, .9, 0, 0), true, 'beside the trunk is fine');
  const { c: r } = makeChooser({ obstacles: [[-1.2, 0, .6]] });   // 相手のすぐそばの岩（自分の台など）は数えない。あいだの岩だけ
  assert.equal(r.step(-1.9, 0, 1 / 60), null, 'rock between');
  // a（0,0）と b（3,0）のあいだ：前を向いているほう
  const { c: c3, hm } = makeChooser();
  hm.facing = Math.PI / 2; assert.equal(c3.step(1.5, .5, 1 / 60), 'b');
  hm.facing = 0; assert.equal(c3.step(1.5, .5, 1 / 60), 'b', 'keeps the current one when both are the same (no flicker)');
  hm.facing = -Math.PI / 2; assert.equal(c3.step(1.5, .5, 1 / 60), 'a', 'turning toward the other one picks it');
  assert.equal(c3.step(.6, .5, 1 / 60), 'a', 'switches when the other is clearly closer');
});

test('6. 木と立ち石を透かす：カメラと「ヒロリ・調べる物」のあいだにかかったときだけ。薄くするのは早く、戻すのはゆっくり（点滅しない）', () => {
  assert.match(V2, /const FADE_KINDS = new Set\(\['Tree_Round_A', 'Tree_Round_B', 'Tree_Tall_A', 'Tree_Tall_B', 'Tree_Sapling_A', 'Stone_Standing_A', 'Stone_Standing_B'\]\)/);
  assert.match(V2, /if \(vFade < \.995 && fract\(52\.9829189 \* fract\(dot\(gl_FragCoord\.xy, vec2\(\.06711056, \.00583715\)\)\)\) > vFade\) discard;/);
  assert.match(V2, /const FADE_LOW = \.3, FADE_HOLD = \.5,/);
  assert.match(V2, /want < c \? Math\.max\(want, c - dt \/ \.18\) : Math\.min\(want, c \+ dt \/ \.45\)/);
  const f = new Function(between(V2, '  function treeOnLine(', '  function fadeOccluders(') + '\nreturn treeOnLine;')();
  const C = { x: 0, y: 5, z: 8 }, P = { x: 0, y: 1, z: 0 };
  assert.equal(f(C, P, 0, 0, 4, 1.2, 5), true, 'tree in front of Hirori');
  assert.equal(f(C, P, 3, 0, 4, 1.2, 5), false, 'tree to the side');
  assert.equal(f(C, P, 0, 0, -1, 1.2, 5), false, 'tree behind Hirori');
  assert.equal(f(C, P, 0, 0, 4, 1.2, .5), false, 'short bush under the line');
  // 透かしている木は、見えているかの確かめ（probe）でも数えない
  assert.match(UI, /i\.object\.geometry\.attributes\.aFade\.array\[i\.instanceId\] < \.5\)\);/);
  // 毎フレームの計算で物を作らない
  assert.ok(!/\bnew\b|=>|\.map\(/.test(code(between(V2, '  function fadeOccluders(', '  function update(t) {'))));
});

test('7. カメラは速く歩いても置いていかれない（時間で追いかけ、進む向きへ少し先を見る）。影はヒロリといっしょに動く', () => {
  assert.match(HTML, /const kf=reduceMotionQuery\.matches\?1:1-Math\.exp\(-dt\/\.11\);/);
  assert.match(HTML, /if\(_lead\.lengthSq\(\)>1\.96\) _lead\.setLength\(1\.4\);/);
  assert.match(V2, /if \(sun\.castShadow && character\) \{ const sx = Math\.round\(character\.position\.x\)/);
  assert.match(HTML, /scene\.fog = new THREE\.Fog\(0xd6ecef, 48, 176\);/);
});
