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
   `      updateHiroriMotion(character, dt, t, walking);
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
