import { NextRequest, NextResponse } from 'next/server';
import { getUserById, getUserReels } from '@/lib/bigquery';
import { evaluateDashboardAccess } from '@/lib/subscription-access';
import { isChannelBlockedByPlan, resolveEffectivePlanId } from '@/lib/univapay/plans';
import { getSavedReelMetrics } from '@/lib/instagram-reel-metrics';

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
    const offset = Number(request.nextUrl.searchParams.get('offset') || 0);
    if (!Number.isInteger(offset) || offset < 0 || offset >= 50) return NextResponse.json({ error: 'Invalid offset' }, { status: 400 });
    // IDs come exclusively from this account's saved reels, never an unverified request parameter.
    const reels = await getUserReels(userId, 50);
    const batch = reels.slice(offset, offset + 10);
    // Compatibility for already-open clients. Always DB-only, including expired tokens.
    const rows = batch.map(reel => getSavedReelMetrics({ ...reel, id: reel.instagram_id }));
    return NextResponse.json({ rows, nextOffset: offset + 10 < reels.length ? offset + 10 : null, total: reels.length }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ error: 'リールの最新データを取得できませんでした' }, { status: 502 });
  }
}
