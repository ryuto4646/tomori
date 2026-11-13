// TOWN-01：市場町のテスト。ブラウザも通信も使わない
// 道・広場・家の重なり、道すじ、お手伝いの進み方、コイン・お店・花壇、保存の読みもどし、つなぎ目を確かめる
// 実行: node --test test-town.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { revertTown } from './world-art-baseline.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const HTML = readFileSync(join(ROOT, 'demo-world.html'), 'utf8').replace(/\r\n/g, '\n');
const between = (s, a, b) => { const i = s.indexOf(a), j = s.indexOf(b, i + 1); assert.ok(i >= 0 && j > i, `markers ${a} / ${b}`); return s.slice(i, j); };
const code = s => s.split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n');
const TERRAIN = between(HTML, '// TERRAIN-BEGIN', '// TERRAIN-END');
const ADV = between(HTML, '// ADVENTURE-BEGIN', '// ADVENTURE-END');
const LAYOUT = between(HTML, '// TOWN-LAYOUT-BEGIN', '// TOWN-LAYOUT-END');
const CORE = between(HTML, '// TOWN-CORE-BEGIN', '// TOWN-CORE-END');
const UI = between(HTML, '// TOWN-BEGIN', '// TOWN-END');
const W = new Function(TERRAIN + ADV + '\nreturn { TOWN, townShapeSd, townObstacleAt, inTownWalk, townFlat, townBlocks, steerTown, townPath, inWalk, clampWalk, heightAt, WALK, inTownArea };')();
const C = new Function(CORE + `
return { TOWN_SAVE_KEY, TOWN_REWARD, TOWN_POTS, TOWN_POT_RIGHT, TOWN_GARDENS, TOWN_GARDEN_RIGHT, TOWN_HINTS, TOWN_SEEDS, TOWN_SEED_IDS, TOWN_TEXT,
  createTownState, townAccept, townPickPot, townDeliver, townMoreHint, townHintGoal, townBuy, townPlant, townStarted, townMemo, restoreTown };`)();
const L = W.TOWN;
const rect = (h, n = 6) => {
  const [x, z, fx, fz, w, d] = h, yaw = Math.atan2(fx - x, fz - z), c = Math.cos(yaw), s = Math.sin(yaw), out = [];
  for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) { const lx = (i / n - .5) * w, lz = (j / n - .5) * d; out.push([x + lx * c + lz * s, z - lx * s + lz * c]); }
  return out;
};

test('1. 家は道・広場から 0.25m 以上はなれ、家どうしも重ならない。屋台・噴水・花壇は広場の中', () => {
  assert.ok(L.houses.length >= 12 && L.houses.length <= 20, 'houses');
  for (const h of L.houses) assert.ok(Math.min(...rect(h).map(([x, z]) => W.townShapeSd(x, z))) >= .25, h[6]);
  L.houses.forEach((h, k) => L.houses.forEach((g, j) => {
    if (j <= k) return;
    const yaw = Math.atan2(g[2] - g[0], g[3] - g[1]), c = Math.cos(yaw), s = Math.sin(yaw);
    assert.ok(!rect(h).some(([x, z]) => { const dx = x - g[0], dz = z - g[1]; return Math.abs(dx * c - dz * s) < g[4] / 2 + .3 && Math.abs(dx * s + dz * c) < g[5] / 2 + .3; }), h[6] + ' / ' + g[6]);
  }));
  for (const [x, z, r, name] of L.obstacles) assert.ok(W.townShapeSd(x, z) <= -r + .01 || name === 'bench', name);
  // 4つの屋台・噴水・花壇・ベンチ。名前は決まったもの
  assert.deepEqual(L.obstacles.map(o => o[3]), ['fountain', 'florist', 'seeds', 'bread', 'cloth', 'bed', 'bench']);
});

