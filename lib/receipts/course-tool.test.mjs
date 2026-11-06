import test from 'node:test';
import assert from 'node:assert/strict';
import { authorizedDocumentTool, parseDocumentRequest } from './course-tool.ts';
const input = () => ({ input: { name: 'テスト', email: 'test@example.com', address: '', paidDate: '2026-10-21', method: 'bank' }, course: { applicationId: 'a'.repeat(64), productName: 'マーケティング講座', amount: 500000, bankAmount: 500000, cardAmount: 0 }, sample: false, createdAt: '2026-10-21T00:00:00Z' });
test('document tool requires a dedicated secret and rejects unrelated credentials', () => {
  delete process.env.COURSE_DOCUMENTS_TOKEN; assert.equal(authorizedDocumentTool('Bearer test'), false);
  process.env.COURSE_DOCUMENTS_TOKEN = 'a'.repeat(48);
  assert.equal(authorizedDocumentTool(`Bearer ${'a'.repeat(48)}`), true);
  assert.equal(authorizedDocumentTool(`Bearer ${'b'.repeat(48)}`), false);
});
test('tool accepts receipt-only information with exact reconciled amounts', () => {
  assert.equal(parseDocumentRequest(input()).course.amount, 500000);
  const bad = input(); bad.course.bankAmount = 499999; assert.throws(() => parseDocumentRequest(bad), /amounts/);
  const address = input(); address.input.address = 'contract address'; assert.throws(() => parseDocumentRequest(address), /addresses/);
  const invalidId = input(); invalidId.course.applicationId = '../../other'; assert.throws(() => parseDocumentRequest(invalidId), /course/);
});
test('test mail is restricted and future payment dates cannot enter production', () => {
  const future = input(); future.input.paidDate = '2099-01-01'; assert.throws(() => parseDocumentRequest(future));
  future.sample = true; process.env.COURSE_DOCUMENTS_TEST_EMAIL = 'owner@example.com'; assert.throws(() => parseDocumentRequest(future), /sample/);
  process.env.COURSE_DOCUMENTS_TEST_EMAIL = 'test@example.com'; assert.equal(parseDocumentRequest(future).sample, true);
});
