import { BigQuery } from '@google-cloud/bigquery';

export const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || process.env.PROJECT_ID;
const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || process.env.GOOGLE_CREDENTIALS;

let bigqueryClient: BigQuery | null = null;

function parseCredentials(json?: string): Record<string, unknown> | undefined {
  if (!json) return undefined;

  try {
    const parsed = JSON.parse(json);
    return parsed && typeof parsed === 'object' ? parsed : undefined;
  } catch (error) {
    console.error('Failed to parse BigQuery credentials:', error);
    return undefined;
  }
}

export function getBigQueryClient(): BigQuery {
  if (!projectId) {
    throw new Error('PROJECT_ID is not configured.');
  }

  if (!bigqueryClient) {
    bigqueryClient = new BigQuery({
      projectId,
      credentials: parseCredentials(credentialsJson),
    });
  }

  return bigqueryClient;
}

export type GrandprixEvent = {
  eventId: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
};

export const FALLBACK_EVENT: GrandprixEvent = {
  eventId: '2026-summer',
  name: 'Threadsグランプリ 夏',
  startDate: '2026-07-07',
  endDate: '2026-07-31',
  isActive: true,
};

function toDateString(value: unknown): string {
  if (value && typeof value === 'object' && 'value' in value) {
    return String((value as { value: unknown }).value);
  }
  return String(value || '');
}

export async function fetchGrandprixEvents(): Promise<GrandprixEvent[]> {
  try {
    const [rows] = await getBigQueryClient().query({
      query: `
        SELECT event_id, name, start_date, end_date, is_active
        FROM \`${projectId}.analyca.threads_grandprix_events\`
        ORDER BY start_date DESC
      `,
    });

    const events = rows.map((row) => ({
      eventId: String(row.event_id || ''),
      name: String(row.name || ''),
      startDate: toDateString(row.start_date),
      endDate: toDateString(row.end_date),
      isActive: !!row.is_active,
    }));

    return events.length > 0 ? events : [FALLBACK_EVENT];
  } catch (error) {
    console.error('Failed to fetch grandprix events:', error);
    return [FALLBACK_EVENT];
  }
}

export function resolveGrandprixEvent(events: GrandprixEvent[], eventIdInput?: string): GrandprixEvent {
  if (eventIdInput) {
    const matched = events.find((event) => event.eventId === eventIdInput);
    if (matched) return matched;
  }

  return events.find((event) => event.isActive) || events[0] || FALLBACK_EVENT;
}

export function jstDateString(date = new Date()): string {
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return `${jst.getUTCFullYear()}-${String(jst.getUTCMonth() + 1).padStart(2, '0')}-${String(jst.getUTCDate()).padStart(2, '0')}`;
}

export function shiftDate(dateStr: string, deltaDays: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + deltaDays));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}
