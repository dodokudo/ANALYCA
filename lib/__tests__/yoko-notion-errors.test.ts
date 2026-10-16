import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { YokoNotionError, yokoNotionSyncErrorMessage } from '../yoko-notion-errors';
import { getYokoNotionDataSourceIndex } from '../yoko-notion';

test('Notion 401 retains its status and does not retry an invalid token', async () => {
  const previousToken = process.env.NOTION_API_TOKEN;
  process.env.NOTION_API_TOKEN = 'test-only';
  const fetchMock = mock.method(globalThis, 'fetch', async () => Response.json({
    code: 'unauthorized', message: 'API token is invalid.',
  }, { status: 401 }));
  try {
    await assert.rejects(getYokoNotionDataSourceIndex('instagram_script'), (error: unknown) => {
      assert.ok(error instanceof YokoNotionError);
      assert.equal(error.status, 401);
      assert.match(yokoNotionSyncErrorMessage(error), /管理者.*更新/);
      assert.doesNotMatch(yokoNotionSyncErrorMessage(error), /test-only|API token/);
      return true;
    });
    assert.equal(fetchMock.mock.callCount(), 1);
  } finally {
    fetchMock.mock.restore();
    if (previousToken === undefined) delete process.env.NOTION_API_TOKEN;
    else process.env.NOTION_API_TOKEN = previousToken;
  }
});

test('Notion access, configuration and transient failures give different recovery steps', () => {
  for (const status of [403, 404]) {
    assert.match(yokoNotionSyncErrorMessage(new YokoNotionError(status, 'detail')), /アクセス権/);
  }
  assert.match(yokoNotionSyncErrorMessage(new Error('NOTION_API_TOKEN is not configured')), /設定を依頼/);
  for (const error of [new YokoNotionError(429, ''), new YokoNotionError(503, ''), new Error('network')]) {
    assert.match(yokoNotionSyncErrorMessage(error), /少し待って/);
  }
});
