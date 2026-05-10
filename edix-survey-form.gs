/**
 * EDIX アンケートフォーム 自動生成スクリプト
 * tomori デモ体験者向け
 *
 * 使い方:
 *   1. https://script.google.com を開く
 *   2. 「新しいプロジェクト」を作成
 *   3. このコードをすべて貼り付けて保存
 *   4. 「createEDIXSurvey」を選択して▶実行
 *   5. 完成したフォームの URL がログに表示されます
 */

function createEDIXSurvey() {

  // ── フォーム基本設定 ──────────────────────────────────────────
  const form = FormApp.create('【EDIX 2025】tomori デモ体験アンケート');
  form.setDescription(
    'この度は tomori のデモをご体験いただきありがとうございます！\n' +
    'いただいたご意見は今後の開発に活かします。所要時間：約3分\n\n' +
    '※ご回答は匿名で集計されます。'
  );
  form.setCollectEmail(false);
  form.setConfirmationMessage(
    'ご回答ありがとうございました！🎉\n開発の励みになります。'
  );
  form.setShowLinkToRespondAgain(false);
  form.setProgressBar(true);

  // ── セクション1: あなたについて ──────────────────────────────
  form.addSectionHeaderItem()
    .setTitle('あなたについて')
    .setHelpText('まず、あなた自身のことを教えてください。');

  // Q1: 立場
  form.addMultipleChoiceItem()
    .setTitle('あなたの立場を教えてください')
    .setRequired(true)
    .setChoiceValues([
      '保護者（お子さんがいる）',
      '小学校の先生',
      '中学校・高校の先生',
      '塾・習い事の先生',
      '教育委員会・行政',
      'EdTech関連企業',
      'その他',
    ]);

  // Q2: 子どもの年齢（保護者向け）
  form.addCheckboxItem()
    .setTitle('お子さんの年齢（該当するものをすべて選択）')
    .setHelpText('保護者の方のみ、任意でお答えください。')
    .setChoiceValues([
      '未就学（5〜6歳）',
      '小学校低学年（1〜2年生）',
      '小学校中学年（3〜4年生）',
      '小学校高学年（5〜6年生）',
      '中学生以上',
      '該当なし',
    ]);

  // ── セクション2: デモ体験について ────────────────────────────
  form.addPageBreakItem()
    .setTitle('デモ体験について');

  // Q3: 総合満足度
  form.addScaleItem()
    .setTitle('デモ全体の印象はいかがでしたか？')
    .setRequired(true)
    .setBounds(1, 5)
    .setLabels('がっかり', 'とても良かった！');

  // Q4: 子どもが楽しめそうか
  form.addScaleItem()
    .setTitle('お子さん（または学習者）が楽しんで使えそうですか？')
    .setRequired(true)
    .setBounds(1, 5)
    .setLabels('難しそう', 'ぜひ使わせたい！');

  // Q5: 特に良かった機能
  form.addCheckboxItem()
    .setTitle('特に良いと感じた機能を選んでください（複数可）')
    .setRequired(true)
    .setChoiceValues([
      'AIが子どもに合わせた問題を出してくれる',
      'ゾーン・冒険マップのストーリー感',
      'ガチャ・アイテムのご褒美システム',
      'ミニゲームで楽しく学べる',
      'YouTubeチケット（視聴時間管理）',
      '学校チケット（給食おかわり券など）',
      '保護者モード・先生モードでの承認機能',
      'キャラクターの口調・親しみやすさ',
      'TTS（音声読み上げ）',
      '多言語対応',
    ]);

  // Q6: 改善してほしい点
  form.addCheckboxItem()
    .setTitle('改善してほしい点があれば選んでください（複数可）')
    .setChoiceValues([
      'アプリの動作速度・安定性',
      '問題の難易度バランス',
      '対応教科・分野を増やしてほしい',
      '保護者・先生画面をもっとわかりやすく',
      'デザイン・UIをシンプルにしてほしい',
      '学習記録・進捗レポートがほしい',
      '複数の子ども（生徒）を管理したい',
      'クラス全体での利用機能がほしい',
      '特になし',
    ]);

  // Q7: 自由記述（良かった点）
  form.addParagraphTextItem()
    .setTitle('良かった点・印象に残ったことを自由にお書きください')
    .setHelpText('任意');

  // Q8: 自由記述（要望）
  form.addParagraphTextItem()
    .setTitle('こんな機能がほしい！こうなったらもっと良い！など')
    .setHelpText('任意');

  // ── セクション3: 導入意向 ──────────────────────────────────
  form.addPageBreakItem()
    .setTitle('ご利用意向について');

  // Q9: 使いたいか
  form.addMultipleChoiceItem()
    .setTitle('正式リリース後、使いたいと思いますか？')
    .setRequired(true)
    .setChoiceValues([
      'ぜひ使いたい（無料でも有料でも）',
      '無料なら使いたい',
      '内容次第で使いたい',
      '今は使う予定はない',
    ]);

  // Q10: 適切な月額料金
  form.addMultipleChoiceItem()
    .setTitle('月額いくらまでなら払えますか？（有料の場合）')
    .setChoiceValues([
      '無料のみ',
      '〜 300円 / 月',
      '〜 500円 / 月',
      '〜 1,000円 / 月',
      '1,000円以上でも価値があれば',
      '学校・塾単位での契約なら検討できる',
    ]);

  // Q11: 学校・クラス導入
  const classItem = form.addMultipleChoiceItem()
    .setTitle('学校やクラス単位での導入に興味がありますか？')
    .setChoiceValues([
      'ぜひ導入したい',
      '検討したい（詳細が知りたい）',
      'あまり興味がない',
      '先生・行政ではないので該当なし',
    ]);

  // ── セクション4: 連絡先（任意） ────────────────────────────
  form.addPageBreakItem()
    .setTitle('続報のご連絡について（任意）')
    .setHelpText('正式リリースのお知らせや、先行アクセスのご案内を希望される方はご記入ください。');

  // Q12: メールアドレス
  form.addTextItem()
    .setTitle('メールアドレス')
    .setHelpText('任意。正式リリース時にご連絡します。')
    .setValidation(
      FormApp.createTextValidation()
        .requireTextIsEmail()
        .build()
    );

  // Q13: お名前
  form.addTextItem()
    .setTitle('お名前またはニックネーム')
    .setHelpText('任意');

  // Q14: 学校名・施設名
  form.addTextItem()
    .setTitle('学校名・施設名・会社名')
    .setHelpText('任意');

  // Q15: 追加コメント
  form.addParagraphTextItem()
    .setTitle('その他、何でもお気軽にどうぞ！')
    .setHelpText('任意');

  // ── 完了 ────────────────────────────────────────────────────
  const url = form.getPublishedUrl();
  const editUrl = form.getEditUrl();

  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  Logger.log('✅ フォーム作成完了！');
  Logger.log('');
  Logger.log('📋 回答用URL（これを参加者に共有）:');
  Logger.log(url);
  Logger.log('');
  Logger.log('✏️  編集用URL（自分だけ保存）:');
  Logger.log(editUrl);
  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // スプレッドシートと自動連携
  const ss = SpreadsheetApp.create('【EDIX 2025】tomori アンケート 回答');
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
  Logger.log('📊 回答スプレッドシートも作成しました:');
  Logger.log(ss.getUrl());
  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}
