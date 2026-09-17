import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { BigQuery } from '@google-cloud/bigquery';
import { updateUserProfilePictures } from '../bigquery';

test('profile update recovers an already-created job in Tokyo after a retried insert', async () => {
  const requests: Array<{ method?: string; uri: string; qs?: Record<string, unknown>; json?: Record<string, unknown> }> = [];
  const reference = { projectId: 'test-project', jobId: 'retry-job', location: 'asia-northeast1' };
  const requestMock = mock.method(BigQuery.prototype, 'request', function (options, callback) {
    requests.push(options);
    if (options.method === 'POST' && options.uri === '/jobs') {
      callback(Object.assign(new Error('Already exists'), { code: 409 }));
    } else if (/^\/?jobs\//.test(options.uri)) {
      callback(null, { jobReference: reference, status: { state: 'DONE' } });
    } else if (options.uri.startsWith('/queries/')) {
      callback(null, { jobComplete: true, jobReference: reference });
    } else {
      callback(new Error(`Unexpected request: ${options.uri}`));
    }
  });
  try {
    await updateUserProfilePictures('user-1', null, 'https://example.com/profile.jpg');
    assert.equal(requests.length, 3);
    const jobReference = requests[0].json?.jobReference as typeof reference;
    assert.equal(jobReference.location, 'asia-northeast1');
    assert.equal(requests[1].qs?.location, 'asia-northeast1');
    assert.equal(requests[2].qs?.location, 'asia-northeast1');
  } finally {
    requestMock.mock.restore();
  }
});
