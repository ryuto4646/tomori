// Step 11H・11I-A・11I-B：ワールド美術（V1）とワールドV2で変えた場所の一覧（テスト用）。
// demo-world.html から美術の変更だけを元へ戻す関数を、test-start-page.mjs と test-world-visuals.mjs で共有する。
// ここに無い場所が変わっていたら、元へ戻した結果が収録版タグと一致せず、テストが落ちる。

// [変更前, 変更後]。変更後の文字列は demo-world.html にちょうど1回ずつ出てくる
export const WORLD_ART_EDITS = [
  [`html, body { width:100%; height:100%; overflow:hidden; background:#a8d8ea;
`,
   `html, body { width:100%; height:100%; overflow:hidden; background:#a8d8ea;
  /* 空（WORLD-ART）：3D の背景は透明にして、この色の上に描く。地平線あたりは霧と同じ色 */
  background:linear-gradient(180deg, #6fb7e3 0%, #93cdea 9%, #c4e3ee 18%, #d6ecef 26%, #d6ecef 100%);
`],
  [`const renderer = new THREE.WebGLRenderer({ canvas, antialias:true });`,
   `const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:true });   // alpha：空は CSS で描く（WORLD-ART）`],
  [`scene.background = new THREE.Color(0xa8d8ea);
scene.fog = new THREE.Fog(0xa8d8ea, 22, 65);`,
   `// 空は CSS（html, body の背景）。霧は地平線の色：遠くほど淡く、少し青みがかる
scene.fog = new THREE.Fog(0xd6ecef, 24, 88);`],
  [`scene.add(new THREE.AmbientLight(0xfff5e0, 1.4));
const sun = new THREE.DirectionalLight(0xfffacd, 2.0);
sun.position.set(8,12,6); scene.add(sun);
scene.add(new THREE.HemisphereLight(0xa8d8ea, 0x6aaa4f, 0.7));`,
   `// 朝の光：暖かい主光源（斜め上）と、影の側をやわらげる淡い青の補助光。影は使わない（黒くつぶさない）
scene.add(new THREE.AmbientLight(0xfff3e2, 1.05));
const sun = new THREE.DirectionalLight(0xffe6c0, 2.2);
sun.position.set(12,9,4); scene.add(sun);
const fillLight = new THREE.DirectionalLight(0xbcdcff, 0.6);
fillLight.position.set(-8,5,4); scene.add(fillLight);
scene.add(new THREE.HemisphereLight(0xbfe3f2, 0x78ad5a, 0.7));`],
  [`function mkTree(x,z,s){
  const g = new THREE.Group();
  const tk = new THREE.Mesh(
    new THREE.CylinderGeometry(.18*s,.25*s,1.6*s,7),
    new THREE.MeshLambertMaterial({color:0x8b5e3c})
  );
  tk.position.y = .8*s; g.add(tk);
  const lc=[0x2d8a2d,0x3aaf3a,0x247a24];
  [[0,1.8,1.3],[.3,1.2,1.0],[-.1,.7,.75]].forEach(([yo,y,r],i)=>{
    const lf = new THREE.Mesh(
      new THREE.ConeGeometry(r*s,1.8*s,7),
      new THREE.MeshLambertMaterial({color:lc[i]})
    );
    lf.position.y = y*s+yo; g.add(lf);
  });
  g.position.set(x,0,z); return g;
}
`,
   `// 木の見た目は WORLD-ART で、共有の形（InstancedMesh）を使って描く。TREE_SPOTS はカメラが木をよける計算にも使う
`],
  [` [17,-5],[19,2],[17,6],[21,-2]
];
TREE_SPOTS.forEach(([x,z])=>scene.add(mkTree(x,z,.8+Math.random()*.4)));
`,
   ` [17,-5],[19,2],[17,6],[21,-2]
];
`],
  [`  updateLabel();
  renderer.render(scene,camera);`,
   `  updateLabel();
  worldArt.update(t); worldV2.update(t);   // 小道の光・光の柱・ことばの樹の実を、ゆっくり動かす（WORLD-ART・WORLD-V2）
  questHub.update(t);   // 第2クエストの芽・道くさの気配（Step 11M。新しい描画ループは作らない）
  renderer.render(scene,camera);`],
  [`const canvas   = document.getElementById('world-canvas');
`,
   `const canvas   = document.getElementById('world-canvas');
// WORLD-V2：ワールドV2を使うか・画質（起動時に一度だけ決める。?quality=high|low は品質確認用）
const WORLD_V2_ENABLED = true;
const WORLD_QUALITY = (() => {
  const q = new URLSearchParams(location.search).get('quality');
  if (q === 'high' || q === 'low') return q;
  const coarse = matchMedia('(pointer: coarse)').matches, short = Math.min(screen.width, screen.height);
  return coarse || short < 700 || (devicePixelRatio >= 2.5 && short < 900) ? 'low' : 'high';
})();
`],
  [`renderer.setPixelRatio(Math.min(devicePixelRatio, 2));`,
   `renderer.setPixelRatio(Math.min(devicePixelRatio, WORLD_QUALITY === 'low' ? 1.25 : 2));   // 画質（WORLD-V2）`],
  [`[[-4,-3],[5,-2],[-2,5],[6,4],[-6,6]].forEach(([x,z])=>scene.add(mkRock(x,z)));`,
   `const v1Rocks=[[-4,-3],[5,-2],[-2,5],[6,4],[-6,6]].map(([x,z])=>{ const r=mkRock(x,z); scene.add(r); return r; });   // V2 では隠す（WORLD-V2）`],
  [`    targetPos.copy(hits[0].point); targetPos.y=0;`,
   `    targetPos.copy(hits[0].point); targetPos.y=0; worldV2.clampToWalkable(targetPos, 0.97);   // 歩ける範囲の内側へ（WORLD-V2）`],
  [`      updateHiroriMotion(character, dt, t, walking);
    }

    // 距離チェック（探索中のみ）
`,
   `      (fieldHirori.active() ? fieldHirori.update : updateHiroriMotion)(character, dt, t, walking);   // Field ヒロリを読み込めたら、その動き（Step 11L-A）
    }
    worldV2.groundCharacter(character);   // 歩ける範囲の内側・地面の高さへ（WORLD-V2。仮ヒロリの上下の弾みのあとに足す）

    // 距離チェック（探索中のみ）
`],
  [`      const md=character.position.distanceTo(mpGroup.position);`,
   `      const md=Math.hypot(character.position.x-mpGroup.position.x, character.position.z-mpGroup.position.z);   // 平面の距離（WORLD-V2：起伏で判定がぶれない）`],
  [`setTimeout(()=>{
  const ld=document.getElementById('loading');
  ld.style.opacity='0';
  setTimeout(()=>ld.style.display='none',800);
},800);`,
   `// ワールド（V2、または失敗したときの V1）の準備ができてから、読み込み画面を消す（最短でも 0.8 秒は見せる）
Promise.all([new Promise(r=>setTimeout(r,800)), worldV2.ready]).then(()=>{
  const ld=document.getElementById('loading');
  ld.style.opacity='0';
  setTimeout(()=>ld.style.display='none',800);
});`],
  [`const CAM_OFF = new THREE.Vector3(0, 5, 8);
`,
   `const CAM_OFF = new THREE.Vector3(0, 5, 8);
const CAM_LOOK = new THREE.Vector3(0, 1, 0);   // カメラが見る高さ（ヒロリの足もとから。ワールドV2 で変える：WORLD-V2）
`],
  [`    camTgt.lerp(character.position.clone().add(new THREE.Vector3(0,1,0)),.08);`,
   `    camTgt.lerp(character.position.clone().add(CAM_LOOK),.08);`],
  [`  if(character){ character.position.set(0,0,0); character.rotation.set(0,0,0); }
`,
   `  worldV2.reset();   // ことばのタネ・根の門・秘密の道・ことばの樹の実・カメラの構図を最初へ（WORLD-V2）
  questHub.reset();  // クエスト・答え・道くさ・見つけたもの（Step 11M）
  if(character){ character.position.set(0,0,0); character.rotation.set(0,0,0); }
`],
  [`#world-canvas { display:block; width:100%; height:100%; touch-action:none; }
`,
   `#world-canvas { display:block; width:100%; height:100%; touch-action:none; }

/* 日本語の折り返し（TEXT-WRAP）：文節の切れ目（下のスクリプトが <wbr> を入れる）でだけ改行する。
   句読点・小さい字を行頭に出さない（strict）。短すぎる最後の行を避ける（pretty。効かないブラウザでもそのまま読める）。
   1つの文節が1行に入らないときだけ、文節の中で折り返す（break-word） */
body { line-break:strict; word-break:keep-all; overflow-wrap:break-word; text-wrap:pretty; }
textarea, input { word-break:normal; }
.panel-title, .end-line1, #word-announce, #mbar-text { text-wrap:balance; }
.nowrap { white-space:nowrap; }
`],
  [`#hint {
  position:absolute; bottom:76px; left:50%; transform:translateX(-50%);
`,
   `#hint {
  position:absolute; bottom:76px; left:50%; transform:translateX(-50%);
  width:max-content; max-width:calc(100vw - 32px);
`],
  [`.btn-disabled { opacity:.38; pointer-events:none; }
`,
   `.btn-disabled { opacity:.38; pointer-events:none; }
.btn-primary:focus-visible, .btn-secondary:focus-visible, .btn-care:focus-visible, .photo-opt:focus-visible, .word-card:focus-visible,
#btn-reset:focus-visible, #btn-back:focus-visible, #btn-voice:focus-visible, #demo-end a:focus-visible { outline:3px solid #3a3328; outline-offset:3px; }
`],
  [`  padding:18px 22px; max-width:min(320px,88vw); text-align:center;`,
   `  padding:18px 22px; width:max-content; max-width:min(320px, calc(100vw - 32px)); text-align:center;`],
  [`.btn-care { flex:1; padding:10px 8px; border:none; border-radius:10px; cursor:pointer;`,
   `.btn-care { flex:1; min-height:44px; padding:10px 8px; border:none; border-radius:10px; cursor:pointer;`],
  [`  <div id="hint">タップした場所へ歩くよ！　パソコン：W A S D または 矢印キー</div>`,
   `  <div id="hint"><span class="nowrap">タップした場所へ歩くよ！</span>　<span class="nowrap">パソコン：W A S D</span> <span class="nowrap">または 矢印キー</span></div>`],
  [`<script type="importmap">`,
   `<script>
// TEXT-WRAP-BEGIN（日本語を文節の切れ目でだけ折り返す。test-text-layout.mjs がこの範囲を取り出して確かめる）
// Intl.Segmenter で単語に分け、助詞・助動詞・句読点は前の語につなげて「文節」にする。文節の前にだけ <wbr> を入れる。
// 文字そのもの（textContent）は変えない。Intl.Segmenter が無いブラウザでは何もしない（ふつうの折り返しのまま）
(function () {
  if (typeof Intl === 'undefined' || !Intl.Segmenter) { document.body.style.wordBreak = 'normal'; return; }
  const seg = new Intl.Segmenter('ja', { granularity: 'word' });
  // 前の語につなげる、ひらがなの短い語（助詞・助動詞・語尾）
  const ATTACH = new Set(('が の を に へ と で や も は か ね よ な さ わ ぞ ぜ て た だ ば し り る れ ら う ん っ ' +
    'です ます ました ません ない なく なかった たい たく よう そう いる いた いて います ある あった ' +
    'から まで より ほど だけ しか こそ でも って とか など けど のに ので ながら たり らしい みたい ' +
    'でしょう だろう かな かも じゃ ちゃ ても でも ては では には とは へは もの こと よね かい').split(' '));
  const NO_HEAD = /^[、。，．！？!?」』）)…ーぁぃぅぇぉっゃゅょァィゥェォッャュョ・：〜]/;
  const OPEN = /[「『（(]$/;
  const HIRA = /^[ぁ-ゖー]+$/;
  const cache = new Map();   // 同じ文（毎フレーム入れなおされる上の案内など）は、分け方を覚えておく
  function phrases(text) {
    const hit = cache.get(text); if (hit) return hit;
    const out = []; let cur = '', prev = '';
    for (const { segment } of seg.segment(text)) {
      const join = !cur || NO_HEAD.test(segment) || OPEN.test(prev) || (HIRA.test(segment) && (ATTACH.has(segment) || segment.length === 1))
        || /\\s$/.test(prev) || /^\\s/.test(segment) || (/^[A-Za-z0-9]/.test(segment) && /[A-Za-z0-9]$/.test(prev))
        || segment === '"' || prev === '"'                                                  // "なにか" のような引用は割らない
        || (/[一-龥々]$/.test(prev) && /^[ぁ-ゖ一-龥々]/.test(segment))                      // 漢字のあとの送りがな・漢字の続き（灯した・音声認識）
        || (/[ァ-ヺー]$/.test(prev) && /^[ァ-ヺー]/.test(segment))                           // カタカナの語の中（トモリ）
        || (/[ぁ-ゖ]$/.test(prev) && /^[ぁ-ゖ]/.test(segment) && !(ATTACH.has(prev) && segment.length >= 3) && (prev.length <= 2 || segment.length <= 2));   // ひらがなの切れはし（ひ｜らいた）
      if (join) cur += segment; else { out.push(cur); cur = segment; }
      prev = segment;
    }
    if (cur) out.push(cur);
    if (cache.size < 500) cache.set(text, out);
    return out;
  }
  const SKIP = 'SCRIPT,STYLE,TEXTAREA,INPUT,RUBY,RT,RP,SVG,OPTION,TITLE';
  function wrapNode(node) {
    const p = node.parentElement;
    if (!p || p.closest(SKIP.split(',').map(t => t.toLowerCase()).join(',')) || p.closest('.nowrap')) return;
    if (!/[ぁ-んァ-ン一-龥]/.test(node.data)) return;
    const parts = phrases(node.data);
    if (parts.length < 2) return;
    const frag = document.createDocumentFragment();
    parts.forEach((t, i) => { if (i) frag.appendChild(document.createElement('wbr')); frag.appendChild(document.createTextNode(t)); });
    node.replaceWith(frag);
  }
  function wrapTree(root) {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); const list = []; let n;
    while ((n = w.nextNode())) list.push(n);
    list.forEach(wrapNode);
  }
  wrapTree(document.body);
  new MutationObserver(muts => {
    for (const m of muts) {
      if (m.type === 'characterData') { if (m.target.isConnected) wrapNode(m.target); continue; }
      m.addedNodes.forEach(n => { if (n.nodeType === 3) { if (n.isConnected) wrapNode(n); } else if (n.nodeType === 1) wrapTree(n); });
    }
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
  window.__tomoriPhrases = phrases;   // テスト用（読むだけ）
})();
// TEXT-WRAP-END
</script>
<script type="importmap">`],
  [`scene.add(new THREE.Points(pGeo,new THREE.PointsMaterial({color:0xe0f0c0,size:.14,transparent:true,opacity:.5})));
`,
   `scene.add(new THREE.Points(pGeo,new THREE.PointsMaterial({color:0xe0f0c0,size:.14,transparent:true,opacity:.5})));
// SOFT-DOTS-BEGIN（Step 11K）：上の粒は、カメラの近くで四角い板のように大きく見えていた。丸くやわらかな光の点にする。
// 画面の大きさは 1.5〜10 ピクセルにおさえ、カメラのすぐ近く（2.5m より手前）と遠く（70m より先）では消える。テクスチャ・通信は使わない
{
  const dots = scene.children[scene.children.length - 1];
  dots.material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { color: { value: new THREE.Color(0xfff3cc) }, opacity: { value: .6 }, scale: { value: innerHeight * Math.min(devicePixelRatio, 2) / 2 } },
    vertexShader: 'uniform float scale; varying float vFade; void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); float d = -mv.z;'
      + ' gl_PointSize = clamp(0.14 * scale / max(d, 0.1), 1.5, 10.0); vFade = smoothstep(2.5, 6.0, d) * (1.0 - smoothstep(45.0, 70.0, d)); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform vec3 color; uniform float opacity; varying float vFade; void main() { float r = length(gl_PointCoord - 0.5) * 2.0;'
      + ' float a = 1.0 - smoothstep(0.0, 1.0, r); a *= a; if (a * vFade < 0.01) discard; gl_FragColor = vec4(color, a * opacity * vFade); }',
  });
}
// SOFT-DOTS-END
`],
  [`.word-desc { font-size:13px; color:#6a6048; line-height:1.5; }

/* ── ルビ共通 ─────────────────────── */
ruby { ruby-align:center; }
rt { font-size:0.55em; color:#7a8060; }

/* ── 音声入力`,
   `.word-desc { font-size:13px; color:#6a6048; line-height:1.5; }

/* ── 音声入力`],
  [`    // タイトル：<ruby> をDOM APIで構築。ひらがなだけの語（読みと同じ）にはルビを付けない
    const titleEl = document.createElement('div');
    titleEl.className = 'word-title';
    if (reading === word) {
      titleEl.appendChild(document.createTextNode(word));
    } else {
      const ruby = document.createElement('ruby');
      const rt = document.createElement('rt');
      rt.textContent = reading;
      ruby.appendChild(document.createTextNode(word));
      ruby.appendChild(rt);
      titleEl.appendChild(ruby);
    }
`,
   `    // タイトル：textContent で安全に。ルビは付けない（Step 11K-B：一部の語だけに付いて不統一だったため。
    // 読み（reading）はデータとして残す。学年別・ルビあり／なしの切り替えは別の Step で検討する）
    const titleEl = document.createElement('div');
    titleEl.className = 'word-title';
    titleEl.textContent = word;
`],
  [`character = createHiroriPlaceholder();
scene.add(character);
`,
   `character = createHiroriPlaceholder();
scene.add(character);
// FIELD-HIRORI-BEGIN（Step 11L-A：探索用の低ポリヒロリ。test-field-hirori.mjs がこの範囲を読み込んでテストする）
// assets/hirori-field/hirori-field.glb（tools/hirori-field/generate_hirori_field.py で作る）を同じ場所から読み込み、
// 読み込みがすべて成功したときだけ、仮ヒロリの見た目と入れかえる。失敗・8秒をこえたときは仮ヒロリのまま。
// 位置・向き・影・カメラ・名前の表示は仮ヒロリ（character）のものをそのまま使う。?hirori=placeholder で仮ヒロリに固定できる
const fieldHirori = (() => {
  const URL_GLB = 'assets/hirori-field/hirori-field.glb', TIMEOUT_MS = 8000, SCALE = 2.0;   // GLB は全高約1.0。仮ヒロリ（約2.0）にそろえる
  let active = false, P = null;
  const wanted = new URLSearchParams(location.search).get('hirori') !== 'placeholder';
  // GLB を読む：ノードの階層（位置・回転・大きさ）と、形（位置・法線・頂点色・番号）と、素材の色だけ。画像は使わない
  function parse(buf) {
    const dv = new DataView(buf);
    if (dv.getUint32(0, true) !== 0x46546C67 || dv.getUint32(4, true) !== 2) throw new Error('not glb2');
    const jlen = dv.getUint32(12, true);
    const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 20, jlen)));
    const binOff = 20 + jlen + 8;
    if ((json.images || []).length || (json.textures || []).length || (json.buffers || []).some(b => b.uri)) throw new Error('external data');
    const TYPES = { 5121: Uint8Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array }, N = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
    const read = i => {
      const a = json.accessors[i], v = json.bufferViews[a.bufferView], T = TYPES[a.componentType], n = N[a.type];
      if (!T || !n || (v.byteStride && v.byteStride !== n * T.BYTES_PER_ELEMENT)) throw new Error('accessor');
      return new THREE.BufferAttribute(new T(buf.slice(binOff + (v.byteOffset || 0) + (a.byteOffset || 0), binOff + (v.byteOffset || 0) + (a.byteOffset || 0) + a.count * n * T.BYTES_PER_ELEMENT)), n, !!a.normalized);
    };
    const mats = (json.materials || []).map(m => {
      const f = (m.pbrMetallicRoughness && m.pbrMetallicRoughness.baseColorFactor) || [1, 1, 1, 1];
      return new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(f[0], f[1], f[2], THREE.LinearSRGBColorSpace), roughness: .86, metalness: 0 });
    });
    const nodes = json.nodes.map(nd => {
      const o = new THREE.Group(); o.name = nd.name || '';
      if (nd.translation) o.position.fromArray(nd.translation);
      if (nd.rotation) o.quaternion.fromArray(nd.rotation);
      if (nd.scale) o.scale.fromArray(nd.scale);
      if (nd.mesh !== undefined) for (const pr of json.meshes[nd.mesh].primitives) {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', read(pr.attributes.POSITION));
        if (pr.attributes.NORMAL !== undefined) g.setAttribute('normal', read(pr.attributes.NORMAL));
        let mat = mats[pr.material] || mats[0];
        // 頂点色：Blender の書き出しは、白いだけの COLOR_0 の後に、塗った色（目・口）を COLOR_1 として入れる。いちばん後ろの色を使う
        const ck = Object.keys(pr.attributes).filter(k => /^COLOR_\\d+$/.test(k)).sort().pop();
        if (ck) { g.setAttribute('color', read(pr.attributes[ck])); mat = mat.userData.vc || (mat.userData.vc = Object.assign(mat.clone(), { vertexColors: true })); }
        if (pr.indices !== undefined) g.setIndex(read(pr.indices));
        const me = new THREE.Mesh(g, mat); me.name = o.name; o.add(me);
      }
      return o;
    });
    json.nodes.forEach((nd, i) => (nd.children || []).forEach(c => nodes[i].add(nodes[c])));
    const top = new THREE.Group(); top.name = 'FieldHirori';
    for (const i of json.scenes[json.scene || 0].nodes) top.add(nodes[i]);
    const get = n => { const o = top.getObjectByName(n); if (!o) throw new Error('node ' + n); return o; };
    // 動かす部位（毎フレーム探さない）。とさかは顔側から 01〜04
    const parts = { top, body: get('Hirori_Body'), legL: get('Hirori_Leg_L'), legR: get('Hirori_Leg_R'), wingL: get('Hirori_Wing_L'), wingR: get('Hirori_Wing_R'),
      crest: [1, 2, 3, 4].map(k => get('Hirori_Crest_0' + k)), eyes: ['Hirori_Eye_L', 'Hirori_Eye_R', 'Hirori_EyeHighlight_L', 'Hirori_EyeHighlight_R'].map(get), upper: new THREE.Group() };
    // 脚と足以外（頭・胴・顔・とさか・羽）を1つにまとめ、呼吸と歩く上下動をまとめて付ける
    const root = get('Hirori_Root');
    for (const o of root.children.slice()) if (o !== parts.legL && o !== parts.legR) parts.upper.add(o);
    root.add(parts.upper);
    parts.wingBase = [parts.wingL.rotation.z, parts.wingR.rotation.z];
    top.scale.setScalar(SCALE);
    top.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
    return parts;
  }
  // 入れかえ：仮ヒロリの体（影の円のほか）を隠し、Field ヒロリを足す。位置と向きは character のまま
  function attach(root, parts) {
    const pp = root.userData.parts;
    for (const o of root.children) if (o !== pp.shadow) o.visible = false;
    root.add(parts.top); P = parts; active = true;
  }
  function load(root) {
    if (!wanted) return Promise.resolve(false);
    return new Promise(resolve => {
      let done = false;
      const finish = ok => { if (!done) { done = true; resolve(ok); } };
      const timer = setTimeout(() => finish(false), TIMEOUT_MS);
      new THREE.FileLoader().setResponseType('arraybuffer').load(URL_GLB, buf => {
        if (done) return;
        try { const parts = parse(buf); clearTimeout(timer); if (!done) { attach(root, parts); finish(true); } }
        catch (e) { clearTimeout(timer); finish(false); }
      }, undefined, () => { clearTimeout(timer); finish(false); });
    });
  }
  // 動き：よちよち歩き。歩幅は仮ヒロリの75%（移動速度は同じなので、足を速く小さく動かす）。脚は小さく振り、体は左右へ少しだけ重心を移す
  // 待機は小さな呼吸。羽は小さく揺れ、とさかは少し遅れて揺れる。reduced-motion では、左右の揺れ・飾りの上下動・羽・とさかを止める
  const STRIDE = STRIDE_UNITS * .75, WING_FLAP = .17, WING_IDLE = .03;   // 羽：歩くときの上・外への振れ（約10°）、待機の呼吸（約1.7°）
  function update(root, dt, t, moving) {
    const m = hiroriMotion, reduce = reduceMotionQuery.matches, deco = reduce ? 0 : 1, lift = reduce ? 0 : 1;
    m.walkBlend += ((moving ? 1 : 0) - m.walkBlend) * (1 - Math.exp(-10 * dt));
    const w = m.walkBlend;
    if (moving) m.phase += dt * SPEED * (Math.PI * 2) / STRIDE;
    const s = Math.sin(m.phase);
    P.legL.rotation.x = s * (reduce ? .2 : .3) * w;
    P.legR.rotation.x = -s * (reduce ? .2 : .3) * w;
    const breath = Math.sin(t * 2.0);
    P.upper.position.y = (breath * .006 * (1 - w) + Math.abs(s) * .01 * w) * lift;
    P.upper.scale.y = 1 + breath * .012 * (1 - w) * deco;
    P.upper.rotation.z = s * .07 * w * deco;          // 左右へ少しだけ重心を移す（よちよち）
    P.upper.position.x = s * .008 * w * deco;
    // 羽：歩くあいだだけ、左右いっしょに上・外へ小さくパタパタ（約10°。待機の角度より下へは振らない）。待機中は呼吸ほど（2°以下）
    const flap = (.5 - .5 * Math.cos(m.phase * 2)) * WING_FLAP * w + (.5 - .5 * Math.cos(t * 1.6)) * WING_IDLE * (1 - w);
    P.wingL.rotation.z = P.wingBase[0] + flap * deco;
    P.wingR.rotation.z = P.wingBase[1] - flap * deco;
    for (let i = 0; i < 4; i++) P.crest[i].rotation.x = (Math.sin(t * 1.2 - .5 - i * .35) * .04 * (1 - w) + Math.sin(m.phase * 2 - 1.1 - i * .4) * .07 * w) * deco;
    // 到着：小さく跳ね、羽が少し開く（1回だけ）
    let hop = 0;
    if (m.arrivalT >= 0) {
      m.arrivalT += dt;
      const u = Math.min(m.arrivalT / ARRIVAL_SEC, 1), k = Math.sin(Math.PI * u);
      hop = k * .16 * lift;
      P.wingL.rotation.z += k * .35 * deco; P.wingR.rotation.z -= k * .35 * deco;
      if (u >= 1) m.arrivalT = -1;
    }
    root.position.y = hop;
    const sh = root.userData.parts.shadow;
    sh.position.y = .012 - hop; sh.scale.setScalar(.42 * (1 - hop));
    // まばたき：数秒に一度（目とハイライトを縦につぶす）
    if (m.blinkT < 0) { m.blinkIn -= dt; if (m.blinkIn <= 0) { m.blinkT = 0; m.blinkIn = 2.5 + Math.random() * 3; } }
    let eyeY = 1;
    if (m.blinkT >= 0) { m.blinkT += dt; eyeY = m.blinkT < .14 ? Math.max(.12, Math.abs(1 - m.blinkT / .07)) : 1; if (m.blinkT >= .14) m.blinkT = -1; }
    for (let i = 0; i < 4; i++) P.eyes[i].scale.y = eyeY;
  }
  return { load, update, active: () => active, parse };
})();
fieldHirori.ready = fieldHirori.load(character);
// FIELD-HIRORI-END
`],
  [`  padding:20px 20px 36px; pointer-events:all;
  transform:translateY(100%); transition:transform .4s cubic-bezier(.22,.68,0,1.2);
  max-height:82vh; overflow-y:auto; box-shadow:0 -4px 24px rgba(0,0,0,.14);
}
.panel.show { transform:translateY(0); }`,
   `  padding:20px 20px calc(36px + env(safe-area-inset-bottom, 0px)); pointer-events:all;
  transform:translateY(100%); transition:transform .4s cubic-bezier(.22,.68,0,1.2), visibility 0s linear .4s;
  max-height:82vh; overflow-y:auto; box-shadow:0 -4px 24px rgba(0,0,0,.14);
  /* PANEL-HIDE（Step 11L-C）：iPhone はキーボードを出すときページを上へずらすので、下へずらしただけのパネルが画面に入ってしまう。
     出ていないパネルは見えなくする（下へ戻る動きの 0.4 秒のあとに消える） */
  visibility:hidden;
}
.panel.show { transform:translateY(0); visibility:visible; transition:transform .4s cubic-bezier(.22,.68,0,1.2), visibility 0s; }`],
  [`function applyUI() {
  stopVoice();
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('show'));`,
   `function applyUI() {
  stopVoice();
  document.querySelectorAll('.panel').forEach(p => { p.classList.remove('show'); p.inert = true; p.setAttribute('aria-hidden', 'true'); });   // PANEL-HIDE（Step 11L-C）
  resetPageScroll();`],
  [`function openPanel(id) {
  requestAnimationFrame(() => document.getElementById(id).classList.add('show'));
}`,
   `function openPanel(id) {
  const el = document.getElementById(id), at = state;
  el.inert = false; el.removeAttribute('aria-hidden');
  requestAnimationFrame(() => { if (state === at) { el.classList.add('show'); const f = el.querySelector('[data-autofocus]'); if (f) f.focus({ preventScroll: true }); } });   // PANEL-HIDE（Step 11L-C）：状態が先へ進んでいたら出さない。data-autofocus があれば、出したあとそこへフォーカス（Step 11M）
}

// PANEL-HIDE（Step 11L-C）：iPhone のキーボードでずれたページを、元の位置（いちばん上）へ戻す。3D の画面とパネルの位置をそろえる
function resetPageScroll() {
  if (window.scrollY || document.scrollingElement.scrollTop) { window.scrollTo(0, 0); document.scrollingElement.scrollTop = 0; }
}
// 入力欄からフォーカスが外れたら（キーボードが閉じたら）、ずれたページを戻す。別の入力欄へ移っただけのときは戻さない
document.addEventListener('focusout', e => {
  if (!e.target || !/^(TEXTAREA|INPUT)$/.test(e.target.tagName)) return;
  setTimeout(() => { const a = document.activeElement; if (!a || !/^(TEXTAREA|INPUT)$/.test(a.tagName)) resetPageScroll(); }, 60);
});`],
  [`window.toSecretText = ()=>setState(S.SECRET_UNLOCKED);
window.toDemoEnd   = ()=>{ nextGroup.visible=true; setState(S.DEMO_COMPLETE); };

`,
   `// WORD-EXPAND-BEGIN（Step 11L-D：深掘りの答えを受けとめて、ことばを一段広げる。test-word-expansion.mjs がこの範囲を取り出して確かめる）
// 端末の中だけで考える（通信しない・保存しない）。子どもの答えを復唱して終わらず、見る観点・程度・理由へ一段深める
const EXPAND_ONE_KNOWN = {   // 意味のある1文字：ことばを足す例
  '赤': ['赤い色', '明るい赤', '燃えるような赤'], '青': ['青い色', '澄んだ青', '深い青'], '黄': ['黄色い色', '明るい黄色', 'やさしい黄色'],
  '白': ['白い色', 'まっ白', 'やわらかな白'], '黒': ['黒い色', 'つやのある黒', '深い黒'], '緑': ['緑の色', '明るい緑', '深い緑'],
  '丸': ['丸い形', 'ころんと丸い', 'やわらかく丸い'], '光': ['やさしい光', 'きらきらした光', 'あたたかい光'], '色': ['明るい色', 'あたたかい色', '目をひく色'],
  '形': ['丸い形', 'ふっくらした形', 'すっきりした形'], '目': ['大きな目', 'まんまるの目', 'やさしい目'], '花': ['小さな花', '明るい花', 'ひらいた花'],
  '空': ['青い空', '広い空', '明るい空'], '星': ['光る星', '小さな星', 'きらきらした星'], '羽': ['大きな羽', 'ふわふわの羽', 'きれいな羽'],
};
const EXPAND_START = [['色を足す', '色が'], ['形を足す', '形が'], ['気持ちを足す', '見ていると']];   // 読みとれない1文字のとき：続きの書き出し
const EXPAND_PLACEHOLDER = '思ったことを書いてみよう';
const EXPAND_ASPECTS = {   // 観点ごとの、考えを一段深めるひとこと（復唱しない）と、ふつうの候補
  color: { insight: '色の明るさやあたたかさまで見ると、もっと詳しく伝えられそう。', move: 'detail', words: ['明るい色', 'あたたかみのある色', '目をひく色合い'] },
  shape: { insight: '輪郭や大きさに注目すると、形の特徴が見えてきそう。', move: 'detail', words: ['ころんと丸い', 'やわらかな輪郭', 'ふっくらした形'] },
  motion: { insight: '速さや動き方を加えると、見た様子が浮かんでくるよ。', move: 'detail', words: ['軽やかに動く', 'ふわりと揺れる', '元気よく動く'] },
  feeling: { insight: 'そう感じた理由を探すと、自分だけの発見になるよ。', move: 'reason', words: ['心がはずむ', 'ほっとする', '見ているとうれしくなる'] },
  story: { insight: '見えたことと想像したことを分けると、物語がもっと伝わるよ。', move: 'imagination', words: ['今にも動き出しそう', '何かを伝えたそう', 'この先に物語がありそう'] },
};
const EXPAND_KEYS = [   // 入力のことばから観点を読む（上から順に見る）
  ['story', /そう|みたい|ように|気がする|想像|かも/], ['motion', /動|走|歩|飛|揺|跳|ゆっくり|はや|速|のんびり|そっと/],
  ['color', /赤|青|黄|白|黒|緑|ピンク|色|明る|暗|きらきら|光/], ['shape', /丸|形|大き|小さ|長|細|太|ふわ|ふっくら|輪郭|とが/],
  ['feeling', /うれし|楽し|寂し|さびし|悲し|かなし|怖|こわ|安心|好き|嫌|ほっと|ドキドキ|わくわく/],
];
const EXPAND_SPECIAL = [   // とくに、そのことばに合わせた一歩
  [/寝|眠/, { insight: '姿から気持ちを想像できているね。見たことと考えたことを分けると、もっと伝わるよ。', move: 'evidence', words: ['体を丸めて眠っていた', '安心して休んでいるようだ', '静かな寝姿に見えた'] }],
  [/寂し|さびし|悲し|かなし/, { insight: '表情や姿勢のどこから、そう感じたのだろう？', move: 'evidence', words: ['うつむいて見えた', 'ひとりで心細そう', '静かな表情に見えた'] }],
  [/ゆっくり|のんびり/, { insight: '速さに気づくと、その生き物の気分まで想像できそう。', move: 'detail', words: ['のんびり動いていた', 'そっと進んでいた', '落ち着いて歩いていた'] }],
  [/赤/, { insight: '同じ赤でも、明るさや深さで印象が変わるよ。', move: 'compare', words: ['明るく鮮やかな赤', 'あたたかみのある赤', '深く落ち着いた赤'] }],
  [/青/, { insight: '同じ青でも、明るさや深さで印象が変わるよ。', move: 'compare', words: ['空のように明るい青', '澄んだ青', '深く落ち着いた青'] }],
  [/丸.*(可愛|かわい)|(可愛|かわい).*丸/, { insight: '丸さが、やわらかく親しみやすい印象を作っているのかも。', move: 'detail', words: ['ころんと丸くて可愛い', 'ふっくらして愛らしい', 'やわらかな輪郭が可愛い'] }],
];
// 感想だけの答え（何がそう感じさせたのか、観点へ戻す）
const EXPAND_VAGUE = /^(とても|すごく|すっごく|めっちゃ|超|ちょっと)?(可愛い|かわいい|カワイイ|きれい|綺麗|キレイ|すごい|スゴイ|やばい|ヤバい|いい|よい|好き|すき|面白い|おもしろい|かっこいい|カッコいい|素敵|すてき)(と思った|かった|な|ね|！|!)*$/;
const EXPAND_ASK = [['shape', '形が'], ['color', '色が'], ['motion', '動きや様子が']];

// 答えを見分ける：送らせない／ことばを足してもらう／観点を聞く／広げる
function classifyAnswer(text) {
  const t = String(text == null ? '' : text).trim(), chars = Array.from(t);
  if (!t) return { kind: 'empty' };
  if (t === EXPAND_PLACEHOLDER) return { kind: 'placeholder' };
  if (!/[\\p{L}\\p{N}]/u.test(t)) return { kind: 'symbol' };                         // 記号・句読点・絵文字だけ
  const letters = chars.filter(ch => /[\\p{L}\\p{N}]/u.test(ch));
  if (letters.length >= 2 && new Set(letters).size === 1) return { kind: 'repeat' };  // 同じ文字だけ
  if (letters.length === 1) return EXPAND_ONE_KNOWN[letters[0]] ? { kind: 'one-known', ch: letters[0], words: EXPAND_ONE_KNOWN[letters[0]] } : { kind: 'one-unknown' };
  if (EXPAND_VAGUE.test(t.replace(/\\s/g, ''))) return { kind: 'vague', text: t };
  return { kind: 'ok', text: t };
}
// 観点を決める：入力のことば → 選んだカードの種類（feeling / observation / story）
function aspectOf(text, mode) {
  for (const [k, re] of EXPAND_KEYS) if (re.test(text)) return k;
  return mode === 'feeling' ? 'feeling' : mode === 'story' ? 'story' : 'shape';
}
// 一歩深めることばと、3つの候補
function expandAnswer(text, mode, aspect) {
  for (const [re, v] of EXPAND_SPECIAL) if (re.test(text) && (!aspect || aspect === aspectOf(text, mode))) return v;
  const a = EXPAND_ASPECTS[aspect || aspectOf(text, mode)];
  // 感想（可愛い・きれい など）があれば、観点の候補に足す（例：ころんと丸い → ころんと丸くて可愛い）
  const fm = text.match(/可愛|かわい|きれい|綺麗|素敵|すてき/);
  if (fm && (aspect === 'shape' || aspect === 'color')) {
    const tail = /可愛|かわい/.test(fm[0]) ? '可愛い' : /素敵|すてき/.test(fm[0]) ? '素敵' : 'きれい';
    const words = aspect === 'shape' ? ['ころんと丸くて' + tail, 'ふっくらして' + tail, 'やわらかな輪郭が' + tail] : ['明るい色が' + tail, 'あたたかい色が' + tail, '目をひく色合いが' + tail];
    return { insight: a.insight, move: a.move, words };
  }
  return a;
}
// 決めたあとのことば
function finalLine(original, chosen) {
  const o = Array.from(original), short = o.length > 22 ? o.slice(0, 22).join('') + '…' : original;
  return chosen ? '「' + short + '」から「' + chosen + '」へ、ことばが広がった！' : '「' + short + '」。きみが見つけた、大切なことばだね。';
}
// WORD-EXPAND-END
// QUEST-CORE-BEGIN（Step 11M：クエストと道くさの「定義」と「進み方」。THREE も画面も通信も使わない。test-quests.mjs がこの範囲を取り出して確かめる）
// 定義：この表へ足すだけで、クエスト・道くさ・入手品を増やせる。位置は歩ける範囲（草原のだ円）の中で、祠・門・出発点から離す
const QUEST_DEFS = Object.freeze([
  { id: 'first', title: 'はじめての冒険' },
  { id: 'second', title: 'ちがうところから、見てみよう', after: 'first', needsWorldV2: true,
    start: { x: 14.2, z: -25.4, r: 1.3 },   // ことばの樹のそばの新しい芽（樹のまわりの、平らで歩ける輪の中。道の側なので、帰り道が幹にかからない）
    sub: 'さっきとちがうところに、目を向けてみよう。同じ写真でも大丈夫。',
    question: '今度は、どこに目が止まった？', flowers: 6, reward: 'ことばの樹に、2つ目の実が灯った！' },
]);
// 観点：前のクエストで使った観点を外して、別の3つを「たとえば」として出す（押しつけない。書き出しを入れるだけ）
const VIEWPOINTS = Object.freeze({
  color: ['色', '色が'], shape: ['形', '形が'], motion: ['動き', '動きが'], sound: ['音', '音が'], smell: ['におい', 'においが'], feeling: ['気持ち', '見ていると'],
});
const VIEWPOINT_ORDER = ['color', 'shape', 'motion', 'sound', 'smell'];
const VIEWPOINT_KEYS = [
  ['smell', /におい|匂|香り|かおり/], ['sound', /音|声|鳴|聞こえ|しずか|静か/], ['motion', /動|走|歩|飛|揺|跳|ゆっくり|はや|速|のんびり|そっと|パタパタ|ぱたぱた/],
  ['color', /色|赤|青|黄|白|黒|緑|ピンク|明る|暗|きらきら|光/], ['shape', /丸|形|大き|小さ|長|細|太|ふわ|ふっくら|輪郭|とが|四角|しかく/],
  ['feeling', /うれし|楽し|寂し|さびし|悲し|怖|こわ|安心|好き|嫌|ほっと|ドキドキ|わくわく|可愛|かわい/],
];
// 道くさ：近づくと気配の案内が出て、「調べる」を押したときだけ問いが出る。香りは文と演出で想像する遊び（本物のにおいは出ない）
// 位置は、ふだんのカメラとヒロリのあいだに木が入らない場所（草原の東側。木陰は木の手前、花のそばは花の群れの横）
const DETOUR_DEFS = Object.freeze([
  { id: 'grass', place: '草むら', x: 15.0, z: -3.5, hint: 'どこからか、甘い香りがする…', question: 'どんなものの香りに似ている？',
    item: { id: 'kaori-no-mi', name: 'かおりの実', icon: '🍑' }, starters: ['くだもののような', 'お菓子のような', '花のような'],
    reaction: '思い出の中の香りは、そのときの景色までつれてくることがあるよ。',
    cover: [['Grass_C', .5, .55, 1.25], ['Bush_B', -.45, .7, 1.05], ['Grass_A', .05, 1.0, 1.15]] },
  { id: 'shade', place: '木陰', x: 10.5, z: 3.0, hint: 'すっと、さわやかな香りがする…', question: 'この香りから、何を思い浮かべる？',
    item: { id: 'soyokaze-no-ha', name: 'そよかぜの葉', icon: '🍃' }, starters: ['雨あがりの', '森の中の', '朝の'],
    reaction: '香りから浮かぶ景色は、人によってちがうところがおもしろいね。',
    cover: [['Bush_A', -.6, .6, 1.1], ['Grass_B', .55, .75, 1.1]] },
  { id: 'flower', place: '花のそば', x: 6.3, z: -1.8, hint: 'ふしぎな香りの花を見つけた', question: 'この香りに、名前をつけるなら？',
    item: { id: 'namae-no-hana', name: 'なまえの花', icon: '🌼' }, starters: ['〇〇の香り', 'ふわっとした', 'ひみつの'],
    reaction: '名前をつけると、その香りがきみだけの発見になるね。',
    cover: [['Flowers_B', .55, .45, 1.2], ['Flowers_A', -.5, .6, 1.15], ['Grass_A', 0, .95, 1.1]] },
]);
const DETOUR_NEAR_R = 2.4;    // この距離まで近づくと、気配の案内を出す
const DETOUR_LEAVE_R = 4.0;   // 「あとで」で閉じた場所は、この距離まで離れるまで案内しない（同じ案内を何度も出さない）

// 進み方：クエストは locked → available → active → done、道くさは 取得済みかどうか。どれも一方向で、二重に進まない
function createQuestState() {
  return { quests: { first: 'active', second: 'locked' }, records: {}, detours: {}, dismissed: {} };
}
function questEvent(st, ev, a) {
  const q = st.quests;
  if (ev === 'firstDone') { if (q.first !== 'active') return false; q.first = 'done'; if (q.second === 'locked') q.second = 'available'; return true; }
  if (ev === 'secondStart') { if (q.second !== 'available') return false; q.second = 'active'; return true; }
  if (ev === 'secondDone') { if (q.second !== 'active') return false; q.second = 'done'; return true; }
  if (ev === 'record') {   // クエストで書いたこと（進行中のクエストに1回だけ。あとから上書きしない）
    if (q[a.id] !== 'active' || st.records[a.id]) return false;
    st.records[a.id] = { expression: a.expression || '', word: a.word || '', answer: a.answer || '', chosen: a.chosen || null, skipped: !!a.skipped };
    return true;
  }
  if (ev === 'detour') {   // 道くさの入手（最初のクエストのあと・まだ取っていない場所だけ）
    if (q.first !== 'done' || st.detours[a.id] || !DETOUR_DEFS.some(d => d.id === a.id)) return false;
    st.detours[a.id] = { words: a.words, phrase: a.phrase || null };
    return true;
  }
  return false;
}
function detoursOpen(st) { return st.quests.first === 'done'; }
// いちばん近い1か所だけ（取得済み・「あとで」で閉じたばかりの場所は外す）
function nearestDetour(st, x, z) {
  let best = null, bd = DETOUR_NEAR_R;
  for (const d of DETOUR_DEFS) {
    if (st.detours[d.id] || st.dismissed[d.id]) continue;
    const dist = Math.hypot(x - d.x, z - d.z);
    if (dist <= bd) { bd = dist; best = d; }
  }
  return best;
}
// 「あとで」で閉じた場所は、十分に離れたら、また案内してよい
function releaseDismissed(st, x, z) {
  for (const d of DETOUR_DEFS) if (st.dismissed[d.id] && Math.hypot(x - d.x, z - d.z) > DETOUR_LEAVE_R) delete st.dismissed[d.id];
}
function viewpointOf(text) {
  for (const [k, re] of VIEWPOINT_KEYS) if (re.test(String(text || ''))) return k;
  return null;
}
// 前に書いたことの観点を外して、「たとえば」の3つ
function suggestViewpoints(prevText) {
  const used = viewpointOf(prevText);
  return VIEWPOINT_ORDER.filter(k => k !== used).slice(0, 3);
}
// 道くさの答え：短くても、意味のある答え（「桃」「雨」）は受け取る。記号だけ・同じ文字だけ・ひらがな1文字は、書き足しの案内
function classifyDetourAnswer(text) {
  const t = String(text == null ? '' : text).trim();
  if (!t) return 'empty';
  const letters = Array.from(t).filter(ch => /[\\p{L}\\p{N}]/u.test(ch));
  if (!letters.length) return 'symbol';
  // 同じ文字だけ：3文字以上か、「ああ」「んん」「ww」のような2文字（「もも」「ねね」は言葉なので受け取る）
  if (new Set(letters).size === 1 && (letters.length >= 3 || (letters.length === 2 && /[ぁあぃいぅうぇえぉおんっーwｗ]/.test(letters[0])))) return 'repeat';
  if (letters.length === 1 && !/\\p{Script=Han}/u.test(letters[0])) return 'short';
  return 'ok';
}
// QUEST-CORE-END
// WORD-EXPAND-UI（Step 11L-D）：同じパネルの中で、問い → 受けとめと候補 → 決定 の順に切りかえる（同時に2つの問いを出さない）。文字はすべて textContent
let secretDone = false;   // ことばを決めて、タネへ進んだか（二重に進まない）
const secretEl = id => document.getElementById(id);
const secretQuestionParts = () => [secretEl('secret-t-title'), document.querySelector('#panel-secret-t .panel-desc'), secretEl('secret-input'), secretEl('btn-secret-next')];
function secretBox(id) {   // パネルの中の、入れかえる場所（はじめて使うときに作る）
  let b = secretEl(id);
  if (!b) { b = document.createElement('div'); b.id = id; secretEl('panel-secret-t').appendChild(b); }
  return b;
}
function secretChip(text, cls, onPick) {
  const b = document.createElement('button'); b.type = 'button'; b.className = cls; b.textContent = text;
  b.addEventListener('click', onPick); return b;
}
// 送らせないときの、やさしい案内（エラーとは言わない）。入力欄の下に出す
function showSecretHint(c) {
  const box = secretBox('secret-hint'); box.replaceChildren(); box.className = 'secret-hint';
  const line = (t, cls) => { const d = document.createElement('div'); d.className = cls; d.textContent = t; box.appendChild(d); };
  const input = secretEl('secret-input');
  const fill = v => () => { input.value = v; input.dispatchEvent(new Event('input', { bubbles: true })); input.focus(); };
  if (c.kind === 'one-known') {
    line('「' + c.ch + '」って感じたんだね。もうひとこと足すと、もっと伝わりそう！', 'secret-hint-text');
    const row = document.createElement('div'); row.className = 'secret-chips';
    c.words.forEach(w => row.appendChild(secretChip(w, 'secret-chip', fill(w)))); box.appendChild(row);
  } else {
    line('もうひとことだけ、教えてほしいな。色・形・動き・気持ちのどれかを足してみよう。', 'secret-hint-text');
    const row = document.createElement('div'); row.className = 'secret-chips';
    EXPAND_START.forEach(([label, start]) => row.appendChild(secretChip(label, 'secret-chip', fill(start)))); box.appendChild(row);
  }
  box.style.display = '';
}
// 受けとめて、ことばを広げる：観点がまだ無い感想だけの答えは、先に「どこが？」を選んでもらう
function showExpansion(text, c, ai) {
  secretQuestionParts().forEach(e => { if (e) e.style.display = 'none'; });
  const hint = secretEl('secret-hint'); if (hint) hint.style.display = 'none';
  const box = secretBox('secret-expand'); box.style.display = ''; box.replaceChildren();
  const mode = (_vocabResult && _vocabResult.responseMode) || 'observation';
  const add = (tag, cls, t) => { const e = document.createElement(tag); e.className = cls; e.textContent = t; box.appendChild(e); return e; };
  if (c.kind === 'vague') {
    add('div', 'panel-title secret-insight', 'どんなところが、そう感じさせたのかな？');
    add('div', 'panel-desc', '形、色、動きのどれに近い？');
    EXPAND_ASK.forEach(([aspect, label]) => box.appendChild(secretChip(label + text.replace(/[！!。]+$/, ''), 'word-card secret-choice', () => showCandidates(text, mode, aspect))));
    return;
  }
  showCandidates(text, mode, null, ai);
}
// ai があれば AI の受けとめと3つの言い方、なければ端末内の処理。画面の形（ボタンの数・順番）はどちらも同じ
function showCandidates(text, mode, aspect, ai) {
  const box = secretBox('secret-expand'); box.replaceChildren();
  const ex = ai ? { insight: ai.reflection, move: ai.axis, words: ai.candidates } : expandAnswer(text, mode, aspect);
  const add = (tag, cls, t) => { const e = document.createElement(tag); e.className = cls; e.textContent = t; box.appendChild(e); return e; };
  add('div', 'panel-title secret-insight', ex.insight);
  add('div', 'panel-desc', 'こんな言い方もできそう。いちばん近いものはある？');
  let picked = null;
  const ok = secretChip('これにする', 'btn-primary btn-disabled', () => { if (picked) confirmSecretWord(text, picked.word); });
  const options = ex.words.map(w => ({ word: w, label: w })).concat([{ word: null, label: '自分の言葉のまま' }]);
  options.forEach(o => {
    const b = secretChip(o.label, 'word-card secret-choice', () => {
      box.querySelectorAll('.secret-choice').forEach(x => x.classList.remove('selected'));
      b.classList.add('selected'); picked = o; ok.classList.remove('btn-disabled');
    });
    box.appendChild(b);
  });
  box.appendChild(ok);
}
// 決めた：ことばが広がったことを伝えてから、パネルを閉じてタネへ進む
function confirmSecretWord(text, chosen) {
  if (secretDone || state !== S.SECRET_UNLOCKED) return;
  const box = secretBox('secret-expand'); box.replaceChildren();
  const d = document.createElement('div'); d.className = 'panel-title secret-insight'; d.textContent = finalLine(text, chosen); box.appendChild(d);
  questHub.noteAnswer(text, chosen);   // 書いた答えと選んだ言い方を、いまのクエストの記録へ（Step 11M）
  worldTimeout(finishSecret, 1600);
}
// 問いの画面を最初の形へ戻す（答える画面へ入るたび・リセット）
function restoreSecretPanel() {
  secretSent = false; secretDone = false;
  _expandGen++; cancelExpansion(); secretEl('secret-input').readOnly = false;   // 送っている途中の答えは、もう画面に出さない
  secretQuestionParts().forEach(e => { if (e) e.style.display = ''; });
  for (const id of ['secret-hint', 'secret-expand', 'secret-wait', 'secret-care']) { const b = secretEl(id); if (b) { b.replaceChildren(); b.style.display = 'none'; } }
}
// AI の返事を待つ間：送るボタンのすぐ下に「ことばを探しているよ」（答えは入力欄に残す）
function showSecretWait(on) {
  const box = secretBox('secret-wait'); box.className = 'secret-wait';
  box.setAttribute('role', 'status');
  box.textContent = on ? 'ことばを探しているよ' : '';
  box.style.display = on ? '' : 'none';
}
// 深掘りの答えの care：候補・タネへは進まない。責めずに、信頼できる大人へ話すことをすすめ、入力へ戻る出口を置く
function showSecretCare(urgent) {
  secretQuestionParts().forEach(e => { if (e) e.style.display = 'none'; });
  for (const id of ['secret-hint', 'secret-expand', 'secret-wait']) { const b = secretEl(id); if (b) { b.replaceChildren(); b.style.display = 'none'; } }
  const box = secretBox('secret-care'); box.className = 'secret-care'; box.replaceChildren(); box.style.display = '';
  const line = (t, cls) => { const d = document.createElement('div'); d.className = cls; d.textContent = t; box.appendChild(d); };
  if (urgent) line(URGENT_CARE_MESSAGE, 'care-msg care-urgent');   // 差し迫った危険のときは、すぐ知らせる案内を先に
  line(CARE_SUPPORT_MESSAGE.replace(/。(?=.)/g, '。\\n'), 'care-msg');
  const back = secretChip('入力にもどる', 'btn-care btn-care-rewrite', () => {
    restoreSecretPanel();
    const input = secretEl('secret-input'); input.value = ''; secretEl('btn-secret-next').classList.add('btn-disabled'); input.focus();
  });
  box.appendChild(back);
}
let secretSent = false;   // 深掘りの答えを送ったか（二重に送らない：Step 11L-C）
window.toSecretText = ()=>{ restoreSecretPanel(); setState(S.SECRET_UNLOCKED); };
window.toDemoEnd   = ()=>{   // 「今は進む」：答えなくても進める（答えた扱いにはしない）
  if(state !== S.SECRET_QUESTION) return;
  questHub.noteAnswer('', null, true);
  if(questHub.current() === 'second'){ questHub.finishSecond(); return; }
  nextGroup.visible=true; setState(S.DEMO_COMPLETE);
};

`],
  [`window.revealSecret = ()=>{
  if(!document.getElementById('secret-input').value.trim()) return;
  // 追加の花
`,
   `window.revealSecret = ()=>{
  const text = document.getElementById('secret-input').value.trim();
  if(!text) return;
  if(state !== S.SECRET_UNLOCKED || secretSent) return;   // 1回だけ（連打・Enter と押す の重なりを受けない）
  const input = document.getElementById('secret-input');
  const settle = () => { secretSent = true; input.blur(); document.getElementById('btn-secret-next').classList.add('btn-disabled'); resetPageScroll(); };
  // 明らかな危険を示す答えは、送る前に端末内で care にする（通信できなくても、ふつうの候補・タネへ進めない）
  const care = localExpandCare({ expression: enteredText, answer: text });
  if(care){ settle(); showSecretCare(care.urgent); return; }
  const c = classifyAnswer(text);
  if(c.kind !== 'ok' && c.kind !== 'vague'){ showSecretHint(c); return; }   // まだ進まない：ことばを足してもらう（エラーとは言わない）
  settle();
  // 受けとめて、ことばを一段広げる。タネは、ことばを決めたあとに生まれる（finishSecret）
  if(c.kind !== 'ok'){ showExpansion(text, c); return; }   // 感想だけの答えは、端末内で先に「どこが？」を聞く
  // くわしい答えは AI へ1回だけ送る（最大5秒）。待つ間は同じパネルに「ことばを探しているよ」。失敗したら端末内の処理
  const gen = _expandGen;
  input.readOnly = true; showSecretWait(true);
  fetchExpansion({ expression: enteredText, word: chosenWord, question: document.getElementById('secret-t-title').textContent, answer: text }).then(ai => {
    if(gen !== _expandGen || state !== S.SECRET_UNLOCKED || secretDone) return;   // リセット・やり直しのあとに届いた答えは使わない
    input.readOnly = false; showSecretWait(false);
    if(ai && ai.care){ showSecretCare(ai.urgent); return; }   // AI（第二段階）が care と判断したとき
    showExpansion(text, c, ai);
  });
};
// ことばを決めたあと：質問パネルを閉じ、花を咲かせて、タネへ進む（1回だけ）
function finishSecret(){
  if(state !== S.SECRET_UNLOCKED || secretDone) return;
  secretDone = true;
  const sp = document.getElementById('panel-secret-t');
  sp.classList.remove('show'); sp.inert = true; sp.setAttribute('aria-hidden', 'true');
  resetPageScroll();
  if(questHub.current() === 'second'){ questHub.finishSecond(); return; }   // 第2クエスト：樹の2つ目の実と、芽のまわりの花（Step 11M）
  // 追加の花
`],
  [`document.getElementById('secret-input').addEventListener('input',function(){`,
   `document.getElementById('secret-input').addEventListener('keydown', e => {   // Enter で送る。日本語の変換を確定する Enter では送らない
  if (e.key !== 'Enter' || e.shiftKey || e.isComposing || e.keyCode === 229) return;
  e.preventDefault(); window.revealSecret();
});
document.getElementById('secret-input').addEventListener('input',function(){`],
  [`  document.getElementById('btn-secret-next').classList.add('btn-disabled');
  document.getElementById('inp-cam').value='';`,
   `  document.getElementById('btn-secret-next').classList.add('btn-disabled'); restoreSecretPanel();
  document.getElementById('inp-cam').value='';`],
  [`.panel-note { font-size:11px; color:#9a8860; text-align:center; margin-top:6px; }
`,
   `.panel-note { font-size:11px; color:#9a8860; text-align:center; margin-top:6px; }

/* WORD-EXPAND（Step 11L-D）：深掘りの答えを広げる段階の、案内・候補・選んだしるし */
.secret-hint-text { font-size:14px; color:#6a5840; text-align:center; line-height:1.6; margin:2px 0 8px; }
.secret-chips { display:flex; flex-wrap:wrap; gap:8px; justify-content:center; margin-bottom:12px; }
.secret-chip { min-height:44px; padding:8px 14px; border:2px solid #c8b87a; border-radius:22px; background:#fff; color:#5a4830; font-size:14px; cursor:pointer; }
.secret-chip:focus-visible, .secret-choice:focus-visible { outline:3px solid #3a3328; outline-offset:3px; }
.secret-insight { font-size:16px; }
/* Step 11L-G：AI の返事を待つ間のひとこと（同じパネルの中・動かさない）と、深掘りの答えの care */
.secret-wait { font-size:14px; color:#6a5840; text-align:center; margin-top:10px; }
.secret-care { padding:16px; background:#fff8f0; border:2px solid #f0c080; border-radius:14px; text-align:center; }
.secret-care .care-urgent { font-weight:bold; color:#7a2810; }
.secret-choice { display:block; width:100%; text-align:left; font-size:16px; font-weight:bold; color:#3a7a28; margin-bottom:10px; font-family:inherit; }
/* Step 11M：見つけたもの（ボタンと画面）・道くさ（気配の案内と問い） */
#btn-found {
  position:absolute; right:max(12px, env(safe-area-inset-right)); bottom:max(14px, env(safe-area-inset-bottom));
  min-height:44px; padding:8px 14px; background:rgba(254,249,240,.92); border:1.5px solid #c8b87a; border-radius:22px;
  color:#5a4830; font-size:13px; font-weight:bold; cursor:pointer; pointer-events:all; display:none;
}
#btn-found.show { display:block; }
#detour-call {
  position:absolute; left:50%; bottom:calc(70px + env(safe-area-inset-bottom, 0px)); transform:translateX(-50%);
  width:max-content; max-width:calc(100vw - 32px); display:none; align-items:center; gap:10px;
  background:rgba(254,249,240,.95); border:2px solid #e8d4a0; border-radius:18px; padding:8px 8px 8px 14px;
  color:#5a4830; font-size:14px; box-shadow:0 2px 12px rgba(0,0,0,.12); pointer-events:all;
}
#detour-call.show { display:flex; }
#detour-call button { min-height:44px; padding:8px 16px; border:none; border-radius:14px; background:#7ab648; color:#fff; font-size:14px; font-weight:bold; cursor:pointer; flex:none; }
#btn-found:focus-visible, #detour-call button:focus-visible { outline:3px solid #3a3328; outline-offset:3px; }
.detour-note { font-size:12px; color:#8a7650; text-align:center; margin:-2px 0 10px; }
.detour-question { font-weight:bold; color:#3a3328; margin-bottom:12px; }
.detour-item { display:flex; gap:12px; align-items:center; padding:12px 14px; background:#fff; border:2px solid #e8d4a0; border-radius:16px; margin:10px 0 12px; }
.detour-item-icon { font-size:30px; flex:none; }
.detour-item-name { font-size:15px; font-weight:bold; color:#3a3328; }
.detour-item-words { font-size:14px; color:#5a4830; margin-top:2px; }
.found-empty { font-size:14px; color:#6a5840; text-align:center; line-height:1.7; margin:8px 0 16px; }
.found-section { font-size:13px; font-weight:bold; color:#8a7650; margin:12px 0 4px; }
#expr-viewpoints { margin:0 0 10px; }
`],
  [`  <button id="btn-back"  onclick="window.location.href='index.html'">← アプリへ</button>`,
   `  <button id="btn-back"  onclick="window.location.href='../tomori-lp/'">← 紹介ページへ</button>`],
  [`// VOCAB-CORE-END

`,
   `// VOCAB-CORE-END
// EXPAND-AI-BEGIN（Step 11L-F・11L-G：深掘りの答えを Worker の /expand へ1回だけ送り、受けとめのひとことと3つの言い方をもらう。
// 5秒で返らない・429・通信の失敗・JSON でない・決まりに合わない ときは、作り直さずに null を返す（画面は端末内の処理を使う）。
// 明らかな危険を示す答えは、送る前に端末内で care にする（通信できなくても、ふつうの候補へ変えない）。
// 送るのは、最初の入力・選んだ語彙カード・深掘りの問い・深掘りの答えだけ。写真・名前・端末の情報は送らない。test-expand-ai.mjs が確かめる）
const EXPAND_API_URL = VOCABULARY_API_URL.replace(/\\/vocabulary$/, '/expand');
const EXPAND_AI_TIMEOUT_MS = 5000;
const EXPAND_AI_LIMITS = { expression: 200, word: 20, question: 60, answer: 200 };
const EXPAND_AI_AXES = new Set(['detail', 'reason', 'compare', 'evidence', 'imagination']);
const EXPAND_AI_MARKUP = /[<>]|https?:|www\\.|:\\/\\/|&[a-z#0-9]+;/i;
const EXPAND_AI_BANNED = /正解|不正解|間違|まちが|ちがうよ|違うよ|ダメ|だめ|点数|写真|写って|うつって|画像|AI|ＡＩ/;
const EXPAND_AI_PRAISE_ONLY = /^((すごい|いい|えらい|さすが|すてき|素敵)(ね|よ|な|です|だね)?)+$/;
const EXPAND_AI_BREAK = new RegExp('[\\r\\n' + String.fromCharCode(0x2028, 0x2029) + ']');
// 最初の入力と答えに無い 部位・色・手触り を足した返事は使わない（Worker の EXPAND_UNGROUNDED_WORDS と同じ）
const EXPAND_AI_UNGROUNDED = [
  '目玉', 'つぶら', '瞳', '耳', '鼻', 'くちばし', '羽', '翼', 'つばさ', 'しっぽ', '尻尾', '足', '顔', '毛並み', 'ひげ', 'おなか', '背中', '首',
  '赤', '青', '黄', '白', '黒', '緑', 'ピンク', '茶色', '金色', '銀色', 'オレンジ', '紫', '水色', '灰色',
  'ふわふわ', 'もふもふ', 'ふさふさ', 'ざらざら', 'すべすべ', 'つるつる', 'さらさら', 'ごつごつ', '手触り', '手ざわり',
].map(w => normalizeForSafety(w));
// 差し迫った危険のしるし（Worker の URGENT_CARE_PATTERNS と同じ）。care のときだけ見る
const EXPAND_URGENT_PATTERNS = [
  /(今|いま)(から|すぐ)/, /これから/,
  /(殴|なぐ)られ(てい|てる)/, /(叩|たた)かれ(てい|てる)/, /蹴られ(てい|てる)/, /(怖|こわ)いことを?され(てい|てる)/,
  /(家|いえ|うち)に(帰|かえ)るのが(怖|こわ)い/,
  /(殺|ころ)(してやる|すぞ)/, /刺してやる/,
];
const URGENT_CARE_MESSAGE = 'いま危ないと感じたら、すぐ近くの大人に知らせてね。';
let _expandAbort = null;   // 送っている途中の AbortController
let _expandGen = 0;        // 答える画面へ入るたび・リセットのたびに増える。古い応答で画面を書き換えないため

function cancelExpansion() {
  if (_expandAbort) { try { _expandAbort.abort(); } catch (e) {} _expandAbort = null; }
}
function isUrgentCare(text) {
  const s = normalizeForSafety(String(text == null ? '' : text));
  return EXPAND_URGENT_PATTERNS.some(p => p.test(s));
}
// 端末内の安全判定（正規化してから規則に当てる。語句の完全一致だけには頼らない）。当たれば { care, urgent }
function localExpandCare(fields) {
  const texts = [fields.expression, fields.answer].map(v => String(v == null ? '' : v));
  if (!texts.some(t => detectDeterministicCare(t))) return null;
  return { care: true, urgent: texts.some(isUrgentCare) };
}

// Worker と同じ決まりで確かめる。合っていれば { reflection, candidates, axis }、care なら { care, urgent }、合わなければ null
function validateExpandResponse(data, fields) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  if (data.safetyLevel === 'care') {   // Worker の care の形：{ reflection:null, candidates:[], axis:null, safetyLevel:'care', urgent, supportMessage }
    if (data.reflection !== null || data.axis !== null || !Array.isArray(data.candidates) || data.candidates.length !== 0 || typeof data.urgent !== 'boolean') return null;
    return { care: true, urgent: data.urgent };
  }
  if (data.safetyLevel !== 'normal') return null;
  if (!EXPAND_AI_AXES.has(data.axis)) return null;
  const key = s => normalizeForSafety(String(s));
  const inputs = [fields.answer, fields.word, fields.expression].map(key);
  if (typeof data.reflection !== 'string' || EXPAND_AI_BREAK.test(data.reflection)) return null;
  const reflection = data.reflection.trim(), rKey = key(reflection);
  if (!reflection || Array.from(reflection).length > 45) return null;
  if (!rKey || EXPAND_AI_PRAISE_ONLY.test(rKey)) return null;
  if (rKey === inputs[0] || (Array.from(inputs[0]).length >= 4 && rKey.includes(inputs[0]))) return null;
  if (!Array.isArray(data.candidates) || data.candidates.length !== 3) return null;
  const candidates = [];
  for (const c of data.candidates) {
    if (typeof c !== 'string' || EXPAND_AI_BREAK.test(c)) return null;
    const t = c.trim(), len = Array.from(t).length;
    if (len === 0 || len > 18 || /[、。]/.test(t) || inputs.includes(key(t))) return null;
    candidates.push(t);
  }
  if (new Set(candidates.map(key)).size !== 3) return null;
  const basis = key(fields.expression + ' ' + fields.answer);   // 事実の根拠は、最初の入力と答えだけ
  for (const t of [reflection, ...candidates]) {
    if (EXPAND_AI_MARKUP.test(t) || EXPAND_AI_BANNED.test(t) || detectDeterministicCare(t)) return null;
    const k = key(t);
    if (EXPAND_AI_UNGROUNDED.some(w => k.includes(w) && !basis.includes(w))) return null;
  }
  return { reflection, candidates, axis: data.axis };
}

async function fetchExpansion(fields) {
  cancelExpansion();
  const local = localExpandCare(fields);
  if (local) return local;   // 送らない
  if (!VOCABULARY_AI_ENABLED) return null;
  const body = {};
  for (const [k, max] of Object.entries(EXPAND_AI_LIMITS)) {
    const v = String(fields[k] == null ? '' : fields[k]).trim().slice(0, max);
    if (!v) return null;
    body[k] = v;
  }
  if (fields.scene === 'detour') body.scene = 'detour';   // 道くさ（香りを想像する問い）。Worker がプロンプトを切りかえる
  const sessionId = getVocabSessionId();
  if (!sessionId) return null;
  const abort = new AbortController();
  _expandAbort = abort;
  let timeoutId;
  // 5秒たったら、届いていなくても null で終える（あとから届いた返事は使わない）
  const timeout = new Promise(resolve => { timeoutId = setTimeout(() => { abort.abort(); resolve(null); }, EXPAND_AI_TIMEOUT_MS); });
  const work = (async () => {
    try {
      const res = await fetch(EXPAND_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tomori-Session': sessionId },
        body: JSON.stringify({ ...body, age: 'grade_3_4', language: 'ja' }),
        signal: abort.signal,
      });
      if (abort.signal.aborted || !res.ok) return null;
      let data;
      try { data = await res.json(); } catch (e) { return null; }
      if (abort.signal.aborted) return null;
      return validateExpandResponse(data, body);
    } catch (e) {
      return null;
    }
  })();
  try {
    return await Promise.race([work, timeout]);
  } finally {
    clearTimeout(timeoutId);
    if (_expandAbort === abort) _expandAbort = null;
  }
}
// EXPAND-AI-END

`],
  [`  <div id="overlay-world"><div id="word-announce"></div></div>
  <div id="demo-end">
`,
   `  <div id="overlay-world"><div id="word-announce"></div></div>
  <button id="btn-found" type="button">見つけたもの</button>
  <div id="detour-call" role="status"><span id="detour-call-text"></span><button type="button" id="btn-detour-open">調べる</button></div>
  <div id="demo-end">
`],
  [`    <button class="btn-secondary" style="width:auto;display:inline-block;padding:10px 22px;margin:0 auto" onclick="window.confirmReset()">もう一度あそぶ</button>
  </div>
`,
   `    <button class="btn-secondary" style="width:auto;display:inline-block;padding:10px 22px;margin:0 auto" onclick="window.confirmReset()">もう一度あそぶ</button>
    <button class="btn-secondary" id="btn-free-walk" type="button" style="width:auto;display:inline-block;padding:10px 22px;margin:8px auto 0">自由に歩く</button>
  </div>
`],
  [`  </div>
  <button class="btn-primary btn-disabled" id="btn-photo-next" onclick="window.toExpression()">この写真を使う →</button>
`,
   `  </div>
  <div class="panel-desc" id="photo-reuse-note" style="display:none;margin:8px 0 12px">さっきの写真のままでも、新しい写真でもいいよ。</div>
  <button class="btn-primary btn-disabled" id="btn-photo-next" onclick="window.toExpression()">この写真を使う →</button>
`],
  [`  <div class="voice-divider">書いてもOK</div>
  <textarea class="text-input" id="expr-input" rows="2" placeholder="見つけたことを、そのまま教えてね"></textarea>
`,
   `  <div class="voice-divider">書いてもOK</div>
  <div id="expr-viewpoints" class="secret-chips" style="display:none"></div>
  <textarea class="text-input" id="expr-input" rows="2" placeholder="見つけたことを、そのまま教えてね"></textarea>
`],
  [`  <button class="btn-primary btn-disabled" id="btn-secret-next" onclick="window.revealSecret()">送る</button>
</div>
`,
   `  <button class="btn-primary btn-disabled" id="btn-secret-next" onclick="window.revealSecret()">送る</button>
</div>

<!-- 道くさパネル（Step 11M）：「調べる」を押したときだけ開く。香りは想像する遊び -->
<div class="panel" id="panel-detour" aria-labelledby="detour-title">
  <div class="panel-handle"></div>
  <div class="panel-icon" id="detour-icon" aria-hidden="true">🌿</div>
  <div class="panel-title" id="detour-title" tabindex="-1" data-autofocus></div>
  <div class="detour-note">香りを想像してみよう（画面から、においは出ないよ）</div>
  <div id="detour-ask">
    <div class="panel-desc detour-question" id="detour-question"></div>
    <textarea class="text-input" id="detour-input" rows="2" placeholder="思いうかんだことを書いてみよう"></textarea>
    <div id="detour-hint" class="secret-hint" style="display:none"></div>
    <button class="btn-primary btn-disabled" id="btn-detour-send" type="button">送る</button>
    <div id="detour-wait" class="secret-wait" role="status" style="display:none"></div>
    <button class="btn-secondary" id="btn-detour-close" type="button">あとで</button>
  </div>
  <div id="detour-result" style="display:none"></div>
</div>

<!-- 見つけたもの（Step 11M）：点数や正誤ではなく、見つけた物と、自分のことば -->
<div class="panel" id="panel-found" aria-labelledby="found-title">
  <div class="panel-handle"></div>
  <div class="panel-title" id="found-title" tabindex="-1" data-autofocus>見つけたもの</div>
  <div id="found-list"></div>
  <button class="btn-secondary" id="btn-found-close" type="button">冒険にもどる</button>
  <div class="panel-note">遊んでいるあいだだけ残ります。「デモを最初から」を押すと消えます。</div>
</div>
`],
  [`  DEMO_COMPLETE:'DEMO_COMPLETE',
};
`,
   `  DEMO_COMPLETE:'DEMO_COMPLETE',
  // Step 11M：最初のクエストのあとの自由な散歩・道くさの問い・見つけたもの（クエストの進み方は QUEST-CORE が持つ）
  FREE_EXPLORE:'FREE_EXPLORE', DETOUR:'DETOUR', FOUND:'FOUND',
};
`],
  [`      break;
  }
}
`,
   `      break;
    case S.FREE_EXPLORE:
      mbar.textContent = questHub.freeMessage();
      hint.style.opacity = '0';
      break;
    case S.DETOUR:
      openPanel('panel-detour');
      hint.style.opacity = '0';
      break;
    case S.FOUND:
      openPanel('panel-found');
      hint.style.opacity = '0';
      break;
  }
  questHub.applyUI();   // 「見つけたもの」ボタン・道くさの案内は、歩けるときだけ出す（入力中は隠す）
}
`],
  [`  const p=character.position.clone(); p.y+=2.6; p.project(camera);
  if(p.z>1){charLabel.style.opacity='0';return;}
  charLabel.style.opacity='1';
  charLabel.style.left=(p.x*.5+.5)*innerWidth+'px';
  charLabel.style.top=(-p.y*.5+.5)*innerHeight+'px';
`,
   `  const p=character.position.clone(); p.y+=2.6; p.project(camera);
  if(p.z>1||Math.abs(p.x)>1){charLabel.style.opacity='0';return;}   // 画面の外（左右）では出さない（Step 11M）
  charLabel.style.opacity='1';
  charLabel.style.left=Math.min(innerWidth-40,Math.max(40,(p.x*.5+.5)*innerWidth))+'px';   // 名前の札が画面の端からはみ出さない（横スクロールを作らない）
  charLabel.style.top=(-p.y*.5+.5)*innerHeight+'px';
`],
  [`function onTap(e){
  if(state!==S.EXPLORE&&state!==S.DEMO_COMPLETE) return;
  const ndc=getNDC(e);
`,
   `function onTap(e){
  if(!canMove()) return;
  const ndc=getNDC(e);
`],
  [`  _vocabCare = false;
  missionTriggered = false;
`,
   `  _vocabCare = false;
  if (questHub.abortSecond()) return;   // 第2クエストの途中なら、自由な散歩へ戻る（芽に近づき直すと、もう一度はじまる）
  missionTriggered = false;
`],
  [`  worldTimeout(()=>{ nextGroup.visible=true; setState(S.DEMO_COMPLETE); },900);
};

// ── リセット ─────────────────────────────────────────────────────
`,
   `  worldTimeout(()=>{ nextGroup.visible=true; setState(S.DEMO_COMPLETE); },900);
};

// QUEST-UI-BEGIN（Step 11M：クエストと道くさの「表示」と「通信」。進み方は QUEST-CORE、芽と実の見た目は worldV2 が持つ。保存はしない）
const questHub = (() => {
  let st = createQuestState();
  let current = 'first';   // いま答えを記録するクエスト（自由に歩いているあいだは null）
  const FREE_DEFAULT = '自由に歩いてみよう。気になる場所があるかも。';
  let freeMsg = FREE_DEFAULT, returnState = S.EXPLORE, q2NeedsLeave = false;
  let detourNear = null, detourDef = null, detourGen = 0, detourSent = false;
  const el = id => document.getElementById(id);
  const Q2 = QUEST_DEFS[1];
  // 道くさの控えめな光：3か所を1回で描く（最初のクエストが終わるまでは描かない）
  const glow = new THREE.InstancedMesh(new THREE.SphereGeometry(.1, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfff0b0, transparent: true, opacity: .8, depthWrite: false }), DETOUR_DEFS.length);
  glow.name = 'Detour_Glow'; glow.frustumCulled = false; glow.renderOrder = 3; glow.visible = false; scene.add(glow);
  const gm = new THREE.Matrix4();
  const q2Usable = () => st.quests.second === 'available' && worldV2.isActive();

  function update(t) {
    // 最初のクエストが終わった（V2：ことばの樹に実が灯った／V1：デモの終わりまで来た）
    if (st.quests.first === 'active' && (worldV2.isActive() ? worldV2.progress() === 'complete' : state === S.DEMO_COMPLETE)) {
      questEvent(st, 'firstDone');
      if (worldV2.isActive()) worldV2.showQuestSprout(true);
    }
    if (!character || !detoursOpen(st)) return;
    const x = character.position.x, z = character.position.z, still = reduceMotionQuery.matches;
    // 第2クエストの芽：自由に歩いているときに近づくと始まる（入力中・道くさの最中は始まらない）
    if (state === S.FREE_EXPLORE && q2Usable()) {
      if (Math.hypot(x - Q2.start.x, z - Q2.start.z) <= Q2.start.r) { if (!q2NeedsLeave) startSecond(); }
      else q2NeedsLeave = false;
    }
    // 道くさの光：遠くでは小さく、近づくと少し大きく。取ったあとは消える
    glow.visible = true;
    DETOUR_DEFS.forEach((d, i) => {
      if (st.detours[d.id]) { gm.makeScale(0, 0, 0); glow.setMatrixAt(i, gm); return; }
      const near = Math.max(0, 1 - Math.hypot(x - d.x, z - d.z) / 6), s = .6 + .9 * near;
      gm.makeScale(s, s, s).setPosition(d.x, worldV2.groundAt(d.x, d.z) + .55 + (still ? 0 : .06 * Math.sin(t * 1.7 + i * 2)), d.z);
      glow.setMatrixAt(i, gm);
    });
    glow.instanceMatrix.needsUpdate = true;
    releaseDismissed(st, x, z);
    const near = state === S.FREE_EXPLORE ? nearestDetour(st, x, z) : null;
    if (near !== detourNear) { detourNear = near; applyUI(); }
  }
  // 「見つけたもの」ボタンは歩けるときだけ。道くさの案内は自由に歩いているときだけ（入力中・パネルが開いているときは隠す）
  function applyUI() {
    el('btn-found').classList.toggle('show', state === S.EXPLORE || state === S.FREE_EXPLORE);
    const call = el('detour-call'), on = state === S.FREE_EXPLORE && !!detourNear;
    if (on) el('detour-call-text').textContent = detourNear.hint;
    call.classList.toggle('show', on);
  }
  function freeMessage() { return freeMsg; }
  // 最初のクエストのあと：次の冒険へ（芽へ案内）か、自由に歩く
  function toFree(kind) {
    if (st.quests.first === 'active' && !worldV2.isActive() && state === S.DEMO_COMPLETE) questEvent(st, 'firstDone');
    if (st.quests.first !== 'done') return;
    current = null;
    freeMsg = kind === 'next' && q2Usable() ? 'ことばの樹のそばに、新しい芽が出ている。近づいてみよう' : FREE_DEFAULT;
    // 「次の冒険へ」なら、芽の上に立っていてもすぐ始まる。「自由に歩く」なら、一度離れてから近づくと始まる
    if (character) q2NeedsLeave = kind !== 'next' && Math.hypot(character.position.x - Q2.start.x, character.position.z - Q2.start.z) <= Q2.start.r;
    setState(S.FREE_EXPLORE);
  }

  // ── 第2クエスト：同じパネルと流れを使い、文言と記録先だけを切りかえる（最初のクエストの答えは records に残る）──
  function setMissionCopy(title, sub) {
    document.querySelectorAll('.mission-title').forEach(e => { e.textContent = title; });
    document.querySelectorAll('.mission-sub').forEach(e => { e.textContent = sub; });
  }
  function startSecond() {
    if (!questEvent(st, 'secondStart')) return;
    current = 'second';
    // 芽の少し手前で止まり、芽のほうを向く
    const dx = Q2.start.x - character.position.x, dz = Q2.start.z - character.position.z;
    hiroriMotion.facing = Math.atan2(dx, dz); isMoving = false; playAnim('idle');
    focusOn(Q2.start.x, Q2.start.z);
    setMissionCopy(Q2.title, Q2.sub);
    el('photo-reuse-note').style.display = photoDataUrl ? '' : 'none';
    el('btn-photo-next').classList.toggle('btn-disabled', !photoDataUrl);
    el('expr-question').textContent = Q2.question;
    el('expr-input').value = ''; el('btn-expr-next').classList.add('btn-disabled');
    el('secret-input').value = ''; el('btn-secret-next').classList.add('btn-disabled');
    // 前のクエストとちがう観点を「たとえば」として出す。押すと書き出しが入るだけ（送らない）
    const prev = st.records.first ? (st.records.first.answer || st.records.first.expression) : '';
    const box = el('expr-viewpoints'); box.replaceChildren();
    const lead = document.createElement('div'); lead.className = 'secret-hint-text'; lead.style.width = '100%'; lead.textContent = 'たとえば、こんなところから：'; box.appendChild(lead);
    suggestViewpoints(prev).forEach(k => {
      const [label, start] = VIEWPOINTS[k], input = el('expr-input');
      box.appendChild(secretChip(label, 'secret-chip', () => { input.value = start; input.dispatchEvent(new Event('input', { bubbles: true })); input.focus(); }));
    });
    box.style.display = '';
    resetVocabState();
    setState(S.MISSION_FOUND);
    el('mbar-text').textContent = '新しい芽に着いた！';
  }
  // 第2クエストの終わり：樹に2つ目の実が灯り、芽のまわりに花が咲いて、自由な散歩へ戻る（1回だけ）
  function finishSecond() {
    if (!questEvent(st, 'secondDone')) return;
    current = null;
    const x = character ? character.position.x : Q2.start.x, z = character ? character.position.z : Q2.start.z;
    worldV2.lightNextFruit(x, z);
    worldV2.showQuestSprout(true, false);
    const fl = [];
    for (let i = 0; i < Q2.flowers; i++) {
      const a = i / Q2.flowers * Math.PI * 2 + .4, r = .8 + (i % 3) * .35;
      const f = mkFlower(Q2.start.x + Math.cos(a) * r, Q2.start.z + Math.sin(a) * r, false);
      flowerGroup.add(f); fl.push(f);
    }
    if (reduceMotionQuery.matches) fl.forEach(f => f.scale.setScalar(1)); else bloomSeq(fl, null);
    freeMsg = Q2.reward;
    worldTimeout(() => setState(S.FREE_EXPLORE), 900);
  }
  // 語彙カードの care から「冒険にもどる」：第2クエストは、もう一度はじめられる状態へ戻す
  function abortSecond() {
    if (st.quests.second !== 'active') return false;
    st.quests.second = 'available'; current = null; q2NeedsLeave = true; freeMsg = FREE_DEFAULT;
    setState(S.FREE_EXPLORE);
    return true;
  }
  function noteAnswer(text, chosen, skipped) {
    if (!current) return;
    questEvent(st, 'record', { id: current, expression: enteredText, word: chosenWord, answer: text, chosen, skipped });
  }

  // ── 道くさ ──
  function openDetour() {
    if (state !== S.FREE_EXPLORE || !detourNear) return;
    detourDef = detourNear; detourSent = false; detourGen++;
    el('detour-icon').textContent = detourDef.item.icon;
    el('detour-title').textContent = detourDef.hint;
    el('detour-question').textContent = detourDef.question;
    const input = el('detour-input'); input.value = ''; input.readOnly = false;
    el('btn-detour-send').classList.add('btn-disabled');
    for (const id of ['detour-hint', 'detour-wait', 'detour-result']) { const b = el(id); b.replaceChildren(); b.style.display = 'none'; }
    el('detour-ask').style.display = '';
    isMoving = false; playAnim('idle');
    hiroriMotion.facing = Math.atan2(detourDef.x - character.position.x, detourDef.z - character.position.z);
    focusOn(detourDef.x, detourDef.z);
    setState(S.DETOUR);
  }
  function detourHint(text) {
    const box = el('detour-hint'); box.replaceChildren(); box.style.display = '';
    const t = document.createElement('div'); t.className = 'secret-hint-text'; t.textContent = text; box.appendChild(t);
    const row = document.createElement('div'); row.className = 'secret-chips';
    const input = el('detour-input');
    detourDef.starters.forEach(w => row.appendChild(secretChip(w, 'secret-chip', () => { input.value = w; input.dispatchEvent(new Event('input', { bubbles: true })); input.focus(); })));
    box.appendChild(row);
  }
  function sendDetour() {
    if (state !== S.DETOUR || !detourDef || detourSent) return;
    const input = el('detour-input'), text = input.value.trim();
    if (!text) return;
    const care = localExpandCare({ expression: '', answer: text });
    if (care) { detourSent = true; input.blur(); showDetourCare(care.urgent); return; }
    const kind = classifyDetourAnswer(text);
    if (kind !== 'ok') { detourHint('もうひとことだけ、教えてほしいな。思いうかんだものを書いてみよう。'); return; }
    detourSent = true; input.blur(); input.readOnly = true; resetPageScroll();
    el('btn-detour-send').classList.add('btn-disabled'); el('detour-hint').style.display = 'none';
    const wait = el('detour-wait'); wait.textContent = 'ことばを探しているよ'; wait.style.display = '';
    const gen = detourGen, def = detourDef;
    // AI へは1回だけ（最大5秒）。失敗しても、短い反応を出して入手できる
    fetchExpansion({ expression: def.hint, word: def.item.name, question: def.question, answer: text, scene: 'detour' }).then(ai => {
      if (gen !== detourGen || state !== S.DETOUR) return;   // 閉じた・リセットしたあとに届いた答えは使わない
      wait.style.display = 'none'; input.readOnly = false;
      if (ai && ai.care) { showDetourCare(ai.urgent); return; }
      collectDetour(def, text, ai);
    });
  }
  function collectDetour(def, text, ai) {
    if (!questEvent(st, 'detour', { id: def.id, words: text })) return;
    el('detour-ask').style.display = 'none';
    const box = el('detour-result'); box.replaceChildren(); box.style.display = '';
    const add = (tag, cls, t, parent = box) => { const e = document.createElement(tag); e.className = cls; e.textContent = t; parent.appendChild(e); return e; };
    add('div', 'panel-title secret-insight', ai && ai.reflection ? ai.reflection : def.reaction);
    const card = add('div', 'detour-item', '');
    add('div', 'detour-item-icon', def.item.icon, card).setAttribute('aria-hidden', 'true');
    const body = add('div', '', '', card);
    add('div', 'detour-item-name', def.item.name + 'を手に入れた！', body);
    add('div', 'detour-item-words', '「' + text + '」', body);
    // 言い方を広げるのは、えらんでもえらばなくてもよい（深掘りは必須にしない）
    if (ai && ai.candidates) {
      add('div', 'panel-desc', 'こんな言い方もできそう（えらばなくても大丈夫）');
      ai.candidates.forEach(w => {
        const b = secretChip(w, 'word-card secret-choice', () => {
          box.querySelectorAll('.secret-choice').forEach(x => x.classList.remove('selected'));
          b.classList.add('selected'); st.detours[def.id].phrase = w;
        });
        box.appendChild(b);
      });
    }
    box.appendChild(secretChip('しまう', 'btn-primary', () => closeDetour(true)));
  }
  function showDetourCare(urgent) {
    el('detour-ask').style.display = 'none';
    const box = el('detour-result'); box.replaceChildren(); box.style.display = '';
    const careBox = document.createElement('div'); careBox.className = 'secret-care'; box.appendChild(careBox);
    const line = (t, cls) => { const d = document.createElement('div'); d.className = cls; d.textContent = t; careBox.appendChild(d); };
    if (urgent) line(URGENT_CARE_MESSAGE, 'care-msg care-urgent');
    line(CARE_SUPPORT_MESSAGE.replace(/。(?=.)/g, '。\\n'), 'care-msg');
    careBox.appendChild(secretChip('入力にもどる', 'btn-care btn-care-rewrite', () => {
      box.replaceChildren(); box.style.display = 'none'; el('detour-ask').style.display = '';
      const input = el('detour-input'); input.value = ''; input.readOnly = false; el('btn-detour-send').classList.add('btn-disabled');
      detourSent = false; detourGen++; input.focus();
    }));
  }
  // done：入手してしまった。そうでなければ「あとで」（未取得のまま。離れるまで同じ案内を出さない）
  function closeDetour(done) {
    if (state !== S.DETOUR) return;
    if (!done && detourDef && !st.detours[detourDef.id]) st.dismissed[detourDef.id] = true;
    detourGen++; cancelExpansion(); el('detour-input').readOnly = false;
    detourDef = null; detourNear = null;
    setState(S.FREE_EXPLORE);
    el('btn-found').focus({ preventScroll: true });
  }

  // ── 見つけたもの：点数や正誤ではなく、見つけた物と、自分のことば ──
  function openFound() {
    if (state !== S.EXPLORE && state !== S.FREE_EXPLORE) return;
    returnState = state; isMoving = false; playAnim('idle');
    if (character) { const f = hiroriMotion.facing; focusOn(character.position.x + Math.sin(f) * 3, character.position.z + Math.cos(f) * 3); }
    const list = el('found-list'); list.replaceChildren();
    const add = (tag, cls, t, parent = list) => { const e = document.createElement(tag); e.className = cls; e.textContent = t; parent.appendChild(e); return e; };
    const words = QUEST_DEFS.map(d => [d, st.records[d.id]]).filter(([, r]) => r && !r.skipped && r.answer);
    const items = DETOUR_DEFS.filter(d => st.detours[d.id]);
    if (!words.length && !items.length) add('div', 'found-empty', 'まだ見つけたものはないよ。歩きながら、気になる場所を探してみよう。');
    if (words.length) {
      add('div', 'found-section', '広がったことば');
      words.forEach(([d, r]) => {
        const card = add('div', 'detour-item', ''); add('div', 'detour-item-icon', '🌱', card).setAttribute('aria-hidden', 'true');
        const body = add('div', '', '', card);
        add('div', 'detour-item-name', d.title, body);
        add('div', 'detour-item-words', r.chosen ? '「' + r.answer + '」→「' + r.chosen + '」' : '「' + r.answer + '」', body);
      });
    }
    if (items.length) {
      add('div', 'found-section', '道くさで見つけたもの');
      items.forEach(d => {
        const it = st.detours[d.id], card = add('div', 'detour-item', '');
        add('div', 'detour-item-icon', d.item.icon, card).setAttribute('aria-hidden', 'true');
        const body = add('div', '', '', card);
        add('div', 'detour-item-name', d.item.name + '（' + d.place + '）', body);
        add('div', 'detour-item-words', it.phrase ? '「' + it.words + '」→「' + it.phrase + '」' : '「' + it.words + '」', body);
      });
    }
    setState(S.FOUND);
  }
  function closeFound() {
    if (state !== S.FOUND) return;
    setState(returnState);
    el('btn-found').focus({ preventScroll: true });
  }

  // 「デモを最初から」：クエスト・答え・道くさ・見つけたものを、すべて最初へ（保存していないので、ここで消える）
  function reset() {
    focusTarget = null;   // パネルの構図は、また祠に向き合う
    st = createQuestState(); current = 'first'; freeMsg = FREE_DEFAULT; returnState = S.EXPLORE; q2NeedsLeave = false;
    detourNear = null; detourDef = null; detourSent = false; detourGen++;
    glow.visible = false;
    applyMissionCopy();
    el('photo-reuse-note').style.display = 'none';
    const vp = el('expr-viewpoints'); vp.replaceChildren(); vp.style.display = 'none';
    el('detour-input').value = ''; el('found-list').replaceChildren();
  }
  return { update, applyUI, freeMessage, toFree, current: () => current, noteAnswer, finishSecond, abortSecond,
    openDetour, sendDetour, closeDetour, openFound, closeFound, reset, state: () => st };
})();
// ボタンは addEventListener でつなぐ（HTML の onclick は増やさない）
[['btn-found', () => questHub.openFound()], ['btn-detour-open', () => questHub.openDetour()], ['btn-detour-send', () => questHub.sendDetour()],
 ['btn-detour-close', () => questHub.closeDetour(false)], ['btn-found-close', () => questHub.closeFound()], ['btn-free-walk', () => questHub.toFree('free')]]
  .forEach(([id, fn]) => document.getElementById(id).addEventListener('click', fn));
window.sendDetour = () => questHub.sendDetour();
document.getElementById('detour-input').addEventListener('keydown', e => {   // Enter で送る。日本語の変換を確定する Enter では送らない
  if (e.key !== 'Enter' || e.shiftKey || e.isComposing || e.keyCode === 229) return;
  e.preventDefault(); window.sendDetour();
});
document.getElementById('detour-input').addEventListener('input', function () {
  document.getElementById('btn-detour-send').classList.toggle('btn-disabled', !this.value.trim());
});
// QUEST-UI-END

// ── リセット ─────────────────────────────────────────────────────
`],
  [`
function focusFrame(angle, side, outPos, outLook){
  _fwd.copy(mpGroup.position).sub(character.position).setY(0);
  if(_fwd.lengthSq()<1e-6) _fwd.set(0,0,-1);
`,
   `
// パネルを出すときに向き合う場所（null のときは祠。第2クエストの芽・道くさの場所などは Step 11M の focusOn で決める）
let focusTarget=null;
function focusOn(x,z){ focusTarget=(focusTarget||new THREE.Vector3()).set(x,0,z); chooseFocusSide(); }
function focusFrame(angle, side, outPos, outLook){
  _fwd.copy(focusTarget||mpGroup.position).sub(character.position).setY(0);
  if(_fwd.lengthSq()<1e-6) _fwd.set(0,0,-1);
`],
  [`  const R=focusDistance();
  outPos.copy(character.position).setY(0)
    .addScaledVector(_fwd,R*Math.cos(angle)).addScaledVector(_side,R*Math.sin(angle)).setY(focusHeight());
  outLook.copy(character.position).addScaledVector(_fwd,gap*FOCUS_LOOK_AHEAD).setY(FOCUS_LOOK_Y);
}
`,
   `  const R=focusDistance();
  const gy=worldV2.groundAt(character.position.x,character.position.z);   // 起伏のある場所でも、地面からの高さをそろえる（祠のまわりは平らなので 0）
  outPos.copy(character.position).setY(0)
    .addScaledVector(_fwd,R*Math.cos(angle)).addScaledVector(_side,R*Math.sin(angle)).setY(focusHeight()+gy);
  outLook.copy(character.position).addScaledVector(_fwd,gap*FOCUS_LOOK_AHEAD).setY(FOCUS_LOOK_Y+gy);
}
`],
  [`      for(const [tx,tz] of TREE_SPOTS) camClear=Math.min(camClear,Math.hypot(tx-_focusPos.x,tz-_focusPos.z)-2.2);
      const crystal=treeMarginBehind(_focusPos,mpGroup.position.x,mpGroup.position.z,1.2);
      const head=treeMarginBehind(_focusPos,character.position.x,character.position.z,1.9);
`,
   `      for(const [tx,tz] of TREE_SPOTS) camClear=Math.min(camClear,Math.hypot(tx-_focusPos.x,tz-_focusPos.z)-2.2);
      const wt=worldV2.wordTree;   // ことばの樹（幹と枝が大きいので、カメラは少し離す）
      if(worldV2.isActive()) camClear=Math.min(camClear,Math.hypot(wt.x-_focusPos.x,wt.z-_focusPos.z)-3.6);
      const ft=focusTarget||mpGroup.position;
      const crystal=treeMarginBehind(_focusPos,ft.x,ft.z,1.2);
      const head=treeMarginBehind(_focusPos,character.position.x,character.position.z,1.9);
`],
  [`const SPEED=4.0, ARRIVE=0.6;
const canMove=()=>state===S.EXPLORE||state===S.DEMO_COMPLETE;

`,
   `const SPEED=4.0, ARRIVE=0.6;
const canMove=()=>state===S.EXPLORE||state===S.DEMO_COMPLETE||state===S.FREE_EXPLORE;

`],
];

const ART_BLOCK = /\/\/ WORLD-ART-BEGIN[\s\S]*?\/\/ WORLD-ART-END\n\n/;

// 美術のまとまり（WORLD-ART-BEGIN〜END）を取り出す
export const artBlock = html => (html.match(ART_BLOCK) || [''])[0];

// 美術の変更だけを元へ戻す。変更後の文字列がちょうど1回ずつ無いときは例外を出す
export function revertWorldArt(html) {
  const blocks = html.match(new RegExp(ART_BLOCK.source, 'g')) || [];
  if (blocks.length !== 1) throw new Error(`WORLD-ART block count ${blocks.length}`);
  let out = html.replace(ART_BLOCK, '');
  for (const [before, after] of WORLD_ART_EDITS) {
    const n = out.split(after).length - 1;
    if (n !== 1) throw new Error(`art edit appears ${n} times: ${after.slice(0, 40)}`);
    out = out.split(after).join(before);
  }
  return out;
}
