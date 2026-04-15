'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import LoadingScreen from '@/components/LoadingScreen';
import AnalycaLogo from '@/components/AnalycaLogo';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

// ============ アイコンコンポーネント ============
function InstagramIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
    </svg>
  );
}

function ThreadsIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.33-3.082.88-.76 2.119-1.207 3.583-1.291a13.853 13.853 0 0 1 3.02.142c-.126-.742-.375-1.332-.75-1.757-.513-.586-1.308-.883-2.359-.89h-.029c-.844 0-1.992.232-2.721 1.32L7.734 7.847c.98-1.454 2.568-2.256 4.478-2.256h.044c3.194.02 5.097 1.975 5.287 5.388.108.046.216.094.321.142 1.49.7 2.58 1.761 3.154 3.07.797 1.82.871 4.79-1.548 7.158-1.85 1.81-4.094 2.628-7.277 2.65Zm1.003-11.69c-.242 0-.487.007-.739.021-1.836.103-2.98.946-2.916 2.143.067 1.256 1.452 1.839 2.784 1.767 1.224-.065 2.818-.543 3.086-3.71a10.5 10.5 0 0 0-2.215-.221z"/>
    </svg>
  );
}

function LineIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
    </svg>
  );
}

// ============ チャンネル定義 ============
type Channel = 'instagram' | 'threads' | 'line';

const channelItems: { value: Channel; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'instagram', label: 'Instagram', Icon: InstagramIcon },
  { value: 'threads', label: 'Threads', Icon: ThreadsIcon },
  { value: 'line', label: 'LINE', Icon: LineIcon },
];

// ============ 日付プリセット ============
type DatePreset = '3d' | '7d' | 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth';

const datePresetOptions: { value: DatePreset; label: string }[] = [
  { value: '3d', label: '過去3日' },
  { value: '7d', label: '過去7日' },
  { value: 'thisWeek', label: '今週' },
  { value: 'lastWeek', label: '先週' },
  { value: 'thisMonth', label: '今月' },
  { value: 'lastMonth', label: '先月' },
];

// ============ Instagram ダミーデータ ============
const DUMMY_IG_USER = {
  username: 'demo_account',
  profile_picture_url: 'https://picsum.photos/200',
  followers_count: 12450,
  follower_growth: 234,
};

const DUMMY_IG_DAILY_DATA = [
  { date: '12/10', followers: 12100, growth: 45, reach: 8500, profileViews: 420, webClicks: 85, storyCount: 2, storyViews: 4200 },
  { date: '12/11', followers: 12150, growth: 50, reach: 9200, profileViews: 480, webClicks: 92, storyCount: 3, storyViews: 4800 },
  { date: '12/12', followers: 12200, growth: 50, reach: 7800, profileViews: 390, webClicks: 78, storyCount: 1, storyViews: 3900 },
  { date: '12/13', followers: 12280, growth: 80, reach: 11500, profileViews: 620, webClicks: 125, storyCount: 4, storyViews: 5500 },
  { date: '12/14', followers: 12350, growth: 70, reach: 10200, profileViews: 550, webClicks: 110, storyCount: 2, storyViews: 5100 },
  { date: '12/15', followers: 12400, growth: 50, reach: 8900, profileViews: 445, webClicks: 89, storyCount: 3, storyViews: 4500 },
  { date: '12/16', followers: 12450, growth: 50, reach: 9500, profileViews: 475, webClicks: 95, storyCount: 2, storyViews: 4600 },
];

const DUMMY_IG_REELS = [
  { id: 1, thumbnail: 'https://picsum.photos/400/711?random=1', date: '2024/12/14', views: 45200, likes: 1250, comments: 89, saves: 320 },
  { id: 2, thumbnail: 'https://picsum.photos/400/711?random=2', date: '2024/12/12', views: 38500, likes: 980, comments: 72, saves: 245 },
  { id: 3, thumbnail: 'https://picsum.photos/400/711?random=3', date: '2024/12/10', views: 32100, likes: 850, comments: 65, saves: 198 },
  { id: 4, thumbnail: 'https://picsum.photos/400/711?random=4', date: '2024/12/08', views: 28700, likes: 720, comments: 54, saves: 165 },
  { id: 5, thumbnail: 'https://picsum.photos/400/711?random=5', date: '2024/12/06', views: 25300, likes: 650, comments: 48, saves: 142 },
];

const DUMMY_IG_STORIES = [
  { id: 1, thumbnail: 'https://picsum.photos/400/711?random=6', date: '2024/12/16', views: 5200, reach: 4800, replies: 12, followers: 12450 },
  { id: 2, thumbnail: 'https://picsum.photos/400/711?random=7', date: '2024/12/15', views: 4800, reach: 4500, replies: 8, followers: 12400 },
  { id: 3, thumbnail: 'https://picsum.photos/400/711?random=8', date: '2024/12/14', views: 5500, reach: 5100, replies: 15, followers: 12350 },
  { id: 4, thumbnail: 'https://picsum.photos/400/711?random=9', date: '2024/12/13', views: 4200, reach: 3900, replies: 6, followers: 12280 },
  { id: 5, thumbnail: 'https://picsum.photos/400/711?random=10', date: '2024/12/12', views: 4600, reach: 4300, replies: 9, followers: 12200 },
];

// ============ Threads ダミーデータ ============
const DUMMY_THREADS_USER = {
  username: 'demo_account',
  profile_picture_url: 'https://picsum.photos/200',
  followers_count: 8320,
};

const DUMMY_THREADS_DAILY = [
  { date: '2024-12-10', followers_count: 8050, follower_delta: 35, total_views: 24500, post_count: 2 },
  { date: '2024-12-11', followers_count: 8100, follower_delta: 50, total_views: 28200, post_count: 3 },
  { date: '2024-12-12', followers_count: 8140, follower_delta: 40, total_views: 21800, post_count: 1 },
  { date: '2024-12-13', followers_count: 8200, follower_delta: 60, total_views: 35600, post_count: 4 },
  { date: '2024-12-14', followers_count: 8250, follower_delta: 50, total_views: 31200, post_count: 2 },
  { date: '2024-12-15', followers_count: 8290, follower_delta: 40, total_views: 26800, post_count: 2 },
  { date: '2024-12-16', followers_count: 8320, follower_delta: 30, total_views: 29400, post_count: 3 },
];

