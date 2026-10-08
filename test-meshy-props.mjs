// Step 11N：Meshy のことばの樹・香りの草・大きくした実・V2 の花・AI の記録 のテスト。ブラウザも通信も使わない
// 実行: node --test test-meshy-props.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = dirname(fileURLToPath(import.meta.url));
const HTML = readFileSync(join(ROOT, 'demo-world.html'), 'utf8').replace(/\r\n/g, '\n');
const between = (s, a, b) => { const i = s.indexOf(a), j = s.indexOf(b, i + 1); assert.ok(i >= 0 && j > i, `markers ${a} / ${b}`); return s.slice(i, j); };
const MESHY = between(HTML, 'const MESHY_TREE_URL', 'const ready = ');
const glbInfo = f => {
  const b = readFileSync(join(ROOT, f)), dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const j = JSON.parse(b.subarray(20, 20 + dv.getUint32(12, true)).toString());
  const p = j.meshes[0].primitives[0];
  return { j, p, tris: j.accessors[p.indices].count / 3, b };
};

test('1. ゲーム用の樹と草だけを assets に置く（高詳細の正本は置かない）。1つの形・頂点色だけ・材質なし（色を二重に掛けない）', () => {
  const man = JSON.parse(readFileSync(join(ROOT, 'assets/world-meshy/manifest.json'), 'utf8'));
  for (const [f, tris, max] of [['tomori-word-tree-game.glb', 3418, 4000], ['tomori-scent-plant-game.glb', 1228, 1500]]) {
    const { j, p, b } = glbInfo('assets/world-meshy/' + f);
    assert.equal(j.meshes.length, 1); assert.equal(j.meshes[0].primitives.length, 1);
    assert.deepEqual(Object.keys(p.attributes).sort(), ['COLOR_0', 'NORMAL', 'POSITION']);
    assert.equal((j.materials || []).length, 0, 'no material colour on top of vertex colour');
    assert.equal(j.accessors[p.indices].count / 3, tris); assert.ok(tris <= max);
    assert.equal(createHash('sha256').update(b).digest('hex'), man.files[f].sha256);
  }
  assert.ok(!existsSync(join(ROOT, 'assets/world-meshy/tomori-word-tree-original.glb')));
});

test('2. 実は5つ、樹のローカル座標で置き、直径をいままでの約3倍にする。樹の高さ・歩ける範囲・着いたと判定する距離は変えない', () => {
  const slots = new Function('return ' + MESHY.match(/const FRUIT_SLOTS = (\[[^;]+\]);/)[1])();
  assert.equal(slots.length, 5);
  for (const [x, y, z] of slots) { assert.ok(Math.abs(x) < .45 && y > .4 && y < .95 && z > -.05, 'on the front of the crown'); }
  for (let i = 0; i < 5; i++) for (let k = i + 1; k < 5; k++) {
    const d = Math.hypot(slots[i][0] - slots[k][0], slots[i][1] - slots[k][1], slots[i][2] - slots[k][2]);
    assert.ok(d > 2 * .085 * .95, `fruits ${i},${k} do not overlap`);
  }
  assert.match(MESHY, /const FRUIT_SCALE = 3;/);
  assert.match(MESHY, /fruitBase\[i\]\.multiplyMatrices\(m\.matrix, slot\)\.multiply\(size\); fruitPos\[i\]\.setFromMatrixPosition\(fruitBase\[i\]\);/);
  assert.match(HTML, /const SEED_PICK_R = 1\.25, GATE_OPEN_R = 3\.6, TREE_REACH_R = 3\.4;/);
  assert.match(HTML, /const TREE_AREA = \{ x: WORD_TREE\.x, z: WORD_TREE\.z, r: 3\.8, trunk: 1\.6 \};/);
});

test('3. 読めなかったときは今までの樹・実・目印のまま。樹の演出のあとでは入れかえない', () => {
  assert.match(MESHY, /if \(progress === P\.TREE_REACHED \|\| progress === P\.COMPLETE\) return;/);
  assert.match(MESHY, /\} catch \(e\) \{ \/\* 読めなければ、いままでの樹と実のまま \*\/ \}/);
  assert.match(MESHY, /\}, undefined, \(\) => \{\}\);/);
  assert.match(HTML, /let meshyTree = false, markerY = \.55;/);
});

test('4. 最初の2つの実は、左右の下枝（いちばん見やすい場所）から灯る（Meshy の樹のとき）', () => {
  assert.match(HTML, /if \(meshyTree && i > 2\) continue;/);
  assert.match(HTML, /if \(meshyTree && i <= 2\) \{ pick = i; break; \}/);
});

test('5. 香りの草は道くさの場所ごとに1本（画面の外は描かない）。気配の光は草の上', () => {
  assert.match(MESHY, /DETOUR_DEFS\.forEach\(\(d, k\) => \{\s*const pl = new THREE\.Mesh\(geo, mat\);/);
  assert.match(MESHY, /markerY = PLANT_H \+ \.25;/);
  assert.match(HTML, /worldV2\.groundAt\(d\.x, d\.z\) \+ worldV2\.markerHeight\(\)/);
});

test('6. V2 では V1 の道・秘密の場所・赤い花を出さない。達成の花は祠のまわりに咲く（V1 は今までどおり）', () => {
  const change = between(HTML, 'function doWorldChange(word){', '\n}\n');
  assert.match(change, /if\(!worldV2\.isActive\(\)\)\{ newPath\.visible=true; secretGroup\.visible=true; \}/);
  assert.match(change, /if\(!worldV2\.isActive\(\)\) worldTimeout\(\(\)=>bloomSeq\(redFlowers,null\), 700\);/);
  const fin = between(HTML, 'function finishSecret(){', '\n};\n');
  assert.match(fin, /mkFlower\(MISSION_POS\.x\+Math\.cos\(a\)\*r,MISSION_POS\.z\+Math\.sin\(a\)\*r,false\)/);
  assert.match(fin, /mkFlower\(16\+Math\.cos\(a\)\*r,-8\+Math\.sin\(a\)\*r,true\)/);
});
