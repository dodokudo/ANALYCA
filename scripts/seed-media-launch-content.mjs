import { randomUUID } from 'node:crypto';
import { BigQuery } from '@google-cloud/bigquery';

const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || process.env.PROJECT_ID;
const credentials = JSON.parse(
  process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || process.env.GOOGLE_CREDENTIALS || '{}',
);
const client = new BigQuery({ projectId, location: 'asia-northeast1', credentials });
const lineUrl = 'https://liff.line.me/2007350099-K9dE2l1E/landing?follow=%40118dgavc&lp=W9tx5Y&liff_id=2007350099-K9dE2l1E';

function heading(text) {
  return { id: randomUUID(), type: 'heading', level: 2, text };
}

function paragraph(text) {
  return { id: randomUUID(), type: 'paragraph', text };
}

function list(items) {
  return { id: randomUUID(), type: 'list', items };
}

function cta() {
  return {
    id: randomUUID(),
    type: 'cta',
    headline: 'SNS運用を、感覚から仕組みに変える',
    body: 'ANALYCAの実践ノウハウと運用テンプレートをLINEで受け取れます。',
    label: 'LINEで無料コンテンツを受け取る',
    url: lineUrl,
    placement: 'article-inline',
  };
}

const articles = [
  {
    slug: 'instagram-analysis-improvement-cycle',
    title: 'Instagram運用で最初に見るべき数字は？投稿改善を止めない分析の順番',
    description: 'フォロワー数や再生数だけで判断せず、発見・視聴・反応・事業成果の順にInstagram投稿を改善するための実践フレームを解説します。',
    tags: ['Instagram運用', 'SNS運用', 'データ分析', 'コンテンツ改善'],
    blocks: [
      paragraph('Instagram運用の振り返りで起きやすい失敗は、再生数やフォロワー増減だけを見て「伸びた・伸びなかった」で終えることです。数字は結果ですが、改善したい工程を特定できなければ次の投稿にはつながりません。'),
      paragraph('見る順番は、発見されたか、見続けられたか、反応されたか、事業成果につながったか、の4段階です。Metaはプロアカウント向けにインサイトとプロフェッショナルダッシュボードを提供していますが、指標を単独で評価するのではなく、投稿の目的に沿って組み合わせる必要があります。'),
      heading('1. まず「発見された量」を確認する'),
      paragraph('最初に確認するのは、投稿がどれだけ配信され、どれだけ視聴機会を得たかです。リーチや再生数が弱ければ、内容を最後まで見てもらう以前に、テーマ、冒頭、投稿形式、配信タイミングなど入口の設計を見直します。'),
      paragraph('ここで重要なのは、フォロワー数が多いほど必ず配信量が増えるとは限らないことです。投稿ごとに同じ条件を揃え、過去の自分の中央値と比較すると、テーマや表現の差が見えやすくなります。'),
      heading('2. 次に「見続けられたか」を確認する'),
      paragraph('動画では、再生された事実だけでなく、冒頭で離脱していないか、最後まで内容が伝わったかを確認します。入口が強くても内容との約束がずれていれば、再生は始まっても視聴は続きません。'),
      list([
        '冒頭で誰のどんな悩みを解決する投稿かを明確にする',
        '前置きを削り、結論や変化を早い位置に置く',
        '字幕・画面・音声の役割を重複させすぎず、理解負荷を下げる',
        '尺が違う投稿を同じ基準で比較せず、近い形式同士で見る',
      ]),
      heading('3. 保存・シェア・プロフィール行動を分けて考える'),
      paragraph('いいね、コメント、保存、シェアは同じ「反応」でも意味が異なります。保存は後で見返す実用性、シェアは他者に渡したい価値、コメントは会話の余地を示すことがあります。プロフィールへの遷移やリンク行動は、投稿から次の接点へ進んだサインです。'),
      paragraph('すべての投稿に同じ反応を求める必要はありません。認知を広げる投稿、信頼を深める投稿、LINEや商品へ誘導する投稿に分け、目的に対応する指標を主指標として決めます。'),
      heading('4. 週次レビューを「次の仮説」まで書く'),
      paragraph('分析はレポートを作ることではなく、次の投稿条件を決めるために行います。週次レビューでは、数字の記録と一緒に「何を残すか」「何を一つだけ変えるか」を書きます。'),
      list([
        '同じ投稿形式の直近5〜10本と比較する',
        '上位投稿に共通するテーマ・冒頭・構成を言語化する',
        '下位投稿は配信、視聴、反応、導線のどこで止まったかを分ける',
        '次週は一度に多くを変えず、検証する要素を一つに絞る',
        'LINE登録や問い合わせなど、Instagram外の成果も同じ期間で確認する',
      ]),
      heading('万能な基準値より、自分の改善幅を見る'),
      paragraph('業種、アカウント規模、投稿形式、視聴者の状態が違えば、適切な数値も変わります。外部の平均値だけで良し悪しを決めず、自分の投稿群を同条件で比較し、改善幅を追う方が運用判断に使えます。'),
      cta(),
    ],
    sources: [
      { title: 'Instagramでクリエイターアカウントを設定する', url: 'https://www.facebook.com/help/instagram/2358103564437429', publisher: 'Instagram Help Center' },
      { title: 'Instagram・Facebook Reels広告', url: 'https://www.facebook.com/business/ads/facebook-instagram-reels-ads', publisher: 'Meta for Business' },
    ],
  },
  {
    slug: 'youtube-analytics-three-step-review',
    title: 'YouTube分析は「表示・クリック・視聴」の3段階で見る',
    description: 'インプレッション、クリック率、視聴者維持率を別々に眺めず、YouTube動画の改善箇所を特定するための分析手順を整理します。',
    tags: ['YouTube運用', 'SNS運用', 'データ分析', 'コンテンツ改善'],
    blocks: [
      paragraph('YouTube Studioには多くの指標がありますが、最初から全部を見る必要はありません。動画が表示されたか、選ばれたか、見続けられたか、という順番に並べると、改善すべき場所を切り分けやすくなります。'),
      paragraph('YouTube公式も、インプレッションとクリック率を単独で評価せず、トラフィックソースや視聴者の文脈と合わせて見るよう案内しています。視聴者が広がるにつれてクリック率が下がる場合もあるため、一つの数字だけで動画を失敗と決めないことが重要です。'),
      heading('1. インプレッションで「表示機会」を見る'),
      paragraph('インプレッションは、YouTube上でサムネイルが表示された回数を示します。ここが少ない場合、タイトルやサムネイル以前に、テーマと視聴者の一致、公開後の初動、チャンネル内での関連性を確認します。'),
      paragraph('ただし、公開直後と公開後数週間の動画を同じ条件で比べることはできません。経過日数とトラフィックソースを揃え、似たテーマや形式の動画と比較します。'),
      heading('2. クリック率で「選ばれたか」を見る'),
      paragraph('クリック率は、表示されたサムネイルがどれだけ視聴につながったかを見る指標です。低い場合は、テーマの魅力、タイトルの具体性、サムネイルで伝える一つの約束を見直します。'),
      paragraph('クリック率が高いのにインプレッションが伸びない場合、対象が狭い、評価期間が短い、特定の流入元に偏っているなど複数の可能性があります。数値だけでタイトルを何度も変える前に、どこで表示されているかを確認します。'),
      heading('3. 視聴者維持で「約束を果たしたか」を見る'),
      paragraph('クリックされた後は、平均視聴時間と視聴者維持の推移を確認します。YouTubeの視聴者維持レポートでは、動画のどの場面で注意を保てたかを見られ、近い長さの直近動画との典型的な維持率比較も利用できます。'),
      list([
        '冒頭で大きく落ちる：タイトルやサムネイルの約束と導入がずれていないか確認する',
        '特定箇所で落ちる：重複説明、前置き、理解しづらい例を削る',
        '山ができる：見返された場面や共有された要点を次回の構成に使う',
        '終盤まで安定する：同じテーマをシリーズ化し、次の動画への導線を置く',
      ]),
      heading('3指標を組み合わせた改善判断'),
      list([
        '表示が多くクリックが弱い：タイトル・サムネイル・テーマの見せ方を改善',
        'クリックは強く冒頭離脱が大きい：入口の約束と本編内容を一致させる',
        '維持率は良く表示が少ない：関連テーマ、シリーズ、流入導線を増やす',
        '表示・クリック・維持が揃う：同じ視聴者課題を別角度で展開する',
      ]),
      heading('月次では動画単体ではなく「勝ち筋」を見る'),
      paragraph('週次では一本ごとの改善を行い、月次では複数動画に共通するテーマ、尺、導入、視聴者層を見ます。再生数トップだけでなく、登録や次動画の視聴につながった動画を確認すると、チャンネルとして積み上がる企画を選びやすくなります。'),
      paragraph('万能なクリック率や維持率の目標値を置くより、同じチャンネル・同じ形式・近い公開条件での変化を見る方が実務的です。'),
      cta(),
    ],
    sources: [
      { title: 'YouTube アナリティクスを利用する', url: 'https://support.google.com/youtube/answer/9002587?hl=ja', publisher: 'YouTube Help' },
      { title: 'YouTubeでのエンゲージメントを理解する', url: 'https://support.google.com/youtube/answer/9313698?hl=ja', publisher: 'YouTube Help' },
      { title: 'アナリティクスのクリック率とインプレッションを読み解く', url: 'https://support.google.com/youtube/answer/16767369?hl=ja', publisher: 'YouTube Help' },
    ],
  },
  {
    slug: 'aio-seo-practical-content-design',
    title: 'AIO時代のSEOで本当にやること：特別な裏技より、引用される一次価値を作る',
    description: 'AI Overviewsなど生成AI検索への対応を、Google公式情報に沿って整理。クロール、独自性、構造化、計測まで実務の順番で解説します。',
    tags: ['AIO', 'SEO', 'Webマーケティング', 'コンテンツ改善'],
    blocks: [
      paragraph('AIOという言葉が広がると、AI検索専用の新しいテクニックが必要に見えます。しかしGoogleは、生成AI検索も既存の検索インデックスと品質システムを基盤にしており、従来のSEOベストプラクティスは引き続き重要だと説明しています。'),
      paragraph('対策の中心は、AI向けの文章を量産することではありません。公開情報の要約だけで終わらず、読者がそのページを選ぶ理由になる一次価値を加え、検索システムが取得できる技術状態に整えることです。'),
      heading('1. まず取得・インデックスできる状態を作る'),
      paragraph('ページが公開されていても、クロールが拒否されている、HTTP 200を返さない、本文が取得しづらい状態なら検索機能の候補になりません。robots、noindex、canonical、サイトマップ、内部リンクを確認し、各記事へ通常のリンクで到達できる構造にします。'),
      list([
        '記事URLがHTTP 200を返す',
        'robots.txtやnoindexで意図せず遮断していない',
        '記事一覧、関連記事、カテゴリから内部リンクが張られている',
        'タイトル、説明、公開日、更新日、著者が画面上で確認できる',
        'モバイルでも本文と主要導線を読みやすくする',
      ]),
      heading('2. 要約ではなく「そのサイトにしかない情報」を足す'),
      paragraph('Googleの生成AI検索向けガイドは、独自の視点、実体験、深い専門性を持つ非コモディティ型の内容を重視しています。公式情報を言い換えるだけでは差別化になりません。'),
      paragraph('自社の検証データ、実際に失敗した条件、判断基準、作業手順、画面例、導入前後の変化などを加えると、読者が元情報だけでは得られない価値になります。AIで下書きを作る場合も、最終的には人が事実確認し、経験と判断を追加します。'),
      heading('3. 質問に直接答え、その後に根拠を置く'),
      paragraph('検索者の質問に対し、冒頭で結論を曖昧にせず、その後に条件、理由、手順、例外を整理します。見出しだけを細かく増やすのではなく、一つの節で一つの疑問を解決する構成にします。'),
      list([
        '結論：何をすべきかを短く示す',
        '根拠：公式情報や一次資料を明示する',
        '条件：当てはまらないケースや注意点を書く',
        '実践：読者が次に取る行動を具体化する',
        '更新：仕様変更に合わせて日付と内容を見直す',
      ]),
      heading('4. 構造化データは「見えている内容」と一致させる'),
      paragraph('構造化データは検索システムがページを理解する助けになりますが、生成AI検索専用の特別なマークアップはありません。Articleなど対応する型を使い、タイトル、著者、日付、画像など画面に表示している情報と一致させます。'),
      paragraph('構造化データを入れれば表示や順位が保証されるわけではありません。リッチリザルトテストなどで技術的な妥当性を確認しながら、本文の品質とページ体験を優先します。'),
      heading('5. PVだけでなく、訪問後の価値を測る'),
      paragraph('AI検索では、検索結果上で理解が進んだ状態の訪問が増える可能性があります。流入数だけでなく、記事の読了、関連記事への遷移、LINE登録、問い合わせなど、訪問後に生まれた価値を追います。'),
      paragraph('ANALYCA Mediaでは記事閲覧、関連記事、CTAクリックを分けて記録し、テーマ別に「読まれたか」と「行動につながったか」を見られる状態を作ることが重要です。'),
      heading('公開前チェックリスト'),
      list([
        '一次情報を確認し、参照元を記事末尾に載せたか',
        '冒頭で読者の質問に答えているか',
        '独自の経験、データ、判断基準が含まれているか',
        '見出しと本文が対応し、不要な重複がないか',
        '内部リンク、Article構造化データ、サイトマップを確認したか',
        'PV以外のCTAや回遊を計測できるか',
      ]),
      cta(),
    ],
    sources: [
      { title: '生成AI検索向けサイト最適化ガイド', url: 'https://developers.google.com/search/docs/fundamentals/ai-optimization-guide?hl=ja', publisher: 'Google Search Central' },
      { title: 'ウェブサイトで生成AIコンテンツを使用する際のガイダンス', url: 'https://developers.google.com/search/docs/fundamentals/using-gen-ai-content?hl=ja', publisher: 'Google Search Central' },
      { title: 'Google検索がサポートする構造化データ', url: 'https://developers.google.com/search/docs/appearance/structured-data/search-gallery?hl=ja', publisher: 'Google Search Central' },
    ],
  },
];

