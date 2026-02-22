'use client';

import { StatPill } from '@/components/StatPill';
import ProfileHeader from '@/components/ProfileHeader';
import LoadingScreen from '@/components/LoadingScreen';
import { useDateRange, DatePreset } from '@/lib/dateRangeStore';
import GemQueenThreadsContent from './threads-content';

import { useState, useEffect } from 'react';
import {
  ComposedChart,
  ReferenceLine,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

interface ApiMeta {
  requestedSource: 'gem-queen' | 'bigquery';
  source: 'gem-queen' | 'bigquery';
  manualColumns?: {
    reel: {
      title: number;
      duration: number;
      follows: number;
      followRate?: number;
    };
  };
  fallbackReason?: string;
}

interface ApiResponse {
  meta?: ApiMeta;
  instagramRaw: string[][];
  storiesRaw: string[][];
  storiesProcessed: string[][];
  reelRawDataRaw: string[][];
  reelSheetRaw: string[][];
  dailyRaw: string[][];
  dataInfo: {
    instagramRows: number;
    storiesRows: number;
    storiesProcessedRows: number;
    reelRawDataRows: number;
    reelSheetRows: number;
    dailyRows: number;
  };
  error?: string;
}

// URL変換関数を追加
const convertToGoogleUserContent = (url: string) => {
  if (!url) return '';
  console.log('Original URL:', url);
  const driveIdMatch = url.match(/(?:\/d\/|id=)([a-zA-Z0-9_-]+)/);
  if (driveIdMatch && driveIdMatch[1]) {
    const convertedUrl = `https://lh3.googleusercontent.com/d/${driveIdMatch[1]}`;
    console.log('Converted URL:', convertedUrl);
    return convertedUrl;
  }
  console.log('No match found, returning original URL');
  return url;
};

const formatDateForInput = (date?: Date | null): string => {
  if (!date || Number.isNaN(date.getTime())) {
    return '';
  }

  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000);
  return local.toISOString().split('T')[0];
};

const parseDurationValueToSeconds = (value: unknown): number => {
  if (value === null || value === undefined) {
    return 0;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.round(value));
  }

  const str = String(value).trim();
  if (!str) {
    return 0;
  }

  if (/^\d{1,2}:\d{2}:\d{2}$/.test(str)) {
    const [hours, minutes, seconds] = str.split(':').map(Number);
    return hours * 3600 + minutes * 60 + seconds;
  }

  const numeric = Number(str.replace(/,/g, ''));
  if (Number.isFinite(numeric)) {
    return Math.max(0, Math.round(numeric));
  }

  return 0;
};

const formatSecondsToHms = (totalSeconds: number): string => {
  if (!totalSeconds || !Number.isFinite(totalSeconds)) {
    return '';
  }

  const seconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainSeconds = seconds % 60;

  return `${hours}:${minutes.toString().padStart(2, '0')}:${remainSeconds
    .toString()
    .padStart(2, '0')}`;
};

// リールデータ結合関数
const joinReelData = (reelRawDataRaw: string[][], reelSheetRaw: string[][]) => {
  console.log(`=== リールデータ結合開始 ===`);
  console.log(`RawData行数: ${reelRawDataRaw?.length || 0}, SheetData行数: ${reelSheetRaw?.length || 0}`);

  if (!reelRawDataRaw || !reelSheetRaw || reelRawDataRaw.length <= 1 || reelSheetRaw.length <= 1) {
    console.log(`データ不足 - 空配列を返却`);
    return [];
  }

  const joinedData = [];
  let matchCount = 0;
  let noMatchCount = 0;

  // ヘッダー行をスキップしてデータ行のみ処理
  for (let i = 1; i < reelRawDataRaw.length; i++) {
    const rawDataRow = reelRawDataRaw[i];
    const reelId = rawDataRow[0]; // A列（index 0）がリールID

    // リールシートで対応するIDを検索（D列=index 3）
    const matchingSheetRow = reelSheetRaw.find((sheetRow, index) => {
      if (index === 0) return false; // ヘッダー行をスキップ
      return sheetRow[3] === reelId; // D列（index 3）でマッチング
    });

    if (matchingSheetRow) {
      // 結合されたデータを作成
      joinedData.push({
        rawData: rawDataRow,
        sheetData: matchingSheetRow
      });
      matchCount++;
    } else {
      noMatchCount++;
      if (noMatchCount <= 5) { // 最初の5件のみログ出力
        console.log(`マッチしないリールID: "${reelId}"`);
      }
    }
  }

  console.log(`結合結果: マッチ=${matchCount}件, 不一致=${noMatchCount}件, 合計結合データ=${joinedData.length}件`);
  return joinedData;
};

// 結合されたリールデータ用のフィルタリング関数
const filterJoinedReelData = (joinedData: { rawData: string[], sheetData: string[] }[], dateRange: { start: Date; end: Date; preset: string }) => {
  console.log(`=== リールフィルタリング開始 ===`);
  console.log(`入力データ数: ${joinedData?.length || 0}`);
  console.log(`フィルター範囲: ${dateRange?.start} - ${dateRange?.end}`);

  if (!joinedData || joinedData.length === 0) {
    console.log(`データなし - 空配列を返却`);
    return [];
  }

  if (dateRange.preset === 'all') {
    console.log(`全期間選択 - 全データを返却: ${joinedData.length}件`);
    return joinedData;
  }

  const parseDate = (dateStr: string) => {
    if (!dateStr) return null;
    try {
      const str = String(dateStr).trim();

      // 複数の日付フォーマットに対応

      // 1. ISO形式: "2025-09-15" または "2025-09-15 19:18:21"
      const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:\s+\d{1,2}:\d{1,2}:\d{1,2})?$/);
      if (isoMatch) {
        return new Date(str + (str.includes(' ') ? '' : 'T00:00:00'));
      }

      // 2. スラッシュ形式: "2025/09/15 15:04:46"
      const slashMatch = str.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})(?:\s+\d{1,2}:\d{1,2}:\d{1,2})?/);
      if (slashMatch) {
        const [, year, month, day] = slashMatch;
        const timepart = str.includes(' ') ? str.split(' ')[1] : '00:00:00';
        return new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${timepart}`);
      }

      // 3. 日本語曜日付き: "2025/5/1/(木)"
      const japaneseMatch = str.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})\/?\([日月火水木金土]\)$/);
      if (japaneseMatch) {
        const [, year, month, day] = japaneseMatch;
        return new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00`);
      }

      // 4. その他のフォーマットは通常の Date コンストラクタで試行
      return new Date(str);
    } catch (error) {
      console.error('日付解析エラー:', error, 'for date:', dateStr);
      return null;
    }
  };

  try {
    const normalizeStart = (input: Date) => {
      const d = new Date(input);
      d.setHours(0, 0, 0, 0);
      return d;
    };

    const normalizeEnd = (input: Date) => {
      const d = new Date(input);
      d.setHours(23, 59, 59, 999);
      return d;
    };

    let startDate = normalizeStart(dateRange.start);
    let endDate = normalizeEnd(dateRange.end);

    if (startDate > endDate) {
      const tmp = startDate;
      startDate = endDate;
      endDate = tmp;
    }

    let filteredData = joinedData.filter(item => {
      const dateStr = String(item.rawData[5]).trim(); // 投稿日時は列5
      const date = parseDate(dateStr);
      return date && !isNaN(date.getTime()) && date >= startDate && date <= endDate;
    });

    if (filteredData.length === 0) {
      const fallbackEnd = new Date(endDate);
      const fallbackStart = new Date(fallbackEnd);
      fallbackStart.setDate(fallbackStart.getDate() - 6);

      filteredData = joinedData.filter(item => {
        const dateStr = String(item.rawData[5]).trim();
        const date = parseDate(dateStr);
        return date && !isNaN(date.getTime()) && date >= fallbackStart && date <= fallbackEnd;
      });

      if (filteredData.length === 0) {
        const latest = joinedData
          .filter(item => {
            const dateStr = String(item.rawData[5]).trim();
            const date = parseDate(dateStr);
            return date && !isNaN(date.getTime()) && date <= fallbackEnd;
          })
          .sort((a, b) => {
            const dateA = parseDate(String(a.rawData[5]).trim());
            const dateB = parseDate(String(b.rawData[5]).trim());
            if (!dateA || !dateB) return 0;
            return dateA.getTime() - dateB.getTime();
          });
        filteredData = latest.length > 0 ? [latest[latest.length - 1]] : [];
      }
    }

    console.log(`リールフィルタリング結果: ${filteredData.length}件 (${dateRange.preset})`);
    console.log(`期間: ${startDate?.toISOString().split('T')[0]} 〜 ${endDate?.toISOString().split('T')[0]}`);
    return filteredData;
  } catch (error) {
    console.error('リールフィルタリングエラー:', error);
    return joinedData;
  }
};

