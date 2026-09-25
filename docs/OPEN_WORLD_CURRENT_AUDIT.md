# オープンワールドデモ 現状調査レポート

調査日：2026-09-25  
対象ブランチ：`feature/tomori-open-world-demo`

---

## 1. 現在の構造

### demo-world.html（3Dデモページ）

| 項目 | 内容 |
|---|---|
| 行数 | 749行 |
| 3D方式 | **本物のWebGL**（Three.js r160） |
| Three.js 読み込み | ES module importmap、CDN（cdn.jsdelivr.net） |
| 外部ライブラリ | Three.js 本体 + GLTFLoader のみ |
| キャラクター | CapsuleGeometry + SphereGeometry の仮モデル（GLBなし） |
| 地面 | PlaneGeometry 60×60ユニット、MeshLambertMaterial（緑） |
| 木 | CylinderGeometry+ConeGeometry の手続き生成（18本） |
| 岩 | DodecahedronGeometry（5個） |
| ミッション地点 | TorusGeometry（リング）+ OctahedronGeometry（結晶）+ PointLight |
| 花 | CylinderGeometry（茎）+ SphereGeometry（花）×12個、初期スケール0 |
| パーティクル | Points + BufferGeometry（80点） |
| ライト | AmbientLight + DirectionalLight + HemisphereLight |
| フォグ | scene.fog = Fog（20〜60） |
| 影 | 無効（shadowMap.enabled = false） |

### index.html（メインアプリ）

| 項目 | 内容 |
|---|---|
| 行数 | 7056行 |
| 3D/WebGL | なし |
| フレームワーク | なし（バニラJS） |
| 外部ライブラリ | なし |
| バックエンド | Cloudflare Workers（tomori-api） |
| 画像素材 | images/ フォルダに複数のPNG（エルフ村背景・キャラクター候補） |
| GLBモデル | なし（assets/characters/ ディレクトリ未作成） |

---

## 2. 現在できる操作（実装状況）

| 機能 | 状態 | 詳細 |
|---|---|---|
| タップで歩く（クリック/タッチ） | **実装済み** | Raycaster → 地面hit → targetPos更新 |
| キーボード操作 | **未実装** | WASD/矢印キーなし |
| マウスドラッグ操作 | **未実装** | カメラ回転・スワイプ移動なし |
| タッチ操作 | **実装済み** | `touchend` + `e.preventDefault()` |
| 仮想スティック | **未実装** | なし |
| idle/walk アニメ切り替え | **一部実装** | GLBがあればAnimationMixer対応。仮モデルはアニメなし |
| discover/celebrate アニメ | **一部実装** | GLB想定の呼び出しあり。仮モデルでは無効 |
| カメラ追従（lerp） | **実装済み** | キャラクター後方+上方オフセット |
| カメラ回転（手動） | **未実装** | カメラ固定追従のみ |
| 衝突判定 | **未実装** | 木・岩にはぶつからず通り抜ける |
| 探索ポイント（ミッション地点） | **実装済み** | 1点のみ。MISSION_RADIUS=1.8で自動発動 |
| ミッション到達ポップアップ | **実装済み** | タイトル・プロンプト・「やってみる！」ボタン |
| 写真撮影 | **未実装** | ポップアップ内にUIなし（「やってみる！」で即達成） |
| 音声入力 | **未実装** | 3Dシーン内に音声入力UI未実装 |
| 文字入力 | **未実装** | 3Dシーン内にテキスト入力未実装 |
| AIによる言い換え | **未実装** | TOMORI_API_URL への呼び出しなし |
| AIからの問い | **未実装** | 〃 |
| 言葉の選択UI | **未実装** | 〃 |
| ミッション達成で花が咲く | **実装済み** | scale 0→1 のease animation（12輪） |
| 道・エリアの解放 | **未実装** | フィールドは変化しない |
| 世界が広がる演出 | **未実装** | 花が咲くだけ。新エリア・つるの消滅なし |
| ミッション地点の移動 | **実装済み** | 達成後2秒でランダム移動 |
| シークレットミッション | **未実装** | 〃 |
| セーブ状態 | **未実装** | localStorageへの保存なし |
| フォールバック（WebGL失敗時） | **実装済み** | `#no-webgl`表示 → index.htmlへリンク |
| GLB自動切り替え | **実装済み** | load失敗時は仮モデル |

