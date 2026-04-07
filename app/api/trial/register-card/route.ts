import { NextRequest, NextResponse } from 'next/server';
import { getUserById, updateUserRecurringToken, updateUserSubscription } from '@/lib/bigquery';
import { sendAdminCardRegisteredEmail, sendCardRegisteredUserEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const { userId, transactionTokenId } = await request.json();

    if (!userId || !transactionTokenId) {
      return NextResponse.json(
        { success: false, error: 'userId and transactionTokenId are required' },
        { status: 400 }
      );
    }

    // ユーザー存在確認
    const user = await getUserById(userId);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // リカーリングトークンを保存
    await updateUserRecurringToken(userId, transactionTokenId);

    // トライアル中でなければトライアルステータスに設定
    if (!user.subscription_status || user.subscription_status === 'none') {
      await updateUserSubscription(userId, {
        subscription_status: 'trial',
      });
    }

    // ユーザー宛: カード登録完了 + ログインURL
    if (user.email) {
      const { PLANS } = await import('@/lib/univapay/plans');
      const plan = user.plan_id ? PLANS[user.plan_id] : null;
      const onboardingPath = plan?.onboardingPath || '/onboarding/light';
      const loginUrl = `https://analyca.jp${onboardingPath}?userId=${userId}`;
      sendCardRegisteredUserEmail(user.email, loginUrl).catch((err) => {
        console.error('Card registered user email failed:', err);
      });
    }

    // 管理者宛: カード登録通知
    sendAdminCardRegisteredEmail({
      userId,
      email: user.email,
      username: user.instagram_username || user.threads_username || null,
      planId: user.plan_id,
      scheduledPaymentAt: user.trial_ends_at,
    }).catch((error) => {
      console.error('Admin card registration email failed:', error);
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Register card error:', error);
    return NextResponse.json(
      { success: false, error: 'カード登録に失敗しました' },
      { status: 500 }
    );
  }
}
