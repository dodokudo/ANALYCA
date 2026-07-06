import type { Metadata } from 'next';
import Image from 'next/image';
import EntryForm from './entry-form';

export const metadata: Metadata = {
  title: 'Threadsグランプリ 夏 | ANALYCA',
  description: 'Threads×AIマスター講座の受講生限定イベント。7月7日から7月31日まで、みんなでThreadsを伸ばすお祭り企画です。',
  openGraph: {
    title: 'Threadsグランプリ 夏',
    description: '7月7日から月末まで、受講生みんなでThreadsを伸ばすお祭り企画。',
    url: 'https://analyca.jp/threads-grandprix',
    siteName: 'ANALYCA',
    locale: 'ja_JP',
    type: 'website',
  },
};

export default function ThreadsGrandprixPage() {
  return (
    <main className="min-h-screen bg-[#f5f5f5] text-gray-900">
      <div className="mx-auto min-h-screen w-full max-w-[520px] overflow-hidden bg-[#f5f5f5] shadow-[0_0_60px_rgba(0,33,88,0.35)]">
        <Image
          src="/threads-grandprix/visual-hero.png"
          alt="Threadsグランプリ夏 みんなで伸ばす7月のお祭り企画"
          width={780}
          height={720}
          className="block h-auto w-full"
          priority
          sizes="(max-width: 520px) 100vw, 520px"
        />

        <section className="bg-[linear-gradient(180deg,#f9f2df_0%,#fdf7ed_45%,#f5f5f5_100%)] px-5 pb-6 pt-3">
          <div className="rounded-[24px] border border-white/80 bg-white/95 p-4 shadow-[0_18px_36px_rgba(0,38,98,0.25)] backdrop-blur">
            <EntryForm />
          </div>
        </section>

        <Image
          src="/threads-grandprix/benefits.png"
          alt="参加するとできること"
          width={1029}
          height={1528}
          className="block h-auto w-full"
          sizes="(max-width: 520px) 100vw, 520px"
        />

        <Image
          src="/threads-grandprix/flow.png"
          alt="申し込みの流れ"
          width={1030}
          height={1527}
          className="block h-auto w-full"
          sizes="(max-width: 520px) 100vw, 520px"
        />

        <Image
          src="/threads-grandprix/awards.png"
          alt="受賞について"
          width={1030}
          height={1527}
          className="block h-auto w-full"
          sizes="(max-width: 520px) 100vw, 520px"
        />

        <section className="bg-[linear-gradient(180deg,#f9f2df_0%,#fdf7ed_55%,#f5f5f5_100%)] px-5 pb-8 pt-4">
          <div className="rounded-[24px] border border-white/80 bg-white/95 p-4 shadow-[0_18px_36px_rgba(0,38,98,0.25)] backdrop-blur">
            <EntryForm formId="entry-form-bottom" />
          </div>
        </section>
      </div>
    </main>
  );
}
