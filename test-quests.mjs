// Step 11M：第2クエスト・道くさ・見つけたもの のテスト。ブラウザも通信も使わない
// 進み方（QUEST-CORE-BEGIN〜END）を取り出して動かし、表示と通信（QUEST-UI）はコードの形を確かめる
// 実行: node --test test-quests.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = dirname(fileURLToPath(import.meta.url));
const HTML = readFileSync(join(ROOT, 'demo-world.html'), 'utf8').replace(/\r\n/g, '\n');
const between = (s, a, b) => { const i = s.indexOf(a), j = s.indexOf(b, i + 1); assert.ok(i >= 0 && j > i, `markers ${a} / ${b}`); return s.slice(i, j); };
const CORE = between(HTML, '// QUEST-CORE-BEGIN', '// QUEST-CORE-END');
const UI = between(HTML, '// QUEST-UI-BEGIN', '// QUEST-UI-END');
const TERRAIN = between(HTML, '// TERRAIN-BEGIN', '// TERRAIN-END');
const ADV = between(HTML, '// ADVENTURE-BEGIN', '// ADVENTURE-END');
const Q = new Function(CORE + '\nreturn { QUEST_DEFS, DETOUR_DEFS, VIEWPOINTS, DETOUR_NEAR_R, DETOUR_LEAVE_R, createQuestState, questEvent, detoursOpen, nearestDetour, releaseDismissed, viewpointOf, suggestViewpoints, classifyDetourAnswer };')();
const W = new Function(TERRAIN + ADV + '\nreturn { inWalk, WALK, GATE, WORD_TREE, TREE_AREA, heightAt };')();
const MISSION = { x: 1.5, z: -6.5 };

test('1. クエストは一方向にだけ進む：最初 → 第2が使える → 進行中 → 完了。二重に進まない・終わったあとに再び始まらない', () => {
  const st = Q.createQuestState();
  assert.deepEqual(st.quests, { first: 'active', second: 'locked' });
  assert.equal(Q.questEvent(st, 'secondStart'), false, 'second is locked before the first is done');
  assert.equal(Q.questEvent(st, 'firstDone'), true);
  assert.equal(Q.questEvent(st, 'firstDone'), false);
  assert.deepEqual(st.quests, { first: 'done', second: 'available' });
  assert.equal(Q.questEvent(st, 'secondStart'), true);
  assert.equal(Q.questEvent(st, 'secondStart'), false);
  assert.equal(Q.questEvent(st, 'secondDone'), true);
  assert.equal(Q.questEvent(st, 'secondDone'), false, 'no double reward');
  assert.equal(Q.questEvent(st, 'secondStart'), false, 'no restart after done');
  assert.equal(Q.questEvent(st, 'unknown'), false);
});

test('2. 答えの記録：進行中のクエストに1回だけ。第2クエストは最初のクエストの記録を上書きしない。スキップは答えた扱いにしない', () => {
  const st = Q.createQuestState();
  assert.ok(Q.questEvent(st, 'record', { id: 'first', expression: 'ひよこ', word: '輪郭', answer: '丸いところが可愛い', chosen: 'ころんと丸くて可愛い' }));
  assert.equal(Q.questEvent(st, 'record', { id: 'first', answer: 'べつの答え' }), false);
  Q.questEvent(st, 'firstDone'); Q.questEvent(st, 'secondStart');
  assert.equal(Q.questEvent(st, 'record', { id: 'first', answer: 'うわがき' }), false, 'first is done: no overwrite');
  assert.ok(Q.questEvent(st, 'record', { id: 'second', answer: '', chosen: null, skipped: true }));
  assert.equal(st.records.first.answer, '丸いところが可愛い');
  assert.equal(st.records.first.chosen, 'ころんと丸くて可愛い');
  assert.equal(st.records.second.skipped, true);
});

