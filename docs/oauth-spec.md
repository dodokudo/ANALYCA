# ANALYCA OAuth 仕様書

このドキュメントはOAuth認証フローの仕様を定義する。
**このファイルに反する変更は絶対に行わないこと。**

---

## 1. Threads OAuth

### 方式: リダイレクト（window.location.href）

```
window.location.href = `https://threads.net/oauth/authorize?...`
```

### 禁止事項
- **ポップアップ方式（openOAuthPopup）を使ってはならない**
- 理由: threads.com は Cross-Origin-Opener-Policy (COOP) を設定しており、ポップアップから親ウィンドウへの通信が不可能。500エラーが発生する
- この制限はMeta/Threads側の仕様であり、ANALYCA側では回避不可能

### OAuth URL
```
https://threads.net/oauth/authorize
  ?client_id={NEXT_PUBLIC_THREADS_APP_ID}
  &redirect_uri={APP_URL}/api/auth/threads/callback
  &scope=threads_basic,threads_content_publish,threads_manage_insights,threads_manage_replies,threads_read_replies
  &response_type=code
  &state={pendingUserId等のJSON（任意）}
```

### Callback処理 (`/api/auth/threads/callback`)
1. code取得 → `#_` サフィックス除去
2. Short token取得 → Long token交換（60日有効）
3. アカウント情報取得（username, profile_picture_url）
4. stateパラメータからpendingUserId取得（あれば既存ユーザーにマージ）
5. BigQuery upsert
6. `/{userId}?tab=threads&auth=threads_complete&syncing=true` へリダイレクト
7. Cookie `analycaUserId` をセット

### 使用箇所（全4ファイル）
- `app/login/page.tsx` — handleThreadsLogin()
- `app/onboarding/light/page.tsx` — handleThreadsOAuth()
- `app/onboarding/standard/page.tsx` — handleThreadsOAuth()
- `app/api/auth/threads/callback/route.ts`

---

## 2. Instagram OAuth

### 方式: ポップアップ（openOAuthPopup）

```typescript
const { userId } = await openOAuthPopup(oauthUrl);
```

ポップアップがブロックされた場合のフォールバック:
```typescript
if (err instanceof PopupBlockedError) {
  window.location.href = oauthUrl;
}
```

### なぜポップアップが使えるか
- Instagram（instagram.com）はCOOPを設定していないため、ポップアップ→親ウィンドウ間の通信が正常に動作する

### OAuth URL
```
https://www.instagram.com/oauth/authorize
  ?enable_fb_login=0
  &force_authentication=1
  &client_id={NEXT_PUBLIC_INSTAGRAM_APP_ID}
  &redirect_uri={APP_URL}/api/auth/instagram/callback
  &scope=instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments,instagram_business_content_publish
  &response_type=code
  &state={pendingUserId等のJSON（任意）}
```

ログインページ（/login）のみscopeが異なる:
```
scope=instagram_business_basic,instagram_business_manage_insights
```

### Callback処理 (`/api/auth/instagram/callback`)
1. code取得
2. Short token取得 → Long token交換（60日有効）
3. プロフィール取得（username, profile_picture_url, followers_count等）
4. stateパラメータからpendingUserId取得（あれば既存ユーザーにマージ）
5. BigQuery upsert
6. ポップアップ経由: `/auth/callback-success?userId={userId}` へリダイレクト（親ウィンドウがpostMessageで受信）
7. Cookie `analycaUserId` をセット

### 使用箇所（全4ファイル）
- `app/login/page.tsx` — handleInstagramLogin()
- `app/onboarding/light2/page.tsx` — handleInstagramOAuth()
- `app/onboarding/standard/page.tsx` — handleInstagramOAuth()
- `app/api/auth/instagram/callback/route.ts`

---

## 3. 共通ルール

### Cookie
- 名前: `analycaUserId`
- maxAge: 365日
- sameSite: lax
- path: /

### Token有効期限
- Threads: 60日（`threads_token_expires_at`）、期限7日前にcronで自動更新
- Instagram: 60日（`ig_token_expires_at`）

### stateパラメータ
- 決済後のオンボーディングで使用
- 形式: `encodeURIComponent(JSON.stringify({ pendingUserId: userId }))`
- callbackでデコード → pendingUserIdがあれば既存ユーザーにSNS情報をマージ

---

## 4. 変更時の必須チェックリスト

OAuth関連コードを変更する場合、以下を必ず確認:

- [ ] Threadsはリダイレクト方式（window.location.href）になっているか
- [ ] Threadsでポップアップ（openOAuthPopup）を使っていないか
- [ ] Instagram callbackはポップアップ対応（/auth/callback-success経由）になっているか
- [ ] 全4ファイル（login, onboarding/light, onboarding/light2, onboarding/standard）で一貫しているか
- [ ] Threads callbackのリダイレクト先が `/{userId}?tab=threads&auth=threads_complete&syncing=true` になっているか
- [ ] stateパラメータの受け渡しが壊れていないか
- [ ] npm run build でエラーがないか
- [ ] 本番デプロイ後にThreadsログイン・Instagramログインの両方を実機テストしたか
