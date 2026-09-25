# ANALYCA Media — Claude Code 引き継ぎ

確認日: 2026-09-26（JST）。対象: `/Users/kudo/ANALYCA`。本資料は、実装の引き継ぎであり、メディア全体の完成報告ではない。

## 1. 最初に読むこと

ユーザーの希望は「調べた内容をANALYCAメディアの記事にでき、公開記事・新着・ランキング・LINE導線・本人の投稿埋め込みがつながったメディア」。管理画面だけ、検索だけ動けば完成ではない。

- Instagram / YouTube / SEO / AIO / Webマーケティングは当初リサーチの対象例として挙がった。独断で固定カテゴリーや事業範囲に置き換えない。現在のタグと説明文は実装者の選択で、承認済み分類ではない。
- ユーザーは画面間の未接続、新着などの配置、公開URLの不整合に不満を示した。既存実装の説明より、実際に一連の操作が通ることを優先する。
- WordPressは導入していない。既存Next.jsアプリ内に独自CMSを追加した状態。移行判断は別件であり、勝手にWordPress化しない。
- 競合メディアの比較調査を完了したと証明できる成果物は、今回の確認では特定できていない。市場規模・SEO効果・月額費用の確定見積もりも、この資料で検証済み扱いしない。

## 2. 公開URLの問題と修正（最優先分は対応済み）

正規の公開先は **https://analyca.jp/media** に統一した。

| 用途 | URL |
| --- | --- |
| トップ | https://analyca.jp/media |
| 記事一覧・検索 | https://analyca.jp/media/articles |
| ユーザーが指摘した記事 | https://analyca.jp/media/articles/instagram-analysis-improvement-cycle |
| 管理画面 | https://analyca.jp/admin/media |
| 管理ログイン補助 | https://analyca.jp/admin/media-login |
| サイトマップ | https://analyca.jp/media/sitemap.xml |
| robots | https://analyca.jp/robots.txt |

### 原因

記事自体はDB上で公開済みで、`analyca.jp/media/articles/...` は本文を返していた。一方、内部リンクとcanonicalは `media.analyca.jp` に向いていた。サブドメインは旧Lolipop向けIPの名前解決が端末側に残り、SSLエラーになっていた。記事がDBにない問題と、リンク先ホストに到達できない問題を混同しないこと。

### 修正内容

- `lib/media/site.ts` の `mediaUrl()` を正規URL生成の唯一の起点にした。`NEXT_PUBLIC_MEDIA_URL` は現在参照しない。
- `proxy.ts` で `media.analyca.jp` を正規パスへ308転送。`/articles/foo` → `/media/articles/foo`、既に `/media` がある場合は二重化しない。クエリも保持。
- 内部リンク、公開プレビューリンク、canonical、sitemapを揃えた。
- rootの `app/robots.ts` を追加。メディア専用robotsの不適切なHost行を除去。
- `lib/media/routing.test.mjs` を追加し、URL・転送・API/静的ファイルの非転送を回帰テスト化。

### DNSの作業履歴と注意

先行作業でムームードメインの `media` にVercel向けAレコード `76.76.21.21` を設定し、Lolipop連携の重複を解除した。Vercelへのサブドメイン追加・証明書発行も実施。apex / www / メールのDNSは変更していない。

今回、Google / Cloudflareの公開DNSでは新IP、macOSの名前解決では旧IP `163.44.185.219` が残る状態を確認。新IPを指定したHTTPS接続では308と正しいLocationを確認した。旧IPキャッシュが残る端末でサブドメインの到達が直ちに直ったとは保証しない。メディア内の通常回遊はサブドメインに依存しない修正にした。証明書警告を迂回させない。

### Git / 本番

| コミット | 内容 |
| --- | --- |
| `d37043e` | メディア公開面・管理画面・生成・保存の初期実装 |
| `4f52e01` | 新規記事を即編集できるよう記事/履歴保存をDML化 |
| `9f77be8` | 新着・関連記事・記事一覧・設定・公開用3記事等 |
| `d564715` | 公開URLをanalyca.jpへ統一、robots、回帰テスト |