const DUMMY_THREADS_POSTS = [
  // 緊急・ヤバい系
  {
    id: '1', text: '緊急で伝えたいことがあります\nSNSの仕組みが根本的に変わりました。今までの投稿方法では伸びません。',
    timestamp: '2024-12-16T10:30:00+09:00', permalink: 'https://threads.net/@demo_account/post/1',
    views: 28500, likes: 920, replies: 85,
    comments: [
      { id: 'c1', text: '具体的にはアルゴリズムが「滞在時間」重視に変わっています。', views: 18200, depth: 0 },
      { id: 'c2', text: 'つまり、長文+コメント欄活用が正攻法です。', views: 12800, depth: 1 },
    ],
  },
  {
    id: '2', text: 'ヤバい、これ知らないと損する\nThreadsの最新アップデートで投稿の表示順が完全に変わった。',
    timestamp: '2024-12-15T19:20:00+09:00', permalink: 'https://threads.net/@demo_account/post/2',
    views: 25800, likes: 810, replies: 72,
    comments: [
      { id: 'c3', text: 'フォロワー外への露出が3倍に増えてます。', views: 16500, depth: 0 },
      { id: 'c4', text: '今が一番伸ばしやすいタイミング。', views: 11200, depth: 1 },
    ],
  },
  // ～してる人系
  {
    id: '3', text: '毎日投稿してる人ほど伸びてない理由\n量より質が大事なのは当たり前。でも本質はそこじゃない。',
    timestamp: '2024-12-15T08:00:00+09:00', permalink: 'https://threads.net/@demo_account/post/3',
    views: 22400, likes: 780, replies: 68,
    comments: [
      { id: 'c5', text: '「誰の何を解決するか」が1投稿で明確じゃないと、量を増やしても意味がない。', views: 14800, depth: 0 },
      { id: 'c6', text: '週3本でも刺さる投稿を作る方が伸びます。', views: 10600, depth: 1 },
    ],
  },
  {
    id: '4', text: 'フォロワー1000人以下でやってる人、これ見て\n実はフォロワー数より大事な指標がある。',
    timestamp: '2024-12-14T20:15:00+09:00', permalink: 'https://threads.net/@demo_account/post/4',
    views: 19800, likes: 650, replies: 55,
    comments: [
      { id: 'c7', text: 'それは「保存率」。保存される投稿はアルゴリズムに強い。', views: 13200, depth: 0 },
    ],
  },
  // 時代遅れ系
  {
    id: '5', text: 'まだハッシュタグ戦略やってるの？完全に時代遅れです\nThreadsではハッシュタグの効果がほぼゼロ。',
    timestamp: '2024-12-14T12:00:00+09:00', permalink: 'https://threads.net/@demo_account/post/5',
    views: 24200, likes: 850, replies: 78,
    comments: [
      { id: 'c8', text: '代わりに「冒頭3秒で引き込む」が最重要。', views: 15800, depth: 0 },
      { id: 'c9', text: 'テスト結果：ハッシュタグあり vs なしでリーチ差なし。', views: 11400, depth: 1 },
    ],
  },
  {
    id: '6', text: 'テンプレ投稿はもう時代遅れ\n同じフォーマットの繰り返しはアルゴリズムに弾かれる時代。',
    timestamp: '2024-12-13T21:00:00+09:00', permalink: 'https://threads.net/@demo_account/post/6',
    views: 21500, likes: 720, replies: 62,
    comments: [
      { id: 'c10', text: '「型は持ちつつ、切り口を変える」が正解。', views: 14100, depth: 0 },
      { id: 'c11', text: '具体的には見出しのパターンを11個持っておく。', views: 9800, depth: 1 },
    ],
  },
  // 損してます系
  {
    id: '7', text: 'プロフィールを放置してる人、毎日フォロワーを損してます\nプロフを見に来た人の80%はそのまま離脱してる。',
    timestamp: '2024-12-13T09:30:00+09:00', permalink: 'https://threads.net/@demo_account/post/7',
    views: 23100, likes: 790, replies: 71,
    comments: [
      { id: 'c12', text: '改善ポイント：①何者か ②何が得られるか ③実績を1行で。', views: 15200, depth: 0 },
      { id: 'c13', text: 'プロフ改善だけでフォロー率2倍になった事例あり。', views: 10800, depth: 1 },
    ],
  },
  {
    id: '8', text: 'コメント欄を使わないのは無駄すぎる\n投稿だけで完結させてる人、閲覧数の50%を捨ててます。',
    timestamp: '2024-12-12T18:45:00+09:00', permalink: 'https://threads.net/@demo_account/post/8',
    views: 20400, likes: 680, replies: 58,
    comments: [
      { id: 'c14', text: 'コメント欄に「続き」を書くだけで滞在時間が1.8倍に。', views: 13500, depth: 0 },
      { id: 'c15', text: '3段構成（メイン→補足→CTA）がベスト。', views: 9600, depth: 1 },
      { id: 'c16', text: '実験データ：コメント欄あり投稿は平均1.5倍の閲覧数。', views: 7200, depth: 2 },
    ],
  },
  // 間違ってます系
  {
    id: '9', text: '「バズらせよう」と思ってる時点で間違ってます\nバズは狙うものじゃなく、結果としてついてくるもの。',
    timestamp: '2024-12-12T07:00:00+09:00', permalink: 'https://threads.net/@demo_account/post/9',
    views: 18600, likes: 620, replies: 52,
    comments: [
      { id: 'c17', text: 'まずは「保存される投稿」を作ることに集中すべき。', views: 12200, depth: 0 },
      { id: 'c18', text: '保存率が高い投稿は自動的にリーチが伸びる。', views: 8800, depth: 1 },
    ],
  },
  // 終わります系
  {
    id: '10', text: 'この3つをやり続けると、アカウントが終わります\n①毎日テーマがバラバラ ②結論が曖昧 ③プロフが弱い。',
    timestamp: '2024-12-11T20:30:00+09:00', permalink: 'https://threads.net/@demo_account/post/10',
    views: 26200, likes: 880, replies: 82,
    comments: [
      { id: 'c19', text: '逆に言えば、この3つを直すだけで別人のように伸びる。', views: 17100, depth: 0 },
      { id: 'c20', text: '特に①が致命的。テーマは最大3つに絞れ。', views: 12400, depth: 1 },
      { id: 'c21', text: '実例：テーマ統一だけでフォロワー増加ペースが4倍に。', views: 9200, depth: 2 },
    ],
  },
  // ～だけで系
  {
    id: '11', text: '冒頭1行を変えるだけで閲覧数が3倍になった話\n投稿の中身は全く同じ。見出しだけ変えた。',
    timestamp: '2024-12-11T12:00:00+09:00', permalink: 'https://threads.net/@demo_account/post/11',
    views: 27300, likes: 910, replies: 88,
    comments: [
      { id: 'c22', text: 'Before:「投稿のコツ」→ After:「投稿してる人ほど伸びてない理由」', views: 18500, depth: 0 },
      { id: 'c23', text: '否定形・疑問形の見出しはCTR（クリック率）が高い。', views: 13200, depth: 1 },
    ],
  },
  {
    id: '12', text: 'プロフィールに1行足すだけでフォロー率が倍になる\nその1行とは「あなたが得られるもの」を書くこと。',
    timestamp: '2024-12-10T21:00:00+09:00', permalink: 'https://threads.net/@demo_account/post/12',
    views: 21800, likes: 730, replies: 63,
    comments: [
      { id: 'c24', text: '例：「SNSを仕組み化して月100万を自動化する方法を発信」', views: 14200, depth: 0 },
      { id: 'c25', text: '「自分が何をするか」ではなく「相手が何を得るか」で書く。', views: 10100, depth: 1 },
    ],
  },
  // 実は系
  {
    id: '13', text: '実はフォロワー数よりも大事な指標がある\nそれは「プロフィールアクセス率」。投稿を見た人の何%がプロフに来るか。',
    timestamp: '2024-12-10T14:30:00+09:00', permalink: 'https://threads.net/@demo_account/post/13',
    views: 19200, likes: 640, replies: 54,
    comments: [
      { id: 'c26', text: 'この数字が2%以下なら、投稿の「誰に向けた話か」が弱い。', views: 12800, depth: 0 },
      { id: 'c27', text: '改善法：冒頭に「〇〇な人へ」と明示する。', views: 9100, depth: 1 },
    ],
  },
  {
    id: '14', text: '実はバズった投稿からフォロワーはほとんど増えない\nバズ≠フォロワー増。これ、意外と知られてない事実。',
    timestamp: '2024-12-09T19:45:00+09:00', permalink: 'https://threads.net/@demo_account/post/14',
    views: 17500, likes: 580, replies: 48,
    comments: [
      { id: 'c28', text: 'バズ投稿はエンタメ消費されるだけ。フォローに繋がるのは「この人の他の投稿も見たい」と思わせる投稿。', views: 11400, depth: 0 },
    ],
  },
  // 多すぎ系
  {
    id: '15', text: '投稿の情報量が多すぎて読まれない人、多すぎ\n1投稿1メッセージが鉄則。2つ以上入れると離脱される。',
    timestamp: '2024-12-09T08:15:00+09:00', permalink: 'https://threads.net/@demo_account/post/15',
    views: 20100, likes: 670, replies: 56,
    comments: [
      { id: 'c29', text: '「結論→理由→具体例」の3段構成が一番読まれる。', views: 13300, depth: 0 },
      { id: 'c30', text: '情報を詰め込みたい場合はコメント欄に分ける。', views: 9500, depth: 1 },
    ],
  },
  // 質問系
  {
    id: '16', text: 'あなたの投稿、誰に向けて書いてますか？\nターゲットが曖昧な投稿は誰にも刺さらない。',
    timestamp: '2024-12-08T20:00:00+09:00', permalink: 'https://threads.net/@demo_account/post/16',
    views: 16800, likes: 550, replies: 45,
    comments: [
      { id: 'c31', text: '「30代の副業初心者」くらい具体的に決めると、共感されやすい。', views: 11000, depth: 0 },
      { id: 'c32', text: 'ターゲットが決まると、見出しも本文も自然にシャープになる。', views: 7800, depth: 1 },
    ],
  },
  {
    id: '17', text: 'なぜ同じ内容なのにあの人の投稿だけ伸びるのか？\n答えは「見出し」と「構成」の違い。中身の差ではない。',
    timestamp: '2024-12-08T11:30:00+09:00', permalink: 'https://threads.net/@demo_account/post/17',
    views: 23800, likes: 800, replies: 74,
    comments: [
      { id: 'c33', text: '見出しで「これ自分のことだ」と思わせたら勝ち。', views: 15600, depth: 0 },
      { id: 'c34', text: '構成は「問題提起→共感→解決策」が最強。', views: 11200, depth: 1 },
    ],
  },
  // 数字・具体性
  {
    id: '18', text: '30分で投稿を作る方法を解説します\n1. ネタ出し5分 2. 構成5分 3. 執筆15分 4. 推敲5分。',
    timestamp: '2024-12-07T19:00:00+09:00', permalink: 'https://threads.net/@demo_account/post/18',
    views: 24600, likes: 840, replies: 76,
    comments: [
      { id: 'c35', text: 'ネタ出しは「過去の自分の悩み」から出すのが最速。', views: 16200, depth: 0 },
      { id: 'c36', text: '推敲は「冒頭1行だけ」に集中すればOK。', views: 11800, depth: 1 },
    ],
  },
  {
    id: '19', text: 'フォロワー500人から3000人まで伸ばした3つの施策\n①テーマ統一 ②コメント欄活用 ③投稿時間の最適化。',
    timestamp: '2024-12-07T09:00:00+09:00', permalink: 'https://threads.net/@demo_account/post/19',
    views: 26800, likes: 900, replies: 84,
    comments: [
      { id: 'c37', text: '特に②のコメント欄活用が一番効果があった。', views: 17800, depth: 0 },
      { id: 'c38', text: '投稿時間は平日20-21時、休日9-10時がベスト。', views: 12600, depth: 1 },
      { id: 'c39', text: '3ヶ月で達成。最初の1ヶ月は全く伸びなかった。', views: 9400, depth: 2 },
    ],
  },
  {
    id: '20', text: '1投稿で10人フォロワーを増やすテンプレート\n見出し→問題→共感→解決策→CTAの5ステップ。',
    timestamp: '2024-12-06T21:30:00+09:00', permalink: 'https://threads.net/@demo_account/post/20',
    views: 22100, likes: 750, replies: 65,
    comments: [
      { id: 'c40', text: 'CTAは「フォローしてね」ではなく「他の投稿も見てみて」が効く。', views: 14500, depth: 0 },
      { id: 'c41', text: '実績：このテンプレで平均フォロー率2.8%達成。', views: 10300, depth: 1 },
    ],
  },
  // 緊急系 追加
  {
    id: '21', text: '速報：Threadsのアルゴリズムがまた変わった\n今回の変更点は「初速の1時間」の重要度が上がったこと。',
    timestamp: '2024-12-06T12:00:00+09:00', permalink: 'https://threads.net/@demo_account/post/21',
    views: 29100, likes: 960, replies: 92,
    comments: [
      { id: 'c42', text: '投稿後1時間のいいね・保存数でリーチの天井が決まる。', views: 19200, depth: 0 },
      { id: 'c43', text: 'だからこそ投稿時間の最適化が超重要。', views: 13800, depth: 1 },
    ],
  },
  // してる人系 追加
  {
    id: '22', text: 'インスタと同じノリで書いてる人、Threadsでは伸びません\nプラットフォームごとの「文化」が違う。',
    timestamp: '2024-12-05T20:00:00+09:00', permalink: 'https://threads.net/@demo_account/post/22',
    views: 18900, likes: 630, replies: 53,
    comments: [
      { id: 'c44', text: 'Threadsは「テキスト重視」。画像なしでも伸びる。', views: 12400, depth: 0 },
      { id: 'c45', text: '逆に画像メインの投稿はリーチが落ちる傾向。', views: 8700, depth: 1 },
    ],
  },
  // 損してます系 追加
  {
    id: '23', text: 'CTA（行動喚起）を入れてない投稿はもったいない\n「いいね押して」すら入れない人が多すぎる。',
    timestamp: '2024-12-05T10:00:00+09:00', permalink: 'https://threads.net/@demo_account/post/23',
    views: 15400, likes: 510, replies: 42,
    comments: [
      { id: 'c46', text: 'CTA入りの投稿はエンゲージメントが1.4倍。データで実証済み。', views: 10100, depth: 0 },
    ],
  },
  // だけで系 追加
  {
    id: '24', text: '投稿の最後に1行足すだけで保存率が2倍になった\nその1行は「保存して後で見返してください」。シンプルだけど効く。',
    timestamp: '2024-12-04T19:30:00+09:00', permalink: 'https://threads.net/@demo_account/post/24',
    views: 20600, likes: 690, replies: 59,
    comments: [
      { id: 'c47', text: '言われないと保存しない人が大半。だからお願いする。', views: 13600, depth: 0 },
      { id: 'c48', text: 'テスト結果：CTAあり vs なし → 保存率 3.2% vs 1.5%。', views: 9800, depth: 1 },
    ],
  },
  // 実は系 追加
  {
    id: '25', text: '実は「いいね数」は全く意味がない指標です\n大事なのは保存数とプロフアクセス数。',
    timestamp: '2024-12-04T08:00:00+09:00', permalink: 'https://threads.net/@demo_account/post/25',
    views: 17800, likes: 590, replies: 49,
    comments: [
      { id: 'c49', text: 'いいねは「共感した」、保存は「役に立った」。後者がフォローにつながる。', views: 11600, depth: 0 },
      { id: 'c50', text: 'だからノウハウ系・リスト系の投稿が一番効率がいい。', views: 8200, depth: 1 },
    ],
  },
  // 質問系 追加
  {
    id: '26', text: 'そもそも誰のために発信してますか？\n自分のためだけに発信してる人は永遠に伸びない。',
    timestamp: '2024-12-03T20:45:00+09:00', permalink: 'https://threads.net/@demo_account/post/26',
    views: 14200, likes: 470, replies: 38,
    comments: [
      { id: 'c51', text: '「過去の自分」に向けて書くと自然と読者に刺さる。', views: 9300, depth: 0 },
    ],
  },
  // 数字系 追加
  {
    id: '27', text: '1日3投稿を30日間続けた結果を公開\nフォロワー+1,240人。でも投稿数より大事だったのは別のこと。',
    timestamp: '2024-12-03T11:15:00+09:00', permalink: 'https://threads.net/@demo_account/post/27',
    views: 25400, likes: 860, replies: 80,
    comments: [
      { id: 'c52', text: '伸びた投稿と伸びなかった投稿の差は「見出し」だった。', views: 16800, depth: 0 },
      { id: 'c53', text: '「量をこなす→データを取る→改善する」のサイクルが重要。', views: 12100, depth: 1 },
    ],
  },
  // 終わります系 追加
  {
    id: '28', text: 'プロフィールがダサいとアカウントはアウトです\n投稿がどんなに良くても、プロフで離脱されたら意味がない。',
    timestamp: '2024-12-02T18:00:00+09:00', permalink: 'https://threads.net/@demo_account/post/28',
    views: 19600, likes: 660, replies: 57,
    comments: [
      { id: 'c54', text: '「プロフ→固定投稿→最新投稿」の導線を意識する。', views: 12900, depth: 0 },
      { id: 'c55', text: '固定投稿は自己紹介+実績まとめが最強。', views: 9300, depth: 1 },
    ],
  },
  // その他（パターンマッチしない投稿）
  {
    id: '29', text: '今日のランチはカレーでした\n行きつけのお店が新メニュー出してたので試してみた。',
    timestamp: '2024-12-02T12:30:00+09:00', permalink: 'https://threads.net/@demo_account/post/29',
    views: 4200, likes: 120, replies: 8,
    comments: [],
  },
  {
    id: '30', text: '週末は読書して過ごしました\n最近読んだ本がすごく良かったのでおすすめ。',
    timestamp: '2024-12-01T16:00:00+09:00', permalink: 'https://threads.net/@demo_account/post/30',
    views: 3800, likes: 95, replies: 6,
    comments: [],
  },
];

// ============ LINE ダミーデータ ============
const DUMMY_LINE_SUMMARY = {
  totalFriends: 2450,
  surveyResponses: 1842,
  surveyRate: 75.2,
  friendsGrowth7d: 89,
  friendsGrowth30d: 342,
};