// Google Drive URL to lh3.googleusercontent.com conversion
function toLh3(url: string): string {
  if (!url) return "";
  // case1: /file/d/<id>/view
  let m = url.match(/\/file\/d\/([^/]+)\//);
  if (m?.[1]) return `https://lh3.googleusercontent.com/d/${m[1]}`;
  // case2: open?id=<id>
  m = url.match(/[?&]id=([^&]+)/);
  if (m?.[1]) return `https://lh3.googleusercontent.com/d/${m[1]}`;
  // 既にlh3ならそのまま
  if (url.includes("lh3.googleusercontent.com")) return url;
  return ""; // 無効URLは空で返す（後続でフォールバック表示）
}

export default function Dashboard() {
  const [data, setData] = useState<ApiResponse>({
    instagramRaw: [],
    storiesRaw: [],
    storiesProcessed: [],
    reelRawDataRaw: [],
    reelSheetRaw: [],
    dailyRaw: [],
    dataInfo: {
      instagramRows: 0,
      storiesRows: 0,
      storiesProcessedRows: 0,
      reelRawDataRows: 0,
      reelSheetRows: 0,
      dailyRows: 0
    }
  });
  // グローバルストアからdateRangeを取得
  const { dateRange, updatePreset } = useDateRange();
  const userId = 'demo-user'; // Demo用のユーザーID

  const [activeTab, setActiveTab] = useState('dashboard');
  const [activeChannel, setActiveChannel] = useState<'instagram' | 'threads'>('instagram');
  const [threadsData, setThreadsData] = useState<any>(null);
  const [threadsUser, setThreadsUser] = useState<any>(null);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [threadsDatePreset, setThreadsDatePreset] = useState<'3d' | '7d' | 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth'>('7d');
  const [customStartDate, setCustomStartDate] = useState(() => formatDateForInput(dateRange.start));
  const [customEndDate, setCustomEndDate] = useState(() => formatDateForInput(dateRange.end));
  const [showCustomDateModal, setShowCustomDateModal] = useState(false);
  const [showDailyTable, setShowDailyTable] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reelSortBy, setReelSortBy] = useState('date');
  const [reelSortOrder, setReelSortOrder] = useState('desc');
  const [storySortBy, setStorySortBy] = useState('date');
  const [storySortOrder, setStorySortOrder] = useState('desc');

  const parseDate = (dateStr: string) => {
    if (!dateStr || typeof dateStr !== 'string') {
      return null;
    }

    try {
      const str = dateStr.trim();
      
      // ISO形式: "2025-06-20"
      const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
      if (isoMatch) {
        const [, year, month, day] = isoMatch;
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      }

      // ISO日時形式: "2025-09-14 12:02:33"
      const isoDateTimeMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})\s+\d{1,2}:\d{1,2}:\d{1,2}$/);
      if (isoDateTimeMatch) {
        const [, year, month, day] = isoDateTimeMatch;
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      }

      // スラッシュ区切り日時: "2025/09/13 9:57:01"
      const slashDateTimeMatch = str.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})\s+\d{1,2}:\d{1,2}:\d{1,2}$/);
      if (slashDateTimeMatch) {
        const [, year, month, day] = slashDateTimeMatch;
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      }

      // スラッシュ区切り日付のみ: "2025/09/13"
      const slashDateMatch = str.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
      if (slashDateMatch) {
        const [, year, month, day] = slashDateMatch;
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      }

      // 日本語曜日付きスラッシュ区切り: "2025/6/18/(水)"
      const japaneseSlashDateMatch = str.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})\/\([日月火水木金土]\)$/);
      if (japaneseSlashDateMatch) {
        const [, year, month, day] = japaneseSlashDateMatch;
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      }

      return null;
    } catch (error) {
      console.error('parseDate エラー:', error, '元値:', dateStr);
      return null;
    }
  };

  // デイリーデータ専用のフィルタリング関数
  const getFilteredDailyData = (data: string[][], preset: string) => {
    if (!data || data.length <= 5) {
      return { headers: [], data: [] };
    }

    try {
      // 5行目（index 4）がヘッダー、A〜V列（1〜22列）取得
      const fullHeaders = data[4] || [];
      const headers = fullHeaders.slice(0, 22); // A〜V列（22列）

      console.log(`=== ヘッダー情報 ===`);
      console.log(`全ヘッダー数: ${fullHeaders.length}`);
      console.log(`表示ヘッダー (A-V列, 1-22):`, headers);

      // 6行目以降（index 5〜）がデータ、A〜V列（1〜22列）取得
      const allDataRows = data.slice(5);
      const dataRows = allDataRows.map(row => row.slice(0, 22)); // A〜V列（22列）

      console.log(`デイリーデータ読み込み: 全データ行数=${dataRows.length}`);

      if (preset === 'all') {
        // まず有効な日付を持つ行のみフィルタリング
        const validDataRows = dataRows.filter(row => {
          const dateStr = String(row[0] || '').trim();
          const date = parseDate(dateStr);
          return date && !isNaN(date.getTime());
        });

        // 日付昇順でソート（古い日付→新しい日付）
        const sortedData = validDataRows.sort((a, b) => {
          const dateA = parseDate(String(a[0] || '').trim());
          const dateB = parseDate(String(b[0] || '').trim());
          if (!dateA || !dateB) return 0;
          return dateA.getTime() - dateB.getTime(); // 昇順
        });
        console.log(`全期間ソート結果: ${sortedData.length}件`);
        return { headers, data: sortedData };
      }

      // 動的に今日の日付を取得（JST基準で設定）
      const today = new Date();
      // 日本時間での今日の日付を基準に設定
      let jstToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

      // 期間の設定
      let cutoffDate;
      let daysBack = 0;

      if (preset === 'current_month') {
        // 当月: 今月の1日から今日まで
        cutoffDate = new Date(jstToday.getFullYear(), jstToday.getMonth(), 1, 0, 0, 0, 0);
        const todayDate = new Date(jstToday.getFullYear(), jstToday.getMonth(), jstToday.getDate());
        daysBack = Math.ceil((todayDate.getTime() - cutoffDate.getTime()) / (1000 * 60 * 60 * 24));
      } else if (preset === 'custom' && customStartDate && customEndDate) {
        // カスタム期間: 指定された開始日から終了日まで
        const startDate = new Date(customStartDate);
        const endDate = new Date(customEndDate);

        if (startDate <= endDate) {
          cutoffDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 0, 0, 0, 0);
          jstToday = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59, 999);
          daysBack = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        } else {
          // 無効な日付範囲の場合はデフォルト（1ヶ月）に戻す
          daysBack = 29;
          cutoffDate = new Date(jstToday.getFullYear(), jstToday.getMonth(), jstToday.getDate() - daysBack, 0, 0, 0, 0);
        }
      } else {
        switch (preset) {
          case 'yesterday':
            cutoffDate = new Date(jstToday.getFullYear(), jstToday.getMonth(), jstToday.getDate() - 1, 0, 0, 0, 0);
            jstToday = new Date(cutoffDate.getFullYear(), cutoffDate.getMonth(), cutoffDate.getDate(), 23, 59, 59, 999);
            break;
          case 'this-week':
            // 今週（月曜日から日曜日）
            const todayDayOfWeek = jstToday.getDay(); // 0:日曜, 1:月曜, ..., 6:土曜
            const mondayOffset = todayDayOfWeek === 0 ? 6 : todayDayOfWeek - 1; // 月曜日までの日数
            const thisWeekMonday = new Date(jstToday.getFullYear(), jstToday.getMonth(), jstToday.getDate() - mondayOffset, 0, 0, 0, 0);
            cutoffDate = thisWeekMonday;
            break;
          case 'last-week':
            // 先週（先週月曜日から先週日曜日）
            const todayDayOfWeekLast = jstToday.getDay(); // 0:日曜, 1:月曜, ..., 6:土曜
            const lastMondayOffset = todayDayOfWeekLast === 0 ? 13 : todayDayOfWeekLast + 6; // 先週月曜日までの日数
            const lastWeekMonday = new Date(jstToday.getFullYear(), jstToday.getMonth(), jstToday.getDate() - lastMondayOffset, 0, 0, 0, 0);
            const lastWeekSunday = new Date(lastWeekMonday.getFullYear(), lastWeekMonday.getMonth(), lastWeekMonday.getDate() + 6, 23, 59, 59, 999);
            cutoffDate = lastWeekMonday;
            jstToday = lastWeekSunday;
            break;
          case 'this-month':
            // 今月（今月1日から今日まで）
            cutoffDate = new Date(jstToday.getFullYear(), jstToday.getMonth(), 1, 0, 0, 0, 0);
            break;
          case 'last-month':
            // 先月（先月1日から先月末日まで）
            const lastMonthStart = new Date(jstToday.getFullYear(), jstToday.getMonth() - 1, 1, 0, 0, 0, 0);
            const lastMonthEnd = new Date(jstToday.getFullYear(), jstToday.getMonth(), 0, 23, 59, 59, 999); // 先月の最終日
            cutoffDate = lastMonthStart;
            jstToday = lastMonthEnd;
            break;
          case '1week':
            daysBack = 6; // 今日を含めて7日間
            cutoffDate = new Date(jstToday.getFullYear(), jstToday.getMonth(), jstToday.getDate() - daysBack, 0, 0, 0, 0);
            break;
          case '1month':
            daysBack = 29; // 今日を含めて30日間
            cutoffDate = new Date(jstToday.getFullYear(), jstToday.getMonth(), jstToday.getDate() - daysBack, 0, 0, 0, 0);
            break;
          case '3months':
            daysBack = 89; // 今日を含めて90日間
            cutoffDate = new Date(jstToday.getFullYear(), jstToday.getMonth(), jstToday.getDate() - daysBack, 0, 0, 0, 0);
            break;
          case '1year':
            daysBack = 364; // 今日を含めて365日間
            cutoffDate = new Date(jstToday.getFullYear(), jstToday.getMonth(), jstToday.getDate() - daysBack, 0, 0, 0, 0);
            break;
          default:
            daysBack = 6; // デフォルト：1週間
            cutoffDate = new Date(jstToday.getFullYear(), jstToday.getMonth(), jstToday.getDate() - daysBack, 0, 0, 0, 0);
        }
      }

      console.log(`=== デイリーデータフィルタリング ===`);
      console.log(`期間: ${preset} (${daysBack + 1}日間)`);
      console.log(`今日: ${jstToday.toISOString().split('T')[0]}`);
      console.log(`カットオフ: ${cutoffDate.toISOString().split('T')[0]}`);

      // まず実際のデータでどんな日付があるか確認
      console.log(`=== 利用可能な日付データ（最初の10件） ===`);
      const validDates: { original: string; parsed: Date; formatted: string; }[] = [];
      dataRows.slice(0, 10).forEach((row, index) => {
        if (row[0]) {
          const dateStr = String(row[0]).trim();
          const date = parseDate(dateStr);
          console.log(`[${index}]: "${dateStr}" → ${date ? date.toISOString().split('T')[0] : 'FAILED'}`);
          if (date && !isNaN(date.getTime())) {
            validDates.push({
              original: dateStr,
              parsed: date,
              formatted: date.toISOString().split('T')[0]
            });
          }
        }
      });

      console.log(`=== 日付範囲比較 ===`);
      console.log(`今日: ${jstToday.toISOString().split('T')[0]}`);
      console.log(`カットオフ: ${cutoffDate.toISOString().split('T')[0]}`);

      if (validDates.length > 0) {
        console.log(`最新データ日付: ${validDates[0].formatted}`);
        console.log(`最古データ日付: ${validDates[validDates.length - 1].formatted}`);
      }

      // 日付でフィルタリング
      let matchCount = 0;
      const filteredData = dataRows.filter((row, index) => {
        if (!row || !row[0]) {
          return false;
        }

        const dateStr = String(row[0]).trim();
        const date = parseDate(dateStr);

        if (!date || isNaN(date.getTime())) {
          if (index < 5) console.log(`✗ 日付解析失敗[${index}]: "${dateStr}"`);
          return false;
        }

        // 日付比較（時刻を無視して日付のみで比較）
        const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const todayOnly = new Date(jstToday.getFullYear(), jstToday.getMonth(), jstToday.getDate());
        const cutoffOnly = new Date(cutoffDate.getFullYear(), cutoffDate.getMonth(), cutoffDate.getDate());

        const isAfterCutoff = dateOnly >= cutoffOnly;
        const isBeforeToday = dateOnly <= todayOnly;
        const inRange = isAfterCutoff && isBeforeToday;

        if (index < 5 || inRange) {
          console.log(`${inRange ? '✓' : '✗'} [${index}]: ${dateStr} (${dateOnly.toISOString().split('T')[0]})`);
          console.log(`  カットオフ後: ${isAfterCutoff}, 今日以前: ${isBeforeToday}, 範囲内: ${inRange}`);
        }

        if (inRange) matchCount++;
        return inRange;
      });

      console.log(`=== フィルタリング結果 ===`);
      console.log(`全データ数: ${dataRows.length}`);
      console.log(`該当データ数: ${matchCount}`);
      console.log(`フィルタ後データ数: ${filteredData.length}`);

      // 日付昇順でソート（古い日付→新しい日付）
      const sortedData = filteredData.sort((a, b) => {
        const dateA = parseDate(String(a[0] || '').trim());
        const dateB = parseDate(String(b[0] || '').trim());
        if (!dateA || !dateB) return 0;
        return dateA.getTime() - dateB.getTime(); // 昇順
      });

      console.log(`フィルタリング結果: ${sortedData.length}件`);
      return { headers, data: sortedData };

    } catch (error) {
      console.error('デイリーデータフィルタリングエラー:', error);
      return { headers: [], data: [] };
    }
  };

  const getFilteredData = (data: string[][], dateColumnIndex = 0, dateRange = {preset: 'this-week', start: new Date(), end: new Date()}, options: { allowFallback?: boolean } = {}) => {
  const { allowFallback = true } = options;
    try {
      if (!data || data.length <= 1 || dateRange.preset === 'all') {
        return data || [];
      }

      const normalizeStart = (input: Date) => {
        const d = new Date(input);
        d.setHours(0, 0, 0, 0);
        return d;
      };
      const normalizeEnd = (input: Date) => {
        const d = new Date(input);
        d.setHours(23, 59, 59, 999);
        return d;
      };

      let startDate = normalizeStart(dateRange.start);
      let endDate = normalizeEnd(dateRange.end);

      if (startDate > endDate) {
        const tmp = startDate;
        startDate = endDate;
        endDate = tmp;
      }

      const headerRows = data.slice(0, 1);
      const dataRows = data.slice(1);

      const filteredRows = dataRows.filter(row => {
        if (!row || !row[dateColumnIndex]) return false;
        const dateStr = String(row[dateColumnIndex]).trim();
        if (!dateStr) return false;
        const date = parseDate(dateStr);
        return date && !isNaN(date.getTime()) && date >= startDate && date <= endDate;
      });

      const sortedRows = filteredRows.sort((a, b) => {
        const dateA = parseDate(String(a[dateColumnIndex] || '').trim());
        const dateB = parseDate(String(b[dateColumnIndex] || '').trim());
        if (!dateA || !dateB) return 0;
        return dateA.getTime() - dateB.getTime();
      });

      let rowsToReturn = sortedRows;
      if (allowFallback && rowsToReturn.length === 0) {
        const fallbackEnd = new Date();
        const fallbackStart = new Date(fallbackEnd);
        fallbackStart.setDate(fallbackStart.getDate() - 6);

        const fallbackRows = dataRows
          .filter(row => {
            if (!row || !row[dateColumnIndex]) return false;
            const parsed = parseDate(String(row[dateColumnIndex]).trim());
            return parsed && !isNaN(parsed.getTime()) && parsed >= fallbackStart && parsed <= fallbackEnd;
          })
          .sort((a, b) => {
            const dateA = parseDate(String(a[dateColumnIndex] || '').trim());
            const dateB = parseDate(String(b[dateColumnIndex] || '').trim());
            if (!dateA || !dateB) return 0;
            return dateA.getTime() - dateB.getTime();
          });

        if (fallbackRows.length === 0) {
          const latestRow = dataRows
            .filter(row => {
              if (!row || !row[dateColumnIndex]) return false;
              const parsed = parseDate(String(row[dateColumnIndex]).trim());
              return parsed && !isNaN(parsed.getTime()) && parsed <= fallbackEnd;
            })
            .sort((a, b) => {
              const dateA = parseDate(String(a[dateColumnIndex] || '').trim());
              const dateB = parseDate(String(b[dateColumnIndex] || '').trim());
              if (!dateA || !dateB) return 0;
              return dateA.getTime() - dateB.getTime();
            });
          rowsToReturn = latestRow.length > 0 ? [latestRow[latestRow.length - 1]] : [];
        } else {
          rowsToReturn = fallbackRows;
        }
      }

      return [...headerRows, ...rowsToReturn];
    } catch (error) {
      console.error('フィルタリングエラー:', error);
      return data;
    }
  };

  useEffect(() => {
    setMounted(true);
    fetchData();
  }, []);

  // Threadsチャネル切替時にデータを遅延取得
  useEffect(() => {
    if (activeChannel !== 'threads') return;
    if (threadsData) return; // キャッシュ済み
    const fetchThreadsData = async () => {
      setThreadsLoading(true);
      try {
        const response = await fetch('/api/dashboard/33833959932919231');
        const result = await response.json();
        if (result.success) {
          setThreadsData(result.data || null);
          setThreadsUser(result.user || null);
        }
      } catch (err) {
        console.error('Threads data fetch error:', err);
      } finally {
        setThreadsLoading(false);
      }
    };
    fetchThreadsData();
  }, [activeChannel, threadsData]);

  useEffect(() => {
    setCustomStartDate(formatDateForInput(dateRange.start));
    setCustomEndDate(formatDateForInput(dateRange.end));
  }, [dateRange.start, dateRange.end, dateRange.preset]);

  const fetchData = async () => {
    console.log('=== fetchData 関数開始 ===');
    try {
      setLoading(true);
      setError('');

      console.log('実際のスプレッドシートからデータを取得中...');
      
      const response = await fetch('/api/data?source=bigquery', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });
      
      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers.get('content-type'));
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('非JSON応答:', text.substring(0, 500));
        throw new Error('サーバーから無効な応答形式が返されました');
      }
      
      const result = await response.json();

      if (result.error) {
        console.error('API returned error:', result);
        setError(`エラー: ${result.error} (${result.details || '詳細不明'})`);
        return;
      }
      console.log('取得したデータ:', {
        instagram: result.instagramRaw?.length || 0,
        storiesRaw: result.storiesRaw?.length || 0,
        storiesProcessed: result.storiesProcessed?.length || 0,
        reelRaw: result.reelRawDataRaw?.length || 0,
        reelSheet: result.reelSheetRaw?.length || 0,
        daily: result.dailyRaw?.length || 0
      });
      
      console.log('=== setData実行前 ===');
      console.log('result.storiesRaw?.length:', result.storiesRaw?.length);
      console.log('result.storiesRaw 最初の3行:', result.storiesRaw?.slice(0, 3));

      setData(result as ApiResponse);

      console.log('=== setData実行後 ===');
      // 状態の更新は非同期なので、次のレンダリングサイクルで確認する
    } catch (error) {
      console.error('データ取得エラー:', error);
      setError(`データ取得に失敗しました: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const calculateSummary = () => {
    try {
      // デイリーデータを使用して全指標を計算
      const filteredDailyData = getFilteredDailyData(data.dailyRaw, dateRange.preset);

      // eslint-disable-next-line prefer-const
      let summary = {
        currentFollowers: 0,
        followerGrowth: 0,
        latestReach: 0,
        latestProfileViews: 0,
        latestWebsiteClicks: 0,
        totalStories: 0,
        totalReels: 0,
        lineRegistrations: 0,
      };

      if (filteredDailyData.data && filteredDailyData.data.length > 0) {
        const dataRows = filteredDailyData.data;

        const followerValues: number[] = [];
        let followerGrowthTotal = 0;
        let reachTotal = 0;
        let profileViewsTotal = 0;
        let webClicksTotal = 0;
        let lineTotal = 0;

        dataRows.forEach((row) => {
          // B列: フォロワー数 (index 1)
          const followers = parseInt(String(row[1] || '').replace(/,/g, '')) || 0;
          if (followers > 0) {
            followerValues.push(followers);
          }

          // C列: 増加数 (index 2)
          const dailyFollowerGrowth = parseInt(String(row[2] || '').replace(/,/g, '')) || 0;
          followerGrowthTotal += dailyFollowerGrowth;

          // G列: リーチ数 (index 6) - 期間内合計
          const reach = parseInt(String(row[6] || '').replace(/,/g, '')) || 0;
          reachTotal += reach;

          // J列: プロフィール表示数 (index 9) - 期間内合計
          const profileViews = parseInt(String(row[9] || '').replace(/,/g, '')) || 0;
          profileViewsTotal += profileViews;

          // L列: Webクリック数 (index 11) - 期間内合計
          const webClicks = parseInt(String(row[11] || '').replace(/,/g, '')) || 0;
          webClicksTotal += webClicks;

          // O列: LINE登録者数 (index 14) - 期間内合計
          const lineValue = parseInt(String(row[14] || '').replace(/,/g, '')) || 0;
          lineTotal += lineValue;
        });

        // フォロワー数: 期間内最大値と増加数
        if (followerValues.length > 0) {
          summary.currentFollowers = Math.max(...followerValues);
        }
        summary.followerGrowth = followerGrowthTotal;

        // 各指標の合計値を設定
        summary.latestReach = reachTotal;
        summary.latestProfileViews = profileViewsTotal;
        summary.latestWebsiteClicks = webClicksTotal;
        summary.lineRegistrations = lineTotal;
      }

      console.log('=== calculateSummary内でのデータ確認 ===');
      console.log('data.storiesProcessed?.length:', data.storiesProcessed?.length);
      console.log('data.storiesProcessed 最初の3行:', data.storiesProcessed?.slice(0, 3));

      const filteredStoriesProcessed = getFilteredData(data.storiesProcessed, 0, dateRange);
      // 全体の件数を表示（フィルタリング無し）
      summary.totalStories = filteredStoriesProcessed && filteredStoriesProcessed.length > 1 ? filteredStoriesProcessed.length - 1 : 0;
      summary.totalReels = data.reelRawDataRaw && data.reelRawDataRaw.length > 1 ? data.reelRawDataRaw.length - 1 : 0;

      return summary;
    } catch (error) {
      console.error('KPI計算エラー:', error);
      
      return {
        currentFollowers: 0,
        followerGrowth: 0,
        latestReach: 0,
        latestProfileViews: 0,
        latestWebsiteClicks: 0,
        totalStories: 0,
        totalReels: 0,
        lineRegistrations: 0,
      };
    }
  };

  if (!mounted) {
    return <LoadingScreen />;
  }

  const summary = calculateSummary();
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  if (loading) {
    return <LoadingScreen />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center bg-white p-8 rounded-2xl border border-gray-200/70 max-w-2xl shadow-sm">
          <div className="text-red-600 text-xl mb-4 font-medium">{error}</div>
          <button
            onClick={fetchData}
            className="bg-gradient-to-r from-purple-600 to-blue-500 hover:opacity-90 text-white px-6 py-3 rounded-md font-medium transition-all duration-200 shadow-sm"
          >
            💎 再試行
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 relative overflow-hidden">
      {/* SaaS風アクセント - デスクトップのみ */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-600 to-blue-500 hidden lg:block"></div>

      {/* プロフィールヘッダー */}
      <ProfileHeader userId={userId} />

      {/* デスクトップ左サイドバー: チャネル切替 */}
      <div className="hidden lg:flex fixed left-0 top-0 h-full w-28 flex-col items-center pt-16 gap-2 bg-white border-r border-gray-200 z-40">
        <button
          onClick={() => setActiveChannel('instagram')}
          className={`w-full flex flex-col items-center gap-1 py-3 px-2 rounded-lg transition-all ${
            activeChannel === 'instagram'
              ? 'bg-gradient-to-r from-purple-50 to-pink-50 text-purple-600'
              : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'
          }`}
        >
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
          </svg>
          <span className="text-[10px] font-medium">Instagram</span>
        </button>
        <button
          onClick={() => setActiveChannel('threads')}
          className={`w-full flex flex-col items-center gap-1 py-3 px-2 rounded-lg transition-all ${
            activeChannel === 'threads'
              ? 'bg-gray-900 text-white'
              : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'
          }`}
        >
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.33-3.082.88-.76 2.119-1.207 3.583-1.291a13.853 13.853 0 0 1 3.02.142c-.126-.742-.375-1.332-.75-1.757-.513-.586-1.308-.883-2.359-.89h-.029c-.844 0-1.992.232-2.721 1.32L7.734 7.847c.98-1.454 2.568-2.256 4.478-2.256h.044c3.194.02 5.097 1.975 5.287 5.388.108.046.216.094.321.142 1.49.7 2.58 1.761 3.154 3.07.797 1.82.871 4.79-1.548 7.158-1.85 1.81-4.094 2.628-7.277 2.65Zm1.003-11.69c-.242 0-.487.007-.739.021-1.836.103-2.98.946-2.916 2.143.067 1.256 1.452 1.839 2.784 1.767 1.224-.065 2.818-.543 3.086-3.71a10.5 10.5 0 0 0-2.215-.221z"/>
          </svg>
          <span className="text-[10px] font-medium">Threads</span>
        </button>
      </div>

      {/* Mobile Fixed Header - YouTube Studio風 */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white shadow-sm h-[60px]">
        <div className="flex items-center justify-between px-5 h-full">
          {/* 左: Analycaロゴ + ANALYCA */}
          <div className="flex items-center flex-shrink-0">
            <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-emerald-400 rounded-lg flex items-center justify-center mr-3">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h1 className="text-lg font-bold text-gray-900">
              GEM QUEEN
            </h1>
          </div>

          {/* 中央: チャネル切替 */}
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setActiveChannel('instagram')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                activeChannel === 'instagram'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500'
              }`}
            >
              Instagram
            </button>
            <button
              onClick={() => setActiveChannel('threads')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                activeChannel === 'threads'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500'
              }`}
            >
              Threads
            </button>
          </div>

          {/* 右: 期間セレクト */}
          <div className="flex items-center">
            {activeChannel === 'instagram' && (
            <select
              value={dateRange.preset === 'yesterday' ? 'yesterday' :
                     dateRange.preset === 'this-week' ? 'this-week' :
                     dateRange.preset === 'last-week' ? 'last-week' :
                     dateRange.preset === 'this-month' ? 'this-month' :
                     dateRange.preset === 'last-month' ? 'last-month' :
                     'custom'}
              onChange={(e) => {
                const value = e.target.value as DatePreset;
                if (value === 'custom') {
                  setCustomStartDate(formatDateForInput(dateRange.start));
                  setCustomEndDate(formatDateForInput(dateRange.end));
                  setShowCustomDateModal(true);
                } else {
                  updatePreset(value);
                }
              }}
              className="rounded-lg border border-gray-500 bg-white text-gray-900 px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 min-w-[100px]"
            >
              <option value="yesterday">昨日</option>
              <option value="this-week">今週</option>
              <option value="last-week">先週</option>
              <option value="this-month">今月</option>
              <option value="last-month">先月</option>
              <option value="custom">カスタム期間</option>
            </select>
            )}
            {activeChannel === 'threads' && (
            <select
              value={threadsDatePreset}
              onChange={(e) => setThreadsDatePreset(e.target.value as typeof threadsDatePreset)}
              className="rounded-lg border border-gray-500 bg-white text-gray-900 px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 min-w-[100px]"
            >
              <option value="3d">過去3日</option>
              <option value="7d">過去7日</option>
              <option value="thisWeek">今週</option>
              <option value="lastWeek">先週</option>
              <option value="thisMonth">今月</option>
              <option value="lastMonth">先月</option>
            </select>
            )}
          </div>
        </div>
      </div>

      {/* Desktop Container */}
      <div className="max-w-7xl mx-auto lg:px-6 lg:py-8 relative z-10 lg:pt-8 pt-16 pb-20 lg:pb-8 lg:ml-28">
        {/* TopBar: 左サービス名、中央タブ、右期間セレクト - デスクトップのみ */}
        <div className="hidden lg:flex items-center justify-between mb-8 bg-white border border-gray-200/70 rounded-2xl shadow-sm p-5">
          {/* 左: サービス名 */}
          <div className="flex items-center flex-shrink-0">
            <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-emerald-400 rounded-lg flex items-center justify-center mr-3">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900">
              GEM QUEEN
            </h1>
          </div>

          {/* 中央: タブ (Instagramチャネル時のみ) */}
          {activeChannel === 'instagram' && (
          <div className="hidden lg:flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                activeTab === 'dashboard'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              ホーム
            </button>
            <button
              onClick={() => setActiveTab('reels')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                activeTab === 'reels'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              リール
            </button>
            <button
              onClick={() => setActiveTab('stories')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                activeTab === 'stories'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              ストーリー
            </button>
            <button
              onClick={() => setActiveTab('daily')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                activeTab === 'daily'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              デイリー
            </button>
          </div>
          )}
          {activeChannel === 'threads' && <div />}

          {/* 右: 期間セレクト */}
          <div className="flex items-center space-x-3 flex-shrink-0">
            {activeChannel === 'threads' && (
            <select
              value={threadsDatePreset}
              onChange={(e) => setThreadsDatePreset(e.target.value as typeof threadsDatePreset)}
              className="rounded-md border border-gray-300 bg-white text-gray-700 shadow-sm px-3 py-2 text-sm focus:ring-2 focus:ring-purple-200 focus:border-purple-400 transition-all duration-200 min-w-[120px]"
            >
              <option value="3d">過去3日</option>
              <option value="7d">過去7日</option>
              <option value="thisWeek">今週</option>
              <option value="lastWeek">先週</option>
              <option value="thisMonth">今月</option>
              <option value="lastMonth">先月</option>
            </select>
            )}
            {activeChannel === 'instagram' && (
            <select
              value={dateRange.preset === 'yesterday' ? 'yesterday' :
                     dateRange.preset === 'this-week' ? 'this-week' :
                     dateRange.preset === 'last-week' ? 'last-week' :
                     dateRange.preset === 'this-month' ? 'this-month' :
                     dateRange.preset === 'last-month' ? 'last-month' :
                     'custom'}
              onChange={(e) => {
                const value = e.target.value as DatePreset;
                if (value === 'custom') {
                  setCustomStartDate(formatDateForInput(dateRange.start));
                  setCustomEndDate(formatDateForInput(dateRange.end));
                  setShowCustomDateModal(true);
                } else {
                  updatePreset(value);
                }
              }}
              className="rounded-md border border-gray-300 bg-white text-gray-700 shadow-sm px-3 py-2 text-sm focus:ring-2 focus:ring-purple-200 focus:border-purple-400 transition-all duration-200 min-w-[120px]"
            >
              <option value="yesterday">昨日</option>
              <option value="this-week">今週</option>
              <option value="last-week">先週</option>
              <option value="this-month">今月</option>
              <option value="last-month">先月</option>
              <option value="custom">カスタム期間</option>
            </select>
            )}
          </div>
        </div>

        {/* Threads チャネル */}
        {activeChannel === 'threads' && (
          <GemQueenThreadsContent
            data={threadsData}
            loading={threadsLoading}
            username={threadsUser?.threads_username || 'yoko_gemqueen'}
            profilePicture={threadsUser?.threads_profile_picture_url}
            datePreset={threadsDatePreset}
          />
        )}

        {/* Instagram チャネル */}
        {activeChannel === 'instagram' && <>

        {/* Main Dashboard */}
        {activeTab === 'dashboard' && (
          <div className="space-y-4 lg:space-y-6 lg:px-0">
            {/* アカウント情報セクション - モバイルのみ */}
            <div className="lg:hidden px-4">
              <div className="bg-white rounded-xl shadow-md border border-gray-100 p-5 mx-0 mb-4">
                <div className="flex items-center">
                  {/* プロフィール画像 */}
                  <div className="w-[60px] h-[60px] rounded-full overflow-hidden bg-gray-100 flex items-center justify-center mr-4 flex-shrink-0">
                    <img
                      src="/yoko-icon.jpg"
                      alt="YOKO icon"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.classList.add('hidden');
                        e.currentTarget.nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                    <div className="hidden w-full h-full bg-gradient-to-r from-purple-500 to-emerald-400 flex items-center justify-center text-white text-xl font-bold">
                      Y
                    </div>
                  </div>

                  {/* アカウント情報 */}
                  <div className="flex-1">
                    <h2 className="text-[16px] font-bold text-gray-900 mb-1">YOKO</h2>
                    <p className="text-[12px] text-gray-500 mb-1">現在のフォロワー数</p>
                    <div className="flex items-center">
                      <span className="text-[24px] font-bold text-gray-900 mr-2">{summary.currentFollowers.toLocaleString()}</span>
                      <span className="text-[14px] font-medium text-purple-500">
                        +{summary.followerGrowth.toLocaleString()} ({((summary.followerGrowth / summary.currentFollowers) * 100).toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ファネル分析セクション - モバイルのみ */}
            <div className="lg:hidden px-4">
              {/* ファネル分析全体をカードで囲む */}
              <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4 mb-4">
                {/* カード内タイトル */}
                <div className="flex items-center justify-center mb-2">
                  <span className="text-base mr-2">📊</span>
                  <h2 className="text-base font-bold text-gray-900">ファネル分析</h2>
                </div>

                <div className="space-y-2">
                  {/* リーチ数 */}
                  <div className="px-3 py-2 flex items-center justify-between h-10">
                    <div className="flex items-center">
                      <span className="text-base mr-3">👁️</span>
                      <span className="text-gray-900 font-medium text-sm">リーチ数</span>
                    </div>
                    <span className="text-lg font-bold text-gray-900">{summary.latestReach.toLocaleString()}</span>
                  </div>

                  {/* 転換率1 */}
                  <div className="flex justify-center py-1 h-5">
                    <span className="text-sm font-semibold text-purple-600">↓ {((summary.latestProfileViews / summary.latestReach) * 100).toFixed(1)}%</span>
                  </div>

                  {/* プロフィール表示 */}
                  <div className="px-3 py-2 flex items-center justify-between h-10">
                    <div className="flex items-center">
                      <span className="text-base mr-3">👤</span>
                      <span className="text-gray-900 font-medium text-sm">プロフィール表示</span>
                    </div>
                    <span className="text-lg font-bold text-gray-900">{summary.latestProfileViews.toLocaleString()}</span>
                  </div>

                  {/* 転換率2 */}
                  <div className="flex justify-center py-1 h-5">
                    <span className="text-sm font-semibold text-purple-600">↓ {((summary.latestWebsiteClicks / summary.latestProfileViews) * 100).toFixed(1)}%</span>
                  </div>

                  {/* プロフクリック */}
                  <div className="px-3 py-2 flex items-center justify-between h-10">
                    <div className="flex items-center">
                      <span className="text-base mr-3">🔗</span>
                      <span className="text-gray-900 font-medium text-sm">プロフクリック</span>
                    </div>
                    <span className="text-lg font-bold text-gray-900">{summary.latestWebsiteClicks.toLocaleString()}</span>
                  </div>

                  {/* 転換率3 */}
                  <div className="flex justify-center py-1 h-5">
                    <span className="text-sm font-semibold text-purple-600">↓ {((summary.followerGrowth / summary.latestWebsiteClicks) * 100).toFixed(1)}%</span>
                  </div>

                  {/* フォロワー増加 */}
                  <div className="px-3 py-2 flex items-center justify-between h-10">
                    <div className="flex items-center">
                      <span className="text-base mr-3">➕</span>
                      <span className="text-gray-900 font-medium text-sm">フォロワー増加</span>
                    </div>
                    <span className="text-lg font-bold text-gray-900">{summary.followerGrowth.toLocaleString()}</span>
                  </div>

                  {/* 転換率4 */}
                  <div className="flex justify-center py-1 h-5">
                    <span className="text-sm font-semibold text-purple-600">↓ {((summary.lineRegistrations / summary.followerGrowth) * 100).toFixed(1)}%</span>
                  </div>

                  {/* LINE登録数 */}
                  <div className="px-3 py-2 flex items-center justify-between h-10">
                    <div className="flex items-center">
                      <span className="text-base mr-3">📱</span>
                      <span className="text-gray-900 font-medium text-sm">LINE登録数</span>
                    </div>
                    <span className="text-lg font-bold text-gray-900">{summary.lineRegistrations.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* PC版上部セクション: アカウント情報 + ファネル分析 */}
            <div className="hidden lg:block">
              <div className="grid lg:grid-cols-12 gap-4 mb-6">
                {/* 左: アカウント情報 (3列) */}
                <div className="lg:col-span-3">
                  <div className="bg-white border border-gray-200/70 rounded-2xl shadow-sm p-5 h-[200px] flex flex-col justify-center">
                    <div className="flex items-center mb-4">
                      {/* プロフィール画像 */}
                      <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center mr-4 flex-shrink-0">
                        <img
                          src="/yoko-icon.jpg"
                          alt="YOKO icon"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.classList.add('hidden');
                            e.currentTarget.nextElementSibling?.classList.remove('hidden');
                          }}
                        />
                        <div className="hidden w-full h-full bg-gradient-to-r from-purple-500 to-emerald-400 flex items-center justify-center text-white text-2xl font-bold">
                          Y
                        </div>
                      </div>
                      {/* アカウント情報 */}
                      <div className="flex-1">
                        <h2 className="text-xl font-bold text-gray-900 mb-1">YOKO</h2>
                        <p className="text-sm text-gray-500">現在のフォロワー数</p>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <span className="text-3xl font-bold text-gray-900 mr-3">{summary.currentFollowers.toLocaleString()}</span>
                      <span className="text-sm font-medium text-purple-500">
                        +{summary.followerGrowth.toLocaleString()} ({((summary.followerGrowth / summary.currentFollowers) * 100).toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                </div>

                {/* 右: ファネル分析パネル (9列) */}
                <div className="lg:col-span-9">
                  <div className="bg-white border border-gray-200/70 rounded-2xl shadow-sm p-5 h-[200px] flex flex-col">
                    <div className="flex items-center mb-6">
                      <span className="text-2xl mr-2">📊</span>
                      <h2 className="text-xl font-bold text-gray-900">ファネル分析</h2>
                    </div>

                    {/* 横並びファネルフロー */}
                    <div className="flex items-center justify-between flex-1">
                      {/* リーチ */}
                      <div className="flex flex-col items-center">
                        <div className="flex items-center mb-2">
                          <span className="text-xl mr-1">👁️</span>
                          <span className="text-gray-900 font-medium text-sm">リーチ</span>
                        </div>
                        <span className="text-xl font-bold text-gray-900">{summary.latestReach.toLocaleString()}</span>
                      </div>

                      {/* 矢印1 + CVR1 */}
                      <div className="flex flex-col items-center mx-3">
                        <div className="text-xl text-purple-500 mb-1">→</div>
                        <span className="text-xs font-medium text-purple-500">{((summary.latestProfileViews / summary.latestReach) * 100).toFixed(1)}%</span>
                      </div>

                      {/* プロフ表示 */}
                      <div className="flex flex-col items-center">
                        <div className="flex items-center mb-2">
                          <span className="text-xl mr-1">👤</span>
                          <span className="text-gray-900 font-medium text-sm whitespace-nowrap">プロフ表示</span>
                        </div>
                        <span className="text-xl font-bold text-gray-900">{summary.latestProfileViews.toLocaleString()}</span>
                      </div>

                      {/* 矢印2 + CVR2 */}
                      <div className="flex flex-col items-center mx-3">
                        <div className="text-xl text-purple-500 mb-1">→</div>
                        <span className="text-xs font-medium text-purple-500">{((summary.latestWebsiteClicks / summary.latestProfileViews) * 100).toFixed(1)}%</span>
                      </div>

                      {/* リンククリック */}
                      <div className="flex flex-col items-center">
                        <div className="flex items-center mb-2">
                          <span className="text-xl mr-1">🔗</span>
                          <span className="text-gray-900 font-medium text-sm whitespace-nowrap">リンククリック</span>
                        </div>
                        <span className="text-xl font-bold text-gray-900">{summary.latestWebsiteClicks.toLocaleString()}</span>
                      </div>

                      {/* 矢印3 + CVR3 */}
                      <div className="flex flex-col items-center mx-3">
                        <div className="text-xl text-purple-500 mb-1">→</div>
                        <span className="text-xs font-medium text-purple-500">{((summary.followerGrowth / summary.latestWebsiteClicks) * 100).toFixed(1)}%</span>
                      </div>

                      {/* フォロワー増加 */}
                      <div className="flex flex-col items-center">
                        <div className="flex items-center mb-2">
                          <span className="text-xl mr-1">➕</span>
                          <span className="text-gray-900 font-medium text-sm whitespace-nowrap">フォロワー増加</span>
                        </div>
                        <span className="text-xl font-bold text-gray-900">{summary.followerGrowth.toLocaleString()}</span>
                      </div>

                      {/* 矢印4 + CVR4 */}
                      <div className="flex flex-col items-center mx-3">
                        <div className="text-xl text-purple-500 mb-1">→</div>
                        <span className="text-xs font-medium text-purple-500">{((summary.lineRegistrations / summary.followerGrowth) * 100).toFixed(1)}%</span>
                      </div>

                      {/* LINE登録 */}
                      <div className="flex flex-col items-center">
                        <div className="flex items-center mb-2">
                          <span className="text-xl mr-1">📱</span>
                          <span className="text-gray-900 font-medium text-sm">LINE登録</span>
                        </div>
                        <span className="text-xl font-bold text-gray-900">{summary.lineRegistrations.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          {/* パフォーマンス推移グラフ - モバイル: フル幅, デスクトップ: 9列 */}
          <div className="lg:col-span-9 col-span-1 lg:px-0 sm:px-3 px-1">
            {(() => {
              const filteredDailyData = getFilteredDailyData(data.dailyRaw, dateRange.preset);

                  // 今日の日付を取得（JST基準）
                  const today = new Date();
                  const todayJST = new Date(today.getFullYear(), today.getMonth(), today.getDate());

                  // 今日のデータを除外（昨日まで）
                  const chartData = filteredDailyData.data ? filteredDailyData.data.filter(row => {
                    const dateStr = String(row[0] || '').trim();
                    const date = parseDate(dateStr);
                    if (!date) return false;

                    const rowDateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
                    return rowDateOnly < todayJST; // 今日より前の日付のみ
                  }) : [];

                  // Rechartsに合わせてデータを変換
                  const rechartsData = chartData.map((row) => {
                    const dateStr = String(row[0] || '').trim();
                    const date = parseDate(dateStr);
                    const formattedDate = date ? date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' }) : dateStr;

                    const current = parseInt(String(row[1] || '').replace(/,/g, '')) || 0;
                    const followerGrowth = parseInt(String(row[2] || '').replace(/,/g, '')) || 0;

                    return {
                      date: formattedDate,
                      フォロワー数: current,
                      フォロワー増加数: followerGrowth,
                      LINE登録数: parseInt(String(row[14] || '').replace(/,/g, '')) || 0
                    };
                  });

                  return rechartsData.length > 0 && (
                    <div className="bg-white border border-gray-100 lg:border-gray-200/70 rounded-lg lg:rounded-2xl shadow-md lg:shadow-sm p-3 lg:p-5 md:p-4 sm:p-3">
                      <div className="mb-3 lg:px-3 sm:px-2 px-1 flex items-center justify-between">
                        <h3 className="text-xl font-bold text-gray-900">パフォーマンス推移</h3>
                        <button
                          onClick={() => setShowDailyTable(!showDailyTable)}
                          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-50"
                        >
                          {showDailyTable ? '表を閉じる' : '日別データを表示'}
                        </button>
                      </div>
                      {showDailyTable && (
                        <div className="mb-4 overflow-x-auto rounded-lg border border-gray-200">
                          <table className="w-full table-fixed text-sm">
                            <colgroup>
                              <col className="w-[140px]" />
                              <col className="w-[110px]" />
                              <col className="w-[70px]" />
                              <col className="w-[70px]" />
                              <col className="w-[90px]" />
                              <col className="w-[80px]" />
                              <col className="w-[80px]" />
                              <col className="w-[100px]" />
                              <col className="w-[110px]" />
                              <col className="w-[80px]" />
                            </colgroup>
                            <thead className="sticky top-0 bg-gray-50">
                              <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                                <th className="px-3 py-2">日付</th>
                                <th className="px-3 py-2 text-right">フォロワー数</th>
                                <th className="px-3 py-2 text-right">増加</th>
                                <th className="px-3 py-2 text-right">投稿</th>
                                <th className="px-3 py-2 text-right">リーチ</th>
                                <th className="px-3 py-2 text-right">クリック</th>
                                <th className="px-3 py-2 text-right">LINE</th>
                                <th className="px-3 py-2 text-right">ストーリー投稿</th>
                                <th className="px-3 py-2 text-right">ストーリー閲覧</th>
                                <th className="px-3 py-2 text-right">閲覧率</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {[...chartData].reverse().map((row) => {
                                const dateStr = String(row[0] || '').trim();
                                const date = parseDate(dateStr);
                                const displayDate = date
                                  ? date.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' })
                                  : dateStr;

                                const followers = String(row[1] || '0').replace(/,/g, '');
                                const delta = parseInt(String(row[2] || '0').replace(/,/g, '')) || 0;
                                const posts = String(row[5] || '0').replace(/,/g, '');
                                const reach = String(row[6] || '0').replace(/,/g, '');
                                const clicks = String(row[11] || '0').replace(/,/g, '');
                                const lineRegs = parseInt(String(row[14] || '0').replace(/,/g, '')) || 0;
                                const storyPosts = String(row[19] || '0').replace(/,/g, '');
                                const storyViews = String(row[20] || '0').replace(/,/g, '');
                                const storyRate = String(row[21] || '-');

                                return (
                                  <tr key={dateStr} className="hover:bg-gray-50">
                                    <td className="px-3 py-2 font-medium text-gray-900">
                                      {displayDate}
                                    </td>
                                    <td className="px-3 py-2 text-right tabular-nums text-gray-900">
                                      {parseInt(followers).toLocaleString()}
                                    </td>
                                    <td className="px-3 py-2 text-right tabular-nums">
                                      <span className={delta > 0 ? 'text-green-600' : 'text-gray-500'}>
                                        {delta > 0 ? `+${delta.toLocaleString()}` : '0'}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2 text-right tabular-nums text-gray-500">
                                      {parseInt(posts).toLocaleString()}
                                    </td>
                                    <td className="px-3 py-2 text-right tabular-nums text-gray-900">
                                      {parseInt(reach).toLocaleString()}
                                    </td>
                                    <td className="px-3 py-2 text-right tabular-nums text-gray-900">
                                      {parseInt(clicks).toLocaleString()}
                                    </td>
                                    <td className="px-3 py-2 text-right tabular-nums">
                                      <span className={lineRegs > 0 ? 'text-amber-600' : 'text-gray-500'}>
                                        {lineRegs > 0 ? `+${lineRegs.toLocaleString()}` : '0'}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2 text-right tabular-nums text-gray-500">
                                      {parseInt(storyPosts).toLocaleString()}
                                    </td>
                                    <td className="px-3 py-2 text-right tabular-nums text-gray-900">
                                      {parseInt(storyViews).toLocaleString()}
                                    </td>
                                    <td className="px-3 py-2 text-right tabular-nums text-gray-500">
                                      {storyRate}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                      <div className="h-72 lg:h-80 md:h-64 sm:h-60 lg:px-0 sm:px-1 px-0">
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart
                            data={rechartsData}
                            margin={isMobile ? { top: 8, right: 12, left: 12, bottom: 6 } : { top: 10, right: 16, left: 24, bottom: 12 }}
                          >
                            <CartesianGrid
                              strokeDasharray={isMobile ? '2 2' : '3 3'}
                              stroke={isMobile ? '#E5E7EB' : 'var(--chart-grid)'}
                              horizontal
                              vertical={false}
                              strokeOpacity={isMobile ? 0.6 : 1}
                              strokeWidth={1}
                            />
                            <XAxis
                              dataKey="date"
                              tick={{ fontSize: isMobile ? 10 : 14, fill: 'var(--chart-axis)' }}
                              interval={isMobile ? Math.max(Math.floor(rechartsData.length / 3) - 1, 0) : 0}
                              axisLine={{ stroke: '#D1D5DB', strokeWidth: 1 }}
                              tickLine={isMobile ? { stroke: '#D1D5DB', strokeWidth: 1 } : { stroke: 'var(--chart-axis)', strokeWidth: 1 }}
                              height={isMobile ? 28 : undefined}
                            />
                            <YAxis
                              yAxisId="left"
                              orientation="left"
                              axisLine={{ stroke: '#D1D5DB', strokeWidth: 1 }}
                              tickLine={isMobile ? { stroke: '#D1D5DB', strokeWidth: 1 } : { stroke: 'var(--chart-axis)', strokeWidth: 1 }}
                              tick={isMobile ? {
                                fontSize: 10,
                                fill: 'var(--chart-axis)',
                                fontWeight: 'bold'
                              } : {
                                fontSize: 14,
                                fill: 'var(--chart-axis)'
                              }}
                              className=""
                              tickFormatter={(value) => value.toLocaleString()}
                              domain={isMobile ? ['dataMin - 100', 'dataMax + 100'] : ['dataMin', 'dataMax']}
                              width={isMobile ? 38 : 60}
                            />
                            <YAxis
                              yAxisId="right"
                              orientation="right"
                              axisLine={{ stroke: '#D1D5DB', strokeWidth: 1 }}
                              tickLine={isMobile ? { stroke: '#D1D5DB', strokeWidth: 1 } : { stroke: 'var(--chart-axis)', strokeWidth: 1 }}
                              tick={isMobile ? {
                                fontSize: 10,
                                fill: 'var(--chart-axis)',
                                fontWeight: 'bold'
                              } : {
                                fontSize: 14,
                                fill: 'var(--chart-axis)'
                              }}
                              className=""
                              tickFormatter={(value) => value.toLocaleString()}
                              width={isMobile ? 32 : 60}
                              domain={[0, 'dataMax + 5']}
                            />
                            <Tooltip
                              formatter={(value, name) => [value.toLocaleString(), name]}
                              labelStyle={{ color: 'var(--text-primary)', fontSize: isMobile ? '10px' : '14px' }}
                              contentStyle={{
                                backgroundColor: isMobile ? '#FFFFFF' : 'var(--card-background)',
                                border: `1px solid ${isMobile ? '#E0E0E0' : 'var(--border-color)'}`,
                                borderRadius: isMobile ? '6px' : '8px',
                                boxShadow: isMobile ? '0 2px 6px rgba(15, 23, 42, 0.12)' : '0 6px 12px -1px rgba(15, 23, 42, 0.15)',
                                color: isMobile ? '#111827' : 'var(--text-primary)',
                                padding: isMobile ? '6px 8px' : '8px 12px',
                                fontSize: isMobile ? '10px' : '14px',
                                minWidth: isMobile ? 'auto' : undefined,
                                maxWidth: isMobile ? '120px' : undefined
                              }}
                              cursor={{ stroke: '#7C3AED', strokeWidth: 1, strokeDasharray: '4 4' }}
                              offset={isMobile ? 8 : 12}
                              allowEscapeViewBox={{ x: false, y: true }}
                            />
                            <Legend
                              wrapperStyle={{
                                fontSize: isMobile ? '10px' : '12px',
                                marginTop: isMobile ? '4px' : '8px',
                                lineHeight: isMobile ? '12px' : '16px',
                                display: 'block',
                                textAlign: 'center'
                              }}
                              iconSize={isMobile ? 10 : 14}
                              iconType={isMobile ? 'circle' : 'line'}
                              formatter={(value) => value}
                            />
                            <Line
                              yAxisId="left"
                              type="monotone"
                              dataKey="フォロワー数"
                              stroke="#7C3AED"
                              strokeWidth={isMobile ? 2 : 3}
                              dot={isMobile ? {
                                r: 3,
                                stroke: '#FFFFFF',
                                strokeWidth: 1.5,
                                fill: '#7C3AED'
                              } : {
                                fill: '#7C3AED',
                                strokeWidth: 2,
                                r: 4
                              }}
                              activeDot={{
                                r: isMobile ? 5 : 6,
                                stroke: '#7C3AED',
                                strokeWidth: 2,
                                fill: '#FFFFFF'
                              }}
                            />
                            <Bar
                              yAxisId="right"
                              dataKey="フォロワー増加数"
                              fill="#3B82F6"
                              radius={[2, 2, 0, 0]}
                              opacity={0.7}
                              maxBarSize={isMobile ? 18 : 40}
                            />
                            <Bar
                              yAxisId="right"
                              dataKey="LINE登録数"
                              fill="#22C55E"
                              radius={[2, 2, 0, 0]}
                              opacity={0.7}
                              maxBarSize={isMobile ? 18 : 40}
                            />
                            <defs>
                              <linearGradient id="followerGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#7C3AED" stopOpacity={0.05}/>
                              </linearGradient>
                            </defs>
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  ) || null;
                })()}
          </div>

          {/* Top 3/5 Reels */}
          <div className="lg:px-0 sm:px-3 px-1">
            <div className="bg-white border border-gray-100 lg:border-gray-200/70 rounded-lg lg:rounded-2xl shadow-md lg:shadow-sm p-4 lg:p-6">
              {/* モバイル版ヘッダー */}
              <div className="lg:hidden flex justify-between items-center mb-4 px-2">
                <h3 className="text-lg font-bold text-gray-900 tracking-tight">
                  🎬 Top3 リール
                </h3>
                <button
                  onClick={() => {
                    setActiveTab('reels');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="bg-gradient-to-r from-purple-500 to-emerald-400 hover:from-purple-600 hover:to-emerald-500 text-white px-2 py-1 rounded-lg text-sm font-medium shadow-sm transition-all duration-200"
                >
                  詳細
                </button>
              </div>
              {/* PC版ヘッダー */}
              <div className="hidden lg:flex justify-between items-center mb-4 px-3">
                <h3 className="text-xl font-bold text-gray-900 tracking-tight">
                  💎 Top{window.innerWidth < 1024 ? '3' : '5'} リール
                </h3>
                <button
                  onClick={() => {
                    setActiveTab('reels');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="bg-gradient-to-r from-purple-500 to-emerald-400 hover:from-purple-600 hover:to-emerald-500 text-white px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 shadow-sm"
                >
                  詳細 →
                </button>
              </div>
              <div className="w-full lg:grid lg:grid-cols-5 lg:gap-4 grid grid-cols-3 gap-2 px-1 sm:px-2 lg:px-0">
                {(() => {
                  // リールデータを結合
                  const joinedReelData = joinReelData(data.reelRawDataRaw, data.reelSheetRaw);
                  // フィルタリングを適用
                  const filteredJoinedData = filterJoinedReelData(joinedReelData, dateRange);

                  if (filteredJoinedData.length > 0) {
                    // 再生数でソートしてTop表示を取得（スマホ:3件、PC:5件）
                    const topCount = window.innerWidth < 1024 ? 3 : 5;
                    const sortedReels = filteredJoinedData.sort((a, b) => {
                      const viewsA = parseInt(String(a.rawData[6] || '').replace(/,/g, '')) || 0;
                      const viewsB = parseInt(String(b.rawData[6] || '').replace(/,/g, '')) || 0;
                      return viewsB - viewsA;
                    }).slice(0, topCount);

                  return sortedReels.map((joinedReel, index) => {
                    const rawData = joinedReel.rawData;
                    const sheetData = joinedReel.sheetData;
                    const postedDate = sheetData[0] || `リール ${index + 1}`;

                    return (
                      <div key={index} className="w-full lg:w-full lg:min-w-0 bg-white border border-gray-100 lg:border-gray-200/70 rounded-lg lg:rounded-2xl shadow-md lg:shadow-sm lg:p-4 lg:hover:shadow-xl lg:hover:scale-105 lg:transition-all lg:duration-300 cursor-pointer lg:active:scale-95 flex-shrink-0 overflow-hidden">
                          <div className="w-full aspect-[9/16] lg:aspect-[9/16] bg-white border border-gray-200 rounded-lg lg:rounded-none overflow-hidden mb-2 lg:mb-3 relative">
                            {rawData[15] ? (
                              <img
                                src={convertToGoogleUserContent(rawData[15])}
                                alt={`Reel ${index + 1}`}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                  const fallback = target.nextElementSibling as HTMLElement;
                                  if (fallback) fallback.style.display = 'flex';
                                }}
                              />
                            ) : null}
                            <div className="w-full h-full bg-white border border-dashed border-gray-200 rounded-lg flex items-center justify-center text-gray-600 text-xs" style={{display: rawData[15] ? 'none' : 'flex'}}>
                              Reel {index + 1}
                            </div>
                          </div>

                          {/* モバイル版: 3つの指標 */}
                          <div className="lg:hidden px-2 py-2 space-y-1">
                            <p className="text-[11px] text-gray-500">{postedDate}</p>
                            <div className="flex items-center text-xs text-gray-900">
                              <span className="mr-1">👁️</span>
                              <span className="font-medium">{parseInt(String(sheetData[10] || '').replace(/,/g, '')).toLocaleString()}</span>
                            </div>
                            <div className="flex items-center text-xs text-gray-900">
                              <span className="mr-1">❤️</span>
                              <span className="font-medium">{parseInt(String(sheetData[13] || '').replace(/,/g, '')) || 0}</span>
                            </div>
                            <div className="flex items-center text-xs text-gray-900">
                              <span className="mr-1">💬</span>
                              <span className="font-medium">{parseInt(String(sheetData[14] || '').replace(/,/g, '')) || 0}</span>
                            </div>
                          </div>

                          <p className="text-gray-900 text-xs mb-3 font-medium line-clamp-2 lg:block hidden">{postedDate}</p>

                          {/* 再生数（大きく表示） - PC版のみ */}
                          <div className="mb-3 text-center hidden lg:block">
                            <p className="text-gray-500 text-xs mb-1">再生数</p>
                            <p className="text-xl lg:text-2xl font-bold text-gray-900">{parseInt(String(sheetData[10] || '').replace(/,/g, '')).toLocaleString()}</p>
                          </div>

                          {/* 4アイコン横一列表示 - PC版のみ */}
                          <div className="grid grid-cols-4 gap-4 hidden lg:grid">
                            <div className="flex flex-col items-center min-w-0">
                              <div className="h-5 w-5 text-red-500">❤️</div>
                              <span className="mt-1 text-sm font-semibold leading-none text-gray-900">
                                {(() => {
                                  const val = parseInt(String(sheetData[13] || '').replace(/,/g, '')) || 0;
                                  return val > 0 ? val.toLocaleString() : '';
                                })()}
                              </span>
                            </div>
                            <div className="flex flex-col items-center min-w-0">
                              <div className="h-5 w-5 text-blue-500">💬</div>
                              <span className="mt-1 text-sm font-semibold leading-none text-gray-900">
                                {(() => {
                                  const val = parseInt(String(sheetData[14] || '').replace(/,/g, '')) || 0;
                                  return val > 0 ? val.toLocaleString() : '';
                                })()}
                              </span>
                            </div>
                            <div className="flex flex-col items-center min-w-0">
                              <div className="h-5 w-5 text-amber-500">💾</div>
                              <span className="mt-1 text-sm font-semibold leading-none text-gray-900">
                                {(() => {
                                  const val = parseInt(String(sheetData[16] || '').replace(/,/g, '')) || 0;
                                  return val > 0 ? val.toLocaleString() : '';
                                })()}
                              </span>
                            </div>
                            <div className="flex flex-col items-center min-w-0">
                              <div className="h-5 w-5 text-purple-500">👤</div>
                              <span className="mt-1 text-sm font-semibold leading-none text-gray-900">
                                {(() => {
                                  const val = parseInt(String(sheetData[18] || '').replace(/,/g, '')) || 0;
                                  return val > 0 ? val.toLocaleString() : '';
                                })()}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    });
                  } else {
                    return <p className="text-gray-500 text-center col-span-full">データがありません</p>;
                  }
                })()}
              </div>
            </div>
          </div>

            {/* Top 5 Stories */}
          <div className="lg:px-0 sm:px-3 px-1">
            <div className="bg-white border border-gray-100 lg:border-gray-200/70 rounded-lg lg:rounded-2xl shadow-md lg:shadow-sm p-4 lg:p-6">
              {/* モバイル版ヘッダー */}
              <div className="lg:hidden flex justify-between items-center mb-4 px-2">
                <h3 className="text-lg font-bold text-gray-900 tracking-tight">
                  📖 Top3 ストーリー
                </h3>
                <button
                  onClick={() => {
                    setActiveTab('stories');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white px-2 py-1 rounded-lg text-sm font-medium shadow-sm transition-all duration-200"
                >
                  詳細
                </button>
              </div>
              {/* PC版ヘッダー */}
              <div className="hidden lg:flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-gray-900 tracking-tight">
                  📖 Top{window.innerWidth < 1024 ? '3' : '5'} ストーリー
                </h3>
                <button
                  onClick={() => {
                    setActiveTab('stories');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 shadow-sm"
                >
                  詳細 →
                </button>
              </div>
              <div className="w-full lg:grid lg:grid-cols-5 lg:gap-6 grid grid-cols-3 gap-2 px-1 sm:px-2 lg:px-0">
                {(() => {
                  const filteredStoriesProcessed = getFilteredData(data.storiesProcessed, 0, dateRange, { allowFallback: false });
                  if (filteredStoriesProcessed.length > 1) {
                    const topCount = window.innerWidth < 1024 ? 3 : 5;
                    const sortedStories = filteredStoriesProcessed.slice(1).sort((a, b) => {
                      const viewsA = parseInt(String(a[3] || '').replace(/,/g, '')) || 0; // storiesシート: D列（インデックス3）が閲覧数
                      const viewsB = parseInt(String(b[3] || '').replace(/,/g, '')) || 0;
                      return viewsB - viewsA;
                    }).slice(0, topCount);

                    return sortedStories.map((story, index) => (
                      <div key={index} className="w-full lg:w-full lg:min-w-0 bg-white border border-gray-100 lg:border-gray-200/70 rounded-lg lg:rounded-2xl shadow-md lg:shadow-sm lg:p-4 lg:hover:shadow-xl lg:hover:scale-105 lg:transition-all lg:duration-300 cursor-pointer lg:active:scale-95 flex-shrink-0 overflow-hidden">
                        <div className="w-full aspect-[9/16] lg:aspect-[9/16] bg-gray-600 rounded-lg lg:rounded-none overflow-hidden mb-2 lg:mb-3 relative">
                          {(() => {
                            const thumbnailUrl = toLh3(story[7] || ''); // storiesシート: H列（インデックス7）がサムネイル
                            return thumbnailUrl ? (
                              <img
                                src={thumbnailUrl}
                                alt={`Story ${index + 1}`}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  console.log('Story thumbnail load error:', thumbnailUrl);
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                  const fallback = target.nextElementSibling as HTMLElement;
                                  if (fallback) fallback.style.display = 'flex';
                                }}
                              />
                            ) : null;
                          })()}
                          <div className="w-full h-full bg-gray-600 rounded-lg flex items-center justify-center text-white text-xs" style={{display: toLh3(story[7] || '') ? 'none' : 'flex'}}>
                            <div className="text-center">
                              <div className="text-sm mb-1">📱</div>
                              <div>Story {index + 1}</div>
                              <div className="text-xs text-gray-400 mt-1">No thumbnail</div>
                            </div>
                          </div>
                        </div>

                        {/* モバイル版: 3つの指標 */}
                        <div className="lg:hidden px-2 py-2 space-y-1">
                          <div className="flex items-center text-xs text-gray-900">
                            <span className="mr-1">👁️</span>
                            <span className="font-medium">{parseInt(String(story[3] || '').replace(/,/g, '')).toLocaleString()}</span>
                          </div>
                          <div className="flex items-center text-xs text-gray-900">
                            <span className="mr-1">📊</span>
                            <span className="font-medium">{story[5] || '0%'}</span>
                          </div>
                          <div className="flex items-center text-xs text-gray-900">
                            <span className="mr-1">📱</span>
                            <span className="font-medium">{story[4] || 0}</span>
                          </div>
                        </div>

                        {/* PC版: 従来表示 */}
                        <div className="hidden lg:block">
                          {/* 投稿日 */}
                          <p className="text-gray-900 text-xs mb-2 font-medium">{story[0] || `ストーリー ${index + 1}`}</p>

                          {/* Views（大きく表示） */}
                          <div className="mb-3 text-center">
                            <p className="text-gray-500 text-xs mb-1">閲覧数</p>
                            <p className="text-xl lg:text-2xl font-bold text-gray-900">{parseInt(String(story[3] || '').replace(/,/g, '')).toLocaleString()}</p>
                          </div>

                          {/* KPIピル */}
                          <div className="flex flex-wrap gap-1">
                            <StatPill icon="💬" value={story[4] || 0} color="green" />
                            <StatPill icon="📈" value={story[5] || '0%'} color="purple" />
                          </div>
                        </div>
                      </div>
                    ));
                  } else {
                    return <p className="text-gray-500 text-center col-span-full">データがありません</p>;
                  }
                })()}
              </div>
            </div>
          </div>
        </div>
        )}

        {/* Reels Detail */}
        {activeTab === 'reels' && (
          <div className="space-y-6 lg:space-y-6 px-4 lg:px-0">
            {/* リール詳細上部グラフエリア */}
            <div className="bg-white border border-gray-200/70 rounded-2xl shadow-sm p-6">
              <div className="mb-6">
                <h3 className="text-xl font-bold text-gray-900 tracking-tight">リール パフォーマンス分析</h3>
              </div>

              {(() => {
                const joinedData = joinReelData(data.reelRawDataRaw, data.reelSheetRaw);
                const filteredJoinedData = filterJoinedReelData(joinedData, dateRange);

                // メインダッシュボードと同じフォロワー増加数計算
                const filteredDailyData = getFilteredDailyData(data.dailyRaw, dateRange.preset);

                // 今日の日付を取得（JST基準）
                const today = new Date();
                const todayJST = new Date(today.getFullYear(), today.getMonth(), today.getDate());

                // 今日のデータを除外（昨日まで）
                const dailyChartData = filteredDailyData.data ? filteredDailyData.data.filter(row => {
                  const dateStr = String(row[0] || '').trim();
                  const date = parseDate(dateStr);
                  if (!date) return false;

                  const rowDateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
                  return rowDateOnly < todayJST; // 今日より前の日付のみ
                }) : [];

                // フォロワー増加数を計算
                const followerGrowthData = {};
                dailyChartData.forEach((row) => {
                  const dateStr = String(row[0] || '').trim();
                  const date = parseDate(dateStr);
                  if (date) {
                    const dateKey = date.toISOString().split('T')[0];
                    const followerGrowth = parseInt(String(row[2] || '').replace(/,/g, '')) || 0;

                    followerGrowthData[dateKey] = followerGrowth;
                  }
                });

                // 選択期間内の日付範囲でdailyReelDataを初期化
                const normalizeStart = (input: Date) => {
                  const d = new Date(input);
                  d.setHours(0, 0, 0, 0);
                  return d;
                };
                const normalizeEnd = (input: Date) => {
                  const d = new Date(input);
                  d.setHours(23, 59, 59, 999);
                  return d;
                };

                let rangeStart = normalizeStart(dateRange.start);
                let rangeEnd = normalizeEnd(dateRange.end);

                if (rangeStart > rangeEnd) {
                  const tmp = rangeStart;
                  rangeStart = rangeEnd;
                  rangeEnd = tmp;
                }

                const dailyReelData = {};
                for (let d = new Date(rangeStart); d <= rangeEnd; d.setDate(d.getDate() + 1)) {
                  const dateKey = d.toISOString().split('T')[0];
                  dailyReelData[dateKey] = {
                    date: d.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' }),
                    投稿数: 0,
                    総再生数: 0,
                    総いいね数: 0,
                    平均エンゲージメント率: 0,
                    フォロワー増加数: followerGrowthData[dateKey] || 0
                  };
                }

                // リールデータを期間内の日付に集計
                filteredJoinedData.forEach(item => {
                  const dateStr = String(item.rawData[5] || '').trim();
                  const date = parseDate(dateStr);
                  if (date) {
                    const dateKey = date.toISOString().split('T')[0];
                    // 期間内の日付のみ処理
                    if (dailyReelData[dateKey]) {
                      dailyReelData[dateKey].投稿数 += 1;
                      const views = parseInt(String(item.rawData[6] || '').replace(/,/g, '')) || 0;
                      dailyReelData[dateKey].総再生数 += views;
                      const likes = parseInt(String(item.rawData[9] || '').replace(/,/g, '')) || 0;
                      dailyReelData[dateKey].総いいね数 += likes;

                      const interactions = parseInt(String(item.rawData[8] || '').replace(/,/g, '')) || 0;
                      const reachValue = parseInt(String(item.rawData[7] || '').replace(/,/g, '')) || 0;
                      const engagementRate = reachValue > 0 ? (interactions / reachValue) * 100 : 0;
                      dailyReelData[dateKey].平均エンゲージメント率 += engagementRate;
                    }
                  }
                });

                // 平均エンゲージメント率を計算
                Object.keys(dailyReelData).forEach(key => {
                  if (dailyReelData[key].投稿数 > 0) {
                    dailyReelData[key].平均エンゲージメント率 =
                      dailyReelData[key].平均エンゲージメント率 / dailyReelData[key].投稿数;
                  }
                });

                const chartData = Object.keys(dailyReelData)
                  .sort()  // 日付キー（YYYY-MM-DD形式）で昇順ソート
                  .map(key => dailyReelData[key]);

                return chartData.length > 0 ? (
                  <div className="h-72 lg:h-80 md:h-64 sm:h-60 lg:px-0 sm:px-1 px-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart
                        data={chartData}
                        margin={isMobile ? { top: 8, right: 12, left: 12, bottom: 6 } : { top: 12, right: 20, left: 24, bottom: 12 }}
                      >
                        <CartesianGrid
                          strokeDasharray={isMobile ? '2 2' : '3 3'}
                          stroke={isMobile ? '#E5E7EB' : '#E5E7EB'}
                          horizontal
                          vertical={false}
                          strokeOpacity={isMobile ? 0.6 : 1}
                        />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: isMobile ? 10 : 14, fill: '#6B7280' }}
                          axisLine={{ stroke: '#D1D5DB', strokeWidth: 1 }}
                          tickLine={{ stroke: '#D1D5DB', strokeWidth: 1 }}
                        />
                        <YAxis
                          yAxisId="left"
                          orientation="left"
                          axisLine={{ stroke: '#D1D5DB', strokeWidth: 1 }}
                          tickLine={{ stroke: '#D1D5DB', strokeWidth: 1 }}
                          tick={{ fontSize: isMobile ? 10 : 14, fill: '#E11D48' }}
                          className=""
                          tickFormatter={(value) => value.toLocaleString()}
                          width={isMobile ? 38 : 60}
                        />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          axisLine={{ stroke: '#D1D5DB', strokeWidth: 1 }}
                          tickLine={{ stroke: '#D1D5DB', strokeWidth: 1 }}
                          tick={{ fontSize: isMobile ? 10 : 14, fill: '#10B981' }}
                          className=""
                          tickFormatter={(value) => value.toString()}
                          width={isMobile ? 32 : 56}
                        />
                        <Tooltip
                          formatter={(value, name) => [value.toLocaleString(), name]}
                          labelStyle={{ color: '#111827', fontSize: isMobile ? '10px' : '14px' }}
                          contentStyle={{
                            backgroundColor: isMobile ? '#FFFFFF' : 'var(--card-background)',
                            border: `1px solid ${isMobile ? '#E0E0E0' : 'var(--border-color)'}`,
                            borderRadius: isMobile ? '6px' : '8px',
                            boxShadow: isMobile ? '0 2px 6px rgba(15, 23, 42, 0.12)' : '0 6px 12px -1px rgba(15, 23, 42, 0.15)',
                            color: isMobile ? '#111827' : 'var(--text-primary)',
                            padding: isMobile ? '6px 8px' : '8px 12px',
                            fontSize: isMobile ? '10px' : '14px',
                            minWidth: isMobile ? 'auto' : undefined,
                            maxWidth: isMobile ? '120px' : undefined
                          }}
                          cursor={{ stroke: '#E11D48', strokeWidth: 1, strokeDasharray: '4 4' }}
                          offset={isMobile ? 8 : 12}
                          allowEscapeViewBox={{ x: false, y: true }}
                        />
                        <Legend
                          wrapperStyle={{
                            fontSize: isMobile ? '10px' : '12px',
                            marginTop: isMobile ? '4px' : '8px',
                            lineHeight: isMobile ? '12px' : '16px',
                            display: 'block',
                            textAlign: 'center'
                          }}
                          iconSize={isMobile ? 10 : 14}
                        />
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="総再生数"
                          stroke="#E11D48"
                          strokeWidth={isMobile ? 2 : 3}
                          dot={isMobile ? {
                            r: 3,
                            stroke: '#FFFFFF',
                            strokeWidth: 1.5,
                            fill: '#E11D48'
                          } : {
                            fill: '#E11D48',
                            strokeWidth: 2,
                            r: 4
                          }}
                          activeDot={{
                            r: isMobile ? 5 : 6,
                            stroke: '#E11D48',
                            strokeWidth: 2,
                            fill: '#FFFFFF'
                          }}
                        />
                        <Bar
                          yAxisId="right"
                          dataKey="フォロワー増加数"
                          fill="#10B981"
                          radius={[2, 2, 0, 0]}
                          opacity={0.7}
                          maxBarSize={isMobile ? 18 : 40}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center text-gray-500">
                    期間内にリールデータがありません
                  </div>
                );
              })()}
            </div>

            <div className="bg-white border border-gray-200/70 rounded-2xl shadow-sm p-6">
              {/* Header with count */}
              <div className={`${window.innerWidth < 768 ? 'mb-3' : 'flex justify-between items-center mb-4'}`}>
                <h3 className="text-xl font-semibold text-gray-900">リール詳細 ({(() => {
                  const joinedReelData = joinReelData(data.reelRawDataRaw, data.reelSheetRaw);
                  const filteredJoinedData = filterJoinedReelData(joinedReelData, dateRange);
                  return filteredJoinedData.length;
                })()}件)</h3>

                {/* Sort Controls - PC版のみ横並び */}
                {window.innerWidth >= 768 && (
                  <div className="flex items-center space-x-3">
                    <span className="text-gray-900 text-sm">並び替え:</span>
                    <select
                      value={reelSortBy}
                      onChange={(e) => setReelSortBy(e.target.value)}
                      className="rounded-md border border-gray-300 bg-white text-gray-700 shadow-sm px-3 py-2 text-sm focus:ring-2 focus:ring-purple-200 focus:border-purple-400 transition-all duration-200"
                    >
                      <option value="date">投稿日</option>
                      <option value="views">再生数</option>
                      <option value="likes">いいね</option>
                      <option value="saves">保存数</option>
                      <option value="follows">フォロー数</option>
                      <option value="comments">コメント</option>
                    </select>
                    <button
                      onClick={() => setReelSortOrder(reelSortOrder === 'desc' ? 'asc' : 'desc')}
                      className="rounded-md border border-gray-300 bg-white text-gray-700 shadow-sm px-3 py-2 text-sm hover:bg-gray-50 focus:ring-2 focus:ring-purple-200 focus:border-purple-400 transition-all duration-200"
                      title={reelSortOrder === 'desc' ? '降順 (高い順/新しい順)' : '昇順 (低い順/古い順)'}
                    >
                      {reelSortOrder === 'desc' ? '↓' : '↑'}
                    </button>
                  </div>
                )}
              </div>

              {/* Sort Controls - モバイル版のみ縦並び */}
              {window.innerWidth < 768 && (
                <div className="flex items-center justify-end mb-4">
                  <span className="text-gray-900 text-sm mr-3">並び替え:</span>
                  <div className="flex items-center space-x-3">
                    <select
                      value={reelSortBy}
                      onChange={(e) => setReelSortBy(e.target.value)}
                      className="rounded-md border border-gray-300 bg-white text-gray-700 shadow-sm px-3 py-2 text-sm focus:ring-2 focus:ring-purple-200 focus:border-purple-400 transition-all duration-200"
                    >
                      <option value="date">投稿日</option>
                      <option value="views">再生数</option>
                      <option value="likes">いいね</option>
                      <option value="saves">保存数</option>
                      <option value="follows">フォロー数</option>
                      <option value="comments">コメント</option>
                    </select>
                    <button
                      onClick={() => setReelSortOrder(reelSortOrder === 'desc' ? 'asc' : 'desc')}
                      className="rounded-md border border-gray-300 bg-white text-gray-700 shadow-sm px-3 py-2 text-sm hover:bg-gray-50 focus:ring-2 focus:ring-purple-200 focus:border-purple-400 transition-all duration-200"
                      title={reelSortOrder === 'desc' ? '降順 (高い順/新しい順)' : '昇順 (低い順/古い順)'}
                    >
                      {reelSortOrder === 'desc' ? '↓' : '↑'}
                    </button>
                  </div>
                </div>
              )}

              <div className="w-full grid lg:grid-cols-4 md:grid-cols-2 grid-cols-1 gap-3 lg:gap-4">
                {(() => {
                  const joinedData = joinReelData(data.reelRawDataRaw, data.reelSheetRaw);
                  const filteredJoinedData = filterJoinedReelData(joinedData, dateRange);

                  // ソート機能
                  const sortedData = filteredJoinedData.sort((a, b) => {
                    const rawDataA = a.rawData;
                    const rawDataB = b.rawData;
                    const sheetDataA = a.sheetData;
                    const sheetDataB = b.sheetData;

                    let result = 0;

                    switch (reelSortBy) {
                      case 'date':
                        const dateA = new Date(rawDataA[5] || '');
                        const dateB = new Date(rawDataB[5] || '');
                        result = dateB.getTime() - dateA.getTime();
                        break;
                      case 'views':
                        const viewsA = parseInt(String(rawDataA[6] || '').replace(/,/g, '')) || 0;
                        const viewsB = parseInt(String(rawDataB[6] || '').replace(/,/g, '')) || 0;
                        result = viewsB - viewsA;
                        break;
                      case 'likes':
                        const likesA = parseInt(String(rawDataA[8] || '').replace(/,/g, '')) || 0;
                        const likesB = parseInt(String(rawDataB[8] || '').replace(/,/g, '')) || 0;
                        result = likesB - likesA;
                        break;
                      case 'saves':
                        const savesA = parseInt(String(rawDataA[10] || '').replace(/,/g, '')) || 0;
                        const savesB = parseInt(String(rawDataB[10] || '').replace(/,/g, '')) || 0;
                        result = savesB - savesA;
                        break;
                      case 'follows':
                        const followsA = parseInt(String(sheetDataA[18] || '').replace(/,/g, '')) || 0;
                        const followsB = parseInt(String(sheetDataB[18] || '').replace(/,/g, '')) || 0;
                        result = followsB - followsA;
                        break;
                      case 'comments':
                        const commentsA = parseInt(String(rawDataA[9] || '').replace(/,/g, '')) || 0;
                        const commentsB = parseInt(String(rawDataB[9] || '').replace(/,/g, '')) || 0;
                        result = commentsB - commentsA;
                        break;
                      default:
                        result = 0;
                    }

                    // 昇順の場合は結果を反転
                    return reelSortOrder === 'asc' ? -result : result;
                  });

                  return sortedData && sortedData.length > 0 ? (
                    sortedData.map((item, index) => {
                      const rawData = item.rawData;
                      const sheetData = item.sheetData;
                      const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

                      const formatDate = (dateStr: string): string => {
                        if (!dateStr) return '';
                        try {
                          const date = new Date(dateStr);
                          if (isNaN(date.getTime())) return '';
                          return date.toLocaleDateString('ja-JP', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit'
                          }).replace(/\//g, '/');
                        } catch {
                          return '';
                        }
                      };

                      const safeParseInt = (value: unknown): number => {
                        const parsed = parseInt(String(value || '0').replace(/,/g, ''));
                        return isNaN(parsed) ? 0 : parsed;
                      };

                      const safeParseFloat = (value: unknown): number => {
                        const parsed = parseFloat(String(value || '0').replace('%', ''));
                        return isNaN(parsed) ? 0 : parsed;
                      };

                      // Extract data according to requirements - Reelsシート参照
                      const title = sheetData[4] || `リール ${index + 1}`; // E列（インデックス4）投稿内容
                      const likes = safeParseInt(sheetData[13]); // N列（インデックス13）いいね数
                      const comments = safeParseInt(sheetData[14]); // O列（インデックス14）コメント数
                      const saves = safeParseInt(sheetData[16]); // Q列（インデックス16）保存数
                      const follows = safeParseInt(sheetData[18]); // S列（インデックス18）フォロー数
                      const views = safeParseInt(sheetData[10]); // K列（インデックス10）閲覧数
                      const duration = safeParseInt(sheetData[6]); // G列（インデックス6）リール長さ(秒)
                      const viewRate = safeParseFloat(sheetData[9]); // J列（インデックス9）平均視聴維持率
                      const postedAt = sheetData[0]; // A列（インデックス0）投稿日

                      const formattedDate = formatDate(postedAt);
                      const totalWatchSecondsFromSheet = parseDurationValueToSeconds(sheetData[7]);
                      const totalWatchSecondsFromRaw = parseDurationValueToSeconds(rawData[13]);
                      const totalWatchSeconds =
                        totalWatchSecondsFromSheet || totalWatchSecondsFromRaw || (views && duration ? views * duration : 0);
                      const totalWatchTime = totalWatchSeconds ? formatSecondsToHms(totalWatchSeconds) : '';

                      return (
                        <div
                          key={index}
                          className={`rounded-2xl hover:shadow-xl hover:scale-105 transition-all duration-300 cursor-pointer active:scale-95 border border-gray-200/70 ${
                            isMobile ? 'flex items-center space-x-4 p-3 bg-white text-gray-900 shadow-sm' : 'p-4 bg-white'
                          }`}
                        >
                          {/* サムネイル */}
                          <div className={`bg-gray-200 rounded-xl overflow-hidden ${isMobile ? 'w-20 flex-shrink-0 aspect-[9/16]' : 'w-full aspect-[9/16] mb-3'}`}>
                            {rawData[15] ? (
                              <img
                                src={convertToGoogleUserContent(rawData[15])}
                                alt={title}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                  const fallback = target.nextElementSibling as HTMLElement;
                                  if (fallback) fallback.style.display = 'flex';
                                }}
                              />
                            ) : null}
                            <div className="w-full h-full bg-gray-100 rounded-xl flex items-center justify-center text-gray-500 text-xs" style={{display: rawData[15] ? 'none' : 'flex'}}>
                              {title}
                            </div>
                          </div>

                          {/* コンテンツエリア（モバイル時は右側、PC時は通常位置） */}
                            <div className={`${isMobile ? 'flex-1 min-w-0 text-gray-900' : 'mb-3'}`}>
                            <h4
                              className={`${isMobile ? 'text-gray-900' : 'text-gray-900'} font-semibold leading-tight mb-1 ${isMobile ? 'text-sm mb-2' : 'text-sm'}`}
                              title={title}
                              style={{
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden'
                              }}
                            >
                              {title}
                            </h4>
                            {formattedDate && (
                              <p className={`${isMobile ? 'text-gray-500' : 'text-gray-500'} mb-2 ${isMobile ? 'text-sm' : 'text-xs'}`}>
                                投稿日: {formattedDate}
                              </p>
                            )}
                            {isMobile && (
                              <div className="flex items-center space-x-3 text-xs text-gray-600">
                                <span>👁️ {views.toLocaleString()}</span>
                                <span>❤️ {likes.toLocaleString()}</span>
                                <span>💬 {comments.toLocaleString()}</span>
                              </div>
                            )}
                            {!isMobile && (
                              <>
                                <div className="mb-3 text-center">
                                  <p className="text-gray-500 text-xs mb-1">再生数</p>
                                  <p className="text-lg font-bold text-gray-900">{views.toLocaleString()}</p>
                                </div>
                                <div className="grid grid-cols-4 gap-6 mb-3">
                                  <div className="flex flex-col items-center">
                                    <div className="h-5 w-5 text-red-500">❤️</div>
                                    <span className="mt-1 text-sm font-semibold text-gray-900" aria-label={`いいね ${likes}`}>
                                      {likes > 0 ? likes.toLocaleString() : ''}
                                    </span>
                                  </div>
                                  <div className="flex flex-col items-center">
                                    <div className="h-5 w-5 text-blue-500">💬</div>
                                    <span className="mt-1 text-sm font-semibold text-gray-900" aria-label={`コメント ${comments}`}>
                                      {comments > 0 ? comments.toLocaleString() : ''}
                                    </span>
                                  </div>
                                  <div className="flex flex-col items-center">
                                    <div className="h-5 w-5 text-amber-500">💾</div>
                                    <span className="mt-1 text-sm font-semibold text-gray-900" aria-label={`保存 ${saves}`}>
                                      {saves > 0 ? saves.toLocaleString() : ''}
                                    </span>
                                  </div>
                                  <div className="flex flex-col items-center">
                                    <div className="h-5 w-5 text-purple-500">👤</div>
                                    <span className="mt-1 text-sm font-semibold text-gray-900" aria-label={`フォロー ${follows}`}>
                                      {follows > 0 ? follows.toLocaleString() : ''}
                                    </span>
                                  </div>
                                </div>
                              </>
                            )}

                            {/* 概要（PC版のみ） */}
                            {window.innerWidth >= 768 && (views > 0 || totalWatchTime || viewRate > 0) && (
                              <div className="mt-2">
                                <h5 className="text-gray-500 text-xs font-medium mb-2">概要</h5>
                                <div className="space-y-1 text-xs">
                                  {totalWatchTime && (
                                    <div className="flex justify-between">
                                      <span className="text-gray-500">合計再生時間</span>
                                      <span className="text-gray-900 font-bold">{totalWatchTime}</span>
                                    </div>
                                  )}
                                  {viewRate > 0 && (
                                    <div className="flex justify-between">
                                      <span className="text-gray-500">視聴率</span>
                                      <span className="text-gray-900 font-bold">{viewRate.toFixed(1)}%</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>

                        </div>
                      );
                    })
                  ) : (
                    <p className="text-gray-500 text-center col-span-full">データがありません</p>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* Stories Detail */}
        {activeTab === 'stories' && (
          <div className="space-y-6 lg:space-y-6 px-4 lg:px-0">
            {/* ストーリー詳細上部グラフエリア */}
            <div className="bg-white border border-gray-200/70 rounded-2xl shadow-sm p-6">
              <div className="mb-6">
                <h3 className="text-xl font-bold text-gray-900 tracking-tight">ストーリー パフォーマンス分析</h3>
              </div>

                  {(() => {
                    const filteredStoriesRaw = getFilteredData(data.storiesProcessed || [], 0, dateRange, { allowFallback: false });

                    console.log('=== ストーリーパフォーマンス分析デバッグ ===');
                    console.log('data.storiesProcessed?.length:', data.storiesProcessed?.length);
                    console.log('filteredStoriesRaw.length:', filteredStoriesRaw.length);
                    console.log('filteredStoriesRaw 最初の3行:', filteredStoriesRaw.slice(0, 3));
                    console.log('dateRange:', dateRange);

                    if (filteredStoriesRaw.length <= 1) {
                      return (
                        <div className="h-48 flex items-center justify-center text-gray-500">
                          期間内にストーリーデータがありません
                        </div>
                      );
                    }

                    // 日別データを集計（storiesシート構造に対応）
                    const dailyStoryData = {};
                    console.log('=== データ処理開始 ===');
                    filteredStoriesRaw.slice(1).forEach((story, index) => {
                      const dateStr = String(story[0] || '').trim(); // storiesシート: A列（インデックス0）が投稿日
                      console.log(`[${index}] 日付文字列: "${dateStr}", story:`, story.slice(0, 8));
                      const date = parseDate(dateStr);
                      if (date) {
                        console.log(`日付解析成功: ${date.toISOString()}`);
                        // ローカル日付の開始時刻で統一
                        const localDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
                        const dateKey = localDate.toISOString().split('T')[0];
                        if (!dailyStoryData[dateKey]) {
                          dailyStoryData[dateKey] = {
                            date: localDate.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' }),
                            投稿数: 0,
                            最高閲覧率: 0
                          };
                        }
                        // 新構造: 各行が1つのストーリーなので投稿数は1ずつ増加
                        dailyStoryData[dateKey].投稿数 += 1;

                        // 閲覧率はF列（インデックス5）の値を直接使用
                        const viewRateStr = String(story[5] || '').replace(/%/g, '');
                        const viewRate = parseFloat(viewRateStr) || 0;
                        console.log(`閲覧率: "${story[5]}" → ${viewRate}%`);
                        // 最大値を更新
                        if (viewRate > dailyStoryData[dateKey].最高閲覧率) {
                          dailyStoryData[dateKey].最高閲覧率 = viewRate;
                        }
                      } else {
                        console.log(`日付解析失敗: "${dateStr}"`);
                      }
                    });

                    // データ欠損日の0埋め処理
                    if (Object.keys(dailyStoryData).length > 0) {
                      const dates = Object.keys(dailyStoryData).sort();
                      const startDate = new Date(dates[0]);
                      const endDate = new Date(dates[dates.length - 1]);

                      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
                        const localDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
                        const dateKey = localDate.toISOString().split('T')[0];
                        if (!dailyStoryData[dateKey]) {
                          dailyStoryData[dateKey] = {
                            date: localDate.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' }),
                            投稿数: 0,
                            最高閲覧率: 0
                          };
                        }
                      }
                    }

                    console.log('=== 最終データ集計結果 ===');
                    console.log('dailyStoryData:', dailyStoryData);

                    // 統合チャートデータを作成
                    const chartData = Object.keys(dailyStoryData)
                      .sort()
                      .map(key => ({
                        date: dailyStoryData[key].date,
                        投稿数: dailyStoryData[key].投稿数,
                        最高閲覧率: dailyStoryData[key].最高閲覧率
                      }));

                    console.log('chartData:', chartData);
                    console.log('chartData.length:', chartData.length);
                    console.log('has data?', chartData.some(d => d.投稿数 > 0 || d.最高閲覧率 > 0));

                    // 動的軸スケール用の最大値・最小値を計算
                    const viewRates = chartData.map(d => d.最高閲覧率).filter(v => v > 0);
                    const postCounts = chartData.map(d => d.投稿数).filter(v => v > 0);

                    const viewRateMax = viewRates.length > 0 ? Math.max(...viewRates) : 40;
                    const viewRateMin = viewRates.length > 0 ? Math.min(...viewRates) : 0;
                    const postCountMax = postCounts.length > 0 ? Math.max(...postCounts) : 4;
                    const postCountMin = postCounts.length > 0 ? Math.min(...postCounts) : 0;

                    // 軸の範囲を少し余裕を持たせて調整
                    const viewRateDomain = [
                      Math.max(0, Math.floor(viewRateMin * 0.9)),
                      Math.ceil(viewRateMax * 1.1)
                    ];
                    const postCountDomain = [
                      Math.max(0, Math.floor(postCountMin * 0.9)),
                      Math.ceil(postCountMax * 1.1)
                    ];

                    console.log('Dynamic axis ranges:', {
                      viewRateDomain,
                      postCountDomain,
                      viewRateMax,
                      postCountMax
                    });

                    return chartData.length > 0 && chartData.some(d => d.投稿数 > 0 || d.最高閲覧率 > 0) ? (
                      <div className="h-80 lg:h-80 md:h-64 sm:h-56 lg:px-0 sm:px-1 px-0">
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart
                            data={chartData}
                            margin={isMobile ? { top: 8, right: 12, left: 12, bottom: 6 } : { top: 12, right: 20, left: 24, bottom: 12 }}
                          >
                            <CartesianGrid
                              strokeDasharray={isMobile ? '2 2' : '3 3'}
                              stroke={isMobile ? '#E5E7EB' : 'var(--chart-grid)'}
                              horizontal
                              vertical={false}
                              strokeOpacity={isMobile ? 0.6 : 1}
                            />
                            <XAxis
                              dataKey="date"
                              tick={{ fontSize: isMobile ? 10 : 14, fill: 'var(--chart-axis)' }}
                              axisLine={{ stroke: '#D1D5DB', strokeWidth: 1 }}
                              tickLine={{ stroke: '#D1D5DB', strokeWidth: 1 }}
                            />
                            {/* 左Y軸：閲覧率（動的スケール） */}
                            <YAxis
                              yAxisId="left"
                              domain={viewRateDomain}
                              axisLine={{ stroke: '#D1D5DB', strokeWidth: 1 }}
                              tickLine={{ stroke: '#D1D5DB', strokeWidth: 1 }}
                              tick={{ fontSize: isMobile ? 10 : 14, fill: '#F59E0B' }}
                              className=""
                              tickFormatter={(value) => `${value}%`}
                              width={isMobile ? 38 : 60}
                            />
                            {/* 右Y軸：投稿数（動的スケール） */}
                            <YAxis
                              yAxisId="right"
                              orientation="right"
                              domain={postCountDomain}
                              axisLine={{ stroke: '#D1D5DB', strokeWidth: 1 }}
                              tickLine={{ stroke: '#D1D5DB', strokeWidth: 1 }}
                              tick={{ fontSize: isMobile ? 10 : 14, fill: '#8B5CF6' }}
                              className=""
                              tickFormatter={(value) => value.toString()}
                              width={isMobile ? 32 : 56}
                            />
                            <Tooltip
                              formatter={(value, name) => {
                                if (name === '最高閲覧率') {
                                  return [`${Number(value).toFixed(1)}%`, name];
                                }
                                return [value.toLocaleString(), name];
                              }}
                              labelStyle={{ color: 'var(--text-primary)', fontSize: isMobile ? '10px' : '14px' }}
                              contentStyle={{
                                backgroundColor: isMobile ? '#FFFFFF' : 'var(--card-background)',
                                border: `1px solid ${isMobile ? '#E0E0E0' : 'var(--border-color)'}`,
                                borderRadius: isMobile ? '6px' : '8px',
                                boxShadow: isMobile ? '0 2px 6px rgba(15, 23, 42, 0.12)' : '0 6px 12px -1px rgba(15, 23, 42, 0.15)',
                                color: isMobile ? '#111827' : 'var(--text-primary)',
                                padding: isMobile ? '6px 8px' : '8px 12px',
                                fontSize: isMobile ? '10px' : '14px',
                                minWidth: isMobile ? 'auto' : undefined,
                                maxWidth: isMobile ? '120px' : undefined
                              }}
                              cursor={{ stroke: '#F59E0B', strokeWidth: 1, strokeDasharray: '4 4' }}
                              offset={isMobile ? 8 : 12}
                              allowEscapeViewBox={{ x: false, y: true }}
                            />
                            <Legend
                              wrapperStyle={{
                                fontSize: isMobile ? '10px' : '12px',
                                marginTop: isMobile ? '4px' : '8px',
                                lineHeight: isMobile ? '12px' : '16px',
                                display: 'block',
                                textAlign: 'center'
                              }}
                              iconSize={isMobile ? 10 : 14}
                            />
                            {/* 20%基準線（点線） */}
                            <ReferenceLine
                              yAxisId="left"
                              y={20}
                              stroke="#DC2626"
                              strokeDasharray="5 5"
                              strokeWidth={2}
                            />
                            {/* 投稿数（棒グラフ、右Y軸） */}
                            <Bar
                              yAxisId="right"
                              dataKey="投稿数"
                              fill="#8B5CF6"
                              radius={[2, 2, 0, 0]}
                              opacity={0.7}
                              maxBarSize={isMobile ? 18 : 40}
                            />
                            {/* 閲覧率（折れ線グラフ、左Y軸） */}
                            <Line
                              yAxisId="left"
                              type="monotone"
                              dataKey="最高閲覧率"
                              stroke="#F59E0B"
                              strokeWidth={isMobile ? 2 : 3}
                              dot={isMobile ? {
                                r: 3,
                                stroke: '#FFFFFF',
                                strokeWidth: 1.5,
                                fill: '#F59E0B'
                              } : {
                                fill: '#F59E0B',
                                strokeWidth: 2,
                                r: 4
                              }}
                              activeDot={{
                                r: isMobile ? 5 : 6,
                                stroke: '#F59E0B',
                                strokeWidth: 2,
                                fill: '#FFFFFF'
                              }}
                            />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="h-48 flex items-center justify-center text-gray-500">
                        期間内にストーリーデータがありません
                      </div>
                    );
                  })()}
                </div>

            <div className="bg-white border border-gray-200/70 rounded-2xl shadow-sm p-6">
              {/* Header with count */}
              <div className={`${window.innerWidth < 768 ? 'mb-3' : 'flex justify-between items-center mb-4'}`}>
                <h3 className="text-xl font-semibold text-gray-900">ストーリー詳細 ({summary.totalStories}件)</h3>

                {/* Sort Controls - PC版のみ横並び */}
                {window.innerWidth >= 768 && (
                  <div className="flex items-center space-x-3">
                    <span className="text-gray-900 text-sm">並び替え:</span>
                    <select
                      value={storySortBy}
                      onChange={(e) => setStorySortBy(e.target.value)}
                      className="rounded-md border border-gray-300 bg-white text-gray-700 shadow-sm px-3 py-2 text-sm focus:ring-2 focus:ring-purple-200 focus:border-purple-400 transition-all duration-200"
                    >
                      <option value="date">投稿日</option>
                      <option value="views">閲覧数</option>
                      <option value="viewRate">閲覧率</option>
                      <option value="reactions">反応数</option>
                    </select>
                    <button
                      onClick={() => setStorySortOrder(storySortOrder === 'desc' ? 'asc' : 'desc')}
                      className="rounded-md border border-gray-300 bg-white text-gray-700 shadow-sm px-3 py-2 text-sm hover:bg-gray-50 focus:ring-2 focus:ring-purple-200 focus:border-purple-400 transition-all duration-200"
                      title={storySortOrder === 'desc' ? '降順 (高い順/新しい順)' : '昇順 (低い順/古い順)'}
                    >
                      {storySortOrder === 'desc' ? '↓' : '↑'}
                    </button>
                  </div>
                )}
              </div>

              {/* Sort Controls - モバイル版のみ縦並び */}
              {window.innerWidth < 768 && (
                <div className="flex items-center justify-end mb-4">
                  <span className="text-gray-900 text-sm mr-3">並び替え:</span>
                  <div className="flex items-center space-x-3">
                    <select
                      value={storySortBy}
                      onChange={(e) => setStorySortBy(e.target.value)}
                      className="rounded-md border border-gray-300 bg-white text-gray-700 shadow-sm px-3 py-2 text-sm focus:ring-2 focus:ring-purple-200 focus:border-purple-400 transition-all duration-200"
                    >
                      <option value="date">投稿日</option>
                      <option value="views">閲覧数</option>
                      <option value="viewRate">閲覧率</option>
                      <option value="reactions">反応数</option>
                    </select>
                    <button
                      onClick={() => setStorySortOrder(storySortOrder === 'desc' ? 'asc' : 'desc')}
                      className="rounded-md border border-gray-300 bg-white text-gray-700 shadow-sm px-3 py-2 text-sm hover:bg-gray-50 focus:ring-2 focus:ring-purple-200 focus:border-purple-400 transition-all duration-200"
                      title={storySortOrder === 'desc' ? '降順 (高い順/新しい順)' : '昇順 (低い順/古い順)'}
                    >
                      {storySortOrder === 'desc' ? '↓' : '↑'}
                    </button>
                  </div>
                </div>
              )}

              <div className="w-full grid lg:grid-cols-4 md:grid-cols-2 grid-cols-1 gap-4 lg:gap-6">
                {(() => {
                  const filteredStoriesProcessed = getFilteredData(data.storiesProcessed, 0, dateRange, { allowFallback: false });

                  if (!filteredStoriesProcessed || filteredStoriesProcessed.length <= 1) {
                    return <p className="text-gray-500 text-center col-span-full">データがありません</p>;
                  }

                  // ソート機能
                  const storyData = filteredStoriesProcessed.slice(1);
                  const sortedStories = storyData.sort((a, b) => {
                    let result = 0;

                    switch (storySortBy) {
                      case 'date':
                        const dateA = new Date(a[0] || ''); // storiesシート: A列（インデックス0）が投稿日
                        const dateB = new Date(b[0] || '');
                        result = dateB.getTime() - dateA.getTime();
                        break;
                      case 'views':
                        const viewsA = parseInt(String(a[3] || '').replace(/,/g, '')) || 0; // storiesシート: D列（インデックス3）が閲覧数
                        const viewsB = parseInt(String(b[3] || '').replace(/,/g, '')) || 0;
                        result = viewsB - viewsA;
                        break;
                      case 'viewRate':
                        const viewRateA = parseFloat(String(a[5] || '').replace(/%/g, '')) || 0; // storiesシート: F列（インデックス5）が閲覧率
                        const viewRateB = parseFloat(String(b[5] || '').replace(/%/g, '')) || 0;
                        result = viewRateB - viewRateA;
                        break;
                      case 'reactions':
                        const reactionsA = parseInt(String(a[6] || '').replace(/,/g, '')) || 0; // storiesシート: G列（インデックス6）がストーリー画面（インタラクション数）
                        const reactionsB = parseInt(String(b[6] || '').replace(/,/g, '')) || 0;
                        result = reactionsB - reactionsA;
                        break;
                      default:
                        return 0;
                    }

                    // 昇順の場合は結果を反転
                    return storySortOrder === 'asc' ? -result : result;
                  });

                  return sortedStories.length > 0 ? (
                    sortedStories.map((story, index) => {
                      const mobileViews = parseInt(String(story[3] || '').replace(/,/g, '')) || 0;
                      const mobileViewRate = String(story[5] || '0%');
                      const mobileComments = parseInt(String(story[4] || '').replace(/,/g, '')) || 0;

                      return (
                      <div key={index} className={`bg-white border border-gray-200/70 rounded-lg hover:shadow-xl hover:scale-105 transition-all duration-300 cursor-pointer active:scale-95 ${window.innerWidth < 768 ? 'flex items-center space-x-4 p-3' : 'text-center p-4'}`}>
                        <div className={`bg-gray-600 rounded-lg overflow-hidden ${window.innerWidth < 768 ? 'w-20 flex-shrink-0 aspect-[9/16]' : 'w-full aspect-[9/16] mb-3'}`}>
                          {(() => {
                            const thumbnailUrl = toLh3(story[7] || ''); // storiesシート: H列（インデックス7）がサムネイル
                            return thumbnailUrl ? (
                              <img
                                src={thumbnailUrl}
                                alt={`Story ${index + 1}`}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  console.log('Story thumbnail load error:', thumbnailUrl);
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                  const fallback = target.nextElementSibling as HTMLElement;
                                  if (fallback) fallback.style.display = 'flex';
                                }}
                              />
                            ) : null;
                          })()}
                          <div className="w-full h-full bg-gray-600 rounded-lg flex items-center justify-center text-white text-xs" style={{display: toLh3(story[7] || '') ? 'none' : 'flex'}}>
                            <div className="text-center">
                              <div className="text-sm mb-1">📱</div>
                              <div>Story {index + 1}</div>
                              <div className="text-xs text-gray-400 mt-1">No thumbnail</div>
                            </div>
                          </div>
                        </div>

                        {/* モバイル版: 新しいレイアウト */}
                        {window.innerWidth < 768 && (
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] text-gray-500 mb-2 truncate">
                              {story[0] || `ストーリー ${index + 1}`}
                            </p>
                            <div className="grid grid-cols-3 gap-2 text-[11px] text-gray-700 text-center">
                              <span className="flex flex-col items-center gap-0.5">
                                <span className="text-xs">👁️</span>
                                <span className="font-semibold">{mobileViews.toLocaleString()}</span>
                                <span className="text-[10px] text-gray-400">ビュー</span>
                              </span>
                              <span className="flex flex-col items-center gap-0.5">
                                <span className="text-xs">💬</span>
                                <span className="font-semibold">{mobileComments.toLocaleString()}</span>
                                <span className="text-[10px] text-gray-400">コメント</span>
                              </span>
                              <span className="flex flex-col items-center gap-0.5">
                                <span className="text-xs">📈</span>
                                <span className="font-semibold">{mobileViewRate}</span>
                                <span className="text-[10px] text-gray-400">閲覧率</span>
                              </span>
                            </div>
                          </div>
                        )}

                        {/* PC版: 従来表示 */}
                        {window.innerWidth >= 768 && (
                          <div>
                            {/* 投稿日 */}
                            <p className="text-gray-900 text-xs mb-2 font-medium">{story[0] || `ストーリー ${index + 1}`}</p>

                            {/* Views（大きく表示） */}
                            <div className="mb-3 text-center">
                              <p className="text-gray-500 text-xs mb-1">閲覧数</p>
                              <p className="text-xl lg:text-2xl font-bold text-gray-900">{mobileViews.toLocaleString()}</p>
                            </div>

                            {/* KPIピル */}
                            <div className="flex flex-wrap gap-1">
                              <StatPill icon="💬" value={story[4] || 0} color="green" />
                              <StatPill icon="📈" value={story[5] || '0%'} color="purple" />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                  ) : (
                    <p className="text-gray-500 text-center col-span-full">データがありません</p>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* Daily Data Detail */}
        {activeTab === 'daily' && (
          <div className="space-y-6 lg:space-y-6 px-4 lg:px-0">
            <div className="bg-white border border-gray-200/70 rounded-2xl shadow-sm p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">デイリーデータ - 絞込期間: {
                dateRange.preset === 'this-week' ? '今週' :
                dateRange.preset === 'last-week' ? '先週' :
                dateRange.preset === 'this-month' ? '今月' :
                dateRange.preset === 'last-month' ? '先月' :
                'カスタム期間'
              }</h3>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200/70">
                      {(() => {
                        const { headers } = getFilteredDailyData(data.dailyRaw, dateRange.preset);
                        return headers.map((header, index) => (
                          <th
                            key={index}
                            className={`text-left text-gray-900 text-xs p-2 min-w-[120px] whitespace-nowrap ${
                              index === 0 ? 'sticky left-0 bg-white z-10 shadow-sm border-r border-gray-200/60' : ''
                            }`}
                          >
                            {header || '---'}
                          </th>
                        ));
                      })()}
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const { headers, data: dailyData } = getFilteredDailyData(data.dailyRaw, dateRange.preset);

                      if (dailyData.length === 0) {
                        return (
                          <tr>
                            <td colSpan={headers.length || 15} className="text-orange-500 text-center p-8">
                              選択された期間（{
                                dateRange.preset === 'this-week' ? '今週' :
                                dateRange.preset === 'last-week' ? '先週' :
                                dateRange.preset === 'this-month' ? '今月' :
                                dateRange.preset === 'last-month' ? '先月' :
                                'カスタム期間'
                              }）に該当するデータがありません
                            </td>
                          </tr>
                        );
                      }

                      return dailyData.map((row, index) => (
                        <tr key={index} className="border-b border-gray-200/50 hover:bg-gray-50">
                          {row.map((cell, cellIndex) => (
                            <td
                              key={cellIndex}
                              className={`text-gray-900 text-xs p-2 whitespace-nowrap ${
                                cellIndex === 0 ? 'sticky left-0 bg-white z-10 shadow-sm border-r border-gray-200/60 font-medium' : ''
                              }`}
                            >
                              {cell || '---'}
                            </td>
                          ))}
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* カスタム期間選択モーダル */}
        {showCustomDateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
              <h3 className="text-lg font-bold text-gray-900 mb-4">カスタム期間を選択</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    開始日
                  </label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="w-full rounded-md border border-gray-300 bg-white text-gray-900 px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    終了日
                  </label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="w-full rounded-md border border-gray-300 bg-white text-gray-900 px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowCustomDateModal(false);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={() => {
                    if (customStartDate && customEndDate) {
                      updatePreset('custom', new Date(customStartDate), new Date(customEndDate));
                      setShowCustomDateModal(false);
                    }
                  }}
                  disabled={!customStartDate || !customEndDate}
                  className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  適用
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Instagram チャネル閉じ */}
        </>}

        {/* Mobile Bottom Tab Navigation (Instagramチャネル時のみ) */}
        {activeChannel === 'instagram' && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-[0_-2px_8px_rgba(0,0,0,0.08)] bottom-nav-enhanced z-50">
          <div className="flex justify-around items-center px-1 py-2">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex flex-col items-center justify-center py-1 px-2 rounded-lg transition-all duration-200 ${
                activeTab === 'dashboard'
                  ? 'text-purple-600'
                  : 'text-gray-600'
              }`}
            >
              <div className="text-base mb-0.5">📊</div>
              <span className="text-xs font-medium">ホーム</span>
            </button>
            <button
              onClick={() => setActiveTab('reels')}
              className={`flex flex-col items-center justify-center py-1 px-2 rounded-lg transition-all duration-200 ${
                activeTab === 'reels'
                  ? 'text-purple-600'
                  : 'text-gray-600'
              }`}
            >
              <div className="text-base mb-0.5">🎬</div>
              <span className="text-xs font-medium">リール</span>
            </button>
            <button
              onClick={() => setActiveTab('stories')}
              className={`flex flex-col items-center justify-center py-1 px-2 rounded-lg transition-all duration-200 ${
                activeTab === 'stories'
                  ? 'text-purple-600'
                  : 'text-gray-600'
              }`}
            >
              <div className="text-base mb-0.5">📱</div>
              <span className="text-xs font-medium">ストーリー</span>
            </button>
            <button
              onClick={() => setActiveTab('daily')}
              className={`flex flex-col items-center justify-center py-1 px-2 rounded-lg transition-all duration-200 ${
                activeTab === 'daily'
                  ? 'text-purple-600'
                  : 'text-gray-600'
              }`}
            >
              <div className="text-base mb-0.5">📈</div>
              <span className="text-xs font-medium">デイリー</span>
            </button>
          </div>
        </div>
        )}

        <div className="mt-12 text-center border-t border-gray-200 pt-6 pb-24 lg:pb-6">
          <p className="text-gray-500 text-sm">Powered by ANALYCA</p>
        </div>
      </div>
    </div>
  );
}
