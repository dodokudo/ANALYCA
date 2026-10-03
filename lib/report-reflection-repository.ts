import { BigQuery } from '@google-cloud/bigquery';
import { parseReflectionWrite, type ReflectionRevision, type ReflectionWrite } from './report-reflection';

export class ReflectionConflict extends Error {}

/** A singleton lock row also serializes first writes, when no account/month row exists yet.
 * The append-only revision and concurrency check commit in the same transaction.
 * https://docs.cloud.google.com/bigquery/docs/transactions#transaction_concurrency
 */
export function createReflectionRepository(client: BigQuery, projectId: string, prefix = 'threads_report_reflection') {
  if (!/^[\w-]+$/.test(projectId) || !/^\w+$/.test(prefix)) throw new Error('Invalid reflection storage configuration');
  const revisions = `\`${projectId}.analyca.${prefix}_revisions\``;
  const lock = `\`${projectId}.analyca.${prefix}_lock\``;
  let ready: Promise<void> | null = null;
  async function ensure(): Promise<void> {
    if (!ready) ready = (async () => {
      await client.query({ query: `
        CREATE TABLE IF NOT EXISTS ${lock} AS SELECT 1 AS id, 0 AS version;
        CREATE TABLE IF NOT EXISTS ${revisions} (
          user_id STRING NOT NULL, month STRING NOT NULL, revision INT64 NOT NULL,
          request_id STRING NOT NULL, fields_json STRING NOT NULL,
          saved_at TIMESTAMP NOT NULL
        ) CLUSTER BY user_id, month;
      ` });
    })().catch(error => { ready = null; throw error; });
    return ready;
  }
  function decode(row: Record<string, unknown>): ReflectionRevision {
    const stamp = row.saved_at as { value?: string } | string;
    return { revision: Number(row.revision), requestId: String(row.request_id), fields: JSON.parse(String(row.fields_json)),
      savedAt: typeof stamp === 'string' ? stamp : stamp.value! };
  }
  async function read(userId: string, month: string, limit = 1): Promise<ReflectionRevision[]> {
    await ensure();
    const [rows] = await client.query({ query: `SELECT * FROM ${revisions}
      WHERE user_id = @userId AND month = @month
      ORDER BY revision DESC LIMIT @limit`, params: { userId, month, limit }, useQueryCache: false });
    return rows.map(decode);
  }
  async function save(userId: string, month: string, value: ReflectionWrite): Promise<ReflectionRevision> {
    const input = parseReflectionWrite(value);
    await ensure();
    const params = { userId, month, expected: input.expectedRevision, requestId: input.requestId,
      fields: JSON.stringify(input.fields) };
    try {
      const [rows] = await client.query({ query: `
        BEGIN TRANSACTION;
        UPDATE ${lock} SET version = version + 1 WHERE id = 1;
        ASSERT @@row_count = 1 AS 'REFLECTION_LOCK_MISSING';
        IF EXISTS (SELECT 1 FROM ${revisions} WHERE user_id = @userId AND month = @month AND request_id = @requestId) THEN
          ASSERT (SELECT COUNT(*) = 1 FROM ${revisions} WHERE user_id = @userId AND month = @month
            AND request_id = @requestId AND fields_json = @fields AND revision = @expected + 1)
            AS 'REFLECTION_REQUEST_MISMATCH';
        ELSE
          ASSERT (SELECT COALESCE(MAX(revision), 0) = @expected FROM ${revisions}
            WHERE user_id = @userId AND month = @month) AS 'REFLECTION_CONFLICT';
          INSERT INTO ${revisions} (user_id, month, revision, request_id, fields_json, saved_at)
            VALUES (@userId, @month, @expected + 1, @requestId, @fields, CURRENT_TIMESTAMP());
        END IF;
        COMMIT TRANSACTION;
        SELECT * FROM ${revisions} WHERE user_id = @userId AND month = @month AND request_id = @requestId;
      `, params, useQueryCache: false });
      if (rows.length !== 1) throw new Error('Saved reflection could not be verified');
      const saved = decode(rows[0]);
      if (JSON.stringify(saved.fields) !== params.fields || saved.revision !== input.expectedRevision + 1) {
        throw new Error('Saved reflection did not match the request');
      }
      return saved;
    } catch (error) {
      if (/REFLECTION_CONFLICT|REFLECTION_REQUEST_MISMATCH/.test(String(error))) throw new ReflectionConflict('別の画面で更新されています。入力した文章を保持しています');
      throw error;
    }
  }
  return { ensure, read, save };
}

let repository: ReturnType<typeof createReflectionRepository> | null = null;
export function reflectionRepository(): ReturnType<typeof createReflectionRepository> {
  if (!repository) {
    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || process.env.PROJECT_ID || '';
    const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || process.env.GOOGLE_CREDENTIALS || '{}');
    repository = createReflectionRepository(new BigQuery({ projectId, credentials, location: 'asia-northeast1' }), projectId);
  }
  return repository;
}
