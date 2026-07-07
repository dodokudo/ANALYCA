import type { Metadata } from 'next';
import RankingView from './ranking-view';
import { getGrandprixRankingData } from './data';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Threadsグランプリ夏 ランキング | ANALYCA',
  description: 'Threadsグランプリ夏の参加者ランキング速報。今日・昨日・月間の上位投稿とフォロワー増加数を確認できます。',
  openGraph: {
    title: 'Threadsグランプリ夏 ランキング',
    description: 'Threadsグランプリ夏の参加者ランキング速報。',
    url: 'https://analyca.jp/threads-grandprix/ranking',
    siteName: 'ANALYCA',
    locale: 'ja_JP',
    type: 'website',
  },
};

export default async function ThreadsGrandprixRankingPage() {
  const data = await getGrandprixRankingData();
  return <RankingView data={data} />;
}
