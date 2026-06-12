type SyncAnalycaUserInput = {
  userId: string;
  instagramUsername?: string | null;
  threadsUsername?: string | null;
  planId?: string | null;
  subscriptionStatus?: string | null;
  subscriptionExpiresAt?: string | null;
  trialEndsAt?: string | null;
};

type SyncAnalycaUserResult = {
  success: boolean;
  matchedCount: number;
};

const DEFAULT_SYNC_URL = 'https://line-harness.lhx7.workers.dev/api/integrations/analyca/sync-user';

function isActiveSubscription(status?: string | null): boolean {
  return status === 'current' || status === 'trial';
}

export async function syncAnalycaUserToLineHarness(
  input: SyncAnalycaUserInput,
): Promise<SyncAnalycaUserResult | null> {
  const token = process.env.LINE_HARNESS_SYNC_TOKEN;
  if (!token) return null;

  const endpoint = process.env.LINE_HARNESS_SYNC_URL || DEFAULT_SYNC_URL;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Analyca-Sync-Token': token,
    },
    body: JSON.stringify({
      userId: input.userId,
      instagramUsername: input.instagramUsername || null,
      threadsUsername: input.threadsUsername || null,
      planId: input.planId || null,
      subscriptionStatus: input.subscriptionStatus || 'none',
      subscriptionExpiresAt: input.subscriptionExpiresAt || null,
      trialEndsAt: input.trialEndsAt || null,
      isActive: isActiveSubscription(input.subscriptionStatus),
    }),
  });

  if (!res.ok) {
    throw new Error(`LINE Harness sync failed: ${res.status}`);
  }

  const json = await res.json() as Partial<SyncAnalycaUserResult>;
  return {
    success: json.success === true,
    matchedCount: typeof json.matchedCount === 'number' ? json.matchedCount : 0,
  };
}
