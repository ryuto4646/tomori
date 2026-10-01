// Step 11H：ワールド美術（朝の草原）のテスト。ブラウザも通信も使わない
// 美術は demo-world.html の WORLD-ART-BEGIN〜END と、空・霧・光・地面の色だけ（一覧は world-art-baseline.mjs）。
// ヒロリ・移動・カメラ・ミッション・語彙・care・AI スイッチ・WebGL 非対応画面は、変えていないことを確かめる
// 実行: node --test test-world-visuals.mjs
// WORLD_VISUALS_ROOT を指定すると、そのフォルダの demo-world.html などを調べる（壊した一時コピーで、テストが失敗できるかを確かめるため）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { artBlock, revertWorldArt } from './world-art-baseline.mjs';

const REPO = dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.WORLD_VISUALS_ROOT || REPO;
const normalize = s => s.replace(/\r\n/g, '\n');
const read = f => normalize(readFileSync(join(ROOT, f), 'utf8'));
const git = (...args) => execFileSync('git', args, { cwd: REPO, maxBuffer: 64 * 1024 * 1024 });
const gitShow = (rev, file) => normalize(git('show', `${rev}:${file}`).toString('utf8'));
// 収録版タグ（美術を入れる前の世界）と、Step 11H を始めたときのコミット（非対応画面・スタートページの正本）
const TAG = 'tv-recording-candidate-20260928';
const BASE = 'b2caa58';

const NOW = read('demo-world.html');
const ART = artBlock(NOW);
// コメントを除いた美術のコード（説明文の言葉に反応しないように）
const ART_CODE = ART.split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n');
const OLD = gitShow(TAG, 'demo-world.html');
const BASE_DEMO = gitShow(BASE, 'demo-world.html');
// 美術を外した今のファイル（美術以外の部分を比べるのに使う）
const noArt = () => revertWorldArt(NOW);
const between = (s, a, b) => { const i = s.indexOf(a), j = s.indexOf(b, i + 1); assert.ok(i >= 0 && j > i, `markers ${a} / ${b}`); return s.slice(i, j); };
const count = (s, re) => (s.match(re) || []).length;
const fnBody = (s, head) => { const i = s.indexOf(head); assert.ok(i >= 0, head); return s.slice(i, s.indexOf('\n}\n', i) + 3); };

