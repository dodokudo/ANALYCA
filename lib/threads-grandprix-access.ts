import { GRANDPRIX_EVENTS } from './threads-grandprix-events';

export const THREADS_GRANDPRIX_PAYMENT_REQUIRED_AT = new Date(
  '2026-08-01T00:00:00+09:00',
);
export const THREADS_GRANDPRIX_FREE_ACCESS_EXPIRES_AT = new Date(
  THREADS_GRANDPRIX_PAYMENT_REQUIRED_AT.getTime() - 1,
);

export interface ThreadsGrandprixAccessSubject {
  isParticipant: boolean;
  eventIds?: readonly string[];
  subscriptionStatus?: string | null;
}

export interface ThreadsGrandprixAccess {
  allowed: boolean;
  state: 'allowed' | 'expired' | 'not_started';
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

function participantWindow(subject: ThreadsGrandprixAccessSubject) {
  // 開催回のない旧呼出し・旧データは夏として扱い、秋の権限を推測で付与しない。
  const eventIds = subject.eventIds ?? ['2026-summer'];
  const event = GRANDPRIX_EVENTS
    .filter(candidate => eventIds.includes(candidate.eventId))
    .sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
  return {
    start: event && event.eventId !== '2026-summer' ? new Date(`${event.startDate}T00:00:00+09:00`) : null,
    end: event ? new Date(new Date(`${event.endDate}T00:00:00+09:00`).getTime() + 86_400_000) : THREADS_GRANDPRIX_PAYMENT_REQUIRED_AT,
  };
}

export function isThreadsGrandprixPaymentRequired(
  subject: ThreadsGrandprixAccessSubject,
  now = new Date(),
): boolean {
  return (
    isThreadsGrandprixUncontractedParticipant(subject) &&
    now >= participantWindow(subject).end
  );
}

export function evaluateThreadsGrandprixAccess(
  subject: ThreadsGrandprixAccessSubject,
  options: { now?: Date; isAdmin?: boolean } = {},
): ThreadsGrandprixAccess | null {
  if (options.isAdmin || !isThreadsGrandprixUncontractedParticipant(subject)) {
    return null;
  }

  const now = options.now || new Date();
  const window = participantWindow(subject);
  const expiresAt = new Date(window.end.getTime() - 1).toISOString();
  if (window.start && now < window.start) {
    const startLabel = window.start.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'long', day: 'numeric' });
    return {
      allowed: false,
      state: 'not_started',
      title: '無料開放は開催日からです',
      message: `${startLabel}から大会終了日までThreads分析画面を無料でご利用いただけます。`,
      status: 'grandprix_scheduled',
      expiresAt,
    };
  }
  if (!isThreadsGrandprixPaymentRequired(subject, now)) {
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
