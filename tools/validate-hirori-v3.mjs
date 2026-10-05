#!/usr/bin/env node
// 外部で作ったヒロリV3（GLB）を受け入れる前の検査。ファイルは読むだけで、書きかえない。通信もしない
// 使い方: node tools/validate-hirori-v3.mjs [--profile field|event] <ファイル.glb> [--json]
//   field：探索用の低ポリヒロリ（三角形 2,000〜5,000 目標・8,000 上限）
//   event：重要な場面の精巧なヒロリ（三角形 25,000 目標・40,000 上限）。--profile を付けないときは event
// 結果: 合格（終了コード0）／不合格（1）／ファイルが読めない（2）。利用規約・ライセンスの確認は、この検査に含まない（人が確かめる）
import { readFileSync, statSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

// docs/HIRORI_V3_EXTERNAL_MODEL_SPEC.md の「GLB の条件」と同じ数値
export const LIMITS = {
  triangles_target: 25000, triangles_max: 40000,   // event（既定）の値。field は PROFILES で上書きする
  bytes_target: 3 * 1024 * 1024, bytes_max: 8 * 1024 * 1024,
  materials_max: 8,
  height_min: 0.9, height_max: 1.1,          // 全高 約1.0（とさかの先まで）
  sole_tolerance: 0.02,                      // 足裏は Y=0（±2cm）
  center_tolerance: 0.05,                    // 左右の中心は X=0（±5cm）
};
// docs/HIRORI_FIELD_AND_EVENT_ART_DIRECTION.md の「三角形の数」と同じ数値
export const PROFILES = {
  field: { label: 'Field（探索用の低ポリ）', triangles_min_target: 2000, triangles_target: 5000, triangles_max: 8000 },
  event: { label: 'Event（重要な場面の精巧な表現）', triangles_min_target: 0, triangles_target: LIMITS.triangles_target, triangles_max: LIMITS.triangles_max },
};
const FORBIDDEN_NAMES = /tail|arm(?!ature)|hand|finger|claw|ear(?!th)|horn|nose|尻尾|腕|手|指|爪|耳|角|鼻/i;
const UNNEEDED_NAMES = /^(camera|light|lamp|sun|plane|cube|empty|backdrop|ground|floor)(\.\d+)?$/i;
const PRIVATE_PATTERNS = [/[A-Za-z]:[\\/]+Users[\\/]/, /\/Users\/[^/]+\//, /\/home\/[^/]+\//, /OneDrive/i, /Desktop[\\/]/i];
export const EXPECTED_PARTS = ['Root', 'Body', 'Head', 'Wing_L', 'Wing_R', 'Leg_L', 'Leg_R', 'Foot_L', 'Foot_R', 'Crest_01', 'Crest_02', 'Crest_03', 'Crest_04', 'Eye_L', 'Eye_R'];

const COMPONENT = { 5120: [Int8Array, 1], 5121: [Uint8Array, 1], 5122: [Int16Array, 2], 5123: [Uint16Array, 2], 5125: [Uint32Array, 4], 5126: [Float32Array, 4] };
const NCOMP = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

function mat4mul(a, b) { const o = new Array(16).fill(0); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++) o[j * 4 + i] += a[k * 4 + i] * b[j * 4 + k]; return o; }
function nodeMatrix(n) {
  if (n.matrix) return n.matrix.slice();
  const [tx, ty, tz] = n.translation || [0, 0, 0], [x, y, z, w] = n.rotation || [0, 0, 0, 1], [sx, sy, sz] = n.scale || [1, 1, 1];
  return [(1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0,
    2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0,
    2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0, tx, ty, tz, 1];
}

export function inspect(path, { profile = 'event' } = {}) {
  const P = PROFILES[profile];
  if (!P) throw new Error(`知らない profile: ${profile}（field か event）`);
  const out = { file: path, profile, checks: [], facts: {} };
  const add = (id, ok, detail, level = 'error') => out.checks.push({ id, ok, level: ok ? 'ok' : level, detail });
  if (!existsSync(path)) { add('file_exists', false, 'ファイルがありません'); return out; }
  const buf = readFileSync(path);
  out.facts.bytes = statSync(path).size;
  out.facts.sha256 = createHash('sha256').update(buf).digest('hex');
  add('file_exists', true, path);
  const magic = buf.toString('latin1', 0, 4), version = buf.readUInt32LE(4);
  add('magic_glTF', magic === 'glTF', `先頭: ${JSON.stringify(magic)}`);
  add('version_2', version === 2, `version: ${version}`);
  if (magic !== 'glTF' || version !== 2) return out;
  add('size_target', out.facts.bytes <= LIMITS.bytes_target, `${out.facts.bytes} bytes（目標 ${LIMITS.bytes_target} 以下）`, 'warn');
  add('size_max', out.facts.bytes <= LIMITS.bytes_max, `${out.facts.bytes} bytes（上限 ${LIMITS.bytes_max}）`);
  // チャンク
  let off = 12, json = null, bin = null;
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32LE(off), type = buf.toString('latin1', off + 4, off + 8);
    if (type === 'JSON') json = JSON.parse(buf.toString('utf8', off + 8, off + 8 + len));
    if (type === 'BIN\0') bin = buf.subarray(off + 8, off + 8 + len);
    off += 8 + len;
  }
  add('json_chunk', !!json, json ? 'JSON あり' : 'JSON チャンクがありません');
  if (!json) return out;
  const g = json;
  const n = k => (g[k] || []).length;
  Object.assign(out.facts, { meshes: n('meshes'), nodes: n('nodes'), materials: n('materials'), textures: n('textures'), images: n('images'),
    animations: n('animations'), skins: n('skins'), cameras: n('cameras'), lights: (g.extensions?.KHR_lights_punctual?.lights || []).length,
    extensionsUsed: g.extensionsUsed || [], generator: g.asset?.generator || '' });
  // 外部 URI（buffers・images）
  const uris = [...(g.buffers || []), ...(g.images || [])].filter(x => x.uri && !x.uri.startsWith('data:')).map(x => x.uri);
  add('no_external_uri', uris.length === 0, uris.length ? `外部 URI: ${uris.join(', ')}` : '外部 URI なし');
  add('materials_max', out.facts.materials <= LIMITS.materials_max, `マテリアル ${out.facts.materials}（上限 ${LIMITS.materials_max}）`);
  add('no_camera', out.facts.cameras === 0, `カメラ ${out.facts.cameras}`);
  add('no_light', out.facts.lights === 0, `ライト ${out.facts.lights}`);
  add('no_animation', out.facts.animations === 0, `アニメーション ${out.facts.animations}（初回の候補は静止モデル）`, 'warn');
  add('no_skin', out.facts.skins === 0, `スキン ${out.facts.skins}（初回の候補はリグなし）`, 'warn');
  add('textures_embedded', (g.images || []).every(im => im.bufferView !== undefined || (im.uri || '').startsWith('data:')), `テクスチャ ${out.facts.textures}・画像 ${out.facts.images}（GLB に埋め込み）`);
  // 三角形と、世界座標の大きさ
  const acc = g.accessors || [], bvs = g.bufferViews || [];
  const readAcc = i => {
    const a = acc[i], bv = bvs[a.bufferView]; if (!bv || !bin) return null;
    const [T, size] = COMPONENT[a.componentType], nc = NCOMP[a.type], stride = bv.byteStride || size * nc;
    const base = (bv.byteOffset || 0) + (a.byteOffset || 0), res = new Float64Array(a.count * nc);
    const dv = new DataView(bin.buffer, bin.byteOffset);
    for (let k = 0; k < a.count; k++) for (let c = 0; c < nc; c++) {
      const p = base + k * stride + c * size;
      res[k * nc + c] = a.componentType === 5126 ? dv.getFloat32(p, true) : a.componentType === 5125 ? dv.getUint32(p, true) : a.componentType === 5123 ? dv.getUint16(p, true) : a.componentType === 5121 ? dv.getUint8(p) : a.componentType === 5122 ? dv.getInt16(p, true) : dv.getInt8(p);
    }
    return res;
  };
  let tris = 0; const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  const visit = (ni, parent) => {
    const node = g.nodes[ni], m = mat4mul(parent, nodeMatrix(node));
    if (node.mesh !== undefined) {
      for (const p of g.meshes[node.mesh].primitives) {
        const mode = p.mode ?? 4, cnt = p.indices !== undefined ? acc[p.indices].count : acc[p.attributes.POSITION].count;
        if (mode === 4) tris += Math.floor(cnt / 3); else if (mode === 5 || mode === 6) tris += Math.max(0, cnt - 2);
        const pos = readAcc(p.attributes.POSITION);
        if (pos) for (let k = 0; k < pos.length; k += 3) {
          const x = pos[k], y = pos[k + 1], z = pos[k + 2];
          const w = [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];
          for (let c = 0; c < 3; c++) { min[c] = Math.min(min[c], w[c]); max[c] = Math.max(max[c], w[c]); }
        }
      }
    }
    for (const c of node.children || []) visit(c, m);
  };
  const scene = g.scenes?.[g.scene ?? 0];
  for (const r of scene?.nodes || []) visit(r, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  out.facts.triangles = tris;
  out.facts.bbox = { min: min.map(v => +v.toFixed(4)), max: max.map(v => +v.toFixed(4)) };
  out.facts.height = +(max[1] - min[1]).toFixed(4);
  out.facts.sole_y = +min[1].toFixed(4);
  out.facts.center_x = +((min[0] + max[0]) / 2).toFixed(4);
  add('triangles_target', tris >= P.triangles_min_target && tris <= P.triangles_target,
    `三角形 ${tris}（${P.label}：目標 ${P.triangles_min_target ? P.triangles_min_target + '〜' : ''}${P.triangles_target}${P.triangles_min_target ? '' : ' 以下'}）`, 'warn');
  add('triangles_max', tris <= P.triangles_max, `三角形 ${tris}（${P.label}：上限 ${P.triangles_max}）`);
  add('height_about_1', out.facts.height >= LIMITS.height_min && out.facts.height <= LIMITS.height_max, `全高 ${out.facts.height}（${LIMITS.height_min}〜${LIMITS.height_max}）`);
  add('sole_at_y0', Math.abs(out.facts.sole_y) <= LIMITS.sole_tolerance, `足裏の高さ ${out.facts.sole_y}（Y=0 ±${LIMITS.sole_tolerance}）`);
  add('center_x0', Math.abs(out.facts.center_x) <= LIMITS.center_tolerance, `左右の中心 ${out.facts.center_x}（X=0 ±${LIMITS.center_tolerance}）`, 'warn');
  // 名前：禁止の部位・要らないノード・部位の対応
  const names = [...(g.nodes || []).map(x => x.name || ''), ...(g.meshes || []).map(x => x.name || ''), ...(g.materials || []).map(x => x.name || '')];
  const forbidden = names.filter(s => FORBIDDEN_NAMES.test(s));
  add('no_forbidden_parts', forbidden.length === 0, forbidden.length ? `禁止の部位らしい名前: ${forbidden.join(', ')}` : '尻尾・腕・手・指・爪・耳・角・鼻の名前なし');
  const unneeded = (g.nodes || []).map(x => x.name || '').filter(s => UNNEEDED_NAMES.test(s));
  add('no_unneeded_nodes', unneeded.length === 0, unneeded.length ? `要らないノード: ${unneeded.join(', ')}` : '要らないノードなし', 'warn');
  const nodeNames = (g.nodes || []).map(x => x.name || '');
  const found = EXPECTED_PARTS.filter(p => nodeNames.some(s => s === p || s.endsWith('_' + p) || s === 'Hirori_' + p));
  out.facts.parts_found = found; out.facts.parts_missing = EXPECTED_PARTS.filter(p => !found.includes(p));
  add('parts_named', out.facts.parts_missing.length === 0, out.facts.parts_missing.length ? `名前が見つからない部位: ${out.facts.parts_missing.join(', ')}（manifest の対応表でもよい）` : 'すべての部位の名前あり', 'warn');
  // 個人のパスらしい文字列（JSON とバイナリの両方）
  const text = buf.toString('latin1');
  const priv = PRIVATE_PATTERNS.filter(re => re.test(text)).map(String);
  add('no_private_path', priv.length === 0, priv.length ? `個人のパスらしい文字列: ${priv.join(', ')}` : '個人のパスらしい文字列なし');
  return out;
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop());
if (isMain) {
  const args = process.argv.slice(2), USAGE = '使い方: node tools/validate-hirori-v3.mjs [--profile field|event] <ファイル.glb> [--json]';
  const pi = args.indexOf('--profile'), profile = pi >= 0 ? args[pi + 1] : 'event';
  const file = args.find((a, i) => !a.startsWith('--') && !(pi >= 0 && i === pi + 1));
  if (!file || !PROFILES[profile]) { console.error(USAGE); process.exit(2); }
  let r;
  try { r = inspect(file, { profile }); } catch (e) { console.error('読めませんでした: ' + e.message); process.exit(2); }
  const errors = r.checks.filter(c => c.level === 'error'), warns = r.checks.filter(c => c.level === 'warn');
  if (process.argv.includes('--json')) console.log(JSON.stringify({ ...r, pass: errors.length === 0 }, null, 2));
  else {
    console.log(`ヒロリV3 受け入れ検査: ${file}（${PROFILES[profile].label}）`);
    for (const c of r.checks) console.log(`  ${c.level === 'ok' ? '合格' : c.level === 'warn' ? '注意' : '不合格'}  ${c.id}  ${c.detail}`);
    console.log(`  SHA-256 ${r.facts.sha256 || '-'}`);
    console.log(errors.length === 0 ? `結果: 合格（注意 ${warns.length} 件）` : `結果: 不合格 ${errors.length} 件（注意 ${warns.length} 件）`);
    console.log('※ 利用規約・ライセンス・権利の確認は、この検査に含まれません（人が確かめる）');
  }
  process.exit(errors.length === 0 ? 0 : 1);
}
