import nodemailer from 'nodemailer';
import * as Sentry from '@sentry/nextjs';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.lolipop.jp',
  port: Number(process.env.SMTP_PORT) || 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
});

const FROM_ADDRESS = 'ANALYCA <info@analyca.jp>';
const ADMIN_NOTIFICATION_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL || 'kudo@teckneat.com';

function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'https://analyca.jp';
}

function buildDashboardUrl(userId: string): string {
  return `${getAppUrl()}/${userId}`;
}

function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatAmount(amount: number | null | undefined): string {
  if (typeof amount !== 'number' || Number.isNaN(amount)) return '-';
  return `¥${amount.toLocaleString('ja-JP')}`;
}

/**
 * HTMLメールのベーステンプレート
 */
function wrapHtml(title: string, body: string): string {
  return `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f4f0fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Hiragino Sans',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f0fb;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#7c3aed,#6d28d9);padding:28px 32px;text-align:center;">
              <span style="font-size:24px;font-weight:700;color:#ffffff;letter-spacing:1px;">ANALYCA</span>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              ${body}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;background:#faf8ff;border-top:1px solid #ede9f6;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                &copy; ANALYCA - SNS分析ダッシュボード<br>
                <a href="https://analyca.jp" style="color:#7c3aed;text-decoration:none;">analyca.jp</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * メール送信ベース関数
 * SMTPエラーは必ずSentryに送信して即検知可能にする（握り潰し禁止）
 */
export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  try {
    const info = await transporter.sendMail({
      from: FROM_ADDRESS,
      to,
      subject,
      html,
    });
    console.log(`[EMAIL SENT] to=${to} subject="${subject.slice(0, 60)}" messageId=${info.messageId}`);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[EMAIL FAILED]', {
      to,
      subject: subject.slice(0, 80),
      error: err.message,
      code: (err as { code?: string }).code,
    });
    Sentry.captureException(err, {
      tags: { feature: 'email', recipient: to },
      extra: { subject, smtpHost: process.env.SMTP_HOST, smtpUser: process.env.SMTP_USER },
    });
    throw err;
  }
}

/**
 * 決済完了メール（初回登録時 = トライアル開始 or 即課金）
 */
export async function sendPaymentCompleteEmail(
  to: string,
  planName: string,
  loginUrl: string,
): Promise<void> {
  const body = `
    <h2 style="margin:0 0 16px;font-size:20px;color:#1f2937;">無料会員登録が完了しました</h2>
    <p style="margin:0 0 12px;font-size:15px;color:#374151;line-height:1.7;">
      ANALYCAへようこそ！<br>
      <strong>${planName}プラン</strong>の登録が完了しました。
    </p>
    <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.7;">
      下のボタンからログインして、SNSアカウントの連携を完了してください。
    </p>
    <table cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
      <tr>
        <td style="background:#7c3aed;border-radius:8px;">
          <a href="${loginUrl}" style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">
            ログインしてセットアップを始める
          </a>
        </td>
      </tr>
    </table>
    <div style="margin:0 0 24px;padding:16px 20px;background:#f5f3ff;border-left:4px solid #7c3aed;border-radius:4px;">
      <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#5b21b6;">7日間の無料体験中です</p>
      <p style="margin:0;font-size:13px;color:#4b5563;line-height:1.7;">
        体験期間中にご解約いただけば、料金は一切発生しません。<br>
        解約は「マイページ → 設定 → サブスクリプション」からいつでも可能です。
      </p>
    </div>
    <p style="margin:0;font-size:13px;color:#9ca3af;">
      ご不明な点がございましたら、このメールに返信してください。
    </p>
  `;

  await sendEmail(
    to,
    '【ANALYCA】無料会員登録が完了しました',
    wrapHtml('無料会員登録完了', body),
  );
}

interface AdminNotificationBase {
  userId: string;
  email?: string | null;
  username?: string | null;
  planName?: string | null;
  planId?: string | null;
  dashboardUrl?: string | null;
}

interface AdminCardRegisteredNotification extends AdminNotificationBase {
  scheduledPaymentAt?: Date | string | null;
}

export async function sendAdminCardRegisteredEmail(
  payload: AdminCardRegisteredNotification,
): Promise<void> {
  const dashboardUrl = payload.dashboardUrl || buildDashboardUrl(payload.userId);
  const body = `
    <h2 style="margin:0 0 16px;font-size:20px;color:#1f2937;">カード登録が完了しました</h2>
    <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.7;">
      無料開始ユーザーのカード登録が完了しました。
    </p>
    <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:14px;color:#374151;">
      <tr><td style="padding:8px 0;font-weight:600;width:140px;">ユーザーID</td><td style="padding:8px 0;">${payload.userId}</td></tr>
      <tr><td style="padding:8px 0;font-weight:600;">ユーザー名</td><td style="padding:8px 0;">${payload.username || '-'}</td></tr>
      <tr><td style="padding:8px 0;font-weight:600;">メール</td><td style="padding:8px 0;">${payload.email || '-'}</td></tr>
      <tr><td style="padding:8px 0;font-weight:600;">プラン</td><td style="padding:8px 0;">${payload.planName || payload.planId || '-'}</td></tr>
      <tr><td style="padding:8px 0;font-weight:600;">初回決済予定</td><td style="padding:8px 0;">${formatDateTime(payload.scheduledPaymentAt)}</td></tr>
      <tr><td style="padding:8px 0;font-weight:600;">ダッシュボード</td><td style="padding:8px 0;"><a href="${dashboardUrl}" style="color:#7c3aed;text-decoration:none;">${dashboardUrl}</a></td></tr>
    </table>
  `;

  await sendEmail(
    ADMIN_NOTIFICATION_EMAIL,
    '【ANALYCA 管理通知】カード登録完了',
    wrapHtml('カード登録完了', body),
  );
}

interface AdminPaymentNotification extends AdminNotificationBase {
  amount?: number | null;
  paidAt?: Date | string | null;
  paymentType?: string | null;
}

export async function sendAdminPaymentNotificationEmail(
  payload: AdminPaymentNotification,
): Promise<void> {
  const dashboardUrl = payload.dashboardUrl || buildDashboardUrl(payload.userId);
  const body = `
    <h2 style="margin:0 0 16px;font-size:20px;color:#1f2937;">決済が完了しました</h2>
    <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.7;">
      ${payload.paymentType || '決済'}の完了通知です。
    </p>
    <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:14px;color:#374151;">
      <tr><td style="padding:8px 0;font-weight:600;width:140px;">ユーザーID</td><td style="padding:8px 0;">${payload.userId}</td></tr>
      <tr><td style="padding:8px 0;font-weight:600;">ユーザー名</td><td style="padding:8px 0;">${payload.username || '-'}</td></tr>
      <tr><td style="padding:8px 0;font-weight:600;">メール</td><td style="padding:8px 0;">${payload.email || '-'}</td></tr>
      <tr><td style="padding:8px 0;font-weight:600;">プラン</td><td style="padding:8px 0;">${payload.planName || payload.planId || '-'}</td></tr>
      <tr><td style="padding:8px 0;font-weight:600;">決済金額</td><td style="padding:8px 0;">${formatAmount(payload.amount)}</td></tr>
      <tr><td style="padding:8px 0;font-weight:600;">決済日時</td><td style="padding:8px 0;">${formatDateTime(payload.paidAt)}</td></tr>
      <tr><td style="padding:8px 0;font-weight:600;">ダッシュボード</td><td style="padding:8px 0;"><a href="${dashboardUrl}" style="color:#7c3aed;text-decoration:none;">${dashboardUrl}</a></td></tr>
    </table>
  `;

  await sendEmail(
    ADMIN_NOTIFICATION_EMAIL,
    '【ANALYCA 管理通知】決済完了',
    wrapHtml('決済完了', body),
  );
}

/**
 * オンボーディング完了メール
 */
export async function sendOnboardingCompleteEmail(
  to: string,
  username: string,
  dashboardUrl: string,
): Promise<void> {
  const body = `
    <h2 style="margin:0 0 16px;font-size:20px;color:#1f2937;">セットアップ完了!</h2>
    <p style="margin:0 0 12px;font-size:15px;color:#374151;line-height:1.7;">
      <strong>${username}</strong> さん、ANALYCAのセットアップが完了しました。<br>
      ダッシュボードからSNSの分析データを確認できます。
    </p>
    <table cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
      <tr>
        <td style="background:#7c3aed;border-radius:8px;">
          <a href="${dashboardUrl}" style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">
            ダッシュボードを開く
          </a>
        </td>
      </tr>
    </table>
    <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.7;">
      データは毎日自動で更新されます。<br>
      投稿の分析結果を活用して、SNS運用を改善していきましょう。
    </p>

    <div style="margin:32px 0 24px;padding:24px;background:linear-gradient(135deg,#faf5ff,#f0fdf4);border-radius:10px;border:1px solid #e9d5ff;">
      <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#7c3aed;letter-spacing:0.5px;">🎁 期間限定プレゼント</p>
      <h3 style="margin:0 0 12px;font-size:18px;font-weight:700;color:#1f2937;line-height:1.5;">
        【2026年最新版】Threads 7大特典を無料配布！
      </h3>
      <p style="margin:0 0 16px;font-size:13px;color:#4b5563;line-height:1.7;">
        リール不要・文章だけで、フォロワー4,200名、LINE登録1,000名をわずか5ヶ月で集客し、SNS累計売上8,000万円を達成した売れる導線を公開。
      </p>
      <ul style="margin:0 0 20px;padding:0 0 0 20px;font-size:13px;color:#374151;line-height:1.9;">
        <li>AI×Threadsマスター動画講座（52分）</li>
        <li>Threads完全攻略ガイド（13,787文字）</li>
        <li>1撃でフォロワー1,000人増やした魔法のプロンプト</li>
        <li>SNSマーケで活用できるプロンプト30選</li>
        <li>売れる商品設計マニュアル（PDF49枚）</li>
        <li>5日で700万円売り上げたLINE配信テンプレ（PDF29枚）</li>
        <li>AI×Threads完全攻略セミナー参加券</li>
      </ul>
      <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
        <tr>
          <td style="background:#06c755;border-radius:8px;">
            <a href="https://liff.line.me/2007350099-K9dE2l1E/landing?follow=%40118dgavc&amp;lp=W9tx5Y&amp;liff_id=2007350099-K9dE2l1E" style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;">
              ▼ LINEで受け取る ▼
            </a>
          </td>
        </tr>
      </table>
    </div>

    <div style="margin:0 0 24px;padding:20px;background:#fff7ed;border-radius:10px;border:1px solid #fed7aa;">
      <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#c2410c;letter-spacing:0.5px;">🎤 登録者限定セミナー</p>
      <h3 style="margin:0 0 12px;font-size:16px;font-weight:700;color:#1f2937;">
        AI×Threads完全攻略セミナー
      </h3>
      <ul style="margin:0 0 12px;padding:0 0 0 20px;font-size:13px;color:#374151;line-height:1.9;">
        <li>4月23日（木）20:00〜22:00</li>
        <li>4月24日（金）20:00〜22:00</li>
        <li>4月25日（土）13:00〜15:00</li>
        <li>4月25日（土）20:00〜22:00</li>
      </ul>
      <p style="margin:0;font-size:12px;color:#6b7280;line-height:1.7;">
        上記LINE登録後、セミナー参加URLをお送りします。ご都合の良い回にご参加ください。
      </p>
    </div>

    <p style="margin:0;font-size:13px;color:#9ca3af;">
      ご不明な点がございましたら、このメールに返信してください。
    </p>
  `;

  await sendEmail(
    to,
    '【ANALYCA】セットアップが完了しました',
    wrapHtml('セットアップ完了', body),
  );
}


/**
 * 解約完了メール
 */
export async function sendCancellationEmail(
  to: string,
  planName: string,
  expiresAt: string,
): Promise<void> {
  const body = `
    <h2 style="margin:0 0 16px;font-size:20px;color:#1f2937;">解約が完了しました</h2>
    <p style="margin:0 0 12px;font-size:15px;color:#374151;line-height:1.7;">
      ANALYCAをご利用いただきありがとうございます。<br>
      <strong>${planName}プラン</strong>の解約が完了しました。
    </p>
    <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.7;">
      <strong>${expiresAt}</strong>まで引き続きご利用いただけます。<br>
      期限後はダッシュボードへのアクセスが制限されます。
    </p>
    <p style="margin:0 0 12px;font-size:15px;color:#374151;line-height:1.7;">
      再度ご利用を検討される場合は、いつでもプランを再開できます。
    </p>
    <p style="margin:0;font-size:13px;color:#9ca3af;">
      ご不明な点がございましたら、このメールに返信してください。
    </p>
  `;

  await sendEmail(
    to,
    '【ANALYCA】解約が完了しました',
    wrapHtml('解約完了', body),
  );
}
