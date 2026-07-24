import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  getAllUsersWithStats,
  getAdminOverallStats,
  confirmReferrals,
  getIncompletePaymentAttempts,
  getUserById,
  linkSubscriptionToUser,
  markReferralsPaid,
} from '@/lib/bigquery';
import { getAllAffiliatesWithStats, getConversionFunnelStats, getUsersExtendedInfo } from '@/lib/admin-queries';
import { getSubscription, getTransactionToken, listSubscriptions } from '@/lib/univapay/client';

// パスワード認証
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '7684';

// Cookie認証で管理画面アクセスを許可するユーザーID
const ADMIN_USER_IDS = new Set([
  '10012809578833342', // kudooo_ai
]);

async function isAdminByCookie(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('analycaUserId')?.value;
    return !!userId && ADMIN_USER_IDS.has(userId);
  } catch {
    return false;
  }
}

function isAdminByPassword(password: string | null): boolean {
  return password === ADMIN_PASSWORD;
}


export async function POST(request: Request) {
  try {
    const body = await request.json();
    const password = body.password || request.headers.get('x-admin-password');

    if (!isAdminByPassword(password) && !(await isAdminByCookie())) {
      return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });
    }

    const { action, affiliateCode, month, subscriptionId, sourceUserId, targetUserId } = body;

    if (!action) {
      return NextResponse.json({ success: false, error: 'action is required' }, { status: 400 });
    }

    if (action === 'confirm_rewards') {
      if (!affiliateCode || !month) {
        return NextResponse.json({ success: false, error: 'affiliateCode and month are required' }, { status: 400 });
      }
      const affected = await confirmReferrals(affiliateCode, month);
      return NextResponse.json({ success: true, affected, message: `${affected}件を確定しました` });
    }

    if (action === 'mark_paid') {
      if (!affiliateCode || !month) {
        return NextResponse.json({ success: false, error: 'affiliateCode and month are required' }, { status: 400 });
      }
      const affected = await markReferralsPaid(affiliateCode, month);
      return NextResponse.json({ success: true, affected, message: `${affected}件を振込済みにしました` });
    }

    if (action === 'link_subscription') {
      if (!subscriptionId || !targetUserId) {
        return NextResponse.json(
          { success: false, error: 'subscriptionId and targetUserId are required' },
          { status: 400 },
        );
      }

      const targetUser = await getUserById(targetUserId);
      if (!targetUser || (!targetUser.has_instagram && !targetUser.has_threads)) {
        return NextResponse.json(
          { success: false, error: 'SNSログイン済みの紐付け先ユーザーが見つかりません' },
          { status: 404 },
        );
      }
      if (targetUser.subscription_id && targetUser.subscription_id !== subscriptionId) {
        return NextResponse.json(
          { success: false, error: '紐付け先には別のサブスクリプションが登録済みです' },
          { status: 409 },
        );
      }

      const sourceUser =
        typeof sourceUserId === 'string' && sourceUserId
          ? await getUserById(sourceUserId)
          : null;
      if (
        sourceUser
        && (
          sourceUser.subscription_id !== subscriptionId
          || sourceUser.has_instagram
          || sourceUser.has_threads
        )
      ) {
        return NextResponse.json(
          { success: false, error: '決済元ユーザーの状態が変わったため、画面を更新してください' },
          { status: 409 },
        );
      }

      const subscription = await getSubscription(subscriptionId);
      const token = await getTransactionToken(subscription.transaction_token_id).catch(() => null);
      const planId = subscription.metadata?.planId;
      if (!planId) {
        return NextResponse.json(
          { success: false, error: 'サブスクリプションのプラン情報が見つかりません' },
          { status: 409 },
        );
      }

      const nextPaymentAt = subscription.next_payment_date
        ? new Date(`${subscription.next_payment_date}T00:00:00+09:00`)
        : null;
      const isTrial =
        subscription.initial_amount === 0
        && !!nextPaymentAt
        && nextPaymentAt > new Date();

      await linkSubscriptionToUser({
        target_user_id: targetUserId,
        source_user_id: sourceUser?.user_id || null,
        email: token?.email || sourceUser?.email || null,
        subscription_id: subscription.id,
        plan_id: planId,
        subscription_status: isTrial ? 'trial' : subscription.status,
        subscription_created_at: new Date(subscription.created_on),
        subscription_expires_at: isTrial ? null : nextPaymentAt,
        trial_ends_at: isTrial ? nextPaymentAt : null,
        transaction_token_id: subscription.transaction_token_id,
      });

      return NextResponse.json({
        success: true,
        message: '決済情報をSNSログイン済みユーザーへ紐付けました',
      });
    }

    return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    console.error('Admin POST error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process action',
    }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    // 認証（cookie or パスワード）
    const url = new URL(request.url);
    const password = url.searchParams.get('password') || request.headers.get('x-admin-password');

    if (!isAdminByPassword(password) && !(await isAdminByCookie())) {
      return NextResponse.json({
        success: false,
        error: '認証が必要です'
      }, { status: 401 });
    }

    // データ取得（UnivaPay一括取得を並行）
    const [users, stats, affiliates, funnel, usersExtended, subscriptions, paymentAttempts] = await Promise.all([
      getAllUsersWithStats(),
      getAdminOverallStats(),
      getAllAffiliatesWithStats().catch(() => []),
      getConversionFunnelStats().catch(() => ({ total_conversions: 0, total_revenue: 0, affiliate_sources: 0, utm_tracked: 0 })),
      getUsersExtendedInfo().catch(() => []),
      listSubscriptions({ limit: 50 }).catch(() => ({ items: [], has_more: false })),
      getIncompletePaymentAttempts().catch(() => []),
    ]);

    // subscription_id → next_payment_date のマップ
    const subscriptionMap: Record<string, { next_payment_date: string | null; amount: number; status: string }> = {};
    for (const sub of subscriptions.items) {
      subscriptionMap[sub.id] = {
        next_payment_date: sub.next_payment_date ?? null,
        amount: sub.amount,
        status: sub.status,
      };
    }
    const usersBySubscriptionId = new Map(
      usersExtended
        .filter((user) => user.subscription_id)
        .map((user) => [user.subscription_id as string, user]),
    );
    const usersById = new Map(users.map((user) => [user.user_id, user]));
    const unlinkedSubscriptions = await Promise.all(
      subscriptions.items
        .filter((sub) =>
          !!sub.metadata?.analycaUserId
          && !!sub.metadata?.planId
          && (
            !usersBySubscriptionId.has(sub.id)
            || (() => {
            const paymentUser = usersById.get(usersBySubscriptionId.get(sub.id)?.user_id || '');
            return !!paymentUser && !paymentUser.has_instagram && !paymentUser.has_threads;
            })()
          )
          && !['canceled', 'completed'].includes(sub.status),
        )
        .slice(0, 20)
        .map(async (sub) => {
          const token = await getTransactionToken(sub.transaction_token_id).catch(() => null);
          const paymentUser = usersBySubscriptionId.get(sub.id);
          return {
            id: sub.id,
            email: token?.email || null,
            user_id: sub.metadata?.analycaUserId || null,
            source_user_id: paymentUser?.user_id || null,
            plan_id: sub.metadata?.planId || null,
            amount: sub.amount,
            status: sub.status,
            created_on: sub.created_on,
            next_payment_date: sub.next_payment_date || null,
          };
        }),
    );

    return NextResponse.json({
      success: true,
      data: {
        users,
        stats,
        affiliates,
        funnel,
        usersExtended,
        subscriptionMap,
        unlinkedSubscriptions,
        paymentAttempts,
        fetchedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Admin API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '管理者データの取得に失敗しました'
    }, { status: 500 });
  }
}
