// Step 11K：外部ヒロリV3の受け入れ検査（tools/validate-hirori-v3.mjs）のテスト
// テスト用の小さな GLB を一時フォルダ（リポジトリの外）に作って、合格・不合格を確かめる。通信はしない
// 実行: node --test test-hirori-v3-validator.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { inspect, LIMITS, EXPECTED_PARTS, PROFILES } from './tools/validate-hirori-v3.mjs';

const REPO = dirname(fileURLToPath(import.meta.url));
const DIR = mkdtempSync(join(tmpdir(), 'hirori-v3-test-'));
process.on('exit', () => rmSync(DIR, { recursive: true, force: true }));

// 三角形 tris 個（全高 height、足裏 sole）の GLB を作る。opts でノード名・カメラ・外部 URI などを足す
function glb(name, { tris = 100, height = 1.0, sole = 0, names = EXPECTED_PARTS, camera = false, uri = false, version = 2, magic = 'glTF', extraText = '', materials = 3, x = 0 } = {}) {
  const pos = [];
  for (let i = 0; i < tris; i++) { const y = sole + (i / Math.max(1, tris - 1)) * height; pos.push(x - .1, y, 0, x + .1, y, 0, x, y, .1); }
  const bin = Buffer.from(new Float32Array(pos).buffer);
  const min = [x - .1, sole, 0], max = [x + .1, sole + height, .1];
  const nodes = names.map((n, i) => ({ name: n + extraText, ...(i === 1 ? { mesh: 0 } : {}) }));
  nodes[0].children = nodes.slice(1).map((_, i) => i + 1);
  if (camera) { nodes.push({ name: 'Camera', camera: 0 }); nodes[0].children.push(nodes.length - 1); }
  const json = {
    asset: { version: '2.0', generator: 'test' }, scene: 0, scenes: [{ nodes: [0] }], nodes,
    meshes: [{ name: 'Body', primitives: [{ attributes: { POSITION: 0 }, mode: 4 }] }],
    accessors: [{ bufferView: 0, componentType: 5126, count: pos.length / 3, type: 'VEC3', min, max }],
    bufferViews: [{ buffer: 0, byteLength: bin.length }],
    buffers: [uri ? { byteLength: bin.length, uri: 'body.bin' } : { byteLength: bin.length }],
    materials: Array.from({ length: materials }, (_, i) => ({ name: 'MAT_' + i })),
    ...(camera ? { cameras: [{ type: 'perspective', perspective: { yfov: 1, znear: .1 } }] } : {}),
  };
  let js = Buffer.from(JSON.stringify(json)); while (js.length % 4) js = Buffer.concat([js, Buffer.from(' ')]);
  let bn = bin; while (bn.length % 4) bn = Buffer.concat([bn, Buffer.alloc(1)]);
  const header = Buffer.alloc(12); header.write(magic, 0, 'latin1'); header.writeUInt32LE(version, 4); header.writeUInt32LE(12 + 8 + js.length + 8 + bn.length, 8);
  const c1 = Buffer.alloc(8); c1.writeUInt32LE(js.length, 0); c1.write('JSON', 4, 'latin1');
  const c2 = Buffer.alloc(8); c2.writeUInt32LE(bn.length, 0); c2.write('BIN\0', 4, 'latin1');
  const p = join(DIR, name); writeFileSync(p, Buffer.concat([header, c1, js, c2, bn])); return p;
}
const failed = r => r.checks.filter(c => c.level === 'error').map(c => c.id);
const warned = r => r.checks.filter(c => c.level === 'warn').map(c => c.id);

test('1. 条件どおりの GLB は合格（全高・足裏・三角形・SHA-256 を読める）', () => {
  const p = glb('ok.glb');
  const r = inspect(p);
  assert.deepEqual(failed(r), []);
  assert.deepEqual(warned(r), []);
  assert.equal(r.facts.triangles, 100);
  assert.equal(r.facts.height, 1);
  assert.equal(r.facts.sole_y, 0);
  assert.equal(r.facts.sha256, createHash('sha256').update(readFileSync(p)).digest('hex'));
  assert.deepEqual(r.facts.parts_missing, []);
});

