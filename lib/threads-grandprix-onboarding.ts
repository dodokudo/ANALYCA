import { randomUUID } from 'node:crypto';
import { getBigQueryClient, projectId } from '@/app/threads-grandprix/grandprix-bigquery';
import { sendEmail } from '@/lib/email';
import { GRANDPRIX_LINE_GROUP_URL, type GrandprixEvent } from '@/lib/threads-grandprix-events';

export async function sendGrandprixOnboardingEmail({ event, username, email }: {
  event: GrandprixEvent; username: string; email: string;
}): Promise<void> {
  const db = getBigQueryClient();
  const attemptId = randomUUID();
  const params = { eventId: event.eventId, username, email, attemptId };
  const table = `\`${projectId}.analyca.threads_grandprix_entries\``;
  try {
    // 同じ申込・メールへの重複送信を抑止。送信失敗時は再エントリーで再試行できる。
    await db.query({ query: `UPDATE ${table}
      SET login_email_status = 'pending', login_email_attempt_id = @attemptId,
          login_email_attempted_at = CURRENT_TIMESTAMP()
      WHERE event_id = @eventId AND normalized_threads_username = @username AND email = @email
        AND (login_email_status IS NULL OR login_email_status = 'failed'
          OR (login_email_status = 'pending' AND login_email_attempted_at < TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 15 MINUTE)))
        AND NOT EXISTS (SELECT 1 FROM \`${projectId}.analyca.users\` u
          WHERE LOWER(REGEXP_REPLACE(TRIM(u.threads_username), r'^@', '')) = @username)`, params });
    const [claimed] = await db.query({ query: `SELECT id FROM ${table}
      WHERE event_id = @eventId AND normalized_threads_username = @username
        AND email = @email AND login_email_attempt_id = @attemptId AND login_email_status = 'pending' LIMIT 1`, params });
    if (!claimed.length) return;
    const loginUrl = new URL('/login/threads', process.env.NEXT_PUBLIC_APP_URL || 'https://analyca.jp');
    loginUrl.searchParams.set('grandprix', event.eventId);
    await sendEmail(email, `${event.name} エントリー完了・ログインのご案内`, `
      <p>${event.name}へのエントリーありがとうございます。</p>
      <p>参加にあたって、お願いしたいことが2つあります。</p>
      <h2>1. LINEグループに参加してください</h2>
      <p>大会のアナウンスはLINEグループでお届けします。必ずご参加ください。</p>
      <p><a href="${GRANDPRIX_LINE_GROUP_URL}">LINEグループへ参加する</a></p>
      <h2>2. 下記からThreadsにログインしてください</h2>
      <p>今回のグランプリは、僕が作成した専用のシステムを使って集計を行います。</p>
      <p>必ず下記のリンクからThreadsにログインしてください。ログインして連携を完了すると、Threadsのフォロワー数や閲覧数などの数字が自動で集計されます！</p>
      <p><a href="${loginUrl.toString()}">Threadsにログインする</a></p>
      <p>申込時のThreadsアカウント（@${username}）でログインしてください。</p>
      <p>うまくログインできない場合は、LINEグループの運営までお知らせください。</p>
      <p>開催期間：${event.startDate}〜${event.endDate}</p>
      <p>ANALYCA運営</p>
    `, { retries: 1 });
    await db.query({ query: `UPDATE ${table} SET login_email_status = 'sent', login_email_sent_at = CURRENT_TIMESTAMP()
      WHERE login_email_attempt_id = @attemptId`, params: { attemptId } });
  } catch (error) {
    console.error('Grandprix login email failed', error);
    await db.query({ query: `UPDATE ${table} SET login_email_status = 'failed'
      WHERE login_email_attempt_id = @attemptId`, params: { attemptId } })
      .catch(() => console.error('Failed to record Grandprix email status'));
  }
}
