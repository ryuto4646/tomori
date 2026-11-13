# 素材の記録（ASSET_REGISTER）

ゲームに入れる素材の出どころ・作り方・利用条件・大きさ・採用状態の一覧。
新しい素材は、入れる前にこの表へ書き、利用条件と容量を実際に確かめてから採用します。

## 市場町（TOWN-01）

| 素材 | 作り方 | 容量 | 三角形のめやす | 状態 |
|---|---|---|---|---|
| 家（Meshy） | 制作者が Meshy で作った家1種類を、10区画に置く。左右反転と色味の小さな差をつける | 0.9MB | 1軒 7,938（10軒で約8万） | 開発版で採用・実機未確認 |
| 家（仮の形）6軒 | `demo-world.html` の中で、基本の形から組み立てる。お届け先の庭の3軒・角の小さな家など | ファイルなし | 6軒で約8,000 | 採用（庭の光・ひさしと組のため） |
| 屋台（Meshy）4軒 | 制作者が Meshy で作った屋台1種類。品物（花の鉢・タネ袋・パン・布）は台の上に別に置く | 0.58MB | 1軒 3,856（4軒で約1.5万） | 開発版で採用・実機未確認 |
| 噴水 | 同上（回転体の水盤と台・葉のもよう）。水・しぶき・水の輪もその場で作る | ファイルなし | 約1,500 | 採用 |
| 石だたみの絵 | その場でキャンバスに描く（256×256） | ファイルなし | 道の形の網目 約5,000（スマホは約2,600） | 採用 |
| 住人・動物・鉢・花壇の花 | 基本の形から組み立てる（宝さがしの人たちと同じつくり） | ファイルなし | 合わせて約6,000 | 採用 |
| 光の筋・ランタンの明かり | その場で描くグラデーション | ファイルなし | わずか | 採用 |
| 噴水の水の音・コインの音 | その場で作る短い音（WebAudio） | ファイルなし | ― | 採用 |

- 外から読むのは `assets/town-meshy/` の2つの GLB だけ。新しい CDN・パッケージ・読みこみ部品はありません（GLB はゲームの中の短い読みこみで読む）。
- 読めないとき・6秒たっても届かないときは、全部を仮の形で組み立てます。
- 仮の形の家と屋台の品物は、ひとつの形にまとめて1回で描きます。透かすときは、家ごとの番号で点を抜きます。

## Meshy（家・屋台は受け取りずみ。噴水は家・屋台の採用後）

- 受け取り：2026-11-13。元のデータ（`town_house_A.glb` 47MB・`market_stall_A.glb` 42MB、どちらも 4096×4096 の PNG 3枚つき）は、リポジトリの外（制作者のダウンロードフォルダ）に置いたまま。SHA-256 は `assets/town-meshy/manifest.json` に記録した。
- 軽くした版：形はそのまま（家 7,938・屋台 3,856 三角形。めやすの1万・5千以下）。色の絵1枚だけを 1024×1024 の JPEG にした。家 47MB → 0.9MB、屋台 42MB → 0.58MB。作り方は `tools/meshy_game.py`。
- マテリアルは1つ（色の絵だけ）。法線・金属感の絵は外した（ゲームはランバートで描くため、使わない）。
- 屋台の台の上に、小さな穴が1か所ある（Meshy の形のまま）。品物を台の上に置くので、遊ぶ画面ではほぼ隠れる（ヘッドレス Edge の画面で確認）。
- 追加のクレジット購入・契約変更はしていません。

| 素材 | 生成日 | プラン | 公開設定 | 利用条件 | 三角形 | マテリアル | テクスチャ | 容量（ゲーム用） | 状態 |
|---|---|---|---|---|---|---|---|---|---|
| 家（town_house_A） | 2026-11-13 ごろ（ファイル受け取り日） | 制作者に確認中 | 制作者に確認中 | 制作者に確認中 | 7,938 | 1 | 1024 JPEG 1枚 | 0.9MB | 開発版で採用・実機未確認 |
| 屋台（market_stall_A） | 2026-11-13 ごろ（ファイル受け取り日） | 制作者に確認中 | 制作者に確認中 | 制作者に確認中 | 3,856 | 1 | 1024 JPEG 1枚 | 0.58MB | 開発版で採用・実機未確認 |
| 噴水（Meshy） | ― | ― | ― | ― | ― | ― | ― | ― | 家・屋台の採用後（今は仮の形） |

本番に入れる前に、プラン・公開設定・利用条件を制作者に確かめて、この表をうめます（公開条件の6番目）。

プロンプト（HQ の指示どおり。制作者が実際に使った文と同じかは、制作者に確認中）

- 家：A single cozy medieval European rural market-town house, stylized storybook 3D game asset. Warm cream plaster, visible dark timber framing, a muted terracotta pitched roof with gently bowed eaves, a slightly tapered upper story, an offset gable, a simple wooden door and asymmetrically arranged small windows. （以下、HQ 指示 TOMORI-TOWN-01 の11節のとおり）
- 屋台：A single small medieval European market stall for a stylized storybook 3D exploration game. Simple wooden counter, four sturdy wooden posts, a gently curved striped canvas awning in muted warm cream and sage green. （以下、同じ11節のとおり）

## これまでの素材

| 素材 | 場所 | 出どころ | 状態 |
|---|---|---|---|
| ワールドV2 の草木・岩・地形の部品 | `assets/world-v2/tomori-world-kit.glb` | Blender で TOMORI 用に作成（`docs/ASSET_REQUIREMENTS.md`） | 採用（本番） |
| ことばの樹（Meshy） | `assets/world-v2/` | `docs/MARBLE_PREP.md`・`docs/TREE_MESHY_PROPOSAL.png` を参照 | 採用（本番） |
| スタートページの絵 | `assets/tomori-world-gateway.webp` | Step 11B で採用 | 採用（本番） |
