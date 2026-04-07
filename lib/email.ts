import nodemailer from 'nodemailer';

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
 */
export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  await transporter.sendMail({
    from: FROM_ADDRESS,
    to,
    subject,
    html,
  });
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
    <p style="margin:0 0 12px;font-size:15px;color:#374151;line-height:1.7;">
      データは毎日自動で更新されます。<br>
      投稿の分析結果を活用して、SNS運用を改善していきましょう。
    </p>
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
 * カード登録完了メール（ユーザー宛）
 * 無料会員登録完了後、ログインURLを案内する
 */
export async function sendCardRegisteredUserEmail(
  to: string,
  loginUrl: string,
): Promise<void> {
  const body = `
    <h2 style="margin:0 0 16px;font-size:20px;color:#1f2937;">無料会員登録が完了しました</h2>
    <p style="margin:0 0 12px;font-size:15px;color:#374151;line-height:1.7;">
      ANALYCAへようこそ！<br>
      カード登録が完了し、無料トライアルが開始されました。
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
