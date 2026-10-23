import test, {beforeEach, mock} from 'node:test';
import assert from 'node:assert/strict';
let records, calls, failure, persistFailure;
await mock.module('../receipts/store.ts',{namedExports:{
 readRecord:async k=>records.has(k)?{value:structuredClone(records.get(k)),generation:'1'}:null,
 writeRecord:async(k,v)=>{if(persistFailure&&v.acceptedAt){persistFailure=false;throw new Error('storage outage')}records.set(k,structuredClone(v))},
 withLock:async(k,fn)=>fn(),
}});
const {notifyOperations,operationsMessage,contractPeriod,OPERATIONS_GROUP}=await import('./operations.ts');
const app={id:'a'.repeat(64),friendId:123,name:'動作確認',email:'test@example.com',address:'テスト住所',representative:'',plan:'スタンダード',contractAmount:1000000,paidAmount:1000000,initialAmount:1000000,successAmount:0,bankAmount:300000,cardAmount:700000,method:'mixed',paidDate:'2026-11-30',durationDays:180};
beforeEach(()=>{
 records=new Map();calls=[];failure=false;persistFailure=false;
 process.env.COURSE_OPERATIONS_LINE_TOKEN='test-token';
 globalThis.fetch=async(url,options)=>{calls.push({url,...options});if(failure)throw new Error('timeout');return new Response('{}',{status:calls.length>1?409:200,headers:calls.length>1?{'x-line-accepted-request-id':'original'}:{'x-line-request-id':'first'}})};
});
test('all normal and special payment branches contain two assignments, exact amounts and dates',()=>{
 for(const plan of ['ノーマル','スタンダード','プレミアム','特殊プラン'])for(const method of ['bank','card','mixed']){
  const a={...app,plan,method,durationDays:plan==='プレミアム'?365:180};const text=operationsMessage(a);
  assert.match(text,/まゆらさん/);assert.match(text,/ナオさん/);assert.match(text,/計2通/);assert.match(text,/操作マニュアル/);assert.match(text,/2026-11-30/);assert.match(text,/契約終了日/);
  assert.ok(text.length<5000);assert.match(text,plan==='特殊プラン'?/現金分割用/:/一括用/);
 }
 assert.deepEqual(contractPeriod(app),{start:'2026-11-30',end:'2027-05-28',days:180});
 assert.deepEqual(contractPeriod({...app,plan:'特殊プラン',contractAmount:2000000}),{start:'2026-11-30',end:'2027-11-29',days:365});
 assert.equal(contractPeriod({...app,paidDate:'2028-02-29',durationDays:365}).end,'2029-02-27');
});
test('persists accepted notification and skips duplicate deliveries',async()=>{
 await notifyOperations(app);await notifyOperations(app);assert.equal(calls.length,1);
 assert.equal(JSON.parse(calls[0].body).to,OPERATIONS_GROUP);
 assert.ok([...records.values()][0].acceptedAt);
});
test('timeout retries identical payload/key and accepts LINE 409 with receipt',async()=>{
 failure=true;await assert.rejects(notifyOperations(app));failure=false;await notifyOperations(app);
 assert.equal(calls[0].body,calls[1].body);assert.equal(calls[0].headers['X-Line-Retry-Key'],calls[1].headers['X-Line-Retry-Key']);
 assert.equal([...records.values()][0].requestId,'original');
});
test('storage failure after send is recovered without a duplicate notification',async()=>{
 persistFailure=true;await assert.rejects(notifyOperations(app));await notifyOperations(app);
 assert.equal(calls[0].headers['X-Line-Retry-Key'],calls[1].headers['X-Line-Retry-Key']);
 assert.ok([...records.values()][0].acceptedAt);
});
test('samples never notify operations; old ambiguous attempts are not resent',async()=>{
 await notifyOperations({...app,sample:true});assert.equal(calls.length,0);
 records.set(`course-operations/${app.id}.json`,{retryKey:'old',text:'old',firstAttemptAt:'2020-01-01'});
 await assert.rejects(notifyOperations(app),/manual review/);assert.equal(calls.length,0);
});
test('409 without accepted request header is not successful',async()=>{
 globalThis.fetch=async()=>new Response('{}',{status:409});await assert.rejects(notifyOperations(app));
 assert.equal([...records.values()][0].acceptedAt,undefined);
});
