import { randomUUID } from 'node:crypto';
import type { Application } from './domain';
import { readRecord, withLock, writeRecord } from '../receipts/store';

export const OPERATIONS_GROUP = 'Cb160f0867e222a36aaf0147e008280d9';
export const OPERATIONS_MANUAL = 'https://lkit.jp/course-operations/';
export const CONTRACT_MANUAL = 'https://lkit.jp/gmo-sign-manual/';
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
    '【契約受付・対応依頼】', `${app.name}様の契約受付が完了しました。下記の対応をお願いします。`, '',
    '■ 秘書（新井まゆら）',
    '下記情報をもとに、業務委託契約書と秘密保持契約書をそれぞれ1通ずつ、計2通、GMOサインからお客様へ送ってください。',
    `業務委託契約書：${app.plan === '特殊プラン' ? '現金分割用（初期費用と残りの成果報酬を記入）' : '一括用'}`,
    '送信担当者：工藤', '送信後、お客様のサポートグループで、いつも通り送信した旨をご連絡ください。', `契約書の操作マニュアル：${CONTRACT_MANUAL}`, '',
    '■ Nao講師（ツール・LINE運用の担当講師）',
    'お客様専用のLINEサポートグループを作成し、招待リンクをエルメの1:1チャットでお客様へ送ってください。',
    'お客様の参加を確認したら、挨拶・メンバー紹介からそのままAI botのセットアップまで進め、案内とワークシートの到着を確認してください。契約締結の完了は待たず、秘書の契約対応と並行して進めてください。',
    `グループ作成から案内までのマニュアル：${OPERATIONS_MANUAL}`, '',
    '■ 契約書に記載する情報', `契約者名／法人名：${app.name}`,
    ...(app.representative ? [`代表者名／役職：${app.representative}`] : []),
    `メールアドレス：${app.email}`, `住所：${app.address}`, `プラン：${app.plan}`,
    `契約総額（税込）：${yen(app.contractAmount)}`,
    `契約締結日・開始日：${period.start}`, `契約終了日：${period.end}`, `契約期間：${period.days}日（開始日を1日目）`,
    `使用された支払い方法：${method}`, `今回の支払額：${yen(app.paidAmount)}`,
    `銀行振込：${yen(app.bankAmount)}／カード決済：${yen(app.cardAmount)}`,
    ...(app.plan === '特殊プラン' ? [`初期費用：${yen(app.initialAmount)}`, `残りの成果報酬：${yen(app.successAmount)}`] : []),
    '', '金額・支払日はフォーム回答に基づきます。',
    '領収書・銀行振込分の支払済み請求書はシステムが別途発行・送付します。秘書による重複発行は不要です。',
    `エルメ友だちID：${app.friendId}`, 'エルメ（くどう サポート用LINE）：https://step.lme.jp/basic/chat-v3',
    `受付番号：${app.id.slice(0, 12)}`,
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