test('3. 道くさ：最初のクエストのあとだけ。どの順番でも取れる。同じ場所は2回取れない。知らない場所は取れない', () => {
  const st = Q.createQuestState();
  assert.equal(Q.detoursOpen(st), false);
  assert.equal(Q.questEvent(st, 'detour', { id: 'grass', words: '桃' }), false);
  Q.questEvent(st, 'firstDone');
  for (const id of ['flower', 'grass', 'shade']) assert.ok(Q.questEvent(st, 'detour', { id, words: '桃' }), id);
  assert.equal(Q.questEvent(st, 'detour', { id: 'grass', words: '雨' }), false, 'no double pick');
  assert.equal(st.detours.grass.words, '桃');
  assert.equal(Q.questEvent(st, 'detour', { id: 'nowhere', words: 'x' }), false);
});

test('4. 気配の案内：いちばん近い1か所だけ。取った場所・「あとで」で閉じた場所は、十分に離れるまで出さない', () => {
  const st = Q.createQuestState(); Q.questEvent(st, 'firstDone');
  const g = Q.DETOUR_DEFS.find(d => d.id === 'grass');
  assert.equal(Q.nearestDetour(st, g.x + .5, g.z), g);
  assert.equal(Q.nearestDetour(st, g.x + Q.DETOUR_NEAR_R + .2, g.z), null, 'not from far away');
  st.dismissed.grass = true;
  assert.equal(Q.nearestDetour(st, g.x + .5, g.z), null);
  Q.releaseDismissed(st, g.x + 1, g.z); assert.ok(st.dismissed.grass, 'still near');
  Q.releaseDismissed(st, g.x + Q.DETOUR_LEAVE_R + .5, g.z); assert.ok(!st.dismissed.grass, 'released after leaving');
  Q.questEvent(st, 'detour', { id: 'grass', words: '桃' });
  assert.equal(Q.nearestDetour(st, g.x, g.z), null, 'collected');
});

test('5. 道くさの3か所と第2クエストの芽は、歩ける場所にある。祠・出発点・門から離れ、場所どうしも離れている', () => {
  const defs = Q.DETOUR_DEFS;
  assert.deepEqual(defs.map(d => d.place), ['草むら', '木陰', '花のそば']);
  for (const d of defs) {
    assert.ok(W.inWalk(d.x, d.z, false), d.id + ' walkable before the gate opens');
    assert.ok(Math.hypot(d.x - MISSION.x, d.z - MISSION.z) > 6, d.id + ' away from the shrine');
    assert.ok(Math.hypot(d.x, d.z) > 6, d.id + ' away from the start');
    assert.ok(Math.hypot(d.x - W.GATE.x, d.z - W.GATE.z) > 6, d.id + ' away from the gate');
  }
  for (let i = 0; i < defs.length; i++) for (let j = i + 1; j < defs.length; j++) assert.ok(Math.hypot(defs[i].x - defs[j].x, defs[i].z - defs[j].z) > 2 * Q.DETOUR_NEAR_R, 'one hint at a time');
  const s = Q.QUEST_DEFS[1].start;
  assert.ok(W.inWalk(s.x, s.z, true), 'quest sprout is reachable after the gate opens');
  const dt = Math.hypot(s.x - W.WORD_TREE.x, s.z - W.WORD_TREE.z);
  assert.ok(dt > W.TREE_AREA.trunk + .5 && dt < W.TREE_AREA.r - .3, 'beside the word tree');
  assert.ok(dt > 3.4 - .3 + s.r || Math.hypot(13.0 - s.x, -29.6 - s.z) > s.r + 1, 'not under the arrival spot');
  assert.ok(Math.abs(W.heightAt(s.x, s.z)) < .01, 'flat ground');
});

test('6. 問いと入手品は定義データにある（文言・入手品・書き出し・反応・草木の隠し）。香りは想像する遊びと分かる', () => {
  for (const d of Q.DETOUR_DEFS) {
    for (const k of ['hint', 'question', 'reaction']) assert.ok(typeof d[k] === 'string' && d[k].length >= 6, d.id + k);
    assert.ok(d.item.id && d.item.name && d.item.icon, d.id);
    assert.equal(d.starters.length, 3);
    assert.ok(d.cover.length >= 2, d.id + ' partly hidden by plants');
  }
  assert.deepEqual(Q.DETOUR_DEFS.map(d => d.item.name), ['かおりの実', 'そよかぜの葉', 'なまえの花']);
  assert.match(HTML, /香りを想像してみよう（画面から、においは出ないよ）/);
});

