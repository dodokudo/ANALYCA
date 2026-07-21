import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  completePendingPlanChange,
  findUserByPendingSubscriptionId,
  findUserBySubscriptionId,
  getUserById,
  updateSubscriptionStatusBySubId,
  updateUserSubscription,
} from '@/lib/bigquery';
import { sendAdminPaymentNotificationEmail } from '@/lib/email';
import { PLANS } from '@/lib/univapay/plans';
import { syncAnalycaUserRecordToLineHarness } from '@/lib/line-harness-sync';
import { getSubscription } from '@/lib/univapay/client';

function extractAmount(data: Record<string, unknown>): number | null {
  const raw = data.amount ?? data.charged_amount ?? data.requested_amount;
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string') {
    const parsed = Number(raw);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

/**
 * UnivaPayは webhook に Authorization ヘッダーで事前共有トークンを載せてくる。
 * UNIVAPAY_WEBHOOK_AUTH_TOKEN が設定されていれば検証、未設定なら互換のため通す。
 * (本番稼働中のwebhookを壊さないための段階的ロールアウト対応)
 */
type AuthResult = { ok: true } | { ok: false; reason: string };

function verifyWebhookAuth(request: NextRequest): AuthResult {
  const expected = process.env.UNIVAPAY_WEBHOOK_AUTH_TOKEN;
  if (!expected) {
    return { ok: true };
  }
  const received = request.headers.get('authorization') ?? '';
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    return { ok: false, reason: 'length_mismatch' };
  }
  if (!crypto.timingSafeEqual(a, b)) {
    return { ok: false, reason: 'token_mismatch' };
  }
  return { ok: true };
}