test('2. 道幅：大通り 5.2m・路地 4m 以上。6.6m/秒で曲がれるよう、曲がり角はゆるい（45°以下）', () => {
  assert.ok(L.roadR * 2 >= 5.2);
  for (const l of L.lanes) assert.ok(l.r * 2 >= 4, l.id);
  const pts = [L.road, ...L.lanes.map(l => [[L.plaza.x, L.plaza.z], ...l.pts])];
  for (const p of pts) for (let i = 1; i < p.length - 1; i++) {
    const a = Math.atan2(p[i][1] - p[i - 1][1], p[i][0] - p[i - 1][0]), b = Math.atan2(p[i + 1][1] - p[i][1], p[i + 1][0] - p[i][0]);
    assert.ok(Math.abs(Math.atan2(Math.sin(b - a), Math.cos(b - a))) <= Math.PI / 4 + .01, 'turn at ' + p[i]);
  }
});

test('3. 歩ける：草原・街の道・広場は歩ける。噴水・屋台・家の中は歩けない。外の点は、いちばん近いふちへもどす', () => {
  assert.ok(W.inWalk(L.road[2][0], L.road[2][1], false), 'road');
  assert.ok(W.inWalk(L.plaza.x + 4, L.plaza.z, false), 'plaza');
  for (const c of L.courts) assert.ok(W.inWalk(c.x, c.z, false), c.id);
  for (const [x, z, , name] of L.obstacles) if (name !== 'bench') assert.ok(!W.inWalk(x, z, false), name);
  for (const h of L.houses) assert.ok(!W.inWalk(h[0], h[1], false), h[6]);
  // 噴水の中をタップしても、噴水のふちへ
  const p = W.clampWalk({ x: L.plaza.x + .3, z: L.plaza.z }, false, .97);
  assert.ok(Math.hypot(p.x - L.plaza.x, p.z - L.plaza.z) >= 2.1 - 1e-6);
  // 家の中の点は、家の前の道へ（家の中には止まらない）
  for (const h of L.houses) { const q = W.clampWalk({ x: h[0], z: h[1] }, false, .97); assert.ok(W.inWalk(q.x, q.z, false), h[6]); }
});

test('4. 道すじ：草原・街のどの場所からどの場所へも、家・噴水・屋台にぶつからずに着ける（見通せる点をたどる）', () => {
  const places = [[20, -6], [L.gate.x, L.gate.z], [L.plaza.x - 5, L.plaza.z], [L.plaza.x + 4.6, L.plaza.z + 1.5], ...L.courts.map(c => [c.x, c.z]), [L.plaza.x, L.plaza.z - 4.2]];
  const free = (x, z) => (Math.hypot((x - 6) / 30, (z + 7) / 19) <= 1 || W.townShapeSd(x, z) <= 0) && W.townObstacleAt(x, z) < 0;
  for (const a of places) for (const b of places) {
    if (a === b) continue;
    const path = W.townPath(a[0], a[1], b[0], b[1]);
    assert.ok(path, `path ${a} → ${b}`);
    for (let i = 0; i < path.length - 1; i++) {
      const [ax, az] = path[i], [bx, bz] = path[i + 1], n = Math.ceil(Math.hypot(bx - ax, bz - az) / .25);
      for (let k = 0; k <= n; k++) assert.ok(free(ax + (bx - ax) * k / n, az + (bz - az) * k / n), `blocked ${a} → ${b}`);
    }
  }
  // 草原の中だけ・秘密の道や巨木への道は、街の道すじを使わない
  const out = { x: 0, z: 0 };
  assert.equal(W.steerTown(0, 0, -10, -10, out), false);
  assert.equal(W.steerTown(L.plaza.x - 5, L.plaza.z, -30, -45, out), false, 'great route: leave it to steerGreat');
});

