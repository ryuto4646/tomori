// Step 11L-A：探索用の低ポリ「Field ヒロリ」のテスト。ブラウザも通信も使わない
// GLB の中身（形式・三角形・素材・部位・とさかの並び）と、ゲームへの組み込み（同じ場所から読む・失敗したら仮ヒロリ）を確かめる
// 実行: node --test test-field-hirori.mjs
// FIELD_HIRORI_ROOT を指定すると、そのフォルダの demo-world.html と assets/hirori-field を調べる（壊した一時コピーで、テストが失敗できるかを確かめるため）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { inspect } from './tools/validate-hirori-v3.mjs';

const REPO = dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.FIELD_HIRORI_ROOT || REPO;
const GLB = join(ROOT, 'assets', 'hirori-field', 'hirori-field.glb');
const HTML = readFileSync(join(ROOT, 'demo-world.html'), 'utf8').replace(/\r\n/g, '\n');
const OLD = execFileSync('git', ['show', 'tv-recording-candidate-20260928:demo-world.html'], { cwd: REPO, maxBuffer: 64 * 1024 * 1024 }).toString('utf8').replace(/\r\n/g, '\n');
const between = (s, a, b) => { const i = s.indexOf(a), j = s.indexOf(b, i + 1); assert.ok(i >= 0 && j > i, `markers ${a} / ${b}`); return s.slice(i, j); };
const count = (s, re) => (s.match(re) || []).length;
const stripComments = s => s.split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n');
const FH = between(HTML, '// FIELD-HIRORI-BEGIN', '// FIELD-HIRORI-END');
const FH_CODE = stripComments(FH);
const buf = readFileSync(GLB);
const json = JSON.parse(buf.toString('utf8', 20, 20 + buf.readUInt32LE(12)));
const node = n => json.nodes.find(x => x.name === n);
// ノードの、GLB 全体の座標での大きさ（親をたどって、位置と大きさを順に掛ける。回転のない形で書き出している）
const box = n => {
  const chain = []; let k = json.nodes.indexOf(node(n));
  while (k >= 0) { chain.push(json.nodes[k]); k = json.nodes.findIndex(p => (p.children || []).includes(k)); }
  const toWorld = q => chain.reduce((v, nd) => { const sc = nd.scale || [1, 1, 1], tr = nd.translation || [0, 0, 0]; return v.map((x, i) => x * sc[i] + tr[i]); }, q);
  const pr = json.meshes[node(n).mesh].primitives, mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (const p of pr) { const a = json.accessors[p.attributes.POSITION], lo = toWorld(a.min), hi = toWorld(a.max); for (let i = 0; i < 3; i++) { mn[i] = Math.min(mn[i], lo[i], hi[i]); mx[i] = Math.max(mx[i], lo[i], hi[i]); } }
  return { mn, mx, size: mx.map((v, i) => v - mn[i]), c: mx.map((v, i) => (v + mn[i]) / 2) };
};
const ROOT_S = (node('Hirori_Root').scale || [1, 1, 1])[0];

test('1. GLB：glTF 2.0・1ファイル・外部 URI なし・テクスチャなし・1.5MB 以下。Field の検査ツールに合格する', () => {
  const r = inspect(GLB, { profile: 'field' });
  assert.deepEqual(r.checks.filter(c => c.level === 'error').map(c => c.id), []);
  assert.ok(r.facts.triangles >= 2000 && r.facts.triangles <= 5000, `triangles ${r.facts.triangles}`);
  assert.ok(r.facts.materials <= 5);
  assert.equal(r.facts.textures, 0); assert.equal(r.facts.images, 0);
  assert.equal(r.facts.cameras, 0); assert.equal(r.facts.lights, 0);
  assert.ok(statSync(GLB).size <= 1.5 * 1024 * 1024);
  assert.ok(Math.abs(r.facts.sole_y) <= .005 && r.facts.height >= .95 && r.facts.height <= 1.05);
  const man = JSON.parse(readFileSync(join(ROOT, 'assets', 'hirori-field', 'manifest.json'), 'utf8'));
  assert.equal(man.sha256, createHash('sha256').update(buf).digest('hex'), 'manifest matches the GLB');
  assert.equal(man.triangles, r.facts.triangles);
});