test('1. 美術の要素がそろっている（空・遠くの丘と森・霧・朝の光・草花と小石・光る小道・ミッション地点の光）', () => {
  assert.ok(ART.length > 0, 'WORLD-ART block');
  assert.match(ART, /new THREE\.CylinderGeometry\(SKY_R, SKY_R, SKY_H[^)]*\)/, 'sky band');
  assert.match(ART, /skyTop[\s\S]*skyMid[\s\S]*skyLow/, 'sky gradient colors');
  assert.match(ART, /side: THREE\.BackSide, fog: false/, 'sky is not fogged');
  assert.match(ART, /const HILLS = \[/, 'distant hills');
  assert.match(ART, /const FOREST = \[/, 'distant forest');
  assert.match(ART, /const grass = new THREE\.InstancedMesh/, 'grass');
  assert.match(ART, /const flowers = new THREE\.InstancedMesh/, 'flowers');
  assert.match(ART, /const pebbles = new THREE\.InstancedMesh/, 'pebbles');
  assert.match(ART, /new THREE\.CatmullRomCurve3/, 'light path curve');
  assert.match(ART, /const mpGlow = new THREE\.Mesh/, 'mission glow');
  assert.match(ART, /const MP_FLOWERS = \[/, 'mission flowers');
  assert.match(ART, /const MP_STONES = \[/, 'mission stones');
  assert.match(NOW, /scene\.fog = new THREE\.Fog\(/, 'fog');
  assert.match(NOW, /const sun = new THREE\.DirectionalLight\(0xffe6c0/, 'warm key light');
  assert.match(NOW, /const fillLight = new THREE\.DirectionalLight\(0xbcdcff/, 'pale blue fill light');
  assert.match(fnBody(NOW, 'function animate(){'), /worldArt\.update\(t\);/, 'update called from animate');
});

test('2. 光る小道・草花・小石に当たり判定が無く、タップ移動は今までどおり地面だけ', () => {
  assert.ok(!/raycaster|intersectObject|collid|obstacle/i.test(ART_CODE), 'no raycast or collision in art');
  assert.equal(count(NOW, /intersectObject/g), count(OLD, /intersectObject/g));
  assert.match(NOW, /const hits=raycaster\.intersectObject\(ground\);/);
  // 美術は1つのグループにまとめ、シーンへ1回だけ加える（ほかの物の子にしない）
  assert.equal(count(ART, /scene\.add\(/g), 1);
  assert.match(ART, /scene\.add\(group\);/);
  // 小道は地面すれすれ（y 0.05 未満）に置く
  const y = ART.match(/place\(light, i, [^,]+, ([0-9.]+), p\.z/);
  assert.ok(y && Number(y[1]) < 0.05, 'path y');
  // 小道は出発点の近くからミッション地点の手前まで
  const pts = JSON.parse(ART.match(/const PATH_PTS = (\[[^;]+\]);/)[1]);
  const mp = NOW.match(/const MISSION_POS = new THREE\.Vector3\(([-0-9.]+), 0, ([-0-9.]+)\);/).slice(1).map(Number);
  const last = pts[pts.length - 1], first = pts[0];
  assert.ok(Math.hypot(first[0], first[1]) < 1.5, 'path starts near the start');
  const dEnd = Math.hypot(last[0] - mp[0], last[1] - mp[1]);
  assert.ok(dEnd > 0.8 && dEnd < 1.8, 'path stops just before the mission point');
});

test('3. ミッション地点の座標・順番の定義は収録版タグと同じ', () => {
  const lines = s => s.split('\n').filter(l => /MISSION_POS\s*=|SECRET_POS|NEXT_POS|mpGroup\.position|secretGroup\.position|nextGroup\.position/.test(l));
  assert.deepEqual(lines(noArt()), lines(OLD));
  assert.match(NOW, /const MISSION_POS = new THREE\.Vector3\(1\.5, 0, -6\.5\);/);
});

test('4. ヒロリの形・色・表情・動き（HIRORI-BEGIN〜END）は収録版タグと同じ', () => {
  assert.equal(between(NOW, '// HIRORI-BEGIN', '// HIRORI-END'), between(OLD, '// HIRORI-BEGIN', '// HIRORI-END'));
});

test('5. カメラの動かし方・構図（CAM_OFF・追いかけ・注目・リセット）は収録版タグと同じ', () => {
  const lines = s => s.split('\n').filter(l => /camera\.|camTgt|CAM_OFF|_focus|PerspectiveCamera/.test(l));
  assert.deepEqual(lines(noArt()), lines(OLD));
  assert.match(NOW, /const CAM_OFF = new THREE\.Vector3\(0, 5, 8\);/);
  // 美術はカメラの位置を読むだけで、動かさない
  assert.ok(!/camera\.(position|rotation|quaternion)\.(set|copy|lerp|add)|camera\.lookAt|camera\.fov/.test(ART));
});

test('6. 移動の速さ・キー操作・タップ移動（animate とキー入力）は収録版タグと同じ', () => {
  assert.equal(fnBody(noArt(), 'function animate(){'), fnBody(OLD, 'function animate(){'));
  const lines = s => s.split('\n').filter(l => /SPEED|ARRIVE|addEventListener\('key|keys\[/.test(l));
  assert.deepEqual(lines(noArt()), lines(OLD));
  assert.match(NOW, /const SPEED=4\.0, ARRIVE=0\.6;/);
});

test('7. AI スイッチは true のまま', () => {
  assert.match(NOW, /const VOCABULARY_AI_ENABLED = true;/);
  assert.equal(count(NOW, /VOCABULARY_AI_ENABLED = /g), 1);
});

test('8. 語彙 Worker の URL は今までと同じ', () => {
  const url = s => (s.match(/const VOCABULARY_API_URL = '([^']+)';/) || [])[1];
  assert.equal(url(NOW), url(OLD));
  assert.equal(url(NOW), 'https://tomori-vocabulary.tomori-ryuto.workers.dev/vocabulary');
});

test('9. care（つらい気もちへの対応）の文面と判定は今までと同じ', () => {
  const care = s => between(s, 'const CARE_SUPPORT_MESSAGE', 'const VOCAB_SESSION_KEY');
  assert.equal(care(NOW), care(OLD));
});

test('10. スタートページ（index.html）と画像は変わっていない', () => {
  assert.equal(read('index.html'), gitShow(BASE, 'index.html'));
  const webp = readFileSync(join(ROOT, 'assets', 'tomori-world-gateway.webp'));
  assert.ok(webp.equals(git('show', `${BASE}:assets/tomori-world-gateway.webp`)), 'webp bytes');
});

test('11. WebGL 非対応画面は Step 11E のまま', () => {
  const block = s => (s.match(/<div id="no-webgl"[^>]*>[\s\S]*?<\/div>/) || [''])[0];
  const css = s => s.split('\n').filter(l => /no-webgl/.test(l)).join('\n');
  assert.ok(block(NOW).length > 0);
  assert.equal(block(NOW), block(BASE_DEMO));
  assert.equal(css(NOW), css(BASE_DEMO));
});

test('12. 新しい外部 URL・CDN・パッケージが無い', () => {
  const urls = s => [...new Set(s.match(/https?:\/\/[^\s'"`)<>]+/g) || [])].sort();
  assert.deepEqual(urls(NOW), urls(OLD));
  assert.ok(!/https?:\/\/|import\(|fetch\(|new Image|<img/.test(ART), 'art uses nothing outside the page');
  assert.ok(!existsSync(join(REPO, 'package.json')), 'no package.json');
  const importmap = s => (s.match(/<script type="importmap">[\s\S]*?<\/script>/) || [''])[0];
  assert.equal(importmap(NOW), importmap(OLD));
});

test('13. テクスチャを使わない。新しいジオメトリ・素材はそれぞれ8つ以内', () => {
  assert.ok(!/Texture|Loader|map\s*:|CanvasTexture|<canvas/.test(ART), 'no texture in art');
  assert.equal(count(NOW, /Texture/g), count(OLD, /Texture/g));
  assert.ok(count(ART, /new THREE\.\w*Geometry\(/g) <= 8, 'geometries');
  assert.ok(count(ART, /new THREE\.\w+Material\(/g) <= 8, 'materials');
  assert.ok(!/\.clone\(\)/.test(ART), 'no cloned materials');
});

test('14. requestAnimationFrame を増やしていない（美術は animate の中で1回だけ更新）', () => {
  assert.equal(count(NOW, /requestAnimationFrame/g), count(OLD, /requestAnimationFrame/g));
  assert.ok(!/requestAnimationFrame|setInterval|setTimeout/.test(ART_CODE));
  assert.equal(count(NOW, /worldArt\.update\(/g), 1);
});

test('15. 毎フレームの処理で、配列・Vector・Color・ジオメトリ・素材を新しく作らない', () => {
  const upd = between(ART, 'update(t) {', '\n    },');
  assert.ok(upd.length > 0);
  assert.ok(!/\bnew\b|\.clone\(|\[|=>|\.map\(|\.filter\(|\.slice\(|\{\s*\w+\s*:/.test(upd.slice('update(t) {'.length)), upd);
});

test('16. 収録版タグは 1890884 を指したまま', () => {
  assert.equal(git('rev-parse', '--short', `${TAG}^{commit}`).toString().trim(), '1890884');
});

test('17. 公開されるファイルに、停止した旧 API（tomori-api）の URL が戻っていない', () => {
  const files = git('ls-files').toString().split('\n').filter(f => /\.(html|mjs|js|md|cmd|json|toml|txt|css)$/.test(f));
  files.push('world-art-baseline.mjs', 'test-world-visuals.mjs');
  for (const f of new Set(files)) {
    const p = join(REPO, f);
    if (!existsSync(p)) continue;
    assert.ok(!/tomori-api\.[a-z0-9-]+\.workers\.dev/.test(readFileSync(p, 'utf8')), f);
  }
  assert.ok(!/tomori-api\.[a-z0-9-]+\.workers\.dev/.test(NOW));
});

test('18. console への出力を増やしていない', () => {
  assert.equal(count(NOW, /console\./g), count(OLD, /console\./g));
  assert.ok(!/console\./.test(ART));
});
