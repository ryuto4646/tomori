// Step 11K：ゲーム中の日本語の折り返し（文節で改行）とパネルのきまりを確かめる。ブラウザも通信も使わない
// 画面の大きさごとの実際の折り返し（5サイズ）は、ブラウザでの確認（スクリーンショットと一緒）で見る
// 実行: node --test test-text-layout.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = process.env.TEXT_LAYOUT_ROOT || dirname(fileURLToPath(import.meta.url));
const HTML = readFileSync(join(ROOT, 'demo-world.html'), 'utf8').replace(/\r\n/g, '\n');
const count = (s, re) => (s.match(re) || []).length;
const between = (s, a, b) => { const i = s.indexOf(a), j = s.indexOf(b, i + 1); assert.ok(i >= 0 && j > i, `markers ${a} / ${b}`); return s.slice(i, j); };
const WRAP = between(HTML, '// TEXT-WRAP-BEGIN', '// TEXT-WRAP-END');
const CSS = between(HTML, '<style>', '</style>');
const phrases = new Function(WRAP.slice(WRAP.indexOf('const seg'), WRAP.indexOf('const SKIP')) + '\nreturn phrases;')();

// ゲーム中に出る日本語（到着・ミッション・写真・入力・言葉カード・深掘り・タネ・門・樹・完了・429・care・WebGL 非対応）
const TEXTS = [
  '光るポイントを探して歩こう！', 'なにかが呼んでいる…', '光るポイントに着いた！',
  '気になったものを、ひとつ見つけよう', '見たもの・起きたこと・感じたこと。どこからでも大丈夫。', 'さっそく探す！', '写真はサーバーへ送りません',
  'いま見つける', '思い出から探す', 'この写真はこの画面の外へ出ません', 'この写真を使う →',
  '何が気になった？', 'うまく言えなくても大丈夫。', '声で話す', '見つけたことを、そのまま話してね', '書いてもOK', '見つけたことを、そのまま教えてね',
  'ことばをひろげる →', '話した声は、端末の音声認識を使って文字になります。',
  '気もちに近い言葉を見つけよう', '今の感じに近いものを、1つ選んでみよう。', 'どこに目が止まったのかな？', 'もう少し見てみたいところを、1つ選んでみよう。',
  'この場面を、もう少し言葉にしてみよう', 'いちばん近い言葉を、1つ選んでみよう。', '今日は、トモリが見つけた言葉から選んでみよう。',
  'とてもつらい気もちなんだね。ひとりでかかえず、近くの信頼できる大人に話してね。', '書きなおす', '冒険にもどる',
  'もう少し見てみたいところはある？', '答えてみる', '今は進む', '思いついたことを、ひとことでも大丈夫。', '思ったことを書いてみよう', '送る',
  'ことばのタネが生まれた！', '光っているタネに近づいてみよう', 'ことばのタネを見つけた！', '根の門が反応している…', '秘密の道がひらいた！',
  'きみのことばが、世界をひとつ灯した。', 'ことばの樹には、まだ眠っている実がある。', 'もう少し歩いてみる', 'スタートへ戻る',
  '遠くに、新しい光が見えてきた…', 'つづきは、次の冒険で。', 'もう一度あそぶ', '世界を読み込んでいます…',
  '3D版をひらけません', 'このブラウザでは、3Dの世界を表示できません。', 'WebGLが使えるブラウザや端末で、もう一度ためしてね。',
  'タップした場所へ歩くよ！', 'デモを最初から', '← 紹介ページへ', '紹介ページへ戻る',
];

test('1. 対象の文言がすべて demo-world.html にある（文章の意味・言い方は変えていない）', () => {
  const flat = HTML.replace(/<\/?span[^>]*>/g, '').replace(/<br>/g, '');
  for (const t of TEXTS) assert.ok(flat.includes(t), t);
});

test('2. 文節の切れ目：句読点・閉じかっこ・小さい字の前では切らず、開きかっこの後でも切らない', () => {
  for (const t of TEXTS) {
    const p = phrases(t);
    assert.equal(p.join(''), t, 'text unchanged');
    p.forEach((ph, i) => {
      if (i > 0) assert.ok(!/^[、。！？!?」』）)…ーぁぃぅぇぉっゃゅょァィゥェォッャュョ・]/.test(ph), `${t} → ${p.join('｜')}`);
      if (i < p.length - 1) assert.ok(!/[「『（(]$/.test(ph), `${t} → ${p.join('｜')}`);
    });
  }
});