URL修正は `main` にpushし、GitHub連携のProductionビルドが `d564715` をビルドしてReadyになることを確認した。手動本番デプロイはしていない。

- deployment ID: `dpl_Gonwwn756FXqfMvMAD11r6oiww9n`
- deployment URL: `https://analyca-nfu0d4uv1-kudos-projects-0bee12bb.vercel.app`
- Vercel project: `analyca`

## 3. コードの入口

| 領域 | 主なファイル |
| --- | --- |
| 公開トップ・一覧・記事 | `app/media/page.tsx`, `app/media/articles/page.tsx`, `app/media/articles/[slug]/page.tsx` |
| 共通枠・サイドバー・カード | `app/media/_components/media-shell.tsx`, `media-sidebar.tsx`, `media-article-card.tsx` |
| 本文・埋め込み | `app/media/_components/article-renderer.tsx` |
| 計測 | `app/media/_components/tracking.tsx`, `tracked-link.tsx`, `app/api/media/events/route.ts` |
| スタイル | `app/media/media.module.css` |
| 管理一覧・設定 | `app/admin/media/_components/media-admin-dashboard.tsx` |
| 編集・自動保存 | `app/admin/media/_components/media-article-editor.tsx` |
| 記事・設定・計測の永続化 | `lib/media/repository.ts` |
| 型・入力検証・状態遷移 | `lib/media/types.ts`, `lib/media/validation.ts` |
| AI生成 | `lib/media/ai.ts` |
| 管理認証 | `lib/media/auth.ts`, `app/api/admin/media/session/route.ts` |
| URL/転送 | `lib/media/site.ts`, `proxy.ts` |
| SEO出力 | `app/media/layout.tsx`, `app/media/sitemap.ts`, `app/media/opengraph-image.tsx`, `app/robots.ts` |
| 初期記事投入スクリプト | `scripts/seed-media-launch-content.mjs`（本番書き込み。安易に再実行しない） |

### API

以下の管理APIは管理セッションが必要。

| API | メソッド | 役割 |
| --- | --- | --- |
| `/api/admin/media/articles` | GET / POST | 管理一覧 / draft作成 |
| `/api/admin/media/articles/[id]` | GET / PUT | 読み出し・履歴 / 更新 |
| `/api/admin/media/generate` | POST | テーマ・参考URLから下書き生成 |
| `/api/admin/media/settings` | GET / PUT | 共通著者・LINE・SNS・ランキング設定 |
| `/api/admin/media/upload` | POST | 記事画像アップロード |
| `/api/admin/media/session` | POST / DELETE | パスワード補助ログイン / セッション解除 |
| `/api/media/events` | POST | 公開側の閲覧・クリックイベント |

正確なrequest/response形状は各routeと `types.ts` / `validation.ts` を読むこと。

## 4. 保存・生成・認証の現状

### 保存と公開

- BigQuery project `mark-454114`、dataset `analyca`、location `asia-northeast1`。
- テーブル: `media_articles`, `media_article_revisions`, `media_settings`, `media_events`。
- 記事と履歴はDML INSERT/UPDATE。初期のstreaming insertでは直後の編集がstreaming buffer制限に引っかかったため変更済み。イベントはstreaming insert。
- 状態: `draft`, `review`, `approved`, `scheduled`, `published`, `archived`。遷移検証あり。POSTはdraft固定。
- scheduledは公開クエリで時刻到来を判定する。公開時刻にステータスを書き換えるcronではない。
- 本文は見出し・段落・箇条書き・引用・画像・埋め込み・CTAのブロック構成。
- GCS `analyca-media` の `media/articles` に画像を保存。JPEG/PNG/WebP/GIF、10MB上限。GCSバケットはサイトホストではない。

### AI

- OpenAI Responses API + web_search + JSON schema。
- 既定モデル `gpt-5.6-luna`。`MEDIA_AI_MODEL` / `MEDIA_AI_REASONING_EFFORT` で上書き。
- 生成結果を編集画面へ返す。生成ボタンだけで、新規記事の永続化・公開まで自動完了するものではない。
- 先行確認で本番生成200、26ブロック・4ソースを確認。ただし引用の妥当性や記事品質の全面確認を意味しない。
- 投稿データ全体の自動同期、編集企画管理、競合メディア調査の継続運用は実装していない。

