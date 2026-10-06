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
  requestAnimationFrame(() => { if (state === at) el.classList.add('show'); });   // PANEL-HIDE（Step 11L-C）：状態が先へ進んでいたら出さない
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
  [`window.toSecretText = ()=>setState(S.SECRET_UNLOCKED);`,
   `let secretSent = false;   // 深掘りの答えを送ったか（二重に送らない：Step 11L-C）
window.toSecretText = ()=>{ secretSent = false; setState(S.SECRET_UNLOCKED); };`],
  [`window.revealSecret = ()=>{
  if(!document.getElementById('secret-input').value.trim()) return;`,
   `window.revealSecret = ()=>{
  if(!document.getElementById('secret-input').value.trim()) return;
  if(state !== S.SECRET_UNLOCKED || secretSent) return;   // 1回だけ（連打・Enter と押す の重なりを受けない）
  secretSent = true;
  const sp = document.getElementById('panel-secret-t');   // 質問パネルは、ここですぐ閉じる
  sp.classList.remove('show'); sp.inert = true; sp.setAttribute('aria-hidden', 'true');
  document.getElementById('secret-input').blur(); document.getElementById('btn-secret-next').classList.add('btn-disabled');
  resetPageScroll();`],
  [`document.getElementById('secret-input').addEventListener('input',function(){`,
   `document.getElementById('secret-input').addEventListener('keydown', e => {   // Enter で送る。日本語の変換を確定する Enter では送らない
  if (e.key !== 'Enter' || e.shiftKey || e.isComposing || e.keyCode === 229) return;
  e.preventDefault(); window.revealSecret();
});
document.getElementById('secret-input').addEventListener('input',function(){`],
  [`  document.getElementById('btn-secret-next').classList.add('btn-disabled');
  document.getElementById('inp-cam').value='';`,
   `  document.getElementById('btn-secret-next').classList.add('btn-disabled'); secretSent = false;
  document.getElementById('inp-cam').value='';`],
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
