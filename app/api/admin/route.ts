import { NextResponse } from 'next/server';
import { getAllUsersWithStats, getAdminOverallStats } from '@/lib/bigquery';

// パスワード認証
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '7684';

export async function GET(request: Request) {
  try {
    // パスワード認証
    const url = new URL(request.url);
    const password = url.searchParams.get('password') || request.headers.get('x-admin-password');

    if (password !== ADMIN_PASSWORD) {
      return NextResponse.json({
        success: false,
        error: '認証が必要です'
      }, { status: 401 });
    }

    // データ取得
    const [users, stats] = await Promise.all([
      getAllUsersWithStats(),
      getAdminOverallStats()
    ]);

    return NextResponse.json({
      success: true,
      data: {
        users,
        stats,
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