const DUMMY_LINE_DAILY = [
  { date: '2024-12-10', friends: 2320, growth: 12, survey: 8, surveyRate: 66.7, blocked: 2, messages_sent: 1, open_count: 1580, click_count: 245 },
  { date: '2024-12-11', friends: 2340, growth: 20, survey: 16, surveyRate: 80.0, blocked: 1, messages_sent: 0, open_count: 0, click_count: 0 },
  { date: '2024-12-12', friends: 2360, growth: 20, survey: 14, surveyRate: 70.0, blocked: 2, messages_sent: 1, open_count: 1720, click_count: 312 },
  { date: '2024-12-13', friends: 2390, growth: 30, survey: 25, surveyRate: 83.3, blocked: 3, messages_sent: 2, open_count: 1650, click_count: 278 },
  { date: '2024-12-14', friends: 2410, growth: 20, survey: 15, surveyRate: 75.0, blocked: 1, messages_sent: 1, open_count: 1780, click_count: 356 },
  { date: '2024-12-15', friends: 2435, growth: 25, survey: 19, surveyRate: 76.0, blocked: 2, messages_sent: 0, open_count: 0, click_count: 0 },
  { date: '2024-12-16', friends: 2450, growth: 15, survey: 12, surveyRate: 80.0, blocked: 1, messages_sent: 1, open_count: 1820, click_count: 389 },
];

const DUMMY_LINE_SOURCES = [
  { name: 'Threads', count: 1250, percentage: 51.0 },
  { name: 'Instagram', count: 680, percentage: 27.8 },
  { name: '検索', count: 320, percentage: 13.1 },
  { name: 'その他', count: 200, percentage: 8.2 },
];

// 属性分析データ
const DUMMY_LINE_DEMOGRAPHICS = {
  gender: [
    { name: '女性', value: 68, color: '#EC4899' },
    { name: '男性', value: 28, color: '#3B82F6' },
    { name: '未回答', value: 4, color: '#9CA3AF' },
  ],
  age: [
    { name: '〜19歳', value: 5, color: '#22D3EE' },
    { name: '20-29歳', value: 32, color: '#06B6D4' },
    { name: '30-39歳', value: 38, color: '#0891B2' },
    { name: '40-49歳', value: 18, color: '#0E7490' },
    { name: '50歳〜', value: 7, color: '#155E75' },
  ],
  prefecture: [
    { name: '東京都', value: 28 },
    { name: '神奈川県', value: 15 },
    { name: '大阪府', value: 12 },
    { name: '愛知県', value: 8 },
    { name: 'その他', value: 37 },
  ],
};

const PIE_COLORS = ['#06C755', '#E1306C', '#3B82F6', '#9CA3AF'];

