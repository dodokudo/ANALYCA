type SyncAnalycaUserInput = {
  userId: string;
  instagramUsername?: string | null;
  threadsUsername?: string | null;
  planId?: string | null;
  subscriptionStatus?: string | null;
  subscriptionExpiresAt?: string | Date | null;
  trialEndsAt?: string | Date | null;
};

type SyncAnalycaUserResult = {
  success: boolean;
  matchedCount: number;
};

type SyncAllAnalycaUsersResult = {
  total: number;
  synced: number;
  matched: number;
  failed: number;
  failures: Array<{ userId: string; error: string }>;
};

const DEFAULT_SYNC_URL = 'https://line-harness.lhx7.workers.dev/api/integrations/analyca/sync-user';

function isActiveSubscription(status?: string | null): boolean {
  return status === 'current' || status === 'trial';
}

function serializeDate(value?: string | Date | null): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
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
      subscriptionExpiresAt: serializeDate(input.subscriptionExpiresAt),
      trialEndsAt: serializeDate(input.trialEndsAt),
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

export async function syncAnalycaUserRecordToLineHarness(user: {
  user_id: string;
  instagram_username?: string | null;
  threads_username?: string | null;
  plan_id?: string | null;
  subscription_status?: string | null;
  subscription_expires_at?: string | Date | null;
  trial_ends_at?: string | Date | null;
}): Promise<SyncAnalycaUserResult | null> {
  return syncAnalycaUserToLineHarness({
    userId: user.user_id,
    instagramUsername: user.instagram_username || null,
    threadsUsername: user.threads_username || null,
    planId: user.plan_id || null,
    subscriptionStatus: user.subscription_status || null,
    subscriptionExpiresAt: user.subscription_expires_at || null,
    trialEndsAt: user.trial_ends_at || null,
  });
}

export async function syncAllAnalycaUsersToLineHarness(users: Array<{
  user_id: string;
  instagram_username?: string | null;
  threads_username?: string | null;
  plan_id?: string | null;
  subscription_status?: string | null;
  subscription_expires_at?: string | Date | null;
  trial_ends_at?: string | Date | null;
}>): Promise<SyncAllAnalycaUsersResult> {
  const result: SyncAllAnalycaUsersResult = {
    total: users.length,
    synced: 0,
    matched: 0,
    failed: 0,
    failures: [],
  };

  for (const user of users) {
    try {
      const syncResult = await syncAnalycaUserRecordToLineHarness(user);
      result.synced += 1;
      result.matched += syncResult?.matchedCount ?? 0;
    } catch (error) {
      result.failed += 1;
      result.failures.push({
        userId: user.user_id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return result;
}