test('2. 部位：とさか4枚・羽2枚・脚と足が2つずつ・目2つ。鼻・尻尾・腕・手・指・爪・耳・角はない', () => {
  const names = json.nodes.map(n => n.name);
  for (const n of ['Hirori_Root', 'Hirori_Body', 'Hirori_CreamPatch', 'Hirori_Wing_L', 'Hirori_Wing_R', 'Hirori_Leg_L', 'Hirori_Leg_R', 'Hirori_Foot_L', 'Hirori_Foot_R', 'Hirori_Eye_L', 'Hirori_Eye_R']) assert.ok(names.includes(n), n);
  // 口は作らない（Step 11L-A 顔修正）：口・口の中・舌の部品も素材も、GLB・manifest・生成スクリプトに残っていない
  const raw = buf.toString('latin1'), man = readFileSync(join(ROOT, 'assets', 'hirori-field', 'manifest.json'), 'utf8'), gen = readFileSync(join(REPO, 'tools', 'hirori-field', 'generate_hirori_field.py'), 'utf8');
  for (const s of [raw, man, gen]) assert.ok(!/mouth|tongue/i.test(s), 'no mouth');
  assert.ok(!/nose/i.test(raw) && !/nose/i.test(man), 'no nose part');
  // 目は正面から正円（横の半径と縦の半径が同じ）
  assert.match(gen, /eye_r=\(0\.01935, 0\.008, 0\.01935\)/);
  assert.equal(names.filter(n => /^Hirori_Crest_0[1-4]$/.test(n)).length, 4);
  assert.equal(names.filter(n => /Crest/.test(n)).length, 4);
  assert.ok(!names.some(n => /nose|tail|arm(?!ature)|hand|finger|claw|ear(?!th)|horn/i.test(n)));
  // 足は脚の子（歩くとき、脚と一緒に動く）
  assert.ok(node('Hirori_Leg_L').children.includes(json.nodes.indexOf(node('Hirori_Foot_L'))));
  assert.ok(node('Hirori_Leg_R').children.includes(json.nodes.indexOf(node('Hirori_Foot_R'))));
});

test('3. とさか：頭のまんなかの線の上に、顔側から後頭部へ一直線。先頭がいちばん大きく、うしろへ順に小さい', () => {
  const cs = [1, 2, 3, 4].map(k => box('Hirori_Crest_0' + k));
  for (const c of cs) assert.ok(Math.abs(c.c[0]) < .005, 'on the center line (x = 0)');
  // 根もと（ノードの位置）は顔側（+Z）から後ろ（-Z）へ並ぶ
  const roots = [1, 2, 3, 4].map(k => node('Hirori_Crest_0' + k).translation);
  for (let i = 0; i < 3; i++) assert.ok(roots[i][2] > roots[i + 1][2], `crest ${i + 1} is in front of ${i + 2}`);
  const len = cs.map(c => Math.hypot(c.size[1], c.size[2]));
  for (let i = 0; i < 3; i++) assert.ok(len[i] > len[i + 1], `crest ${i + 1} is larger than ${i + 2}`);
  // 頭頂より上へ出る（上・うしろへ流れる）
  const head = box('Hirori_Body');
  assert.ok(cs[0].mx[1] > head.mx[1] + .02, 'crest shows above the head');
  assert.ok(cs[0].mx[1] - head.mx[1] < .15, 'crest stays small (no crown)');
});

test('4. 比率（ひよこ型）：頭（あごから頭頂）は全高の30〜34%。胴は頭より幅が広い。脚はほとんど見えない。羽の内側は水色', () => {
  const body = box('Hirori_Body'), cream = box('Hirori_CreamPatch');
  const total = Math.max(...[1, 2, 3, 4].map(k => box('Hirori_Crest_0' + k).mx[1]), body.mx[1]);
  // あご：生成スクリプトの、修正後の首（0.49）＋ 修正前のあごまでの高さ（0.04）× 頭の縮小率（0.78）。根の大きさを掛ける
  const chin = (.49 + .04 * .78) * ROOT_S, head = body.mx[1] - chin;
  assert.ok(head / total >= .30 && head / total <= .34, `head ratio ${(head / total).toFixed(3)}`);
  // 胴（首より下）の幅が、頭の幅より広い
  const neckY = .49 * ROOT_S;
  assert.ok(body.size[0] > 0, 'body');
  const torsoW = 2 * .190 * ROOT_S, headW = 2 * .206 * .78 * ROOT_S;
  assert.ok(torsoW > headW * 1.1, 'torso wider than head');
  // 脚：胴の下から見える長さは短い（足首 0.04 から胴の下 0.066 まで）
  assert.ok(body.mn[1] < .1, 'body comes down close to the feet');
  const wl = box('Hirori_Wing_L'), wr = box('Hirori_Wing_R');
  assert.ok(wl.mx[0] > .15 && wr.mn[0] < -.15, 'wings at the sides');
  for (const w of ['Hirori_Wing_L', 'Hirori_Wing_R']) assert.equal(json.meshes[node(w).mesh].primitives.length, 2, 'coral outside + blue inside');
  assert.ok(cream.mx[1] > neckY, 'cream on the face');
});