test('5. 地面：街は平ら。草原の中の高さは変えない（草原のふちから外で、だんだん平らに）', () => {
  for (const [x, z] of [[L.plaza.x, L.plaza.z], ...L.courts.map(c => [c.x, c.z]), ...L.houses.map(h => [h[0], h[1]])]) assert.ok(Math.abs(W.heightAt(x, z)) < .02, `${x},${z}`);
  for (const [x, z] of [[0, 0], [-10, -6], [20, 4], [10, -14]]) assert.equal(W.townFlat(x, z), 0);
  // 草木・岩は、街の道と家のまわりに置かない（草原の中は今までどおり）
  assert.ok(W.townBlocks(L.plaza.x, L.plaza.z) && !W.townBlocks(0, 0) && !W.townBlocks(20, -6));
});

test('6. お手伝い：引き受ける → 鉢をえらぶ（まちがえても罰はなく、ちがいがわかるひとこと）→ 届ける。順番を飛ばせない', () => {
  const st = C.createTownState();
  assert.equal(C.townPickPot(st, 'nod'), null, 'not accepted yet');
  assert.equal(C.townDeliver(st, 'sun').kind, 'early');
  assert.ok(C.townAccept(st)); assert.ok(!C.townAccept(st));
  for (const p of C.TOWN_POTS.filter(p => p.id !== C.TOWN_POT_RIGHT)) { const r = C.townPickPot(st, p.id); assert.equal(r.kind, 'wrong'); assert.ok(r.reply.length > 8); assert.equal(st.errand, 'flower'); }
  assert.equal(C.townDeliver(st, 'sun').kind, 'early', 'cannot deliver before choosing');
  assert.equal(C.townPickPot(st, C.TOWN_POT_RIGHT).kind, 'right'); assert.equal(st.errand, 'deliver');
  for (const g of Object.keys(C.TOWN_GARDENS).filter(g => g !== C.TOWN_GARDEN_RIGHT)) { const r = C.townDeliver(st, g); assert.equal(r.kind, 'wrong'); assert.ok(r.reply.length > 8); }
  assert.equal(st.coins, 0, 'no penalty, no reward for wrong houses');
  const r = C.townDeliver(st, C.TOWN_GARDEN_RIGHT);
  assert.deepEqual(r, { kind: 'done', reward: C.TOWN_REWARD }); assert.equal(st.coins, C.TOWN_REWARD);
  // 二度目はもらえない（連打・読み込みなおしでも）
  assert.equal(C.townDeliver(st, C.TOWN_GARDEN_RIGHT).kind, 'after'); assert.equal(st.coins, C.TOWN_REWARD);
  const back = C.restoreTown(JSON.parse(JSON.stringify(st)));
  assert.equal(back.coins, C.TOWN_REWARD); assert.equal(C.townDeliver(back, 'sun').kind, 'after'); assert.equal(back.coins, C.TOWN_REWARD);
});