### 認証

- `analycaUserId` と署名付き `analycaMediaAdmin` Cookieを確認。セッション12時間。
- `MEDIA_ADMIN_USER_IDS` 未設定時は既定ID `10012809578833342` のみ許可。
- OAuth callbackに許可ID向けのセッション発行処理あり。
- パスワード補助ログインも、許可されたユーザーCookieと設定済みパスワードが必要。既定のメディア用パスワードは設けていない。
- 署名secretのfallback: `MEDIA_ADMIN_SESSION_SECRET` → `MEDIA_ADMIN_PASSWORD` → `ADMIN_PASSWORD` → `INSTAGRAM_APP_SECRET` → `THREADS_APP_SECRET`。
- 実ユーザーが最初からログインして編集・公開まで通す完全なUI受入試験は未完了。

### 必要な環境変数（値は資料に記載しない）

- BigQuery: `GOOGLE_CLOUD_PROJECT_ID` または `PROJECT_ID`、`GOOGLE_APPLICATION_CREDENTIALS_JSON` または `GOOGLE_CREDENTIALS`。
- GCSの既存 `lib/gcs.ts` は `GOOGLE_CREDENTIALS` を使用。BigQuery側だけ設定しても画像保存を保証できない。
- AI: `OPENAI_API_KEY`。先行確認時は本番に存在、ローカルにはなし。
- 認証: 上記の管理ID・署名secret・必要時のパスワード。
- 秘密値をログ・文書・Gitにコピーしない。Vercel環境変数を丸ごと出力しない。

## 5. 本番データ（確認時点）

公開記事は以下の3件、いずれも `published` / revision 1。

1. `instagram-analysis-improvement-cycle`
2. `youtube-analytics-three-step-review`
3. `aio-seo-practical-content-design`

重要: これらは初期投入スクリプトでDBへ直接公開状態で入れた記事。管理画面でのユーザー校閲・承認済み原稿ではない。スクリプトは管理APIの状態遷移と履歴保存を経由せず、既存slugは上書きしない。日時も初期配置用にずらしている。3本公開されていることを、編集運用完成や十分なリサーチ完了の根拠にしない。

共通設定はDBに保存されている。

- サイト名: ANALYCA Media。
- 説明文: Instagram・YouTube・SEO・AI検索を、実行できる運用判断に変えるメディア。
- LINE: 既存 `lib/email.ts` の配布リンクを転用。現在の特典と一致するか未検証。既存メールの古いセミナー文言を、そのまま現行オファーとして扱わない。
- LINEバナー画像: 未設定（テキストカードのみ）。
- Instagram / Threads: `kudooo_ai`。YouTubeアカウントURLは未設定。
- サイドバー投稿: Threads `DdtQ2J0FJYY` とInstagram reel `Ddjb8GSN_56`。既存DBから実装者が選定した固定URLであり、ユーザーの掲載選定済みとはしない。
- ランキング期間30日、固定記事IDは空。
- 閲覧数・クリック数には実装者の検証操作が含まれる。自然流入や事業成果として報告しない。

## 6. 確認済みと未確認

### URL修正後に確認済み

- `npm run test:media`: 7/7成功（validation + routing）。
- 変更対象のESLint成功。`npm run build` 成功。既存のSentry/baseline警告あり。
- GitHub mainのURL修正コミットが本番Readyになり、canonicalドメインに反映。
- トップ、一覧、上記3記事、Instagram検索、タグ絞り込み、sitemap、root robotsがHTTP200。
- 3記事はタイトルだけでなく本文あり。HTML内の内部リンクは正規ホスト。canonicalも正規URL。
- 存在しない記事は404。
- 新IP宛のサブドメイン接続は308で、記事パスとクエリを保持。
- ブラウザで指定記事本文・一覧・Instagram検索1件を確認。操作結果の追記は末尾参照。

