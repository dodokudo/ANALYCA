import type { sheets_v4 } from 'googleapis';
import type { InstagramInsights, InstagramReel, InstagramStory } from './bigquery';
import { getSavedReelMetrics } from './instagram-reel-metrics';
import { sheetDate, type SheetCell, type SheetRows } from './instagram-sheet-import';

export type RawTab = 'Instagram insight' | 'reel rawdata' | 'stories rawdata';
export const RAW_TABS: RawTab[] = ['Instagram insight', 'reel rawdata', 'stories rawdata'];
export type ExportData = { insights: (InstagramInsights & { total_interactions?: number | null })[]; reels: InstagramReel[]; stories: InstagramStory[] };

export function dateSerial(value: unknown, timestamp = false): number {
  const raw = value && typeof value === 'object' && 'value' in value ? value.value : value;
  const date = raw instanceof Date ? raw : new Date(String(raw));
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid export date');
  return date.getTime() / 86400000 + 25569 + (timestamp ? 9 / 24 : 0);
}

export function exportRows(data: ExportData): Record<RawTab, SheetRows> {
  return {
    // The legacy sheet's Engagement is total_interactions, not accounts_engaged.
    'Instagram insight': data.insights.map(r => [dateSerial(r.date), r.followers_count, r.posts_count, r.reach, r.total_interactions ?? null, r.profile_views, r.website_clicks]),
    'reel rawdata': data.reels.map(r => {
      const m = getSavedReelMetrics(r);
      return [r.instagram_id, r.caption, r.media_product_type, r.media_type, r.permalink, dateSerial(r.timestamp, true),
        m.views ?? r.views, m.reach ?? r.reach, r.total_interactions, m.likes ?? r.like_count, m.comments ?? r.comments_count,
        m.saved ?? r.saved, m.shares ?? r.shares,
        m.totalWatchSeconds === null ? null : m.totalWatchSeconds / 86400, m.avgWatchSeconds ?? r.avg_watch_time_seconds,
        r.drive_image_url || r.thumbnail_url || null];
    }),
    'stories rawdata': data.stories.map(r => [r.instagram_id, r.drive_image_url || null, r.thumbnail_url || null, dateSerial(r.timestamp, true),
      r.views, r.reach, r.replies, r.caption || null, r.total_interactions, r.follows, r.profile_visits, r.navigation]),
  };
}

const hasValue = (value: SheetCell | undefined) => value !== undefined && value !== null && value !== '';
export function sameValue(a: SheetCell | undefined, b: SheetCell | undefined) {
  if (!hasValue(a) && !hasValue(b)) return true;
  return typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) < 1e-9 : a === b;
}
const permalink = (value: SheetCell | undefined) => String(value || '').replace(/\?.*$/, '').replace(/\/$/, '');

/** Keep existing row order and all unmatched history. Never coerce IDs or fill missing observations with zero. */
export function planRawUpserts(tab: RawTab, existing: SheetRows, incoming: SheetRows, insightsStartDate?: string) {
  const width = tab === 'Instagram insight' ? 7 : tab === 'reel rawdata' ? 16 : 12;
  const rows = existing.map(row => row.slice(0, width));
  while (rows.length > 1 && rows.at(-1)!.every(value => !hasValue(value))) rows.pop();
  if (!rows.length || !incoming.length) throw new Error(`Empty export source: ${tab}`);
  const changed: { row: number; values: SheetCell[]; added: boolean }[] = [];
  const seen = new Set<string>();
  const claimed = new Set<number>();
  for (const input of incoming) {
    const key = String(input[0]);
    if (!hasValue(input[0]) || seen.has(key)) throw new Error(`Duplicate or missing DB key in ${tab}: ${key}`);
    if (tab !== 'Instagram insight' && typeof input[0] !== 'string') throw new Error('Instagram IDs must be strings');
    seen.add(key);
    // Preserve historical daily observations from before the cutover, including old gaps.
    if (tab === 'Instagram insight' && insightsStartDate && sheetDate(input[0])! < insightsStartDate) continue;
    let matches: number[];
    if (tab === 'Instagram insight') {
      matches = rows.flatMap((r, i) => i && sheetDate(r[0]) === sheetDate(input[0]) ? [i] : []);
    } else if (tab === 'reel rawdata' && permalink(input[4])) {
      // Permalinks reconcile the rounded, missing and duplicated IDs in the historical sheet.
      matches = rows.flatMap((r, i) => i && permalink(r[4]) === permalink(input[4]) ? [i] : []);
      if (!matches.length) matches = rows.flatMap((r, i) => i && String(r[0]) === key ? [i] : []);
      // One legacy row contains a copied page title instead of its permalink and a wrong ID.
      if (!matches.length) matches = rows.flatMap((r, i) => i && !/^https:\/\/www\.instagram\.com\//.test(String(r[4])) && sameValue(r[5], input[5]) ? [i] : []);
    } else {
      matches = rows.flatMap((r, i) => i && (String(r[0]) === key || `sheet:${r[0]}` === key) ? [i] : []);
    }
    if (matches.length > 1) throw new Error(`Ambiguous sheet key in ${tab}: ${key}`);
    const added = !matches.length;
    const index = matches[0] ?? rows.length;
    if (claimed.has(index)) throw new Error(`Two DB records match ${tab} row ${index + 1}`);
    claimed.add(index);
    const before = rows[index] || [];
    const values = Array.from({ length: width }, (_, col) => hasValue(input[col]) ? input[col] : before[col] ?? null);
    rows[index] = values;
    if (added || values.some((value, col) => !sameValue(value, before[col]))) changed.push({ row: index + 1, values, added });
  }
  return { rows, changed, added: changed.filter(row => row.added).length, updated: changed.filter(row => !row.added).length };
}

export function cellValue(value: SheetCell): sheets_v4.Schema$CellData {
  return value == null || value === '' ? {} : { userEnteredValue: typeof value === 'number' ? { numberValue: value }
    : typeof value === 'boolean' ? { boolValue: value } : { stringValue: value } };
}

export function imageFormula(reference: string, fallback?: string): string {
  // Preserve existing Drive archives; direct saved GCS URLs require no extraction.
  const url = fallback ? `IF(${reference}<>"",${reference},${fallback})` : reference;
  return `=LET(url,${url},IF(url="","",IFERROR("https://drive.google.com/uc?id="&REGEXEXTRACT(url,"drive.google.com/(?:file/)?d/([a-zA-Z0-9_-]+)"),url)))`;
}

export function monthsToPrepare(now: Date): string[] {
  const local = new Date(now.getTime() + 9 * 3600000);
  const current = local.toISOString().slice(0, 7);
  const next = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1, 1));
  return local.getUTCDate() === new Date(next.getTime() - 86400000).getUTCDate()
    ? [current, next.toISOString().slice(0, 7)] : [current];
}

export function blankWhenNoPosts(formula: string) {
  return /^=IFNA\(/i.test(formula) ? formula : `=IFNA(${formula.slice(1)},"")`;
}