test('7. 手がかり：色ではなく向きで決まる（鉢の色は同じ）。ヒントは押すたびにくわしく（3つまで）。正解はデータだけで決まる', () => {
  const pot = between(UI, '  function potMesh(kind) {', '  function numberSign(');
  assert.match(pot, /const petal = 0xf6c2cc, heart = 0xffe08a;/);
  assert.ok(!/kind === 'nod' \? 0x/.test(pot), 'the right pot is not a different color');
  const st = C.createTownState(); C.townAccept(st);
  assert.equal(C.townHintGoal(st), 'flower');
  assert.deepEqual([1, 2, 3, 0].map(() => C.townMoreHint(st)), [1, 2, 3, 0]);
  C.townPickPot(st, 'nod'); assert.equal(C.townHintGoal(st), 'house'); assert.equal(C.townMoreHint(st), 1);
  for (const h of Object.values(C.TOWN_HINTS)) assert.equal(h.length, 3);
  assert.ok(!/fetch\(|EXPAND_API|VOCABULARY_API/.test(CORE + UI), 'no AI or network in the town');
});

test('8. コインとお店：足りるときだけ買える。残高はマイナスにならない。同じタネは1つまで。「今は買わない」を選べる', () => {
  const st = C.createTownState();
  assert.deepEqual(C.townBuy(st, 'sun'), { ok: false, reason: 'coins' }); assert.equal(st.coins, 0);
  st.errand = 'done'; st.rewarded = true; st.coins = 10;
  assert.deepEqual(C.townBuy(st, 'bell'), { ok: true, left: 2 });
  assert.deepEqual(C.townBuy(st, 'bell'), { ok: false, reason: 'owned' });
  assert.deepEqual(C.townBuy(st, 'sun'), { ok: false, reason: 'coins' }); assert.equal(st.coins, 2);
  assert.deepEqual(C.townBuy(st, 'nope'), { ok: false, reason: 'none' });
  assert.equal(C.TOWN_SEEDS.sun.price, 5); assert.equal(C.TOWN_SEEDS.bell.price, 8); assert.equal(C.TOWN_REWARD, 10);
  // 植える：持っているタネだけ。一度植えたら、もう使えない
  assert.ok(!C.townPlant(st, 'sun')); assert.ok(C.townPlant(st, 'bell')); assert.ok(!C.townPlant(st, 'bell'));
  assert.equal(st.seeds.bell, 'planted');
  // お店のパネル：閉じるボタンは「今は買わない」。買う・買わないに正解の印をつけない
  assert.match(UI, /closeLabel: '今は買わない'/);
  assert.ok(!/正解|不正解|えらい|すごい|損|得した/.test(code(between(UI, '  function seedCard(c) {', '  // 育った姿の絵'))));
  // 買ったあとの残高を、買う前に見せる。育った姿は押したときだけ
  assert.match(UI, /'買ったあと：のこり ' \+ \(st\.coins - s\.price\) \+ 'コイン'/);
  assert.match(UI, /gb\.textContent = '育った姿を見る';/);
});

test('9. 保存：別のキー（本番と開発版で分ける）。こわれた・手で書きかえた記録でも、残高は「お礼 − 買ったタネ」のまま', () => {
  assert.equal(C.TOWN_SAVE_KEY, 'tomori-town-v1');
  assert.match(UI, /const SAVE_KEY = TOWN_SAVE_KEY \+ \(\/preview\/i\.test\(location\.pathname\) \? '-preview' : ''\);/);
  for (const m of code(UI).matchAll(/localStorage\.\w+\(/g)) assert.match(code(UI).slice(Math.max(0, m.index - 40), m.index), /try \{ (const s = )?$/, 'inside try');
  for (const raw of [null, 7, 'x', [], { v: 2 }, {}]) assert.deepEqual(C.restoreTown(raw), C.createTownState());
  assert.deepEqual(C.restoreTown({ v: 1, errand: 'flower', coins: 99 }).coins, 0, 'no coins before the reward');
  const r = C.restoreTown({ v: 1, errand: 'done', coins: 999, seeds: { sun: 'planted', bell: 'owned' } });
  assert.equal(r.coins, 5, '10 - 5 (sun); bell could not have been bought too'); assert.equal(r.seeds.sun, 'planted'); assert.equal(r.seeds.bell, 'none');
  const r2 = C.restoreTown({ v: 1, errand: 'done', rewarded: true, coins: -3, seeds: { bell: 'owned' } });
  assert.equal(r2.coins, 2); assert.equal(r2.seeds.bell, 'owned');
  assert.equal(C.restoreTown({ v: 1, errand: 'weird' }).errand, 'none');
  assert.equal(C.restoreTown({ v: 1, errand: 'flower', hint: { flower: 9, house: 2 } }).hint.flower, 3);
  assert.equal(C.restoreTown({ v: 1, errand: 'flower', hint: { flower: 9, house: 2 } }).hint.house, 0);
});

test('10. 演出の前に保存：届ける・買う・植えるは、記録を変えて保存してから、音・コイン・花の演出', () => {
  const deliver = between(UI, '  function deliver(g) {', '  function rewardCard(');
  assert.ok(deliver.indexOf('save()') < deliver.indexOf('coinBurst('), 'save before the coin animation');
  const buy = between(UI, '  function buySeed(id) {', '  function plant(id) {');
  assert.ok(buy.indexOf('townBuy(') < buy.indexOf('save()') && buy.indexOf('save()') < buy.indexOf("sfx('coin')"));
  const plant = between(UI, '  function plant(id) {', '  function moreHint() {');
  assert.ok(plant.indexOf('townPlant(') < plant.indexOf('save()') && plant.indexOf('save()') < plant.indexOf('bed.grow[id] = 0'));
  // ボタンは、いまの会話の相手のときだけ効く（連打・閉じたあとの押しは何もしない）
  assert.match(deliver, /if \(state !== S\.TOWN \|\| !openId \|\| openId\.slice\(5\) !== g\) return;/);
  assert.match(buy, /if \(state !== S\.TOWN \|\| openId !== 'town:mole'\) return;/);
});

test('11. つなぎ目：近づいただけでは開かない（押したときだけ）。冒険メモ・もちもの・リセット・確認の文', () => {
  assert.match(HTML, /else if \(town && town\.has\(near\)\) town\.open\(near\); else if \(near\) open\(near\);/);
  assert.ok(!/town\.open\(|setState\(S\.TOWN\)/.test(between(UI, '  function update(t, dt) {', '  function projectAt(')), 'update never opens a panel');
  assert.match(HTML, /if \(town\) town\.reset\(\);/);
  assert.match(HTML, /市場町のお手伝い・コイン・買ったタネ・花壇も消えます。/);
  assert.match(between(UI, '  function reset() {', '\n  }\n'), /forget\(\); st = createTownState\(\);/);
  assert.match(HTML, /const list = treasureMemo\(st\)\.concat\(town \? town\.memo\(\) : \[\]\);/);
  assert.match(HTML, /if \(town\) rows\.push\(\.\.\.town\.items\(\)\);/);
  // 「着いた！」を出さない
  assert.ok(!/着いた/.test(code(CORE + UI)));
});

test('12. 描く重さ：家と屋台は1つの形（家ごとの番号で透かす）。新しい描画ループ・タイマー・点光源・外の素材なし', () => {
  const u = code(UI);
  assert.ok(!/requestAnimationFrame|setInterval|setTimeout\(/.test(u));
  assert.ok(!/PointLight|SpotLight|DirectionalLight/.test(u));
  assert.ok(!/innerHTML|insertAdjacentHTML|https?:/.test(u));
  assert.ok(!/GLTFLoader|FileLoader|TextureLoader/.test(u), 'no external assets yet');
  assert.match(u, /houseMesh = finish\(acc, fadeMat\(\), 'Town_Houses'\)/);
  assert.match(u, /uFade\[int\(aBid \+ \.5\)\]/);
  // 透かす：カメラとヒロリ（会話のときは相手も）のあいだの家だけ。透けている家はタップで選ばない
  assert.match(u, /\.find\(i => fadeCur\[bidOf\(i\)\] > \.9\)/);
});

test('13. 元へ戻せる：市場町を外すと、前の demo-world.html と同じ形（まとまりと短いつなぎ）', () => {
  const out = revertTown(HTML);
  assert.ok(!/TOWN-|town\b|市場町/.test(out.replace(/townhall/g, '')), 'nothing of the town remains');
});

test('14. カメラ：街の中だけ向きを回す（V2 のときだけ組み立てる）。街から出たら元の構図へもどす', () => {
  const u = code(UI);
  assert.match(u, /if \(built \|\| !worldV2\.isActive\(\)\) return;/);
  assert.match(u, /baseOff = CAM_OFF\.clone\(\);/);
  assert.match(u, /if \(vb > 0 \|\| camTurned\) \{/);
  assert.match(u, /CAM_OFF\.set\(baseOff\.x \* cs \+ baseOff\.z \* sn, baseOff\.y, -baseOff\.x \* sn \+ baseOff\.z \* cs\); camTurned = vb > 0;/);
  assert.match(u, /z > -20 \?/, 'not in the secret valley');
});
