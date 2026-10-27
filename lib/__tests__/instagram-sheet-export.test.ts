import test from 'node:test';
import assert from 'node:assert/strict';
import { dateSerial, exportRows, monthsToPrepare, planRawUpserts, cellValue, type ExportData } from '../instagram-sheet-export-plan';
import { buildSheetExportPlan, applySheetExport } from '../instagram-sheet-export';
import type { sheets_v4 } from 'googleapis';

test('JST timestamps and BigQuery DATE wrappers retain the sheet calendar', () => {
  assert.equal(dateSerial({ value: '2026-10-23' }), 46318);
  assert.equal(dateSerial('2026-10-22T15:00:00Z', true), 46318);
});

test('month end prepares next month; missed runs repair current month, including year rollover', () => {
  assert.deepEqual(monthsToPrepare(new Date('2026-12-30T15:00:00Z')), ['2026-12', '2027-01']);
  assert.deepEqual(monthsToPrepare(new Date('2026-12-31T15:00:00Z')), ['2027-01']);
  assert.deepEqual(monthsToPrepare(new Date('2028-02-29T00:00:00Z')), ['2028-02', '2028-03']);
  assert.deepEqual(monthsToPrepare(new Date('2026-10-27T00:00:00Z')), ['2026-10']);
});

test('reconcile rounded IDs, bad duplicate IDs, missing IDs by permalink or unique legacy timestamp', () => {
  const existing = [['id'], [12345678912345600, '', '', '', 'https://www.instagram.com/reel/A/', 45000],
    ['old', '', '', '', 'https://www.instagram.com/reel/B/', 45001], ['old', '', '', '', 'copied title', 45002],
    [null, '', '', '', 'https://www.instagram.com/reel/C/', 45003]];
  const input = [['12345678912345678', null, null, null, 'https://www.instagram.com/reel/A/', 45000],
    ['corrected', null, null, null, 'https://www.instagram.com/reel/D/', 45002],
    ['found', null, null, null, 'https://www.instagram.com/reel/C/', 45003]];
  const plan = planRawUpserts('reel rawdata', existing, input);
  assert.equal(plan.added, 0);
  assert.equal(plan.rows[3][0], 'corrected');
  assert.equal(plan.rows[2][0], 'old');
  assert.equal(planRawUpserts('reel rawdata', plan.rows, input).changed.length, 0);
  assert.deepEqual(cellValue('12345678912345678').userEnteredValue, { stringValue: '12345678912345678' });
});

test('null API values preserve archives, measured zero updates, unmatched rows remain', () => {
  const plan = planRawUpserts('stories rawdata', [['id'], [12345678912345600, 'drive-image', 'saved-image', 45000, 15, 8, 2], ['other', '', '', 44000, 10]],
    [['sheet:12345678912345600', null, '', 45000, null, 0, null]]);
  assert.equal(plan.added, 0);
  assert.deepEqual(plan.rows[1].slice(0, 7), ['sheet:12345678912345600', 'drive-image', 'saved-image', 45000, 15, 0, 2]);
  assert.equal(plan.rows[2][0], 'other');
  assert.throws(() => planRawUpserts('stories rawdata', [['id']], []), /Empty/);
  assert.throws(() => planRawUpserts('stories rawdata', [['id'], ['dup'], ['dup']], [['dup']]), /Ambiguous/);
});

test('cutover does not overwrite or backfill historical daily values', () => {
  const plan = planRawUpserts('Instagram insight', [['Date'], [46317, 50, 10, 300]], [[46317, 60, 20, 400], [46316, 50], [46318, 65]], '2026-10-23');
  assert.equal(plan.added, 1);
  assert.equal(plan.updated, 0);
  assert.equal(plan.rows[1][3], 300);
});

const data = {
  insights: [{ date: '2026-10-23', followers_count: 10, posts_count: 4, reach: 5, engagement: 9, total_interactions: 15 }],
  reels: [{ id: 'reel', instagram_id: 'reel', timestamp: new Date('2026-10-23T00:00Z'), video_view_total_time_hours: '48' }],
  stories: [{ instagram_id: 'story', timestamp: new Date('2026-10-23T00:00Z'), thumbnail_url: 'https://storage.googleapis.com/archive/a.jpg', views: null, reach: 3 }],
} as ExportData;

