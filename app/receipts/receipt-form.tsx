'use client';

import { useState, type FormEvent } from 'react';

type Result = { mail: string; email: string; documents: { kind: string; label: string; url: string; filename: string }[] };
export default function ReceiptForm() {
  const [method, setMethod] = useState<'bank' | 'card' | ''>('');
  const [paidDate, setPaidDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(new Date());
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/receipts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        name: form.get('name'), email: form.get('email'), paidDate: form.get('paidDate'), method,
      }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '発行を完了できませんでした。もう一度お試しください。');
      setResult(data);
    } catch (e) { setError(e instanceof Error ? e.message : '通信状況を確認して、もう一度お試しください。'); }
    finally { setBusy(false); }
  }
  if (result) return <section className="receipt-form receipt-complete" aria-live="polite">
    <div className="receipt-success-icon" aria-hidden="true">✓</div>
    <h2>{result.documents.length === 2 ? '領収書と請求書を発行しました' : '領収書を発行しました'}</h2>
    {result.mail === 'sent' ? <p><strong>{result.email}</strong> にお送りしました。<br/>この画面からもダウンロードできます。</p> : result.mail === 'pending' || result.mail === 'sending' ? <p>PDFをダウンロードできます。<br/><strong>{result.email}</strong> にも順次お送りします。<br/>この画面を閉じてもメールは届きます。</p> : <p>PDFをダウンロードできます。<br/>メールの送信はまだ確認できていません。届かない場合は、公式LINEへご連絡ください。</p>}
    <div className="receipt-downloads">{result.documents.map(doc => <a className={doc.kind === 'receipt' ? 'receipt-primary' : 'receipt-secondary'} href={doc.url} key={doc.kind} download={doc.filename}>{doc.label}をダウンロード <span aria-hidden="true">↓</span></a>)}</div>
    {result.documents.length === 2 && <p className="receipt-paid-note">請求書は保管用です。すでにお支払いいただいているため、追加のお支払いやお手続きは不要です。</p>}
    <p className="receipt-hint">ダウンロードリンクは1時間有効です。有効期限が切れた場合は、同じ内容でもう一度お手続きください。</p>
  </section>;
  return <form className="receipt-form" onSubmit={submit} aria-busy={busy}>
    <fieldset disabled={busy}>
      <legend className="receipt-form-title">領収書に記載する内容</legend>
      <label className="receipt-field">宛名 <span className="receipt-required">必須</span><input name="name" autoComplete="organization" maxLength={60} required placeholder="株式会社〇〇 ／ 山田 太郎"/><span className="receipt-hint">会社名またはお名前をご入力ください。「様」は自動で付けます。</span></label>
      <label className="receipt-field">メールアドレス <span className="receipt-required">必須</span><input name="email" type="email" autoComplete="email" maxLength={254} required placeholder="example@email.com"/><span className="receipt-hint">発行したPDFをこちらにお送りします。</span></label>
      <label className="receipt-field">お支払い日 <span className="receipt-required">必須</span><span className={`receipt-date ${paidDate ? '' : 'receipt-date-empty'}`}><input name="paidDate" type="date" min="2025-01-01" max={today} value={paidDate} onChange={event => setPaidDate(event.target.value)} onInput={event => setPaidDate(event.currentTarget.value)} required/>{!paidDate && <span className="receipt-date-placeholder" aria-hidden="true">お支払い日を選択</span>}</span></label>
      <fieldset className="receipt-methods"><legend>使用されたお支払い方法 <span className="receipt-required">必須</span></legend>
        <label className={`receipt-method ${method === 'bank' ? 'selected' : ''}`}><input type="radio" name="method" value="bank" checked={method === 'bank'} onChange={() => setMethod('bank')} required/><span><strong>銀行振込</strong><small>領収書＋請求書</small></span><b>100,000<span>円（税込）</span></b></label>
        <label className={`receipt-method ${method === 'card' ? 'selected' : ''}`}><input type="radio" name="method" value="card" checked={method === 'card'} onChange={() => setMethod('card')} required/><span><strong>カード決済</strong><small>領収書</small></span><b>110,000<span>円（税込）</span></b></label>
      </fieldset>
      <p className="receipt-hint receipt-before-submit">お支払い済みの内容で発行してください。発行前に宛名・メールアドレスをお確かめください。</p>
      {error && <p className="receipt-error" role="alert">{error}</p>}
      <button className="receipt-primary" type="submit" disabled={busy}>{busy && <span className="receipt-spinner" aria-hidden="true"/>}{busy ? '書類を発行しています…' : '領収書を発行する'}</button>
      <p className="receipt-submit-note" role="status">{busy ? '発行処理中です。そのままお待ちください。' : 'ダウンロードとメールでお受け取りいただけます。'}</p>
    </fieldset>
  </form>;
}
