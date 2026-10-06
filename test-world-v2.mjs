// Step 11I-B：ワールドV2（Blender で作った素材と起伏のある地形）のテスト。ブラウザも通信も使わない
// 素材（assets/world-v2/）・地形（TERRAIN-BEGIN〜END を取り出して計算する）・V1 へ戻る仕組み・画質・歩ける範囲を調べる
// 実行: node --test test-world-v2.mjs
// WORLD_V2_ROOT を指定すると、そのフォルダの demo-world.html と assets/world-v2 を調べる（壊した一時コピーで、テストが失敗できるかを確かめるため）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const REPO = dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.WORLD_V2_ROOT || REPO;
const normalize = s => s.replace(/\r\n/g, '\n');
const HTML = normalize(readFileSync(join(ROOT, 'demo-world.html'), 'utf8'));
const TAG = 'tv-recording-candidate-20260928';
const git = (...a) => execFileSync('git', a, { cwd: REPO, maxBuffer: 64 * 1024 * 1024 });
const OLD = normalize(git('show', `${TAG}:demo-world.html`).toString('utf8'));
const between = (s, a, b) => { const i = s.indexOf(a), j = s.indexOf(b, i + 1); assert.ok(i >= 0 && j > i, `markers ${a} / ${b}`); return s.slice(i, j); };
const count = (s, re) => (s.match(re) || []).length;
const stripComments = s => s.split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n');

const ASSET_DIR = join(ROOT, 'assets', 'world-v2');
const GLB_PATH = join(ASSET_DIR, 'tomori-world-kit.glb');
const GLB = existsSync(GLB_PATH) ? readFileSync(GLB_PATH) : Buffer.alloc(0);
const MANIFEST = existsSync(join(ASSET_DIR, 'manifest.json')) ? JSON.parse(readFileSync(join(ASSET_DIR, 'manifest.json'), 'utf8')) : null;
const V2 = between(HTML, '// WORLD-V2-BEGIN', '// WORLD-V2-END');
const V2_CODE = stripComments(V2);
const TERRAIN = between(HTML, '// TERRAIN-BEGIN', '// TERRAIN-END');
const T = new Function(TERRAIN + '\nreturn { heightAt, WALK, GATE, WORD_TREE, segDist };')();
const inWalk = (x, z) => Math.hypot((x - T.WALK.cx) / T.WALK.rx, (z - T.WALK.cz) / T.WALK.rz) <= 1;

function glbJson(buf) {
  assert.ok(buf.length > 20, 'glb exists');
  assert.equal(buf.toString('latin1', 0, 4), 'glTF', 'magic');
  assert.equal(buf.readUInt32LE(4), 2, 'version 2');
  assert.equal(buf.readUInt32LE(8), buf.length, 'length');
  const jsonLen = buf.readUInt32LE(12);
  assert.equal(buf.toString('latin1', 16, 20), 'JSON', 'json chunk');
  const binHead = 20 + jsonLen;
  assert.equal(buf.toString('latin1', binHead + 4, binHead + 8), 'BIN\0', 'bin chunk');
  return JSON.parse(buf.toString('utf8', 20, 20 + jsonLen));
}
const REQUIRED_NODES = ['Tree_Round_A', 'Tree_Round_B', 'Tree_Tall_A', 'Tree_Tall_B', 'Tree_Sapling_A', 'Grass_A', 'Grass_B', 'Grass_C',
  'Flowers_A', 'Flowers_B', 'Flowers_C', 'Bush_A', 'Bush_B', 'Rock_Pebbles', 'Rock_Medium_A', 'Rock_Medium_B', 'Stone_Standing_A', 'Stone_Standing_B',
  'Shrine', 'RootGate_Left', 'RootGate_Right', 'RootGate_Top', 'RootGate_Cross', 'WordTree', 'WordTree_Fruit_01', 'WordTree_Fruit_02', 'WordTree_Fruit_03', 'WordTree_Fruit_04', 'WordTree_Fruit_05',
  'WordSeed', 'WordSeed_Core', 'WordSeed_Glow'];

// ── 素材 ─────────────────────────────────────────────────────────────
test('1. GLB は glTF 2.0 の1ファイル（ヘッダー・version・JSON と BIN の区切り）', () => { glbJson(GLB); });

