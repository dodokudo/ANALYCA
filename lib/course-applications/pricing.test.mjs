import test from 'node:test';
import assert from 'node:assert/strict';
import { contractPrice } from './pricing.ts';
test('fixed contract prices apply bank discount only to one-time bank transfer',()=>{
 for(const [plan,bank,other] of [['ノーマル',500000,550000],['スタンダード',950000,1000000],['プレミアム',1900000,2000000]]) {
  assert.equal(contractPrice(plan,true),bank);
  assert.equal(contractPrice(plan,false),other);
 }
});
