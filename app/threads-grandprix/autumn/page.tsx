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
        <p>エントリー完了後は、まずLINEグループへ移動します。ダッシュボードをまだお持ちでない方だけに、ログインURLをメールでお送りします。</p>
        <p>LINEグループは夏と共用です。既にグループに参加している方も、秋のエントリーをお願いします。秋に参加されない方は、グループからの退出をお願いします。</p>
      </section>
      <Image src="/threads-grandprix/autumn/benefits-v2.png" alt="参加するとできること" width={1024} height={1536} sizes="(max-width: 520px) 100vw, 520px" className="block h-auto w-full" />
      <section aria-labelledby="entry-flow-title" className="bg-[#fff5e8] px-6 py-10">
        <p className="mb-2 text-center text-xs font-bold tracking-widest text-orange-700">エントリーしたら、次はこちら</p>
        <h2 id="entry-flow-title" className="mb-7 text-center text-2xl font-bold text-[#7a281a]">エントリー後の流れ</h2>
        <ol className="space-y-4">
          {[
            ['LINEグループに参加', 'エントリー完了後、LINEグループのページへ移動します。大会のアナウンスを受け取るため、まずグループに参加してください。'],
            ['届いたメールを確認', 'ダッシュボードをまだお持ちでない方に、ログイン案内メールをお送りします。申込時に入力したメールアドレスの受信箱を確認してください。'],
            ['メールのURLからThreadsにログイン', 'メール内の「Threadsにログインする」を押して、エントリーしたThreadsアカウントでログインし、連携を完了してください。'],
            ['ダッシュボードが生成され、集計準備が完了', 'ログイン・連携が完了すると、専用ダッシュボードが生成されます。専用システムでフォロワー数や閲覧数などを自動集計します。'],
          ].map(([title, description], index) => <li key={title} className="flex gap-3 rounded-2xl border border-orange-100 bg-white p-5 shadow-sm">
            <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#a73c20] text-sm font-bold text-white">{index + 1}</span>
            <div>
              <h3 className="mb-2 font-bold text-[#7a281a]">{title}</h3>
              <p className="text-sm leading-relaxed text-stone-700">{description}</p>
            </div>
          </li>)}
        </ol>
        <div className="mt-5 space-y-3 rounded-2xl bg-orange-100/60 p-5 text-sm leading-relaxed text-stone-700">
          <p><strong className="text-[#7a281a]">既にダッシュボードをお持ちの方へ</strong><br />ログイン案内メールは届きません。秋のエントリーを済ませ、LINEグループにご参加ください。</p>
          <p>メールが見当たらない場合は迷惑メールフォルダもご確認ください。ログインできない場合は、LINEグループの運営までお知らせください。</p>
        </div>
      </section>
      <Image src="/threads-grandprix/autumn/awards-v2.png" alt="最優秀賞・優秀賞。成果や取り組みを運営が総合評価" width={1024} height={1536} sizes="(max-width: 520px) 100vw, 520px" className="block h-auto w-full" />
      {form('entry-form-bottom')}
    </div>
  </main>;
}
