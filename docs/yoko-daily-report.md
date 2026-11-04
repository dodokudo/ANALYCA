# YOKO Threads 日次通知

- 毎日11:00 JST（Vercel cron `0 2 * * *`）。対象日は日本時間の昨日。
- 通知タイトル・カード見出しは `11月4日（水）運用結果` の形式。
- 順番はフォロワー数 → フォロワー増加数 → リンククリック → LINE登録。投稿数・閲覧数・いいね・投稿例を続ける。
- ボタンは通常のThreads分析タブ `?tab=threads&threadsTab=analysis` を開く。
- 閲覧数・いいねは対象日に公開した投稿の取得時点の累計。アカウント全体の当日閲覧数とは扱わない。
- フォロワー増加数は対象日と前日の保存値の差。片方がない場合は「未取得」。LINE登録は翌日以降の取得記録が確認できる場合のみ0人を表示できる。

## 有効化

`lib/yoko-daily-report-config.ts` に宛先・有効状態・開始日時を定義する。送信先は「山路さん　サポートグループ」。2026年11月6日11:00 JSTから開始し、初回は11月5日分を通知する。開始日時より前の通常実行では送信しない。

API `/api/cron/yoko-daily-report` は `CRON_SECRET` のBearer認証を必須とする。`?dryRun=true` はデータ集計・Flexの形式・LINEの現在のグループ名を検証し、送信しない。既存のGuardian `/send-thread-message` と `THREADS_LINE_API_KEY` を使用する。

## 重複防止

`analyca.yoko_daily_report_deliveries` と `yoko_daily_report_lock` により、日付・グループ単位で送信枠をトランザクションで確保する。固定UUIDをLINEの再送キーにも使用する。受け付けられたメッセージIDを保存し、再実行時は送信しない。

送信応答が不明な場合は `unconfirmed`（DB更新にも失敗した場合は `sending`）で保持し、自動再送しない。手動でLINE側の受理状況を確認する。送信済み・確認待ち記録を消して再実行しない。

## 検証

```sh
node --experimental-test-module-mocks --import ./scripts/register-ts-tests.mjs --test lib/__tests__/yoko-daily-report*.test.ts
```

LINEの[再送キー仕様](https://developers.line.biz/en/docs/messaging-api/retrying-api-request/)に従い、最初の送信から同じキーを使う。キーだけに依存せず、永続的な送信記録でも重複を防ぐ。
