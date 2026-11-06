export { metadata } from './layout';

export default function ReceiptNotFound() {
  return <main className="min-h-screen bg-slate-50 px-5 py-12 text-slate-800">
    <div className="mx-auto max-w-xl rounded-xl border border-slate-200 bg-white p-7 shadow-sm">
      <h1 className="text-2xl font-bold">ダウンロードリンクをご確認ください</h1>
      <p className="mt-4 leading-7">リンクが無効、または有効期限が切れています。最新のご案内から開き直してください。</p>
      <p className="mt-4 leading-7">開けない場合は、ご参加時にご案内した公式LINEへお問い合わせください。</p>
      <p className="mt-6 text-sm text-slate-500">株式会社DoDo</p>
    </div>
  </main>;
}