test('2. GLB は外部 URI・画像・テクスチャ・カメラ・ライト・アニメーション・拡張機能を持たない（DRACO・KTX2 なし）', () => {
  const j = glbJson(GLB);
  assert.ok((j.buffers || []).every(b => b.uri === undefined), 'no external buffer uri');
  for (const k of ['images', 'textures', 'samplers', 'cameras', 'animations', 'skins']) assert.ok(!(j[k] || []).length, k);
  assert.ok(!(j.extensionsUsed || []).length && !(j.extensionsRequired || []).length, 'no extensions');
  assert.ok(!/KHR_draco|KHR_texture_basisu|EXT_meshopt|KHR_lights/.test(JSON.stringify(j)));
  assert.ok(!(j.materials || []).length, 'no materials (vertex colors only)');
});

test('3. 必要なノード名がそろい、manifest のノード一覧と一致する', () => {
  const names = glbJson(GLB).nodes.map(n => n.name).sort();
  for (const n of REQUIRED_NODES) assert.ok(names.includes(n), n);
  assert.deepEqual(MANIFEST.nodes.map(n => n.name).sort(), names);
  // 根の門は左・右・上が別のノード（Part 2 で開けられる）、光の実は同じ形を共有する
  const j = glbJson(GLB), byName = Object.fromEntries(j.nodes.map(n => [n.name, n]));
  assert.notEqual(byName.RootGate_Left.mesh, byName.RootGate_Right.mesh);
  assert.equal(new Set(REQUIRED_NODES.filter(n => n.startsWith('WordTree_Fruit')).map(n => byName[n].mesh)).size, 1);
  assert.ok(MANIFEST.nodes.every(n => n.type === 'group' ? n.triangles === 0 : n.triangles > 0 && n.triangles < 2000), 'triangles per node');
});

test('4. manifest の大きさ・SHA-256 が実際のファイルと一致し、外部素材は0件', () => {
  assert.ok(MANIFEST, 'manifest');
  const f = MANIFEST.files.find(x => x.path === 'assets/world-v2/tomori-world-kit.glb');
  assert.equal(f.bytes, GLB.length);
  assert.equal(f.sha256, createHash('sha256').update(GLB).digest('hex'));
  assert.equal(MANIFEST.external_assets, 0);
  assert.match(MANIFEST.generator, /^tools\/world-v2\/generate_tomori_world\.py \(Blender 5\.2\.1 LTS\)$/);
});

test('5. 容量：GLB は 1.5MB 以下、1つの形は 300KB 以下。置いてよいファイルだけがある', () => {
  assert.ok(GLB.length <= 1.5 * 1024 * 1024, `glb ${GLB.length}`);
  const j = glbJson(GLB), views = j.bufferViews, acc = j.accessors;
  for (const m of j.meshes) {
    const bytes = m.primitives.reduce((s, p) => s + [...Object.values(p.attributes), p.indices].reduce((t, i) => t + views[acc[i].bufferView].byteLength, 0), 0);
    assert.ok(bytes <= 300 * 1024, `${m.name} ${bytes}`);
  }
  const files = readdirSync(ASSET_DIR).sort();
  assert.deepEqual(files, ['LICENSE.txt', 'manifest.json', 'tomori-world-kit.glb']);
  const total = files.reduce((s, f) => s + statSync(join(ASSET_DIR, f)).size, 0);
  assert.ok(total <= 1.5 * 1024 * 1024, 'total');
});

test('6. 権利表記：TOMORI のために生成した独自素材で、外部・第三者・クラフトピアの素材は0件', () => {
  const lic = readFileSync(join(ASSET_DIR, 'LICENSE.txt'), 'utf8');
  assert.match(lic, /External assets used: 0/);
  assert.match(lic, /Third-party, redistributed, downloaded or Craftopia assets: 0/);
  assert.match(lic, /tools\/world-v2\/generate_tomori_world\.py/);
  assert.match(MANIFEST.license, /No third-party, redistributed or Craftopia assets/);
});

