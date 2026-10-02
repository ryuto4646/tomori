# TOMORI World V2 ワールドキット

`demo-world.html` のワールドV2で使う3D素材を、Blender のスクリプトで作ります。
外部素材・テクスチャは使いません。色はすべて頂点色で、形はスクリプトの中で組み立てます。

## 作り直す方法

リポジトリのルートで、次を実行します。

```
"C:\Users\DELL\Tools\Blender-5.2.1\blender.exe" --background --factory-startup --python tools/world-v2/generate_tomori_world.py
```

`assets/world-v2/` に3つのファイルができます。

| ファイル | 中身 |
|---|---|
| `tomori-world-kit.glb` | 素材ひとそろい（glTF 2.0、1ファイルで完結） |
| `manifest.json` | 大きさ・SHA-256・ノード名と三角形の数 |
| `LICENSE.txt` | 権利表記（TOMORI のために生成した独自素材） |

乱数の種を固定しているので、同じ Blender なら何度実行しても同じファイルになります（SHA-256 も同じ）。
作り直したら `node --test test-world-v2.mjs` で、形式・容量・ノード名・SHA-256 を確かめます。

## 入っている素材（ノード名）

| 種類 | ノード |
|---|---|
| 木 | `Tree_Round_A` `Tree_Round_B`（丸い樹冠）、`Tree_Tall_A` `Tree_Tall_B`（縦に伸びる）、`Tree_Sapling_A`（若木） |
| 草・花・茂み | `Grass_A`〜`C`、`Flowers_A`〜`C`、`Bush_A` `Bush_B`（数本をまとめた1つの形） |
| 岩 | `Rock_Pebbles`、`Rock_Medium_A` `Rock_Medium_B`、`Stone_Standing_A` `Stone_Standing_B` |
| 祠 | `Shrine`（台座と光の受け皿・不揃いな立ち石・石畳。入口は手前、右奥は根の門への出口） |
| 根の門 | `RootGate_Left` `RootGate_Right` `RootGate_Top`（左右は根元が回転の中心。Part 2 で開ける） |
| ことばの樹 | `WordTree`、光の実 `WordTree_Fruit_01`〜`05`（同じ形を共有。どれを灯すかを Three.js 側で決める） |

座標は Three.js と同じ向き（x＝右、y＝上、z＝手前）で書き、エクスポートで Blender の向きへ直しています。
ノードは原点付近に置き、配置・大きさ・色の違いは `demo-world.html` 側（InstancedMesh）で決めます。

## ワールド側のしくみ（demo-world.html）

- 地形は Three.js 側で作ります。高さは `heightAt(x, z)` の1つだけです。この関数が、地面の頂点・木や岩・祠・門・ヒロリ・カメラのすべてに使われます。
- 出発点・小道・祠・秘密の場所は高さ0で平らです。歩ける範囲（だ円）の傾きは10°以下で、外へ行くほど丘が重なります。
- 読み込みや組み立てに失敗したら、V1（Step 11I-A までのワールド）のまま続けます。
- `?world=v1`・`?quality=high`・`?quality=low` は品質確認用です。
