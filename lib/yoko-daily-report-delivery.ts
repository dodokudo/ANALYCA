import { BigQuery } from '@google-cloud/bigquery';
import { dailyReportRetryKey } from './yoko-daily-report';

interface Destination { id: string; name: string }
export interface DailyDelivery {
  jobId: string;
  state: 'sending' | 'sent' | 'unconfirmed';
  lineMessageId: string | null;
}

export function createDailyDeliveryStore(client: BigQuery, projectId: string, prefix = 'yoko_daily_report') {
  if (!/^[\w-]+$/.test(projectId) || !/^\w+$/.test(prefix)) throw new Error('Invalid delivery store configuration');
  const log = `\`${projectId}.analyca.${prefix}_deliveries\``;
  const lock = `\`${projectId}.analyca.${prefix}_lock\``;
  let ready: Promise<void> | null = null;
  async function ensure(): Promise<void> {
    if (!ready) ready = client.query({ query: `
      CREATE TABLE IF NOT EXISTS ${lock} AS SELECT 1 AS id, 0 AS version;
      CREATE TABLE IF NOT EXISTS ${log} (
        job_id STRING NOT NULL, group_id STRING NOT NULL, report_date DATE NOT NULL,
        state STRING NOT NULL, message_json STRING NOT NULL, line_message_id STRING,
        created_at TIMESTAMP NOT NULL, updated_at TIMESTAMP NOT NULL
      ) CLUSTER BY group_id, report_date;
    ` }).then(() => undefined).catch(error => { ready = null; throw error; });
    return ready;
  }
  async function claim(destination: Destination, date: string, message: Record<string, unknown>): Promise<boolean> {
    await ensure();
    const jobId = dailyReportRetryKey(destination.id, date, 'daily');
    const [rows] = await client.query({ query: `
      DECLARE claimed BOOL DEFAULT FALSE;
      BEGIN TRANSACTION;
      UPDATE ${lock} SET version = version + 1 WHERE id = 1;
      ASSERT @@row_count = 1 AS 'DAILY_REPORT_LOCK_MISSING';
      IF NOT EXISTS (SELECT 1 FROM ${log} WHERE job_id = @jobId) THEN
        INSERT INTO ${log} (job_id, group_id, report_date, state, message_json, created_at, updated_at)
        VALUES (@jobId, @groupId, DATE(@date), 'sending', @message, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP());
        SET claimed = TRUE;
      END IF;
      COMMIT TRANSACTION;
      SELECT claimed;
    `, params: { jobId, groupId: destination.id, date, message: JSON.stringify(message) } });
    return rows[0]?.claimed === true;
  }
  async function read(groupId: string, date: string): Promise<DailyDelivery | null> {
    await ensure();
    const jobId = dailyReportRetryKey(groupId, date, 'daily');
    const [rows] = await client.query({ query: `SELECT job_id, state, line_message_id FROM ${log} WHERE job_id = @jobId`, params: { jobId }, useQueryCache: false });
    return rows[0] ? { jobId: rows[0].job_id, state: rows[0].state, lineMessageId: rows[0].line_message_id ?? null } : null;
  }
  async function finish(groupId: string, date: string, messageId: string | null): Promise<void> {
    const jobId = dailyReportRetryKey(groupId, date, 'daily');
    await client.query({ query: `UPDATE ${log} SET state = @state, line_message_id = @messageId, updated_at = CURRENT_TIMESTAMP()
      WHERE job_id = @jobId AND state = 'sending'`, params: { jobId, state: messageId ? 'sent' : 'unconfirmed', messageId }, types: { messageId: 'STRING' } });
  }
  return { ensure, claim, read, finish };
}

export function dailyDeliveryStore(): ReturnType<typeof createDailyDeliveryStore> {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || process.env.PROJECT_ID || 'mark-454114';
  const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || process.env.GOOGLE_CREDENTIALS || '{}');
  return createDailyDeliveryStore(new BigQuery({ projectId, credentials, location: 'asia-northeast1' }), projectId);
}

export async function requestDailyFlex(destination: Destination, date: string, message: Record<string, unknown>, validateOnly: boolean): Promise<{ groupName: string; messageId: string | null }> {
  const key = process.env.THREADS_LINE_API_KEY;
  if (!key) throw new Error('LINE送信APIが未設定です');
  const response = await fetch(process.env.GUARDIAN_SEND_THREAD_MESSAGE_URL || 'https://guardian-webhook-383002618526.asia-northeast1.run.app/send-thread-message', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ groupId: destination.id, expectedGroupName: destination.name, retryKey: dailyReportRetryKey(destination.id, date, 'daily'), validateOnly, messages: [message] }),
    signal: AbortSignal.timeout(20000),
  });
  const result = await response.json() as { success?: boolean; validated?: boolean; groupName?: string; sentMessages?: Array<{ id?: string }> };
  if (!response.ok || !result.success || (validateOnly && !result.validated)) throw new Error(`LINEへの${validateOnly ? '形式・宛先確認' : '送信'}が確認できませんでした（${response.status}）`);
  const messageId = result.sentMessages?.[0]?.id ?? null;
  if (!validateOnly && !messageId) throw new Error('LINE送信結果のメッセージIDが取得できませんでした');
  return { groupName: result.groupName || destination.name, messageId };
}

/** Claim before sending. Ambiguous delivery is held for review, never automatically resent. */
export async function deliverDailyReport(destination: Destination, date: string, message: Record<string, unknown>, dependencies = {
  store: dailyDeliveryStore(), request: requestDailyFlex,
}): Promise<{ sent: boolean; delivery: DailyDelivery | null }> {
  const { store, request } = dependencies;
  const existing = await store.read(destination.id, date);
  if (existing) return { sent: false, delivery: existing };
  await request(destination, date, message, true);
  if (!await store.claim(destination, date, message)) return { sent: false, delivery: await store.read(destination.id, date) };
  try {
    const accepted = await request(destination, date, message, false);
    await store.finish(destination.id, date, accepted.messageId);
  } catch (error) {
    await store.finish(destination.id, date, null).catch(() => {});
    throw error;
  }
  const delivery = await store.read(destination.id, date);
  if (delivery?.state !== 'sent') throw new Error('送信記録を確認できませんでした');
  return { sent: true, delivery };
}
