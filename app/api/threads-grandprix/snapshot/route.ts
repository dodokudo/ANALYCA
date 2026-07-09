import { NextRequest, NextResponse } from 'next/server';
import {
  fetchGrandprixEvents,
  getBigQueryClient,
  jstDateString,
  projectId,
  shiftDate,
} from '@/app/threads-grandprix/grandprix-bigquery';

export const maxDuration = 60;

// 深夜0時台のcron実行では「前日」を、日中の手動実行では「当日」をスナップショット日とする
function resolveSnapshotDate(explicitDate: string | null): string {
  if (explicitDate && /^\d{4}-\d{2}-\d{2}$/.test(explicitDate)) {
    return explicitDate;
  }

  const jstHour = (new Date().getUTCHours() + 9) % 24;
  const today = jstDateString();
  return jstHour < 6 ? shiftDate(today, -1) : today;
}

async function executeDML(query: string, params?: Record<string, unknown>): Promise<void> {
  const [job] = await getBigQueryClient().createQueryJob({ query, params });
  await job.getQueryResults();
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const snapshotDate = resolveSnapshotDate(request.nextUrl.searchParams.get('date'));
    const events = await fetchGrandprixEvents();
    const targetEvents = events.filter(
      (event) => event.isActive && event.startDate <= snapshotDate && snapshotDate <= shiftDate(event.endDate, 1),
    );

    const results: Array<{ eventId: string; snapshotDate: string }> = [];

    for (const event of targetEvents) {
      await executeDML(
        `
          DELETE FROM \`${projectId}.analyca.threads_grandprix_post_snapshots\`
          WHERE event_id = @eventId AND snapshot_date = DATE(@snapshotDate)
        `,
        { eventId: event.eventId, snapshotDate },
      );

      await executeDML(
        `
          INSERT INTO \`${projectId}.analyca.threads_grandprix_post_snapshots\`
            (snapshot_date, event_id, user_id, threads_id, permalink, text, post_timestamp, views, likes, replies, captured_at)
          SELECT
            DATE(@snapshotDate),
            @eventId,
            tp.user_id,
            tp.threads_id,
            tp.permalink,
            SUBSTR(tp.text, 0, 300),
            tp.timestamp,
            COALESCE(tp.views, 0),
            COALESCE(tp.likes, 0),
            COALESCE(tp.replies, 0),
            CURRENT_TIMESTAMP()
          FROM \`${projectId}.analyca.threads_posts\` tp
          JOIN (
            SELECT DISTINCT u.user_id
            FROM \`${projectId}.analyca.threads_grandprix_entries\` e
            JOIN \`${projectId}.analyca.users\` u
              ON LOWER(REGEXP_REPLACE(TRIM(u.threads_username), r'^@', '')) = e.normalized_threads_username
            WHERE e.event_id = @eventId
          ) p ON p.user_id = tp.user_id
          WHERE tp.threads_id IS NOT NULL
            AND DATE(tp.timestamp, 'Asia/Tokyo') BETWEEN DATE(@startDate) AND DATE(@endDate)
        `,
        {
          eventId: event.eventId,
          snapshotDate,
          startDate: event.startDate,
          endDate: event.endDate,
        },
      );

      results.push({ eventId: event.eventId, snapshotDate });
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error('Threads Grandprix snapshot error:', error);
    return NextResponse.json({ success: false, error: 'Snapshot failed' }, { status: 500 });
  }
}