### ここまでの確認では保証しない

- Googleのインデックス登録、Search Console登録/サイトマップ送信、SEO順位、AIOでの引用。
- 全端末の旧DNSキャッシュ消滅。
- 管理ログインから作成・画像保存・予約・公開・更新・非公開までの通し操作。
- 保存競合、全外部埋め込みの表示安定性、スマホでの回遊。
- 過去のリポジトリ全体lintでは `next.config.js` / `scripts/threads-line-actions.js` の既存エラーがあった。今回の対象lint成功を全体lint成功と言い換えない。

## 7. Claude Codeの残作業（優先順）

### P1: ユーザーが指摘した「つながったメディア」の受入

1. 公開トップ → 記事一覧 → 検索 → 記事 → 関連記事 → 右側新着/ランキングをPC・スマホで通す。戻る・再読込・直リンクも確認。
2. PCの右側に新着、ランキング、LINE、本人投稿を読みやすく配置。現状ヒーローが大きく、短い語が孤立する改行・空白の多さがある。実際の画面で改善。
3. `media.module.css` の狭幅時 `nav a:not(:last-child)` 非表示により、メディアナビが消える。スマホ導線を用意。
4. Threads / Instagram埋め込みは、遅延表示・ページ遷移後・広告ブロック・未ログイン時を確認。先行スクリーンショットでは大きな空白があった。一方今回のブラウザAXでは実投稿本文/Instagram再生UIのロードも確認できた。常に失敗とも全面解決とも断定しない。fallbackリンクは実装済み。
5. 既存管理画面からメディア管理への導線を確認。`app/admin/page.tsx` は別作業の変更があるので上書きしない。
6. LINEの現在の特典・到達先とYouTube URL、実バナー画像・記事サムネイルを確定。現在は文字+グラデーションの代替カバー中心。

完了条件: 全リンクが正しい公開記事を開き、PC右側/スマホ下部が読め、未設定・読み込み失敗でも回遊を失わない。HTTP200だけで合格にしない。

### P2: 保存の信頼性

- `repository.ts`: expectedRevisionを読んで比較するが、UPDATEのWHEREがidのみ。競合判定と更新がatomicではなく、同時編集で上書きする可能性。履歴INSERTも別処理。条件付き更新と影響行数確認/transaction等を検討。
- 編集UI: 自動保存のレスポンスで保存時点の記事をstateへ戻す処理がある。保存待ち中の追加入力が消える可能性を再現試験して修正。
- archivedの表示/復帰UI、履歴の復元操作は不十分。履歴一覧があることと復元できることを分ける。
- 管理ログインから編集・プレビュー・承認・公開・予約・非公開を通し試験。既存公開記事を破壊せず、検証データの扱いを明示。

完了条件: 保存中入力が失われず、競合は409等で明示され、公開条件/予約時刻/履歴が再読込後も一貫する。

### P3: ビュー/クリック計測の未接続を修正

- `tracked-link.tsx` はrelated placement以外をcta_click扱い。SNSリンクもcta_clickで、social_clickにならない。
- 記事カード・関連記事・ランキング・新着は通常のLinkで、関連記事クリック計測につながっていない。「関連記事も計測できる」と完了扱いしない。
- overviewのビューはトップ/一覧を含む一方、ランキングは記事ID集計。数字の定義と期間をUIで明示。
- 管理者・検証操作の除外、連続閲覧重複の扱いは未整備。簡易UA botフィルターだけで分析品質を保証しない。
- sendBeaconがfalseを返した場合のfallbackやsessionStorage例外を確認。

完了条件: 各操作 → 正しいevent type/article ID/placement → DB → 管理集計 → ランキングまで照合。テストアクセスを実績に混ぜない。

### P4: 記事増加と障害への対応

