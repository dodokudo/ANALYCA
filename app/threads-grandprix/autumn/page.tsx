import type { Metadata } from 'next';
import Image from 'next/image';
import EntryForm from '../entry-form';
import { GRANDPRIX_EVENTS, GRANDPRIX_LINE_GROUP_URL, isGrandprixEntryOpen } from '@/lib/threads-grandprix-events';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: '第2回 Threadsグランプリ 秋 | ANALYCA',
  description: '2026年10月20日〜11月19日。Threads×AIマスター講座の受講生と、みんなでThreadsを伸ばす秋のグランプリ。',
  openGraph: {
    title: '第2回 Threadsグランプリ 秋',
    description: '10月20日〜11月19日開催。秋のエントリーを受け付けています。',
    url: 'https://analyca.jp/threads-grandprix/autumn',
    images: [{ url: 'https://analyca.jp/threads-grandprix/autumn/visual-hero-v2.png' }],
  },
};

export default function AutumnGrandprixPage() {
  const event = GRANDPRIX_EVENTS.find((event) => event.eventId === '2026-autumn')!;
  const entryOpen = isGrandprixEntryOpen(event);
  const lineGroupUrl = GRANDPRIX_LINE_GROUP_URL;
  const form = (formId: string) => <section className="bg-[#fff5e8] px-5 py-6">
    <div className="rounded-3xl border border-orange-100 bg-white p-5 shadow-lg">
      <EntryForm formId={formId} eventId={event.eventId} entryOpen={entryOpen} lineGroupUrl={lineGroupUrl} />
    </div>
  </section>;
  return <main className="min-h-screen bg-[#31100e] text-gray-900">
    <div className="mx-auto w-full max-w-[520px] overflow-hidden bg-white shadow-2xl">
      <Image src="/threads-grandprix/autumn/visual-hero-v2.png" alt="第2回 Threadsグランプリ 秋 10月20日〜11月19日 受講生限定" width={1254} height={1254} priority sizes="(max-width: 520px) 100vw, 520px" className="block h-auto w-full" />
      {form('entry-form')}
      <section className="space-y-3 bg-[#fff5e8] px-6 pb-6 text-sm leading-relaxed">
        <p>秋にエントリーした未契約の方は、10月20日〜11月19日の開催期間中、Threads分析画面を無料でご利用いただけます。</p>
        <p>LINEグループは夏と共用です。既にグループに参加している方も、秋のエントリーをお願いします。秋に参加されない方は、グループからの退出をお願いします。</p>
      </section>
      <Image src="/threads-grandprix/autumn/benefits-v2.png" alt="参加するとできること" width={1024} height={1536} sizes="(max-width: 520px) 100vw, 520px" className="block h-auto w-full" />
      <Image src="/threads-grandprix/autumn/flow-v2.png" alt="LINE名とThreads IDを入力し、必要な方だけThreadsを接続。専用LINEグループへ" width={1024} height={1536} sizes="(max-width: 520px) 100vw, 520px" className="block h-auto w-full" />
      <Image src="/threads-grandprix/autumn/awards-v2.png" alt="最優秀賞・優秀賞。成果や取り組みを運営が総合評価" width={1024} height={1536} sizes="(max-width: 520px) 100vw, 520px" className="block h-auto w-full" />
      {form('entry-form-bottom')}
    </div>
  </main>;
}
