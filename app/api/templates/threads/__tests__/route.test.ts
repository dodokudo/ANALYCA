import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { GET } from '../route';

test('rejects missing and out-of-scope dashboard IDs without returning the library', async () => {
  for (const query of ['', '?userId=other', '?userId=27016191458061252']) {
    const response = await GET(new Request(`https://analyca.jp/api/templates/threads${query}`));
    assert.equal(response.status, 403);
    assert.match(response.headers.get('Cache-Control') || '', /no-store/);
    assert.doesNotMatch(await response.text(), /<article/);
  }
});

test('serves the complete original library for the initial dashboard', async () => {
  const response = await GET(new Request('https://analyca.jp/api/templates/threads?userId=10012809578833342'));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Content-Type'), 'text/html; charset=utf-8');
  assert.equal(response.headers.get('X-Frame-Options'), 'SAMEORIGIN');
  assert.match(response.headers.get('Cache-Control') || '', /no-store/);
  const html = await response.text();
  assert.equal(html, await readFile('lib/templates/threads-kata.html', 'utf8'));
  assert.equal([...html.matchAll(/<article class="card"/g)].length, 290);
  assert.doesNotMatch(html, /meta-pixel\.js/);
});