---

## 3. 現在の演出

| 演出要素 | 実装状況 | 備考 |
|---|---|---|
| ヒロリ（仮） | あり | オレンジのカプセル+球体の仮モデル |
| 写真撮影 | なし | 3D内にカメラUIなし |
| 音声入力 | なし | 3D内に音声UIなし |
| 文字入力 | なし | 3D内にテキストUIなし |
| AIによる言い換え | なし | API呼び出しなし |
| AIからの問い | なし | 〃 |
| 言葉の選択（複数選択肢） | なし | 〃 |
| ミッション達成（花が咲く） | あり | 12輪、easeアニメ済み |
| 道やエリアの解放 | なし | 固定フィールドのみ |
| シークレットミッション | なし | 〃 |
| 「また探索したい」終了演出 | なし | エンディングなし |

---

## 4. index.html から流用できる機能

| 機能 | 関数名 | 行番号 | 状態 |
|---|---|---|---|
| 写真選択・Base64変換 | `handlePhoto(input)` | 3614 | そのまま流用可 |
| 画像リサイズ（Vision用400px/JPEG） | `resizePhotoForVision(dataUrl)` | 4657 | そのまま流用可 |
| 画像カテゴリ分析（canvas50px） | `analyzeImageCategory(img)` | 3647 | そのまま流用可 |
| AI ミッション生成（Vision対応） | 行4766 `fetchWithTimeout(…/generate)` | 4766 | そのまま流用可 |
| AI フィードバック + 冒険者称号 | 行4231 `fetchWithTimeout(…/feedback)` | 4231 | そのまま流用可 |
| AI 言い換え提案 | 行4991 `fetchWithTimeout(…/generate-next)` | 4991 | そのまま流用可 |
| 音声入力（SpeechRecognition） | `startVoiceInput()` | 6964 | そのまま流用可 |
| TTS読み上げ | `speak(text, el)` | 6898 | そのまま流用可 |
| ローカルストレージ保存 | `saveGameState()` / `loadGameState()` | 6650 / 6688 | そのまま流用可 |
| フェッチタイムアウト | `fetchWithTimeout(url, opts, ms)` | 4890 | そのまま流用可 |
| 探険者タイプ・年齢・気分のstate | `state` オブジェクト | 2499 | 直接参照可 |
| 8言語サポート | `TEXTS` / `lt()` / `getTTSLang()` | 2534 | そのまま流用可 |
| デモモード定数 | `DEMO_MODE=true` / `DEMO_MISSION_LIMIT=3` | 5770 | そのまま利用可 |
| キャラクター候補画像 | `images/character/` | — | 2D演出用に流用可 |

---

## 5. スマートフォン対応の懸念

### iPhone Safari

| 項目 | 評価 | 備考 |
|---|---|---|
| WebGL | ✅ | iOS 15以降でWebGL2対応 |
| ES module importmap | ⚠️ | **iOS 16.4以降のみ対応**。それ未満は白画面 |
| カメラ権限 | ✅ | `<input capture>` 方式のため許可ダイアログあり |
| マイク権限 | ✅ | SpeechRecognition は `webkitSpeechRecognition` 対応済み |
| タッチ操作 | ✅ | `touch-action:none` + touchend 実装済み |
| 画面回転 | ⚠️ | onResize は実装済みだがカメラ追従がリセットされる可能性 |
| 音声自動再生制限 | ✅ | TTS はユーザー操作起点のため問題なし |
| Safe Area（ノッチ） | ⚠️ | `env(safe-area-inset-*)` 未対応。UIが隠れる可能性 |

### Android Chrome

| 項目 | 評価 | 備考 |
|---|---|---|
| WebGL | ✅ | Android 9以降で安定 |
| ES module importmap | ✅ | Chrome 89以降で対応 |
| カメラ・マイク権限 | ✅ | 同上 |
| タッチ操作 | ✅ | 実装済み |

### PCブラウザ

| 項目 | 評価 | 備考 |
|---|---|---|
| WebGL | ✅ | |
| キーボード操作 | ❌ | WASD/矢印キー未実装 |
| マウスクリック移動 | ✅ | click イベント対応済み |
| カメラドラッグ | ❌ | 未実装 |

