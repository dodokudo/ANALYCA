import { NextRequest, NextResponse } from 'next/server';
import { getUserById, updateUserSubscription, updateUserRecurringToken } from '@/lib/bigquery';
import { deleteRecurringToken } from '@/lib/univapay/client';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId is required' },
        { status: 400 }
      );
    }

    const user = await getUserById(userId);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    if (user.subscription_status !== 'trial') {
      return NextResponse.json(
        { success: false, error: 'User is not in trial' },
        { status: 400 }
      );
    }

    // UnivaPayからリカーリングトークンを削除
    if (user.recurring_token_id) {
      try {
        await deleteRecurringToken(user.recurring_token_id);
      } catch (err) {
        console.warn('Failed to delete recurring token (may already be deleted):', err);
      }
    }

    // BigQueryのステータスを更新
    await updateUserSubscription(userId, {
      subscription_status: 'canceled',
    });
    await updateUserRecurringToken(userId, '');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Trial cancel error:', error);
    return NextResponse.json(
      { success: false, error: 'トライアルのキャンセルに失敗しました' },
      { status: 500 }
    );
  }
}
