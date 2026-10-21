import test, { mock, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

process.env.RECEIPTS_SECRET = 'test-only-receipts-secret-with-at-least-32-characters';
let records, objects, sends, archives, reserveCount, failDrive, failMail, events;
const locks = new Set();
beforeEach(() => { records=new Map();objects=new Map();sends=[];archives=[];reserveCount=0;failDrive=false;failMail=null;events=[];locks.clear(); });
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
  ensureMonthFolders: async () => {events.push('drive');if(failDrive)throw new Error('Drive unavailable');return {receipt:'receipt-folder',invoice:'invoice-folder'}},
  reserveDriveId: async () => `reserved-${++reserveCount}`,
  saveDocumentToDrive: async (issue,kind,folder,bytes) => {archives.push({id:issue.id,kind,folder,bytes,driveId:issue.documents[kind].driveId})},
} });
await mock.module('../email.ts', { namedExports: { sendReceiptDocumentsEmail: async (...args) => {events.push('email');if(failMail)throw Object.assign(new Error('mail failed'),{code:failMail});sends.push(args)} } });
await mock.module('./pdf.ts', { namedExports: { renderDocument: async (issue,kind) => Buffer.from(`%PDF-${issue.number}-${kind}`) } });
const {issueDocuments,deliverIssue,publicResult}=await import('./service.ts');
const input={name:'テスト',email:'test@example.com',address:'',paidDate:'2026-10-20',method:'bank'};
const issueAndDeliver = async (...args) => deliverIssue((await issueDocuments(...args)).id);
test('PDFs are downloadable before any email or Drive operation; email precedes Drive', async () => {
  const ready = await issueDocuments(input);
  assert.equal(publicResult(ready).documents.length, 2);
  assert.equal(ready.mail, 'pending');
  assert.deepEqual(events, []);
  assert.ok(records.has(`pending/${ready.id}.json`));
  await deliverIssue(ready.id);
  assert.deepEqual(events, ['email', 'drive']);
});
test('bank produces separate PDFs; mail and archive use exactly the download bytes',async()=>{
  const issue=await issueAndDeliver(input);
  assert.equal(issue.mail,'sent');assert.equal(sends.length,1);assert.equal(sends[0][2].length,2);assert.equal(archives.length,2);
  for(const [index,kind] of ['receipt','invoice'].entries())assert.deepEqual(sends[0][2][index].content,objects.get(issue.documents[kind].path));
  assert.equal(publicResult(issue).documents.length,2);assert.ok(!records.has(`pending/${issue.id}.json`));
});
test('card produces only one PDF and one attachment',async()=>{
  const issue=await issueAndDeliver({...input,method:'card'});
  assert.equal(issue.amount,110000);assert.equal(sends[0][2].length,1);assert.equal(archives.length,1);assert.ok(!issue.documents.invoice);
});
test('backend mixed issuance uses paid total, bank-only invoice and stable application identity',async()=>{
  const course={applicationId:'a'.repeat(64),amount:200000,bankAmount:150000,cardAmount:50000,productName:'マーケティング講座（特別プラン）'};
  const first=await issueDocuments(input,false,course);await deliverIssue(first.id);
  assert.equal(first.amount,200000);assert.equal(first.invoiceAmount,150000);assert.equal(publicResult(first).documents.length,2);
  const repeat=await issueDocuments(input,false,course);assert.equal(first.number,repeat.number);
  assert.match(sends[0][1],/マーケティング講座/);
  await assert.rejects(issueDocuments(input,false,{...course,amount:300000,bankAmount:250000}),/発行済み/);
  await assert.rejects(issueDocuments(input,false,{...course,bankAmount:100000}),/正しくありません/);
});
test('administrator samples are labelled and never reuse a real issuance',async()=>{
  const sample=await issueAndDeliver(input,true),real=await issueAndDeliver(input);
  assert.equal(sample.sample,true);assert.match(sample.number,/^TEST-/);
  assert.notEqual(sample.id,real.id);assert.notEqual(sample.number,real.number);
  assert.match(sends[0][1],/実際のお取引・会計書類ではありません/);
  assert.equal(sends[0][4],true);assert.match(sample.documents.receipt.filename,/TEST-/);
});
test('repeat submission keeps numbering, bytes, reserved Drive IDs, and does not mail again',async()=>{
  const first=await issueAndDeliver(input);const second=await issueAndDeliver(input);
  assert.equal(first.number,second.number);assert.deepEqual(first.documents,second.documents);assert.equal(sends.length,1);assert.equal(reserveCount,2);
  await assert.rejects(issueAndDeliver({...input,name:'別の名前'}),/発行済み/);
});
test('Drive failure does not block download/email and queue retries the missing archive',async()=>{
  failDrive=true;const issue=await issueAndDeliver(input);
  assert.equal(publicResult(issue).documents.length,2);assert.equal(issue.mail,'sent');assert.ok(records.has(`pending/${issue.id}.json`));
  failDrive=false;await deliverIssue(issue.id);assert.equal(sends.length,1);assert.equal(archives.length,2);assert.ok(!records.has(`pending/${issue.id}.json`));
});
test('definite SMTP rejection retries; ambiguous delivery never automatically sends twice',async()=>{
  failMail='EAUTH';const issue=await issueAndDeliver(input);assert.equal(issue.mail,'failed');
  failMail=null;assert.equal((await deliverIssue(issue.id)).mail,'sent');assert.equal(sends.length,1);
  failMail='ETIMEDOUT';const second=await issueAndDeliver({...input,email:'other@example.com'});assert.equal(second.mail,'uncertain');
  failMail=null;await deliverIssue(second.id);assert.equal(sends.length,1);
});