### 共通リスク

- **CDN切断**: Three.js を jsdelivr から読み込んでいるため、オフライン時は完全に動かない。TV収録前にバンドル化が必要
- **HTTP vs HTTPS**: `<input capture>` はHTTPS（またはlocalhost）必須。HTTP提供では iOS Safariがカメラを拒否
- **importmap対応外ブラウザ**: フォールバックが `#no-webgl` 相当の表示になるが、今のコードではimportmap失敗時の分岐がない（Three.jsロード失敗 → JSエラーで止まる）

---

## 6. 計画（TV_DEMO_PLAN.md）との比較

### 体験ステップと現状のギャップ

| 体験ステップ | 現在の状態 |
|---|---|
| ①ヒロリを操作して歩く | **完成**（仮モデル、タップ移動済み） |
| ②光る探索ポイントへ行く | **完成**（1点のみ。到達判定済み） |
| ③「心があたたかくなる赤を見つけよう」ミッション | **未実装**（ハードコードの汎用テキストのみ） |
| ④写真を撮る／思い出から探す | **未実装**（3D内にUI未接続） |
| ⑤気持ちを音声・文字で入力 | **未実装**（3D内にUI未接続） |
| ⑥「やばい」→「鮮やか」等に広がる | **未実装**（AI /feedback 未接続） |
| ⑦言葉を1つ選ぶ | **未実装**（選択肢UIなし） |
| ⑧選んだ言葉が世界を変える | **未実装**（ワールド変化なし） |
| ⑨つるが消え・赤い花・探索範囲が増える | **一部実装**（花の出現のみ。つる・範囲拡大なし） |
| ⑩「何に似ている？」の任意問いで秘密の花畑 | **未実装** |
| ⑪遠くに次の光が見え、「また探索したい」 | **未実装** |

ASSET_REQUIREMENTS.md との矛盾：なし。素材はすべて「△任意・手続き代替可」として記載済み。

---

## 7. 推奨方針

### 推奨：A（現在の demo-world.html を土台に拡張）

**根拠：**

1. **基盤は揃っている**：Three.js のセットアップ・タップ移動・カメラ追従・GLBローダー・花出現アニメ・WebGLフォールバックが既に動く状態。ゼロから始めるコストが不要
2. **追加必要なのは「UIの接続」だけ**：写真・音声・AI呼び出しは `index.html` に実装済みで、関数をコピーまたは `<script src>` で読み込めばよい
3. **2週間でテレビ収録に間に合う**：体験ステップ③〜⑧のUI実装が1〜2日単位で追加できる構造になっている
4. **GLB差し替え構造は完成**：`CHAR_GLB_PATH` に置くだけで切り替わる
5. **現行アプリを壊さない**：独立ファイルのため index.html は無傷

**方針Bを採らない理由：** この段階で新ディレクトリを作ると、管理対象が tomori / tomori-next / 新フォルダの三重構造になる。収録まで2週間しかなく、その状態はかえってリスクになる。

---

## 8. 最小構成案（テレビ収録必須最小セット）

```
demo-world.html（現状）
  ├── [追加] ミッションテキスト「心があたたかくなる赤を探して」に変更
  ├── [追加] ミッション到達 → カメラ or デモ写真選択UI（overlay div）
  ├── [追加] 写真選択後 → 音声/文字入力UI（overlay div）
  ├── [追加] 入力後 → /feedback 呼び出し → 言い換え選択肢3つを表示
  ├── [追加] 言葉選択 → 世界変化（赤い花・フォグ色変更）
  └── [追加] 「次の光」演出（2つ目のミッションポイントを遠くに表示）
```

index.html から移植する関数：
- `handlePhoto()` + `resizePhotoForVision()` + `analyzeImageCategory()`（3614〜3664行）
- `startVoiceInput()` + `speak()`（6898〜7021行）
- `fetchWithTimeout()` + `/feedback` 呼び出し（4231〜4244行、4890行）

---

## 9. 次の実装 Step で最初に作るもの

### Step A：ミッション地点到達後の写真・音声UIを追加

**目標：** 光るポイントへ行く → 「心があたたかくなる赤を見つけよう」→ 写真を撮るか選ぶ → 気持ちを話す →「やばい」→「鮮やか」に広がる → 1つ選ぶ → 花と赤の光が増える

