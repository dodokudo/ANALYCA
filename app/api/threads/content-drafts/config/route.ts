import { NextRequest, NextResponse } from 'next/server';
import { getYokoNotionConnectionStatus } from '@/lib/yoko-notion';
import { YOKO_ANALYCA_USER_ID } from '@/lib/yoko-notion-ledger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.get('userId') !== YOKO_ANALYCA_USER_ID) {
    return NextResponse.json({ error: '対象外のアカウントです' }, { status: 403 });
  }
  const notion = await getYokoNotionConnectionStatus().catch(() => ({ connected: false, sources: [] }));
  return NextResponse.json({
    notion,
    openai: {
      configured: Boolean(process.env.OPENAI_API_KEY),
      draftModel: process.env.OPENAI_DRAFT_MODEL || 'gpt-5.6-terra',
      styleModel: process.env.OPENAI_STYLE_MODEL || 'gpt-5.6-terra',
    },
  });
}
