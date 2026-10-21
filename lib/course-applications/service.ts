import { downloadToken, hash, ReceiptError } from '../receipts/domain';
import { deliverIssue, issueDocuments } from '../receipts/service';
import { readRecord, receiptBucket, withLock, writeRecord } from '../receipts/store';
import { parseApplication, sameApplication, type Application } from './domain';
import { fetchFriend, notifyDownloads } from './lme';

type Task = { deliveryId: string; friendId: number; receivedAt: string; attempts: number; status: 'pending' | 'done' | 'review'; nextAttemptAt?: number; error?: string; applicationId?: string };
export async function queueSubmission(deliveryId: string, friendId: number): Promise<string> {
  const key = `course-queue/${hash(`${deliveryId}:${friendId}`)}.json`;
  await writeRecord(key, { deliveryId, friendId, receivedAt: new Date().toISOString(), attempts: 0, status: 'pending' } satisfies Task).catch(e => { if (e.code !== 412) throw e; });
  return key;
}
export async function processSubmission(key: string) {
  return withLock(`course-task-${hash(key)}`, async () => {
    const record = await readRecord<Task>(key);
    if (!record || record.value.status !== 'pending' || (record.value.nextAttemptAt || 0) > Date.now()) return;
    const task = record.value;
    try {
      const candidate = parseApplication(await fetchFriend(task.friendId));
      const isSample = (process.env.LME_TEST_FRIEND_IDS || '').split(',').includes(String(task.friendId));
      if (isSample && candidate.email !== process.env.LME_TEST_EMAIL) throw new ReceiptError('テスト送信先が一致していません。');
      candidate.sample = isSample;
      if (isSample) candidate.id = hash(`test:${candidate.id}`);
      await withLock(`course-app-${candidate.id}`, async () => {
        const appKey = `course-applications/${candidate.id}.json`;
        let saved = await readRecord<Application>(appKey);
        if (saved && !sameApplication(saved.value, candidate)) throw new ReceiptError('発行済みの内容と異なります。訂正は運営で確認してください。', 409);
        const app = saved?.value || candidate;
        const persist = async () => { await writeRecord(appKey, app, saved?.generation || 0); saved = await readRecord<Application>(appKey); };
        if (!saved) await persist();
        task.applicationId = app.id;
        const issue = await issueDocuments({ name: app.name, email: app.email, address: '', paidDate: app.paidDate, method: app.bankAmount > 0 ? 'bank' : 'card' }, isSample,
          { applicationId: app.id, amount: app.paidAmount, bankAmount: app.bankAmount, cardAmount: app.cardAmount, productName: `マーケティング講座（${app.plan}）` });
        app.issueId = issue.id; await persist();
        // Notify as soon as PDFs are ready. Drive does not gate the customer's download.
        let notificationError: unknown;
        if (!app.lineNotifiedAt) {
          try {
            const token = downloadToken(issue.id, Date.parse(app.createdAt) + 30 * 86400_000);
            await notifyDownloads(app.friendId, `https://analyca.jp/receipts/download/${issue.id}?token=${encodeURIComponent(token)}`, app.id, app.bankAmount > 0);
            app.lineNotifiedAt = new Date().toISOString(); await persist();
          } catch (e) { notificationError = e; }
        }
        await deliverIssue(issue.id);
        if (notificationError) throw notificationError;
      });
      task.status = 'done'; delete task.error;
    } catch (e) {
      task.attempts++;
      task.error = e instanceof ReceiptError ? e.message : '連携処理に失敗しました。再試行します。';
      if (task.attempts >= 5 || (e instanceof ReceiptError && e.status === 409 && task.applicationId)) task.status = 'review';
      task.nextAttemptAt = Date.now() + Math.min(task.attempts * 60_000, 600_000);
      console.error('[course-applications] pending', { key, attempts: task.attempts, status: task.status });
    }
    await writeRecord(key, task, record.generation);
    return task.status;
  });
}
export async function retrySubmissions() {
  const bucket = await receiptBucket();
  const cursor = await readRecord<{ cursor?: string }>('course-jobs/latest.json');
  const [files, next] = await bucket.getFiles({ prefix: 'course-queue/', maxResults: 20, autoPaginate: false, pageToken: cursor?.value.cursor });
  const results = [];
  for (const file of files) {
    try { results.push({ key: file.name, status: await processSubmission(file.name) }); }
    catch { results.push({ key: file.name, status: 'locked-or-unavailable' }); }
  }
  const result = { at: new Date().toISOString(), results, cursor: next?.pageToken || null };
  await writeRecord('course-jobs/latest.json', result, cursor?.generation || 0);
  return result;
}
