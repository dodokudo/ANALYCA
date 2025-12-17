import { NextResponse } from 'next/server';
import { getAllUsersWithStats, getAdminOverallStats } from '@/lib/bigquery';

// 簡易的な管理者キー認証（本番では適切な認証を実装）
const ADMIN_KEY = process.env.ADMIN_SECRET_KEY || 'analyca-admin-2024';

export async function GET(request: Request) {
  try {
    // 認証チェック（クエリパラメータまたはヘッダー）
    const url = new URL(request.url);
    const key = url.searchParams.get('key') || request.headers.get('x-admin-key');

    if (key !== ADMIN_KEY) {
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
