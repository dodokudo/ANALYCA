import { BigQuery } from '@google-cloud/bigquery';
import { randomUUID } from 'node:crypto';
import type { AdminPaymentData } from './admin-payment-data';

export function createAdminPaymentSnapshotStore(client: BigQuery, projectId: string) {
  if (!/^[\w-]+$/.test(projectId)) throw new Error('Invalid payment snapshot project');
  const table = `\`${projectId}.analyca.admin_payment_snapshots\``;
  let ready: Promise<void> | undefined;
  async function ensure(): Promise<void> {
    if (!ready) ready = (async () => {
      const [job] = await client.createQueryJob({ query: `CREATE TABLE IF NOT EXISTS ${table} (
        snapshot_id STRING NOT NULL, fetched_at TIMESTAMP NOT NULL, payload STRING NOT NULL
      ) PARTITION BY DATE(fetched_at) OPTIONS (partition_expiration_days = 30)` });
      await job.getQueryResults();
    })().catch(error => { ready = undefined; throw error; });
    return ready;
  }
  async function read(): Promise<AdminPaymentData | null> {
    // Serving a page never creates tables or calls the payment provider.
    const [rows] = await client.query({ query: `SELECT payload FROM ${table} ORDER BY fetched_at DESC LIMIT 1`, useQueryCache: false });
    return rows.length ? JSON.parse(String(rows[0].payload)) as AdminPaymentData : null;
  }
  async function save(data: AdminPaymentData): Promise<void> {
    if (data.error || !Number.isFinite(Date.parse(data.fetchedAt)) || !Object.keys(data.users).length
      || Object.values(data.users).some(user => !user.refundsComplete || user.netPaid == null || user.paidMonths == null)) {
      throw new Error('Incomplete payment snapshot cannot replace saved data');
    }
    await ensure();
    const id = randomUUID();
    const payload = JSON.stringify(data);
    const [job] = await client.createQueryJob({ query: `INSERT INTO ${table} (snapshot_id, fetched_at, payload)
      VALUES (@id, TIMESTAMP(@fetchedAt), @payload)`, params: { id, fetchedAt: data.fetchedAt, payload } });
    await job.getQueryResults();
    const [rows] = await client.query({ query: `SELECT payload FROM ${table} WHERE snapshot_id = @id`, params: { id }, useQueryCache: false });
    if (rows.length !== 1 || rows[0].payload !== payload) throw new Error('Saved payment snapshot could not be verified');
  }
  return { read, save };
}

let store: ReturnType<typeof createAdminPaymentSnapshotStore> | undefined;
export function adminPaymentSnapshotStore(): ReturnType<typeof createAdminPaymentSnapshotStore> {
  if (!store) {
    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || process.env.PROJECT_ID || '';
    const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || process.env.GOOGLE_CREDENTIALS || '{}');
    store = createAdminPaymentSnapshotStore(new BigQuery({ projectId, credentials, location: 'asia-northeast1' }), projectId);
  }
  return store;
}
