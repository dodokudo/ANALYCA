import { NextRequest, NextResponse } from 'next/server';
import { getUserById, getUserReels } from '@/lib/bigquery';
import { evaluateDashboardAccess } from '@/lib/subscription-access';
import { isChannelBlockedByPlan, resolveEffectivePlanId } from '@/lib/univapay/plans';
import { detectGraphBase } from '@/lib/instagram-graph';
import { getLiveReelMetrics } from '@/lib/instagram-reel-metrics-server';
import type { InstagramReelMetrics } from '@/lib/instagram-reel-metrics';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function GET(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const { userId } = await params;
    const user = await getUserById(userId);
    if (!user) return NextResponse.json({ error: 'ユーザーが見つかりません' }, { status: 404 });
    const plan = resolveEffectivePlanId(user.plan_id, { has_threads: user.has_threads, has_instagram: user.has_instagram });
    if (!evaluateDashboardAccess(user).allowed || (plan && isChannelBlockedByPlan(plan, 'instagram'))) {
      return NextResponse.json({ error: 'Instagramの利用状態を確認してください' }, { status: 403 });
    }
    if (!user.access_token || !user.instagram_user_id) return NextResponse.json({ error: 'Instagramを再連携してください' }, { status: 409 });
    const offset = Number(request.nextUrl.searchParams.get('offset') || 0);
    if (!Number.isInteger(offset) || offset < 0 || offset >= 50) return NextResponse.json({ error: 'Invalid offset' }, { status: 400 });
    // IDs come exclusively from this account's saved reels, never an unverified request parameter.
    const reels = await getUserReels(userId, 50);
    const batch = reels.slice(offset, offset + 10);
    const base = (await detectGraphBase(user.access_token, `/${user.instagram_user_id}?fields=id`)).replace('/v23.0', '/v25.0');
    const rows: InstagramReelMetrics[] = [];
    // Bound concurrent API calls / ffprobe processes; keep work off the main dashboard request.
    for (let i = 0; i < batch.length; i += 4) {
      rows.push(...await Promise.all(batch.slice(i, i + 4).map(reel => getLiveReelMetrics(userId, reel.instagram_id, user.access_token!, base))));
    }
    return NextResponse.json({ rows, nextOffset: offset + 10 < reels.length ? offset + 10 : null, total: reels.length }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ error: 'リールの最新データを取得できませんでした' }, { status: 502 });
  }
}
