import type { UnivaPayCharge, UnivaPayRefund, UnivaPaySubscription } from './univapay/client';

export interface PaymentUser {
  user_id: string;
  subscription_id: string | null;
  pending_subscription_id?: string | null;
}
export interface AdminPaymentSummary {
  totalPaid: number;
  totalRefunded: number;
  netPaid: number | null;
  paymentCount: number;
  paidMonths: number | null;
  firstPaidAt: string | null;
  lastPaidAt: string | null;
  lastPaidAmount: number | null;
  refundsComplete: boolean;
}

export function resolvePaymentOwners(users: PaymentUser[], subscriptions: UnivaPaySubscription[]) {
  const knownUsers = new Set(users.map(user => user.user_id));
  const currentOwners = new Map<string, string>();
  for (const user of users) {
    for (const id of [user.subscription_id, user.pending_subscription_id]) {
      if (!id) continue;
      if (currentOwners.has(id) && currentOwners.get(id) !== user.user_id) throw new Error('決済契約の紐付けが重複しています');
      currentOwners.set(id, user.user_id);
    }
  }
  const subs = new Map(subscriptions.map(sub => [sub.id, sub]));
  return (charge: UnivaPayCharge): string | null => {
    const sub = charge.subscription_id ? subs.get(charge.subscription_id) : undefined;
    if ([charge.metadata?.planId, sub?.metadata?.planId].some(plan => plan?.startsWith('test-'))) return null;
    // Current linkage wins over historical charge metadata after an account transfer.
    const owner = currentOwners.get(charge.subscription_id || '') || sub?.metadata?.analycaUserId || charge.metadata?.analycaUserId;
    return owner && knownUsers.has(owner) ? owner : null;
  };
}

function monthIndex(value: string): number {
  const date = new Date(new Date(value).getTime() + 9 * 60 * 60 * 1000);
  return date.getUTCFullYear() * 12 + date.getUTCMonth();
}

export function aggregateAdminPayments(
  users: PaymentUser[], subscriptions: UnivaPaySubscription[], charges: UnivaPayCharge[],
  refunds: Record<string, UnivaPayRefund[] | null>,
): Record<string, AdminPaymentSummary> {
  const ownerFor = resolvePaymentOwners(users, subscriptions);
  const subs = new Map(subscriptions.map(sub => [sub.id, sub]));
  const summaries: Record<string, AdminPaymentSummary> = {};
  const months = new Map<string, Set<number>>();
  for (const user of users) {
    summaries[user.user_id] = { totalPaid: 0, totalRefunded: 0, netPaid: 0, paymentCount: 0, paidMonths: 0,
      firstPaidAt: null, lastPaidAt: null, lastPaidAmount: null, refundsComplete: true };
    months.set(user.user_id, new Set());
  }
  for (const charge of new Map(charges.map(charge => [charge.id, charge])).values()) {
    if (charge.mode !== 'live' || charge.status !== 'successful') continue;
    const owner = ownerFor(charge);
    if (!owner) continue;
    if (charge.charged_currency !== 'JPY' || !Number.isSafeInteger(charge.charged_amount) || charge.charged_amount < 0
      || !Number.isFinite(Date.parse(charge.created_on))) throw new Error('決済金額または日時を確認できませんでした');
    if (charge.charged_amount === 0) continue;
    const summary = summaries[owner];
    const entries = refunds[charge.id];
    if (!entries) summary.refundsComplete = false;
    const refunded = [...new Map((entries || []).map(refund => [refund.id, refund])).values()]
      .filter(refund => refund.status === 'successful' && refund.mode === 'live')
      .reduce((sum, refund) => {
        if (refund.currency !== 'JPY' || !Number.isSafeInteger(refund.amount) || refund.amount < 0) throw new Error('返金額を確認できませんでした');
        return sum + refund.amount;
      }, 0);
    if (refunded > charge.charged_amount) throw new Error('返金額が決済額を超えています');
    summary.totalPaid += charge.charged_amount;
    summary.totalRefunded += refunded;
    summary.paymentCount++;
    if (!summary.firstPaidAt || Date.parse(charge.created_on) < Date.parse(summary.firstPaidAt)) summary.firstPaidAt = charge.created_on;
    if (!summary.lastPaidAt || Date.parse(charge.created_on) > Date.parse(summary.lastPaidAt)) {
      summary.lastPaidAt = charge.created_on;
      summary.lastPaidAmount = charge.charged_amount;
    }
    // Monthly payments in the same JST month count once, including upgrades.
    // One-time/options payments affect the amount, but not base-plan tenure.
    const sub = subs.get(charge.subscription_id || '');
    const meta = { ...sub?.metadata, ...charge.metadata };
    if (charge.subscription_id && refunded < charge.charged_amount && !meta.optionType && !meta.optionId && !meta.optionCode
      && !String(meta.type || '').includes('option')) {
      const length = sub?.period === 'annually' || meta.planId?.endsWith('-yearly') ? 12
        : sub?.period === 'semiannually' ? 6 : sub?.period === 'quarterly' ? 3 : 1;
      const start = monthIndex(charge.created_on);
      for (let i = 0; i < length; i++) months.get(owner)!.add(start + i);
    }
  }
  for (const [owner, summary] of Object.entries(summaries)) {
    summary.netPaid = summary.refundsComplete ? summary.totalPaid - summary.totalRefunded : null;
    summary.paidMonths = summary.refundsComplete ? months.get(owner)!.size : null;
  }
  return summaries;
}
