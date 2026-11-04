// 巨木のある聖域の配置案（上から見た図）を、ゲームの座標（demo-world.html の GREAT）から SVG にする
// 実行: node tools/marble-check/make-layout-svg.mjs > docs/MARBLE_LAYOUT.svg
const G = {
  route: [[-7.6, -9.6], [-9.2, -12.6], [-10.8, -16.4], [-13.0, -20.0], [-16.4, -23.0], [-19.6, -25.4], [-24.2, -23.4], [-28.6, -22.0], [-31.6, -21.2]],
  gate: [-8.7, -10.9], tree: [-22.8, -28.9, 2.9], being: [-20.9, -27.3, 1.6], clearing: [-19.6, -25.4, 5.0], plant: [-23.6, -23.6], overlook: [-31.6, -21.2, 3.0],
  river: [[-23.7, -14.1], [-26.4, -22.7], [-29.1, -31.3]],
};
const S = 16, X0 = -36, Z0 = -34, MW = 32 * S, H = 28 * S, W = MW + 300;   // 地図：x -36〜-4、z -34〜-6（1m＝16px）。右に凡例
const px = ([x, z]) => [+((x - X0) * S).toFixed(1), +((z - Z0) * S).toFixed(1)];
const pts = a => a.map(p => px(p).join(',')).join(' ');
const c = (p, r, fill, op = 1) => { const [x, y] = px(p); return `<circle cx="${x}" cy="${y}" r="${r * S}" fill="${fill}" fill-opacity="${op}"/>`; };
const num = (p, n, dx = 0, dy = 0) => { const [x, y] = px(p); return `<circle cx="${x + dx}" cy="${y + dy}" r="10" fill="#fff" stroke="#3a3328"/><text x="${x + dx}" y="${y + dy + 4}" text-anchor="middle" font-weight="bold">${n}</text>`; };
const LEGEND = [
  ['1', '入口の古い石の門', 'かべの絵と同じもよう。足もとに、ほのかに光る花'],
  ['2', '巨木への道', '約25m。ほのかに灯る石・草花・光の粒'],
  ['3', '巨木', '幹の半径 約2.9m・高さ 約20m。洞が光る'],
  ['4', '大きな存在（オオネ）', '根もとで眠る。体の長さ 約4m'],
  ['5', '広場', '半径5m。会話の場所。光の筋が差し込む'],
  ['6', '種を植える場所', '途切れた道のはし'],
  ['7', '光のつるの橋', '川（幅 約2.4m）をまたぐ。約4.6m'],
  ['8', '向こう岸', '半径3m。南西の空に、次の目印の島'],
];
const out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="sans-serif" font-size="12" fill="#3a3328">
<rect width="${W}" height="${H}" fill="#fff"/><rect width="${MW}" height="${H}" fill="#eef5e6"/>
${Array.from({ length: 17 }, (_, i) => `<line x1="${i * 2 * S}" y1="0" x2="${i * 2 * S}" y2="${H}" stroke="#000" stroke-opacity=".05"/>`).join('')}
${Array.from({ length: 15 }, (_, i) => `<line x1="0" y1="${i * 2 * S}" x2="${MW}" y2="${i * 2 * S}" stroke="#000" stroke-opacity=".05"/>`).join('')}
<polyline points="${pts(G.river)}" fill="none" stroke="#67b4d6" stroke-width="${2.4 * S}" stroke-linecap="round"/>
${c(G.clearing, G.clearing[2], '#cfe8b0', .7)}${c(G.overlook, G.overlook[2], '#f6e6a8', .9)}
<polyline points="${pts(G.route.slice(0, 7))}" fill="none" stroke="#d9c79a" stroke-width="${1.5 * S}" stroke-linecap="round" stroke-linejoin="round"/>
<polyline points="${pts(G.route.slice(7))}" fill="none" stroke="#d9c79a" stroke-width="${1.5 * S}" stroke-linecap="round"/>
<polyline points="${pts(G.route.slice(6, 8))}" fill="none" stroke="#2e9a5c" stroke-width="${.9 * S}" stroke-dasharray="6 4"/>
${c(G.tree, G.tree[2], '#5f8f52')}${c(G.being, G.being[2], '#8b8272')}${c(G.gate, .5, '#9d978a')}${c(G.plant, .3, '#2e9a5c')}
${num(G.gate, 1, 16, 0)}${num(G.route[3], 2, 18, 0)}${num(G.tree, 3)}${num(G.being, 4)}${num(G.clearing, 5, 30, 20)}${num(G.plant, 6, 2, 18)}${num([-26.4, -22.7], 7, 0, -18)}${num(G.overlook, 8)}
<text x="8" y="${H - 8}" font-size="11">上が奥（-z）・左が西（-x）。1マス＝2m。座標は demo-world.html の GREAT と同じ</text>
<text x="${MW + 16}" y="26" font-size="15" font-weight="bold">巨木のある聖域：配置案</text>
${LEGEND.map(([n, a, b], i) => `<g transform="translate(${MW + 16},${52 + i * 46})"><circle cx="10" cy="0" r="10" fill="#fff" stroke="#3a3328"/><text x="10" y="4" text-anchor="middle" font-weight="bold">${n}</text><text x="28" y="4" font-weight="bold">${a}</text><text x="28" y="22" font-size="11" fill="#5a4830">${b}</text></g>`).join('\n')}
</svg>
`;
process.stdout.write(out);
