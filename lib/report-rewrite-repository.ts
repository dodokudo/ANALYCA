import { BigQuery } from '@google-cloud/bigquery';
import { ReflectionConflict } from './report-reflection-repository';
import { parseRewriteWrite, type RewriteRevision, type RewriteState, type RewriteWrite } from './report-rewrite';

/** Separate append-only storage: this repository never writes to the original report tables. */
export function createRewriteRepository(client: BigQuery, projectId: string, prefix = 'threads_report_rewrite') {
  if (!/^[\w-]+$/.test(projectId) || !/^\w+$/.test(prefix)) throw new Error('Invalid rewrite storage configuration');
  const revisions = `\`${projectId}.analyca.${prefix}_revisions\``;
  const lock = `\`${projectId}.analyca.${prefix}_lock\``;
  let ready: Promise<void> | null = null;
  async function ensure(): Promise<void> {
    if (!ready) ready = (async () => {
      await client.query({ query: `
        CREATE TABLE IF NOT EXISTS ${lock} AS SELECT 1 AS id, 0 AS version;
        CREATE TABLE IF NOT EXISTS ${revisions} (
          user_id STRING NOT NULL, month STRING NOT NULL, revision INT64 NOT NULL,
          request_id STRING NOT NULL, status STRING NOT NULL, report_json STRING NOT NULL,
          saved_at TIMESTAMP NOT NULL
        ) CLUSTER BY user_id, month;
      ` });
    })().catch(error => { ready = null; throw error; });
    return ready;
  }
  function decode(row: Record<string, unknown>): RewriteRevision {
    const stamp = row.saved_at as { value?: string } | string;
    return {
      revision: Number(row.revision), requestId: String(row.request_id),
      status: row.status as RewriteRevision['status'], report: JSON.parse(String(row.report_json)),
      savedAt: typeof stamp === 'string' ? stamp : stamp.value!,
    };
  }
  async function read(userId: string, month: string): Promise<RewriteState> {
    await ensure();
    const [rows] = await client.query({ query: `
      WITH scoped AS (SELECT * FROM ${revisions} WHERE user_id = @userId AND month = @month)
      SELECT * FROM scoped WHERE revision = (SELECT MAX(revision) FROM scoped)
        OR revision = (SELECT MAX(revision) FROM scoped WHERE status = 'submitted')
      ORDER BY revision DESC`, params: { userId, month }, useQueryCache: false });
    const items = rows.map(decode);
    return { current: items[0] ?? null, submitted: items.find(item => item.status === 'submitted') ?? null };
  }
  async function save(userId: string, month: string, value: RewriteWrite): Promise<RewriteRevision> {
    const input = parseRewriteWrite(value);
    await ensure();
    const params = {
      userId, month, expected: input.expectedRevision, requestId: input.requestId,
      status: input.status, report: JSON.stringify(input.report),
    };
    try {
      const [rows] = await client.query({ query: `
        BEGIN TRANSACTION;
        UPDATE ${lock} SET version = version + 1 WHERE id = 1;
        ASSERT @@row_count = 1 AS 'REWRITE_LOCK_MISSING';
        IF EXISTS (SELECT 1 FROM ${revisions} WHERE user_id = @userId AND month = @month AND request_id = @requestId) THEN
          ASSERT (SELECT COUNT(*) = 1 FROM ${revisions} WHERE user_id = @userId AND month = @month
            AND request_id = @requestId AND report_json = @report AND status = @status AND revision = @expected + 1)
            AS 'REWRITE_REQUEST_MISMATCH';
        ELSE
          ASSERT (SELECT COALESCE(MAX(revision), 0) = @expected FROM ${revisions}
            WHERE user_id = @userId AND month = @month) AS 'REWRITE_CONFLICT';
          INSERT INTO ${revisions} (user_id, month, revision, request_id, status, report_json, saved_at)
            VALUES (@userId, @month, @expected + 1, @requestId, @status, @report, CURRENT_TIMESTAMP());
        END IF;
        COMMIT TRANSACTION;
        SELECT * FROM ${revisions} WHERE user_id = @userId AND month = @month AND request_id = @requestId;
      `, params, useQueryCache: false });
      if (rows.length !== 1) throw new Error('Saved rewrite could not be verified');
      const saved = decode(rows[0]);
      if (JSON.stringify(saved.report) !== params.report || saved.status !== input.status || saved.revision !== input.expectedRevision + 1) {
        throw new Error('Saved rewrite did not match the request');
      }
      return saved;
    } catch (error) {
      if (/REWRITE_CONFLICT|REWRITE_REQUEST_MISMATCH|concurrent update|transaction.*aborted/i.test(String(error))) {
        throw new ReflectionConflict('別の画面で更新されました。入力内容を控えてから最新の保存内容を読み込んでください');
      }
      throw error;
    }
  }
  return { ensure, read, save };
}

let repository: ReturnType<typeof createRewriteRepository> | null = null;
export function rewriteRepository(): ReturnType<typeof createRewriteRepository> {
  if (!repository) {
    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || process.env.PROJECT_ID || '';
    const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || process.env.GOOGLE_CREDENTIALS || '{}');
    repository = createRewriteRepository(new BigQuery({ projectId, credentials, location: 'asia-northeast1' }), projectId);
  }
  return repository;
}
