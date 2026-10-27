// Google Sheets serial dates are local calendar values (Asia/Tokyo).
export type SheetCell = string | number | boolean | null;
export type SheetRows = SheetCell[][];
export type SheetRecord = Record<string, string | number | null>;
export interface InstagramSheetSource {
  reels: SheetRows; reelManual: SheetRows; stories: SheetRows;
  insights: SheetRows; line: SheetRows; daily: SheetRows;
}

export function sheetNumber(value: SheetCell | undefined): number | null {
  if (value == null || value === '' || typeof value === 'boolean') return null;
  const n = typeof value === 'number' ? value : Number(value.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

export function sheetDate(value: SheetCell | undefined, timestamp = false): string | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number') {
    const local = new Date(Math.round((value - 25569) * 86400000));
    return timestamp ? new Date(local.getTime() - 9 * 3600000).toISOString() : local.toISOString().slice(0, 10);
  }
  const raw = String(value).trim().replace(/\//g, '-');
  if (!/^\d{4}-\d{1,2}-\d{1,2}/.test(raw)) return null;
  const date = new Date(timestamp && !/(Z|[+-]\d\d:\d\d)$/.test(raw) ? raw.replace(' ', 'T') + '+09:00' : raw);
  if (!Number.isFinite(date.getTime())) return null;
  return timestamp ? date.toISOString() : date.toISOString().slice(0, 10);
}

function mediaId(value: SheetCell | undefined): string | null {
  if (typeof value === 'number' && !Number.isSafeInteger(value)) throw new Error('Unsafe numeric Instagram ID');
  const id = String(value ?? '').trim();
  // Explicit archive keys preserve expired stories whose source IDs were rounded.
  return /^(?:sheet:)?\d{10,}$/.test(id) ? id : null;
}

function unique(rows: SheetRecord[], key: string): SheetRecord[] {
  const result = new Map<string, SheetRecord>();
  for (const row of rows) {
    const id = String(row[key]);
    const previous = result.get(id);
    if (previous && JSON.stringify(previous) !== JSON.stringify(row)) throw new Error(`Conflicting sheet rows: ${key}=${id}`);
    result.set(id, row);
  }
  return [...result.values()];
}

export function parseSheetLineData(line: SheetRows, daily: SheetRows): SheetRecord[] {
  const dailyByDate = new Map(daily.slice(5).map(row => [sheetDate(row[0]), row]));
  const fields = ['followers', 'targeted_reaches', 'blocks', 'broadcast', 'targeting', 'auto_response', 'welcome_response', 'chat', 'api_broadcast', 'api_push', 'api_multicast', 'api_narrowcast', 'api_reply'];
  const parsed: Array<SheetRecord & { date: string; account_name: string }> = line.slice(1).flatMap(row => {
    const date = sheetDate(row[0]);
    // A formula's zero is not evidence that the source has arrived.
    if (!date || sheetNumber(row[2]) === null) return [];
    const summary = dailyByDate.get(date);
    return [{ date, account_name: String(row[1] || ''),
      ...Object.fromEntries(fields.map((field, i) => [field, sheetNumber(row[i + 2])])),
      registrations: summary && sheetNumber(summary[13]) !== null ? sheetNumber(summary[14]) : null,
    }];
  });
  const byDate = new Map<string, SheetRecord>();
  for (const row of parsed) {
    const previous = byDate.get(row.date);
    if (previous && (previous.followers !== row.followers || previous.registrations !== row.registrations || previous.account_name !== row.account_name)) {
      throw new Error(`Conflicting LINE counts on ${row.date}`);
    }
    // Repeated exports may add message-delivery counts; registrations are never summed.
    byDate.set(row.date, row);
  }
  return [...byDate.values()];
}

export function parseInstagramSheet(source: InstagramSheetSource) {
  const manual = new Map(source.reelManual.slice(2).flatMap(row => {
    const id = mediaId(row[3]);
    return id ? [[id, row] as const] : [];
  }));
  const reels = unique(source.reels.slice(1).flatMap(row => {
    const id = mediaId(row[0]); const timestamp = sheetDate(row[5], true);
    if (!id || !timestamp) return [];
    const extra = manual.get(id);
    const watchDays = sheetNumber(row[13]);
    return [{ instagram_id: id, timestamp, caption: String(row[1] || ''),
      media_product_type: String(row[2] || ''), media_type: String(row[3] || ''), permalink: String(row[4] || ''),
      ...Object.fromEntries(['views', 'reach', 'total_interactions', 'like_count', 'comments_count', 'saved', 'shares'].map((field, i) => [field, sheetNumber(row[i + 6])])),
      video_view_total_time_hours: watchDays === null ? null : String(watchDays * 24),
      avg_watch_time_seconds: sheetNumber(row[14]), drive_image_url: String(row[15] || ''), thumbnail_url: String(row[16] || ''),
      title: extra?.[4] ? String(extra[4]) : null,
      duration_seconds: sheetNumber(extra?.[6]), follows: sheetNumber(extra?.[18]),
    }];
  }), 'instagram_id');
  const stories = unique(source.stories.slice(1).flatMap(row => {
    const id = mediaId(row[0]); const timestamp = sheetDate(row[3], true);
    if (!id || !timestamp) return [];
    return [{ instagram_id: id, timestamp, drive_image_url: String(row[1] || ''), thumbnail_url: String(row[2] || ''),
      views: sheetNumber(row[4]), reach: sheetNumber(row[5]), replies: sheetNumber(row[6]), caption: String(row[7] || ''),
      total_interactions: sheetNumber(row[8]), follows: sheetNumber(row[9]), profile_visits: sheetNumber(row[10]), navigation: sheetNumber(row[11]),
    }];
  }), 'instagram_id');
  const dailyByDate = new Map(source.daily.slice(5).map(row => [sheetDate(row[0]), row]));
  const insights = unique(source.insights.slice(1).flatMap(row => {
    const date = sheetDate(row[0]);
    if (!date || row.slice(1, 7).every(value => sheetNumber(value) === null)) return [];
    const daily = dailyByDate.get(date);
    return [{ date,
      ...Object.fromEntries(['followers_count', 'posts_count', 'reach', 'engagement', 'profile_views', 'website_clicks'].map((field, i) => [field, sheetNumber(row[i + 1])])),
      sheet_follower_growth: daily && sheetNumber(daily[1]) !== null ? sheetNumber(daily[2]) : null,
      survey_responses: sheetNumber(daily?.[17]),
    }];
  }), 'date');
  const insightDates = new Set(insights.map(row => row.date));
  for (const [date, row] of dailyByDate) {
    if (!date || insightDates.has(date)) continue;
    const values = { followers_count: sheetNumber(row[1]), posts_count: sheetNumber(row[3]),
      reach: sheetNumber(row[6]), engagement: sheetNumber(row[7]), profile_views: sheetNumber(row[9]), website_clicks: sheetNumber(row[11]),
      sheet_follower_growth: null, survey_responses: sheetNumber(row[17]) };
    if (Object.values(values).some(value => value !== null)) insights.push({ date, ...values });
  }
  return { instagram_reels: reels, instagram_stories: stories, instagram_insights: insights, line_daily: parseSheetLineData(source.line, source.daily) };
}
