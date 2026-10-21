import { randomBytes } from 'node:crypto';
import { sendReceiptDocumentsEmail } from '../email';
import { amountFor, downloadToken, emailText, hash, issueId, jstDate, kindsFor, ReceiptError, titleFor, type Issue, type ReceiptInput } from './domain';
import { ensureMonthFolders, reserveDriveId, saveDocumentToDrive } from './drive';
import { renderDocument } from './pdf';
import { readRecord, receiptBucket, withLock, writeRecord } from './store';

export const issueKey = (id: string) => `issues/${id}.json`;
async function persist(issue: Issue) {
  const current = await readRecord<Issue>(issueKey(issue.id));
  await writeRecord(issueKey(issue.id), issue, current?.generation || 0);
}
async function prepareDocuments(issue: Issue) {
  const bucket = await receiptBucket();
  const id = issue.id;
  let changed = false;
  const results = await Promise.allSettled(kindsFor(issue.method).map(async kind => {
    const filename = `${titleFor(kind)}_${kind === 'receipt' ? 'RCT' : 'INV'}-${issue.number}.pdf`;
    const path = `pdf/${id}/${kind}.pdf`;
    const file = bucket.file(path);
    let bytes: Buffer;
    try { [bytes] = await file.download(); }
    catch (e) {
      if ((e as { code?: number }).code !== 404) throw e;
      bytes = await renderDocument(issue, kind, issue.sample);
      await file.save(bytes, { resumable: false, contentType: 'application/pdf', metadata: { cacheControl: 'private, no-store' }, preconditionOpts: { ifGenerationMatch: 0 } });
    }
    if (!issue.documents[kind]) { issue.documents[kind] = { filename, path }; changed = true; }
    return { filename, content: bytes, contentType: 'application/pdf' };
  }));
  const attachments = results.map(result => {
    if (result.status === 'rejected') throw result.reason;
    return result.value;
  });
  if (changed) await persist(issue);
  return attachments;
}
export async function deliverIssue(id: string): Promise<Issue> {
  return withLock(`issue-${id}`, async () => {
    const record = await readRecord<Issue>(issueKey(id));
    if (!record) throw new Error('Issuance not found');
    const issue = record.value;
    const bucket = await receiptBucket();
    const attachments = await prepareDocuments(issue);
    if (issue.mail === 'sending') {
      // SMTP may have accepted a previous request before the process stopped.
      // Do not automatically resend an ambiguous delivery.
      issue.mail = 'uncertain'; await persist(issue);
    }
    if (issue.mail === 'pending' || issue.mail === 'failed') {
      issue.mail = 'sending'; await persist(issue);
      try {
        await sendReceiptDocumentsEmail(issue.email, emailText(issue), attachments, id, issue.sample, issue.productName);
        issue.mail = 'sent'; issue.mailedAt = new Date().toISOString();
      } catch (e) {
        const code = (e as { code?: string }).code;
        issue.mail = ['EAUTH', 'EENVELOPE', 'ECONNECTION', 'EDNS'].includes(code || '') ? 'failed' : 'uncertain';
        console.error('[receipts] Email not confirmed', { id, code });
      }
      await persist(issue);
    }
    // PDFs remain downloadable even when Drive or email is temporarily unavailable.
    let archived = true;
    try {
      const target = await ensureMonthFolders(issue.issuedDate.slice(0, 7), issue.sample);
      for (const [index, kind] of kindsFor(issue.method).entries()) {
        const document = issue.documents[kind]!;
        if (!document.driveId) { document.driveId = await reserveDriveId(); await persist(issue); }
        await saveDocumentToDrive(issue, kind, target[kind], attachments[index].content);
      }
    } catch (e) {
      archived = false;
      console.error('[receipts] Drive save pending', { id, code: (e as { code?: number }).code });
    }
    const pendingKey = `pending/${id}.json`;
    if (archived && issue.mail === 'sent') {
      await bucket.file(pendingKey).delete({ ignoreNotFound: true });
    } else if (issue.mail === 'uncertain') {
      console.error('[receipts] Manual email delivery review required', { id });
      const reviewKey = `review/${id}.json`;
      const prior = await readRecord(reviewKey);
      await writeRecord(reviewKey, { id, reason: 'smtp-delivery-uncertain', at: new Date().toISOString() }, prior?.generation || 0);
      if (archived) await bucket.file(pendingKey).delete({ ignoreNotFound: true });
    }
    return issue;
  });
}
export type CourseIssuance = { applicationId: string; amount: number; productName: string; bankAmount: number; cardAmount: number };
export async function issueDocuments(input: ReceiptInput, sample = false, course?: CourseIssuance): Promise<Issue> {
  if (course && (!/^[a-f0-9]{64}$/.test(course.applicationId) || !Number.isSafeInteger(course.amount) || course.amount < 1 || course.amount > 10_000_000 || !Number.isSafeInteger(course.bankAmount) || !Number.isSafeInteger(course.cardAmount) || course.bankAmount < 0 || course.cardAmount < 0 || course.bankAmount + course.cardAmount !== course.amount || (input.method === 'bank') !== (course.bankAmount > 0) || !course.productName || course.productName.length > 60)) throw new ReceiptError('書類発行内容が正しくありません。');
  const baseId = course ? hash(`application:${course.applicationId}`) : issueId(input);
  const id = sample ? hash(`sample:${baseId}`) : baseId;
  return withLock(`issue-${id}`, async () => {
    const existing = await readRecord<Issue>(issueKey(id));
    let issue: Issue;
    if (existing) {
      issue = existing.value;
      if (existing.value.name !== input.name || existing.value.address !== input.address || (course && (existing.value.amount !== course.amount || existing.value.email !== input.email || existing.value.paidDate !== input.paidDate || existing.value.bankAmount !== course.bankAmount || existing.value.cardAmount !== course.cardAmount || existing.value.productName !== course.productName))) throw new ReceiptError('このお支払いの書類は発行済みです。宛名・住所の訂正は運営事務局へご連絡ください。', 409);
    } else {
      issue = { ...input, id, sample, issuedDate: jstDate(), createdAt: new Date().toISOString(), number: `${sample ? 'TEST-' : ''}${jstDate().replaceAll('-', '')}-${randomBytes(6).toString('hex').toUpperCase()}`, amount: course?.amount ?? amountFor(input.method), ...(course ? { applicationId: course.applicationId, productName: course.productName, bankAmount: course.bankAmount, cardAmount: course.cardAmount, invoiceAmount: course.bankAmount } : {}), documents: {}, mail: 'pending' };
      // Queue first: a stopped request can safely resume using the same issuance ID.
      await writeRecord(`pending/${id}.json`, { id }).catch(e => { if (e.code !== 412) throw e; });
      await writeRecord(issueKey(id), issue);
    }
    await prepareDocuments(issue);
    return issue;
  });
}
export function publicResult(issue: Issue) {
  const token = downloadToken(issue.id, Date.now() + 3600_000);
  return {
    mail: issue.mail, email: issue.email,
    documents: kindsFor(issue.method).filter(kind => issue.documents[kind]).map(kind => ({
      kind, label: titleFor(kind), filename: issue.documents[kind]!.filename,
      url: `/api/receipts/${issue.id}/${kind}?token=${encodeURIComponent(token)}`,
    })),
  };
}
