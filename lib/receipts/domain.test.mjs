import test from 'node:test';
import assert from 'node:assert/strict';
import { amountFor, taxFor, kindsFor, validateInput, nextMonthToPrepare, fiscalPeriod, jstDate, issueId, downloadToken, validDownloadToken, emailText } from './domain.ts';

process.env.RECEIPTS_SECRET = 'test-only-receipts-secret-with-at-least-32-characters';
const input = { name: '株式会社テスト', email: 'test@example.com', address: '', paidDate: '2026-10-20', method: 'bank' };
test('bank issues two documents at 100000; card issues only a receipt at 110000', () => {
  assert.equal(amountFor('bank'), 100000); assert.equal(amountFor('card'), 110000);
  assert.deepEqual(kindsFor('bank'), ['receipt','invoice']); assert.deepEqual(kindsFor('card'), ['receipt']);
  assert.equal(taxFor(100000), 9090); assert.equal(taxFor(110000), 10000);
});
test('month preparation uses JST last day at 21:00, including leap and year rollover', () => {
  for (const [instant, expected] of [
    ['2026-10-31T11:59:59Z', null], ['2026-10-31T12:00:00Z','2026-11'],
    ['2026-10-31T14:59:59Z','2026-11'], ['2026-10-31T15:00:00Z',null],
    ['2026-10-30T12:00:00Z',null], ['2026-02-28T12:00:00Z','2026-03'],
    ['2028-02-28T12:00:00Z',null], ['2028-02-29T12:00:00Z','2028-03'],
    ['2026-12-31T12:00:00Z','2027-01'], ['2026-04-30T12:00:00Z','2026-05'],
  ]) assert.equal(nextMonthToPrepare(new Date(instant)), expected, instant);
  assert.equal(jstDate(new Date('2026-10-21T15:00:00Z')), '2026-10-22');
});
test('fiscal folders follow explicitly configured anchor', () => {
  assert.equal(fiscalPeriod('2026-10',11,2025,7), '第7期');
  assert.equal(fiscalPeriod('2026-11',11,2025,7), '第8期');
  assert.equal(fiscalPeriod('2027-01',11,2025,7), '第8期');
});
test('server accepts fixed choices, rejects invalid dates and mail headers', () => {
  const now = new Date('2026-10-22T00:00:00Z');
  assert.deepEqual(validateInput({...input, email:' TEST@EXAMPLE.COM '}, now), input);
  for (const paidDate of ['2026-02-30','2026-10-23','2026-1-01','garbage']) assert.throws(() => validateInput({...input,paidDate},now));
  for (const email of ['x@example.com\r\nBcc: y@example.com','x,y@example.com','x@y','x@example.com;']) assert.throws(() => validateInput({...input,email},now));
  assert.throws(() => validateInput({...input,method:'cash'},now));
  assert.throws(() => validateInput({...input,name:'x'.repeat(61)},now));
  assert.equal(amountFor(validateInput({...input,amount:1},now).method),100000);
});
test('identity is stable for repeats and download tokens are bound and expire', () => {
  const id = issueId(input);
  assert.equal(id,issueId({...input})); assert.notEqual(id,issueId({...input,email:'another@example.com'}));
  const token = downloadToken(id,Date.now()+60000);
  assert.ok(validDownloadToken(id,token)); assert.ok(!validDownloadToken('different',token));
  assert.ok(!validDownloadToken(id,downloadToken(id,Date.now()-1)));
  assert.ok(!validDownloadToken(id,'bad-token'));
});
test('only the bank email includes the paid invoice explanation', () => {
  const bank = emailText(input), card = emailText({...input,method:'card'});
  assert.match(bank,/領収書と請求書をPDFで添付/);
  assert.match(bank,/追加のお支払いやお手続きは不要/);
  assert.match(card,/領収書をPDFで添付/); assert.doesNotMatch(card,/請求書/);
});
