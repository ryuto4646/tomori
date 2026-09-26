# AI語彙の接続（demo-world.html）

子どもが書いた（または話した）ことばを Worker の `POST /vocabulary` へ送り、
返ってきた3つのことばをカードに出す。失敗したときは、固定の3語を出す。

Worker 側の仕様は `tomori-worker-next/docs/VOCABULARY_API.md` にある。

---

## 流れ

1. 「ことばをひろげる」を押す
2. ボタンを無効にする（二重送信を防ぐ）
3. 「ことばのタネを見つけているよ…」を出す。3Dの世界は上に見えたまま
4. `/vocabulary` へ送る（6秒で打ち切り）
5. 結果で分ける

| 結果 | 画面 |
|---|---|
| 正常（normal） | AIの3語をカードに出す。AIの深掘り質問を、深掘り画面へ入れる |
| care | 固定の文面と「書きなおす」「冒険にもどる」の2つのボタンを出す。カードは出さない |
| それ以外 | 固定の3語を出す（下の「フォールバック」） |

---

## 送るもの・送らないもの

送るのは次の4つだけ。

```json
{ "expression": "（200文字まで）", "mission": "心があたたかくなる赤を見つけよう", "age": "grade_3_4", "language": "ja" }
```

送らないもの：写真、音声、名前、これまでの記録。
写真は選んでも端末の中だけで使う。

本文とは別に、ヘッダー `X-Tomori-Session` で匿名セッションIDを1つ送る（下の節）。

---

## 匿名セッションID

Worker のレート制限（1つのタブにつき 6回/分）のためだけに使う。

- `crypto.randomUUID()` で作る。使えない端末では `crypto.getRandomValues()` で同じ形（UUID v4）を作る。
  どちらも無い端末では送らず、固定の3語を使う
- `sessionStorage` の `tomori.vocabSession` に置く。タブを閉じると消える。Cookie・localStorage は使わない
- 名前・年齢・学校・写真・入力文とは結び付けない。Worker も保存しない
- 「デモを最初から」では同じIDを使い続ける
- 保存された値の形がおかしいときは使わず、作り直す
- **緊急停止スイッチが `false` の間は、IDを作らず、保存もしない**

---

## フォールバック

次のどれでも、固定の3語（鮮やか・燃えるよう・少しさびしげ）と
固定の質問「この赤は、何に似ている？」を出す。

- 6秒を過ぎた
- 通信できなかった
- 400・404・429（上限超過）・500・502・503 などのエラー
- JSONとして読めない
- 形がおかしい（3語でない、重複、文字数が多すぎる、質問が10〜35文字でない、など）

このとき画面には「今日は、トモリが見つけたことばを見てみよう。」と1回だけ出す。
エラーの中身は子どもに見せない。

---

## 緊急停止スイッチ

`demo-world.html` の `VOCABULARY_AI_ENABLED` で、AIへの通信を止められる。

- `false`（いまの設定）：外部へ一切送らない。匿名IDも作らない。いつも固定の3語を出す
- `true`：匿名IDを付けて `/vocabulary` へ送る

いまの本番 Worker（#38）には `/vocabulary` が無く、知らないパスは `/generate` へ回る。
ローカルの Worker（`tomori-worker-next`）では次のように直してあるが、まだ公開していない。

- 入口は `/` `/generate` `/generate-next` `/feedback` `/journey` `/teacher` `/guide` `/vocabulary` だけ。
  ほかは 404、POST 以外は 405
- AI のエラー本文は返さない（`{"error":"AI service temporarily unavailable","code":"UPSTREAM_ERROR"}`）
- `/vocabulary` はセッションごとに 6回/分、全体で 120回/分/Cloudflare拠点。超えたら 429

Cloudflare の上限は拠点ごとに数えるので、世界全体の費用上限にはならない。
Anthropic 側の支出上限を別に設定する必要がある。

**Worker の公開と Preview URL での確認が済むまで、`false` のままにする。**

---

## care のとき

- 画面に出す文面は、フロント側に書いた固定の文だけ。
  Worker から届いた `supportMessage` は表示に使わない（Worker 側も固定文に置き換えている。二重の守り）。
- 「書きなおす」：入力画面へ戻る。書いた文は残す。
- 「冒険にもどる」：画面を閉じて世界へ戻る。一度光るポイントから離れて、
  もう一度近づくと、ミッションがまた始まる。

---

## 安全な表示

AIから来た文字（ことば・読み・説明・質問）は、すべて `textContent` で入れる。
`innerHTML` は使わない。ルビ（`<ruby>` `<rt>`）も DOM の命令で組み立てる。
AIの文に `<img>` などが入っていても、ただの文字として出る。

---

## リセット

「デモを最初から」で次をすべて消す。

- 送信中の通信（中断する）
- 待機表示・care 表示・カード
- AIの深掘り質問（固定の質問へ戻す）
- フォールバック・care の状態

リセットのたびに番号（`_vocabGen`）を1つ進める。リセット前に送った通信の答えが
あとから届いても、番号がちがうので画面は書き換えない。

---

## テスト

```
node --test test-vocabulary-integration.mjs
```

実APIは呼ばない。`demo-world.html` の中の `VOCAB-CORE-BEGIN`〜`VOCAB-CORE-END` と
`VOCAB-DOM-BEGIN`〜`VOCAB-DOM-END` の範囲を読み込み、偽の `fetch` と
小さな偽DOMで動かす。この目印のコメントは消さないこと。

---

## 本番へ出す前に

1. Anthropic 側の支出上限を設定する
2. `tomori-worker-next` の Worker を公開する（HQの判断が必要）
3. Preview URL で、正常・care・429・404 を確かめる
4. そのあとで `VOCABULARY_AI_ENABLED` を `true` にする
5. 本物の応答で、正常・care・フォールバックの3つを画面で確かめる
