import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { GET } from '../route';

test('rejects missing and out-of-scope dashboard IDs without returning the library', async () => {
  for (const query of [
    '', '?userId=other', '?userId=27016191458061252',
    '?userId=9a9a517e-1e88-4202-9b9e-e8b5c29657d8', // @moya_mamawork: explicitly excluded
    '?userId=98cedaa3-fff4-466e-90f7-af2662b1b7fb', // @hattatsukaizenkei: explicitly excluded
    '?userId=3470a6b5-0cca-4f1c-9aa4-ff2121bc2493', // @juju_sparta02: first paid charge pending
    '?userId=27832765883013631', // @miko_mayaka: author permission is not dashboard access
    '?userId=33833959932919231', // @yoko_gemqueen: separate agency account
  ]) {
    const response = await GET(new Request(`https://analyca.jp/api/templates/threads${query}`));
    assert.equal(response.status, 403);
    assert.match(response.headers.get('Cache-Control') || '', /no-store/);
    assert.doesNotMatch(await response.text(), /<article/);
  }
});

test('grants the same library to all seven selected subscribers', async () => {
  const expected = await readFile('lib/templates/threads-kata.html', 'utf8');
  for (const userId of [
    '26175083318785401',
    '26246188431711672',
    'd2ad29b7-24c2-45ea-9955-ff283d2e5430',
    '2497734a-d418-472c-b8a2-e8bc6f27eede',
    '178ce52d-45f7-46c6-88cd-1918d07a82a3',
    '27076125818724783',
    '5713887c-aaf0-4801-9b25-41bbb10999d2',
  ]) {
    const response = await GET(new Request(`https://analyca.jp/api/templates/threads?userId=${userId}`));
    assert.equal(response.status, 200, userId);
    assert.equal(await response.text(), expected, userId);
  }
});

test('serves the curated library and retains the approved Miko Mayaka examples', async () => {
  const response = await GET(new Request('https://analyca.jp/api/templates/threads?userId=10012809578833342'));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Content-Type'), 'text/html; charset=utf-8');
  assert.equal(response.headers.get('X-Frame-Options'), 'SAMEORIGIN');
  assert.match(response.headers.get('Cache-Control') || '', /no-store/);
  const html = await response.text();
  assert.equal(html, await readFile('lib/templates/threads-kata.html', 'utf8'));
  assert.equal([...html.matchAll(/<article class="card"/g)].length, 220);
  assert.equal([...html.matchAll(/<span>@miko_mayaka<\/span>/g)].length, 43);
  for (const username of [
    'akirauchiyama_saa', 'biyoukamika', 'kazumi_counseling', 'mon_guchi',
    'mou__diet', 'threads_shukyaku', 'yama_threads', 'yuka_cellbeauty',
  ]) {
    assert.ok(!html.includes(username), `${username} must not be included in the response`);
  }
  assert.doesNotMatch(html, /<header>|判定済み/);
  assert.doesNotMatch(html, /meta-pixel\.js/);
});
