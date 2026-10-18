export type GrandprixEvent = {
  eventId: string;
  name: string;
  edition: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
};

export const GRANDPRIX_EVENTS: GrandprixEvent[] = [
  {
    eventId: '2026-autumn',
    name: 'Threadsグランプリ 秋',
    edition: 2,
    startDate: '2026-10-20',
    endDate: '2026-11-19',
    isActive: true,
  },
  {
    eventId: '2026-summer',
    name: 'Threadsグランプリ 夏',
    edition: 1,
    startDate: '2026-07-07',
    endDate: '2026-07-31',
    isActive: false,
  },
];

export const DEFAULT_GRANDPRIX_EVENT_ID = '2026-autumn';
// 秋の公開ページをリリースするときに追加する。管理画面は先行公開。
export const PUBLISHED_GRANDPRIX_RANKING_IDS: readonly string[] = ['2026-summer'];
export const GRANDPRIX_LINE_GROUP_URL = 'https://line.me/ti/g/8ErMS2M2vU';

export function isGrandprixEntryOpen(event: GrandprixEvent, now = new Date()): boolean {
  // 募集は開催前から受け付け、開催最終日の日本時間23:59:59まで。
  return event.isActive && now.getTime() < new Date(`${event.endDate}T00:00:00+09:00`).getTime() + 86_400_000;
}

export function grandprixRankingUrl(eventId: string): string {
  return `/threads-grandprix/ranking?event=${encodeURIComponent(eventId)}`;
}
