import { NextResponse } from 'next/server';
import { getYokoNotionConnectionStatus } from '@/lib/yoko-notion';

export const dynamic = 'force-dynamic';

export async function GET() {
  const status = await getYokoNotionConnectionStatus();
  return NextResponse.json(status, { status: status.connected ? 200 : 503 });
}
