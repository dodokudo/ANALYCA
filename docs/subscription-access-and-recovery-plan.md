# ANALYCA subscription access and recovery plan

作成日: 2026-06-19

## 目的

解約済み・決済失敗ユーザーのダッシュボード閲覧を適切に制限しつつ、管理者は常に確認できる状態にする。

同時に、UnivaPayのサブスクリプション状態に合わせて、カード変更・課金復活・決済失敗時の案内をANALYCA側に実装する。

## UnivaPay仕様の確認結果

参照:

- https://docs.univapay.com/docs/api/subscriptions/overview/
- https://docs.univapay.com/docs/api/subscriptions/request/create/
- https://docs.univapay.com/docs/api/subscriptions/request/update/
- https://docs.univapay.com/docs/api/subscriptions/request/cancel/
- https://docs.univapay.com/docs/guide/detail/webhook/

重要な仕様:

- 定期課金オブジェクトは `subscription`。
- 定期課金は `UPDATE` または `CANCEL` で停止できる。
- `current` は継続中。
- `unpaid` は支払い失敗後のリトライ待ち。
- `suspended` は一時停止。UPDATEで再開対象にできる。
- `canceled` は永久停止。UnivaPay仕様上、再開不可。
- `completed` は指定回数完了。仕様上は再開可能。
- `next_payment.due_date` が次回課金日の基準になる。
- `schedule_settings.termination_mode` は `immediate` または `on_next_payment`。
- `next_payment.terminate_with_status` は次回課金時の停止予約を表す。停止予約を取り消す場合は空文字に戻す。
- カード変更は `transaction_token_id` をUPDATEする。対象ステータスは `unconfirmed`, `unpaid`, `current`, `suspended`。
- Webhookは3秒以内に2xx応答する必要がある。
- 定期課金成功は `subscription_payment`。
- 定期課金失敗は `subscription_failure`。
- 定期課金キャンセルは `subscription_canceled`。
- 定期課金停止は `subscription_suspended`。

結論:

- 「解約済みの復活」は、UnivaPay上で `canceled` になっている場合、既存subscriptionを復活させるのではなく、保存済みの `recurring_token_id` から新しいsubscriptionを作り直す必要がある。
- `suspended` の復活は、既存subscriptionに対してUPDATEで戻せる可能性がある。
- `unpaid` はまずカード変更を促し、カード変更後にUnivaPayのリトライ、または必要なら既存subscription更新で回復させる。

## ANALYCAの現状

### ダッシュボード閲覧

対象:

- `app/[userId]/page.tsx`
- `app/api/dashboard/[userId]/route.ts`

現状:

- `/{userId}` は `getUserById(userId)` と `getUserDashboardData(userId)` を呼び、契約状態に関係なくダッシュボードデータを返している。
- `subscription_status`, `subscription_expires_at`, `trial_ends_at`, `plan_id`, `line_linked` は返しているが、閲覧制限には使っていない。
- コメント上も「課金ゲートは決済フロー完成後に有効化する」となっており、現在は全ユーザーを通している。

### 管理画面URL

対象:

- `app/admin/page.tsx`

現状:

- 管理画面には通常のダッシュボードURL `/{userId}` だけが表示されている。
- 管理者専用URLはまだない。

今回の方針:

- 通常URL: `https://analyca.jp/{userId}`
- 管理者URL: `https://analyca.jp/{userId}/admin`
- `/admin` にトークンは付けない。
- `/admin` は管理者確認用として、契約制限を無視してダッシュボードを表示する。

### カード変更

対象:

- `app/[userId]/components/subscription-settings.tsx`
- `app/api/subscription/payment-method/route.ts`
- `lib/univapay/client.ts`

現状:

- 設定画面にカード変更フォームがある。
- APIは `transactionTokenId` を受け取り、UnivaPayの `updateSubscription()` で `transaction_token_id` を差し替える。
- BigQuery側も `transaction_token_id` と `recurring_token_id` を更新している。
- 対象ステータスは `unconfirmed`, `unpaid`, `current`, `suspended`。

