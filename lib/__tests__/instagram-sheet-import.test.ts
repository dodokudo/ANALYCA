import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseInstagramSheet, parseSheetLineData, sheetDate, sheetNumber, type InstagramSheetSource } from '../instagram-sheet-import';

const empty = (): InstagramSheetSource => ({ reels: [[]], reelManual: [[], []], stories: [[]], insights: [[]], line: [[]], daily: [[], [], [], [], []] });

test('dates use JST, duration serials preserve more than 24 hours, and IDs stay strings', () => {
  const source = empty();
  source.reels.push(['18008253692774466', '', 'REELS', 'VIDEO', 'https://www.instagram.com/reel/example/', 46291.85422453703, 100, 70, 3, 1, 0, 2, 0, 1.5, 15]);
  source.reelManual.push(['', '', '', '18008253692774466', 'title', '', 30, '', '', '', '', '', '', '', '', '', '', '', 4]);
  const reel = parseInstagramSheet(source).instagram_reels[0];
  assert.equal(reel.instagram_id, '18008253692774466');
  assert.equal(reel.timestamp, '2026-09-26T11:30:05.000Z');
  assert.equal(reel.video_view_total_time_hours, '36');
  assert.equal(reel.duration_seconds, 30);
  assert.equal(reel.follows, 4);
  assert.equal(sheetDate(46321), '2026-10-26');
  assert.equal(sheetNumber(''), null);
  assert.equal(sheetNumber(0), 0);
});

test('raw story views and reach are not swapped by processed sheet labels', () => {
  const source = empty();
  source.stories.push(['18109642634186424', '', '', 46318.635787037034, 681, 381, 2, '', 11, 0, 9, 422]);
  const story = parseInstagramSheet(source).instagram_stories[0];
  assert.equal(story.views, 681); assert.equal(story.reach, 381);
  assert.equal(story.profile_visits, 9);
});

test('LINE uses the daily registration column, deduplicates exports, and ignores missing source zero formulas', () => {
  const daily = [[], [], [], [], [], [46320, '', '', '', '', '', '', '', '', '', '', '', '', 15808, 7], [46321, '', '', '', '', '', '', '', '', '', '', '', '', '', 0]];
  const rows = parseSheetLineData([[], [46320, 'account', 15808], [46320, 'account', 15808], [46321, 'account', '']], daily);
  assert.equal(rows.length, 1); assert.equal(rows[0].registrations, 7);
  assert.throws(() => parseSheetLineData([[], [46320, 'account', 15808], [46320, 'account', 15809]], daily), /Conflicting LINE/);
});

test('ambiguous media IDs and conflicting duplicates stop the import', () => {
  const source = empty();
  source.reels.push([17903615391330100, '', '', '', '', 46291]);
  assert.throws(() => parseInstagramSheet(source), /Unsafe numeric/);
  source.reels = [[], ['18008253692774466', '', '', '', '', 46291, 100], ['18008253692774466', '', '', '', '', 46291, 200]];
  assert.throws(() => parseInstagramSheet(source), /Conflicting sheet/);
});

test('LINE-only historical days remain visible without inventing Instagram counts', async () => {
  const { buildInstagramDailyRows } = await import('../instagram-daily');
  const rows = buildInstagramDailyRows([], [], [{ date: '2026-10-26', followers: 15809, registrations: 1 }]);
  assert.equal(rows[0].lineRegistrations, 1);
  assert.equal(rows[0].followers_count, null);
  assert.equal(rows[0].reach, undefined);
});