test('2. 形式：glTF でない・version 2 でない・ファイルが無い', () => {
  assert.ok(failed(inspect(glb('magic.glb', { magic: 'xxxx' }))).includes('magic_glTF'));
  assert.ok(failed(inspect(glb('v1.glb', { version: 1 }))).includes('version_2'));
  assert.ok(failed(inspect(join(DIR, 'none.glb'))).includes('file_exists'));
});

test('3. 外部 URI・カメラは不合格', () => {
  assert.ok(failed(inspect(glb('uri.glb', { uri: true }))).includes('no_external_uri'));
  assert.ok(failed(inspect(glb('cam.glb', { camera: true }))).includes('no_camera'));
});

test('4. 三角形：25,000 を超えると注意、40,000 を超えると不合格', () => {
  const a = inspect(glb('t30k.glb', { tris: 30000 }));
  assert.ok(warned(a).includes('triangles_target')); assert.ok(!failed(a).includes('triangles_max'));
  assert.ok(failed(inspect(glb('t41k.glb', { tris: 41000 }))).includes('triangles_max'));
  assert.equal(LIMITS.triangles_target, 25000); assert.equal(LIMITS.triangles_max, 40000);
});

test('5. 大きさ：全高が約1.0でない・足裏が Y=0 でない・左右の中心がずれている', () => {
  assert.ok(failed(inspect(glb('tall.glb', { height: 1.6 }))).includes('height_about_1'));
  assert.ok(failed(inspect(glb('float.glb', { sole: .3 }))).includes('sole_at_y0'));
  assert.ok(warned(inspect(glb('off.glb', { x: .3 }))).includes('center_x0'));
});

test('6. 禁止の部位（尻尾・腕・手・耳など）の名前と、個人のパスらしい文字列は不合格', () => {
  assert.ok(failed(inspect(glb('tail.glb', { names: [...EXPECTED_PARTS, 'Tail'] }))).includes('no_forbidden_parts'));
  assert.ok(failed(inspect(glb('ear.glb', { names: [...EXPECTED_PARTS, 'Ear_L'] }))).includes('no_forbidden_parts'));
  assert.ok(failed(inspect(glb('path.glb', { names: [...EXPECTED_PARTS, 'C:\\Users\\someone\\hirori'] }))).includes('no_private_path'));
  // 「Armature」「Earth」は禁止の名前ではない
  assert.ok(!failed(inspect(glb('armature.glb', { names: [...EXPECTED_PARTS, 'Armature'] }))).includes('no_forbidden_parts'));
});

test('7. 部位の名前が足りないときは注意（manifest の対応表でもよいため、不合格にはしない）。マテリアルは8まで', () => {
  const r = inspect(glb('parts.glb', { names: ['Root', 'Body'] }));
  assert.ok(warned(r).includes('parts_named')); assert.ok(!failed(r).includes('parts_named'));
  assert.ok(failed(inspect(glb('mat.glb', { materials: 9 }))).includes('materials_max'));
});

