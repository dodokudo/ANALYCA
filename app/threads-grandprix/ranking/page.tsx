import type { Metadata } from 'next';
import RankingView from './ranking-view';
import { getGrandprixRankingData } from './data';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ date?: string; event?: string; me?: string }>;

export async function generateMetadata({ searchParams }: { searchParams?: SearchParams }): Promise<Metadata> {
  const params = await searchParams;
  const eventQuery = params?.event ? `?event=${encodeURIComponent(params.event)}` : '';

  return {
    title: 'Threadsグランプリ ランキング | ANALYCA',
    description: 'Threadsグランプリの参加者ランキング速報。昨日・大会累計の上位投稿とフォロワー増加数を確認できます。',
    openGraph: {
      title: 'Threadsグランプリ ランキング',
      description: 'Threadsグランプリの参加者ランキング速報。',
      url: 'https://analyca.jp/threads-grandprix/ranking',
      siteName: 'ANALYCA',
      locale: 'ja_JP',
      type: 'website',
      images: [
        {
          url: `https://analyca.jp/api/threads-grandprix/og${eventQuery}`,
          width: 1200,
          height: 630,
        },
      ],
    },
  };
}

export default async function ThreadsGrandprixRankingPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const params = await searchParams;
  const data = await getGrandprixRankingData(params?.date, params?.event, params?.me);
  return <RankingView data={data} />;
}
