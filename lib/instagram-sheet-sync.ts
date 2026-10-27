import { BigQuery } from '@google-cloud/bigquery';
import { google } from 'googleapis';
import { parseSheetLineData, type SheetRecord, type SheetRows } from './instagram-sheet-import';

export function sheetSyncBigQuery() {
  return new BigQuery({ projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || process.env.PROJECT_ID,
    location: 'asia-northeast1', credentials: JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || process.env.GOOGLE_CREDENTIALS || '{}') });
}

// History imports fill gaps only. Newer API observations always win.
export async function mergeSheetRecords(bq: BigQuery, table: string, userId: string, source: string, rows: SheetRecord[], mode: 'history' | 'line') {
  if (!['instagram_reels', 'instagram_stories', 'instagram_insights', 'line_daily'].includes(table)) throw new Error('Invalid import table');
  if (!rows.length) return;
  const [metadata] = await bq.dataset('analyca').table(table).getMetadata();
  const schema = new Map<string, string>(metadata.schema.fields.map((f: { name: string; type: string }) => [f.name, f.type]));
  const fields = Object.keys(rows[0]);
  for (const field of fields) if (!schema.has(field)) throw new Error(`Missing column ${table}.${field}`);
  const types: Record<string, string> = { INTEGER: 'INT64', FLOAT: 'FLOAT64', BOOLEAN: 'BOOL' };
  const key = table === 'instagram_insights' || table === 'line_daily' ? 'date' : 'instagram_id';
  const projection = fields.map(field => `CAST(JSON_VALUE(item, '$.${field}') AS ${types[schema.get(field)!] || schema.get(field)}) AS ${field}`).join(', ');
  const updates = fields.filter(field => field !== key).map(field => `${field} = ${mode === 'line' ? `COALESCE(S.${field}, T.${field})` : `COALESCE(T.${field}, S.${field})`}`);
  if (mode === 'line') updates.push('updated_at = CURRENT_TIMESTAMP()');
  const columns = ['id', 'user_id', ...fields, 'imported_from', 'created_at'];
  const values = ['GENERATE_UUID()', '@user_id', ...fields.map(field => `S.${field}`), '@source', 'CURRENT_TIMESTAMP()'];
  const [job] = await bq.createQueryJob({ query: `MERGE \`mark-454114.analyca.${table}\` T
    USING (SELECT ${projection} FROM UNNEST(JSON_QUERY_ARRAY(@rows)) item) S
    ON T.user_id = @user_id AND T.${key} = S.${key}
    WHEN MATCHED THEN UPDATE SET ${updates.join(', ')}
    WHEN NOT MATCHED THEN INSERT (${columns.join(', ')}) VALUES (${values.join(', ')})`,
    params: { user_id: userId, source, rows: JSON.stringify(rows) } });
  await job.getQueryResults();
}

export async function syncInstagramSheetLineData(userId?: string) {
  const bq = sheetSyncBigQuery();
  const [sources] = await bq.query({ query: `SELECT user_id, spreadsheet_id FROM \`mark-454114.analyca.instagram_sheet_sources\`
    WHERE line_enabled = TRUE ${userId ? 'AND user_id = @user_id' : ''}`, ...(userId ? { params: { user_id: userId } } : {}) });
  const auth = new google.auth.GoogleAuth({ credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS || process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || '{}'), scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] });
  const sheets = google.sheets({ version: 'v4', auth });
  const results = [];
  for (const source of sources) {
    try {
      const response = await sheets.spreadsheets.values.batchGet({ spreadsheetId: source.spreadsheet_id,
        ranges: ["'LINE daily'!A:O", "'daily'!A:O"], valueRenderOption: 'UNFORMATTED_VALUE' });
      const ranges = response.data.valueRanges;
      if (!ranges?.[0]?.values?.length || !ranges[1]?.values?.length) throw new Error('LINE source ranges are empty');
      const rows = parseSheetLineData(ranges[0].values as SheetRows, ranges[1].values as SheetRows);
      if (!rows.length) throw new Error('No valid LINE source dates');
      await mergeSheetRecords(bq, 'line_daily', source.user_id, source.spreadsheet_id, rows, 'line');
      const [job] = await bq.createQueryJob({ query: 'UPDATE `mark-454114.analyca.instagram_sheet_sources` SET last_synced_at=CURRENT_TIMESTAMP(), last_error=NULL WHERE user_id=@id', params: { id: source.user_id } });
      await job.getQueryResults();
      results.push({ userId: source.user_id, success: true, rows: rows.length, latestDate: rows.map(r => String(r.date)).sort().at(-1) });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'LINE sheet sync failed';
      const [job] = await bq.createQueryJob({ query: 'UPDATE `mark-454114.analyca.instagram_sheet_sources` SET last_error=@error WHERE user_id=@id', params: { id: source.user_id, error: message } });
      await job.getQueryResults();
      results.push({ userId: source.user_id, success: false, error: message });
    }
  }
  return { success: results.every(result => result.success), results };
}