function getNextPaymentDate(subscription: { next_payment_date?: string | null; next_payment?: { due_date?: string | null } }): Date | null {
  const value = subscription.next_payment_date || subscription.next_payment?.due_date || null;
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function updateStatusAndSync(subscriptionId: string, status: string, hydrateSubscription = false): Promise<void> {
  const pendingUser = await findUserByPendingSubscriptionId(subscriptionId);
  if (pendingUser) {
    let subscriptionStatus = status;
    let nextPaymentDate: Date | null = null;
    if (hydrateSubscription) {
      const subscription = await getSubscription(subscriptionId);
      subscriptionStatus = subscription.status || status;
      nextPaymentDate = getNextPaymentDate(subscription);
    }

    if (subscriptionStatus === 'current') {
      await completePendingPlanChange(
        pendingUser.user_id,
        subscriptionId,
        subscriptionStatus,
        nextPaymentDate,
      );
    } else if (
      !pendingUser.plan_change_effective_at
      || pendingUser.plan_change_effective_at.getTime() <= Date.now()
    ) {
      await updateUserSubscription(pendingUser.user_id, {
        subscription_status: subscriptionStatus,
        subscription_expires_at: nextPaymentDate,
      });
    }

    const updatedUser = await getUserById(pendingUser.user_id);
    if (updatedUser) await syncAnalycaUserRecordToLineHarness(updatedUser);
    return;
  }

  const user = await findUserBySubscriptionId(subscriptionId);
  if (!user) return;
  if (status === 'canceled' && user.pending_subscription_id) {
    return;
  }

  await updateSubscriptionStatusBySubId(subscriptionId, status);

  if (hydrateSubscription) {
    try {
      const subscription = await getSubscription(subscriptionId);
      await updateUserSubscription(user.user_id, {
        subscription_status: subscription.status || status,
        subscription_expires_at: getNextPaymentDate(subscription),
      });
    } catch (err) {
      console.error('[WEBHOOK] Failed to hydrate subscription status:', err);
    }
  }

  const updatedUser = await getUserById(user.user_id);
  if (updatedUser) await syncAnalycaUserRecordToLineHarness(updatedUser);
}

export async function POST(request: NextRequest) {
  const auth: AuthResult = verifyWebhookAuth(request);
  if (auth.ok === false) {
    console.warn('[WEBHOOK] auth failed:', auth.reason);
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let event: string | undefined;
  let body: Record<string, unknown> = {};

  try {
    body = await request.json();
    event = body.event as string | undefined;
  } catch {
    return NextResponse.json({ received: true, error: 'invalid_json' });
  }

  console.log('UnivaPay webhook received:', event, JSON.stringify(body).substring(0, 500));

  // 即座に200を返す（UnivaPayは3秒以内のレスポンスを要求）
  // BigQuery更新はfire-and-forgetで実行
  try {
    switch (event) {
      case 'charge_finished':
      case 'charge.successful': {
        const data = (body.data as Record<string, unknown>) || {};
        const subscriptionId = data.subscription_id as string
          || (data.metadata as Record<string, unknown>)?.subscription_id as string;
        if (subscriptionId) {
          updateStatusAndSync(subscriptionId, 'current', true).catch(err =>
            console.error('[WEBHOOK] Failed to update/sync status to current:', err)
          );
          findUserBySubscriptionId(subscriptionId)
            .then(async (user) => user || findUserByPendingSubscriptionId(subscriptionId))
            .then((user) => {
              if (!user) return;
              const plan = user.plan_id ? PLANS[user.plan_id] : null;
              return sendAdminPaymentNotificationEmail({
                userId: user.user_id,
                email: user.email,
                username: user.instagram_username || user.threads_username || null,
                instagramUsername: user.instagram_username || null,
                threadsUsername: user.threads_username || null,
                planId: user.plan_id,
                planName: plan ? `${plan.name} ${plan.subtitle}`.trim() : user.plan_id,
                amount: extractAmount(data),
                paidAt: new Date(),
                paymentType: '課金',
              });
            })
            .catch((err) => console.error('[WEBHOOK] Failed to send admin payment email:', err));
          console.log(`[PAYMENT SUCCESS] SubID: ${subscriptionId}, Amount: ${data.amount}`);
        }
        break;
      }

      case 'charge_updated':
      case 'charge.failed': {
        const subscriptionId = (body.data as Record<string, unknown>)?.subscription_id as string
          || ((body.data as Record<string, unknown>)?.metadata as Record<string, unknown>)?.subscription_id as string;
        if (subscriptionId) {
          updateStatusAndSync(subscriptionId, 'unpaid').catch(err =>
            console.error('[WEBHOOK] Failed to update/sync status to unpaid:', err)
          );
          console.log(`[PAYMENT FAILED] SubID: ${subscriptionId}, Error: ${(body.data as Record<string, unknown>)?.error}`);
        }
        break;
      }

      case 'subscription_failure':
      case 'subscription.failed': {
        const data = (body.data as Record<string, unknown>) || {};
        const subId = data.id as string || data.subscription_id as string;
        const nextStatus = typeof data.status === 'string' ? data.status : 'unpaid';
        if (subId) {
          updateStatusAndSync(subId, nextStatus, true).catch(err =>
            console.error('[WEBHOOK] Failed to update/sync subscription failure:', err)
          );
          console.log(`[SUBSCRIPTION FAILURE] SubID: ${subId}, Status: ${nextStatus}`);
        }
        break;
      }

      case 'subscription_payment': {
        // 定期課金の支払い完了通知 → ステータスをcurrentに維持
        const subIdPayment = (body.data as Record<string, unknown>)?.id as string;
        if (subIdPayment) {
          updateStatusAndSync(subIdPayment, 'current', true).catch(err =>
            console.error('[WEBHOOK] Failed to update/sync status to current (payment):', err)
          );
          console.log(`[SUBSCRIPTION PAYMENT] SubID: ${subIdPayment}`);
        }
        break;
      }

      case 'subscription.suspended':
      case 'subscription_suspended': {
        const subId = (body.data as Record<string, unknown>)?.id as string;
        if (subId) {
          updateStatusAndSync(subId, 'suspended', true).catch(err =>
            console.error('[WEBHOOK] Failed to update/sync status to suspended:', err)
          );
          console.log(`[SUBSCRIPTION SUSPENDED] SubID: ${subId}`);
        }
        break;
      }

      case 'subscription_canceled':
      case 'subscription.canceled': {
        const subId = (body.data as Record<string, unknown>)?.id as string;
        if (subId) {
          updateStatusAndSync(subId, 'canceled', true).catch(err =>
            console.error('[WEBHOOK] Failed to update/sync status to canceled:', err)
          );
          console.log(`[SUBSCRIPTION CANCELED] SubID: ${subId}`);
        }
        break;
      }

      default:
        console.log('UnivaPay webhook: unhandled event', event);
    }
  } catch (error) {
    console.error('Webhook processing error:', error);
  }

  return NextResponse.json({ received: true });
}
