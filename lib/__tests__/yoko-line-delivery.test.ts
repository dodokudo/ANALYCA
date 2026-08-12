import assert from 'node:assert/strict';
import test from 'node:test';
import { assignYokoLineCandidateDates, buildYokoLineFlex } from '../yoko-line-delivery';

test('最後の予約日の翌日から1日1件を割り当てる', () => {
  assert.deepEqual(
    assignYokoLineCandidateDates(['2026-08-12', '2026-08-13'], 3, '2026-08-12'),
    [
      '2026-08-14T06:00:00+09:00',
      '2026-08-15T06:00:00+09:00',
      '2026-08-16T06:00:00+09:00',
    ],
  );
});

test('Flexはcarousel内のgigaカードと予約・変更ボタンを作る', () => {
  const draft = {
    id: 'draft-1', batchId: 'batch-1', number: 1, theme: 'テーマ',
    mainText: 'メイン', comment1: 'コメント1', comment2: 'コメント2', status: 'ready' as const,
    approvedSnapshot: null, lineMessageId: null, scheduleId: null, threadId: null,
    lastError: null, manualSavedAt: null, createdAt: '', updatedAt: '', sources: [],
  };
  const message = buildYokoLineFlex([{
    draft,
    scheduledAtJst: '2026-08-14T06:00:00+09:00',
    scheduleToken: 'schedule-token',
    changeToken: 'change-token',
  }]);
  const contents = message.contents as { type: string; contents: Array<Record<string, unknown>> };
  assert.equal(contents.type, 'carousel');
  assert.equal(contents.contents[0].size, 'giga');
  const footer = contents.contents[0].footer as { contents: Array<{ action: { data: string } }> };
  assert.match(footer.contents[0].action.data, /mode=schedule&token=schedule-token/);
  assert.match(footer.contents[1].action.data, /mode=change&token=change-token/);
});
