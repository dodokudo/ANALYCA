import test from 'node:test';
import assert from 'node:assert/strict';
import { COMPLETION_TAG, FIELDS, completionFriends, parseApplication, sameApplication, validSignature } from './domain.ts';
process.env.RECEIPTS_SECRET = 'test-only-receipts-secret-with-at-least-32-characters';
export const friend = (overrides={}) => ({ lmessage_friend_id:981573, friend_info:Object.entries({[-1]:'テスト',[-3]:'huhfkjg10@gmail.com',[-7]:'1040061',[-6]:'東京都',[-8]:'中央区',[-9]:'銀座1-1', [FIELDS.plan]:'ノーマル',[FIELDS.contractAmount]:'500000',[FIELDS.paidAmount]:'500000',[FIELDS.paidDate]:'2026-10-21',[FIELDS.method]:'銀行振込',...overrides}).map(([id,value])=>({id:Number(id),value})) });
test('webhook requires exact account secret and only dedicated completion tag triggers',()=>{
 assert.equal(validSignature('whsec_test-with-more-than-24-chars','whsec_test-with-more-than-24-chars'),true);
 assert.equal(validSignature('bad','whsec_test-with-more-than-24-chars'),false);
 assert.deepEqual(completionFriends({events:[{type:'tag',action:'add',tag_id:COMPLETION_TAG,lmessage_friend_id:7},{type:'friend_info',action:'set',lmessage_friend_id:8},{type:'tag',action:'add',tag_id:1,lmessage_friend_id:9}]}),[7]);
});
test('LINE identity remains separate from contract name and does not create a contract correction',()=>{
 const source={...friend(),line_name:'LINEのニックネーム',system_name:'管理用の表示名'};
 const app=parseApplication(source);
 assert.equal(app.name,'テスト');assert.equal(app.lineName,'LINEのニックネーム');
 assert.equal(sameApplication(app,parseApplication({...source,line_name:'変更後のLINE名'})),true);
 assert.equal(parseApplication({...friend(),system_name:'管理用の表示名'}).lineName,undefined);
});
test('bank and card inputs, plan options and durations map without payment-provider calls',()=>{
 const bank=parseApplication(friend());assert.equal(bank.bankAmount,500000);assert.equal(bank.durationDays,180);
 const card=parseApplication(friend({[FIELDS.plan]:'590317',[FIELDS.method]:'590321',[FIELDS.contractAmount]:'2000000',[FIELDS.paidAmount]:'2000000'}));assert.equal(card.cardAmount,2000000);assert.equal(card.durationDays,365);
});
test('mixed payment reconciles totals and special plan receipts cover only the initial payment',()=>{
 const special=parseApplication(friend({[FIELDS.plan]:'特別プラン',[FIELDS.contractAmount]:'1000000',[FIELDS.initialAmount]:'200000',[FIELDS.successAmount]:'800000',[FIELDS.paidAmount]:'200000',[FIELDS.method]:'カードと銀行振込の併用',[FIELDS.cardAmount]:'50000',[FIELDS.bankAmount]:'150000'}));
 assert.equal(special.paidAmount,200000);assert.equal(special.successAmount,800000);assert.equal(special.durationDays,180);
 assert.throws(()=>parseApplication(friend({[FIELDS.method]:'カードと銀行振込の併用',[FIELDS.bankAmount]:'300000',[FIELDS.cardAmount]:'300000'})),/一致/);
 assert.equal(parseApplication(friend({[FIELDS.paidAmount]:'499999'})).paidAmount,500000);
});
test('missing fields and future dates do not issue documents; correction keeps application identity',()=>{
 assert.throws(()=>parseApplication(friend({[FIELDS.paidDate]:'2099-01-01'})),/支払い日/);
 assert.equal(parseApplication(friend({[FIELDS.contractAmount]:''})).contractAmount,500000);
 const first=parseApplication(friend()),changed=parseApplication(friend({[-1]:'別の宛名'}));
 assert.equal(first.id,changed.id);assert.equal(sameApplication(first,changed),false);
});

test('normal plan totals are fixed across all plan and payment combinations',()=>{
 for(const [plan,bank,other] of [['ノーマル',500000,550000],['スタンダード',950000,1000000],['プレミアム',1900000,2000000]]) {
  for(const method of ['銀行振込','カード決済','カードと銀行振込の併用']) {
   const total=method==='銀行振込'?bank:other;
   const app=parseApplication(friend({[FIELDS.plan]:plan,[FIELDS.method]:method,[FIELDS.contractAmount]:'1',[FIELDS.paidAmount]:'2',[FIELDS.bankAmount]:'300000',[FIELDS.cardAmount]:String(total-300000)}));
   assert.equal(app.contractAmount,total);
   assert.equal(app.paidAmount,total);
   assert.equal(app.bankAmount+app.cardAmount,total);
   if(method==='カードと銀行振込の併用') assert.equal(app.bankAmount,300000);
  }
 }
});

test('performance contract derives total from two amounts, excludes normal, and receipts only initial payment',()=>{
 for(const [total,initial,success] of [[1000000,300000,700000],[2000000,500000,1500000]]) {
  for(const method of ['銀行振込','カード決済','カードと銀行振込の併用']) {
   const app=parseApplication(friend({[FIELDS.plan]:'特別プラン',[FIELDS.contractAmount]:'',[FIELDS.paidAmount]:'',[FIELDS.initialAmount]:String(initial),[FIELDS.successAmount]:String(success),[FIELDS.method]:method,[FIELDS.bankAmount]:'100000',[FIELDS.cardAmount]:String(initial-100000)}));
   assert.equal(app.contractAmount,total);
   assert.equal(app.paidAmount,initial);
   assert.equal(app.bankAmount+app.cardAmount,initial);
  }
 }
 assert.throws(()=>parseApplication(friend({[FIELDS.plan]:'特別プラン',[FIELDS.initialAmount]:'200000',[FIELDS.successAmount]:'350000'})),/契約総額/);
});


test('renamed special plan accepts current and legacy answers with a stable canonical label',()=>{
 for(const plan of ['特殊プラン','特別プラン','590319']) {
  const app=parseApplication(friend({[FIELDS.plan]:plan,[FIELDS.initialAmount]:'200000',[FIELDS.successAmount]:'800000'}));
  assert.equal(app.plan,'特殊プラン');assert.equal(app.paidAmount,200000);
 }
});
test('future contract dates are accepted only for samples, without changing creation time',()=>{
 const now=new Date('2026-10-22T00:00:00Z');
 const input=friend({[FIELDS.paidDate]:'2026-11-30'});
 assert.throws(()=>parseApplication(input,now),/支払い日/);
 const app=parseApplication(input,now,{sample:true});
 assert.equal(app.paidDate,'2026-11-30');assert.equal(app.createdAt,now.toISOString());
 assert.throws(()=>parseApplication(friend({[FIELDS.paidDate]:'2026-11-31'}),now,{sample:true}),/支払い日/);
});
