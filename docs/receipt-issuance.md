# 領収書の発行ページ

## 確定した動作

- 共通の `/receipts` を購入後の公式LINEで案内する。注文別ページや決済確認のゲートは設けない。
- 宛名、メール、支払日、使用された支払い方法を本人が入力。住所の入力欄は設けない。
- 銀行振込は税込100,000円で領収書と請求書。カードは税込110,000円で領収書のみ。
- PDFを同時にダウンロードでき、同じPDFを `info@analyca.jp` から添付送信する。
- PDF準備ができた時点でダウンロードリンクを返す。発行中はスピナーを表示する。
- 応答後にNext.jsのafterでメール送信を優先し、その後Driveへ保存する。画面を閉じても処理は継続する。未完了処理はGCSのpending記録に残り、毎時のジョブで再試行する（SMTP結果が不明な場合は重複送信を避けて手動確認）。
- 銀行振込メール・請求書には、お支払い済みで追加の支払いが不要と明記する。
- 発行月のドライブの「領収書」「請求書」にそれぞれ保存する。
- 毎月最終日21時（日本時間）に翌月のフォルダを準備する。毎時のジョブで月末を判定し、21時以降は失敗時に再試行する。閏年・12月→1月対応。
- 月途中の開始やジョブ失敗時も、発行時に必要なフォルダを作る。秘書作成済みの `2026年07月【締切】` のようなフォルダを再利用し、複数候補がある場合は勝手に選ばない。

## 実装と運用

- GCSに原本と発行履歴、処理待ちを保存する。公開メディア用バケットは使用禁止。Public Access Prevention が enforced、Uniform Bucket Level Access が有効な専用バケットが必須。
- 同一メール・支払日・決済方法は同じ発行番号・同じPDFを返す。訂正は別の新規領収書を勝手に作らず運営対応。購入が複数ある同一日の特殊ケースは運営対応。
- GCSのgeneration条件と期限付きロックで同時発行を防止。Drive IDはアップロード前に履歴へ保存し、失敗の再試行でも同じIDを使用。
- ダウンロードは1時間有効の署名付きリンク。Driveファイルの公開共有は行わない。
- SMTPの応答が不明な場合は `uncertain` として `review/` に記録し、自動再送はしない。送信元の送信履歴を照合して運営が復旧する。SMTP受理は受信箱到達の証明ではない。
- 発行回数はIPごと毎時20回、メールごと毎時5回。金額はサーバーで固定し、ブラウザから受け取らない。

## 本番接続に必要な設定

`.env.example` の RECEIPTS_* と CRON_SECRET を参照。既存のSMTP設定を再利用する。

1. 保存先は11月始まり、2025年11月を第7期（2026年11月は第8期）。ユーザー確認済み。
2. ユーザー指定に従い `autostudio@mark-454114.iam.gserviceaccount.com` を会計資料へ投稿者として共有。RECEIPTS_GOOGLE_CREDENTIALSでこのアカウントを明示する。旧gemアカウントの共有は取り消しており追加していない。会計資料のcanAddChildren=trueと、2026年10月の領収書／請求書フォルダ作成を実接続で確認済み。
3. 専用非公開GCSバケット `analyca-receipts-private` は作成・読書き・排他制御の実接続検証済み。RECEIPTS_BUCKETと32文字以上のRECEIPTS_SECRETを設定する。
4. CRON_SECRETを設定する。既存値がある場合は変更しない。既存cron全体の認証にも使われるため他の呼び出し元を確認する。
5. RECEIPTS_ENABLED=true を設定して、検証後にmainへpushする。Vercelの自動デプロイREADYと公開URLを確認する。
6. 本人宛てテストで、PDFダウンロード・添付メール・Drive原本一致を確認し、`jobs/latest.json` でジョブ実行を確認する。

本番SMTPの接続認証は2026-10-22に成功。本番設定はAutoStudioのGoogle接続を使用する。書類の作成にはINVOYを使用せず、同梱の雛形からPDFを生成する。

管理者の動作確認ではPOSTにsample=trueとCRON_SECRETのBearer認証を指定する。番号にTESTを付け、PDFに見本を明記し、メール件名・本文にもテストを表示する。Driveは「発行システム動作確認（会計対象外）」に保存し、通常の会計書類と分離する。公開フォームにはこの項目を出さない。

2026-10-22 検証結果：17テスト成功、対象ESLint成功、Next.js本番ビルド成功。単独の全体tscは既存 `lib/__tests__/yoko-draft-generate-route.test.ts:3` の `node:module.registerHooks` 型定義エラー1件のみ。新規機能の型エラーなし。PCとCSS幅390pxの実画面に横はみ出しなし。PDF3種は画像にレンダリングして目視確認済み。

## 検証

```sh
node --experimental-test-module-mocks --import ./scripts/register-ts-tests.mjs --test lib/receipts/*.test.mjs
npx tsc --noEmit
npm run build
```

PDF見本は `output/receipts/`。全3種に見本表示があり、実際の発行履歴やメールには登録しない。

## UI方針

購入後の事務手続きとして、白い入力面と淡い青灰の背景を使用。本文 #243345、補助 #63758a、背景 #f4f7fa、操作 #245878、境界 #dce4eb。日本語はHiragino/Yu Gothic。PCは左に説明、右に入力、スマートフォンは縦一列。装飾的なステップや余分な設定を置かず、領収書発行を主操作にする。

## 参考

- Vercel cronはUTC指定：https://vercel.com/docs/cron-jobs
- 同時作成の排他条件：https://docs.cloud.google.com/storage/docs/request-preconditions
- フォント：Noto Sans JP（SIL OFL）、同梱OFL.txtを参照。
