# Threads リサーチ系権限 アプリレビュー申請

> 対象アプリ: ANALYCA for Threads
> 申請権限: `threads_keyword_search` / `threads_profile_discovery`
> 最終更新: 2026-09-04
> 動画1本で2権限をカバーする

---

## 0. 設計方針

前回 `threads_content_publish` が却下された理由は「スクリーンキャストが機能を実演していない」。
今回はそれだけを基準に画面を作った。

**画面は2つのパネルだけ。1パネル = 1権限。**

| 画面上の見出し | 権限 | 呼ぶAPI |
|---|---|---|
| ① キーワードで投稿を検索する | `threads_keyword_search` | `GET /keyword_search` |
| ② アカウントのプロフィールと公開投稿を見る | `threads_profile_discovery` | `GET /profile_lookup`, `GET /profile_posts`, `GET /{post-id}/conversation` |

見出しの横に権限名を等幅フォントで表示している。レビュアーは音声を聞かないので、
**映像だけで「この操作がこの権限」と読み取れる**必要があるため。

保存機能・監視リスト・定期収集はこの画面に置いていない。入力したら即APIを叩いて即表示するだけ。
余計な要素は「なぜ他人のデータを溜めるのか」という疑問を生み、エラーが映る事故の確率も上げる。

対象画面: ANALYCAダッシュボード → 「競合リサーチ」タブ

---

## 1. デモに使うアカウント: @threads

**@meta は使わないこと。** 実測で `profile_posts` が1件しか返らない（2026-09-04時点、3回試行して全て1件）。

Standard Access で読める4アカウントの実測値:

| アカウント | 返る投稿数 | フォロワー | 備考 |
|---|---|---|---|
| @meta | **1件** | 1,829,154 | 使用不可 |
| **@threads** | **15件** | **7,003,457** | **これを使う。本人の返信あり** |
| @instagram | 15件 | 38,284,195 | 予備 |
| @facebook | 15件 | 2,089,975 | 予備 |

@threads は取得15件のうち大半に本人の連続返信があり、返信ツリーの実演までできる。

### 承認前の制限と、動画での見え方

- `keyword_search` は未承認だと**認証ユーザー自身の投稿のみ**が返る
  → 動画では @kudooo_aii の投稿が50件返る。機能としては正常動作しているので問題ない
- `profile_lookup` / `profile_posts` は未承認だと Meta公式4アカウントのみ
  → 動画では **@threads** を使う

**動画には「未承認だから取れない」という表示を一切出さない。** 画面にもそういうバナーは置いていない。

---

## 2. threads_keyword_search 申請テキスト

```
1. アプリの概要
当アプリ（ANALYCA）は、Threadsアカウントの投稿パフォーマンスを分析するSaaS型ダッシュボードです。ユーザーがOAuth認証でThreadsアカウントを連携すると、自身の投稿データとインサイトを取得して可視化します。今回申請するキーワード検索機能は、ユーザーが自身の発信テーマを決める際に、そのテーマでどのような投稿が行われているかを調査するために使用します。

2. アプリのどの機能にこのアクセス許可が必要か
ダッシュボードの「コンテンツリサーチ」画面にある「① キーワードで投稿を検索する」で使用します。

ユーザーがキーワードまたはトピックタグを入力して検索ボタンを押すと、threads_keyword_search を使って該当する公開投稿を検索し、以下を表示します。

- 投稿の本文、投稿日時、投稿者のusername、Threads上の原文へのリンク
- 検索結果に登場したアカウントの一覧と、それぞれの出現件数

検索モードとして、キーワード検索（search_mode=KEYWORD）とトピックタグ検索（search_mode=TAG）の両方に対応しています。

3. アクセス許可によってアプリの機能がどのように強化されるか
threads_keyword_search がなければ、ユーザーは「自分がこれから発信しようとしているテーマで、Threads上に既にどのような投稿があるか」を調べる手段を持ちません。Threadsアプリを手動で開いて検索し、1件ずつ目視で確認する必要があります。

この権限により、テーマ単位で投稿を横断的に確認し、そのテーマで発信しているアカウントを特定できます。特定したアカウントは、同じ画面の「② アカウントのプロフィールと公開投稿を見る」にワンクリックで引き継がれ、そのアカウントの投稿の書き方を確認できます。調査から確認までが1画面で完結します。

4. エンドユーザーの体験がどのように強化されるか
- 自分の発信テーマについて、Threads上の投稿状況を数秒で把握できる
- そのテーマで発信している主要アカウントを、手作業の検索なしに発見できる
- 発見したアカウントをそのまま確認対象にでき、調査から分析への移行が1クリックで完了する
- 結果として、思いつきではなく実際の投稿データに基づいてコンテンツ方針を決められる

5. 補足
- 検索して取得するのは、Threads上で公開されている投稿のみです
- 取得したデータはユーザー自身のダッシュボードに表示されるだけで、第三者への公開・共有・再配布は一切行いません
- 読み取り専用の機能です。検索結果に対する投稿・返信・変更・削除は一切行いません
- 検索はユーザーが明示的にキーワードを入力し、検索ボタンを押した場合にのみ実行されます。自動的・継続的な大量検索は行いません
```

