import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildYokoDailyFlex, dailyReportRetryKey, dailyReportTitle, previousJstDay, shiftReportDay, type YokoDailyReport } from '../yoko-daily-report';

const report: YokoDailyReport = {
  date: '2026-11-04', generatedAt: '2026-11-05T02:00:00Z', followers: 3377, followerGrowth: 3,
  linkClicks: 6, lineRegistrations: 0, lineSnapshotDate: '2026-11-05',
  posts: [{ id: 'one', text: '宝石のお手入れ', url: 'https://www.threads.com/test', views: 1968, likes: 2 },
    { id: 'two', text: 'ダイヤとスワロ', url: '', views: 91, likes: 1 }],
};

test('日本時間の昨日を、月・年・うるう年の境界でも正しく選ぶ', () => {
  assert.equal(previousJstDay(new Date('2026-11-04T14:59:59Z')), '2026-11-03');
  assert.equal(previousJstDay(new Date('2026-11-04T15:00:00Z')), '2026-11-04');
  assert.equal(previousJstDay(new Date('2026-11-05T02:00:00Z')), '2026-11-04');
  assert.equal(previousJstDay(new Date('2026-01-01T02:00:00Z')), '2025-12-31');
  assert.equal(shiftReportDay('2024-03-01', -1), '2024-02-29');
  assert.throws(() => shiftReportDay('2026-02-30', 0));
  assert.equal(dailyReportTitle('2026-11-04'), '11月4日（水）運用結果');
});

test('通知のタイトル・指標順・分析リンクが指定どおりで、0と未取得を区別する', () => {
  const message = buildYokoDailyFlex(report);
  assert.equal(message.altText, '11月4日（水）運用結果');
  const json = JSON.stringify(message);
  const labels = ['フォロワー数', 'フォロワー増加数', 'リンククリック', 'LINE登録（Threads経由）', '昨日の投稿数'];
  assert.deepEqual(labels.map(label => json.indexOf(label)), labels.map(label => json.indexOf(label)).sort((a, b) => a - b));
  assert.match(json, /2,059回/);
  assert.match(json, /昨日公開した投稿の集計時点の累計/);
  assert.match(json, /Threadsの分析を見る/);
  assert.match(json, /threadsTab=analysis/);
  assert.doesNotMatch(json, /threadsTab=report/);
  assert.match(json, /0人/);
  const missing = JSON.stringify(buildYokoDailyFlex({ ...report, followers: null, followerGrowth: null, lineRegistrations: null }));
  assert.match(missing, /未取得/);
  assert.match(missing, /データ取得待ち/);
  assert.equal(buildYokoDailyFlex(report, true).altText, '【テスト】11月4日（水）運用結果');
});

test('日付・宛先・テストを分離した固定の再送キーを生成する', () => {
  const id = dailyReportRetryKey('group', '2026-11-04', 'daily');
  assert.match(id, /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-a[a-f0-9]{3}-[a-f0-9]{12}$/);
  assert.equal(id, dailyReportRetryKey('group', '2026-11-04', 'daily'));
  assert.notEqual(id, dailyReportRetryKey('group', '2026-11-04', 'test'));
  assert.notEqual(id, dailyReportRetryKey('other', '2026-11-04', 'daily'));
  assert.notEqual(id, dailyReportRetryKey('group', '2026-11-05', 'daily'));
});
