import { createHash } from 'node:crypto';
import { toJstDate } from './threads-monthly-report';

export const YOKO_DAILY_USER_ID = '33833959932919231';
export const YOKO_REPORT_TEST_GROUP = { id: 'C92c10dcb636d0457c0de45236b4b3e26', name: 'テスト用' } as const;
export interface DailyReportPost {
  id: string;
  text: string;
  url: string;
  views: number;
  likes: number;
}
export interface YokoDailyReport {
  date: string;
  generatedAt: string;
  followers: number | null;
  followerGrowth: number | null;
  linkClicks: number;
  lineRegistrations: number | null;
  lineSnapshotDate: string | null;
  posts: DailyReportPost[];
}

export function previousJstDay(now: Date = new Date()): string {
  const today = toJstDate(now);
  return new Date(new Date(`${today}T00:00:00Z`).getTime() - 86400000).toISOString().slice(0, 10);
}
export function shiftReportDay(date: string, days: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) throw new Error('対象日が無効です');
  return new Date(new Date(`${date}T00:00:00Z`).getTime() + days * 86400000).toISOString().slice(0, 10);
}

export function dailyReportRetryKey(groupId: string, date: string, mode: 'daily' | 'test'): string {
  const hex = createHash('sha256').update(`yoko-daily-v1:${mode}:${groupId}:${date}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export function dailyReportTitle(date: string): string {
  shiftReportDay(date, 0);
  const weekday = new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', weekday: 'short' }).format(new Date(`${date}T12:00:00+09:00`));
  return `${Number(date.slice(5, 7))}月${Number(date.slice(8, 10))}日（${weekday}）運用結果`;
}

function number(value: number | null, unit: string, signed = false): string {
  if (value === null) return '未取得';
  return `${signed && value > 0 ? '+' : ''}${value.toLocaleString('ja-JP')}${unit}`;
}
function row(label: string, value: string) {
  return { type: 'box', layout: 'horizontal', spacing: 'sm', contents: [
    { type: 'text', text: label, size: 'sm', color: '#667085', flex: 5, wrap: true },
    { type: 'text', text: value, size: 'sm', color: '#101828', weight: 'bold', align: 'end', flex: 4, wrap: true },
  ] };
}

/** Views/likes describe yesterday's posts at collection time, not account-wide daily impressions. */
export function buildYokoDailyFlex(report: YokoDailyReport, test = false): Record<string, unknown> {
  const title = dailyReportTitle(report.date);
  const count = report.posts.length;
  const views = report.posts.reduce((sum, post) => sum + post.views, 0);
  const likes = report.posts.reduce((sum, post) => sum + post.likes, 0);
  const metrics = [
    row('フォロワー数', number(report.followers, '人')),
    row('フォロワー増加数', number(report.followerGrowth, '人', true)),
    row('リンククリック', number(report.linkClicks, '回')),
    row('LINE登録（Threads経由）', number(report.lineRegistrations, '人')),
    { type: 'separator', margin: 'md' },
    row('昨日の投稿数', number(count, '本')),
    row('対象投稿の閲覧数', number(views, '回')),
    row('対象投稿のいいね', number(likes, '件')),
  ];
  const content: Record<string, unknown>[] = [
    { type: 'text', text: title, size: 'xl', weight: 'bold', color: '#101828', wrap: true },
    { type: 'box', layout: 'vertical', spacing: 'md', margin: 'xl', contents: metrics },
    { type: 'text', text: '閲覧数・いいねは、昨日公開した投稿の集計時点の累計です。', size: 'xs', color: '#667085', wrap: true, margin: 'lg' },
  ];
  if (report.lineRegistrations === null) content.push({ type: 'text', text: 'LINE登録は昨日分のデータ取得待ちです。', size: 'xs', color: '#B54708', wrap: true, margin: 'sm' });
  if (count) {
    content.push({ type: 'separator', margin: 'lg' }, { type: 'text', text: '昨日の投稿', weight: 'bold', size: 'sm', margin: 'lg' });
    for (const post of [...report.posts].sort((a, b) => b.views - a.views).slice(0, 3)) {
      const text = [...post.text.replace(/\s+/g, ' ')].slice(0, 80).join('');
      const item: Record<string, unknown> = { type: 'box', layout: 'vertical', margin: 'md', spacing: 'xs', contents: [
        { type: 'text', text: text || '本文なし', size: 'sm', wrap: true, color: '#344054' },
        { type: 'text', text: `${number(post.views, '閲覧')} · ${number(post.likes, 'いいね')}`, size: 'xs', color: '#667085' },
      ] };
      if (/^https:\/\//.test(post.url)) item.action = { type: 'uri', label: '投稿を見る', uri: post.url };
      content.push(item);
    }
    if (count > 3) content.push({ type: 'text', text: `ほか${count - 3}本は分析タブで確認できます。`, size: 'xs', color: '#667085', wrap: true, margin: 'sm' });
  }
  return {
    type: 'flex', altText: `${test ? '【テスト】' : ''}${title}`,
    contents: {
      type: 'bubble', size: 'mega',
      header: { type: 'box', layout: 'vertical', backgroundColor: '#6D28D9', paddingAll: '16px', contents: [
        { type: 'text', text: `${test ? '【テスト】' : ''}YOKOさん｜Threads日次レポート`, color: '#FFFFFF', size: 'sm', weight: 'bold', wrap: true },
      ] },
      body: { type: 'box', layout: 'vertical', paddingAll: '20px', contents: content },
      footer: { type: 'box', layout: 'vertical', paddingAll: '16px', contents: [
        { type: 'button', style: 'primary', color: '#6D28D9', height: 'sm', action: { type: 'uri', label: 'Threadsの分析を見る', uri: `https://analyca.jp/${YOKO_DAILY_USER_ID}?tab=threads&threadsTab=analysis` } },
      ] },
    },
  };
}
