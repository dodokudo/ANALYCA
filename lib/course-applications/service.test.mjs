import test, { mock, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
process.env.RECEIPTS_SECRET = 'test-only-receipts-secret-with-at-least-32-characters';
let records, events, currentFriend, notificationFailure;
const locks = new Set();
const clone = v => structuredClone(v);
await mock.module('../receipts/store.ts', { namedExports: {
 readRecord: async key => records.has(key) ? { value: clone(records.get(key)), generation: '1' } : null,
 writeRecord: async (key,value,generation=0) => { if(!generation && records.has(key)) throw Object.assign(new Error('exists'),{code:412}); records.set(key,clone(value)); },
 withLock: async (key,fn) => { if(locks.has(key))throw new Error('locked'); locks.add(key);try{return await fn()}finally{locks.delete(key)} },
 receiptBucket: async()=>({getFiles:async()=>[[],null]}),
}});
await mock.module('../receipts/service.ts', { namedExports: {
 issueDocuments:async(input,sample,course)=>{ events.push(['issue',input,sample,course]);return {id:course.applicationId} },
 deliverIssue:async id=>{events.push(['deliver',id])},
}});
await mock.module('./lme.ts', {namedExports:{
 fetchFriend:async()=>clone(currentFriend),
 notifyDownloads:async(...args)=>{events.push(['notify',...args]);if(notificationFailure)throw new Error('temporary outage')},
}});
const {FIELDS}=await import('./domain.ts');
const {queueSubmission,processSubmission}=await import('./service.ts');
beforeEach(()=>{
 records=new Map();events=[];notificationFailure=false;locks.clear();
 delete process.env.LME_TEST_FRIEND_IDS;delete process.env.LME_TEST_EMAIL;
 currentFriend={lmessage_friend_id:981573,friend_info:Object.entries({[-1]:'テスト',[-3]:'test@example.com',[-8]:'中央区',[-9]:'銀座1-1',[FIELDS.plan]:'ノーマル',[FIELDS.method]:'銀行振込',[FIELDS.contractAmount]:'500000',[FIELDS.paidAmount]:'500000',[FIELDS.paidDate]:'2026-10-21'}).map(([id,value])=>({id:Number(id),value}))};
});
test('delivery replay is durable and sends notification once; application is held for GMO',async()=>{
 const key=await queueSubmission('delivery-1',981573);
 assert.equal(await processSubmission(key),'done');
 assert.equal(await queueSubmission('delivery-1',981573),key);
 await processSubmission(key);
 const other=await queueSubmission('delivery-2',981573);await processSubmission(other);
 assert.equal(events.filter(e=>e[0]==='notify').length,1);
 assert.deepEqual(events.slice(0,3).map(e=>e[0]),['issue','notify','deliver']);
 const app=[...records.entries()].find(([k])=>k.startsWith('course-applications/'))[1];
 assert.equal(app.contractStatus,'gmo_api_pending');assert.ok(app.issueId);
});
test('LINE failure does not prevent email delivery and retries the stable link',async()=>{
 notificationFailure=true;const key=await queueSubmission('retry',981573);assert.equal(await processSubmission(key),'pending');
 assert.ok(events.some(e=>e[0]==='deliver'));
 const before=events.find(e=>e[0]==='notify');
 records.get(key).nextAttemptAt=0;notificationFailure=false;
 assert.equal(await processSubmission(key),'done');
 assert.deepEqual(events.filter(e=>e[0]==='notify')[1],before);
});
test('changed answers cannot create another document and sample email is restricted',async()=>{
 const key=await queueSubmission('first',981573);await processSubmission(key);
 currentFriend.friend_info.find(f=>f.id===-1).value='別の宛名';
 const changed=await queueSubmission('change',981573);await processSubmission(changed);
 assert.equal(events.filter(e=>e[0]==='issue').length,1);
 assert.match(records.get(changed).error,/訂正/);
 process.env.LME_TEST_FRIEND_IDS='981573';process.env.LME_TEST_EMAIL='owner@example.com';
 const wrong=await queueSubmission('wrong-test-email',981573);await processSubmission(wrong);
 assert.match(records.get(wrong).error,/テスト送信先/);
});
