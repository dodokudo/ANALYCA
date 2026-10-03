import { NextRequest, NextResponse } from 'next/server';
import { syncAdminPaymentSnapshot } from '@/lib/admin-payment-sync';

export const maxDuration = 180;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const data = await syncAdminPaymentSnapshot();
    return NextResponse.json({ success: true, fetchedAt: data.fetchedAt });
  } catch (error) {
    console.error('[admin-payment-sync] failed:', error);
    return NextResponse.json({ success: false, error: '決済情報の更新に失敗しました。前回の保存済みデータを保持しています。' }, { status: 500 });
  }
}
