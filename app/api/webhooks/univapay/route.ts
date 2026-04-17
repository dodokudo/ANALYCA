import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { findUserBySubscriptionId, updateSubscriptionStatusBySubId } from '@/lib/bigquery';
import { sendAdminPaymentNotificationEmail } from '@/lib/email';
import { PLANS } from '@/lib/univapay/plans';

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
          updateSubscriptionStatusBySubId(subscriptionId, 'current').catch(err =>
            console.error('[WEBHOOK] Failed to update status to current:', err)
          );
          findUserBySubscriptionId(subscriptionId)
            .then((user) => {
              if (!user) return;
              const plan = user.plan_id ? PLANS[user.plan_id] : null;
              return sendAdminPaymentNotificationEmail({
                userId: user.user_id,
                email: user.email,
                username: user.instagram_username || user.threads_username || null,
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
          updateSubscriptionStatusBySubId(subscriptionId, 'unpaid').catch(err =>
            console.error('[WEBHOOK] Failed to update status to unpaid:', err)
          );
          console.log(`[PAYMENT FAILED] SubID: ${subscriptionId}, Error: ${(body.data as Record<string, unknown>)?.error}`);
        }
        break;
      }

      case 'subscription_payment': {
        // 定期課金の支払い完了通知 → ステータスをcurrentに維持
        const subIdPayment = (body.data as Record<string, unknown>)?.id as string;
        if (subIdPayment) {
          updateSubscriptionStatusBySubId(subIdPayment, 'current').catch(err =>
            console.error('[WEBHOOK] Failed to update status to current (payment):', err)
          );
          console.log(`[SUBSCRIPTION PAYMENT] SubID: ${subIdPayment}`);
        }
        break;
      }

      case 'subscription.suspended':
      case 'subscription_suspended': {
        const subId = (body.data as Record<string, unknown>)?.id as string;
        if (subId) {
          updateSubscriptionStatusBySubId(subId, 'suspended').catch(err =>
            console.error('[WEBHOOK] Failed to update status to suspended:', err)
          );
          console.log(`[SUBSCRIPTION SUSPENDED] SubID: ${subId}`);
        }
        break;
      }

      case 'subscription_canceled':
      case 'subscription.canceled': {
        const subId = (body.data as Record<string, unknown>)?.id as string;
        if (subId) {
          updateSubscriptionStatusBySubId(subId, 'canceled').catch(err =>
            console.error('[WEBHOOK] Failed to update status to canceled:', err)
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
