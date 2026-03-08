import { NextRequest, NextResponse } from 'next/server';
import { getAffiliateByUserId, registerAffiliate, getUserById } from '@/lib/bigquery';

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ success: false, error: 'userId is required' }, { status: 400 });
    }

    // ユーザー存在チェック
    const user = await getUserById(userId);
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    // 既にアフィリエイト登録済みか確認
    const existing = await getAffiliateByUserId(userId);
    if (existing) {
      return NextResponse.json({
        success: true,
        affiliate_code: existing.affiliate_code,
        already_registered: true,
      });
    }

    // 新規発行
    const code = generateCode();
    await registerAffiliate(userId, code);

    return NextResponse.json({
      success: true,
      affiliate_code: code,
      already_registered: false,
    });
  } catch (error) {
    console.error('Affiliate register error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
