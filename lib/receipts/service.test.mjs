import test, { mock, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

process.env.RECEIPTS_SECRET = 'test-only-receipts-secret-with-at-least-32-characters';
let records, objects, sends, archives, reserveCount, failDrive, failMail;
const locks = new Set();
beforeEach(() => { records=new Map();objects=new Map();sends=[];archives=[];reserveCount=0;failDrive=false;failMail=null;locks.clear(); });
const clone = value => structuredClone(value);
await mock.module('./store.ts', { namedExports: {
  readRecord: async key => records.has(key) ? {value:clone(records.get(key)),generation:'1'} : null,
  writeRecord: async (key,value) => { records.set(key,clone(value)); },
  withLock: async (key,fn) => { if(locks.has(key))throw new Error('locked');locks.add(key);try{return await fn()}finally{locks.delete(key)} },
  receiptBucket: async () => ({ file: key => ({
    download: async () => {if(!objects.has(key))throw Object.assign(new Error('missing'),{code:404});return [objects.get(key)]},
    save: async bytes => {objects.set(key,bytes)},
    delete: async () => {records.delete(key);objects.delete(key)},
  }) }),
} });
await mock.module('./drive.ts', { namedExports: {
  ensureMonthFolders: async () => {if(failDrive)throw new Error('Drive unavailable');return {receipt:'receipt-folder',invoice:'invoice-folder'}},
  reserveDriveId: async () => `reserved-${++reserveCount}`,
  saveDocumentToDrive: async (issue,kind,folder,bytes) => {archives.push({id:issue.id,kind,folder,bytes,driveId:issue.documents[kind].driveId})},
} });
await mock.module('../email.ts', { namedExports: { sendReceiptDocumentsEmail: async (...args) => {if(failMail)throw Object.assign(new Error('mail failed'),{code:failMail});sends.push(args)} } });
await mock.module('./pdf.ts', { namedExports: { renderDocument: async (issue,kind) => Buffer.from(`%PDF-${issue.number}-${kind}`) } });
const {issueDocuments,deliverIssue,publicResult}=await import('./service.ts');
const input={name:'テスト',email:'test@example.com',address:'',paidDate:'2026-10-20',method:'bank'};
test('bank produces separate PDFs; mail and archive use exactly the download bytes',async()=>{
  const issue=await issueDocuments(input);
  assert.equal(issue.mail,'sent');assert.equal(sends.length,1);assert.equal(sends[0][2].length,2);assert.equal(archives.length,2);
  for(const [index,kind] of ['receipt','invoice'].entries())assert.deepEqual(sends[0][2][index].content,objects.get(issue.documents[kind].path));
  assert.equal(publicResult(issue).documents.length,2);assert.ok(!records.has(`pending/${issue.id}.json`));
});
test('card produces only one PDF and one attachment',async()=>{
  const issue=await issueDocuments({...input,method:'card'});
  assert.equal(issue.amount,110000);assert.equal(sends[0][2].length,1);assert.equal(archives.length,1);assert.ok(!issue.documents.invoice);
});
test('repeat submission keeps numbering, bytes, reserved Drive IDs, and does not mail again',async()=>{
  const first=await issueDocuments(input);const second=await issueDocuments(input);
  assert.equal(first.number,second.number);assert.deepEqual(first.documents,second.documents);assert.equal(sends.length,1);assert.equal(reserveCount,2);
  await assert.rejects(issueDocuments({...input,name:'別の名前'}),/発行済み/);
});
test('Drive failure does not block download/email and queue retries the missing archive',async()=>{
  failDrive=true;const issue=await issueDocuments(input);
  assert.equal(publicResult(issue).documents.length,2);assert.equal(issue.mail,'sent');assert.ok(records.has(`pending/${issue.id}.json`));
  failDrive=false;await deliverIssue(issue.id);assert.equal(sends.length,1);assert.equal(archives.length,2);assert.ok(!records.has(`pending/${issue.id}.json`));
});
test('definite SMTP rejection retries; ambiguous delivery never automatically sends twice',async()=>{
  failMail='EAUTH';const issue=await issueDocuments(input);assert.equal(issue.mail,'failed');
  failMail=null;assert.equal((await deliverIssue(issue.id)).mail,'sent');assert.equal(sends.length,1);
  failMail='ETIMEDOUT';const second=await issueDocuments({...input,email:'other@example.com'});assert.equal(second.mail,'uncertain');
  failMail=null;await deliverIssue(second.id);assert.equal(sends.length,1);
});
