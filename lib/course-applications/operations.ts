import { randomUUID } from 'node:crypto';
import type { Application } from './domain';
import { readRecord, withLock, writeRecord } from '../receipts/store';

export const OPERATIONS_GROUP = 'Cb160f0867e222a36aaf0147e008280d9';
export const OPERATIONS_MANUAL = 'https://lkit.jp/course-operations/';
type Outbox = { retryKey: string; text: string; firstAttemptAt: string; acceptedAt?: string; requestId?: string };
export function contractPeriod(app: Application) {
  const days = app.plan === '特殊プラン' ? (app.contractAmount === 2_000_000 ? 365 : 180) : app.durationDays!;
  const end = new Date(`${app.paidDate}T00:00:00Z`);
  // The start date is day 1: 180 calendar days, inclusive of both endpoints.
  end.setUTCDate(end.getUTCDate() + days - 1);
  return { start: app.paidDate, end: end.toISOString().slice(0, 10), days };
}
export function operationsMessage(app: Application) {
  const yen = (n: number) => `${n.toLocaleString('ja-JP')}円`;
  const period = contractPeriod(app);
  const method = { bank: '銀行振込', card: 'カード決済', mixed: '銀行振込とカード決済の併用' }[app.method];
  return [
    '契約が発生しました', '',
    `契約者名／法人名：${app.name}`,
    ...(app.representative ? [`代表者名／役職：${app.representative}`] : []),
    `メールアドレス：${app.email}`, `住所：${app.address}`, `プラン：${app.plan}`,
    `契約総額（税込）：${yen(app.contractAmount)}`,
    `契約締結日・開始日：${period.start}`, `契約終了日：${period.end}`, `契約期間：${period.days}日`,
    `支払い方法：${method}`, `今回の支払額：${yen(app.paidAmount)}`,
    `銀行振込：${yen(app.bankAmount)}／カード決済：${yen(app.cardAmount)}`,
    ...(app.plan === '特殊プラン' ? [`初期費用：${yen(app.initialAmount)}`, `残りの成果報酬：${yen(app.successAmount)}`] : []),
    '', '■ まゆらさん',
    '上記の内容をもとに、業務委託契約書と秘密保持契約書をそれぞれ1通ずつ送ってください。',
    '', '■ ナオさん',
    'お客様専用のLINEグループを作成し、招待リンクをお客様へ送ってください。',
    `マニュアル：${OPERATIONS_MANUAL}`,
  ].join('\n');
}
export async function notifyOperations(app: Application): Promise<void> {
  // Test form submissions must never create real work for the operations team.
  if (app.sample) return;
  const token = process.env.COURSE_OPERATIONS_LINE_TOKEN;
  if (!token) throw new Error('Operations notifications not configured');
  await withLock(`course-operations-${app.id}`, async () => {
    const key = `course-operations/${app.id}.json`;
    let saved = await readRecord<Outbox>(key);
    if (saved?.value.acceptedAt) return;
    if (!saved) {
      await writeRecord(key, { retryKey: randomUUID(), text: operationsMessage(app), firstAttemptAt: new Date().toISOString() } satisfies Outbox);
      saved = await readRecord<Outbox>(key);
    }
    if (!saved) throw new Error('Operations outbox not persisted');
    // LINE deduplicates retry keys for 24 hours. Never resend ambiguous old attempts automatically.
    if (Date.now() - Date.parse(saved.value.firstAttemptAt) >= 23 * 3600_000) throw new Error('Operations delivery requires manual review');
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST', signal: AbortSignal.timeout(15_000),
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Line-Retry-Key': saved.value.retryKey },
      body: JSON.stringify({ to: OPERATIONS_GROUP, messages: [{ type: 'text', text: saved.value.text }] }),
    });
    const priorRequest = response.headers.get('x-line-accepted-request-id');
    if (!response.ok && !(response.status === 409 && priorRequest)) throw new Error(`Operations delivery failed (${response.status})`);
    await writeRecord(key, { ...saved.value, acceptedAt: new Date().toISOString(), requestId: priorRequest || response.headers.get('x-line-request-id') || undefined }, saved.generation);
  });
}
