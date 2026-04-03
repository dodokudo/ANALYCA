import { NextRequest, NextResponse } from 'next/server';
import { recordAffiliateClick } from '@/lib/bigquery';
import { createHash } from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { affiliate_code, referrer, utm_source, utm_medium, utm_campaign, user_agent } = body;

    if (!affiliate_code) {
      return NextResponse.json({ success: false, error: 'affiliate_code is required' }, { status: 400 });
    }

    // IPアドレスをハッシュ化（プライバシー保護）
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0].trim() : request.headers.get('x-real-ip') || 'unknown';
    const ipHash = createHash('sha256').update(ip).digest('hex').substring(0, 16);

    await recordAffiliateClick({
      affiliate_code: affiliate_code || '',
      referrer: referrer || '',
      utm_source: utm_source || '',
      utm_medium: utm_medium || '',
      utm_campaign: utm_campaign || '',
      user_agent: user_agent || '',
      ip_hash: ipHash,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Affiliate click recording error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
