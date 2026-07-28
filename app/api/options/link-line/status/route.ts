import { NextRequest, NextResponse } from 'next/server';
import { getLinkLineOptionStatus } from '@/lib/link-line-option';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId')?.trim();
  if (!userId) {
    return NextResponse.json({ success: false, error: 'userId is required' }, { status: 400 });
  }

  try {
    const option = await getLinkLineOptionStatus(userId);
    return NextResponse.json({ success: true, option });
  } catch (error) {
    console.error('[link-line-option/status] failed:', error);
    return NextResponse.json(
      { success: false, error: 'オプション情報の取得に失敗しました' },
      { status: 500 },
    );
  }
}