不足:

- 決済失敗時にダッシュボード側からカード変更へ明確に誘導する画面がない。
- カード変更後に、ユーザーが何をすれば復旧するのかの状態別処理がまだ分かれていない。

### 解約

対象:

- `app/api/subscription/cancel/route.ts`
- `lib/univapay/client.ts`

現状:

- 解約APIはUnivaPayのCANCELを呼ぶ。
- その後 `getSubscription()` で `next_payment_date` を取得し、BigQueryの `subscription_expires_at` に保存しようとしている。
- 取得失敗時は30日後をfallbackにしている。
- BigQueryの `subscription_status` は `canceled` になる。

注意:

- UnivaPay仕様上、`canceled` は永久停止で再開不可。
- そのため「復活」には新しいsubscription作成が必要。
- `subscription_expires_at` がNULLの過去データは、正しいpaid-through期間が分からないため、UnivaPay照合または過去決済履歴で補完が必要。

### Webhook

対象:

- `app/api/webhooks/univapay/route.ts`

現状:

- `charge_finished` / `charge.successful` を `current` にしている。
- `charge_updated` / `charge.failed` を `unpaid` にしている。
- `subscription_payment` を `current` にしている。
- `subscription_suspended` / `subscription.suspended` を `suspended` にしている。
- `subscription_canceled` / `subscription.canceled` を `canceled` にしている。

不足:

- 公式イベント名 `subscription_failure` の処理がない。
- `subscription_payment` 時に次回課金日や有効期限を更新する処理が弱い。
- `subscription_canceled` 時に `subscription_expires_at` を確実に補完する処理が弱い。
- 支払い失敗時のエラー理由やカード変更必要状態をDBへ残していない。

### データ取得・保持

対象:

- `lib/bigquery.ts`
- `app/api/sync/*`

現状:

- Threads/Instagramの同期対象は、SNSトークンの有無と期限で判定している。
- `subscription_status` では同期対象を絞っていない。

結論:

- 解約後もMetaトークンが生きている限り、バックエンドでデータ取得を継続する要件は既に満たしている。
- 今回はここを変えない。
- 変えるのは「通常ダッシュボードで見せるかどうか」だけ。

## アクセス制御仕様

### 通常URL `/{userId}`

表示可能:

- `subscription_status` が `current`
- `subscription_status` が `active`
- `subscription_status` が `trial`
- `subscription_status` が `canceled` だが、`subscription_expires_at` が未来
- `subscription_status` が `none` またはNULLで、初回決済が空白の個別対応ユーザー

制限:

- `subscription_status` が `canceled` かつ `subscription_expires_at` が過去
- `subscription_status` が `expired`
- `subscription_status` が `unpaid` で、支払い猶予を超えている
- `subscription_status` が `suspended`

要注意:

- `unpaid` は即時ブロックにするか、リトライ猶予期間を設けるかを実装時に決める。
- ユーザー説明としては「カード決済が完了できていません。カード情報を確認してください。」が自然。

### 管理者URL `/{userId}/admin`

仕様:

- 契約ステータスに関係なく表示する。
- 管理画面のユーザー一覧に通常URLと管理者URLを両方表示する。
- このURLでは、グレーアウトや再契約案内を出さない。

実装候補:

- `app/[userId]/admin/page.tsx` を追加。
- 共通ダッシュボードコンポーネントを `app/[userId]/page.tsx` から切り出す。
- 管理者ページはAPI呼び出し時に `admin=1` を渡すか、専用API routeを使う。
- `app/api/dashboard/[userId]/route.ts` 側はadminアクセス時だけ制限判定をスキップする。

## 制限画面仕様

### 解約済み・期限切れ

表示:

- 背景またはコンテンツをグレーアウト。
- メッセージ: `ご契約期間が終了しています`
- 補足: `再契約するとダッシュボードを再び確認できます。`
- CTA: `再契約する`

