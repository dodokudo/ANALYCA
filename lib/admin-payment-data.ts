import { aggregateAdminPayments, resolvePaymentOwners, type AdminPaymentSummary, type PaymentUser } from './admin-payments';
import { collectUnivaPayPages, listCharges, listChargeRefunds, type UnivaPaySubscription, type UnivaPayRefund } from './univapay/client';

export interface AdminPaymentData {
  users: Record<string, AdminPaymentSummary>;
  fetchedAt: string;
  error: string | null;
}

let cache: { key: string; until: number; data: AdminPaymentData } | null = null;
const pending = new Map<string, Promise<AdminPaymentData>>();

export async function getAdminPaymentData(users: PaymentUser[], subscriptions: UnivaPaySubscription[]): Promise<AdminPaymentData> {
  const key = JSON.stringify([users.map(user => [user.user_id, user.subscription_id, user.pending_subscription_id]),
    subscriptions.map(sub => [sub.id, sub.metadata?.analycaUserId, sub.metadata?.planId, sub.period])]);
  if (cache?.key === key && cache.until > Date.now()) return cache.data;
  if (pending.has(key)) return pending.get(key)!;
  const request = loadAdminPaymentData(users, subscriptions).then(data => {
    if (!data.error && Object.values(data.users).every(user => user.refundsComplete)) cache = { key, until: Date.now() + 60000, data };
    return data;
  }).finally(() => pending.delete(key));
  pending.set(key, request);
  return request;
}

async function loadAdminPaymentData(users: PaymentUser[], subscriptions: UnivaPaySubscription[]): Promise<AdminPaymentData> {
  try {
    const charges = await collectUnivaPayPages(cursor => listCharges({ mode: 'live', limit: 100, cursor }));
    const ownerFor = resolvePaymentOwners(users, subscriptions);
    const relevant = charges.filter(charge => charge.status === 'successful' && charge.mode === 'live' && ownerFor(charge));
    const refunds: Record<string, UnivaPayRefund[] | null> = {};
    for (const charge of relevant) {
      // Pace historical reads to stay below the provider's route burst limit.
      await new Promise(resolve => setTimeout(resolve, 250));
      try { refunds[charge.id] = await collectUnivaPayPages(next => listChargeRefunds(charge.id, next)); }
      catch (error) { console.error('[admin/payments] refund read failed', charge.id, String(error)); refunds[charge.id] = null; }
    }
    return { users: aggregateAdminPayments(users, subscriptions, charges, refunds), fetchedAt: new Date().toISOString(), error: null };
  } catch (error) {
    console.error('[admin/payments] read failed', error);
    return { users: {}, fetchedAt: new Date().toISOString(), error: '決済履歴を取得できませんでした。再読み込みしてください。' };
  }
}
