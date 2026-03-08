import { NextRequest, NextResponse } from 'next/server';
import { getAffiliateByUserId, getReferralsByAffiliateCode } from '@/lib/bigquery';

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

    const referrals = await getReferralsByAffiliateCode(affiliate.affiliate_code);

    return NextResponse.json({
      success: true,
      registered: true,
      affiliate_code: affiliate.affiliate_code,
      commission_rate: affiliate.commission_rate,
      total_referrals: affiliate.total_referrals,
      total_commission: affiliate.total_commission,
      referrals,
    });
  } catch (error) {
    console.error('Affiliate dashboard error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