処理:

- `canceled` は既存subscriptionを再開できないため、新規subscription作成へ進める。
- 既存の `recurring_token_id` が有効なら、カード再入力なしで新規subscription作成できる可能性がある。
- `recurring_token_id` がない、または使えない場合はカード登録画面へ送る。

### 決済失敗

表示:

- 背景またはコンテンツをグレーアウト。
- メッセージ: `カード決済が完了できていません`
- 補足: `登録済みカードの有効期限や利用状況を確認し、カード情報を更新してください。`
- CTA: `カード情報を変更する`

処理:

- 設定画面のカード変更フォームへ誘導する。
- カード変更APIは既存の `/api/subscription/payment-method` を使う。
- カード変更後、UnivaPayの状態が `unpaid` / `suspended` の場合は復旧処理を行う。

## 課金復活仕様

### `unpaid`

目的:

- 決済失敗からの復旧。

処理:

1. ユーザーにカード変更を促す。
2. 新しい `transaction_token_id` を `/api/subscription/payment-method` に送る。
3. 既存subscriptionの `transaction_token_id` を更新する。
4. UnivaPayのリトライで成功すればWebhook `subscription_payment` で `current` に戻る。
5. 必要なら、手動復旧APIで `getSubscription()` を呼び、ステータスが `current` ならDBを更新する。

### `suspended`

目的:

- 一時停止からの復旧。

処理:

1. カード変更が必要なら先にカード変更。
2. UnivaPayのUPDATEで `status` を復旧可能な値へ戻す。
3. `next_payment.terminate_with_status` が設定されている場合は空文字に戻す。
4. BigQueryを `current` またはUnivaPayから返ったstatusに更新する。

### `canceled`

目的:

- 解約済みユーザーの再契約。

処理:

1. `subscription_expires_at` が未来なら、期間満了までは通常利用可能。
2. 期限切れなら制限画面を出す。
3. `recurring_token_id` が保存されている場合、`createSubscriptionFromToken()` で新しいsubscriptionを作る。
4. `recurring_token_id` が使えない場合、カード登録画面へ誘導する。
5. 作成成功後、BigQueryの `subscription_id`, `subscription_status`, `subscription_created_at`, `subscription_expires_at` を更新する。

## 必要な実装項目

### 1. 権限判定ヘルパー追加

追加候補:

- `lib/subscription-access.ts`

責務:

- `canViewDashboard(user, now, isAdmin)` を返す。
- `accessState` を返す。

想定ステート:

- `allowed`
- `admin_allowed`
- `payment_failed`
- `expired`
- `canceled_expired`
- `suspended`
- `unknown_allowed`

### 2. ダッシュボードAPIに制限判定を追加

対象:

- `app/api/dashboard/[userId]/route.ts`

実装:

- 通常アクセスでは、制限対象の場合に詳細データを返さない。
- 制限理由、契約状態、有効期限だけ返す。
- 管理者アクセスでは制限判定をスキップする。
- `updateLastLogin()` は制限アクセスでも記録する。

### 3. ユーザーダッシュボードUIに制限画面を追加

対象:

- `app/[userId]/page.tsx`

実装:

- APIレスポンスの `accessState` を見て、制限画面を表示する。
- `payment_failed` はカード変更導線。
- `expired` / `canceled_expired` は再契約導線。
- 管理者URLでは通常表示。

### 4. 管理者URLページを追加

対象:

- `app/[userId]/admin/page.tsx`
- `app/admin/page.tsx`

実装:

- `/{userId}/admin` を追加。
- 管理者ページは既存ダッシュボードと同じUIを使う。
- 管理画面のユーザー一覧に通常URLと管理者URLを両方表示する。

### 5. 課金復活APIを追加

追加候補:

- `app/api/subscription/reactivate/route.ts`

実装:

