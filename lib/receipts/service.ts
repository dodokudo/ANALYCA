import { randomBytes } from 'node:crypto';
import { sendReceiptDocumentsEmail } from '../email';
import { amountFor, downloadToken, emailText, issueId, jstDate, kindsFor, ReceiptError, titleFor, type Issue, type ReceiptInput } from './domain';
import { ensureMonthFolders, reserveDriveId, saveDocumentToDrive } from './drive';
import { renderDocument } from './pdf';
import { readRecord, receiptBucket, withLock, writeRecord } from './store';

export const issueKey = (id: string) => `issues/${id}.json`;
async function persist(issue: Issue) {
  const current = await readRecord<Issue>(issueKey(issue.id));
  await writeRecord(issueKey(issue.id), issue, current?.generation || 0);
}
export async function deliverIssue(id: string): Promise<Issue> {
  return withLock(`issue-${id}`, async () => {
    const record = await readRecord<Issue>(issueKey(id));
    if (!record) throw new Error('Issuance not found');
    const issue = record.value;
    const bucket = await receiptBucket();
    const attachments: { filename: string; content: Buffer; contentType: string }[] = [];
    for (const kind of kindsFor(issue.method)) {
      const filename = `${titleFor(kind)}_${kind === 'receipt' ? 'RCT' : 'INV'}-${issue.number}.pdf`;
      const path = `pdf/${id}/${kind}.pdf`;
      const file = bucket.file(path);
      let bytes: Buffer;
      try { [bytes] = await file.download(); }
      catch (e) {
        if ((e as { code?: number }).code !== 404) throw e;
        bytes = await renderDocument(issue, kind);
        await file.save(bytes, { resumable: false, contentType: 'application/pdf', metadata: { cacheControl: 'private, no-store' }, preconditionOpts: { ifGenerationMatch: 0 } });
      }
      issue.documents[kind] ??= { filename, path };
      attachments.push({ filename, content: bytes, contentType: 'application/pdf' });
    }
    await persist(issue);
    // PDFs remain downloadable even when Drive or email is temporarily unavailable.
    let archived = true;
    try {
      const target = await ensureMonthFolders(issue.issuedDate.slice(0, 7));
      for (const [index, kind] of kindsFor(issue.method).entries()) {
        const document = issue.documents[kind]!;
        if (!document.driveId) { document.driveId = await reserveDriveId(); await persist(issue); }
        await saveDocumentToDrive(issue, kind, target[kind], attachments[index].content);
      }
    } catch (e) {
      archived = false;
      console.error('[receipts] Drive save pending', { id, code: (e as { code?: number }).code });
    }
    if (issue.mail === 'sending') {
      // SMTP may have accepted a previous request before the process stopped.
      // Do not automatically resend an ambiguous delivery.
      issue.mail = 'uncertain'; await persist(issue);
    }
    if (issue.mail === 'pending' || issue.mail === 'failed') {
      issue.mail = 'sending'; await persist(issue);
      try {
        await sendReceiptDocumentsEmail(issue.email, emailText(issue), attachments, id);
        issue.mail = 'sent'; issue.mailedAt = new Date().toISOString();
      } catch (e) {
        const code = (e as { code?: string }).code;
        issue.mail = ['EAUTH', 'EENVELOPE', 'ECONNECTION', 'EDNS'].includes(code || '') ? 'failed' : 'uncertain';
        console.error('[receipts] Email not confirmed', { id, code });
      }
      await persist(issue);
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
export async function issueDocuments(input: ReceiptInput): Promise<Issue> {
  const id = issueId(input);
  await withLock(`issue-${id}`, async () => {
    const existing = await readRecord<Issue>(issueKey(id));
    if (existing) {
      if (existing.value.name !== input.name || existing.value.address !== input.address) throw new ReceiptError('このお支払いの書類は発行済みです。宛名・住所の訂正は運営事務局へご連絡ください。', 409);
    } else {
      const issue: Issue = { ...input, id, issuedDate: jstDate(), createdAt: new Date().toISOString(), number: `${jstDate().replaceAll('-', '')}-${randomBytes(6).toString('hex').toUpperCase()}`, amount: amountFor(input.method), documents: {}, mail: 'pending' };
      // Queue first: a stopped request can safely resume using the same issuance ID.
      await writeRecord(`pending/${id}.json`, { id }).catch(e => { if (e.code !== 412) throw e; });
      await writeRecord(issueKey(id), issue);
    }
  });
  return deliverIssue(id);
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
