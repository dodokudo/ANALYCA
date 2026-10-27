import { NextRequest, NextResponse } from 'next/server';
import { syncInstagramSheetExports } from '@/lib/instagram-sheet-export';

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET || request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const result = await syncInstagramSheetExports();
    return NextResponse.json(result, { status: result.success ? 200 : 502 });
  } catch (error) {
    console.error('Instagram sheet export failed:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
