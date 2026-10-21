import { createHmac, timingSafeEqual } from 'node:crypto';

export const COURSE_NAME = 'Threads×AIマスター講座';
export type PaymentMethod = 'bank' | 'card';
export type DocumentKind = 'receipt' | 'invoice';
export type ReceiptInput = { name: string; email: string; address: string; paidDate: string; method: PaymentMethod };
export type Issue = ReceiptInput & {
  id: string; issuedDate: string; createdAt: string; number: string; amount: number;
  documents: Partial<Record<DocumentKind, { path: string; filename: string; driveId?: string }>>;
  mail: 'pending' | 'sending' | 'sent' | 'failed' | 'uncertain';
  mailedAt?: string;
};
export class ReceiptError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}
export function jstDate(now = new Date()): string {
  return new Date(now.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
}
export function nextMonthToPrepare(now = new Date()): string | null {
  const today = jstDate(now);
  const tomorrow = jstDate(new Date(now.getTime() + 86400_000));
  const hour = (now.getUTCHours() + 9) % 24;
  return today.slice(0, 7) !== tomorrow.slice(0, 7) && hour >= 21 ? tomorrow.slice(0, 7) : null;
}
export function fiscalPeriod(month: string, startMonth: number, anchorYear: number, anchorPeriod: number): string {
  const [year, m] = month.split('-').map(Number);
  return `第${anchorPeriod + year - anchorYear - (m < startMonth ? 1 : 0)}期`;
}
export const amountFor = (method: PaymentMethod) => method === 'bank' ? 100_000 : 110_000;
export const kindsFor = (method: PaymentMethod): DocumentKind[] => method === 'bank' ? ['receipt', 'invoice'] : ['receipt'];
export const titleFor = (kind: DocumentKind) => kind === 'receipt' ? '領収書' : '請求書';
export const taxFor = (amount: number) => Math.floor(amount * 10 / 110);
export function validateInput(value: unknown, now = new Date()): ReceiptInput {
  if (!value || typeof value !== 'object') throw new ReceiptError('入力内容を確認してください。');
  const v = value as Record<string, unknown>;
  const str = (key: string, max: number, optional = false) => {
    const s = typeof v[key] === 'string' ? (v[key] as string).trim().normalize('NFC') : '';
    if ((!optional && !s) || s.length > max || /[\u0000-\u001f\u007f]/u.test(s)) throw new ReceiptError('入力内容の文字数や改行を確認してください。');
    return s;
  };
  const name = str('name', 60), email = str('email', 254).toLowerCase(), address = str('address', 140, true);
  if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,63}$/i.test(email)) throw new ReceiptError('メールアドレスを確認してください。');
  const paidDate = str('paidDate', 10);
  const date = new Date(`${paidDate}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(paidDate) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== paidDate || paidDate > jstDate(now) || paidDate < '2025-01-01') {
    throw new ReceiptError('実際のお支払い日を入力してください。未来の日付は指定できません。');
  }
  if (v.method !== 'bank' && v.method !== 'card') throw new ReceiptError('お支払い方法を選択してください。');
  return { name, email, address, paidDate, method: v.method };
}
export function receiptSecret(): string {
  const secret = process.env.RECEIPTS_SECRET;
  if (!secret || secret.length < 32) throw new ReceiptError('現在、発行の準備中です。時間をおいてお試しください。', 503);
  return secret;
}
export function hash(value: string): string { return createHmac('sha256', receiptSecret()).update(value).digest('hex'); }
export function issueId(input: ReceiptInput): string {
  return hash(`course-v1:${input.email}:${input.paidDate}:${input.method}`);
}
export function downloadToken(id: string, expires: number): string { return `${expires}.${hash(`download:${id}:${expires}`)}`; }
export function validDownloadToken(id: string, token: string): boolean {
  const [expiry, signature] = token.split('.');
  if (!/^\d+$/.test(expiry || '') || !/^[a-f0-9]{64}$/.test(signature || '') || Number(expiry) < Date.now()) return false;
  const expected = downloadToken(id, Number(expiry)).split('.')[1];
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
export function emailText(issue: Issue): string {
  const documents = issue.method === 'bank' ? '領収書と請求書' : '領収書';
  return `${issue.name} 様\n\nこのたびは、${COURSE_NAME}へのご参加ありがとうございます。\n\n${documents}をPDFで添付しておりますので、ご確認ください。\n${issue.method === 'bank' ? '\nなお、すでにお振り込みいただいておりますので、請求書は保管用としてお受け取りください。追加のお支払いやお手続きは不要です。\n' : ''}\n大切に保管していただけますと幸いです。\n\n株式会社DoDo\n${COURSE_NAME} 運営事務局`;
}