- `userId` を受け取る。
- 現在のDB状態とUnivaPay状態を取得する。
- `suspended` は既存subscriptionをUPDATEで復帰。
- `canceled` / `expired` は `recurring_token_id` があれば新規subscription作成。
- `recurring_token_id` がなければカード登録が必要と返す。
- 成功後、BigQuery更新とLINE Harness同期を行う。

### 6. 決済失敗Webhookを補強

対象:

- `app/api/webhooks/univapay/route.ts`

実装:

- `subscription_failure` を処理する。
- `subscription_payment` 成功時にUnivaPayからsubscriptionを取得し、DBを `current` に戻す。
- `subscription_canceled` 時に `subscription_expires_at` を補完する。
- `unpaid` / `suspended` の状態をLINE Harnessにも同期する。

### 7. subscription DB項目の補完

対象:

- BigQuery `analyca.users`

確認・必要なら追加:

- `subscription_expires_at`
- `transaction_token_id`
- `recurring_token_id`
- `subscription_last_failure_at`
- `subscription_failure_reason`

既存の `transaction_token_id` / `recurring_token_id` は利用済み。

追加するなら:

- `subscription_last_failure_at`
- `subscription_failure_reason`

### 8. 過去データ補正

対象:

- `subscription_status IN ('canceled', 'expired', 'unpaid', 'suspended')`
- `subscription_expires_at IS NULL`
- `subscription_id IS NOT NULL`

作業:

1. BigQueryから対象ユーザーを抽出。
2. UnivaPay `getSubscription()` で現在状態と `next_payment.due_date` を取得。
3. DBの `subscription_status` と `subscription_expires_at` を補完。
4. paid-through期間中のユーザーを誤ってブロックしないようにする。

## 実装順

1. UnivaPay照合スクリプトを作り、過去ユーザーの `subscription_status` / `subscription_expires_at` を確認する。
2. `lib/subscription-access.ts` を追加し、アクセス判定を一箇所に集約する。
3. `app/api/dashboard/[userId]/route.ts` に通常/管理者アクセス判定を入れる。
4. `app/[userId]/page.tsx` に制限画面を追加する。
5. `app/[userId]/admin/page.tsx` を追加し、管理者URLを実装する。
6. `app/admin/page.tsx` に管理者URL列またはリンクを追加する。
7. `app/api/subscription/reactivate/route.ts` を追加する。
8. `app/api/webhooks/univapay/route.ts` に `subscription_failure` と状態補完を追加する。
9. 設定画面のカード変更後に、必要なら復活APIを呼ぶ導線を追加する。
10. buildで型確認する。
11. ローカルで通常URL・管理者URL・支払い失敗・期限切れの表示を確認する。
12. 本番へpush/deployし、対象URLで表示確認する。

## 受け入れ条件

- 契約中ユーザーは通常URLでそのまま閲覧できる。
- 解約済みでも有効期限内なら通常URLで閲覧できる。
- 有効期限切れの解約済みユーザーは通常URLで制限画面になる。
- 決済失敗ユーザーは通常URLでカード変更案内になる。
- `/{userId}/admin` は契約状態に関係なく閲覧できる。
- 管理画面から通常URLと管理者URLを確認できる。
- 解約後もSNSトークンが有効な限り、バックエンドの同期は止まらない。
- `subscription_failure` webhookでDBが `unpaid` などの適切な状態に更新される。
- カード変更後に復旧できる導線がある。
- `canceled` からの復活は既存subscription再開ではなく、新規subscription作成で行う。

## 実装時の注意

- 初回決済が空白のユーザーは個別ログイン対応があるため、安易に制限しない。
- `subscription_created_at` は「初回決済日」として完全には信用しない。現コードではサブスク作成時にも入っている。
- paid-through期間の判定は `subscription_expires_at` を優先する。
- `subscription_expires_at` がNULLの解約済みユーザーは、実装前にUnivaPay照合で補正する。
- ダッシュボード制限は表示制限であり、データ同期停止ではない。
- 管理者URLは `/admin` のみで実装し、追加tokenは付けない。