test('7. 素材に、作った人のパソコンのパスやユーザー名が残っていない', () => {
  for (const s of [GLB.toString('latin1'), JSON.stringify(MANIFEST), readFileSync(join(ASSET_DIR, 'LICENSE.txt'), 'utf8')]) {
    assert.ok(!/[A-Za-z]:\\|\\Users\\|\/Users\/|DELL|AppData/.test(s), 'no local path');
  }
  const gen = readFileSync(join(REPO, 'tools', 'world-v2', 'generate_tomori_world.py'), 'utf8');
  assert.match(gen, /SEED = \d+/);
  assert.ok(!/urllib|requests|http[s]?:\/\/(?!\S*blender)/.test(gen.replace(/#.*$/gm, '')), 'generator does not download anything');
});

// ── V1 へ戻る仕組み ─────────────────────────────────────────────────────
test('8. WORLD_V2_ENABLED = true。?world=v1 で V1 を強制できる（品質確認用）', () => {
  assert.match(HTML, /^const WORLD_V2_ENABLED = true;$/m);
  assert.equal(count(HTML, /const WORLD_V2_ENABLED/g), 1);
  assert.match(V2, /get\('world'\) !== 'v1'/);
});

test('9. V2 は組み立てがすべて成功したときだけ切り替わり、失敗・時間切れでは V1 のまま（console に出さない）', () => {
  assert.match(V2_CODE, /try \{ activate\(build\(readGlb\(buf\)\)\); clearTimeout\(timer\); finish\(true\); \}\s*catch \(e\) \{ clearTimeout\(timer\); finish\(false\); \}/);
  assert.match(V2_CODE, /const timer = setTimeout\(\(\) => finish\(false\), LOAD_TIMEOUT_MS\);/);
  assert.match(V2_CODE, /\}, undefined, \(\) => \{ clearTimeout\(timer\); finish\(false\); \}\);/);
  // シーンを変えるのは activate の中だけ（組み立ては新しいグループの中で行う）
  const act = between(V2_CODE, 'function activate(built)', '\n  }\n');
  const rest = V2_CODE.replace(act, '');
  // （ことばのタネと、その外の光・下の地面の光だけは、組み立てで隠しておき、「デモを最初から」でも隠し直す：Step 11I-C・11K-B）
  assert.ok(!/scene\.add\(|ground\.geometry =|(?<!wordSeed|seedGround|seedHalo)\.visible = false/.test(rest), 'scene changes only in activate');
  assert.match(act, /active = true;\s*$/);
  assert.ok(!/console\./.test(V2_CODE));
  // 読み込み画面は、V2 か V1 の準備ができてから消える
  assert.match(HTML, /Promise\.all\(\[new Promise\(r=>setTimeout\(r,800\)\), worldV2\.ready\]\)\.then\(/);
});

test('10. WebGL が使えないときは GLB を取りに行かない（V2 は WebGL の確認と renderer の作成より後）', () => {
  const noWebgl = HTML.indexOf("throw new Error('no webgl');"), renderer = HTML.indexOf('const renderer = new THREE.WebGLRenderer('), load = HTML.indexOf('new THREE.FileLoader()');
  assert.ok(noWebgl > 0 && renderer > noWebgl && load > renderer);
  assert.equal(count(stripComments(HTML), /tomori-world-kit\.glb/g), 1, 'one GLB url in code');
  assert.match(V2, /const GLB_URL = 'assets\/world-v2\/tomori-world-kit\.glb';/);
});

// ── 地形 ─────────────────────────────────────────────────────────────
test('11. heightAt は1つだけで、地形の頂点・木や岩・祠・門・ことばの樹・ヒロリが同じ関数を使う', () => {
  assert.equal(count(HTML, /function heightAt\(/g), 1);
  assert.match(V2, /const x = WALK\.cx \+ warp\(gp\.getX\(i\)\), z = WALK\.cz \+ warp\(gp\.getZ\(i\)\), h = heightAt\(x, z\);\s*gp\.setXYZ\(i, x, h, z\);/);
  assert.match(V2, /lists\.get\(name\)\.push\(\[x, heightAt\(x, z\) \+ dy, z/);
  assert.match(V2, /m4\.compose\(p3\.set\(x, heightAt\(x, z\), z\)/);
  assert.match(V2, /c\.position\.y = \(mixer \? 0 : c\.position\.y\) \+ heightAt\(c\.position\.x, c\.position\.z\);/);
  assert.match(V2, /const floor = heightAt\(camera\.position\.x, camera\.position\.z\) \+ 1\.2;/);
  // 同じ入力なら同じ高さ（乱数を使わない）
  assert.equal(T.heightAt(3.3, -4.7), T.heightAt(3.3, -4.7));
  assert.ok(!/Math\.random/.test(TERRAIN));
});

test('12. 出発点・小道・祠・秘密の場所は平ら（高さ0）。根の門は谷の底で、ほぼ平ら', () => {
  for (const [x, z] of [[0, 0], [1.5, -6.5], [16, -8]]) assert.ok(Math.abs(T.heightAt(x, z)) < 1e-9, `${x},${z}`);
  for (const [dx, dz] of [[0, 0], [1.5, 0], [-1.5, 0], [0, 1.5]]) assert.ok(Math.abs(T.heightAt(T.GATE.x + dx, T.GATE.z + dz)) < .05, 'gate floor');
  for (let k = 0; k <= 20; k++) assert.ok(Math.abs(T.heightAt(1.5 * k / 20, -6.5 * k / 20)) < 1e-9, 'path');
  for (let a = 0; a < 360; a += 30) {
    const r = 3.6, x = 1.5 + Math.cos(a) * r, z = -6.5 + Math.sin(a) * r;   // 立ち石の輪の外側まで
    assert.ok(Math.abs(T.heightAt(x, z)) < 1e-6, 'shrine area');
  }
});

test('13. 歩ける範囲の傾きは10°以下、外は丘で閉じる（起伏がある）', () => {
  let max = 0, hi = 0;
  for (let x = -14; x <= 20; x += .25) for (let z = -15; z <= 8; z += .25) {
    if (!inWalk(x, z)) continue;
    const dx = (T.heightAt(x + .05, z) - T.heightAt(x - .05, z)) / .1, dz = (T.heightAt(x, z + .05) - T.heightAt(x, z - .05)) / .1;
    max = Math.max(max, Math.atan(Math.hypot(dx, dz)) * 180 / Math.PI);
    hi = Math.max(hi, T.heightAt(x, z));
  }
  assert.ok(max <= 10, `max slope ${max.toFixed(2)}`);
  assert.ok(hi > .3, 'gentle rolling inside');
  assert.ok(T.heightAt(0, -24) > 1 && T.heightAt(-18, -14) > 1, 'hills outside');
  // V2 のカメラ（横長：+z 8.2・+3.4、縦長：-x 4.2・+z 7.6・+4.4）が、歩ける範囲のどこでも地面より上にある
  for (const [ox, oy, oz] of [[0, 3.4, 8.2], [-4.2, 4.4, 7.6]]) for (let a = 0; a < 360; a += 5) {
    const x = T.WALK.cx + Math.cos(a * Math.PI / 180) * T.WALK.rx, z = T.WALK.cz + Math.sin(a * Math.PI / 180) * T.WALK.rz;
    assert.ok(T.heightAt(x, z) + oy - T.heightAt(x + ox, z + oz) > 1.5, 'camera above ground');
  }
});

test('14. 根の門は歩ける範囲のふちにあり、その先（ことばの樹の方向）へは歩けない', () => {
  const e = Math.hypot((T.GATE.x - T.WALK.cx) / T.WALK.rx, (T.GATE.z - T.WALK.cz) / T.WALK.rz);
  assert.ok(e > .95 && e < 1.05, `gate on the edge ${e}`);
  assert.ok(!inWalk(T.WORD_TREE.x, T.WORD_TREE.z), 'word tree is beyond the gate');
  assert.ok(inWalk(1.5, -6.5) && inWalk(0, 0), 'start and mission reachable');
  assert.ok(Math.hypot(T.WORD_TREE.x - 1.5, T.WORD_TREE.z + 6.5) > 25, 'word tree is far');
});

// ── 歩ける範囲・画質・動き ────────────────────────────────────────────────
test('15. タップ先とキーボード移動の両方を、歩ける範囲の内側へ戻す（速さ・操作は同じ）', () => {
  assert.match(HTML, /targetPos\.copy\(hits\[0\]\.point\); targetPos\.y=0; worldV2\.clampToWalkable\(targetPos, 0\.97\);/);
  const anim = between(HTML, 'function animate(){', '\n}\n');
  assert.ok(anim.indexOf('worldV2.groundCharacter(character);') > anim.indexOf('updateHiroriMotion(character, dt, t, walking);'), 'after motion');
  assert.ok(anim.indexOf('worldV2.groundCharacter(character);') < anim.indexOf('// 距離チェック'), 'before mission check');
  assert.match(V2, /function groundCharacter\(c\) \{\s*if \(!active \|\| !c\) return;\s*clampToWalkable\(c\.position, 1\);/);
  assert.match(HTML, /const SPEED=4\.0, ARRIVE=0\.6;/);
  // 到着判定は平面の距離
  assert.match(HTML, /const md=Math\.hypot\(character\.position\.x-mpGroup\.position\.x, character\.position\.z-mpGroup\.position\.z\);/);
  // だ円の外の点は、ふちの上へ戻る。内側の点は動かない
  const clamp = new Function('let active = true, gateOpen = false;\n' + TERRAIN + between(HTML, '// ADVENTURE-BEGIN', '// ADVENTURE-END') + between(V2, '  // 歩ける範囲の内側へ戻す', '  // ヒロリを歩ける範囲') + '\nreturn clampToWalkable;')();
  const e = p => Math.hypot((p.x - T.WALK.cx) / T.WALK.rx, (p.z - T.WALK.cz) / T.WALK.rz);
  for (const [x, z] of [[40, -40], [-30, 5], [3, 30], [T.WORD_TREE.x, T.WORD_TREE.z]]) {
    const p = clamp({ x, y: 0, z }, 1);
    assert.ok(Math.abs(e(p) - 1) < 1e-9, `on the edge ${x},${z}`);
    assert.ok(e(clamp({ x, y: 0, z }, .97)) < .971, 'tap target slightly inside');
  }
  const inside = clamp({ x: 1, y: 0, z: -2 }, 1);
  assert.deepEqual([inside.x, inside.z], [1, -2]);
});

test('16. 画質は起動時に一度だけ決まり、low は pixelRatio 1.25・影なし・植物 50%', () => {
  assert.equal(count(HTML, /const WORLD_QUALITY = /g), 1);
  assert.ok(!/WORLD_QUALITY\s*=[^=]/.test(HTML.replace('const WORLD_QUALITY = ', '')), 'never reassigned');
  assert.ok(HTML.indexOf('const WORLD_QUALITY = ') < HTML.indexOf('const renderer = new THREE.WebGLRenderer('));
  assert.match(HTML, /renderer\.setPixelRatio\(Math\.min\(devicePixelRatio, WORLD_QUALITY === 'low' \? 1\.25 : 2\)\);/);
  assert.match(HTML, /matchMedia\('\(pointer: coarse\)'\)\.matches/);
  // 影は high だけ
  const act = between(V2_CODE, 'function activate(built)', '\n  }\n');
  assert.match(act, /if \(HIGH\) \{[\s\S]*renderer\.shadowMap\.enabled = true;[\s\S]*sun\.castShadow = true;/);
  assert.equal(count(V2_CODE, /shadowMap\.enabled = true/g), 1);
  assert.ok(/castShadow = HIGH && CASTERS\.has\(name\)/.test(V2_CODE) && /mesh\.castShadow = HIGH;/.test(V2_CODE));
  assert.match(V2_CODE, /sun\.shadow\.mapSize\.set\(2048, 2048\)/);
  assert.match(V2_CODE, /const keep = i => HIGH \|\| i % 20 < 10;/);
  assert.ok(!/UnrealBloom|EffectComposer|Bloom/.test(HTML), 'no bloom');
});

test('17. 毎フレームの処理（PER-FRAME-V2）で新しい物を作らず、reduced-motion では動きを止める', () => {
  const frame = stripComments(between(V2, '// PER-FRAME-V2-BEGIN', '// PER-FRAME-V2-END'));
  const body = frame.slice(frame.indexOf('function update(t)'));
  assert.ok(!/\bnew\b|\.clone\(|=\s*\[|\(\s*\[|=>|\.map\(|\.filter\(|\{\s*\w+\s*:/.test(body), body);
  assert.match(body, /const still = reduceMotionQuery\.matches;/);
  assert.match(body, /const k = still \? \.5 :/);
  assert.match(body, /softMat\.opacity = still \?/);
  assert.match(HTML, /worldArt\.update\(t\); worldV2\.update\(t\);/);
  assert.equal(count(HTML, /requestAnimationFrame/g), count(OLD, /requestAnimationFrame/g), 'no new requestAnimationFrame');
  assert.ok(!/setInterval/.test(V2_CODE));
  assert.equal(count(V2_CODE, /setTimeout\(/g), 1, 'only the load timeout');
});

// ── 変えていないこと ───────────────────────────────────────────────────
test('18. 外部 URL・CDN・通信は増えていない（GLB は同じ場所から three の FileLoader で読む。fetch は語彙だけ）', () => {
  const urls = s => [...new Set(s.match(/https?:\/\/[^\s'"`)<>]+/g) || [])].sort();
  assert.deepEqual(urls(HTML), urls(OLD));
  assert.ok(!/https?:\/\/|import\(|fetch\(|XMLHttpRequest|GLTFLoader|DRACOLoader|KTX2Loader/.test(V2_CODE));
  assert.equal(count(stripComments(HTML), /\bfetch\(/g), 2, 'only the vocabulary fetch and the expand fetch (Step 11L-F)');
  const importmap = s => (s.match(/<script type="importmap">[\s\S]*?<\/script>/) || [''])[0];
  assert.equal(importmap(HTML), importmap(OLD));
});

test('19. AI スイッチ true・語彙の Worker URL・care・ミッションの文面は変わっていない', () => {
  assert.match(HTML, /const VOCABULARY_AI_ENABLED = true;/);
  const url = s => (s.match(/const VOCABULARY_API_URL = '([^']+)';/) || [])[1];
  assert.equal(url(HTML), url(OLD));
  const care = s => between(s, 'const CARE_SUPPORT_MESSAGE', 'const VOCAB_SESSION_KEY');
  assert.equal(care(HTML), care(OLD));
  const missionLines = s => s.split('\n').filter(l => /光るポイント|なにかが呼んでいる|気になったものを|VOCAB_MISSION/.test(l)).join('\n');
  assert.equal(missionLines(HTML), missionLines(OLD));
  assert.ok(!/tomori-api\.[a-z0-9-]+\.workers\.dev/.test(HTML));
});

test('20. ヒロリの範囲（HIRORI-BEGIN〜END）・index.html・画像・起動ファイル・手順書・収録版タグは変わっていない', () => {
  assert.equal(between(HTML, '// HIRORI-BEGIN', '// HIRORI-END'), between(OLD, '// HIRORI-BEGIN', '// HIRORI-END'));
  if (ROOT === REPO) {
    for (const f of ['index.html', 'start-tv-demo.cmd', 'docs/TV_RECORDING_RUNBOOK.md']) assert.equal(normalize(readFileSync(join(REPO, f), 'utf8')), normalize(git('show', `b2caa58:${f}`).toString('utf8')), f);
    assert.ok(readFileSync(join(REPO, 'assets', 'tomori-world-gateway.webp')).equals(git('show', 'b2caa58:assets/tomori-world-gateway.webp')));
  }
  assert.equal(git('rev-parse', '--short', `${TAG}^{commit}`).toString().trim(), '1890884');
});

// ── Step 11I-B Part 1B（第一印象の仕上げ）─────────────────────────────────
test('21. カメラの構図は V2 だけで変わる（V1 の CAM_OFF・見る高さは今までどおり）', () => {
  assert.match(HTML, /^const CAM_OFF = new THREE\.Vector3\(0, 5, 8\);$/m);
  assert.match(HTML, /^const CAM_LOOK = new THREE\.Vector3\(0, 1, 0\);/m);
  assert.match(HTML, /camTgt\.lerp\(character\.position\.clone\(\)\.add\(CAM_LOOK\),\.08\);/);
  const act = between(V2_CODE, 'function activate(built)', '\n  }\n');
  assert.match(act, /CAM_OFF\.set\(portrait \? -4\.2 : 0, portrait \? 4\.4 : 3\.4, portrait \? 7\.6 : 8\.2\);/);
  assert.match(act, /CAM_LOOK\.set\(0, portrait \? 2\.3 : 1\.6, 0\);/);
  // V2 の外（V1）では構図を変えない。冒険の途中で一時的に変えた構図は、元の構図（defOff・defLook）へ必ず戻す（Step 11I-C）
  const outside = HTML.replace(V2, '');
  assert.ok(!/CAM_OFF\.set|CAM_LOOK\.set/.test(outside));
  assert.match(act, /defOff\.copy\(CAM_OFF\); defLook\.copy\(CAM_LOOK\);/);
  assert.ok(count(V2_CODE, /CAM_OFF\.copy\(defOff\)/g) >= 1 && count(V2_CODE, /CAM_LOOK\.copy\(defLook\)/g) >= 3, 'restored');
  // 秘密の道では、元の構図を水平にまわすだけ（高さ・距離は変えない）
  assert.match(V2_CODE, /CAM_OFF\.set\(defOff\.x \* cs \+ defOff\.z \* sn, defOff\.y, -defOff\.x \* sn \+ defOff\.z \* cs\);/);
});

test('22. V1 の小道と光の柱は V2 では描かない。光の粒（V1 と同じ作り方・数）は丸くやわらかい点にして、V2 でも描く（low は数を減らす）', () => {
  const act = between(V2_CODE, 'function activate(built)', '\n  }\n');
  assert.match(act, /scene\.children\.forEach\(o => \{ if \(o\.isPoints && !HIGH\) o\.geometry\.setDrawRange\(0, 48\); \}\);/);
  assert.ok(!/isPoints\) o\.visible = false/.test(act));
  const dots = between(HTML, '// SOFT-DOTS-BEGIN', '// SOFT-DOTS-END');
  assert.match(dots, /dots\.material = new THREE\.ShaderMaterial\(/);
  assert.match(dots, /gl_PointSize = clamp\(0\.14 \* scale \/ max\(d, 0\.1\), 1\.5, 10\.0\)/);   // カメラの近くでも 10px まで
  assert.match(dots, /vFade = smoothstep\(2\.5, 6\.0, d\)/);                                       // カメラのすぐ近くでは消える
  assert.match(dots, /length\(gl_PointCoord - 0\.5\)/);                                              // 丸い点
  assert.ok(!/Texture|fetch\(/.test(dots));
  assert.match(act, /worldArt\.group\.children\.forEach\(o => \{ if \(o !== worldArt\.mpGlow\) o\.visible = false; \}\);/);
  const points = s => (s.match(/\/\/ ── パーティクル[\s\S]*?scene\.add\(new THREE\.Points\([^\n]*\n/) || [''])[0];
  assert.ok(points(HTML).length > 0);
  assert.equal(points(HTML), points(OLD), 'V1 particles unchanged');
});

test('23. 根の門：左右は根元が回転の中心（Part 2 で開ける）、上は別のノード。形は門の大きさ', () => {
  const j = glbJson(GLB), byName = Object.fromEntries(j.nodes.map(n => [n.name, n]));
  const tx = n => (byName[n].translation || [0, 0, 0]);
  assert.ok(tx('RootGate_Left')[0] < -1 && tx('RootGate_Right')[0] > 1, 'pivots left and right');
  assert.equal(tx('RootGate_Left')[1], 0); assert.equal(tx('RootGate_Right')[1], 0);
  const acc = j.accessors, pos = n => acc[j.meshes[byName[n].mesh].primitives[0].attributes.POSITION];
  // 柱は根元から高く（3m 前後）、上の弧はさらに上
  assert.ok(pos('RootGate_Left').max[1] > 2.8 && pos('RootGate_Right').max[1] > 2.8);
  assert.ok(pos('RootGate_Top').min[1] > 2 && pos('RootGate_Top').max[1] > 3.5);
  // 柱どうしの間に通り道の幅がある（左右の柱の根元の距離）
  assert.ok(tx('RootGate_Right')[0] - tx('RootGate_Left')[0] > 2.5);
  for (const n of ['RootGate_Left', 'RootGate_Right', 'RootGate_Top']) assert.ok(MANIFEST.nodes.find(x => x.name === n).triangles >= 300, n);
});

test('24. 光る小道：足もとから祠の入口へ・祠の出口から門へ。地形に沿い、ふちは透明。光の点は reduced-motion で止まる', () => {
  const r = V2.match(/const ROUTES = (\[\[\[[\s\S]*?\]\]\]);/);
  const routes = new Function('return ' + r[1])();
  const [a, b] = routes, first = a[0], endA = a[a.length - 1], startB = b[0], endB = b[b.length - 1];
  assert.ok(Math.hypot(first[0], first[1]) < 1, 'starts at Hirori');
  assert.ok(Math.hypot(endA[0] - 1.5, endA[1] + 6.5) < 1.8, 'ends at the shrine entrance');
  assert.ok(Math.hypot(startB[0] - 1.5, startB[1] + 6.5) < 1.6 && Math.hypot(endB[0] - T.GATE.x, endB[1] - T.GATE.z) < 1, 'shrine to gate');
  assert.match(V2, /pos\.push\(x, heightAt\(x, z\) \+ \.025, z\);/);
  assert.match(V2, /PA = \[0, \.28, \.85, \.28, 0\]/);
  assert.match(V2, /new THREE\.MeshBasicMaterial\(\{ vertexColors: true, transparent: true, depthWrite: false, side: THREE\.DoubleSide \}\)/);
  const frame = stripComments(between(V2, '// PER-FRAME-V2-BEGIN', '// PER-FRAME-V2-END'));
  assert.match(frame, /const u = still \? k \/ n \+ \.1 :/);
  assert.match(frame, /moteSamples\[j \+ 1\] \+ \(still \? 0 :/);
});

test('25. ことばの樹は門の先 15〜25m の谷の奥にあり、通常の木より十分に大きい', () => {
  const d = Math.hypot(T.WORD_TREE.x - T.GATE.x, T.WORD_TREE.z - T.GATE.z);
  assert.ok(d >= 15 && d <= 25, `gate to tree ${d}`);
  const j = glbJson(GLB), byName = Object.fromEntries(j.nodes.map(n => [n.name, n])), acc = j.accessors;
  const h = n => acc[j.meshes[byName[n].mesh].primitives[0].attributes.POSITION].max[1];
  const normal = Math.max(h('Tree_Round_A'), h('Tree_Round_B'), h('Tree_Tall_A'), h('Tree_Tall_B'));
  assert.ok(h('WordTree') * T.WORD_TREE.scale >= normal * 2.5, `word tree ${h('WordTree')} vs ${normal}`);
  // 樹冠のまわりは遠くの木で埋めない（谷の奥はあける）
  assert.ok(!/\[11, -21, 4\]/.test(V2));
});

test('26. ことばのタネ：金色の実と水色の光の2つを、入れ物 WordSeed がまとめる。深掘りの問いのあとまで隠しておく', () => {
  const j = glbJson(GLB), byName = Object.fromEntries(j.nodes.map(n => [n.name, n]));
  const kids = (byName.WordSeed.children || []).map(i => j.nodes[i].name).sort();
  assert.deepEqual(kids, ['WordSeed_Core', 'WordSeed_Glow']);
  assert.equal(byName.WordSeed.mesh, undefined, 'group only');
  const acc = j.accessors, size = n => { const a = acc[j.meshes[byName[n].mesh].primitives[0].attributes.POSITION]; return a.max[1] - a.min[1]; };
  assert.ok(size('WordSeed_Glow') > size('WordSeed_Core'), 'glow wraps the core');
  assert.ok(size('WordSeed_Core') < .3, 'fits in Hirori\'s hand');
  assert.deepEqual(MANIFEST.shown_by_adventure, ['WordSeed', 'WordSeed_Core', 'WordSeed_Glow']);
  assert.match(V2_CODE, /wordSeed = new THREE\.Group\(\); wordSeed\.name = 'WordSeed'; wordSeed\.visible = false;/, 'hidden until born');
  // ことばの樹の実は金色と水色、灯った実は金色（白く光らせない）
  assert.match(V2, /fruits\.setColorAt\(i, c3\.set\(i === 0 \? 0xffd978 : i % 2 \? 0x8fc6d8 : 0xd6b468\)\);/);
  assert.match(V2, /const LIT = new THREE\.Color\(0xffe08a\), DIM = new THREE\.Color\(0xd6b468\)/);
});

test('27. Step 11K の美術：祠の結晶と輪は金色・クリーム色（位置・到着判定は同じ）。到着後は光を落ち着かせる', () => {
  const act = between(V2_CODE, 'function activate(built)', '\n  }\n');
  assert.match(V2_CODE, /crystalMat = new THREE\.MeshLambertMaterial\(\{ color: 0xf4d58c, emissive: 0x9a6c1c, flatShading: true \}\);/);
  assert.match(act, /mpCrystal\.material = crystalMat;/);
  assert.match(act, /mpRing\.material = ringMat; mpRing\.scale\.set\(1\.08, 1\.08, \.32\);/);
  assert.ok(!/mpGroup\.position|MISSION_RADIUS|MISSION_POS\.set/.test(act), 'no change to the mission point');
  const upd = between(V2, '  function update(t)', '  function adventure(');
  assert.match(upd, /calm \+= \(\(state === S\.EXPLORE \? 1 : \.4\) - calm\) \* Math\.min\(1, dt \* 3\);/);
  assert.match(V2_CODE, /gateMat\.emissive\.setRGB\(0, 0, 0\); calm = 1;/);   // リセットで最初の明るさへ
});

test('28. Step 11K の美術：木・茂み・岩・草は、場所から決めた差で形と色を変える（乱数の順番・数は変えない）。草花は手前ほど大きい', () => {
  assert.match(V2_CODE, /const hash2 = \(x, z\) => frac\(Math\.sin\(x \* 12\.9898 \+ z \* 78\.233\) \* 43758\.5453\);/);
  const loop = between(V2_CODE, 'const vary = VARY.has(name);', 'im.instanceMatrix.needsUpdate');
  assert.ok(!/rnd\(\)/.test(loop), 'no extra random draws');
  assert.ok(!/Flowers/.test(between(V2_CODE, 'const VARY = new Set(', ']);')), 'the sky-blue sprout color stays exact');
  assert.match(V2_CODE, /put\(name, x, z, s \* \(\.85 \+ rnd\(\) \* \.35\) \* depthSize\(x, z\), undefined, depthTint\(x, z\)\)/);
  // 遠くの丘：日の当たる明るい色と、霧の青緑
  assert.match(V2_CODE, /c3\.lerp\(cHaze, smooth\(2\.0, 3\.6, eDist\) \* \.42\);/);
});