---

## 3. threads_profile_discovery 申請テキスト

```
1. アプリの概要
当アプリ（ANALYCA）は、Threadsアカウントの投稿パフォーマンスを分析するSaaS型ダッシュボードです。ユーザーがOAuth認証でThreadsアカウントを連携すると、自身の投稿データとインサイトを取得して可視化します。今回申請するプロフィール取得機能は、ユーザーが参考にしたい公開アカウントの投稿の書き方を確認するために使用します。

2. アプリのどの機能にこのアクセス許可が必要か
ダッシュボードの「コンテンツリサーチ」画面にある「② アカウントのプロフィールと公開投稿を見る」で使用します。

ユーザーがusernameを入力して取得ボタンを押すと、threads_profile_discovery を使って以下を取得し、その場で表示します。

- profile_lookup：公開プロフィール（表示名、自己紹介、プロフィール画像、フォロワー数、認証バッジ）
- profile_posts：そのアカウントの公開投稿（本文、投稿日時、メディア種別、原文リンク）
- 投稿のconversation：その投稿に対して投稿者本人が続けて投稿した返信

Threadsでは、1つのメイン投稿に対して投稿者自身が返信を連ねて長い内容を伝える投稿形式が一般的です。ユーザーが投稿を開くと、本人が続けた返信を、何段目か・本体投稿から何分後に投稿されたかとあわせて表示します。

3. アクセス許可によってアプリの機能がどのように強化されるか
threads_profile_discovery がなければ、ユーザーは参考にしたいアカウントの投稿を1件ずつThreadsアプリ上でスクロールして確認するしかありません。本文の長さや、返信を何段に分けて構成しているかといった特徴を、まとまった形で把握できません。

この権限により、公開アカウントのプロフィールと公開投稿を1画面で確認でき、本文の平均文字数や返信の連ね方といった構成上の特徴を把握できます。これはANALYCAのリサーチ機能の中核であり、この権限なしでは実現できません。

4. エンドユーザーの体験がどのように強化されるか
- 参考にしたいアカウントの本文の長さの傾向を数値で把握できる
- メイン投稿に本人が返信を連ねる投稿形式について、何段構成か、各段をどれくらいの間隔で投稿しているかを確認できる
- Threadsアプリを手動でスクロールして目視で数える作業が不要になる
- 自身の投稿の書き方を、実際に運用されている投稿と比較して改善できる

5. 補足
- 取得対象は、Threads上で公開されているプロフィールと公開投稿のみです。非公開アカウントやダイレクトメッセージは一切取得しません
- 取得したデータはユーザー自身のダッシュボードに表示されるだけで、第三者への公開・共有・再配布は一切行いません
- 読み取り専用の機能です。対象アカウントへの投稿・返信・フォロー等の操作は一切行いません
- 取得はユーザーが明示的にusernameを入力し、取得ボタンを押した場合にのみ実行されます
```

---

## 4. スクリーンキャスト撮影手順（1本で2権限をカバー）

> 想定時間: 1分30秒〜2分
> 解像度 1280x720 以上 / MP4 / 音声不要

### 撮影前の準備

1. Threads（@kudooo_aii）に**先にログイン**しておく（2FAまで完了させる）
2. `https://www.threads.com/@threads` を別タブで開いておく（後半の照合用）
3. ANALYCAの認証を一度解除しておく（OAuth同意画面を撮るため）
4. ブラウザのズーム100%、ウィンドウ最大化
5. **本番（analyca.jp）にデプロイ済みで、再認証して2権限がトークンに入っていること**

### ① ANALYCAにThreadsでログイン（25秒）

- `https://analyca.jp/login` を開く
- 「Threadsでログイン」をクリック
- Threads OAuth同意画面が表示される
- **権限一覧をゆっくりスクロールして見せる**
  - `threads_keyword_search` と `threads_profile_discovery` の行で1〜2秒止める
- 「許可」をクリック → ダッシュボードへ

### ② コンテンツリサーチ画面を開く（15秒）

- サイドバーの「競合リサーチ」をクリック
- **2つのパネルの見出しと、その横の権限名が読める状態で2秒止める**
  - 「キーワードで投稿を検索する　threads_keyword_search」
  - 「アカウントのプロフィールと公開投稿を見る　threads_profile_discovery」

### ③ キーワード検索を実演（35秒）← threads_keyword_search の証拠

- 上のパネルの見出しと `threads_keyword_search` にマウスを合わせる
- キーワード欄に **「Threads運用」と手入力**（コピペ厳禁）
- 「検索」をクリック → 約4秒で結果表示
- 「『Threads運用』の検索結果：投稿 50件 / アカウント 1件」の行をゆっくり見せる
- 投稿一覧を**ゆっくりスクロール**して、本文・投稿日時・usernameが出ていることを見せる
- 検索モードを「トピックタグ」に切り替えてもう一度検索（TAG対応の証拠、10秒）

### ④ ②アカウント取得を実演（35秒）← threads_profile_discovery の証拠

