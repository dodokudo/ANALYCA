import { timingSafeEqual } from 'node:crypto';
import { ReceiptError, validateInput } from './domain';

export function authorizedDocumentTool(header: string | null): boolean {
  const secret = process.env.COURSE_DOCUMENTS_TOKEN;
  if (!secret || secret.length < 32 || !header) return false;
  const actual = Buffer.from(header), expected = Buffer.from(`Bearer ${secret}`);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function parseDocumentRequest(body: unknown) {
  if (!body || typeof body !== 'object') throw new ReceiptError('Invalid document request');
  const value = body as Record<string, unknown>;
  const raw = value.input as Record<string, unknown> | undefined;
  const course = value.course as Record<string, unknown> | undefined;
  if (!raw || !course || typeof value.sample !== 'boolean' || typeof value.createdAt !== 'string') throw new ReceiptError('Invalid document request');
  const createdAt = Date.parse(value.createdAt);
  if (!Number.isFinite(createdAt) || createdAt > Date.now() + 60_000) throw new ReceiptError('Invalid creation date');
  if (raw.address !== '') throw new ReceiptError('Contract addresses are not accepted by the document tool');
  const sampleDate = new Date(`${raw.paidDate}T12:00:00+09:00`);
  const input = validateInput(raw, value.sample && sampleDate > new Date() ? sampleDate : new Date());
  if (value.sample && (!process.env.COURSE_DOCUMENTS_TEST_EMAIL || input.email !== process.env.COURSE_DOCUMENTS_TEST_EMAIL)) throw new ReceiptError('Invalid sample recipient');
  if (typeof course.applicationId !== 'string' || !/^[a-f0-9]{64}$/.test(course.applicationId) || typeof course.productName !== 'string' || !course.productName || course.productName.length > 60) throw new ReceiptError('Invalid course');
  const amount = course.amount, bankAmount = course.bankAmount, cardAmount = course.cardAmount;
  if (typeof amount !== 'number' || !Number.isSafeInteger(amount) || amount < 1 || amount > 10_000_000 || typeof bankAmount !== 'number' || !Number.isSafeInteger(bankAmount) || bankAmount < 0 || typeof cardAmount !== 'number' || !Number.isSafeInteger(cardAmount) || cardAmount < 0 || bankAmount + cardAmount !== amount || (input.method === 'bank') !== (bankAmount > 0)) throw new ReceiptError('Invalid amounts');
  return { input, sample: value.sample, createdAt, course: { applicationId: course.applicationId, productName: course.productName, amount, bankAmount, cardAmount } };
}
