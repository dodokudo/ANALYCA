import { NextRequest, NextResponse } from 'next/server';
import { getAffiliateByUserId, getReferralsByAffiliateCode, getAffiliateClickCount, getReferralStatusCounts } from '@/lib/bigquery';
import { getAffiliateDailyClicks, getAffiliatePlanBreakdown } from '@/lib/admin-queries';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ success: false, error: 'userId is required' }, { status: 400 });
    }

    const affiliate = await getAffiliateByUserId(userId);
    if (!affiliate) {
      return NextResponse.json({ success: true, registered: false });
    }

    const [referrals, clickCount, dailyStats, planBreakdown, statusCounts] = await Promise.all([
      getReferralsByAffiliateCode(affiliate.affiliate_code),
      getAffiliateClickCount(affiliate.affiliate_code),
      getAffiliateDailyClicks(affiliate.affiliate_code).catch(() => []),
      getAffiliatePlanBreakdown(affiliate.affiliate_code).catch(() => []),
      getReferralStatusCounts(affiliate.affiliate_code).catch(() => ({ pending_count: 0, confirmed_count: 0, paid_count: 0 })),
    ]);

    const conversionRate = clickCount > 0 ? (affiliate.total_referrals / clickCount) * 100 : 0;

    return NextResponse.json({
      success: true,
      registered: true,
      affiliate_code: affiliate.affiliate_code,
      commission_rate: affiliate.commission_rate,
      total_referrals: affiliate.total_referrals,
      total_commission: affiliate.total_commission,
      total_clicks: clickCount,
      conversion_rate: Math.round(conversionRate * 10) / 10,
      referrals,
      daily_stats: dailyStats,
      plan_breakdown: planBreakdown,
      pending_count: statusCounts.pending_count,
      confirmed_count: statusCounts.confirmed_count,
      paid_count: statusCounts.paid_count,
    });
  } catch (error) {
    console.error('Affiliate dashboard error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
