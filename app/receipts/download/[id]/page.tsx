import { notFound } from 'next/navigation';
import { validDownloadToken, type Issue } from '@/lib/receipts/domain';
import { readRecord } from '@/lib/receipts/store';
import { publicResult } from '@/lib/receipts/service';
export const dynamic = 'force-dynamic';
export const metadata = { title: '領収書のダウンロード', robots: { index: false, follow: false }, referrer: 'no-referrer' };
export default async function DownloadPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ token?: string }> }) {
  const { id } = await params; const { token } = await searchParams;
  if (!/^[a-f0-9]{64}$/.test(id) || !validDownloadToken(id, token || '')) notFound();
  const record = await readRecord<Issue>(`issues/${id}.json`); if (!record) notFound();
  const result = publicResult(record.value);
  return <main className="min-h-screen bg-slate-50 px-5 py-12 text-slate-800"><div className="mx-auto max-w-xl rounded-xl border border-slate-200 bg-white p-7 shadow-sm">
    <h1 className="text-2xl font-bold">領収書のダウンロード</h1>
    <p className="mt-4 leading-7">ご参加ありがとうございます。下のボタンからPDFを保存できます。</p>
    {record.value.sample && <p className="mt-4 text-red-700">動作確認用の見本です。</p>}
    <div className="mt-7 flex flex-col gap-4">{result.documents.map(doc => <a key={doc.kind} href={doc.url} className="rounded-lg bg-slate-800 px-5 py-4 text-center font-semibold text-white">{doc.label}をダウンロード</a>)}</div>
    {record.value.method === 'bank' && <p className="mt-6 text-sm leading-6">請求書はお支払い済みの保管用です。追加のお支払いは不要です。{record.value.cardAmount ? '併用の場合、請求書には銀行振込分を記載しています。' : ''}</p>}
    <p className="mt-6 text-sm leading-6 text-slate-500">同じPDFをご入力のメールアドレスにもお送りします。<br />株式会社DoDo</p>
  </div></main>;
}
