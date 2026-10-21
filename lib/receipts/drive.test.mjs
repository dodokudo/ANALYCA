import test, { mock, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
let foldersByParent, created, files;
beforeEach(()=>{
  process.env.RECEIPTS_DRIVE_ROOT_ID='accounting-root';
  process.env.RECEIPTS_DRIVE_USE_FISCAL_PERIOD='true';
  process.env.RECEIPTS_FISCAL_START_MONTH='11';
  process.env.RECEIPTS_FISCAL_ANCHOR_YEAR='2025';
  process.env.RECEIPTS_FISCAL_ANCHOR_PERIOD='7';
  foldersByParent=new Map();created=[];files=new Map();
});
await mock.module('./store.ts',{namedExports:{credentials:()=>({}),withLock:async(_,fn)=>fn()}});
await mock.module('googleapis',{namedExports:{google:{
  auth:{GoogleAuth:class{}},
  drive:()=>({files:{
    list:async({q})=>({data:{files:foldersByParent.get(q.match(/^'([^']+)'/)[1])||[]}}),
    create:async({requestBody,supportsAllDrives})=>{
      assert.equal(supportsAllDrives,true);created.push(requestBody);
      const id=requestBody.id||`folder-${created.length}`;
      if(requestBody.mimeType==='application/vnd.google-apps.folder'){
        const parent=requestBody.parents[0];foldersByParent.set(parent,[...(foldersByParent.get(parent)||[]),{id,name:requestBody.name}]);
      }else files.set(id,{id,parents:requestBody.parents,size:3,trashed:false});
      return {data:{id}};
    },
    get:async({fileId})=>{if(!files.has(fileId))throw Object.assign(new Error('not found'),{code:404});return {data:files.get(fileId)}},
    generateIds:async()=>({data:{ids:['reserved-pdf']}}),
  }}),
}}});
const {ensureMonthFolders,saveDocumentToDrive}=await import('./drive.ts');
test('reuse secretary-created month with a deadline suffix; keep receipt and invoice separate',async()=>{
  foldersByParent.set('accounting-root',[{id:'period7',name:'第7期'}]);
  foldersByParent.set('period7',[{id:'july',name:'2026年07月【2026.8.7〆】'}]);
  foldersByParent.set('july',[{id:'receipts',name:'領収書'},{id:'invoices',name:'請求書'}]);
  assert.deepEqual(await ensureMonthFolders('2026-07'),{month:'july',receipt:'receipts',invoice:'invoices'});assert.equal(created.length,0);
});
test('November creates the next fiscal period and repeated jobs reuse folders',async()=>{
  const one=await ensureMonthFolders('2026-11'),two=await ensureMonthFolders('2026-11');
  assert.deepEqual(one,two);assert.deepEqual(created.map(x=>x.name),['第8期','2026年11月','領収書','請求書']);
});
test('ambiguous month folders stop without guessing or creating another',async()=>{
  foldersByParent.set('accounting-root',[{id:'period7',name:'第7期'}]);
  foldersByParent.set('period7',[{id:'a',name:'2026年07月'},{id:'b',name:'2026年7月【締切】'}]);
  await assert.rejects(ensureMonthFolders('2026-07'),/Multiple matching/);assert.equal(created.length,0);
});
test('reserved PDF ID survives retries; no public permissions are added',async()=>{
  const issue={id:'issue-id',documents:{receipt:{driveId:'reserved',filename:'領収書.pdf'}}};
  await saveDocumentToDrive(issue,'receipt','receipts',Buffer.from('pdf'));
  await saveDocumentToDrive(issue,'receipt','receipts',Buffer.from('pdf'));
  assert.equal(created.length,1);assert.equal(created[0].id,'reserved');assert.deepEqual(created[0].parents,['receipts']);
});