**追加するもの（すべて demo-world.html 内）：**

1. `#photo-input`（`<input type="file" accept="image/*" capture="environment">`）
2. `#expression-panel`（写真サムネイル + 音声ボタン + テキスト入力 + 確定ボタン）
3. `#choice-panel`（AI が返した言い換え3択ボタン）
4. `closeMissionPopup()` を「写真を選ぶフロー開始」に変更
5. `/feedback` 呼び出し（index.html の `fetchWithTimeout` を移植）
6. 言葉選択後の「赤い花が増える・フォグが暖色に変わる」演出

---

## 10. 技術的な危険点

### リスク1：iOS 16.3以下での importmap 非対応（最大）

Three.js を importmap で読んでいるため、iOS 16.3以下では Three.js が読み込めずJSエラーで止まる。フォールバックとして `#no-webgl` が出ず真っ暗になる可能性がある。

**対策：** TV収録端末のiOSバージョン確認。16.3以下なら importmap を UMD バンドル版（cdn.jsdelivr.net/npm/three/build/three.min.js）に切り替え。

### リスク2：CDNオフライン時の完全停止

Three.js CDN が届かない場合、シーン全体が初期化されない。TV収録会場の通信状況によっては発生する。

**対策：** 収録2日前に `npx esbuild` 等でバンドルしてローカルに保存する。またはiframe内でSW経由でキャッシュ。

### リスク3：写真撮影とHTTPSの衝突

ローカルの `perl serve.pl`（HTTP）上では、iOS Safari がカメラ/マイク権限を拒否する。GitHub PagesはHTTPSなので本番は問題ないが、収録でローカル起動する場合に詰まる。

**対策：** 収録端末からは GitHub Pages のURLで開く（HTTPSが確保できる）か、`python -m http.server --ssl` で自己署名証明書を使う（iOS で信頼設定が必要）。デモ写真プリセットモードを有効にすることで回避も可能。

---

## 11. 関係するファイル・関数・行番号 まとめ

| ファイル | 関数/定数 | 行 | 役割 |
|---|---|---|---|
| demo-world.html | `checkWebGL()` | 225 | WebGL可否判定 |
| demo-world.html | `CHAR_GLB_PATH` | 196 | GLB配置パス |
| demo-world.html | `CHAR_ANIM_MAP` | 200 | アニメクリップ名マッピング |
| demo-world.html | `DEMO_MISSIONS[]` | 213 | デモ用ハードコードミッション |
| demo-world.html | `createPlaceholderChar()` | 430 | 仮ヒロリ生成 |
| demo-world.html | `playAnim(name)` | 497 | アニメ切り替え |
| demo-world.html | `onTap(e)` | 532 | タップ移動 |
| demo-world.html | `triggerMissionArrival()` | 560 | ミッション地点到達 |
| demo-world.html | `completeMission()` | 591 | ミッション達成処理 |
| demo-world.html | `bloomNextFlower()` | 606 | 花が咲くアニメ |
| demo-world.html | `moveMissionPoint()` | 622 | ミッション地点移動 |
| demo-world.html | `updateCamera()` | 649 | カメラ追従 |
| demo-world.html | `animate()` | 664 | メインループ |
| index.html | `state{}` | 2499 | 全アプリ状態 |
| index.html | `DEMO_MODE` | 5770 | デモ制限フラグ |
| index.html | `handlePhoto(input)` | 3614 | 写真選択処理 |
| index.html | `analyzeImageCategory(img)` | 3647 | 画像カテゴリ判定 |
| index.html | `resizePhotoForVision(url)` | 4657 | Vision用リサイズ |
| index.html | `/generate` 呼び出し | 4766 | AIミッション生成 |
| index.html | `/feedback` 呼び出し | 4231 | AIフィードバック+言い換え |
| index.html | `fetchWithTimeout()` | 4890 | タイムアウト付きfetch |
| index.html | `startVoiceInput()` | 6964 | 音声認識 |
| index.html | `speak(text, el)` | 6898 | TTS読み上げ |
| index.html | `saveGameState()` | 6650 | localStorage保存 |
| index.html | `loadGameState()` | 6688 | localStorage読み込み |
| index.html | `buildForestCanvas()` | 4410 | **dead code**（return即終了） |
