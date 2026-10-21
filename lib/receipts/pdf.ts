import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { jsPDF } from 'jspdf';
import { COURSE_NAME, taxFor, titleFor, type DocumentKind, type Issue } from './domain';

let fontPromise: Promise<string> | undefined;
export async function renderDocument(issue: Issue, kind: DocumentKind, sample = false): Promise<Buffer> {
  if (kind === 'invoice' && issue.method !== 'bank') throw new Error('Card payments have no invoice');
  fontPromise ??= readFile(path.join(process.cwd(), 'lib/receipts/fonts/NotoSansJP-Regular.ttf')).then(b => b.toString('base64'));
  const documentAmount = kind === 'invoice' ? (issue.invoiceAmount ?? issue.amount) : issue.amount;
  const productName = issue.productName || COURSE_NAME;
  const mixed = !!issue.bankAmount && !!issue.cardAmount;
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true, putOnlyUsedFonts: true });
  pdf.addFileToVFS('NotoSansJP-Regular.ttf', await fontPromise);
  pdf.addFont('NotoSansJP-Regular.ttf', 'NotoSansJP', 'normal');
  pdf.setFont('NotoSansJP');
  const font = (size: number) => pdf.setFontSize(size);
  const text = (s: string, x: number, y: number) => pdf.text(s, x, y);
  const date = (s: string) => s.replace(/^(\d+)-(\d+)-(\d+)$/, '$1年$2月$3日');
  const yen = (n: number) => `¥${n.toLocaleString('ja-JP')}`;
  pdf.setTextColor(25, 30, 37);
  font(9);
  pdf.text(`発行日：${date(issue.issuedDate)}\n${titleFor(kind)}番号：${kind === 'receipt' ? 'RCT' : 'INV'}-${issue.number}`, 188, 22, { align: 'right', lineHeightFactor: 1.7 });
  font(24); pdf.text(titleFor(kind), 105, 48, { align: 'center' });
  if (sample) { font(12); pdf.setTextColor(160, 40, 40); pdf.text('見本・発行されません', 105, 58, { align: 'center' }); pdf.setTextColor(25, 30, 37); }
  font(14);
  const nameLines = pdf.splitTextToSize(`${issue.name} 様`, 165);
  text(nameLines, 22, 76);
  let y = 76 + nameLines.length * 7;
  if (issue.address) { font(9); const lines = pdf.splitTextToSize(issue.address, 165); text(lines, 22, y + 3); y += lines.length * 5 + 5; }
  y = Math.max(103, y + 12);
  pdf.setDrawColor(35, 43, 53); pdf.setLineWidth(0.4); pdf.rect(22, y, 166, 25);
  font(10); text(kind === 'receipt' ? '領収金額' : 'ご請求金額（お支払い済み）', 28, y + 10);
  font(25); pdf.text(yen(documentAmount), 181, y + 17, { align: 'right' });
  y += 37; font(10);
  text(`但し：${productName} 受講料として`, 22, y);
  y += 9; text(`お支払い方法：${mixed ? 'カード・銀行振込の併用' : issue.method === 'bank' ? '銀行振込' : 'クレジットカード決済'}`, 22, y);
  if (mixed) { y += 7; font(8); text(kind === 'invoice' ? 'この請求書は銀行振込分です（お支払い済み）。' : `内訳：カード ${yen(issue.cardAmount!)} ／ 銀行振込 ${yen(issue.bankAmount!)}`, 22, y); font(10); }
  y += 9; text(`お支払い日：${date(issue.paidDate)}`, 22, y);
  y += 12;
  text(kind === 'receipt' ? '上記金額を領収いたしました。' : 'お支払い済みです。追加のお支払いやお手続きは不要です。', 22, y);
  y += 13; pdf.setDrawColor(180, 186, 194); pdf.line(22, y, 188, y);
  y += 10; font(9);
  text(`10%対象額（税込） ${yen(documentAmount)}　／　内消費税額 ${yen(taxFor(documentAmount))}`, 22, y);
  if (issue.method === 'bank') {
    y += 14; text('振込先', 22, y); y += 7;
    text('GMOあおぞらネット銀行　法人営業部（101）', 22, y); y += 7;
    text('普通 1159065　カ）ドゥードゥー', 22, y);
  }
  const companyY = Math.max(y + 20, 233);
  font(11); text('株式会社DoDo', 110, companyY);
  font(8.5);
  text('登録番号：T7020001133609\n〒104-0061 東京都中央区銀座一丁目22番11号\n銀座大竹ビジデンス2階\n担当者：工藤　TEL：03-6850-7774\ndodo.inc.kudo@gmail.com', 110, companyY + 8);
  pdf.setProperties({ title: `${titleFor(kind)} ${issue.number}`, author: '株式会社DoDo', subject: productName });
  return Buffer.from(pdf.output('arraybuffer'));
}