test('3. 文節の切れ目：送りがな・カタカナ語・単語の途中では切らない', () => {
  const cases = {
    'きみのことばが、世界をひとつ灯した。': ['灯した。'],
    '今日は、トモリが見つけた言葉から選んでみよう。': ['トモリが', '見つけた', '選んでみよう。'],
    'ことばの樹には、まだ眠っている実がある。': ['眠っている'],
    '話した声は、端末の音声認識を使って文字になります。': ['話した', '音声認識を'],
    'つづきは、次の冒険で。': ['冒険で。'],
  };
  for (const [t, keep] of Object.entries(cases)) {
    const p = phrases(t);
    for (const k of keep) assert.ok(p.some(ph => ph.includes(k)), `${k} in ${p.join('｜')}`);
  }
  // 単語（Intl.Segmenter）の途中に切れ目がない
  const seg = new Intl.Segmenter('ja', { granularity: 'word' });
  for (const t of TEXTS) {
    const cuts = []; let pos = 0; for (const ph of phrases(t).slice(0, -1)) { pos += ph.length; cuts.push(pos); }
    const words = [...seg.segment(t)];
    for (const c of cuts) assert.ok(!words.some(w => w.index < c && w.index + w.segment.length > c), `${t} @${c}`);
  }
});

test('4. 文字は変えず、<wbr> を入れるだけ（innerHTML を使わない・Intl.Segmenter が無いときはふつうの折り返し）', () => {
  assert.match(WRAP, /frag\.appendChild\(document\.createElement\('wbr'\)\)/);
  assert.ok(!/innerHTML|insertAdjacentHTML|console\./.test(WRAP));
  assert.match(WRAP, /if \(typeof Intl === 'undefined' \|\| !Intl\.Segmenter\) \{ document\.body\.style\.wordBreak = 'normal'; return; \}/);
  assert.match(WRAP, /new MutationObserver\(/);
  // ふりがな・入力欄・nowrap は触らない
  assert.match(WRAP, /const SKIP = 'SCRIPT,STYLE,TEXTAREA,INPUT,RUBY,RT,RP,SVG,OPTION,TITLE';/);
  assert.match(WRAP, /p\.closest\('\.nowrap'\)/);
});

test('5. 折り返しのきまり（CSS）：文節で折り返し、句読点を行頭に出さない。本文に overflow-wrap:anywhere を使わない', () => {
  assert.match(CSS, /body \{ line-break:strict; word-break:keep-all; overflow-wrap:break-word; text-wrap:pretty; \}/);
  assert.match(CSS, /textarea, input \{ word-break:normal; \}/);
  assert.match(CSS, /\.panel-title, \.end-line1, #word-announce, #mbar-text \{ text-wrap:balance; \}/);
  assert.ok(!/overflow-wrap:\s*anywhere/.test(CSS));
});

test('6. 固定の改行（<br>）は、意味のまとまりの切れ目の決まった場所だけ', () => {
  // 見出しと小見出しの区切り・2行の見出しの切れ目（文節の境目）だけ。どの画面幅でも自然な位置
  const lines = HTML.split('\n').filter(l => l.includes('<br>')).map(l => l.trim());
  const allowed = ['気になったものを、<br>ひとつ見つけよう', '何が気になった？</span><br><span', 'ことばのタネを<br>見つけているよ…', 'もう少しだけ<br>聞いてもいい？', '表示できません。<br>WebGLが使える'];
  for (const l of lines) assert.ok(allowed.some(a => l.includes(a)), l);
  assert.equal(lines.length, 6, 'mission title (2 panels), expression title, loading, deep question, no-webgl');
  assert.equal(count(HTML, /<br>/g), 6);
});

test('7. 下の案内：「W A S D」を途中で割らない。意味のまとまりで3つに分ける', () => {
  assert.match(HTML, /<div id="hint"><span class="nowrap">タップした場所へ歩くよ！<\/span>　<span class="nowrap">パソコン：W A S D<\/span> <span class="nowrap">または 矢印キー<\/span><\/div>/);
  assert.match(CSS, /\.nowrap \{ white-space:nowrap; \}/);
  assert.match(CSS, /#hint \{\n  position:absolute; bottom:76px; left:50%; transform:translateX\(-50%\);\n  width:max-content; max-width:calc\(100vw - 32px\);/);
});

test('8. 終わりの枠は画面の半分に縮まない（狭い画面で1行が数文字にならない）', () => {
  assert.match(CSS, /padding:18px 22px; width:max-content; max-width:min\(320px, calc\(100vw - 32px\)\); text-align:center;/);
});

test('9. 押すもの：care のボタン・完了の2つは 44px 以上。キーボードのフォーカスが見える', () => {
  assert.match(CSS, /\.btn-care \{ flex:1; min-height:44px;/);
  assert.match(HTML, /more\.style\.cssText = 'width:auto;display:inline-block;min-height:44px;/);
  assert.match(HTML, /back\.style\.cssText = 'display:flex;align-items:center;justify-content:center;min-height:44px;/);
  assert.match(CSS, /\.btn-primary:focus-visible, \.btn-secondary:focus-visible, \.btn-care:focus-visible[^{]*\{ outline:3px solid #3a3328; outline-offset:3px; \}/);
});

test('10. 新しく 13px 未満の文字を作っていない（Step 11K で足した CSS の中）', () => {
  const added = between(CSS, '/* 日本語の折り返し（TEXT-WRAP）', '.nowrap { white-space:nowrap; }');
  assert.ok(!/font-size:\s*(\d+)px/.test(added) || [...added.matchAll(/font-size:\s*(\d+)px/g)].every(m => +m[1] >= 13));
});

// ── Step 11K-B：ルビの統一（一部の語だけに付いていたルビを外す。読みはデータに残す）──
// 以前ルビが付いていた語（端末内の候補のうち、表記と読みが違う20語）
const FORMER_RUBY = ['目を奪われる', '息をのむ', '心が動く', '心がはずむ', '苦手', '不安', '穏やか', '落ち着く', '心細い', '気になった',
  '心が動いた', '表情', '色合い', '輪郭', '色', '形', '動き', '様子', '変化', '流れ'];
const VOCAB = [...HTML.matchAll(/\{ word:'([^']+)',\s*reading:'([^']+)',\s*description:'([^']+)' \}/g)].map(m => ({ word: m[1], reading: m[2], description: m[3] }));

test('11. ルビ：表示する HTML・JavaScript・CSS にルビの仕組みが無い', () => {
  assert.equal(count(HTML, /<ruby\b|<rt\b|<\/ruby>|<\/rt>/gi), 0);
  assert.equal(count(HTML, /createElement\(\s*['"](ruby|rt|rp)['"]\s*\)/g), 0);
  assert.equal(count(CSS, /(^|[\s,}])(ruby|rt|rp)\s*[{,]/gm), 0);
  // 言葉カードの見出しは textContent だけで作る（外から来た文字を HTML として入れない）
  const DOM = between(HTML, '// VOCAB-DOM-BEGIN', '// VOCAB-DOM-END');
  assert.match(DOM, /titleEl\.textContent = word;/);
  assert.equal(count(DOM, /\.(innerHTML|outerHTML)\s*=|insertAdjacentHTML\(/g), 0);
});

test('12. ルビ：以前ルビがあった語は、漢字・語句・読み・意味がそのまま残っている', () => {
  assert.equal(VOCAB.length, 36);
  const byWord = new Map(VOCAB.map(v => [v.word, v]));
  for (const w of FORMER_RUBY) {
    assert.ok(byWord.has(w), w);
    assert.notEqual(byWord.get(w).reading, w, w);   // 読みはデータに残る（AI の通信の形も変えない）
  }
  assert.equal(VOCAB.filter(v => v.reading !== v.word).length, FORMER_RUBY.length);
  assert.match(HTML, /typeof w\.reading !== 'string'/);   // AI 応答の検査（reading 必須）は今までどおり
});

test('13. ルビ：語句・説明に二重の空白や、ルビ由来の改行が無い', () => {
  for (const v of VOCAB) {
    for (const s of [v.word, v.description]) {
      assert.doesNotMatch(s, /  |　　|\n|^\s|\s$/, s);
    }
  }
  // 見出しの行の高さは、ルビの有無で変わらない（ルビ専用の行間の指定も無い）
  assert.match(CSS, /\.word-title \{ font-size:17px; font-weight:bold; color:#3a7a28; margin-bottom:3px; \}/);
});