test('7. 道くさの答え：短くても意味のある答え（桃・雨）は受け取る。記号だけ・同じ文字だけ・ひらがな1文字は書き足しの案内', () => {
  for (const t of ['桃', '雨', 'もも', 'レモン', '雨あがりの森', 'ひみつのにおい']) assert.equal(Q.classifyDetourAnswer(t), 'ok', t);
  for (const [t, k] of [['', 'empty'], ['   ', 'empty'], ['！！', 'symbol'], ['🌸', 'symbol'], ['あああ', 'repeat'], ['ああ', 'repeat'], ['ww', 'repeat'], ['あ', 'short'], ['x', 'short']]) assert.equal(Q.classifyDetourAnswer(t), k, t);
});

test('8. 第2クエストの観点：前に書いたことの観点を外して、別の3つを「たとえば」として出す', () => {
  assert.equal(Q.viewpointOf('丸いところが可愛い'), 'shape');
  assert.equal(Q.viewpointOf('赤い色がきれい'), 'color');
  assert.equal(Q.viewpointOf('ゆっくり歩いていた'), 'motion');
  assert.deepEqual(Q.suggestViewpoints('丸いところが可愛い'), ['color', 'motion', 'sound']);
  assert.deepEqual(Q.suggestViewpoints('赤い色'), ['shape', 'motion', 'sound']);
  assert.deepEqual(Q.suggestViewpoints(''), ['color', 'shape', 'motion']);
  for (const k of ['color', 'shape', 'motion', 'sound', 'smell']) assert.equal(Q.VIEWPOINTS[k].length, 2);
});

