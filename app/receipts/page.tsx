import type { Metadata } from 'next';
import ReceiptForm from './receipt-form';
import './receipts.css';

export const metadata: Metadata = {
  title: '領収書の発行｜Threads×AIマスター講座',
  description: 'ご購入済みの講座の領収書を発行できます。PDFのダウンロードとメールでのお受け取りが可能です。',
  robots: { index: false, follow: false },
};
export default function ReceiptPage() {
  return <main className="receipt-page">
    <div className="receipt-brand">Threads×AIマスター講座<span>株式会社DoDo</span></div>
    <div className="receipt-layout">
      <header className="receipt-intro">
        <svg className="receipt-icon" width="64" height="72" viewBox="0 0 64 72" fill="none" aria-hidden="true"><path d="M12 4h28l12 12v51l-7-4-7 4-7-4-7 4-12-4V4Z" stroke="currentColor" strokeWidth="2"/><path d="M40 4v14h12M22 30h20M22 39h20M22 48h12" stroke="currentColor" strokeWidth="2"/></svg>
        <h1>領収書の発行</h1>
        <p>講座へのご参加ありがとうございます。<br/>必要事項を入力すると、その場で<br className="receipt-desktop-break"/>領収書をダウンロードできます。</p>
        <p>ご入力のメールアドレスにも<br className="receipt-desktop-break"/>PDFをお送りします。</p>
        <div className="receipt-note">銀行振込でお支払いの方には、<br/>保管用の請求書も一緒に発行します。</div>
      </header>
      <ReceiptForm />
    </div>
    <footer className="receipt-footer">お問い合わせは、ご参加時にご案内した公式LINEへご連絡ください。</footer>
  </main>;
}
