import { randomUUID } from 'node:crypto';
import { google, type sheets_v4 } from 'googleapis';
import { getUserInsights, getUserReels, getUserStories } from './bigquery';
import { sheetSyncBigQuery } from './instagram-sheet-sync';
import { sheetDate, type SheetCell } from './instagram-sheet-import';
import { RAW_TABS, blankWhenNoPosts, cellValue, dateSerial, exportRows, imageFormula, monthsToPrepare, planRawUpserts, sameValue, type ExportData } from './instagram-sheet-export-plan';

const SOURCE_TABLE = '`mark-454114.analyca.instagram_sheet_sources`';
const quoteTab = (title: string) => `'${title.replaceAll("'", "''")}'`;
const isMonth = (title: string) => /^\d{4}_\d{2,3} ストーリーズ\s*$/.test(title);
const valueOf = (cell?: sheets_v4.Schema$CellData): SheetCell => {
  const value = cell?.userEnteredValue;
  return value?.stringValue ?? value?.numberValue ?? value?.boolValue ?? null;
};
const formulaOf = (cell?: sheets_v4.Schema$CellData) => cell?.userEnteredValue?.formulaValue;
const gridRows = (sheet: sheets_v4.Schema$Sheet) => sheet.data?.[0]?.rowData || [];
const formulaRequest = (sheetId: number, row: number, col: number, formula: string): sheets_v4.Schema$Request => ({
  updateCells: { start: { sheetId, rowIndex: row, columnIndex: col }, rows: [{ values: [{ userEnteredValue: { formulaValue: formula } }] }], fields: 'userEnteredValue' },
});