for (const [index, article] of articles.entries()) {
  const articleId = randomUUID();
  const publishedAt = new Date(Date.now() - index * 60 * 60 * 1000).toISOString();
  await client.query({
    query: `
      MERGE \`${projectId}.analyca.media_articles\` target
      USING (SELECT @slug AS slug) source
      ON target.slug = source.slug
      WHEN NOT MATCHED THEN INSERT (
        article_id, slug, title, description, cover_image_url, cover_image_alt,
        blocks_json, tags_json, sources_json, status, author_name, author_bio,
        scheduled_at, published_at, created_at, updated_at, revision, ai_metadata_json
      ) VALUES (
        @articleId, @slug, @title, @description, '', '',
        @blocksJson, @tagsJson, @sourcesJson, 'published', 'ANALYCA編集部',
        'SNS運用とデータ分析の実践情報を、公式情報と運用現場の視点から発信します。',
        NULL, TIMESTAMP(@publishedAt), TIMESTAMP(@publishedAt), TIMESTAMP(@publishedAt), 1, NULL
      )
    `,
    params: {
      articleId,
      slug: article.slug,
      title: article.title,
      description: article.description,
      blocksJson: JSON.stringify(article.blocks),
      tagsJson: JSON.stringify(article.tags),
      sourcesJson: JSON.stringify(article.sources),
      publishedAt,
    },
  });
}

console.log(JSON.stringify({ seeded: articles.map(({ slug }) => slug) }));