test('8. 検査はファイルを書きかえない（前後で SHA-256 が同じ）。コマンドの終了コードは合格0・不合格1', () => {
  const p = glb('cli.glb'); const before = createHash('sha256').update(readFileSync(p)).digest('hex');
  const ok = spawnSync(process.execPath, [join(REPO, 'tools', 'validate-hirori-v3.mjs'), p], { encoding: 'utf8' });
  assert.equal(ok.status, 0, ok.stdout);
  assert.equal(createHash('sha256').update(readFileSync(p)).digest('hex'), before);
  const bad = spawnSync(process.execPath, [join(REPO, 'tools', 'validate-hirori-v3.mjs'), glb('bad.glb', { camera: true })], { encoding: 'utf8' });
  assert.equal(bad.status, 1);
  const src = readFileSync(join(REPO, 'tools', 'validate-hirori-v3.mjs'), 'utf8');
  assert.ok(!/writeFileSync|appendFileSync|unlinkSync|rmSync|fetch\(|https?:\/\//.test(src.replace(/\/\/.*$/gm, '')), 'read-only, no network');
});

// ── Step 11K-B：Field（探索用の低ポリ）と Event（重要な場面の精巧な表現）の2つの基準 ──
const CLI = (...a) => spawnSync(process.execPath, [join(REPO, 'tools', 'validate-hirori-v3.mjs'), ...a], { encoding: 'utf8' });

test('9. 基準の数値：field は 2,000〜5,000 目標・8,000 上限、event は 25,000 目標・40,000 上限。指定しないときは event', () => {
  assert.deepEqual([PROFILES.field.triangles_min_target, PROFILES.field.triangles_target, PROFILES.field.triangles_max], [2000, 5000, 8000]);
  assert.deepEqual([PROFILES.event.triangles_target, PROFILES.event.triangles_max], [25000, 40000]);
  const p = glb('prof-9000.glb', { tris: 9000 });
  assert.equal(inspect(p).profile, 'event');
  assert.deepEqual(failed(inspect(p)), []);
  assert.deepEqual(failed(inspect(p, { profile: 'event' })), []);
  assert.deepEqual(failed(inspect(p, { profile: 'field' })), ['triangles_max']);
  assert.throws(() => inspect(p, { profile: 'bogus' }));
});

test('10. field：3,000 は合格、1,000 は少なすぎて注意（不合格ではない）、8,000 ちょうどは合格で目標こえの注意', () => {
  const r3 = inspect(glb('f3000.glb', { tris: 3000 }), { profile: 'field' });
  assert.deepEqual(failed(r3), []); assert.deepEqual(warned(r3), []);
  const r1 = inspect(glb('f1000.glb', { tris: 1000 }), { profile: 'field' });
  assert.deepEqual(failed(r1), []); assert.deepEqual(warned(r1), ['triangles_target']);
  const r8 = inspect(glb('f8000.glb', { tris: 8000 }), { profile: 'field' });
  assert.deepEqual(failed(r8), []); assert.deepEqual(warned(r8), ['triangles_target']);
});

test('11. コマンド：--profile field|event を前にも後ろにも書ける。知らない基準・ファイルなしは終了コード2', () => {
  const p = glb('cli-9000.glb', { tris: 9000 });
  assert.equal(CLI('--profile', 'event', p).status, 0);
  assert.equal(CLI(p, '--profile', 'event').status, 0);
  const f = CLI('--profile', 'field', p);
  assert.equal(f.status, 1); assert.match(f.stdout, /Field（探索用の低ポリ）：上限 8000/);
  assert.equal(CLI(p, '--profile', 'field').status, 1);
  assert.equal(CLI('--profile', 'bogus', p).status, 2);
  assert.equal(CLI('--profile', 'field').status, 2);
  assert.equal(CLI(p).status, 0);
});

test('12. 設計書と仕様書の数値・コマンドが、検査ツールの基準と同じ', () => {
  const art = readFileSync(join(REPO, 'docs', 'HIRORI_FIELD_AND_EVENT_ART_DIRECTION.md'), 'utf8');
  const spec = readFileSync(join(REPO, 'docs', 'HIRORI_V3_EXTERNAL_MODEL_SPEC.md'), 'utf8');
  const fmt = n => n.toLocaleString('en-US');
  for (const doc of [art, spec]) {
    assert.ok(doc.includes('node tools/validate-hirori-v3.mjs --profile field <ファイル.glb>'));
    assert.ok(doc.includes('node tools/validate-hirori-v3.mjs --profile event <ファイル.glb>'));
    assert.ok(doc.includes(`${fmt(PROFILES.field.triangles_min_target)}〜${fmt(PROFILES.field.triangles_target)}`));
    assert.ok(doc.includes(fmt(PROFILES.field.triangles_max)) && doc.includes(fmt(PROFILES.event.triangles_max)) && doc.includes(fmt(PROFILES.event.triangles_target)));
  }
  // 5つの場面・読み込み失敗・reduced-motion を書いてある
  for (const s of ['ことばのタネ誕生', 'タネ取得', '根の門開放', 'ことばの樹点灯', '冒険完了', '読み込みに失敗したとき', 'reduced-motion']) assert.ok(art.includes(s), s);
});
