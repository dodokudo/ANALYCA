import { NextResponse } from 'next/server';

export async function GET() {
  const appId = process.env.UNIVAPAY_JWT;

  if (!appId) {
    return NextResponse.json({
      success: false,
      error: 'Payment configuration not available',
    }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    config: {
      appId,
    },
  });
}