test('5. 組み込み：同じ場所の GLB を読み、すべて成功したときだけ仮ヒロリと入れかえる。失敗・8秒こえは仮ヒロリのまま', () => {
  assert.match(FH, /const URL_GLB = 'assets\/hirori-field\/hirori-field\.glb', TIMEOUT_MS = 8000, SCALE = 2\.0;/);
  assert.ok(!/https?:\/\//.test(FH_CODE), 'same origin only');
  assert.match(FH, /new THREE\.FileLoader\(\)\.setResponseType\('arraybuffer'\)\.load\(url,/);
  assert.match(FH, /try \{ const parts = parse\(buf, kind\); clearTimeout\(timer\); if \(!done\) \{ attach\(root, parts\); finish\(true\); \} \}\s*catch \(e\) \{ clearTimeout\(timer\); finish\(false\); \}/);
  assert.match(FH, /\}, undefined, \(\) => \{ clearTimeout\(timer\); finish\(false\); \}\);/);
  assert.match(FH, /const timer = setTimeout\(\(\) => finish\(false\), TIMEOUT_MS\);/);
  // 画像や外のファイルを使う GLB は読まない
  assert.match(FH, /if \(\(json\.images \|\| \[\]\)\.length \|\| \(json\.textures \|\| \[\]\)\.length \|\| \(json\.buffers \|\| \[\]\)\.some\(b => b\.uri\)\) throw new Error\('external data'\);/);
  // 仮ヒロリへ戻す道：?hirori=placeholder、読めなかったとき（active が false のまま）
  assert.match(FH, /const wanted = new URLSearchParams\(location\.search\)\.get\('hirori'\) !== 'placeholder';/);
  assert.match(HTML, /\(fieldHirori\.active\(\) \? fieldHirori\.update : updateHiroriMotion\)\(character, dt, t, walking\);/);
  assert.match(HTML, /character = createHiroriPlaceholder\(\);\nscene\.add\(character\);\n\/\/ FIELD-HIRORI-BEGIN/);
  // 入れかえは、仮ヒロリの体を隠して足すだけ（位置・向き・影・名前の表示は仮ヒロリのもの）
  assert.match(FH, /for \(const o of root\.children\) if \(o !== pp\.shadow\) o\.visible = false;\s*root\.add\(parts\.top\); P = parts; active = true;/);
});

test('6. WebGL が使えないときは GLB を取りに行かない（WebGL の確認と renderer の作成より後で読む）', () => {
  const noWebgl = HTML.indexOf("throw new Error('no webgl');"), renderer = HTML.indexOf('const renderer = new THREE.WebGLRenderer('), load = HTML.indexOf('fieldHirori.ready = fieldHirori.load(character);');
  assert.ok(noWebgl > 0 && renderer > noWebgl && load > renderer);
});