export function exportSheetsClient() {
  const auth = new google.auth.GoogleAuth({ credentials: JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || process.env.GOOGLE_CREDENTIALS || '{}'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  return google.sheets({ version: 'v4', auth });
}

export async function readExportSheet(sheets: sheets_v4.Sheets, spreadsheetId: string) {
  const { data: metadata } = await sheets.spreadsheets.get({ spreadsheetId, fields: 'spreadsheetId,properties(timeZone),sheets(properties)' });
  if (metadata.properties?.timeZone !== 'Asia/Tokyo') throw new Error('Sheet timezone must be Asia/Tokyo');
  const required = [...RAW_TABS, 'stories'];
  for (const title of required) if (!metadata.sheets?.some(s => s.properties?.title === title)) throw new Error(`Missing sheet: ${title}`);
  const ranges = metadata.sheets!.flatMap(s => {
    const p = s.properties!;
    const title = p.title!;
    if (required.includes(title)) return [`${quoteTab(title)}!A1:${title === 'reel rawdata' ? 'Q' : title === 'stories rawdata' ? 'L' : title === 'stories' ? 'H' : 'G'}${p.gridProperties!.rowCount}`];
    return isMonth(title) ? [`${quoteTab(title)}!A1:C10`] : [];
  });
  const { data } = await sheets.spreadsheets.get({ spreadsheetId, ranges,
    fields: 'sheets(properties,data(rowData(values(userEnteredValue,userEnteredFormat))))' });
  return data;
}

/** Produces one atomic Sheets batch. Only raw values, image formulas and monthly presentation are writable. */
export function buildSheetExportPlan(snapshot: sheets_v4.Schema$Spreadsheet, data: ExportData, now = new Date(), insightsStartDate?: string) {
  const sheets = snapshot.sheets || [];
  const requests: sheets_v4.Schema$Request[] = [];
  const sourceRows = exportRows(data);
  const tabs = RAW_TABS.map(title => {
    const sheet = sheets.find(s => s.properties?.title === title);
    if (!sheet) throw new Error(`Missing sheet: ${title}`);
    const p = sheet.properties!;
    const grid = gridRows(sheet);
    const plan = planRawUpserts(title, grid.map(row => (row.values || []).map(valueOf)), sourceRows[title], insightsStartDate);
    const sheetId = p.sheetId!;
    if (plan.rows.length > p.gridProperties!.rowCount!) requests.push({ appendDimension: { sheetId, dimension: 'ROWS', length: plan.rows.length - p.gridProperties!.rowCount! } });
    for (const change of plan.changed) {
      const before = grid[change.row - 1]?.values || [];
      if (before.slice(0, change.values.length).some(formulaOf)) throw new Error(`Unexpected raw formula: ${title} row ${change.row}`);
      const values = change.values.map((value, col) => {
        const cell = cellValue(value);
        if (change.added) {
          const format = structuredClone(grid[1]?.values?.[col]?.userEnteredFormat || {});
          if (format.textFormat) delete format.textFormat.link;
          cell.userEnteredFormat = format;
        }
        return cell;
      });
      requests.push({ updateCells: { start: { sheetId, rowIndex: change.row - 1, columnIndex: 0 }, rows: [{ values }], fields: change.added ? 'userEnteredValue,userEnteredFormat' : 'userEnteredValue' } });
    }
    if (title === 'reel rawdata') {
      for (let row = 2; row <= plan.rows.length; row++) {
        // Old unused Q cells stay empty; only existing formulas and newly appended rows need continuation.
        const current = formulaOf(grid[row - 1]?.values?.[16]);
        if (!current && !plan.changed.some(change => change.added && change.row === row)) continue;
        const formula = imageFormula(`P${row}`);
        if (current !== formula) requests.push(formulaRequest(sheetId, row - 1, 16, formula));
      }
    }
    return { title, ...plan };
  });

  const stories = sheets.find(s => s.properties?.title === 'stories')!;
  const storyId = stories.properties!.sheetId!;
  const storyGrid = gridRows(stories);
  const storyCount = tabs.find(tab => tab.title === 'stories rawdata')!.rows.length;
  const displayCount = Math.max(stories.properties!.gridProperties!.rowCount!, storyCount);
  if (displayCount > stories.properties!.gridProperties!.rowCount!) {
    requests.push({ appendDimension: { sheetId: storyId, dimension: 'ROWS', length: displayCount - stories.properties!.gridProperties!.rowCount! } });
    requests.push({ copyPaste: { source: { sheetId: storyId, startRowIndex: 2, endRowIndex: 3, startColumnIndex: 0, endColumnIndex: 8 },
      destination: { sheetId: storyId, startRowIndex: stories.properties!.gridProperties!.rowCount!, endRowIndex: displayCount, startColumnIndex: 0, endColumnIndex: 8 }, pasteType: 'PASTE_FORMAT' } });
  }
  for (let row = 2; row <= displayCount; row++) {
    if (!storyGrid[row - 1]?.values?.[1]?.userEnteredValue) requests.push(formulaRequest(storyId, row - 1, 1, `='stories rawdata'!A${row}`));
    const formula = imageFormula(`G${row}`, `IFNA(VLOOKUP(B${row},'stories rawdata'!A:C,3,FALSE),"")`);
    const current = storyGrid[row - 1]?.values?.[7];
    if (current?.userEnteredValue && !formulaOf(current)) throw new Error(`Unexpected manual image URL: stories!H${row}`);
    if (formulaOf(current) !== formula) requests.push(formulaRequest(storyId, row - 1, 7, formula));
  }

  const monthSheets = sheets.filter(s => isMonth(s.properties!.title!));
  const months = monthSheets.map(sheet => ({ sheet, month: sheetDate(valueOf(gridRows(sheet)[1]?.values?.[2]))?.slice(0, 7) }));
  const template = [...months].sort((a, b) => String(b.month).localeCompare(String(a.month)))[0]?.sheet;
  if (!template) throw new Error('No existing monthly story template');
  const formulaRows = [2, 3, 4, 5, 8];
  for (const row of formulaRows) if (!formulaOf(gridRows(template)[row]?.values?.[2])) throw new Error('Monthly template formula missing');
  const createdMonths: string[] = [];
  let nextId = Math.max(...sheets.map(s => s.properties!.sheetId!)) + 1;
  for (const month of monthsToPrepare(now)) {
    if (months.some(item => item.month === month)) continue;
    const title = `${month.replace('-', '_')} ストーリーズ`;
    if (sheets.some(s => s.properties!.title === title)) throw new Error(`Month selector differs from tab name: ${title}`);
    const sheetId = nextId++;
    const p = template.properties!;
    requests.push({ duplicateSheet: { sourceSheetId: p.sheetId!, newSheetId: sheetId, newSheetName: title, insertSheetIndex: p.index! } });
    // Duplicate layout only; remove all copied input, then restore labels and the five display formulas.
    requests.push({ updateCells: { range: { sheetId }, fields: 'userEnteredValue' } });
    requests.push({ copyPaste: { source: { sheetId: p.sheetId!, startRowIndex: 0, endRowIndex: 10, startColumnIndex: 0, endColumnIndex: 2 }, destination: { sheetId, startRowIndex: 0, endRowIndex: 10, startColumnIndex: 0, endColumnIndex: 2 }, pasteType: 'PASTE_NORMAL' } });
    requests.push({ updateCells: { start: { sheetId, rowIndex: 1, columnIndex: 2 }, rows: [{ values: [cellValue(dateSerial(`${month}-01`))] }], fields: 'userEnteredValue' } });
    for (const row of formulaRows) requests.push(formulaRequest(sheetId, row, 2, blankWhenNoPosts(formulaOf(gridRows(template)[row]?.values?.[2])!)));
    createdMonths.push(month);
    months.push({ sheet: { properties: { ...p, sheetId, title } }, month });
  }
  const finalStories = tabs.find(tab => tab.title === 'stories rawdata')!.rows.slice(1);
  for (const { sheet, month } of months) {
    if (!month) throw new Error('Monthly story selector is not a date');
    const p = sheet.properties!;
    const count = finalStories.filter(row => sheetDate(row[3])?.startsWith(month)).length;
    const oldColumns = p.gridProperties!.columnCount!;
    if (count + 2 > oldColumns) {
      requests.push({ appendDimension: { sheetId: p.sheetId!, dimension: 'COLUMNS', length: count + 2 - oldColumns } });
      requests.push({ copyPaste: { source: { sheetId: p.sheetId!, startRowIndex: 0, endRowIndex: 10, startColumnIndex: oldColumns - 1, endColumnIndex: oldColumns }, destination: { sheetId: p.sheetId!, startRowIndex: 0, endRowIndex: 10, startColumnIndex: oldColumns, endColumnIndex: count + 2 }, pasteType: 'PASTE_FORMAT' } });
    }
    // FILTER spills numeric date/rate values; the monthly template must display their units.
    for (const [row, format] of [[2, { type: 'DATE_TIME', pattern: 'yyyy/MM/dd HH:mm' }], [5, { type: 'PERCENT', pattern: '0.0%' }]] as const) {
      const current = gridRows(sheet)[row]?.values?.[2]?.userEnteredFormat?.numberFormat;
      if (current?.type !== format.type || current?.pattern !== format.pattern) requests.push({ repeatCell: {
        range: { sheetId: p.sheetId!, startRowIndex: row, endRowIndex: row + 1, startColumnIndex: 2, endColumnIndex: Math.max(oldColumns, count + 2) },
        cell: { userEnteredFormat: { numberFormat: format } }, fields: 'userEnteredFormat.numberFormat',
      } });
    }
    for (const row of formulaRows) {
      const current = formulaOf(gridRows(sheet)[row]?.values?.[2]);
      if (current && current !== blankWhenNoPosts(current)) requests.push(formulaRequest(p.sheetId!, row, 2, blankWhenNoPosts(current)));
    }
  }
  return { requests, tabs, createdMonths };
}

export async function applySheetExport(sheets: sheets_v4.Sheets, spreadsheetId: string, data: ExportData, now = new Date(), insightsStartDate?: string) {
  const snapshot = await readExportSheet(sheets, spreadsheetId);
  const plan = buildSheetExportPlan(snapshot, data, now, insightsStartDate);
  if (plan.requests.length) await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: plan.requests } });
  // Read back all three raw tables. A partial write or a concurrent legacy writer is a failure, not a successful run.
  const result = await sheets.spreadsheets.values.batchGet({ spreadsheetId, ranges: plan.tabs.map(t => `${quoteTab(t.title)}!A1:${t.title === 'Instagram insight' ? 'G' : t.title === 'reel rawdata' ? 'P' : 'L'}${t.rows.length}`), valueRenderOption: 'UNFORMATTED_VALUE' });
  for (let i = 0; i < plan.tabs.length; i++) {
    const actual = result.data.valueRanges?.[i]?.values || [];
    const tab = plan.tabs[i];
    for (let row = 0; row < tab.rows.length; row++) {
      if (tab.rows[row].some((value, col) => !sameValue(value, actual[row]?.[col]))) throw new Error(`Export verification failed: ${tab.title} row ${row + 1}`);
    }
  }
  return { tabs: plan.tabs.map(t => ({ title: t.title, rows: t.rows.length - 1, added: t.added, updated: t.updated })), createdMonths: plan.createdMonths };
}

