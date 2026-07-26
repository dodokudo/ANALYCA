export const THREADS_GRANDPRIX_PAYMENT_REQUIRED_AT = new Date(
  '2026-08-01T00:00:00+09:00',
);
export const THREADS_GRANDPRIX_FREE_ACCESS_EXPIRES_AT = new Date(
  THREADS_GRANDPRIX_PAYMENT_REQUIRED_AT.getTime() - 1,
);

export interface ThreadsGrandprixAccessSubject {
  isParticipant: boolean;
  subscriptionStatus?: string | null;
}

export interface ThreadsGrandprixAccess {
  allowed: boolean;
  state: 'allowed' | 'expired';
  title?: string;
  message?: string;
  actionLabel?: string;
  actionType?: 'reactivate';
  status?: string | null;
  expiresAt: string;
}

function isUncontracted(subscriptionStatus?: string | null): boolean {
  return (subscriptionStatus || 'none').toLowerCase() === 'none';
}

export function isThreadsGrandprixUncontractedParticipant(
  subject: ThreadsGrandprixAccessSubject,
): boolean {
  return subject.isParticipant && isUncontracted(subject.subscriptionStatus);
}

export function isThreadsGrandprixPaymentRequired(
  subject: ThreadsGrandprixAccessSubject,
  now = new Date(),
): boolean {
  return (
    isThreadsGrandprixUncontractedParticipant(subject) &&
    now >= THREADS_GRANDPRIX_PAYMENT_REQUIRED_AT
  );
}

export function evaluateThreadsGrandprixAccess(
  subject: ThreadsGrandprixAccessSubject,
  options: { now?: Date; isAdmin?: boolean } = {},
): ThreadsGrandprixAccess | null {
  if (options.isAdmin || !isThreadsGrandprixUncontractedParticipant(subject)) {
    return null;
  }

  const expiresAt = THREADS_GRANDPRIX_FREE_ACCESS_EXPIRES_AT.toISOString();
  if (!isThreadsGrandprixPaymentRequired(subject, options.now)) {
    return {
      allowed: true,
      state: 'allowed',
      status: 'grandprix_free_access',
      expiresAt,
    };
  }

  return {
    allowed: false,
    state: 'expired',
    title: '無料利用期間が終了しています',
    message: 'カード登録と決済を完了するとThreads分析を引き続き確認できます。',
    actionLabel: 'カード登録して利用を続ける',
    actionType: 'reactivate',
    status: 'expired',
    expiresAt,
  };
}
