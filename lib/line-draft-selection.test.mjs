import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isDraftReadyForLine,
  selectReadyDraftsForLine,
} from './line-draft-selection.ts';

const ready = {
  status: 'ready',
  lineMessageId: null,
  scheduleId: null,
  threadId: null,
};

test('excludes scheduled, published, and LINE-sent drafts', () => {
  assert.equal(isDraftReadyForLine(ready), true);
  assert.equal(isDraftReadyForLine({ ...ready, scheduleId: 'schedule-1' }), false);
  assert.equal(isDraftReadyForLine({ ...ready, threadId: 'thread-1' }), false);
  assert.equal(isDraftReadyForLine({ ...ready, lineMessageId: 'line-1' }), false);
  assert.equal(isDraftReadyForLine({ ...ready, status: 'style_review' }), false);
});

test('selects only requested drafts in the requested order', () => {
  const drafts = [
    { id: 'draft-a', ...ready },
    { id: 'draft-b', ...ready },
    { id: 'draft-c', ...ready },
    { id: 'scheduled', ...ready, scheduleId: 'schedule-1' },
  ];
  assert.deepEqual(
    selectReadyDraftsForLine(drafts, ['draft-c', 'draft-a']).map((item) => item.id),
    ['draft-c', 'draft-a'],
  );
  assert.throws(
    () => selectReadyDraftsForLine(drafts, ['scheduled']),
    /予約済み/,
  );
});