test('7. 動き：毎フレームの処理で新しい物を作らない。新しい rAF・タイマー・外の URL を足さない。reduced-motion では飾りの揺れを止める', () => {
  const upd = stripComments(between(FH, 'function update(root, dt, t, moving) {', 'return { load, update'));
  assert.ok(!/\bnew\b|\.clone\(|=\s*\[|\(\s*\[|=>|\.map\(|\.filter\(|\{\s*\w+\s*:/.test(upd), 'per-frame allocation');
  assert.match(upd, /deco = reduce \? 0 : 1, lift = reduce \? 0 : 1;/);
  assert.match(upd, /P\.upper\.scale\.y = 1 \+ breath \* \.012 \* \(1 - w\) \* deco;/);
  assert.match(upd, /P\.crest\[i\]\.rotation\.x = \(.*\) \* deco;/);
  assert.equal(count(HTML, /requestAnimationFrame/g), count(OLD, /requestAnimationFrame/g), 'no new requestAnimationFrame');
  assert.equal(count(FH_CODE, /setTimeout\(/g), 1, 'only the load timeout');
  assert.ok(!/setInterval|PointLight|SpotLight|TextureLoader|GLTFLoader/.test(FH_CODE));
  // 外の URL（CDN など）を増やさない
  const urls = s => new Set((s.match(/https?:\/\/[^'"\s)]+/g) || []).filter(u => !/w3\.org/.test(u)));
  for (const u of urls(HTML)) assert.ok(urls(OLD).has(u) || /workers\.dev/.test(u), u);
});

test('8. 羽（Step 11L-B）：左右同じ大きさで肩から下・うしろへ。待機で地面から0.04m以上、歩いても地面より下へ行かない', () => {
  const wl = box('Hirori_Wing_L'), wr = box('Hirori_Wing_R');
  const pl = node('Hirori_Wing_L').translation, pr = node('Hirori_Wing_R').translation;
  // 回転の中心（ノードの位置）は肩：生成スクリプトの shoulder_x=0.145・shoulder_z=0.42 に根の大きさを掛けた位置
  assert.ok(Math.abs(pl[0] * ROOT_S - .145 * ROOT_S) < .03 && Math.abs(pl[1] * ROOT_S - .42 * ROOT_S) < .06, 'pivot at the shoulder');
  assert.ok(Math.abs(pl[0] + pr[0]) < 1e-6 && Math.abs(pl[1] - pr[1]) < 1e-6, 'symmetric pivots');
  for (let i = 0; i < 3; i++) assert.ok(Math.abs(wl.size[i] - wr.size[i]) < 1e-4, 'same size');
  // 待機：羽先は地面から0.04〜0.08m（全高1.0）。地面にふれない
  assert.ok(wl.mn[1] >= .04 && wl.mn[1] <= .08, `idle clearance ${wl.mn[1].toFixed(3)}`);
  // 歩くとき：羽は待機より上・外へだけ動く。体の左右の傾き（0.07rad）と上下（最大 -0.006）を足しても、地面より上
  const tipX = Math.max(Math.abs(wl.mn[0]), Math.abs(wl.mx[0]));
  assert.ok(wl.mn[1] - Math.sin(.07) * tipX - .006 > 0, 'stays above the ground while walking');
  // 羽は肩の高さより下まで長い（地面近くまで届く）
  assert.ok(wl.size[1] > .4);
});

test('9. 羽の動き：歩くあいだだけ左右いっしょに上・外へ約10°。待機は2°以下。reduced-motion では止める。目の大きさと位置は前のまま', () => {
  assert.match(FH, /WING_FLAP = \.17, WING_IDLE = \.03;/);
  const flap = between(FH, 'const flap =', ';');
  assert.match(flap, /\(\.5 - \.5 \* Math\.cos\(m\.phase \* 2\)\) \* WING_FLAP \* w \+ \(\.5 - \.5 \* Math\.cos\(t \* 1\.6\)\) \* WING_IDLE \* \(1 - w\)/);
  // (.5 - .5cos) は 0〜1：待機の角度より下へは振らない。上限は 0.17rad（約9.7°）・待機は 0.03rad（約1.7°）
  assert.ok(.17 * 180 / Math.PI >= 8 && .17 * 180 / Math.PI <= 12 && .03 * 180 / Math.PI <= 2);
  assert.match(FH, /P\.wingL\.rotation\.z = P\.wingBase\[0\] \+ flap \* deco;\s*P\.wingR\.rotation\.z = P\.wingBase\[1\] - flap \* deco;/);
  assert.match(FH, /deco = reduce \? 0 : 1/);
  const gen = readFileSync(join(REPO, 'tools', 'hirori-field', 'generate_hirori_field.py'), 'utf8');
  assert.match(gen, /eye_x=0\.086 \* HEAD_K \* 0\.92 \* 0\.85, eye_z=hz\(0\.592\), eye_r=\(0\.01935, 0\.008, 0\.01935\)/);
});

// Step 11N：Meshy から作ったヒロリ（1つの形・頂点色だけ）。先に読み、読めなければいままでの Field ヒロリ、それも読めなければ仮ヒロリ
const MGLB = join(ROOT, 'assets', 'hirori-meshy', 'hirori-meshy.glb');
test('10. Meshy ヒロリの GLB：1つの形・頂点色だけ（材質・テクスチャなし）・三角形 8,000 以下・高さ1・manifest と一致', () => {
  const r = inspect(MGLB, { profile: 'field' });
  assert.deepEqual(r.checks.filter(c => c.level === 'error').map(c => c.id), []);
  assert.ok(r.facts.triangles <= 8000, `triangles ${r.facts.triangles}`);
  assert.equal(r.facts.materials, 0); assert.equal(r.facts.textures, 0); assert.equal(r.facts.images, 0);
  assert.ok(Math.abs(r.facts.sole_y) <= .005 && r.facts.height >= .95 && r.facts.height <= 1.05);
  const mb = readFileSync(MGLB), mj = JSON.parse(mb.toString('utf8', 20, 20 + mb.readUInt32LE(12)));
  assert.equal(mj.meshes.length, 1); assert.equal(mj.meshes[0].primitives.length, 1);
  const pr = mj.meshes[0].primitives[0];
  assert.deepEqual(Object.keys(pr.attributes).sort(), ['COLOR_0', 'JOINTS_0', 'NORMAL', 'POSITION', 'WEIGHTS_0']);
  assert.ok(pr.indices !== undefined && pr.material === undefined);
  // 骨（Step 11O）：8本・すべて回転なし（ゲームで rotation.x／z をそのまま使う）。アニメーションは入れない（動きはゲーム側で作る）
  assert.equal(mj.skins.length, 1); assert.equal((mj.animations || []).length, 0);
  const bones = mj.skins[0].joints.map(k => mj.nodes[k]);
  assert.deepEqual(bones.map(b => b.name).sort(), ['Flower', 'Foot_L', 'Foot_R', 'Leg_L', 'Leg_R', 'Root', 'Wing_L', 'Wing_R']);
  for (const b of bones) assert.ok(!b.rotation && !b.scale, `${b.name} has no rest rotation`);
  const man = JSON.parse(readFileSync(join(ROOT, 'assets', 'hirori-meshy', 'manifest.json'), 'utf8'));
  assert.equal(man.sha256, createHash('sha256').update(mb).digest('hex'), 'manifest matches the GLB');
  assert.equal(man.triangles, r.facts.triangles);
  assert.ok(statSync(MGLB).size <= 1.5 * 1024 * 1024);
});

test('11. Meshy ヒロリの組み込み：先に読み、だめならいままでの Field ヒロリ。?hirori=field で元のヒロリへ戻せる。部位の動きは Meshy ヒロリにはかけない', () => {
  assert.match(FH, /const MESHY_GLB = 'assets\/hirori-meshy\/hirori-meshy\.glb';/);
  assert.match(FH, /const useMeshy = new URLSearchParams\(location\.search\)\.get\('hirori'\) !== 'field';/);
  assert.match(FH, /if \(!wanted\) return false;\s*if \(useMeshy && await loadOne\(root, MESHY_GLB, 'meshy'\)\) return true;\s*return loadOne\(root, URL_GLB, 'field'\);/);
  // 材質のない GLB でも読める（頂点色だけ）
  assert.match(FH, /if \(!mats\.length\) mats\.push\(new THREE\.MeshStandardMaterial/);
  // 脚・羽・とさか・まばたきは、部位のある Field ヒロリだけ
  const upd = between(FH, 'function update(root, dt, t, moving) {', 'return { load, update');
  assert.equal(count(upd, /if \(!P\.meshy\)/g), 4);
  assert.match(upd, /P\.upper\.rotation\.z = s \* \.07 \* w \* deco;/);
});

test('12. 骨で歩く（Step 11O）：骨の行列を読める。脚は左右交互、足の裏は水平、低いほうの足がちょうど地面。体全体の揺れは小さく', () => {
  assert.match(FH, /MAT4: 16/);
  assert.match(FH, /new THREE\.SkinnedMesh\(g, mat\)/);
  assert.match(FH, /me\.bind\(new THREE\.Skeleton\(bones, inv\), me\.matrixWorld\)/);
  const upd = between(FH, 'function update(root, dt, t, moving) {', 'return { load, update');
  assert.match(upd, /gait\(ph\); legPose\(B\.Foot_L\.userData\.rest/);
  assert.match(upd, /gait\(ph \+ \.5\); legPose\(B\.Foot_R\.userData\.rest/);   // 右は半周期ずらす（交互）
  assert.match(upd, /B\.Foot_L\.rotation\.x = -aL; B\.Foot_R\.rotation\.x = -aR;/);
  assert.match(upd, /B\.Root\.position\.y = B\.Root\.userData\.rest\.y - Math\.min\(yL \+ hL, yR \+ hR\);/);
  assert.match(upd, /P\.upper\.rotation\.z = s \* \.025 \* w \* deco;/);
  // 歩幅と周期：1周期で STRIDE_RIG 進む。phase は移動速度から進める（速さと足の動きを合わせる）
  assert.match(FH, /const STRIDE_RIG = \.9, RIG_REACH = \.075, RIG_SHIFT = \.45, RIG_LIFT = \.028, RIG_SIN_MAX = \.6;/);
  assert.match(upd, /m\.phase \+= dt \* SPEED \* \(Math\.PI \* 2\) \/ \(P\.rig \? STRIDE_RIG : STRIDE\);/);
  // 歩き方の計算（gait・legPose）も、毎フレーム新しい物を作らない
  const helpers = stripComments(between(FH, 'function gait(u) {', 'function update(root'));
  assert.ok(!/\bnew\b|\.clone\(|=>|\.map\(/.test(helpers), 'no per-frame allocation in gait helpers');
});
