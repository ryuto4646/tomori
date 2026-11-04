// 上から見た配置を、前と今で並べて SVG にする（同じ縮尺。場所は demo-world.html から読む）
// 実行: node tools/layout/compare-layout.mjs <前の demo-world.html> <今の demo-world.html> > docs/FLOW02_LAYOUT.svg
// 前のファイルは、たとえば git show 10c7248:demo-world.html > 前.html で作る
import { readFileSync } from 'node:fs';

const between = (s, a, b) => { const i = s.indexOf(a), j = s.indexOf(b, i + 1); if (i < 0 || j < 0) throw new Error(a); return s.slice(i, j); };
function read(file) {
  const h = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const core = between(h, '// TREASURE-CORE-BEGIN', '// TREASURE-CORE-END');
  const w = new Function(between(h, '  // TERRAIN-BEGIN', '  // TERRAIN-END') + between(h, '  // ADVENTURE-BEGIN', '  // ADVENTURE-END') + '\nreturn { WALK, GATE, WORD_TREE, SECRET_ROUTE, GREAT_ROUTE, GREAT };')();
  const spots = new Function(core + '\nreturn TREASURE_SPOTS;')();
  const mp = h.match(/const MISSION_POS = new THREE\.Vector3\(([-0-9.]+), 0, ([-0-9.]+)\);/).slice(1).map(Number);
  const trees = JSON.parse(h.match(/const TREE_SPOTS=(\[[\s\S]*?\n\]);/)[1].replace(/\s+/g, ''));
  const det = [...between(h, 'const DETOUR_DEFS = Object.freeze([', ']);').matchAll(/place: '([^']+)', x: ([-0-9.]+), z: ([-0-9.]+)/g)].map(m => ({ name: m[1], x: +m[2], z: +m[3] }));
  return { ...w, spots, mp, trees, det };
}
const A = read(process.argv[2]), B = read(process.argv[3]);
const S = 6, X0 = -58, X1 = 52, Z0 = -64, Z1 = 22, MW = (X1 - X0) * S, MH = (Z1 - Z0) * S, GAP = 24, W = MW * 2 + GAP, H = MH + 70;
const LABEL = { popo: 'ポポ', mina: 'ミナ', cat: 'ねこ', bell: '下を向く花', spring: '泉', chest: '宝箱', cave: 'ほらあな', rock: 'まるい岩', bloom: '空を向く花', dazzle: 'まばゆい花', gate: '石の門', giant: 'オオネ', plant: '途切れた道', cairn: 'うずまきの石' };
function map(D, ox, title) {
  const p = (x, z) => [+(ox + (x - X0) * S).toFixed(1), +(50 + (z - Z0) * S).toFixed(1)];
  const pl = pts => pts.map(q => p(q[0], q[1]).join(',')).join(' ');
  const o = [];
  o.push(`<text x="${ox + 8}" y="34" font-size="17" font-weight="bold">${title}</text>`);
  o.push(`<rect x="${ox}" y="50" width="${MW}" height="${MH}" fill="#eef5e6" stroke="#c9d8b8"/>`);
  for (let x = Math.ceil(X0 / 10) * 10; x <= X1; x += 10) { const [sx] = p(x, 0); o.push(`<line x1="${sx}" y1="50" x2="${sx}" y2="${50 + MH}" stroke="#000" stroke-opacity=".06"/>`); }
  for (let z = Math.ceil(Z0 / 10) * 10; z <= Z1; z += 10) { const [, sz] = p(0, z); o.push(`<line x1="${ox}" y1="${sz}" x2="${ox + MW}" y2="${sz}" stroke="#000" stroke-opacity=".06"/>`); }
  const [cx, cz] = p(D.WALK.cx, D.WALK.cz);
  o.push(`<ellipse cx="${cx}" cy="${cz}" rx="${D.WALK.rx * S}" ry="${D.WALK.rz * S}" fill="#d9ecc6" stroke="#9cc07c" stroke-dasharray="5 4"/>`);
  o.push(`<polyline points="${pl(D.GREAT.river)}" fill="none" stroke="#7fc0dd" stroke-width="${D.GREAT.riverW * S}" stroke-linecap="round" opacity=".7"/>`);
  o.push(`<polyline points="${pl([[0, 0], [D.mp[0], D.mp[1]], [D.GATE.x, D.GATE.z]])}" fill="none" stroke="#e2cf96" stroke-width="5" stroke-linecap="round"/>`);
  o.push(`<polyline points="${pl(D.SECRET_ROUTE)}" fill="none" stroke="#e2cf96" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`);
  o.push(`<polyline points="${pl(D.GREAT_ROUTE)}" fill="none" stroke="#e2cf96" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`);
  for (const [x, z] of D.trees) { const [sx, sz] = p(x, z); o.push(`<circle cx="${sx}" cy="${sz}" r="5" fill="#6f9e5c" opacity=".75"/>`); }
  const dot = (x, z, fill, r, lab) => { const [sx, sz] = p(x, z); o.push(`<circle cx="${sx}" cy="${sz}" r="${r}" fill="${fill}" stroke="#3a3328" stroke-width=".8"/>`); if (lab) o.push(`<text x="${sx + r + 2}" y="${sz + 4}" font-size="11">${lab}</text>`); };
  dot(0, 0, '#ffffff', 6, '出発点');
  dot(D.mp[0], D.mp[1], '#ffd75a', 6, '祠（写真のクエスト）');
  dot(D.GATE.x, D.GATE.z, '#b49a6a', 5, '根の門');
  dot(D.WORD_TREE.x, D.WORD_TREE.z, '#4f8a43', 9, 'ことばの樹');
  dot(D.GREAT.tree.x, D.GREAT.tree.z, '#4f8a43', 9, '巨木');
  for (const d of D.det) dot(d.x, d.z, '#f3b6c8', 4, '道くさ：' + d.name);
  for (const [id, s] of Object.entries(D.spots)) dot(s.x, s.z, '#f08a4b', 4.5, LABEL[id] || id);
  const [bx, by] = p(X1 - 12, Z1 - 3); o.push(`<line x1="${bx}" y1="${by}" x2="${bx + 10 * S}" y2="${by}" stroke="#3a3328" stroke-width="2"/><text x="${bx}" y="${by - 5}" font-size="11">10m</text>`);
  return o.join('\n');
}
const sum = D => { const ids = ['popo', 'cat', 'bell', 'spring', 'chest', 'cave']; let L = 0; for (let i = 1; i < ids.length; i++) L += Math.hypot(D.spots[ids[i]].x - D.spots[ids[i - 1]].x, D.spots[ids[i]].z - D.spots[ids[i - 1]].z); return L; };
process.stdout.write(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="sans-serif" fill="#3a3328">
<rect width="${W}" height="${H}" fill="#fff"/>
${map(A, 0, `前（歩く速さ 3.3m/秒）　宝さがしの道のり ${sum(A).toFixed(0)}m ＝ 約${(sum(A) / 3.3).toFixed(0)}秒`)}
${map(B, MW + GAP, `今（FLOW-02・6.6m/秒）　宝さがしの道のり ${sum(B).toFixed(0)}m ＝ 約${(sum(B) / 6.6).toFixed(0)}秒`)}
<text x="8" y="${H - 10}" font-size="11">同じ縮尺（1マス＝10m）。上が奥（-z）。点線のだ円は、はじめから歩ける草原。茶色の線は道。宝さがしの道のりは ポポ→ねこ→花→泉→宝箱→ほらあな。草原に足した木立・花は、ここには描いていない</text>
</svg>
`);
