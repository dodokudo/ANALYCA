import fs from 'node:fs';
import path from 'node:path';
import { parseInstagramSheet, type InstagramSheetSource } from '../lib/instagram-sheet-import';
import { mergeSheetRecords, sheetSyncBigQuery } from '../lib/instagram-sheet-sync';

const [sourcePath, userId, flag] = process.argv.slice(2);
if (!sourcePath || !/^\d+$/.test(userId || '')) throw new Error('Usage: import-instagram-sheet.ts source.json userId [--apply]');
const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8')) as InstagramSheetSource & { spreadsheetId: string };
if (!source.spreadsheetId) throw new Error('Missing spreadsheetId');
const parsed = parseInstagramSheet(source);
const report = Object.fromEntries(Object.entries(parsed).map(([table, rows]) => {
  const dates = rows.map(row => String(row.date || row.timestamp)).sort();
  return [table, { count: rows.length, first: dates[0], last: dates.at(-1) }];
}));
console.log(JSON.stringify(report, null, 2));
fs.writeFileSync(path.join(path.dirname(sourcePath), 'parsed.json'), JSON.stringify(parsed));
if (flag === '--apply') {
  const bq = sheetSyncBigQuery();
  const [schemaJob] = await bq.createQueryJob({ query: fs.readFileSync('scripts/migrations/20261027-instagram-sheet-history.sql', 'utf8') });
  await schemaJob.getQueryResults();
  for (const [table, rows] of Object.entries(parsed)) {
    const backupPath = path.join(path.dirname(sourcePath), `${table}.before.json`);
    if (!fs.existsSync(backupPath)) {
      const [before] = await bq.query({ query: `SELECT * FROM \`mark-454114.analyca.${table}\` WHERE user_id=@user_id`, params: { user_id: userId } });
      fs.writeFileSync(backupPath, JSON.stringify(before));
    }
    await mergeSheetRecords(bq, table, userId, source.spreadsheetId, rows, 'history');
    const [counts] = await bq.query({ query: `SELECT COUNT(*) AS count, COUNT(DISTINCT ${table.endsWith('insights') || table === 'line_daily' ? 'date' : 'instagram_id'}) AS unique_count FROM \`mark-454114.analyca.${table}\` WHERE user_id=@user_id`, params: { user_id: userId } });
    console.log(table, counts);
    if (counts[0].count !== counts[0].unique_count) throw new Error(`Duplicate DB keys in ${table}`);
  }
  const [job] = await bq.createQueryJob({ query: `MERGE \`mark-454114.analyca.instagram_sheet_sources\` T
    USING (SELECT @user_id AS user_id, @sheet AS spreadsheet_id) S ON T.user_id=S.user_id
    WHEN MATCHED THEN UPDATE SET spreadsheet_id=S.spreadsheet_id, line_enabled=TRUE
    WHEN NOT MATCHED THEN INSERT (user_id,spreadsheet_id,line_enabled) VALUES (S.user_id,S.spreadsheet_id,TRUE)`,
    params: { user_id: userId, sheet: source.spreadsheetId } });
  await job.getQueryResults();
}