export async function syncInstagramSheetExports(userId?: string) {
  const bq = sheetSyncBigQuery();
  const query = async (sql: string, params: Record<string, string>) => {
    const [job] = await bq.createQueryJob({ query: sql, params });
    return (await job.getQueryResults())[0];
  };
  const [sources] = await bq.query({ query: `SELECT user_id, spreadsheet_id, CAST(export_insights_start_date AS STRING) AS insights_start_date FROM ${SOURCE_TABLE} WHERE export_enabled = TRUE ${userId ? 'AND user_id = @id' : ''}`, ...(userId ? { params: { id: userId } } : {}) });
  const sheets = exportSheetsClient();
  const results = [];
  for (const source of sources) {
    const params = { id: source.user_id as string, token: randomUUID() };
    try {
      await query(`UPDATE ${SOURCE_TABLE} SET export_lock=@token, export_lock_at=CURRENT_TIMESTAMP() WHERE user_id=@id AND export_enabled=TRUE AND (export_lock IS NULL OR export_lock_at < TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 10 MINUTE))`, params);
      const locks = await query(`SELECT export_lock FROM ${SOURCE_TABLE} WHERE user_id=@id`, { id: params.id });
      if (locks.length !== 1 || locks[0].export_lock !== params.token) {
        results.push({ userId: params.id, success: false, error: 'Export already running or duplicate source configuration' });
        continue;
      }
      const [insights, reels, stories] = await Promise.all([getUserInsights(params.id, null), getUserReels(params.id, null), getUserStories(params.id, null)]);
      if (!source.insights_start_date) throw new Error('Daily insight cutover date is not configured');
      const result = await applySheetExport(sheets, source.spreadsheet_id, { insights, reels, stories }, new Date(), source.insights_start_date);
      await query(`UPDATE ${SOURCE_TABLE} SET last_export_at=CURRENT_TIMESTAMP(), last_export_error=NULL, export_lock=NULL, export_lock_at=NULL WHERE user_id=@id AND export_lock=@token`, params);
      results.push({ userId: params.id, success: true, ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sheet export failed';
      await query(`UPDATE ${SOURCE_TABLE} SET last_export_error=@error, export_lock=NULL, export_lock_at=NULL WHERE user_id=@id AND export_lock=@token`, { ...params, error: message });
      results.push({ userId: params.id, success: false, error: message });
    }
  }
  return { success: results.every(result => result.success), results };
}
