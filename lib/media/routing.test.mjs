import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import ts from 'typescript';
import { MEDIA_ORIGIN, mediaUrl } from './site.ts';

const require = createRequire(import.meta.url);
const { NextRequest } = require('next/server');
const compiledModule = { exports: {} };
const { outputText } = ts.transpileModule(readFileSync(new URL('../../proxy.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
});
new Function('require', 'module', 'exports', outputText)(require, compiledModule, compiledModule.exports);
const { proxy } = compiledModule.exports;

test('public links and canonical URLs share the main-domain media path', () => {
  assert.equal(MEDIA_ORIGIN, 'https://analyca.jp/media');
  assert.equal(mediaUrl('/'), 'https://analyca.jp/media');
  assert.equal(mediaUrl('/articles/example'), 'https://analyca.jp/media/articles/example');
  assert.equal(mediaUrl('/?q=test'), 'https://analyca.jp/media?q=test');
});

test('subdomain aliases preserve article paths and query parameters without doubling /media', () => {
  for (const [path, expected] of [
    ['/', '/media'],
    ['/articles/example', '/media/articles/example'],
    ['/articles?q=instagram', '/media/articles?q=instagram'],
    ['/media/articles/example', '/media/articles/example'],
    ['/sitemap.xml', '/media/sitemap.xml'],
  ]) {
    const response = proxy(new NextRequest(`https://media.analyca.jp${path}`, { headers: { host: 'media.analyca.jp' } }));
    assert.equal(response.status, 308);
    assert.equal(response.headers.get('location'), `https://analyca.jp${expected}`);
  }
});

test('main-domain articles, API requests and Next assets do not redirect', () => {
  for (const url of [
    'https://analyca.jp/media/articles/example',
    'https://media.analyca.jp/api/media/events',
    'https://media.analyca.jp/_next/static/example.js',
  ]) {
    const response = proxy(new NextRequest(url, { headers: { host: new URL(url).host } }));
    assert.equal(response.headers.get('location'), null);
    assert.equal(response.headers.get('x-middleware-next'), '1');
  }
});
