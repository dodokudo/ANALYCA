import { NextRequest, NextResponse } from 'next/server';
import { getAffiliateBankAccount, upsertAffiliateBankAccount } from '@/lib/bigquery';

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get('userId');
    if (!userId) {
      return NextResponse.json({ success: false, error: 'userId is required' }, { status: 400 });
    }

    const account = await getAffiliateBankAccount(userId);
    return NextResponse.json({ success: true, data: account });
  } catch (error) {
    console.error('Bank account GET error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get bank account',
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, bank_name, branch_name, account_type, account_number, account_holder, has_invoice, invoice_number } = body;

    if (!userId) {
      return NextResponse.json({ success: false, error: 'userId is required' }, { status: 400 });
    }
    if (!bank_name || !branch_name || !account_number || !account_holder) {
      return NextResponse.json({ success: false, error: 'bank_name, branch_name, account_number, account_holder are required' }, { status: 400 });
    }

    await upsertAffiliateBankAccount({
      user_id: userId,
      bank_name,
      branch_name,
      account_type: account_type || 'savings',
      account_number,
      account_holder,
      has_invoice: has_invoice ?? false,
      invoice_number: invoice_number || '',
    });

    return NextResponse.json({ success: true, message: 'Bank account saved' });
  } catch (error) {
    console.error('Bank account POST error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save bank account',
    }, { status: 500 });
  }
}