test('watch hours convert to sheet days; snapshot seconds win; engagement keeps original definition', () => {
  assert.equal(exportRows(data)['reel rawdata'][0][13], 2);
  assert.equal(exportRows(data)['Instagram insight'][0][4], 15);
  const snapshot = structuredClone(data);
  snapshot.reels[0].metrics = { totalWatchSeconds: 86400 } as NonNullable<typeof snapshot.reels[0]['metrics']>;
  assert.equal(exportRows(snapshot)['reel rawdata'][0][13], 1);
  delete snapshot.insights[0].total_interactions;
  assert.equal(exportRows(snapshot)['Instagram insight'][0][4], null);
});

function fixture(): sheets_v4.Schema$Spreadsheet {
  const names = ['Instagram insight', 'reel rawdata', 'stories rawdata', 'stories', '2026_12 ストーリーズ'];
  return { sheets: names.map((title, sheetId) => ({ properties: { title, sheetId, index: sheetId, gridProperties: { rowCount: 10, columnCount: 26 } },
    data: [{ rowData: title.includes('ストーリーズ') ? Array.from({ length: 10 }, (_, row) => ({ values: [{}, {}, row === 1 ? cellValue(dateSerial('2026-12-01'))
      : [2, 3, 4, 5, 8].includes(row) ? { userEnteredValue: { formulaValue: '=FILTER(stories!A:A,MONTH(stories!A:A)=MONTH(C2))' } }
      : { userEnteredValue: { stringValue: 'existing manual memo' } }] })) : [{ values: [cellValue('header')] }] }] })) };
}

test('new month keeps layout but clears copied manual data, existing C2/manual fields stay untouched', () => {
  const plan = buildSheetExportPlan(fixture(), data, new Date('2026-12-31T00:00Z'), '2026-10-23');
  assert.deepEqual(plan.createdMonths, ['2027-01']);
  const duplicate = plan.requests.find(r => r.duplicateSheet)!.duplicateSheet!;
  assert.equal(duplicate.newSheetName, '2027_01 ストーリーズ');
  assert.ok(plan.requests.some(r => r.updateCells?.range?.sheetId === duplicate.newSheetId && r.updateCells.fields === 'userEnteredValue'));
  const newFormulas = plan.requests.filter(r => r.updateCells?.start?.sheetId === duplicate.newSheetId);
  assert.deepEqual(newFormulas.map(r => r.updateCells!.start!.rowIndex).sort(), [1, 2, 3, 4, 5, 8]);
  assert.ok(!plan.requests.some(r => r.updateCells?.start?.sheetId === 4 && [1, 6, 7, 9].includes(r.updateCells.start.rowIndex!)));
  const present = fixture();
  const january = structuredClone(present.sheets![4]);
  january.properties = { ...january.properties, sheetId: 9, title: '2027_01 ストーリーズ' };
  january.data![0].rowData![1].values![2] = cellValue(dateSerial('2027-01-01'));
  present.sheets!.push(january);
  assert.deepEqual(buildSheetExportPlan(present, data, new Date('2026-12-31T00:00Z')).createdMonths, []);
});

test('failed writes and readback mismatch cannot be reported as success', async () => {
  let writes = 0;
  const fake = { spreadsheets: {
    get: async () => ({ data: { ...fixture(), properties: { timeZone: 'Asia/Tokyo' } } }),
    batchUpdate: async (): Promise<void> => { writes++; throw new Error('quota'); },
    values: { batchGet: async () => ({ data: { valueRanges: [] } }) },
  } };
  await assert.rejects(applySheetExport(fake as unknown as sheets_v4.Sheets, 'sheet', data, new Date('2026-12-01T00:00Z')), /quota/);
  assert.equal(writes, 1);
  fake.spreadsheets.batchUpdate = async () => { writes++; };
  await assert.rejects(applySheetExport(fake as unknown as sheets_v4.Sheets, 'sheet', data, new Date('2026-12-01T00:00Z')), /verification failed/);
});