- ② の見出しと `threads_profile_discovery` にマウスを合わせる
- username欄に **「threads」と手入力**
- 「取得」をクリック → 約3秒で結果表示
- **プロフィールカードをゆっくり見せる**
  - Threads / ✓認証済み / @threads / 自己紹介
  - フォロワー 7,003,457 / 取得した投稿 15件 / 返信がある投稿 15件 / 本文の平均文字数 61字
- 投稿一覧をゆっくりスクロール

### ⑤ 本人の返信ツリーを開く（20秒）

- **上から2番目の投稿**「The US Open is cardio for people sitting down」の
  「本人が続けた返信を見る」をクリック
  - ※1番目の投稿は本人の返信がないので必ず2番目を開く。事前に確認しておくこと
- 約6秒で「本人の返信 3件」バッジと返信が展開される
- 「2段目 / 本体の2時間後」と返信本文が表示されているのをゆっくり見せる

### ⑥ Threadsで実データを照合する（20秒）← 前回の却下対策。必須

- その投稿の「Threadsで開く」をクリック
- **ダッシュボードに出ていたのと同じ投稿と返信が、Threads上に実在することをゆっくり見せる**
- ダッシュボードのタブに戻る

### ⑦ 録画停止 → MP4保存

---

## 4-2. レビュアー用のテスト手順（申請フォームの「テスト手順」欄に貼る）

ANALYCAのログインはThreads/InstagramのOAuthのみで、ID・パスワードによるログインは存在しない。
一方でダッシュボードは**URLだけで開ける**（`/{userId}` のuserIdがアクセスキーを兼ねる。本番で確認済み）。

したがってレビュアー用のログイン画面を新たに作る必要はない。以下をそのまま貼る。

```
This app does not use password-based login. To review the requested features,
please open the following dashboard URL directly. No sign-in is required.

https://analyca.jp/27016191458061252?tab=research

On that screen:

1. "キーワードで投稿を検索する" (Search posts by keyword)
   - Enter a keyword such as "Threads" in the input field and press the search button.
   - The app calls GET /keyword_search and lists the matching public posts with the
     author's username, the post text, the timestamp and a link to the post on Threads.
   - The "検索モード" selector switches between keyword search (search_mode=KEYWORD)
     and topic tag search (search_mode=TAG).

2. "アカウントのプロフィールと公開投稿を見る" (View an account's profile and public posts)
   - Enter the username "threads" and press the fetch button.
   - The app calls GET /profile_lookup and GET /profile_posts, and shows the public
     profile (name, bio, follower count, verified badge) together with the account's
     public posts.
   - Clicking "本人が続けた返信を見る" on the second post calls
     GET /{post-id}/conversation and shows the replies the author added to their own
     post, with the reply depth and how long after the original post each was made.

Note on access level: while the app is on standard access, keyword search returns only
the authenticated user's own posts, and profile lookup resolves only @meta, @threads,
@instagram and @facebook. The screencast therefore demonstrates the features using
@threads.
```

**注意**: ダッシュボードがURLだけで開ける仕様は、レビューには好都合だが、
URLを知っていれば誰でも閲覧できるということでもある。審査とは別に扱いを検討すること。

---

## 5. 撮影の鉄則

1. **エラーを1フレームも映さない**
2. **テキストは全部手入力** — コピペはレビュアーに「実使用でない」と判断される
3. **マウスはゆっくり、各操作の間に1〜2秒の間**
4. **権限名が読めるフレームを必ず作る** — OAuth同意画面と、①②の見出し横の2箇所
5. **Threads上の実データとの照合を必ず入れる** — 前回の却下理由への直接の回答
6. **撮影後、音声なしで意味が通るか必ず見返す**

---

## 6. 提出手順

1. https://developers.facebook.com → ANALYCA for Threads を選択
2. ユースケース → 「Threads APIにアクセス」→ カスタマイズ
3. `threads_keyword_search` の「アプリレビューに追加」
4. `threads_profile_discovery` の「アプリレビューに追加」
5. 各権限の「編集」で、上記の申請テキストを貼り、同じMP4をアップロード
6. 「送信」

### 提出前チェックリスト

- [ ] OAuthスコープに2権限が入った状態で**本番にデプロイ済み**
- [ ] 本番の analyca.jp で再認証し、`/debug_token` で2権限を確認済み
- [ ] @threads で15件の投稿が取得できることを事前に確認
- [ ] 本人の返信がある投稿がどれか事前に確認（現状は上から2番目）
- [ ] 動画にエラー表示が映っていない
- [ ] 動画に権限名が読めるフレームがある
- [ ] 動画にThreads上の実データとの照合がある

---

## 7. 承認後にやること

- `keyword_search` が公開投稿を返すようになる（現状は自分の投稿のみ）
- `profile_lookup` / `profile_posts` が任意の公開アカウントに使えるようになる
- 保存・定期収集・分析の作り込みはここから。`lib/research.ts` に BigQuery 層、
  `lib/researchCollector.ts` に収集ロジックが用意してあるが、現状の画面からは使っていない
