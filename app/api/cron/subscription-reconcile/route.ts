import { NextRequest, NextResponse } from 'next/server';
import {
  completePendingPlanChange,
  getDuePendingPlanChanges,
  getUserById,
  updateUserSubscription,
} from '@/lib/bigquery';
import { syncAnalycaUserRecordToLineHarness } from '@/lib/line-harness-sync';
import { reconcileRecoverableSubscriptionUpgrades } from '@/lib/subscription-upgrade';
import { getSubscription } from '@/lib/univapay/client';

export const maxDuration = 60;

function getNextPaymentDate(subscription: {
  next_payment_date?: string | null;
  next_payment?: { due_date?: string | null };
}): Date | null {
  const value = subscription.next_payment_date || subscription.next_payment?.due_date;
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const pendingResults: Array<{ userId: string; status: string; error?: string }> = [];
  try {
    const dueChanges = await getDuePendingPlanChanges();
    for (const user of dueChanges) {
      try {
        if (!user.pending_subscription_id) continue;
        const subscription = await getSubscription(user.pending_subscription_id);
        const expiresAt = getNextPaymentDate(subscription);
        if (subscription.status === 'current') {
          await completePendingPlanChange(
            user.user_id,
            user.pending_subscription_id,
            subscription.status,
            expiresAt,
          );
          const updatedUser = await getUserById(user.user_id);
          if (updatedUser) await syncAnalycaUserRecordToLineHarness(updatedUser);
          pendingResults.push({ userId: user.user_id, status: 'completed' });
        } else if (!['unverified', 'unconfirmed'].includes(subscription.status)) {
          await updateUserSubscription(user.user_id, {
            subscription_status: subscription.status,
            subscription_expires_at: expiresAt,
          });
          pendingResults.push({ userId: user.user_id, status: subscription.status });
        } else {
          pendingResults.push({ userId: user.user_id, status: 'waiting' });
        }
      } catch (error) {
        pendingResults.push({
          userId: user.user_id,
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const upgradeResults = await reconcileRecoverableSubscriptionUpgrades();
    return NextResponse.json({ success: true, pendingResults, upgradeResults });
  } catch (error) {
    console.error('[subscription-reconcile] failed:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
