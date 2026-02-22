import { NextRequest, NextResponse } from 'next/server';
import { updateSubscriptionStatusBySubId } from '@/lib/bigquery';

export async function POST(request: NextRequest) {
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
        const subscriptionId = (body.data as Record<string, unknown>)?.subscription_id as string
          || ((body.data as Record<string, unknown>)?.metadata as Record<string, unknown>)?.subscription_id as string;
        if (subscriptionId) {
          updateSubscriptionStatusBySubId(subscriptionId, 'active').catch(err =>
            console.error('[WEBHOOK] Failed to update status to active:', err)
          );
          console.log(`[PAYMENT SUCCESS] SubID: ${subscriptionId}, Amount: ${(body.data as Record<string, unknown>)?.amount}`);
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

      case 'subscription_payment':
      case 'subscription.suspended': {
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
