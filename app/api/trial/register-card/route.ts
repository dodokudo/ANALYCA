import { NextRequest, NextResponse } from 'next/server';
import { getUserById, updateUserRecurringToken, updateUserSubscription } from '@/lib/bigquery';

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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Register card error:', error);
    return NextResponse.json(
      { success: false, error: 'カード登録に失敗しました' },
      { status: 500 }
    );
  }
}