// ============ メインコンポーネント ============
function DemoPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams?.get('tab') as Channel | null;

  // URLパラメータからチャンネルを取得（デフォルトはthreads）
  const activeChannel = useMemo(() => {
    if (tabParam === 'threads' || tabParam === 'line' || tabParam === 'instagram') {
      return tabParam;
    }
    return 'threads';
  }, [tabParam]);

  const setActiveChannel = (channel: Channel) => {
    router.push(`/demo?tab=${channel}`, { scroll: false });
  };

  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <LoadingScreen message="データ読み込み中" />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-r from-pink-50/70 via-blue-50/50 to-teal-50/30 flex">
      {/* サイドバー（PC） */}
      <aside className="hidden lg:flex lg:flex-col lg:w-56 bg-[color:var(--color-surface)] border-r border-[color:var(--color-border)] fixed h-full z-40">
        {/* ANALYCAロゴ */}
        <div className="p-4 border-b border-[color:var(--color-border)]">
          <div className="flex items-center gap-3">
            <AnalycaLogo size="md" />
            <div>
              <h1 className="text-xl font-bold text-[color:var(--color-text-primary)]">ANALYCA</h1>
              <p className="text-xs text-[color:var(--color-text-muted)]">Demo Account</p>
            </div>
          </div>
        </div>

        {/* チャンネル切替 */}
        <nav className="flex-1 p-3 space-y-1">
          {channelItems.map((channel) => {
            const Icon = channel.Icon;
            return (
              <button
                key={channel.value}
                onClick={() => setActiveChannel(channel.value)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-md)] text-sm font-medium transition-colors ${
                  activeChannel === channel.value
                    ? 'bg-[color:var(--color-accent)] text-white'
                    : 'text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-surface-muted)]'
                }`}
              >
                <Icon className="w-5 h-5" />
                {channel.label}
              </button>
            );
          })}
        </nav>

        {/* フッター */}
        <div className="p-4 border-t border-[color:var(--color-border)]">
          <p className="text-xs text-[color:var(--color-text-muted)]">デモモード</p>
        </div>
      </aside>

      {/* モバイルサイドバー */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 bg-[color:var(--color-surface)] border-r border-[color:var(--color-border)]">
            <div className="p-4 border-b border-[color:var(--color-border)] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AnalycaLogo size="sm" />
                <div>
                  <h1 className="text-lg font-bold text-[color:var(--color-text-primary)]">ANALYCA</h1>
                  <p className="text-xs text-[color:var(--color-text-muted)]">Demo Account</p>
                </div>
              </div>
              <button onClick={() => setSidebarOpen(false)} className="p-2 text-[color:var(--color-text-secondary)]">
                ✕
              </button>
            </div>
            <nav className="p-3 space-y-1">
              {channelItems.map((channel) => {
                const Icon = channel.Icon;
                return (
                  <button
                    key={channel.value}
                    onClick={() => {
                      setActiveChannel(channel.value);
                      setSidebarOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-md)] text-sm font-medium transition-colors ${
                      activeChannel === channel.value
                        ? 'bg-[color:var(--color-accent)] text-white'
                        : 'text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-surface-muted)]'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {channel.label}
                  </button>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* メインコンテンツ */}
      <main className="flex-1 lg:ml-56">
        {/* モバイルヘッダー */}
        <header className="lg:hidden sticky top-0 z-30 bg-[color:var(--color-surface)] border-b border-[color:var(--color-border)] px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-[var(--radius-sm)] text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-surface-muted)]"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <AnalycaLogo size="sm" />
          <h1 className="text-lg font-bold text-[color:var(--color-text-primary)]">ANALYCA</h1>
        </header>

        {/* チャンネルコンテンツ */}
        <div className="p-4 lg:p-6">
          {activeChannel === 'instagram' && <InstagramDemo />}
          {activeChannel === 'threads' && <ThreadsDemo />}
          {activeChannel === 'line' && <LineDemo />}
        </div>
      </main>

      {/* モバイルボトムナビ */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-[color:var(--color-surface)] border-t border-[color:var(--color-border)] safe-area-bottom z-40">
        <div className="flex justify-around py-2">
          {channelItems.map((channel) => {
            const Icon = channel.Icon;
            return (
              <button
                key={channel.value}
                onClick={() => setActiveChannel(channel.value)}
                className={`flex flex-col items-center px-4 py-1 ${
                  activeChannel === channel.value
                    ? 'text-[color:var(--color-accent)]'
                    : 'text-[color:var(--color-text-muted)]'
                }`}
              >
                <Icon className="w-6 h-6" />
                <span className="text-xs mt-1">{channel.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

// ============ Instagram デモ ============
type IGTab = 'overview' | 'reels' | 'stories' | 'daily';

function InstagramDemo() {
  const [activeTab, setActiveTab] = useState<IGTab>('overview');
  const [datePreset, setDatePreset] = useState<DatePreset>('7d');
  const [reelSortBy, setReelSortBy] = useState('views');
  const [storySortBy, setStorySortBy] = useState('views');

  const summary = useMemo(() => {
    const totalReach = DUMMY_IG_DAILY_DATA.reduce((sum, d) => sum + d.reach, 0);
    const totalProfileViews = DUMMY_IG_DAILY_DATA.reduce((sum, d) => sum + d.profileViews, 0);
    const totalWebClicks = DUMMY_IG_DAILY_DATA.reduce((sum, d) => sum + d.webClicks, 0);
    const totalGrowth = DUMMY_IG_DAILY_DATA.reduce((sum, d) => sum + d.growth, 0);
    return { totalReach, totalProfileViews, totalWebClicks, totalGrowth };
  }, []);

  const sortedReels = useMemo(() => {
    return [...DUMMY_IG_REELS].sort((a, b) => {
      if (reelSortBy === 'date') return new Date(b.date).getTime() - new Date(a.date).getTime();
      if (reelSortBy === 'views') return b.views - a.views;
      if (reelSortBy === 'likes') return b.likes - a.likes;
      return 0;
    });
  }, [reelSortBy]);

  const sortedStories = useMemo(() => {
    return [...DUMMY_IG_STORIES].sort((a, b) => {
      if (storySortBy === 'date') return new Date(b.date).getTime() - new Date(a.date).getTime();
      if (storySortBy === 'views') return b.views - a.views;
      return 0;
    });
  }, [storySortBy]);

  const tabItems: { value: IGTab; label: string }[] = [
    { value: 'overview', label: '概要' },
    { value: 'reels', label: 'リール' },
    { value: 'stories', label: 'ストーリー' },
    { value: 'daily', label: 'デイリー' },
  ];

  return (
    <div className="section-stack pb-20 lg:pb-6">
      {/* ヘッダー: タブ + 日付選択 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {tabItems.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`h-9 rounded-[var(--radius-sm)] px-3 text-sm font-medium transition-colors ${
                activeTab === tab.value
                  ? 'bg-[color:var(--color-text-primary)] text-white'
                  : 'border border-[color:var(--color-border)] bg-white text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-surface-muted)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <select
          value={datePreset}
          onChange={(e) => setDatePreset(e.target.value as DatePreset)}
          className="h-9 rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-white px-3 text-sm text-[color:var(--color-text-secondary)]"
        >
          {datePresetOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* 概要タブ */}
      {activeTab === 'overview' && (
        <>
          {/* アカウント + ファネル */}
          <div className="grid lg:grid-cols-12 gap-4">
            <div className="lg:col-span-3">
              <div className="ui-card p-6 h-full flex flex-col justify-center">
                <div className="flex items-center mb-4">
                  <div className="w-14 h-14 rounded-full overflow-hidden bg-[color:var(--color-surface-muted)] mr-4">
                    <img src={DUMMY_IG_USER.profile_picture_url} alt="Profile" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-[color:var(--color-text-primary)]">{DUMMY_IG_USER.username}</h2>
                    <p className="text-xs text-[color:var(--color-text-muted)]">フォロワー数</p>
                  </div>
                </div>
                <div className="flex items-center">
                  <span className="text-2xl font-semibold text-[color:var(--color-text-primary)] mr-3">{DUMMY_IG_USER.followers_count.toLocaleString()}</span>
                  <span className="text-sm font-medium text-green-500">+{summary.totalGrowth}</span>
                </div>
              </div>
            </div>
            <div className="lg:col-span-9">
              <div className="ui-card p-6">
                <h2 className="text-lg font-semibold text-[color:var(--color-text-primary)] mb-6">ファネル分析</h2>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex flex-col items-center">
                    <span className="text-xs font-medium uppercase tracking-wide text-[color:var(--color-text-secondary)]">リーチ</span>
                    <span className="text-xl font-semibold text-[color:var(--color-text-primary)]">{summary.totalReach.toLocaleString()}</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-green-500">→</span>
                    <span className="text-xs text-green-500">{((summary.totalProfileViews / summary.totalReach) * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-xs font-medium uppercase tracking-wide text-[color:var(--color-text-secondary)]">プロフ表示</span>
                    <span className="text-xl font-semibold text-[color:var(--color-text-primary)]">{summary.totalProfileViews.toLocaleString()}</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-green-500">→</span>
                    <span className="text-xs text-green-500">{((summary.totalWebClicks / summary.totalProfileViews) * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-xs font-medium uppercase tracking-wide text-[color:var(--color-text-secondary)]">リンククリック</span>
                    <span className="text-xl font-semibold text-[color:var(--color-text-primary)]">{summary.totalWebClicks.toLocaleString()}</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-green-500">→</span>
                    <span className="text-xs text-green-500">{((summary.totalGrowth / summary.totalWebClicks) * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-xs font-medium uppercase tracking-wide text-[color:var(--color-text-secondary)]">フォロワー増加</span>
                    <span className="text-xl font-semibold text-[color:var(--color-text-primary)]">{summary.totalGrowth.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* パフォーマンス推移 */}
          <div className="ui-card p-6">
            <h3 className="text-lg font-semibold text-[color:var(--color-text-primary)]">パフォーマンス推移</h3>
            <p className="mt-1 text-sm text-[color:var(--color-text-secondary)] mb-4">日別のパフォーマンス</p>
            <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[color:var(--color-border)]">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr className="border-b border-[color:var(--color-border)] text-left text-xs uppercase tracking-wide text-[color:var(--color-text-secondary)]">
                    <th className="px-3 py-2">日付</th>
                    <th className="px-3 py-2 text-right">フォロワー</th>
                    <th className="px-3 py-2 text-right">増減</th>
                    <th className="px-3 py-2 text-right">リーチ</th>
                    <th className="px-3 py-2 text-right">プロフ表示</th>
                    <th className="px-3 py-2 text-right">クリック</th>
                    <th className="px-3 py-2 text-right">ストーリー</th>
                    <th className="px-3 py-2 text-right">ST閲覧数</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--color-border)]">
                  {DUMMY_IG_DAILY_DATA.slice().reverse().map((row) => (
                    <tr key={row.date} className="hover:bg-[color:var(--color-surface-muted)]">
                      <td className="px-3 py-2 font-medium text-[color:var(--color-text-primary)]">{row.date}</td>
                      <td className="px-3 py-2 text-right text-[color:var(--color-text-primary)]">{row.followers.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right">
                        <span className="text-green-600">+{row.growth}</span>
                      </td>
                      <td className="px-3 py-2 text-right text-[color:var(--color-text-primary)]">{row.reach.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right text-[color:var(--color-text-primary)]">{row.profileViews.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right text-[color:var(--color-text-primary)]">{row.webClicks}</td>
                      <td className="px-3 py-2 text-right text-[color:var(--color-text-secondary)]">{row.storyCount}</td>
                      <td className="px-3 py-2 text-right text-[color:var(--color-text-primary)]">{row.storyViews.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-6 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={DUMMY_IG_DAILY_DATA} margin={{ top: 10, right: 30, left: 20, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#6B7280' }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 12, fill: '#6B7280' }} tickFormatter={(v) => v.toLocaleString()} domain={['dataMin - 50', 'dataMax + 50']} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12, fill: '#6B7280' }} />
                  <Tooltip formatter={(value: number, name: string) => [value.toLocaleString(), name]} />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="followers" name="フォロワー数" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} />
                  <Bar yAxisId="right" dataKey="growth" name="増加数" fill="#8B5CF6" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* リールTOP5 */}
          <div className="ui-card p-6">
            <div className="flex items-start justify-between gap-3 mb-4">
              <h3 className="text-lg font-semibold text-[color:var(--color-text-primary)]">リールTOP5</h3>
              <button onClick={() => setActiveTab('reels')} className="h-9 px-3 text-sm font-medium rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-white text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-surface-muted)]">
                詳細
              </button>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-1">
              {sortedReels.slice(0, 5).map((reel) => (
                <div key={reel.id} className="flex min-w-[160px] flex-shrink-0 flex-col overflow-hidden rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-white shadow-sm">
                  <div className="relative aspect-[9/16] w-full bg-[color:var(--color-surface-muted)]">
                    <img src={reel.thumbnail} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
                  </div>
                  <div className="p-3 space-y-1">
                    <p className="text-xs text-[color:var(--color-text-muted)]">{reel.date}</p>
                    <p className="text-sm font-semibold text-[color:var(--color-text-primary)]">{reel.views.toLocaleString()} 再生</p>
                    <p className="text-xs text-[color:var(--color-text-secondary)]">{reel.likes.toLocaleString()} いいね</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ストーリーTOP5 */}
          <div className="ui-card p-6">
            <div className="flex items-start justify-between gap-3 mb-4">
              <h3 className="text-lg font-semibold text-[color:var(--color-text-primary)]">ストーリーTOP5</h3>
              <button onClick={() => setActiveTab('stories')} className="h-9 px-3 text-sm font-medium rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-white text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-surface-muted)]">
                詳細
              </button>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-1">
              {sortedStories.slice(0, 5).map((story) => {
                const viewRate = ((story.views / story.followers) * 100).toFixed(1);
                return (
                  <div key={story.id} className="flex min-w-[160px] flex-shrink-0 flex-col overflow-hidden rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-white shadow-sm">
                    <div className="relative aspect-[9/16] w-full bg-[color:var(--color-surface-muted)]">
                      <img src={story.thumbnail} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
                    </div>
                    <div className="p-3 space-y-1">
                      <p className="text-xs text-[color:var(--color-text-muted)]">{story.date}</p>
                      <p className="text-sm font-semibold text-[color:var(--color-text-primary)]">{story.views.toLocaleString()} 閲覧</p>
                      <p className="text-xs text-[color:var(--color-text-secondary)]">{viewRate}% 閲覧率</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* リールタブ */}
      {activeTab === 'reels' && (
        <div className="ui-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <h2 className="text-lg font-semibold text-[color:var(--color-text-primary)]">リール一覧</h2>
            <select value={reelSortBy} onChange={(e) => setReelSortBy(e.target.value)} className="h-9 rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-white px-3 text-sm text-[color:var(--color-text-secondary)]">
              <option value="date">日付</option>
              <option value="views">再生数</option>
              <option value="likes">いいね</option>
            </select>
          </div>
          <div className="space-y-4">
            {sortedReels.map((reel) => (
              <div key={reel.id} className="flex gap-4 rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-white p-4 shadow-sm">
                <div className="w-[90px] flex-shrink-0 overflow-hidden rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)]">
                  <div className="aspect-[9/16]">
                    <img src={reel.thumbnail} alt="" className="h-full w-full object-cover" loading="lazy" />
                  </div>
                </div>
                <div className="flex-1 space-y-2">
                  <p className="text-xs text-[color:var(--color-text-muted)]">{reel.date}</p>
                  <dl className="grid grid-cols-2 gap-y-2 text-sm sm:grid-cols-4">
                    <div><dt className="text-[color:var(--color-text-muted)]">再生数</dt><dd className="font-semibold text-[color:var(--color-text-primary)]">{reel.views.toLocaleString()}</dd></div>
                    <div><dt className="text-[color:var(--color-text-muted)]">いいね</dt><dd className="font-semibold text-[color:var(--color-text-primary)]">{reel.likes.toLocaleString()}</dd></div>
                    <div><dt className="text-[color:var(--color-text-muted)]">コメント</dt><dd className="font-semibold text-[color:var(--color-text-primary)]">{reel.comments.toLocaleString()}</dd></div>
                    <div><dt className="text-[color:var(--color-text-muted)]">保存</dt><dd className="font-semibold text-[color:var(--color-text-primary)]">{reel.saves.toLocaleString()}</dd></div>
                  </dl>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ストーリータブ */}
      {activeTab === 'stories' && (
        <div className="ui-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <h2 className="text-lg font-semibold text-[color:var(--color-text-primary)]">ストーリー一覧</h2>
            <select value={storySortBy} onChange={(e) => setStorySortBy(e.target.value)} className="h-9 rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-white px-3 text-sm text-[color:var(--color-text-secondary)]">
              <option value="date">日付</option>
              <option value="views">閲覧数</option>
            </select>
          </div>
          <div className="space-y-4">
            {sortedStories.map((story) => {
              const viewRate = ((story.views / story.followers) * 100).toFixed(1);
              return (
                <div key={story.id} className="flex gap-4 rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-white p-4 shadow-sm">
                  <div className="w-[90px] flex-shrink-0 overflow-hidden rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)]">
                    <div className="aspect-[9/16]">
                      <img src={story.thumbnail} alt="" className="h-full w-full object-cover" loading="lazy" />
                    </div>
                  </div>
                  <div className="flex-1 space-y-2">
                    <p className="text-xs text-[color:var(--color-text-muted)]">{story.date}</p>
                    <dl className="grid grid-cols-2 gap-y-2 text-sm sm:grid-cols-4">
                      <div><dt className="text-[color:var(--color-text-muted)]">閲覧数</dt><dd className="font-semibold text-[color:var(--color-text-primary)]">{story.views.toLocaleString()}</dd></div>
                      <div><dt className="text-[color:var(--color-text-muted)]">閲覧率</dt><dd className="font-semibold text-[color:var(--color-text-primary)]">{viewRate}%</dd></div>
                      <div><dt className="text-[color:var(--color-text-muted)]">リーチ</dt><dd className="font-semibold text-[color:var(--color-text-primary)]">{story.reach.toLocaleString()}</dd></div>
                      <div><dt className="text-[color:var(--color-text-muted)]">返信</dt><dd className="font-semibold text-[color:var(--color-text-primary)]">{story.replies}</dd></div>
                    </dl>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* デイリータブ */}
      {activeTab === 'daily' && (
        <>
          <div className="ui-card p-6">
            <h2 className="text-lg font-semibold text-[color:var(--color-text-primary)] mb-4">デイリー推移</h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={DUMMY_IG_DAILY_DATA} margin={{ top: 10, right: 30, left: 20, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#6B7280' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#6B7280' }} tickFormatter={(v) => v.toLocaleString()} />
                  <Tooltip formatter={(value: number, name: string) => [value.toLocaleString(), name]} />
                  <Legend />
                  <Bar dataKey="reach" name="リーチ" fill="#10B981" />
                  <Bar dataKey="profileViews" name="プロフ表示" fill="#3B82F6" />
                  <Bar dataKey="webClicks" name="リンククリック" fill="#6366F1" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="ui-card p-6">
            <h2 className="text-lg font-semibold text-[color:var(--color-text-primary)] mb-4">デイリーデータ</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[color:var(--color-border)] text-left">
                    <th className="px-3 py-3 font-semibold text-[color:var(--color-text-primary)]">日付</th>
                    <th className="px-3 py-3 font-semibold text-[color:var(--color-text-primary)] text-right">フォロワー</th>
                    <th className="px-3 py-3 font-semibold text-[color:var(--color-text-primary)] text-right">増加</th>
                    <th className="px-3 py-3 font-semibold text-[color:var(--color-text-primary)] text-right">リーチ</th>
                    <th className="px-3 py-3 font-semibold text-[color:var(--color-text-primary)] text-right">プロフ表示</th>
                    <th className="px-3 py-3 font-semibold text-[color:var(--color-text-primary)] text-right">クリック</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--color-border)]">
                  {DUMMY_IG_DAILY_DATA.map((row, idx) => (
                    <tr key={idx} className="hover:bg-[color:var(--color-surface-muted)]">
                      <td className="px-3 py-3 text-[color:var(--color-text-primary)]">{row.date}</td>
                      <td className="px-3 py-3 text-[color:var(--color-text-primary)] text-right">{row.followers.toLocaleString()}</td>
                      <td className="px-3 py-3 text-right"><span className="text-green-600">+{row.growth}</span></td>
                      <td className="px-3 py-3 text-[color:var(--color-text-primary)] text-right">{row.reach.toLocaleString()}</td>
                      <td className="px-3 py-3 text-[color:var(--color-text-primary)] text-right">{row.profileViews.toLocaleString()}</td>
                      <td className="px-3 py-3 text-[color:var(--color-text-primary)] text-right">{row.webClicks.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ============ Threads パターン分析（インライン） ============
const THREADS_PATTERNS = [
  { name: '緊急・ヤバい系', regex: /(緊急|速報|ヤバい|ヤバすぎ)/ },
  { name: '〜してる人系', regex: /(してる人|やってる人|使ってる人|書いてる人)/ },
  { name: '時代遅れ系', regex: /時代遅れ/ },
  { name: '損してます系', regex: /(損して|損します|無駄|もったいない)/ },
  { name: '間違ってます系', regex: /(間違って|間違えて)/ },
  { name: '終わります系', regex: /(終わって|終わります|アウト)/ },
  { name: '〜だけで系', regex: /(だけで|するだけ)/ },
  { name: '実は系', regex: /実は/ },
  { name: '多すぎ系', regex: /多すぎ/ },
  { name: '質問系', regex: /[？?]$/ },
  { name: '数字・具体性', regex: /(\d+分|\d+時間|\d+倍|\d+人|\d+%)/ },
];

const THREADS_DAYS_OF_WEEK = ['日', '月', '火', '水', '木', '金', '土'];
const THREADS_HOURS = Array.from({ length: 24 }, (_, i) => i);

type ThreadsPatternStat = {
  name: string;
  count: number;
  avgViews: number;
  avgLikes: number;
  examples: Array<{ text: string; views: number }>;
};

function threadsGetFirstLine(text: string): string {
  return text.split('\n').filter((line) => line.trim())[0]?.trim() || '';
}

function threadsAnalyzePatterns(posts: typeof DUMMY_THREADS_POSTS) {
  const overallAvgViews = posts.length > 0
    ? Math.round(posts.reduce((sum, p) => sum + p.views, 0) / posts.length)
    : 0;

  const map = new Map<string, { totalViews: number; totalLikes: number; count: number; examples: Array<{ text: string; views: number }> }>();
  const matchedPostIds = new Set<number>();

  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    const firstLine = threadsGetFirstLine(post.text);
    let matched = false;
    for (const pattern of THREADS_PATTERNS) {
      if (pattern.regex.test(firstLine)) {
        matched = true;
        const entry = map.get(pattern.name) || { totalViews: 0, totalLikes: 0, count: 0, examples: [] };
        entry.totalViews += post.views;
        entry.totalLikes += post.likes;
        entry.count++;
        if (entry.examples.length < 2) {
          entry.examples.push({ text: firstLine.slice(0, 40), views: post.views });
        }
        map.set(pattern.name, entry);
      }
    }
    if (matched) matchedPostIds.add(i);
  }

  let otherStats: ThreadsPatternStat | null = null;
  const unmatchedPosts = posts.filter((_, i) => !matchedPostIds.has(i));
  if (unmatchedPosts.length > 0) {
    const totalViews = unmatchedPosts.reduce((sum, p) => sum + p.views, 0);
    const totalLikes = unmatchedPosts.reduce((sum, p) => sum + p.likes, 0);
    otherStats = {
      name: 'その他',
      count: unmatchedPosts.length,
      avgViews: Math.round(totalViews / unmatchedPosts.length),
      avgLikes: Math.round(totalLikes / unmatchedPosts.length),
      examples: unmatchedPosts.slice(0, 2).map(p => ({ text: threadsGetFirstLine(p.text).slice(0, 40), views: p.views })),
    };
  }

  const stats: ThreadsPatternStat[] = Array.from(map.entries())
    .map(([name, entry]) => ({
      name,
      count: entry.count,
      avgViews: Math.round(entry.totalViews / entry.count),
      avgLikes: Math.round(entry.totalLikes / entry.count),
      examples: entry.examples,
    }))
    .sort((a, b) => b.avgViews - a.avgViews);

  return { stats, overallAvgViews, otherStats };
}

function threadsAnalyzeTimePerformance(posts: typeof DUMMY_THREADS_POSTS) {
  const matrix: Record<string, { totalViews: number; count: number }> = {};
  const dayTotals: Record<number, { totalViews: number; count: number }> = {};
  const hourTotals: Record<number, { totalViews: number; count: number }> = {};

  for (let day = 0; day < 7; day++) {
    dayTotals[day] = { totalViews: 0, count: 0 };
    for (let hour = 0; hour < 24; hour++) {
      matrix[`${day}-${hour}`] = { totalViews: 0, count: 0 };
      if (day === 0) hourTotals[hour] = { totalViews: 0, count: 0 };
    }
  }

  for (const post of posts) {
    const date = new Date(post.timestamp);
    if (Number.isNaN(date.getTime())) continue;
    const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
    const dayIndex = jst.getUTCDay();
    const hour = jst.getUTCHours();

    matrix[`${dayIndex}-${hour}`].totalViews += post.views;
    matrix[`${dayIndex}-${hour}`].count += 1;
    dayTotals[dayIndex].totalViews += post.views;
    dayTotals[dayIndex].count += 1;
    hourTotals[hour].totalViews += post.views;
    hourTotals[hour].count += 1;
  }

  type HeatmapCell = { dayIndex: number; hour: number; avgViews: number; postCount: number };
  const heatmapData: HeatmapCell[] = [];
  let maxAvg = 0;

  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      const { totalViews, count } = matrix[`${day}-${hour}`];
      const avg = count > 0 ? totalViews / count : 0;
      maxAvg = Math.max(maxAvg, avg);
      heatmapData.push({ dayIndex: day, hour, avgViews: avg, postCount: count });
    }
  }

  const dayStats = Object.entries(dayTotals).map(([day, data]) => ({
    dayIndex: Number(day),
    avgViews: data.count > 0 ? data.totalViews / data.count : 0,
    postCount: data.count,
  }));

  const hourStats = Object.entries(hourTotals).map(([hour, data]) => ({
    hour: Number(hour),
    avgViews: data.count > 0 ? data.totalViews / data.count : 0,
    postCount: data.count,
  }));

  return { heatmapData, dayStats, hourStats, maxAvgViews: maxAvg };
}

function threadsGetHeatColor(value: number, max: number): string {
  if (max === 0 || value === 0) return 'bg-gray-100';
  const intensity = value / max;
  if (intensity >= 0.8) return 'bg-indigo-600';
  if (intensity >= 0.6) return 'bg-indigo-500';
  if (intensity >= 0.4) return 'bg-indigo-400';
  if (intensity >= 0.2) return 'bg-indigo-300';
  return 'bg-indigo-200';
}

function threadsFmtNum(n: number): string {
  return new Intl.NumberFormat('ja-JP').format(Math.round(n));
}

// ============ Threads デモ ============
// ============ デモ用予約投稿データ ============
const DEMO_SCHEDULED_POSTS = [
  {
    scheduleId: 'demo-1',
    scheduledDate: '2026-03-10',
    scheduledAt: '2026-03-10T09:00:00+09:00',
    scheduledAtJst: '2026-03-10T09:00:00',
    mainText: '【マジでやばい】インスタ運用してる人の9割が知らない事実。リーチが伸びない原因、アルゴリズムじゃなくて「〇〇」だった。',
    comment1: '僕のコンサル生で、毎日投稿してるのにフォロワー全く増えなかった人がいて。原因を分析したら、投稿の「最初の1行」が全部同じパターンだった。\n\nフックを変えただけで、リーチが3倍になった実例を紹介します。',
    comment2: '具体的にどうすればいいかは、プロフのリンクから無料で見れます。\n\n「何を言うか」より「どう言うか」の方が100倍大事。',
    status: 'scheduled' as const,
    createdAt: '2026-03-09T15:00:00',
    updatedAt: '2026-03-09T15:00:00',
  },
  {
    scheduleId: 'demo-2',
    scheduledDate: '2026-03-10',
    scheduledAt: '2026-03-10T18:00:00+09:00',
    scheduledAtJst: '2026-03-10T18:00:00',
    mainText: 'Threadsで伸びてる人と伸びてない人の決定的な違い、知りたい？\n\n答えは「コメント欄の使い方」。本文は短く、価値はコメント欄に詰め込む。',
    comment1: 'データで証明します。僕の直近30投稿で、コメント欄に実績を入れた投稿は平均閲覧数が2.4倍。\n\n理由はシンプルで、コメント欄まで読む人＝本気で興味ある人。その人たちの滞在時間がアルゴリズムに効く。',
    comment2: 'この分析、実はANALYCAっていうツールで全部自動で出せます。\n\nコメント欄の遷移率まで見れるのはこれだけ。',
    status: 'scheduled' as const,
    createdAt: '2026-03-09T15:30:00',
    updatedAt: '2026-03-09T15:30:00',
  },
  {
    scheduleId: 'demo-3',
    scheduledDate: '2026-03-11',
    scheduledAt: '2026-03-11T12:00:00+09:00',
    scheduledAtJst: '2026-03-11T12:00:00',
    mainText: '「毎日投稿しないとダメ」って思い込んでる人、損してます。\n\n週3投稿で月100万リーチ出してる人、実際にいるんで。',
    comment1: '大事なのは量じゃなくて「当たる型」を持ってるかどうか。\n\n僕が分析した結果、伸びる投稿の1行目には共通パターンが11個ある。',
    comment2: 'そのパターンをAIで自動分析して、自分の投稿に当てはめられるツールを作りました。\n\n無料で試せるので、プロフから見てみてください。',
    status: 'draft' as const,
    createdAt: '2026-03-09T16:00:00',
    updatedAt: '2026-03-09T16:00:00',
  },
  {
    scheduleId: 'demo-4',
    scheduledDate: '2026-03-12',
    scheduledAt: '2026-03-12T09:00:00+09:00',
    scheduledAtJst: '2026-03-12T09:00:00',
    mainText: '正直に言う。SNS分析ツール、高すぎる。\n\n月1万以上払って、見てるのはフォロワー数の推移だけ。それ、スマホのメモ帳でできるよね？',
    comment1: '僕が本当に欲しかったのは「どの投稿がなぜ伸びたか」の分析。\n\nだから自分で作った。月額980円で、パターン分析・時間帯分析・コメント欄遷移率まで全部見れる。',
    comment2: '既存ツールの1/10の価格で、10倍使える分析が手に入ります。\n\n嘘だと思ったら7日間無料で試してみてください。',
    status: 'scheduled' as const,
    createdAt: '2026-03-09T16:30:00',
    updatedAt: '2026-03-09T16:30:00',
  },
  {
    scheduleId: 'demo-5',
    scheduledDate: '2026-03-09',
    scheduledAt: '2026-03-09T09:00:00+09:00',
    scheduledAtJst: '2026-03-09T09:00:00',
    mainText: '今日の朝イチ投稿。フォロワー1万人以下の人がやるべきこと、たった1つだけ。',
    comment1: 'それは「勝ちパターンの発見」。\n\n闇雲に投稿するんじゃなくて、自分のどの投稿が伸びたかを分析して、その型を再現する。',
    comment2: 'ANALYCAならそれが一目で分かります。無料トライアルあり。',
    status: 'posted' as const,
    createdAt: '2026-03-08T20:00:00',
    updatedAt: '2026-03-09T09:01:00',
  },
];

function ThreadsDemo() {
  const [expandedPosts, setExpandedPosts] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'date' | 'views' | 'likes'>('views');
  const [showAllPosts, setShowAllPosts] = useState(false);
  const [datePreset, setDatePreset] = useState<DatePreset>('7d');
  const [threadsTab, setThreadsTab] = useState<'analysis' | 'schedule'>('analysis');

  const toggleExpand = (postId: string) => {
    setExpandedPosts((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
  };

  const sortedPosts = useMemo(() => {
    return [...DUMMY_THREADS_POSTS].sort((a, b) => {
      if (sortBy === 'views') return b.views - a.views;
      if (sortBy === 'likes') return b.likes - a.likes;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
  }, [sortBy]);

  const summary = useMemo(() => {
    const totalViews = DUMMY_THREADS_POSTS.reduce((sum, p) => sum + p.views, 0);
    const totalLikes = DUMMY_THREADS_POSTS.reduce((sum, p) => sum + p.likes, 0);
    const totalReplies = DUMMY_THREADS_POSTS.reduce((sum, p) => sum + p.replies, 0);
    const engagementRate = totalViews > 0 ? ((totalLikes + totalReplies) / totalViews * 100).toFixed(2) : '0.00';
    const followerGrowth = DUMMY_THREADS_DAILY.reduce((sum, d) => sum + d.follower_delta, 0);
    return { totalViews, totalLikes, totalReplies, engagementRate, followerGrowth };
  }, []);

  const patternData = useMemo(() => threadsAnalyzePatterns(DUMMY_THREADS_POSTS), []);
  const timeData = useMemo(() => threadsAnalyzeTimePerformance(DUMMY_THREADS_POSTS), []);

  const getTransitionRates = (post: typeof DUMMY_THREADS_POSTS[0]) => {
    if (!post.comments.length || post.views === 0) return { transitions: [], overallRate: null };
    const transitions: { from: string; to: string; rate: number; views: number }[] = [];
    const sorted = [...post.comments].sort((a, b) => a.depth - b.depth);

    if (sorted.length > 0) {
      transitions.push({ from: 'メイン', to: 'コメント欄1', rate: (sorted[0].views / post.views) * 100, views: sorted[0].views });
    }
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i - 1].views > 0) {
        transitions.push({
          from: `コメント欄${i}`,
          to: `コメント欄${i + 1}`,
          rate: (sorted[i].views / sorted[i - 1].views) * 100,
          views: sorted[i].views,
        });
      }
    }
    const last = sorted[sorted.length - 1];
    const overallRate = post.views > 0 ? (last.views / post.views) * 100 : null;
    return { transitions, overallRate };
  };

  const INITIAL_DISPLAY_COUNT = 10;
  const displayedPosts = showAllPosts ? sortedPosts : sortedPosts.slice(0, INITIAL_DISPLAY_COUNT);
  const hasMorePosts = sortedPosts.length > INITIAL_DISPLAY_COUNT;

  // パターン分析用の計算
  const topPattern = patternData.stats[0];
  const maxBarValue = topPattern?.avgViews ?? 0;
  const allPatternStats = [...patternData.stats];
  if (patternData.otherStats) allPatternStats.push(patternData.otherStats);

  const bestDay = timeData.dayStats.reduce((best, cur) =>
    cur.avgViews > best.avgViews ? cur : best, timeData.dayStats[0]);
  const bestHours = timeData.hourStats
    .filter(h => h.postCount > 0)
    .sort((a, b) => b.avgViews - a.avgViews)
    .slice(0, 3);

  return (
    <div className="section-stack pb-20 lg:pb-6">
      {/* ヘッダー: サブタブ + 日付選択 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setThreadsTab('analysis')}
            className={`h-9 rounded-[var(--radius-sm)] px-3 text-sm font-medium transition-colors ${
              threadsTab === 'analysis'
                ? 'bg-[color:var(--color-text-primary)] text-white'
                : 'bg-white border border-[color:var(--color-border)] text-[color:var(--color-text-secondary)] hover:bg-gray-50'
            }`}
          >
            分析
          </button>
          <button
            onClick={() => setThreadsTab('schedule')}
            className={`h-9 rounded-[var(--radius-sm)] px-3 text-sm font-medium transition-colors ${
              threadsTab === 'schedule'
                ? 'bg-[color:var(--color-text-primary)] text-white'
                : 'bg-white border border-[color:var(--color-border)] text-[color:var(--color-text-secondary)] hover:bg-gray-50'
            }`}
          >
            予約投稿
          </button>
        </div>
        {threadsTab === 'analysis' && (
          <select
            value={datePreset}
            onChange={(e) => setDatePreset(e.target.value as DatePreset)}
            className="h-9 rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-white px-3 text-sm text-[color:var(--color-text-secondary)]"
          >
            {datePresetOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        )}
      </div>

      {threadsTab === 'analysis' && (<>
      {/* アカウント + KPI */}
      <div className="grid lg:grid-cols-12 gap-4">
        {/* 左側：アカウント情報 */}
        <div className="lg:col-span-3">
          <div className="ui-card p-6 h-full flex flex-col justify-center">
            <div className="flex items-center mb-4">
              <div className="w-14 h-14 rounded-full overflow-hidden bg-[color:var(--color-surface-muted)] mr-4">
                <img src={DUMMY_THREADS_USER.profile_picture_url} alt="Profile" className="w-full h-full object-cover" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[color:var(--color-text-primary)]">{DUMMY_THREADS_USER.username}</h2>
                <p className="text-xs text-[color:var(--color-text-muted)]">フォロワー数</p>
              </div>
            </div>
            <div className="flex items-center">
              <span className="text-2xl font-semibold text-[color:var(--color-text-primary)] mr-3">{DUMMY_THREADS_USER.followers_count.toLocaleString()}</span>
              <span className="text-sm font-medium text-green-500">+{summary.followerGrowth}</span>
            </div>
          </div>
        </div>
        {/* 右側：KPI */}
        <div className="lg:col-span-9">
          <div className="ui-card p-6">
            <h2 className="text-lg font-semibold text-[color:var(--color-text-primary)] mb-6">パフォーマンス指標</h2>
            <dl className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)] p-4">
                <dt className="text-xs font-medium text-[color:var(--color-text-secondary)] uppercase tracking-wide">投稿数</dt>
                <dd className="mt-2 text-2xl font-semibold text-[color:var(--color-text-primary)]">{DUMMY_THREADS_POSTS.length}</dd>
              </div>
              <div className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)] p-4">
                <dt className="text-xs font-medium text-[color:var(--color-text-secondary)] uppercase tracking-wide">閲覧数</dt>
                <dd className="mt-2 text-2xl font-semibold text-[color:var(--color-text-primary)]">{summary.totalViews.toLocaleString()}</dd>
              </div>
              <div className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)] p-4">
                <dt className="text-xs font-medium text-[color:var(--color-text-secondary)] uppercase tracking-wide">いいね</dt>
                <dd className="mt-2 text-2xl font-semibold text-[color:var(--color-text-primary)]">{summary.totalLikes.toLocaleString()}</dd>
              </div>
              <div className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)] p-4">
                <dt className="text-xs font-medium text-[color:var(--color-text-secondary)] uppercase tracking-wide">エンゲージメント率</dt>
                <dd className="mt-2 text-2xl font-semibold text-[color:var(--color-text-primary)]">{summary.engagementRate}%</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      {/* 日別メトリクス */}
      <div className="ui-card">
        <h2 className="text-lg font-semibold text-[color:var(--color-text-primary)]">インプレッション & フォロワー推移</h2>
        <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">日別のパフォーマンス</p>
        <div className="mt-4 overflow-x-auto rounded-[var(--radius-md)] border border-[color:var(--color-border)]">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="border-b border-[color:var(--color-border)] text-left text-xs uppercase tracking-wide text-[color:var(--color-text-secondary)]">
                <th className="px-3 py-2">日付</th>
                <th className="px-3 py-2 text-right">フォロワー</th>
                <th className="px-3 py-2 text-right">増減</th>
                <th className="px-3 py-2 text-right">投稿</th>
                <th className="px-3 py-2 text-right">閲覧数</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--color-border)]">
              {DUMMY_THREADS_DAILY.slice().reverse().map((m) => (
                <tr key={m.date} className="hover:bg-[color:var(--color-surface-muted)]">
                  <td className="px-3 py-2 font-medium text-[color:var(--color-text-primary)]">{m.date}</td>
                  <td className="px-3 py-2 text-right text-[color:var(--color-text-primary)]">{m.followers_count.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right">
                    <span className={m.follower_delta > 0 ? 'text-green-600' : m.follower_delta < 0 ? 'text-red-600' : 'text-[color:var(--color-text-secondary)]'}>
                      {m.follower_delta > 0 ? `+${m.follower_delta}` : m.follower_delta || '0'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right text-[color:var(--color-text-secondary)]">{m.post_count}</td>
                  <td className="px-3 py-2 text-right text-[color:var(--color-text-primary)]">{m.total_views.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-6 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={[...DUMMY_THREADS_DAILY].reverse()} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#475569' }} tickFormatter={(v) => v ? String(v).slice(5) : ''} />
              <YAxis yAxisId="left" tick={{ fontSize: 12, fill: '#475569' }} tickFormatter={(v) => v != null ? v.toLocaleString() : ''} />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 12, fill: '#475569' }}
                domain={[
                  (dataMin: number) => Math.floor(dataMin * 0.99),
                  (dataMax: number) => Math.ceil(dataMax * 1.01)
                ]}
              />
              <Tooltip formatter={(value: number | null, name: string) => [value != null ? value.toLocaleString() : '-', name]} />
              <Legend />
              <Bar yAxisId="left" dataKey="total_views" name="閲覧数" fill="#6366f1" opacity={0.7} />
              <Line yAxisId="right" type="monotone" dataKey="followers_count" name="フォロワー" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ============ 冒頭パターン分析 ============ */}
      <div className="space-y-4">
        <div className="ui-card">
          <div>
            <h2 className="text-lg font-semibold text-[color:var(--color-text-primary)]">
              冒頭パターン分析
            </h2>
            <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">
              投稿の1行目のパターン別パフォーマンス（{DUMMY_THREADS_POSTS.length}件）
            </p>
          </div>

          {patternData.stats.length > 0 && (
            <>
              {/* サマリーカード */}
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)] p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--color-text-secondary)]">
                    全体の平均閲覧数
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-[color:var(--color-text-primary)]">
                    {threadsFmtNum(patternData.overallAvgViews)}
                  </p>
                </div>
                <div className="rounded-[var(--radius-md)] border border-amber-200 bg-amber-50 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-amber-700">
                    最強の冒頭パターン
                  </p>
                  <p className="mt-2 text-xl font-semibold text-amber-900">
                    {topPattern.name}
                  </p>
                  <p className="mt-1 text-sm text-amber-700">
                    平均 {threadsFmtNum(topPattern.avgViews)} views（{topPattern.count}件）
                  </p>
                </div>
              </div>

              {/* パターン別バー */}
              <div className="mt-6">
                <h3 className="mb-3 text-sm font-medium text-[color:var(--color-text-primary)]">
                  パターン別パフォーマンス
                </h3>
                <div className="space-y-3">
                  {allPatternStats.map((stat, index) => {
                    const isTop = index === 0;
                    const isOther = stat.name === 'その他';
                    const widthPercent = maxBarValue > 0 ? (stat.avgViews / maxBarValue) * 100 : 0;

                    return (
                      <div key={stat.name}>
                        <div className="flex items-center gap-3">
                          <span className={`w-28 shrink-0 text-xs ${
                            isTop ? 'font-semibold text-amber-700' :
                            isOther ? 'text-[color:var(--color-text-muted)]' :
                            'text-[color:var(--color-text-secondary)]'
                          }`}>
                            {stat.name}
                          </span>
                          <div className="flex-1">
                            <div className="h-5 overflow-hidden rounded bg-gray-100">
                              <div
                                className={`h-full transition-all ${
                                  isTop ? 'bg-amber-500' : isOther ? 'bg-gray-300' : 'bg-indigo-500'
                                }`}
                                style={{ width: `${Math.min(widthPercent, 100)}%` }}
                              />
                            </div>
                          </div>
                          <span className="w-16 text-right text-xs font-medium text-[color:var(--color-text-primary)]">
                            {threadsFmtNum(stat.avgViews)}
                          </span>
                          <span className="w-12 text-right text-[10px] text-[color:var(--color-text-muted)]">
                            ({stat.count}件)
                          </span>
                        </div>
                        {stat.examples.length > 0 && (isTop || isOther) && (
                          <div className="ml-28 mt-1 space-y-0.5 pl-3">
                            {stat.examples.slice(0, isOther ? 2 : 1).map((ex, i) => (
                              <p key={i} className="text-[10px] text-[color:var(--color-text-muted)]">
                                例: {ex.text}...
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* インサイト */}
              {topPattern && patternData.overallAvgViews > 0 && (
                <div className="mt-6 rounded-[var(--radius-md)] border border-indigo-200 bg-indigo-50 p-4">
                  <p className="text-xs font-medium text-indigo-700">分析インサイト</p>
                  <p className="mt-1 text-sm text-indigo-900">
                    「{topPattern.name}」パターンが最も効果的（全体平均の
                    {Math.round((topPattern.avgViews / patternData.overallAvgViews) * 100)}%）。
                    このパターンを意識した冒頭を増やすと効果的です。
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* ============ 曜日・時間帯別パフォーマンス ============ */}
        <div className="ui-card">
          <div>
            <h2 className="text-lg font-semibold text-[color:var(--color-text-primary)]">
              曜日・時間帯別パフォーマンス
            </h2>
            <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">
              投稿時間ごとの平均閲覧数をヒートマップで表示します
            </p>
          </div>

          {/* サマリーカード */}
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)] p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--color-text-secondary)]">
                最も効果的な曜日
              </p>
              <p className="mt-2 text-2xl font-semibold text-[color:var(--color-text-primary)]">
                {THREADS_DAYS_OF_WEEK[bestDay.dayIndex]}曜日
              </p>
              <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">
                平均 {threadsFmtNum(bestDay.avgViews)} views / {bestDay.postCount}投稿
              </p>
            </div>
            <div className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)] p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--color-text-secondary)]">
                最も効果的な時間帯
              </p>
              <p className="mt-2 text-2xl font-semibold text-[color:var(--color-text-primary)]">
                {bestHours.length > 0 ? `${bestHours[0].hour}時台` : '-'}
              </p>
              <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">
                {bestHours.length > 0
                  ? `平均 ${threadsFmtNum(bestHours[0].avgViews)} views`
                  : 'データなし'}
              </p>
            </div>
          </div>

          {/* ヒートマップ */}
          <div className="mt-6">
            <h3 className="mb-3 text-sm font-medium text-[color:var(--color-text-primary)]">
              時間帯 × 曜日 ヒートマップ
            </h3>
            <div className="overflow-x-auto">
              <div className="min-w-[600px]">
                {/* 時間帯ヘッダー */}
                <div className="flex">
                  <div className="w-10 shrink-0" />
                  {THREADS_HOURS.filter(h => h % 3 === 0).map(hour => (
                    <div
                      key={hour}
                      className="flex-1 text-center text-[10px] text-[color:var(--color-text-secondary)]"
                      style={{ minWidth: '24px' }}
                    >
                      {hour}
                    </div>
                  ))}
                </div>

                {/* 曜日ごとの行 */}
                {THREADS_DAYS_OF_WEEK.map((day, dayIndex) => (
                  <div key={day} className="flex items-center">
                    <div className="w-10 shrink-0 text-xs text-[color:var(--color-text-secondary)]">
                      {day}
                    </div>
                    <div className="flex flex-1 gap-[2px]">
                      {THREADS_HOURS.map(hour => {
                        const cell = timeData.heatmapData.find(
                          c => c.dayIndex === dayIndex && c.hour === hour
                        );
                        return (
                          <div
                            key={hour}
                            className={`h-6 flex-1 rounded-sm transition-colors ${threadsGetHeatColor(cell?.avgViews ?? 0, timeData.maxAvgViews)}`}
                            title={`${day}曜 ${hour}時: ${cell?.postCount ?? 0}投稿, 平均${threadsFmtNum(cell?.avgViews ?? 0)}views`}
                          />
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* 凡例 */}
                <div className="mt-3 flex items-center justify-end gap-2 text-[10px] text-[color:var(--color-text-secondary)]">
                  <span>低</span>
                  <div className="flex gap-[2px]">
                    <div className="h-3 w-3 rounded-sm bg-gray-100" />
                    <div className="h-3 w-3 rounded-sm bg-indigo-200" />
                    <div className="h-3 w-3 rounded-sm bg-indigo-300" />
                    <div className="h-3 w-3 rounded-sm bg-indigo-400" />
                    <div className="h-3 w-3 rounded-sm bg-indigo-500" />
                    <div className="h-3 w-3 rounded-sm bg-indigo-600" />
                  </div>
                  <span>高</span>
                </div>
              </div>
            </div>
          </div>

          {/* 曜日別バーチャート */}
          <div className="mt-6">
            <h3 className="mb-3 text-sm font-medium text-[color:var(--color-text-primary)]">
              曜日別 平均閲覧数
            </h3>
            <div className="space-y-2">
              {timeData.dayStats.map(stat => {
                const maxDayAvg = Math.max(...timeData.dayStats.map(s => s.avgViews));
                const widthPercent = maxDayAvg > 0 ? (stat.avgViews / maxDayAvg) * 100 : 0;
                return (
                  <div key={stat.dayIndex} className="flex items-center gap-3">
                    <span className="w-6 text-xs text-[color:var(--color-text-secondary)]">
                      {THREADS_DAYS_OF_WEEK[stat.dayIndex]}
                    </span>
                    <div className="flex-1">
                      <div className="h-5 overflow-hidden rounded bg-gray-100">
                        <div
                          className="h-full bg-indigo-500 transition-all"
                          style={{ width: `${widthPercent}%` }}
                        />
                      </div>
                    </div>
                    <span className="w-16 text-right text-xs text-[color:var(--color-text-secondary)]">
                      {threadsFmtNum(stat.avgViews)}
                    </span>
                    <span className="w-12 text-right text-[10px] text-[color:var(--color-text-muted)]">
                      ({stat.postCount}件)
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* トップコンテンツ */}
      <div className="ui-card">
        <header className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[color:var(--color-text-primary)]">トップコンテンツ</h2>
            <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">反応が高かった投稿 ({displayedPosts.length}/{sortedPosts.length}件)</p>
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'date' | 'views' | 'likes')}
            className="h-9 w-40 rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-white px-3 text-sm text-[color:var(--color-text-secondary)]"
          >
            <option value="views">閲覧数</option>
            <option value="likes">いいね数</option>
            <option value="date">投稿日</option>
          </select>
        </header>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {displayedPosts.map((post, idx) => {
            const isExpanded = expandedPosts.has(post.id);
            const { transitions, overallRate } = getTransitionRates(post);
            const isTop10 = idx < 10;
            const rank = idx + 1;

            return (
              <div
                key={post.id}
                className={`rounded-[var(--radius-md)] border bg-white p-3 shadow-[var(--shadow-soft)] cursor-pointer ${
                  isTop10 ? 'border-amber-300 bg-amber-50/30' : 'border-[color:var(--color-border)]'
                }`}
                onClick={() => toggleExpand(post.id)}
              >
                <div className="flex items-center justify-between text-xs text-[color:var(--color-text-muted)]">
                  <div className="flex items-center gap-2">
                    {isTop10 && (
                      <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${
                        rank === 1 ? 'bg-yellow-400 text-yellow-900' :
                        rank === 2 ? 'bg-gray-300 text-gray-700' :
                        rank === 3 ? 'bg-amber-600 text-white' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {rank}
                      </span>
                    )}
                    <span>{new Date(post.timestamp).toLocaleDateString('ja-JP')}</span>
                    {post.comments.length > 0 && (
                      <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-700">
                        コメント欄{post.comments.length}つ
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span>閲覧 {post.views.toLocaleString()}</span>
                    <span>いいね {post.likes.toLocaleString()}</span>
                  </div>
                </div>

                {transitions.length > 0 && (
                  <div className="mt-2 rounded-md bg-gradient-to-r from-purple-50 to-indigo-50 p-2 border border-purple-100">
                    <div className="flex items-center gap-1 flex-wrap text-[10px]">
                      <div className="flex flex-col items-center">
                        <span className="text-gray-500">メイン</span>
                        <span className="font-bold text-gray-700">{post.views.toLocaleString()}</span>
                      </div>
                      {transitions.map((t, tIdx) => {
                        const isFirst = tIdx === 0;
                        const colorClass = isFirst
                          ? t.rate >= 10 ? 'text-green-600' : 'text-red-500'
                          : t.rate >= 80 ? 'text-green-600' : t.rate >= 50 ? 'text-yellow-600' : 'text-red-500';
                        return (
                          <div key={tIdx} className="flex items-center gap-1">
                            <div className="flex flex-col items-center px-1">
                              <span className="text-gray-400">→</span>
                              <span className={`font-bold ${colorClass}`}>{t.rate.toFixed(1)}%</span>
                            </div>
                            <div className="flex flex-col items-center">
                              <span className="text-gray-500">{t.to}</span>
                              <span className="font-bold text-gray-700">{t.views.toLocaleString()}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {overallRate !== null && transitions.length > 1 && (
                      <div className="mt-1 pt-1 border-t border-purple-200 flex items-center gap-1 text-[10px]">
                        <span className="text-gray-500">全体遷移率:</span>
                        <span className={`font-bold ${overallRate >= 1 ? 'text-blue-600' : 'text-gray-500'}`}>{overallRate.toFixed(2)}%</span>
                      </div>
                    )}
                  </div>
                )}

                <p className="mt-2 text-sm text-[color:var(--color-text-primary)] whitespace-pre-wrap">
                  {isExpanded ? post.text : (post.text.length > 80 ? post.text.slice(0, 80) + '...' : post.text)}
                </p>

                {isExpanded && post.comments.length > 0 && (
                  <div className="mt-3 space-y-2 border-t border-gray-200 pt-3">
                    <p className="text-xs font-medium text-gray-500">コメント欄</p>
                    {[...post.comments]
                      .sort((a, b) => a.depth - b.depth)
                      .map((comment, cidx) => (
                      <div
                        key={comment.id}
                        className="rounded-md bg-gray-50 p-2 text-xs"
                      >
                        <div className="flex items-center gap-2 text-[10px] text-gray-400 mb-1">
                          <span className="font-medium text-purple-600">コメント{cidx + 1}</span>
                          <span>閲覧 {comment.views.toLocaleString()}</span>
                        </div>
                        <p className="text-gray-700 whitespace-pre-wrap">{comment.text}</p>
                      </div>
                    ))}
                  </div>
                )}

                {post.permalink && (
                  <a
                    href={post.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="mt-2 text-xs text-[color:var(--color-accent)] hover:underline inline-block"
                  >
                    Threadsで見る →
                  </a>
                )}
              </div>
            );
          })}
        </div>
        {hasMorePosts && (
          <div className="mt-4 flex justify-center">
            <button
              onClick={() => setShowAllPosts(!showAllPosts)}
              className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-white px-6 py-2 text-sm font-medium text-[color:var(--color-text-secondary)] transition-colors hover:bg-[color:var(--color-surface-muted)]"
            >
              {showAllPosts ? '閉じる' : `続きを見る (残り${sortedPosts.length - INITIAL_DISPLAY_COUNT}件)`}
            </button>
          </div>
        )}
      </div>
      </>)}

      {threadsTab === 'schedule' && (
        <DemoScheduleTab />
      )}
    </div>
  );
}

// ============ デモ予約投稿タブ（実際のUIと完全に同じ） ============
function DemoScheduleTab() {
  const [selectedDate, setSelectedDate] = useState<string>('2026-03-10');
  const [selectedItem, setSelectedItem] = useState<typeof DEMO_SCHEDULED_POSTS[0] | null>(DEMO_SCHEDULED_POSTS[0]);
  const [listFilter, setListFilter] = useState<'all' | 'scheduled' | 'posted'>('scheduled');

  const year = 2026;
  const month = 2; // 0-indexed: March
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = new Date(year, month, 1).getDay();
  const dayLabels = ['日', '月', '火', '水', '木', '金', '土'];

  const countsByDate = DEMO_SCHEDULED_POSTS.reduce<Record<string, number>>((acc, item) => {
    acc[item.scheduledDate] = (acc[item.scheduledDate] ?? 0) + 1;
    return acc;
  }, {});

  const selectedItems = DEMO_SCHEDULED_POSTS
    .filter((item) => item.scheduledDate === selectedDate)
    .filter((item) => {
      if (listFilter === 'scheduled') return item.status === 'scheduled';
      if (listFilter === 'posted') return item.status === 'posted';
      return true;
    })
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));

  const getTimeLabel = (value: string) => {
    const timePart = value.split('T')[1] ?? '';
    return timePart.slice(0, 5);
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* 左: カレンダー + 予約一覧 */}
        <div className="space-y-4">
          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <header className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-gray-900">予約カレンダー</h2>
                <p className="mt-1 text-xs text-gray-500">2026年3月 / JST</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="rounded-lg border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  disabled
                  type="button"
                >
                  前月
                </button>
                <button
                  className="rounded-lg border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  disabled
                  type="button"
                >
                  次月
                </button>
              </div>
            </header>

            <div className="mt-4 grid grid-cols-7 gap-2 text-center text-xs text-gray-400">
              {dayLabels.map((label) => (
                <div key={label} className="font-medium">{label}</div>
              ))}
            </div>

            <div className="mt-2 grid grid-cols-7 gap-2">
              {Array.from({ length: startOffset }).map((_, index) => (
                <div key={`empty-${index}`} />
              ))}
              {Array.from({ length: daysInMonth }).map((_, index) => {
                const day = index + 1;
                const dateKey = `2026-03-${String(day).padStart(2, '0')}`;
                const count = countsByDate[dateKey] ?? 0;
                const isSelected = selectedDate === dateKey;

                return (
                  <button
                    key={dateKey}
                    type="button"
                    onClick={() => { setSelectedDate(dateKey); setSelectedItem(null); }}
                    className={[
                      'flex flex-col items-center gap-1 rounded-lg border px-2 py-2 text-sm transition',
                      isSelected
                        ? 'border-blue-500 bg-blue-50 text-gray-900'
                        : 'border-gray-200 bg-white text-gray-500 hover:border-blue-400',
                    ].join(' ')}
                  >
                    <span className="font-semibold">{day}</span>
                    <span
                      className={[
                        'text-[10px] font-medium',
                        count > 0
                          ? 'rounded-full bg-blue-100 px-2 py-0.5 text-blue-600'
                          : 'text-gray-400',
                      ].join(' ')}
                    >
                      {count > 0 ? String(count) : '0'}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <header className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">予約一覧</h3>
                <p className="mt-1 text-xs text-gray-500">{selectedDate} / JST</p>
              </div>
              <div className="flex items-center gap-1">
                {([
                  { key: 'all' as const, label: '一覧' },
                  { key: 'scheduled' as const, label: '予約済み' },
                  { key: 'posted' as const, label: '投稿完了' },
                ]).map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setListFilter(key)}
                    className={[
                      'rounded-full px-3 py-1 text-xs font-medium transition',
                      listFilter === key
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200',
                    ].join(' ')}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </header>

            {selectedItems.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center text-xs text-gray-400">
                予約がありません
              </div>
            ) : (
              <div className="space-y-3">
                {selectedItems.map((item) => (
                  <div
                    key={item.scheduleId}
                    className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white px-3 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => setSelectedItem(item)}
                    title="クリックで詳細表示"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-gray-900">
                        {getTimeLabel(item.scheduledAtJst)}
                        <span
                          className={[
                            'ml-2 rounded-full px-2 py-0.5 text-[11px] font-medium',
                            item.status === 'draft' ? 'bg-amber-50 text-amber-700' : '',
                            item.status === 'scheduled' ? 'bg-blue-50 text-blue-700' : '',
                            item.status === 'posted' ? 'bg-green-50 text-green-700' : '',
                          ].join(' ')}
                        >
                          {item.status === 'draft' && '下書き'}
                          {item.status === 'scheduled' && '予約済み'}
                          {item.status === 'posted' && '投稿完了'}
                        </span>
                      </div>
                      {(item.status === 'draft' || item.status === 'scheduled') && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="rounded-lg border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                            onClick={(e) => { e.stopPropagation(); setSelectedItem(item); }}
                          >
                            編集
                          </button>
                          <button
                            type="button"
                            className="rounded-lg border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                            onClick={(e) => e.stopPropagation()}
                          >
                            削除
                          </button>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 line-clamp-2">
                      {item.mainText}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* 右: エディタ */}
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm h-fit">
          <header className="mb-4">
            <h2 className="text-base font-semibold text-gray-900">予約エディタ</h2>
            <p className="mt-1 text-xs text-gray-500">
              {selectedItem ? '選択中の予約を編集' : '新規予約を作成'}
            </p>
          </header>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs font-medium text-gray-500">
                予約日時（JST）
                <input
                  type="datetime-local"
                  value={selectedItem ? `${selectedItem.scheduledDate}T${getTimeLabel(selectedItem.scheduledAtJst)}` : `${selectedDate}T09:00`}
                  readOnly
                  className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                />
              </label>
              <div className="flex flex-col">
                <span className="text-xs font-medium text-gray-500">即時投稿</span>
                <button
                  type="button"
                  className="mt-2 h-[42px] rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                  disabled
                >
                  今すぐ投稿
                </button>
              </div>
            </div>

            <label className="block text-xs font-medium text-gray-500">
              メイン投稿（必須）
              <textarea
                value={selectedItem?.mainText ?? ''}
                readOnly
                rows={4}
                className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
              />
              <div className="mt-1 text-right text-[11px] text-gray-400">
                {(selectedItem?.mainText ?? '').length}/500
              </div>
            </label>

            <label className="block text-xs font-medium text-gray-500">
              コメント1（必須）
              <textarea
                value={selectedItem?.comment1 ?? ''}
                readOnly
                rows={9}
                className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
              />
              <div className="mt-1 text-right text-[11px] text-gray-400">
                {(selectedItem?.comment1 ?? '').length}/500
              </div>
            </label>

            <label className="block text-xs font-medium text-gray-500">
              コメント2（必須）
              <textarea
                value={selectedItem?.comment2 ?? ''}
                readOnly
                rows={9}
                className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
              />
              <div className="mt-1 text-right text-[11px] text-gray-400">
                {(selectedItem?.comment2 ?? '').length}/500
              </div>
            </label>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                disabled
              >
                下書き保存
              </button>
              <button
                type="button"
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                disabled
              >
                予約登録
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

// ============ LINE デモ（AutoStudio風） ============
type LineTab = 'main' | 'daily';

function LineDemo() {
  const [activeTab, setActiveTab] = useState<LineTab>('main');
  const [datePreset, setDatePreset] = useState<DatePreset>('7d');

  const tabItems: { value: LineTab; label: string }[] = [
    { value: 'main', label: 'メイン' },
    { value: 'daily', label: 'デイリー' },
  ];

  // 日別データの集計
  const dailyStats = useMemo(() => {
    const totalMessages = DUMMY_LINE_DAILY.reduce((sum, d) => sum + d.messages_sent, 0);
    const totalOpen = DUMMY_LINE_DAILY.filter(d => d.open_count > 0).reduce((sum, d) => sum + d.open_count, 0);
    const totalClick = DUMMY_LINE_DAILY.filter(d => d.click_count > 0).reduce((sum, d) => sum + d.click_count, 0);
    const daysWithMessages = DUMMY_LINE_DAILY.filter(d => d.messages_sent > 0).length;
    const avgOpenRate = daysWithMessages > 0 ? ((totalOpen / (DUMMY_LINE_SUMMARY.totalFriends * daysWithMessages)) * 100).toFixed(1) : '0.0';
    const avgCtr = totalOpen > 0 ? ((totalClick / totalOpen) * 100).toFixed(1) : '0.0';
    return { totalMessages, totalOpen, totalClick, avgOpenRate, avgCtr };
  }, []);

  return (
    <div className="section-stack pb-20 lg:pb-6">
      {/* ヘッダー: タブ + 日付選択 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {tabItems.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`h-9 rounded-[var(--radius-sm)] px-3 text-sm font-medium transition-colors ${
                activeTab === tab.value
                  ? 'bg-[color:var(--color-text-primary)] text-white'
                  : 'border border-[color:var(--color-border)] bg-white text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-surface-muted)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <select
          value={datePreset}
          onChange={(e) => setDatePreset(e.target.value as DatePreset)}
          className="h-9 rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-white px-3 text-sm text-[color:var(--color-text-secondary)]"
        >
          {datePresetOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* メインタブ */}
      {activeTab === 'main' && (
        <>
          {/* アカウントの概要（KPIカード） */}
          <div className="ui-card">
            <header>
              <h2 className="text-lg font-semibold text-[color:var(--color-text-primary)]">アカウントの概要</h2>
              <p className="mt-1 text-xs text-[color:var(--color-text-secondary)]">LINE公式アカウントの指標</p>
            </header>
            <dl className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)] p-5">
                <dt className="text-xs font-medium text-[color:var(--color-text-secondary)] uppercase tracking-wide">友だち登録数</dt>
                <dd className="mt-4 text-[2rem] font-semibold leading-none text-[color:var(--color-text-primary)]">{DUMMY_LINE_SUMMARY.totalFriends.toLocaleString()}</dd>
                <p className="mt-2 text-xs text-green-600">+{DUMMY_LINE_SUMMARY.friendsGrowth7d} (7日間)</p>
              </div>
              <div className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)] p-5">
                <dt className="text-xs font-medium text-[color:var(--color-text-secondary)] uppercase tracking-wide">アンケート回答数</dt>
                <dd className="mt-4 text-[2rem] font-semibold leading-none text-[color:var(--color-text-primary)]">{DUMMY_LINE_SUMMARY.surveyResponses.toLocaleString()}</dd>
                <p className="mt-2 text-xs text-[color:var(--color-text-muted)]">累計回答者数</p>
              </div>
              <div className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)] p-5">
                <dt className="text-xs font-medium text-[color:var(--color-text-secondary)] uppercase tracking-wide">アンケート回答率</dt>
                <dd className="mt-4 text-[2rem] font-semibold leading-none text-[color:var(--color-text-primary)]">{DUMMY_LINE_SUMMARY.surveyRate}%</dd>
                <p className="mt-2 text-xs text-[color:var(--color-text-muted)]">回答数 / 登録数</p>
              </div>
            </dl>
          </div>

          {/* デイリーデータ & 流入分析 */}
          <div className="ui-card">
            <div className="grid lg:grid-cols-2 gap-6">
              {/* 左側：デイリーデータ */}
              <div>
                <h2 className="text-lg font-semibold text-[color:var(--color-text-primary)]">デイリーデータ</h2>
                <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">日別のLINE指標</p>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[color:var(--color-border)]">
                        <th className="text-left py-2 px-2 text-[color:var(--color-text-secondary)] font-medium">日付</th>
                        <th className="text-right py-2 px-2 text-[color:var(--color-text-secondary)] font-medium">登録数</th>
                        <th className="text-right py-2 px-2 text-[color:var(--color-text-secondary)] font-medium">回答数</th>
                        <th className="text-right py-2 px-2 text-[color:var(--color-text-secondary)] font-medium">回答率</th>
                      </tr>
                    </thead>
                    <tbody>
                      {DUMMY_LINE_DAILY.slice().reverse().map((day) => (
                        <tr key={day.date} className="border-b border-[color:var(--color-border)] last:border-0">
                          <td className="py-2 px-2 text-[color:var(--color-text-primary)]">{day.date.slice(5)}</td>
                          <td className="py-2 px-2 text-right text-[color:var(--color-text-primary)]">+{day.growth}</td>
                          <td className="py-2 px-2 text-right text-[color:var(--color-text-primary)]">{day.survey}</td>
                          <td className="py-2 px-2 text-right text-[color:var(--color-text-primary)]">{day.surveyRate}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              {/* 右側：流入分析 */}
              <div>
                <h2 className="text-lg font-semibold text-[color:var(--color-text-primary)]">流入分析</h2>
                <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">友だち登録の流入元</p>
                <div className="mt-4 h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={DUMMY_LINE_SOURCES}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        dataKey="count"
                        nameKey="name"
                      >
                        {DUMMY_LINE_SOURCES.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => [value.toLocaleString(), '登録数']} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2 space-y-2">
                  {DUMMY_LINE_SOURCES.map((source, idx) => (
                    <div key={source.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} />
                        <span className="text-[color:var(--color-text-primary)]">{source.name}</span>
                      </div>
                      <span className="text-[color:var(--color-text-secondary)]">{source.percentage}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 属性分析 */}
          <div className="ui-card">
            <h2 className="text-lg font-semibold text-[color:var(--color-text-primary)]">属性分析</h2>
            <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">友だちの属性情報</p>
            <div className="mt-6 grid md:grid-cols-3 gap-6">
              {/* 性別 */}
              <div className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] p-4">
                <h3 className="text-sm font-medium text-[color:var(--color-text-secondary)] mb-4">性別</h3>
                <div className="space-y-3">
                  {DUMMY_LINE_DEMOGRAPHICS.gender.map((item) => (
                    <div key={item.name}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-[color:var(--color-text-primary)]">{item.name}</span>
                        <span className="font-medium text-[color:var(--color-text-primary)]">{item.value}%</span>
                      </div>
                      <div className="h-2 bg-[color:var(--color-surface-muted)] rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${item.value}%`, backgroundColor: item.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {/* 年代 */}
              <div className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] p-4">
                <h3 className="text-sm font-medium text-[color:var(--color-text-secondary)] mb-4">年代</h3>
                <div className="space-y-3">
                  {DUMMY_LINE_DEMOGRAPHICS.age.map((item) => (
                    <div key={item.name}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-[color:var(--color-text-primary)]">{item.name}</span>
                        <span className="font-medium text-[color:var(--color-text-primary)]">{item.value}%</span>
                      </div>
                      <div className="h-2 bg-[color:var(--color-surface-muted)] rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${item.value}%`, backgroundColor: item.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {/* 都道府県 */}
              <div className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] p-4">
                <h3 className="text-sm font-medium text-[color:var(--color-text-secondary)] mb-4">都道府県</h3>
                <div className="space-y-3">
                  {DUMMY_LINE_DEMOGRAPHICS.prefecture.map((item, idx) => (
                    <div key={item.name}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-[color:var(--color-text-primary)]">{item.name}</span>
                        <span className="font-medium text-[color:var(--color-text-primary)]">{item.value}%</span>
                      </div>
                      <div className="h-2 bg-[color:var(--color-surface-muted)] rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-[#06C755]" style={{ width: `${item.value}%`, opacity: 1 - idx * 0.15 }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* デイリータブ */}
      {activeTab === 'daily' && (
        <>
          <div className="ui-card p-6">
            <h2 className="text-lg font-semibold text-[color:var(--color-text-primary)] mb-4">配信パフォーマンス</h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={DUMMY_LINE_DAILY.filter(d => d.messages_sent > 0)} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#475569' }} tickFormatter={(v) => v.slice(5)} />
                  <YAxis tick={{ fontSize: 12, fill: '#475569' }} tickFormatter={(v) => v.toLocaleString()} />
                  <Tooltip formatter={(value: number, name: string) => [value.toLocaleString(), name]} />
                  <Legend />
                  <Bar dataKey="open_count" name="開封数" fill="#06C755" />
                  <Bar dataKey="click_count" name="クリック数" fill="#3B82F6" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="ui-card p-6">
            <h2 className="text-lg font-semibold text-[color:var(--color-text-primary)] mb-4">デイリーデータ</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[color:var(--color-border)] text-left">
                    <th className="px-3 py-3 font-semibold text-[color:var(--color-text-primary)]">日付</th>
                    <th className="px-3 py-3 font-semibold text-[color:var(--color-text-primary)] text-right">友だち数</th>
                    <th className="px-3 py-3 font-semibold text-[color:var(--color-text-primary)] text-right">増加</th>
                    <th className="px-3 py-3 font-semibold text-[color:var(--color-text-primary)] text-right">ブロック</th>
                    <th className="px-3 py-3 font-semibold text-[color:var(--color-text-primary)] text-right">配信数</th>
                    <th className="px-3 py-3 font-semibold text-[color:var(--color-text-primary)] text-right">開封数</th>
                    <th className="px-3 py-3 font-semibold text-[color:var(--color-text-primary)] text-right">クリック数</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--color-border)]">
                  {DUMMY_LINE_DAILY.map((row) => (
                    <tr key={row.date} className="hover:bg-[color:var(--color-surface-muted)]">
                      <td className="px-3 py-3 text-[color:var(--color-text-primary)]">{row.date}</td>
                      <td className="px-3 py-3 text-[color:var(--color-text-primary)] text-right">{row.friends.toLocaleString()}</td>
                      <td className="px-3 py-3 text-right"><span className="text-green-600">+{row.growth}</span></td>
                      <td className="px-3 py-3 text-[color:var(--color-text-secondary)] text-right">{row.blocked}</td>
                      <td className="px-3 py-3 text-[color:var(--color-text-secondary)] text-right">{row.messages_sent}</td>
                      <td className="px-3 py-3 text-[color:var(--color-text-primary)] text-right">{row.open_count > 0 ? row.open_count.toLocaleString() : '-'}</td>
                      <td className="px-3 py-3 text-[color:var(--color-text-primary)] text-right">{row.click_count > 0 ? row.click_count.toLocaleString() : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ============ エクスポート（Suspenseでラップ） ============
export default function DemoPage() {
  return (
    <Suspense fallback={<LoadingScreen message="データ読み込み中" />}>
      <DemoPageContent />
    </Suspense>
  );
}
