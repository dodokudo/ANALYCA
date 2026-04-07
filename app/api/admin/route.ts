import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAllUsersWithStats, getAdminOverallStats, confirmReferrals, markReferralsPaid } from '@/lib/bigquery';
import { getAllAffiliatesWithStats, getConversionFunnelStats, getUsersExtendedInfo } from '@/lib/admin-queries';

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

    const { action, affiliateCode, month } = body;

    if (!action || !affiliateCode || !month) {
      return NextResponse.json({ success: false, error: 'action, affiliateCode, month are required' }, { status: 400 });
    }

    if (action === 'confirm_rewards') {
      const affected = await confirmReferrals(affiliateCode, month);
      return NextResponse.json({ success: true, affected, message: `${affected}件を確定しました` });
    }

    if (action === 'mark_paid') {
      const affected = await markReferralsPaid(affiliateCode, month);
      return NextResponse.json({ success: true, affected, message: `${affected}件を振込済みにしました` });
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

    // データ取得
    const [users, stats, affiliates, funnel, usersExtended] = await Promise.all([
      getAllUsersWithStats(),
      getAdminOverallStats(),
      getAllAffiliatesWithStats().catch(() => []),
      getConversionFunnelStats().catch(() => ({ total_conversions: 0, total_revenue: 0, affiliate_sources: 0, utm_tracked: 0 })),
      getUsersExtendedInfo().catch(() => []),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        users,
        stats,
        affiliates,
        funnel,
        usersExtended,
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
