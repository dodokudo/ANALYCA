import { Storage, type Bucket } from '@google-cloud/storage';
import { ReceiptError, hash } from './domain';

export function credentials() {
  const raw = process.env.RECEIPTS_GOOGLE_CREDENTIALS || process.env.GOOGLE_CREDENTIALS || process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || '{}';
  try { return JSON.parse(raw); } catch { throw new ReceiptError('発行サービスの接続設定を確認中です。', 503); }
}
let bucket: Bucket | undefined;
let verified: Promise<void> | undefined;
export async function receiptBucket(): Promise<Bucket> {
  if (!process.env.RECEIPTS_BUCKET) throw new ReceiptError('現在、発行の準備中です。', 503);
  bucket ??= new Storage({ credentials: credentials() }).bucket(process.env.RECEIPTS_BUCKET);
  // Never save customer data into the existing public media bucket.
  const b = bucket;
  verified ??= b.getMetadata().then(([m]) => {
    if (m.iamConfiguration?.publicAccessPrevention !== 'enforced' || !m.iamConfiguration?.uniformBucketLevelAccess?.enabled) throw new Error('Receipt bucket must enforce private, uniform access');
  }).catch(e => { verified = undefined; throw e; });
  await verified;
  return b;
}
export async function readRecord<T>(key: string): Promise<{ value: T; generation: string } | null> {
  const file = (await receiptBucket()).file(key);
  try {
    // Read the contents and generation from the same response. A separate
    // metadata request adds latency and can race with background delivery writes.
    const stream = file.createReadStream();
    let generation: string | undefined;
    stream.on('response', response => { generation = response.headers['x-goog-generation']; });
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    if (!generation) throw new Error('Missing receipt record generation');
    return { value: JSON.parse(Buffer.concat(chunks).toString()), generation };
  } catch (e) { if ((e as { code?: number }).code === 404) return null; throw e; }
}
export async function writeRecord(key: string, value: unknown, generation: string | number = 0): Promise<void> {
  await (await receiptBucket()).file(key).save(JSON.stringify(value), {
    resumable: false, contentType: 'application/json', preconditionOpts: { ifGenerationMatch: generation },
    metadata: { cacheControl: 'private, no-store' },
  });
}
export async function withLock<T>(key: string, action: () => Promise<T>): Promise<T> {
  const lockKey = `locks/${key}.json`;
  const existing = await readRecord<{ until: number }>(lockKey);
  if (existing && existing.value.until > Date.now()) throw new ReceiptError('発行処理中です。少し待ってからもう一度お試しください。', 409);
  try { await writeRecord(lockKey, { until: Date.now() + 180_000 }, existing?.generation || 0); }
  catch (e) { if ((e as { code?: number }).code === 412) throw new ReceiptError('発行処理中です。少し待ってからもう一度お試しください。', 409); throw e; }
  const acquired = await readRecord<{ until: number }>(lockKey);
  try { return await action(); }
  finally {
    if (acquired) await (await receiptBucket()).file(lockKey).delete({ ifGenerationMatch: acquired.generation }).catch(() => undefined);
  }
}
export async function rateLimit(identifier: string, max: number): Promise<void> {
  const key = `rate/${new Date().toISOString().slice(0, 13)}/${hash(identifier)}.json`;
  for (let n = 0; n < 5; n++) {
    const record = await readRecord<{ count: number }>(key);
    if ((record?.value.count || 0) >= max) throw new ReceiptError('発行回数の上限に達しました。時間をおいてお試しください。', 429);
    try { await writeRecord(key, { count: (record?.value.count || 0) + 1 }, record?.generation || 0); return; }
    catch (e) { if ((e as { code?: number }).code !== 412) throw e; }
  }
  throw new ReceiptError('混み合っています。時間をおいてお試しください。', 429);
}
