# 契約・入会業務の移管先

業務本体はGuardianの `docs/course-applications.md` と `src/webhook/course-applications/` に移管しました。

ANALYCAの役割は、Guardianの認証付き書類発行依頼を受け、領収書PDF・メール・Drive保管・既存ダウンロードURLを提供することです。契約住所、代表者、LINEの顧客識別子は新しい書類APIへ渡しません。

- 内部書類API: `/api/internal/course-documents`（`COURSE_DOCUMENTS_TOKEN` のBearer認証）
- 旧 `/api/webhooks/lme`: Guardianへの互換中継のみ。業務データは保存・判断しません。
- 旧 `/api/cron/course-applications`: 無処理。Vercel cron定義から除外。
- 書類の再送防止とメール・Driveの再試行は既存 `lib/receipts/` と `/api/cron/receipts`。
- 既存のダウンロードリンクを維持するため `RECEIPTS_SECRET` は変更しません。
- GMOサインと個人LINEの自動操作はこの移管に含まれません。