test('9. 画面：入力中・パネルが開いているときは「見つけたもの」と道くさの案内を出さない。近づいただけでは問いを開かない', () => {
  assert.match(UI, /el\('btn-found'\)\.classList\.toggle\('show', state === S\.EXPLORE \|\| state === S\.FREE_EXPLORE\);/);
  assert.match(UI, /const call = el\('detour-call'\), on = state === S\.FREE_EXPLORE && !!detourNear;/);
  assert.match(UI, /function openDetour\(\) \{\s*if \(state !== S\.FREE_EXPLORE \|\| !detourNear\) return;/);
  // 近づいたときは案内（applyUI）だけ。openDetour を呼ぶのは「調べる」のボタンだけ
  assert.equal((UI.match(/openDetour\(\)/g) || []).length, 2, 'definition + the button handler');
  assert.match(UI, /\['btn-detour-open', \(\) => questHub\.openDetour\(\)\]/);
  // 歩けるのは EXPLORE・DEMO_COMPLETE・FREE_EXPLORE だけ（道くさ・見つけたもの の画面では背後で歩かない）
  assert.match(HTML, /const canMove=\(\)=>state===S\.EXPLORE\|\|state===S\.DEMO_COMPLETE\|\|state===S\.FREE_EXPLORE;/);
});

test('10. 道くさの送信：1回だけ（連打・Enter と押す の重なり）。日本語の変換を確定する Enter では送らない。AI は1回・失敗しても入手できる', () => {
  const send = between(UI, 'function sendDetour() {', '\n  }\n');
  assert.match(send, /if \(state !== S\.DETOUR \|\| !detourDef \|\| detourSent\) return;/);
  assert.ok(send.indexOf('detourSent = true') < send.indexOf('fetchExpansion('), 'guard before sending');
  assert.equal((send.match(/fetchExpansion\(/g) || []).length, 1);
  assert.match(send, /if \(gen !== detourGen \|\| state !== S\.DETOUR\) return;/);
  assert.match(send, /collectDetour\(def, text, ai\);/);   // ai が null（時間切れ・429・不正）でも入手する
  assert.match(UI, /if \(e\.key !== 'Enter' \|\| e\.shiftKey \|\| e\.isComposing \|\| e\.keyCode === 229\) return;/);
  // 明らかな危険を示す答えは、送らずに care（入手しない）
  assert.ok(send.indexOf('localExpandCare(') < send.indexOf('classifyDetourAnswer('));
  assert.match(between(UI, 'function showDetourCare(urgent) {', '\n  }\n'), /URGENT_CARE_MESSAGE[\s\S]*CARE_SUPPORT_MESSAGE/);
});

test('11. 「あとで」で閉じたら未取得のまま。閉じたあとに届いた返事は使わない。入手品には子どもの言葉を添える', () => {
  const close = between(UI, 'function closeDetour(done) {', '\n  }\n');
  assert.match(close, /if \(!done && detourDef && !st\.detours\[detourDef\.id\]\) st\.dismissed\[detourDef\.id\] = true;/);
  assert.match(close, /detourGen\+\+; cancelExpansion\(\);/);
  const col = between(UI, 'function collectDetour(def, text, ai) {', '\n  }\n');
  assert.match(col, /if \(!questEvent\(st, 'detour', \{ id: def\.id, words: text \}\)\) return;/);
  assert.match(col, /'「' \+ text \+ '」'/);
  assert.match(col, /えらばなくても大丈夫/);
});

test('12. 第2クエスト：同じパネルを使い、写真は前のままでもよい。観点の書き出しは入れるだけ（送らない）。終わると実と花、自由な散歩へ（1回だけ）', () => {
  const start = between(UI, 'function startSecond() {', '\n  }\n');
  assert.match(start, /if \(!questEvent\(st, 'secondStart'\)\) return;/);
  assert.match(start, /el\('photo-reuse-note'\)\.style\.display = photoDataUrl \? '' : 'none';/);
  assert.match(start, /el\('btn-photo-next'\)\.classList\.toggle\('btn-disabled', !photoDataUrl\);/);
  assert.match(start, /input\.value = start; input\.dispatchEvent\(new Event\('input', \{ bubbles: true \}\)\); input\.focus\(\);/);
  assert.ok(!/toWords\(|revealSecret\(|fetch/.test(start), 'chips never submit');
  const fin = between(UI, 'function finishSecond() {', '\n  }\n');
  assert.match(fin, /if \(!questEvent\(st, 'secondDone'\)\) return;/);
  assert.match(fin, /worldV2\.lightNextFruit\(x, z\);/);
  assert.match(fin, /worldTimeout\(\(\) => setState\(S\.FREE_EXPLORE\), 900\);/);
  // 第2クエストのときは finishSecret・「今は進む」から finishSecond へ（最初のクエストの流れは変えない）
  assert.match(between(HTML, 'function finishSecret(){', '\n};\n'), /if\(questHub\.current\(\) === 'second'\)\{ questHub\.finishSecond\(\); return; \}/);
  assert.match(between(HTML, 'window.toDemoEnd   = ()=>{', '\n};'), /if\(questHub\.current\(\) === 'second'\)\{ questHub\.finishSecond\(\); return; \}/);
});

test('13. 見つけたもの：点数・正誤ではなく、見つけた物と自分のことば。保存しないので、最初からにすると消える', () => {
  const open = between(UI, 'function openFound() {', '\n  }\n');
  assert.ok(!/score|点|正解|まちが|ランキング/.test(open));
  assert.match(open, /'道くさで見つけたもの'/);
  assert.match(open, /'広がったことば'/);
  assert.match(HTML, /遊んでいるあいだだけ残ります。「デモを最初から」を押すと消えます。/);
  assert.ok(!/localStorage|sessionStorage|indexedDB|document\.cookie/.test(UI + CORE));
  const reset = between(UI, 'function reset() {', '\n  }\n');
  assert.match(reset, /st = createQuestState\(\);/);
  assert.match(between(HTML, 'function doReset(){', '\n}\n'), /questHub\.reset\(\);/);
});

test('14. 新しい描画ループ・タイマーを足さない。光は1回で描き、最初のクエストまでは描かない。テキストは textContent', () => {
  assert.ok(!/requestAnimationFrame|setInterval|setTimeout\(/.test(UI));
  assert.match(UI, /new THREE\.InstancedMesh\(new THREE\.SphereGeometry\(\.1, 10, 8\)/);
  assert.match(UI, /glow\.visible = false; scene\.add\(glow\);/);
  assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|console\./.test(UI + CORE));
  assert.match(HTML, /questHub\.update\(t\);   \/\/ 第2クエストの芽・道くさの気配/);
});

test('15. 門がひらいたあと、草原の中どうし（東のふちを含む）は、秘密の道へ寄り道せずに歩く。樹へ向かうときは今までどおり門へ', () => {
  const H = new Function(TERRAIN + ADV + '\nreturn { steerToward };')();
  const o = { x: 0, z: 0 };
  for (const [s, g] of [[[7.5, -2.7], [16.2, -4.4]], [[6.3, -1.8], [15, -3.5]], [[10.5, 3], [15, -3.5]], [[0, 0], [-6, -2]]]) {
    H.steerToward(s[0], s[1], g[0], g[1], o);
    assert.ok(Math.hypot(o.x - g[0], o.z - g[1]) < .01, JSON.stringify([s, g]));
  }
  H.steerToward(0, 0, 15, -26, o); assert.deepEqual([o.x, o.z], [W.GATE.x, W.GATE.z], 'to the tree: first the gate');
});

test('16. ことばの樹のまわりでは、幹の向こう側から草原へ歩き出しても、幹に引っかからずに帰れる', () => {
  const H = new Function(TERRAIN + ADV + '\nreturn { steerToward, clampWalk };')();
  for (const [sx, sz] of [[17.1, -26.9], [18.6, -27], [16, -31.5], [Q.QUEST_DEFS[1].start.x, Q.QUEST_DEFS[1].start.z]]) {
    const p = { x: sx, z: sz }, o = { x: 0, z: 0 }; let i = 0;
    for (; i < 1500; i++) {
      if (Math.hypot(p.x - 6.3, p.z + 1.8) < .6) break;
      H.steerToward(p.x, p.z, 6.3, -1.8, o);
      const dx = o.x - p.x, dz = o.z - p.z, d = Math.hypot(dx, dz), st = Math.min(4 / 60, d);
      p.x += dx / d * st; p.z += dz / d * st; H.clampWalk(p, true, 1);
    }
    assert.ok(i < 1500, `stuck from ${sx},${sz} at ${p.x.toFixed(2)},${p.z.toFixed(2)}`);
  }
});

test('17. 上の知らせ：自由に歩いているあいだは、実が灯った知らせ・「自由に歩いてみよう」を5秒で消す。芽への案内は残す。状態が変わると出しなおす', () => {
  assert.match(UI, /const BAR_HOLD_MS = 5000;/);
  assert.match(UI, /function fadeBarLater\(\) \{\s*if \(freeMsg === Q2_GUIDE\) return;/);
  // 消す前に、ほかの知らせが出ていたら（状態が変わったら）消さない
  assert.match(UI, /worldTimeout\(\(\) => \{ if \(my === barToken && state === S\.FREE_EXPLORE\) el\('mission-bar'\)\.style\.opacity = '0'; \}, BAR_HOLD_MS\);/);
  assert.match(UI, /function showBar\(\) \{ barToken\+\+;/);
  assert.match(HTML, /function applyUI\(\) \{\n  stopVoice\(\);\n  questHub\.showBar\(\);/);
  assert.match(HTML, /case S\.FREE_EXPLORE:\n      mbar\.textContent = questHub\.freeMessage\(\);\n      hint\.style\.opacity = '0';\n      questHub\.fadeBarLater\(\);/);
  assert.match(UI, /reward: 'ことばの樹に、2つ目の実が灯った！'|freeMsg = Q2\.reward;/);
});
