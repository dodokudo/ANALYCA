import { timingSafeEqual } from 'node:crypto';
import { hash, ReceiptError, validateInput } from '../receipts/domain';

export const LME_ACCOUNT = 'ayMWXmQQrGQP';
export const COMPLETION_TAG = 2561289;
export const FORM_ID = 252821;
export const FIELDS = { plan: 354753, contractAmount: 354755, representative: 354757, initialAmount: 354759, successAmount: 354761, paidAmount: 354763, paidDate: 354765, method: 354767, cardAmount: 354769, bankAmount: 354771 };
export type Friend = { lmessage_friend_id: number; system_name?: string; email?: string; friend_info: { id: number; value: unknown }[] };
export type Application = {
  id: string; friendId: number; formId: number; createdAt: string;
  name: string; email: string; address: string; representative: string;
  plan: 'ノーマル' | 'スタンダード' | 'プレミアム' | '特別プラン'; durationDays: 180 | 365 | null;
  contractAmount: number; initialAmount: number; successAmount: number;
  paidAmount: number; paidDate: string; method: 'bank' | 'card' | 'mixed'; bankAmount: number; cardAmount: number;
  contractStatus: 'gmo_api_pending'; issueId?: string; lineNotifiedAt?: string; sample?: boolean;
};
export function validSignature(actual: string | null, secret = process.env.LME_WEBHOOK_SECRET): boolean {
  if (!secret || secret.length < 24 || !actual) return false;
  const a = Buffer.from(actual), b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}
export function completionFriends(body: unknown): number[] {
  if (!body || typeof body !== 'object' || !Array.isArray((body as { events?: unknown }).events)) throw new ReceiptError('Invalid events');
  const events = (body as { events: unknown[] }).events;
  if (events.length > 1000) throw new ReceiptError('Too many events');
  const ids = new Set<number>();
  for (const e of events) {
    if (!e || typeof e !== 'object') continue;
    const event = e as Record<string, unknown>;
    if (event.type !== 'tag' || event.action !== 'add' || event.tag_id !== COMPLETION_TAG) continue;
    if (!Number.isSafeInteger(event.lmessage_friend_id) || Number(event.lmessage_friend_id) <= 0) throw new ReceiptError('Invalid friend');
    ids.add(Number(event.lmessage_friend_id));
  }
  return [...ids];
}
export function parseApplication(friend: Friend, now = new Date()): Application {
  const fields = new Map(friend.friend_info.map(f => [f.id, f.value]));
  const str = (id: number) => String(fields.get(id) ?? '').trim().normalize('NFKC');
  const money = (id: number, zero = false) => {
    const raw = str(id).replaceAll(',', '');
    if (!/^\d{1,8}$/.test(raw)) throw new ReceiptError('金額を半角数字で入力してください。');
    const n = Number(raw);
    if (n < (zero ? 0 : 1) || n > 10_000_000) throw new ReceiptError('金額を確認してください。');
    return n;
  };
  const plans: Record<string, Application['plan']> = { '590313': 'ノーマル', '590315': 'スタンダード', '590317': 'プレミアム', '590319': '特別プラン' };
  const plan = plans[str(FIELDS.plan)] || str(FIELDS.plan);
  if (!['ノーマル', 'スタンダード', 'プレミアム', '特別プラン'].includes(plan)) throw new ReceiptError('プランを選択してください。');
  const methods: Record<string, Application['method']> = { '590321': 'card', '590323': 'bank', '590325': 'mixed', 'カード決済': 'card', '銀行振込': 'bank', 'カードと銀行振込の併用': 'mixed' };
  const method = methods[str(FIELDS.method)];
  if (!method) throw new ReceiptError('お支払い方法を選択してください。');
  const contractAmount = money(FIELDS.contractAmount), paidAmount = money(FIELDS.paidAmount);
  const bankAmount = method === 'mixed' ? money(FIELDS.bankAmount) : method === 'bank' ? paidAmount : 0;
  const cardAmount = method === 'mixed' ? money(FIELDS.cardAmount) : method === 'card' ? paidAmount : 0;
  if (bankAmount + cardAmount !== paidAmount || paidAmount > contractAmount) throw new ReceiptError('支払金額と内訳・契約金額が一致していません。');
  const initialAmount = plan === '特別プラン' ? money(FIELDS.initialAmount) : contractAmount;
  const successAmount = plan === '特別プラン' ? money(FIELDS.successAmount, true) : 0;
  if (initialAmount + successAmount !== contractAmount || paidAmount !== initialAmount) throw new ReceiptError('初期金額・成果報酬・今回の支払金額を確認してください。');
  const input = validateInput({ name: str(-1) || friend.system_name, email: str(-3) || friend.email, address: '', paidDate: str(FIELDS.paidDate).replaceAll('/', '-'), method: bankAmount ? 'bank' : 'card' }, now);
  const address = [-7, -6, -8, -9, -10].map(str).filter(Boolean).join(' ');
  if (!str(-8) || !str(-9) || address.length > 250) throw new ReceiptError('契約書に記載する住所を入力してください。');
  const representative = str(FIELDS.representative);
  if (representative.length > 100) throw new ReceiptError('代表者名・役職を確認してください。');
  // One enrollment per friend/form. A correction never creates a second receipt automatically.
  const id = hash(`lme:${LME_ACCOUNT}:${FORM_ID}:${friend.lmessage_friend_id}`);
  return { id, friendId: friend.lmessage_friend_id, formId: FORM_ID, createdAt: now.toISOString(), name: input.name, email: input.email, address, representative, plan: plan as Application['plan'], durationDays: plan === '特別プラン' ? null : plan === 'プレミアム' ? 365 : 180, contractAmount, initialAmount, successAmount, paidAmount, paidDate: input.paidDate, method, bankAmount, cardAmount, contractStatus: 'gmo_api_pending' };
}
export function sameApplication(a: Application, b: Application): boolean {
  return ['name','email','address','representative','plan','contractAmount','initialAmount','successAmount','paidAmount','paidDate','method','bankAmount','cardAmount'].every(key => a[key as keyof Application] === b[key as keyof Application]);
}
