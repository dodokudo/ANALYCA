import { BigQuery } from '@google-cloud/bigquery';

const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || process.env.PROJECT_ID;
const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || process.env.GOOGLE_CREDENTIALS || '{}';

function parseCredentials(json: string): Record<string, unknown> {
  try {
    return JSON.parse(json);
  } catch {
    return {};
  }
}

const bigquery = new BigQuery({
  projectId,
  credentials: parseCredentials(credentialsJson),
});

export type NotificationItem = {
  notification_id: string;
  title: string;
  body: string | null;
  link: string | null;
  type: string | null;
  created_at: string;
  is_read: boolean;
};

export async function listNotificationsForUser(userId: string, limit = 50): Promise<NotificationItem[]> {
  const query = `
    SELECT
      n.notification_id,
      n.title,
      n.body,
      n.link,
      n.type,
      n.created_at,
      r.read_at IS NOT NULL AS is_read
    FROM \`${projectId}.analyca.notifications\` n
    LEFT JOIN \`${projectId}.analyca.notification_reads\` r
      ON r.notification_id = n.notification_id AND r.user_id = @userId
    WHERE n.target_user_id IS NULL OR n.target_user_id = @userId
    ORDER BY n.created_at DESC
    LIMIT @limit
  `;
  const [rows] = await bigquery.query({
    query,
    params: { userId, limit },
    types: { userId: 'STRING', limit: 'INT64' },
  });
  return rows.map((row: Record<string, unknown>) => ({
    notification_id: String(row.notification_id ?? ''),
    title: String(row.title ?? ''),
    body: row.body == null ? null : String(row.body),
    link: row.link == null ? null : String(row.link),
    type: row.type == null ? null : String(row.type),
    created_at: row.created_at && typeof row.created_at === 'object' && 'value' in (row.created_at as Record<string, unknown>)
      ? String((row.created_at as Record<string, unknown>).value)
      : String(row.created_at ?? ''),
    is_read: Boolean(row.is_read),
  }));
}

export async function markNotificationRead(userId: string, notificationId: string): Promise<void> {
  const query = `
    MERGE \`${projectId}.analyca.notification_reads\` t
    USING (SELECT @userId AS user_id, @notificationId AS notification_id) s
    ON t.user_id = s.user_id AND t.notification_id = s.notification_id
    WHEN NOT MATCHED THEN
      INSERT (user_id, notification_id, read_at)
      VALUES (s.user_id, s.notification_id, CURRENT_TIMESTAMP())
  `;
  const [job] = await bigquery.createQueryJob({
    query,
    params: { userId, notificationId },
    types: { userId: 'STRING', notificationId: 'STRING' },
  });
  await job.getQueryResults();
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const query = `
    INSERT INTO \`${projectId}.analyca.notification_reads\` (user_id, notification_id, read_at)
    SELECT @userId, n.notification_id, CURRENT_TIMESTAMP()
    FROM \`${projectId}.analyca.notifications\` n
    LEFT JOIN \`${projectId}.analyca.notification_reads\` r
      ON r.notification_id = n.notification_id AND r.user_id = @userId
    WHERE (n.target_user_id IS NULL OR n.target_user_id = @userId)
      AND r.read_at IS NULL
  `;
  const [job] = await bigquery.createQueryJob({
    query,
    params: { userId },
    types: { userId: 'STRING' },
  });
  await job.getQueryResults();
}
