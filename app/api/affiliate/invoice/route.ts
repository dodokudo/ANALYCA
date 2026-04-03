import { NextRequest, NextResponse } from 'next/server';
import { jsPDF } from 'jspdf';
import { getAffiliateBankAccount, getAffiliateByCode, getMonthlyRewardSummary, getReferralsByAffiliateCode } from '@/lib/bigquery';

export async function GET(request: NextRequest) {
  try {
    const affiliateCode = request.nextUrl.searchParams.get('affiliateCode');
    const month = request.nextUrl.searchParams.get('month');

    if (!affiliateCode || !month) {
      return NextResponse.json(
        { success: false, error: 'affiliateCode and month are required' },
        { status: 400 },
      );
    }

    // アフィリエイト情報からuser_idを取得
    const affiliate = await getAffiliateByCode(affiliateCode);
    if (!affiliate) {
      return NextResponse.json({ success: false, error: 'Affiliate not found' }, { status: 404 });
    }

    // データ取得を並列実行
    const [summary, referrals, bankAccount] = await Promise.all([
      getMonthlyRewardSummary(affiliateCode, month),
      getReferralsByAffiliateCode(affiliateCode),
      getAffiliateBankAccount(affiliate.user_id),
    ]);

    // 対象月の紹介のみフィルタ
    const monthlyReferrals = referrals.filter((r) => {
      const refMonth = r.created_at.substring(0, 7);
      return refMonth === month;
    });

    // 源泉徴収の再計算（インボイス登録ありなら源泉なし）
    const hasInvoice = bankAccount?.has_invoice ?? false;
    const commission = summary.commission_amount;
    const withholdingTax = hasInvoice ? 0 : Math.floor(commission * 0.1021);
    const netAmount = commission - withholdingTax;

    // PDF生成
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    doc.setFont('helvetica');

    const pageWidth = 210;
    const margin = 20;
    let y = 20;

    // ヘッダー
    doc.setFontSize(20);
    doc.setTextColor(124, 58, 237);
    doc.text('ANALYCA', margin, y);
    y += 10;

    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text('Invoice / Seikyu-sho', margin, y);
    y += 12;

    // 発行情報
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    const today = new Date();
    doc.text(`Issue Date: ${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`, margin, y);
    y += 6;
    doc.text(`Period: ${month}`, margin, y);
    y += 6;
    doc.text(`Affiliate Code: ${affiliateCode}`, margin, y);
    y += 6;
    if (bankAccount?.account_holder) {
      doc.text(`Account Holder: ${bankAccount.account_holder}`, margin, y);
      y += 6;
    }
    y += 4;

    // 区切り線
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    // 明細テーブルヘッダー
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text('Date', margin, y);
    doc.text('Plan', margin + 40, y);
    doc.text('Amount', margin + 90, y);
    doc.text('Commission', margin + 130, y);
    y += 3;
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;

    // 明細行
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    for (const ref of monthlyReferrals) {
      if (y > 260) {
        doc.addPage();
        y = 20;
      }
      const dateStr = ref.created_at.substring(0, 10);
      doc.text(dateStr, margin, y);
      doc.text(ref.plan_id || '-', margin + 40, y);
      doc.text(`${ref.payment_amount.toLocaleString()} JPY`, margin + 90, y);
      doc.text(`${ref.commission_amount.toLocaleString()} JPY`, margin + 130, y);
      y += 6;
    }

    if (monthlyReferrals.length === 0) {
      doc.text('No referrals in this period.', margin, y);
      y += 6;
    }

    y += 4;
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    // サマリー
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Summary', margin, y);
    y += 7;

    doc.setFont('helvetica', 'normal');
    doc.text(`Total Referrals: ${summary.total_referrals}`, margin, y);
    y += 6;
    doc.text(`Total Sales Amount: ${summary.total_amount.toLocaleString()} JPY`, margin, y);
    y += 6;
    doc.text(`Commission (subtotal): ${commission.toLocaleString()} JPY`, margin, y);
    y += 6;
    if (!hasInvoice) {
      doc.text(`Withholding Tax (10.21%): -${withholdingTax.toLocaleString()} JPY`, margin, y);
      y += 6;
    }
    doc.setFont('helvetica', 'bold');
    doc.text(`Net Payment: ${netAmount.toLocaleString()} JPY`, margin, y);
    y += 12;

    // インボイス番号
    if (hasInvoice && bankAccount?.invoice_number) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(`Invoice Registration No.: ${bankAccount.invoice_number}`, margin, y);
      y += 8;
    }

    // 支払元
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text('Payer: DoDo Inc. (Kabushiki Kaisha DoDo)', margin, y);
    y += 6;
    doc.text('Service: ANALYCA Affiliate Program', margin, y);

    // PDF出力
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="analyca-invoice-${affiliateCode}-${month}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Invoice generation error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate invoice',
    }, { status: 500 });
  }
}