- トップ50件、一覧100件、sitemap100件の上限とページネーションなしを解消。
- 検索はタイトル/説明中心で本文検索ではない。
- トップの新着は検索/タグ絞り込み済み配列から取るため、サイト全体の新着でなくなる。一覧側と挙動を揃える。
- 関連記事は直近12件からタグ一致、最大3件。十分な記事が増えた場合の適切な関連付けを考える。
- ランキング固定記事は取得上位30件に入らないと拾えず、0viewは表示されない。管理設定と表示の不一致を直す。
- DB例外を空配列や既定設定に潰す箇所があり、障害と0件を区別できない。ログ/エラー表示/監視を追加。
- AI sourcesは指定URLを追加する実装があり、実際に参照した根拠かを保証しない。引用整合性と人による公開前確認を強化。

### P5: 編集方針・調査・SEOの仕上げ

- ユーザーが求めた競合メディア調査を、実サイトのレイアウト・記事回遊・管理運用・LINE導線の根拠付きで整理。勝手にカテゴリーを増やさない。
- 現在3本の記事を、ANALYCA独自の実例・図・出典・責任ある著者情報でレビュー。汎用AI文を完成原稿としない。
- metadata/OG/構造化データの整合性、sitemap全件、404/非公開除外、検索パラメータcanonical、旧URL転送を検証。
- Search Console等の実設定、月額費用（AI/BigQuery/画像/ホスティング）と記事当たりコストは実利用前提で見積もる。現在の資料に確定額はない。

## 8. 作業再開のルール

```bash
cd /Users/kudo/ANALYCA
git branch --show-current
git status --short
git log -5 --oneline
npm run test:media
npm run dev
```

重要な実装後は対象lint・テスト・`npm run build`。変更したファイルだけstageし、mainへcommit/push。GitHub連携のデプロイ完了と正規URLの実操作を確認。ブランチ/別worktree/`vercel --prod` は使わない。

問題発生時は新しい修正コミット、または影響範囲を確認した対象コミットのrevertをmainへpushする。URL修正以前に戻すと旧サブドメイン問題が再発する。DBはGitでは復元できないため、記事/設定変更前に対象データを安全に控え、無関係なテーブルやレコードを触らない。

### 引き継ぎ時に存在した無関係な変更（保護する）

```text
 M .serena/project.yml
 M app/[userId]/components/research-tab.tsx
 M app/[userId]/dashboard-page-client.tsx
 M app/admin/page.tsx
 M lib/research-access.ts
 M lib/research.ts
?? .codex-tmp/
?? .playwright-cli/
?? app/api/research/analyze/
?? docs/threads-aii-drafts-2026-06-19.md
?? docs/threads-aii-nobiru-series-2026-06-19.md
?? lib/research-analysis.ts
?? output/
?? tmp/
```

`git add .` や作業ツリー全消去をしない。引き継ぎ後の最新差分を再確認する。

## 9. Claude Codeへ渡す依頼文

> docs/media-handoff-2026-09-26.mdを読んでANALYCAメディアの残作業を引き継いでください。まず正規URL https://analyca.jp/media と指定Instagram記事を確認し、P1の回遊・PC右側の新着/ランキング/LINE/本人投稿、スマホ導線を完成させてください。その後、保存競合とビュー/クリック計測の未接続を直してください。カテゴリーや事業方針を勝手に派生させず、既存の別作業差分を保護してください。実装有無と実際の動作確認を区別し、mainへのpushと本番操作確認まで行ってください。公開記事の追加・配信・LINE特典変更は別途内容を確認してください。

## 10. 最終ブラウザ確認の追記

本番の既存タブを再読み込みしてから、実際にリンクと検索ボタンを操作し、次の遷移を確認した。

1. 指定Instagram記事の本文表示。内部リンクは `analyca.jp/media` 配下。
2. ヘッダー「記事一覧」クリック → `/media/articles`、3件表示。
3. 検索欄にInstagramを入力して検索 → `/media/articles?q=Instagram`、1件表示。
4. 検索結果クリック → 指定Instagram記事の本文表示。
5. 本文下「関連記事」のYouTubeカードをクリック → `/media/articles/youtube-analytics-three-step-review`、YouTube記事の見出しと本文表示。

上記はURLと回遊の確認であり、レイアウト全面改修や管理画面受入の完了ではない。今回のURL修正・引き継ぎ作業では、記事の追加公開やLINE設定の変更はしていない。
