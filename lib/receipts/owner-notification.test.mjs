import test from 'node:test';
import assert from 'node:assert/strict';
import { notifyDocumentOwner } from './owner-notification.ts';
test('notification gateway receives minimal data and only accepts confirmed success',async()=>{
  const old=global.fetch;const calls=[];
  const issue={id:'a'.repeat(64),name:'確認用',amount:100000,method:'bank',paidDate:'2026-11-10',number:'20261110-ABCDEF123456',ownerNotification:'pending',email:'private@example.com',address:'private'};
  process.env.COURSE_DOCUMENTS_TOKEN='s'.repeat(40);
  try {
    global.fetch=async(url,options)=>{calls.push({url,...options});return new Response('{"accepted":true}');};
    await notifyDocumentOwner(issue);
    assert.equal(calls.length,1);assert.equal(JSON.parse(calls[0].body).email,undefined);
    assert.match(calls[0].url,/guardian-webhook/);
    await notifyDocumentOwner({...issue,sample:true});await notifyDocumentOwner({...issue,applicationId:'b'});await notifyDocumentOwner({...issue,ownerNotification:'sent'});
    assert.equal(calls.length,1);
    global.fetch=async()=>new Response('{}',{status:503});await assert.rejects(notifyDocumentOwner(issue));
    global.fetch=async()=>new Response('{"accepted":false}');await assert.rejects(notifyDocumentOwner(issue));
  }finally{global.fetch=old;}
});
