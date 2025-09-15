'use client';

import { useState, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface ApiResponse {
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

function KPICard({ title, value, change }: { title: string; value: string; change?: string }) {
  return (
    <div className="bg-gradient-to-br from-purple-900/30 to-blue-900/30 rounded-xl p-6 backdrop-blur-sm border border-white/10">
      <div>
        <p className="text-gray-300 text-sm">{title}</p>
        <p className="text-3xl font-bold text-white">{value}</p>
        {change && <p className="text-sm text-green-400">{change}</p>}
      </div>
    </div>
  );
}

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
const filterJoinedReelData = (joinedData: { rawData: string[], sheetData: string[] }[], timeFilter: string, customStartDate?: string, customEndDate?: string) => {
  console.log(`=== リールフィルタリング開始 ===`);
  console.log(`入力データ数: ${joinedData?.length || 0}`);
  console.log(`フィルター: ${timeFilter}`);
  console.log(`カスタム期間: ${customStartDate} 〜 ${customEndDate}`);

  if (!joinedData || joinedData.length === 0) {
    console.log(`データなし - 空配列を返却`);
    return [];
  }

  if (timeFilter === 'all') {
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
    let startDate, endDate;
    const today = new Date();
    const millisecondsPerDay = 24 * 60 * 60 * 1000;

    // 期間設定
    if (timeFilter === 'current_month') {
      // 当月: 今月の1日から今日まで
      startDate = new Date(today.getFullYear(), today.getMonth(), 1);
      endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
    } else if (timeFilter === 'custom' && customStartDate && customEndDate) {
      // カスタム期間
      startDate = new Date(customStartDate);
      endDate = new Date(customEndDate + 'T23:59:59');
    } else {
      // 固定期間（1週間、1ヶ月など）
      // 最新の日付を取得
      let latestDate = null;
      for (const item of joinedData) {
        const dateStr = String(item.rawData[5]).trim(); // 投稿日時は列5
        const date = parseDate(dateStr);
        if (date && !isNaN(date.getTime())) {
          if (!latestDate || date > latestDate) {
            latestDate = date;
          }
        }
      }

      if (!latestDate) return joinedData;

      switch (timeFilter) {
        case '1week':
          startDate = new Date(latestDate.getTime() - 7 * millisecondsPerDay);
          break;
        case '1month':
          startDate = new Date(latestDate.getTime() - 30 * millisecondsPerDay);
          break;
        case '3months':
          startDate = new Date(latestDate.getTime() - 90 * millisecondsPerDay);
          break;
        case '1year':
          startDate = new Date(latestDate.getTime() - 365 * millisecondsPerDay);
          break;
        default:
          return joinedData;
      }
      endDate = latestDate;
    }

    const filteredData = joinedData.filter(item => {
      const dateStr = String(item.rawData[5]).trim(); // 投稿日時は列5
      const date = parseDate(dateStr);
      return date && !isNaN(date.getTime()) && date >= startDate && date <= endDate;
    });

    console.log(`リールフィルタリング結果: ${filteredData.length}件 (${timeFilter})`);
    console.log(`期間: ${startDate?.toISOString().split('T')[0]} 〜 ${endDate?.toISOString().split('T')[0]}`);
    return filteredData;
  } catch (error) {
    console.error('リールフィルタリングエラー:', error);
    return joinedData;
  }
};

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
  const [activeTab, setActiveTab] = useState('main');
  const [timeFilter, setTimeFilter] = useState('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reelSortBy, setReelSortBy] = useState('date'); // date, views, likes, saves, follows, comments
  const [reelSortOrder, setReelSortOrder] = useState('desc'); // desc, asc
  const [storySortBy, setStorySortBy] = useState('date'); // date, views, viewRate, reactions
  const [storySortOrder, setStorySortOrder] = useState('desc'); // desc, asc

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
  const getFilteredDailyData = (data: string[][], timeFilter: string) => {
    if (!data || data.length <= 5) {
      return { headers: [], data: [] };
    }

    try {
      // 5行目（index 4）がヘッダー、A〜Q列（1〜17列）取得
      const fullHeaders = data[4] || [];
      const headers = fullHeaders.slice(0, 17); // A〜Q列（17列）

      console.log(`=== ヘッダー情報 ===`);
      console.log(`全ヘッダー数: ${fullHeaders.length}`);
      console.log(`表示ヘッダー (A-Q列, 1-17):`, headers);

      // 6行目以降（index 5〜）がデータ、A〜Q列（1〜17列）取得
      const allDataRows = data.slice(5);
      const dataRows = allDataRows.map(row => row.slice(0, 17)); // A〜Q列（17列）

      console.log(`デイリーデータ読み込み: 全データ行数=${dataRows.length}`);

      if (timeFilter === 'all') {
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

      if (timeFilter === 'current_month') {
        // 当月: 今月の1日から今日まで
        cutoffDate = new Date(jstToday.getFullYear(), jstToday.getMonth(), 1, 0, 0, 0, 0);
        const todayDate = new Date(jstToday.getFullYear(), jstToday.getMonth(), jstToday.getDate());
        daysBack = Math.ceil((todayDate.getTime() - cutoffDate.getTime()) / (1000 * 60 * 60 * 24));
      } else if (timeFilter === 'custom' && customStartDate && customEndDate) {
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
        switch (timeFilter) {
          case '1week':
            daysBack = 6; // 今日を含めて7日間
            break;
          case '1month':
            daysBack = 29; // 今日を含めて30日間
            break;
          case '3months':
            daysBack = 89; // 今日を含めて90日間
            break;
          case '1year':
            daysBack = 364; // 今日を含めて365日間
            break;
          default:
            daysBack = 0;
        }

        // カットオフ日を今日から遡って計算
        cutoffDate = new Date(jstToday.getFullYear(), jstToday.getMonth(), jstToday.getDate() - daysBack, 0, 0, 0, 0);
      }

      console.log(`=== デイリーデータフィルタリング ===`);
      console.log(`期間: ${timeFilter} (${daysBack + 1}日間)`);
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

  const getFilteredData = (data: string[][], timeFilter: string, dateColumnIndex = 0) => {
    console.log(`=== ストーリーズフィルタリング開始 ===`);
    console.log(`入力データ数: ${data?.length || 0}`);
    console.log(`フィルター: ${timeFilter}, 日付列: ${dateColumnIndex}`);

    // データが実際に存在するかログ出力
    if (data && data.length > 0) {
      console.log('データサンプル（最初の3行）:', data.slice(0, 3));
    }

    if (!data || data.length <= 1 || timeFilter === 'all') {
      console.log(`全期間選択またはデータなし - 元データを返却: ${data?.length || 0}件`);
      return data || [];
    }

    try {
      const dataRows = data.slice(1);
      let startDate, endDate;
      const today = new Date();
      const millisecondsPerDay = 24 * 60 * 60 * 1000;

      // 期間設定
      if (timeFilter === 'current_month') {
        // 当月: 今月の1日から今日まで
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
      } else if (timeFilter === 'custom' && customStartDate && customEndDate) {
        // カスタム期間
        startDate = new Date(customStartDate);
        endDate = new Date(customEndDate + 'T23:59:59');
      } else {
        // 固定期間（1週間、1ヶ月など）
        let latestDate = null;

        console.log(`フィルタリング開始: 日付列=${dateColumnIndex}, 総行数=${dataRows.length}`);
        for (let i = 0; i < Math.min(10, dataRows.length); i++) {
          const row = dataRows[i];
          if (row && row[dateColumnIndex]) {
            const dateStr = String(row[dateColumnIndex]).trim();
            console.log(`日付解析試行[${i}]: "${dateStr}"`);
            if (dateStr && dateStr !== '') {
              const date = parseDate(dateStr);
              if (date && !isNaN(date.getTime())) {
                console.log(`解析成功: ${date.toISOString()}`);
                if (!latestDate || date > latestDate) {
                  latestDate = date;
                }
              } else {
                console.log(`解析失敗: ${dateStr}`);
              }
            }
          }
        }
        console.log(`最新日付: ${latestDate ? latestDate.toISOString() : 'null'}`);

        if (!latestDate) {
          return data;
        }

        switch (timeFilter) {
          case '1week':
            startDate = new Date(latestDate.getTime() - 7 * millisecondsPerDay);
            break;
          case '1month':
            startDate = new Date(latestDate.getTime() - 30 * millisecondsPerDay);
            break;
          case '3months':
            startDate = new Date(latestDate.getTime() - 90 * millisecondsPerDay);
            break;
          case '1year':
            startDate = new Date(latestDate.getTime() - 365 * millisecondsPerDay);
            break;
          default:
            return data;
        }
        endDate = latestDate;
      }

      const headerRows = data.slice(0, 1);
      const filteredRows = dataRows.filter(row => {
        if (!row || !row[dateColumnIndex]) return false;
        const dateStr = String(row[dateColumnIndex]).trim();
        if (!dateStr || dateStr === '') return false;
        const date = parseDate(dateStr);
        return date && !isNaN(date.getTime()) && date >= startDate && date <= endDate;
      });
      console.log(`フィルタ結果: ${filteredRows.length}行 (${timeFilter})`);
      console.log(`期間: ${startDate?.toISOString().split('T')[0]} 〜 ${endDate?.toISOString().split('T')[0]}`);

      return [...headerRows, ...filteredRows];
    } catch (error) {
      console.error('フィルタリングエラー:', error);
      return data;
    }
  };

  useEffect(() => {
    console.log('=== useEffect実行 ===');
    setMounted(true);
    console.log('=== fetchData呼び出し直前 ===');
    fetchData();
    console.log('=== fetchData呼び出し直後 ===');
  }, []);

  const fetchData = async () => {
    console.log('=== fetchData 関数開始 ===');
    try {
      setLoading(true);
      setError('');

      console.log('実際のスプレッドシートからデータを取得中...');
      
      const response = await fetch('/api/data', {
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

      setData(result);

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
      const filteredDailyData = getFilteredDailyData(data.dailyRaw, timeFilter);

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
          const minFollowers = Math.min(...followerValues);
          summary.followerGrowth = summary.currentFollowers - minFollowers;
        }

        // 各指標の合計値を設定
        summary.latestReach = reachTotal;
        summary.latestProfileViews = profileViewsTotal;
        summary.latestWebsiteClicks = webClicksTotal;
        summary.lineRegistrations = lineTotal;
      }

      console.log('=== calculateSummary内でのデータ確認 ===');
      console.log('data.storiesRaw?.length:', data.storiesRaw?.length);
      console.log('data.storiesRaw 最初の3行:', data.storiesRaw?.slice(0, 3));

      const filteredStoriesProcessed = getFilteredData(data.storiesRaw, timeFilter, 3);
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
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-white text-xl">読み込み中...</div>
      </div>
    );
  }

  const summary = calculateSummary();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-white text-xl mb-4">Googleスプレッドシートからデータを取得中...</div>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center bg-red-900/20 p-8 rounded-lg border border-red-500/50 max-w-2xl">
          <div className="text-red-400 text-xl mb-4">{error}</div>
          <button 
            onClick={fetchData}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded mr-4"
          >
            再試行
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-white mb-2">💎 YOKO GEM QUEEN 💎</h1>
          <p className="text-purple-200">Instagram Analytics Dashboard</p>
        </div>

        {/* Custom Date Range */}
        {timeFilter === 'custom' && (
          <div className="mb-6">
            <div className="bg-white/10 backdrop-blur-md rounded-lg p-4 flex flex-wrap justify-center gap-4 items-center">
              <div className="flex items-center space-x-2">
                <label className="text-white text-sm">開始日:</label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="bg-white/10 border border-white/20 rounded px-3 py-1 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div className="text-white">〜</div>
              <div className="flex items-center space-x-2">
                <label className="text-white text-sm">終了日:</label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="bg-white/10 border border-white/20 rounded px-3 py-1 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              {customStartDate && customEndDate && new Date(customStartDate) <= new Date(customEndDate) && (
                <div className="text-green-400 text-sm">
                  ✓ 期間: {Math.ceil((new Date(customEndDate).getTime() - new Date(customStartDate).getTime()) / (1000 * 60 * 60 * 24)) + 1}日間
                </div>
              )}
              {customStartDate && customEndDate && new Date(customStartDate) > new Date(customEndDate) && (
                <div className="text-red-400 text-sm">
                  ✗ 無効な期間です
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab Navigation with Filter */}
        <div className="flex flex-wrap justify-between items-center gap-4 mb-8">
          {/* Tab Buttons */}
          <div className="flex flex-wrap justify-center gap-2">
            <button
              className={`px-6 py-3 rounded-lg ${activeTab === 'main' ? 'bg-white text-purple-900' : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}
              onClick={() => setActiveTab('main')}
            >
              メインダッシュボード
            </button>
            <button
              className={`px-4 py-2 rounded-lg ${activeTab === 'reels' ? 'bg-pink-600 text-white' : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}
              onClick={() => setActiveTab('reels')}
            >
              リール詳細 ({(() => {
                const joinedReelData = joinReelData(data.reelRawDataRaw, data.reelSheetRaw);
                const filteredJoinedData = filterJoinedReelData(joinedReelData, timeFilter, customStartDate, customEndDate);
                return filteredJoinedData.length;
              })()}件)
            </button>
            <button
              className={`px-4 py-2 rounded-lg ${activeTab === 'stories' ? 'bg-pink-600 text-white' : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}
              onClick={() => setActiveTab('stories')}
            >
              ストーリー詳細 ({summary.totalStories}件)
            </button>
            <button
              className={`px-4 py-2 rounded-lg ${activeTab === 'daily' ? 'bg-pink-600 text-white' : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}
              onClick={() => setActiveTab('daily')}
            >
              デイリーデータ
            </button>
          </div>

          {/* Time Filter */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2 text-white text-sm">
              <span>📅</span>
              <span>期間:</span>
            </div>
            <select
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value)}
              className="bg-white/10 backdrop-blur-md border border-white/20 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent min-w-[140px]"
            >
              <option value="1week" className="bg-gray-800 text-white">1週間</option>
              <option value="current_month" className="bg-gray-800 text-white">当月</option>
              <option value="1month" className="bg-gray-800 text-white">1ヶ月</option>
              <option value="3months" className="bg-gray-800 text-white">3ヶ月</option>
              <option value="1year" className="bg-gray-800 text-white">1年</option>
              <option value="all" className="bg-gray-800 text-white">全期間</option>
              <option value="custom" className="bg-gray-800 text-white">カスタム期間</option>
            </select>
          </div>
        </div>

        {/* Main Dashboard */}
        {activeTab === 'main' && (
          <div className="space-y-8">
            {/* Follower Trends & KPI Cards with Funnel Analysis */}
            <div className="bg-gradient-to-br from-purple-900/20 to-blue-900/20 rounded-xl p-6 backdrop-blur-sm border border-white/10 space-y-6">

              <h3 className="text-lg font-semibold text-white mb-6 text-center">KPI・ファネル分析</h3>

              {/* KPI Cards and Conversion Rates */}
              <div className="flex items-center justify-center flex-wrap lg:flex-nowrap gap-4">
                {/* 現在のフォロワー数 - 左端 */}
                <div className="flex-shrink-0">
                  <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-lg p-4 text-center border border-purple-300/30">
                    <div className="text-purple-300 text-sm mb-2">現在のフォロワー数</div>
                    <div className="text-2xl font-bold text-white">{summary.currentFollowers.toLocaleString()}</div>
                  </div>
                </div>

                {/* スペース */}
                <div className="flex-shrink-0 flex flex-col items-center text-center px-2">
                  <div className="text-transparent text-lg">→</div>
                </div>
                {(() => {
                  // 転換率計算
                  const reachToProfile = summary.latestReach > 0 ? ((summary.latestProfileViews / summary.latestReach) * 100).toFixed(1) : '0.0';
                  const profileToClick = summary.latestProfileViews > 0 ? ((summary.latestWebsiteClicks / summary.latestProfileViews) * 100).toFixed(1) : '0.0';
                  const clickToFollower = summary.latestWebsiteClicks > 0 ? ((summary.followerGrowth / summary.latestWebsiteClicks) * 100).toFixed(1) : '0.0';
                  const followerToLine = summary.followerGrowth > 0 ? ((summary.lineRegistrations / summary.followerGrowth) * 100).toFixed(1) : '0.0';

                  return (
                    <>
                      {/* リーチ数 */}
                      <div className="flex-shrink-0">
                        <KPICard
                          title="リーチ数"
                          value={summary.latestReach.toLocaleString()}
                        />
                      </div>

                      {/* 転換率1 */}
                      <div className="flex-shrink-0 flex flex-col items-center text-center px-2">
                        <div className="text-yellow-400 text-lg">→</div>
                        <div className="text-yellow-300 font-bold text-sm">{reachToProfile}%</div>
                      </div>

                      {/* プロフィール表示 */}
                      <div className="flex-shrink-0">
                        <KPICard
                          title="プロフィール表示"
                          value={summary.latestProfileViews.toLocaleString()}
                        />
                      </div>

                      {/* 転換率2 */}
                      <div className="flex-shrink-0 flex flex-col items-center text-center px-2">
                        <div className="text-yellow-400 text-lg">→</div>
                        <div className="text-yellow-300 font-bold text-sm">{profileToClick}%</div>
                      </div>

                      {/* プロフクリック数 */}
                      <div className="flex-shrink-0">
                        <KPICard
                          title="プロフクリック数"
                          value={summary.latestWebsiteClicks.toLocaleString()}
                        />
                      </div>

                      {/* 転換率3 */}
                      <div className="flex-shrink-0 flex flex-col items-center text-center px-2">
                        <div className="text-yellow-400 text-lg">→</div>
                        <div className="text-yellow-300 font-bold text-sm">{clickToFollower}%</div>
                      </div>

                      {/* フォロワー増加数 */}
                      <div className="flex-shrink-0">
                        <KPICard
                          title="フォロワー増加数"
                          value={summary.followerGrowth.toLocaleString()}
                        />
                      </div>

                      {/* 転換率4 */}
                      <div className="flex-shrink-0 flex flex-col items-center text-center px-2">
                        <div className="text-yellow-400 text-lg">→</div>
                        <div className="text-yellow-300 font-bold text-sm">{followerToLine}%</div>
                      </div>

                      {/* LINE登録者数 */}
                      <div className="flex-shrink-0">
                        <KPICard
                          title="LINE登録者数"
                          value={summary.lineRegistrations.toLocaleString()}
                        />
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* フォロワー推移グラフ */}
              {(() => {
                const filteredDailyData = getFilteredDailyData(data.dailyRaw, timeFilter);

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

                return chartData.length > 0 && (
                  <div>
                  <div className="mb-4">
                    <h3 className="text-xl font-semibold text-white">フォロワー・LINE登録者推移</h3>
                  </div>
                  <div className="h-64">
                    <Line
                      data={{
                        labels: chartData.map(row => {
                          try {
                            const dateStr = String(row[0] || '').trim();
                            const date = parseDate(dateStr);
                            if (date) {
                              return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
                            }
                            return dateStr;
                          } catch {
                            return row[0];
                          }
                        }),
                        datasets: [
                          {
                            label: 'フォロワー数',
                            data: chartData.map(row => parseInt(String(row[1] || '').replace(/,/g, '')) || 0),
                            borderColor: 'rgb(147, 51, 234)',
                            backgroundColor: 'rgba(147, 51, 234, 0.1)',
                            tension: 0.1,
                            fill: true,
                            yAxisID: 'y',
                            type: 'line',
                          },
                          {
                            label: 'フォロワー増加数',
                            data: chartData.map((row, index) => {
                              if (index === 0) return 0; // 最初の日は増加数を計算できない
                              const current = parseInt(String(row[1] || '').replace(/,/g, '')) || 0;
                              const previous = parseInt(String(chartData[index - 1][1] || '').replace(/,/g, '')) || 0;
                              return Math.max(0, current - previous); // 負の値は0にする
                            }),
                            backgroundColor: 'rgba(59, 130, 246, 0.8)',
                            borderColor: 'rgb(59, 130, 246)',
                            borderWidth: 1,
                            yAxisID: 'y1',
                            type: 'bar',
                          },
                          {
                            label: 'LINE登録数',
                            data: chartData.map(row => parseInt(String(row[14] || '').replace(/,/g, '')) || 0), // LINE登録数日別
                            backgroundColor: 'rgba(34, 197, 94, 0.8)',
                            borderColor: 'rgb(34, 197, 94)',
                            borderWidth: 1,
                            yAxisID: 'y1',
                            type: 'bar',
                          }
                        ],
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: { labels: { color: '#fff' } }
                        },
                        scales: {
                          x: { ticks: { color: '#fff' } },
                          y: {
                            type: 'linear',
                            display: true,
                            position: 'left',
                            ticks: {
                              color: '#fff',
                              callback: function(value) {
                                return value.toLocaleString();
                              }
                            },
                            title: {
                              display: true,
                              text: 'フォロワー数',
                              color: '#fff'
                            }
                          },
                          y1: {
                            type: 'linear',
                            display: true,
                            position: 'right',
                            ticks: {
                              color: '#3b82f6',
                              callback: function(value) {
                                return value.toLocaleString();
                              }
                            },
                            title: {
                              display: true,
                              text: 'フォロワー増加数・LINE登録数',
                              color: '#3b82f6'
                            },
                            grid: {
                              drawOnChartArea: false,
                            },
                          }
                        }
                      }}
                    />
                  </div>
                  </div>
                );
              })()}
            </div>

            {/* Top 5 Reels */}
            <div className="bg-gradient-to-br from-purple-900/30 to-blue-900/30 rounded-xl p-6 backdrop-blur-sm border border-white/10">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-white">トップ5 リール</h3>
                <button
                  onClick={() => {
                    setActiveTab('reels');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="bg-pink-600 hover:bg-pink-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200"
                >
                  詳細を確認する →
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {(() => {
                  // リールデータを結合
                  const joinedReelData = joinReelData(data.reelRawDataRaw, data.reelSheetRaw);
                  // フィルタリングを適用
                  const filteredJoinedData = filterJoinedReelData(joinedReelData, timeFilter, customStartDate, customEndDate);

                  if (filteredJoinedData.length > 0) {
                    // 再生数でソートしてトップ5を取得
                    const sortedReels = filteredJoinedData.sort((a, b) => {
                      const viewsA = parseInt(String(a.rawData[6] || '').replace(/,/g, '')) || 0;
                      const viewsB = parseInt(String(b.rawData[6] || '').replace(/,/g, '')) || 0;
                      return viewsB - viewsA;
                    }).slice(0, 5);

                    return sortedReels.map((joinedReel, index) => {
                      const rawData = joinedReel.rawData;
                      const sheetData = joinedReel.sheetData;

                      return (
                        <div key={index} className="bg-white/5 rounded-lg p-3 text-center">
                          <div className="w-full aspect-[9/16] bg-gray-600 rounded-lg overflow-hidden mb-2">
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
                            <div className="w-full h-full bg-gray-600 rounded-lg flex items-center justify-center text-white text-xs" style={{display: rawData[15] ? 'none' : 'flex'}}>
                              Reel {index + 1}
                            </div>
                          </div>
                          <p className="text-white text-xs mb-2">{rawData[5] || `リール ${index + 1}`}</p>
                          <div className="space-y-1">
                            <p className="text-gray-300 text-xs">再生数：<span className="text-white font-bold">{parseInt(String(rawData[6] || '').replace(/,/g, '')).toLocaleString()}</span></p>
                            <p className="text-green-400 text-xs">いいね：{sheetData[13] || 0}</p>
                            <p className="text-blue-400 text-xs">保存：{sheetData[16] || 0}</p>
                            <p className="text-orange-400 text-xs">フォロー：{sheetData[18] || 0}</p>
                          </div>
                        </div>
                      );
                    });
                  } else {
                    return <p className="text-gray-400 text-center col-span-full">データがありません</p>;
                  }
                })()}
              </div>
            </div>

            {/* Top 5 Stories */}
            <div className="bg-gradient-to-br from-purple-900/30 to-blue-900/30 rounded-xl p-6 backdrop-blur-sm border border-white/10">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-white">トップ5 ストーリー</h3>
                <button
                  onClick={() => {
                    setActiveTab('stories');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="bg-pink-600 hover:bg-pink-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200"
                >
                  詳細を確認する →
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {(() => {
                  const filteredStoriesProcessed = getFilteredData(data.storiesProcessed, timeFilter, 0);
                  if (filteredStoriesProcessed.length > 1) {
                    const sortedStories = filteredStoriesProcessed.slice(1).sort((a, b) => {
                      const viewsA = parseInt(String(a[3] || '').replace(/,/g, '')) || 0;
                      const viewsB = parseInt(String(b[3] || '').replace(/,/g, '')) || 0;
                      return viewsB - viewsA;
                    }).slice(0, 5);

                    return sortedStories.map((story, index) => (
                      <div key={index} className="bg-white/5 rounded-lg p-3 text-center">
                        <div className="w-full aspect-[9/16] bg-gray-600 rounded-lg overflow-hidden mb-3">
                          {story[6] && story[6].trim() ? (
                            <img
                              src={convertToGoogleUserContent(story[6])}
                              alt={`Story ${index + 1}`}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                console.log('Story thumbnail load error:', story[6]);
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                const fallback = target.nextElementSibling as HTMLElement;
                                if (fallback) fallback.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <div className="w-full h-full bg-gray-600 rounded-lg flex items-center justify-center text-white text-xs" style={{display: (story[6] && story[6].trim()) ? 'none' : 'flex'}}>
                            <div className="text-center">
                              <div className="text-sm mb-1">📱</div>
                              <div>Story {index + 1}</div>
                              <div className="text-xs text-gray-400 mt-1">No thumbnail</div>
                            </div>
                          </div>
                        </div>
                        <p className="text-white text-xs mb-2">{story[0] || `ストーリー ${index + 1}`}</p>
                        <div className="space-y-1">
                          <p className="text-blue-400 text-xs">閲覧数：<span className="text-white font-bold">{parseInt(String(story[3] || '').replace(/,/g, '')).toLocaleString()}</span></p>
                          <p className="text-purple-400 text-xs">閲覧率：<span className="text-white font-bold">{story[5] || 'N/A'}</span></p>
                          <p className="text-green-400 text-xs">反応数：{story[4] || 0}</p>
                        </div>
                      </div>
                    ));
                  } else {
                    return <p className="text-gray-400 text-center col-span-full">データがありません</p>;
                  }
                })()}
              </div>
            </div>
          </div>
        )}


        {/* Reels Detail */}
        {activeTab === 'reels' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-purple-900/30 to-blue-900/30 rounded-xl p-6 backdrop-blur-sm border border-white/10">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-white">リール詳細 ({(() => {
                  const joinedReelData = joinReelData(data.reelRawDataRaw, data.reelSheetRaw);
                  const filteredJoinedData = filterJoinedReelData(joinedReelData, timeFilter, customStartDate, customEndDate);
                  return filteredJoinedData.length;
                })()}件)</h3>

                {/* Sort Controls */}
                <div className="flex items-center space-x-3">
                  <span className="text-white text-sm">並び替え:</span>
                  <select
                    value={reelSortBy}
                    onChange={(e) => setReelSortBy(e.target.value)}
                    className="bg-white/10 backdrop-blur-md border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="date" className="bg-gray-800 text-white">投稿日</option>
                    <option value="views" className="bg-gray-800 text-white">再生数</option>
                    <option value="likes" className="bg-gray-800 text-white">いいね</option>
                    <option value="saves" className="bg-gray-800 text-white">保存数</option>
                    <option value="follows" className="bg-gray-800 text-white">フォロー数</option>
                    <option value="comments" className="bg-gray-800 text-white">コメント</option>
                  </select>
                  <button
                    onClick={() => setReelSortOrder(reelSortOrder === 'desc' ? 'asc' : 'desc')}
                    className="bg-white/10 backdrop-blur-md border border-white/20 rounded-lg px-3 py-2 text-white text-sm hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                    title={reelSortOrder === 'desc' ? '降順 (高い順/新しい順)' : '昇順 (低い順/古い順)'}
                  >
                    {reelSortOrder === 'desc' ? '↓' : '↑'}
                  </button>
                </div>
              </div>

              {/* Charts Section */}
              {(() => {
                const joinedData = joinReelData(data.reelRawDataRaw, data.reelSheetRaw);
                const filteredJoinedData = filterJoinedReelData(joinedData, timeFilter, customStartDate, customEndDate);
                const filteredDailyData = getFilteredDailyData(data.dailyRaw, timeFilter);

                if (filteredJoinedData.length === 0 || !filteredDailyData.data || filteredDailyData.data.length === 0) {
                  return null;
                }

                // 再生数データの準備（リールデータから日付別に集計）
                const viewsData = {};
                filteredJoinedData.forEach(reel => {
                  const date = reel.rawData[5]; // 投稿日
                  const views = parseInt(String(reel.rawData[6] || '').replace(/,/g, '')) || 0;
                  if (date) {
                    if (!viewsData[date]) {
                      viewsData[date] = 0;
                    }
                    viewsData[date] += views;
                  }
                });

                // 日付でソートして配列に変換
                const sortedViewsData = Object.entries(viewsData)
                  .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
                  .slice(-14); // 最新14日分

                // フォロワー数・LINE登録数データ（dailyDataから）
                const dailyChartData = filteredDailyData.data
                  .filter(row => row[0] && row[1]) // 有効なデータのみ
                  .slice(-14); // 最新14日分

                return (
                  <div className="bg-white/5 rounded-lg p-4 mb-6">
                    <h4 className="text-lg font-semibold text-white mb-4">再生数推移・フォロワー増加数</h4>
                    <div>
                      <div>
                        <div className="h-48">
                          <Line
                            data={{
                              labels: sortedViewsData.map(([date]) => {
                                try {
                                  const d = new Date(date);
                                  return d.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
                                } catch {
                                  return date;
                                }
                              }),
                              datasets: [
                                {
                                  label: '再生数',
                                  data: sortedViewsData.map(([, views]) => views),
                                  borderColor: 'rgb(34, 197, 94)',
                                  backgroundColor: 'rgba(34, 197, 94, 0.1)',
                                  tension: 0.4,
                                  fill: true,
                                  pointBackgroundColor: 'rgb(34, 197, 94)',
                                  pointBorderColor: '#fff',
                                  pointBorderWidth: 2,
                                  yAxisID: 'y',
                                  type: 'line',
                                },
                                {
                                  label: 'フォロワー増加数',
                                  data: dailyChartData.map((row, index) => {
                                    if (index === 0) return 0; // 最初の日は増加数を計算できない
                                    const current = parseInt(String(row[1] || '').replace(/,/g, '')) || 0;
                                    const previous = parseInt(String(dailyChartData[index - 1][1] || '').replace(/,/g, '')) || 0;
                                    return Math.max(0, current - previous); // 負の値は0にする
                                  }),
                                  backgroundColor: 'rgba(59, 130, 246, 0.8)',
                                  borderColor: 'rgb(59, 130, 246)',
                                  borderWidth: 1,
                                  yAxisID: 'y1',
                                  type: 'bar',
                                }
                              ],
                            }}
                            options={{
                              responsive: true,
                              maintainAspectRatio: false,
                              plugins: {
                                legend: {
                                  labels: { color: '#fff', font: { size: 11 } }
                                }
                              },
                              scales: {
                                x: {
                                  ticks: { color: '#fff', font: { size: 10 } },
                                  grid: { color: 'rgba(255,255,255,0.1)' }
                                },
                                y: {
                                  type: 'linear',
                                  display: true,
                                  position: 'left',
                                  ticks: {
                                    color: '#fff',
                                    font: { size: 10 },
                                    callback: function(value) {
                                      return value.toLocaleString();
                                    }
                                  },
                                  title: {
                                    display: true,
                                    text: '再生数',
                                    color: '#22c55e'
                                  },
                                  grid: { color: 'rgba(255,255,255,0.1)' }
                                },
                                y1: {
                                  type: 'linear',
                                  display: true,
                                  position: 'right',
                                  ticks: {
                                    color: '#3b82f6',
                                    font: { size: 10 },
                                    callback: function(value) {
                                      return value.toLocaleString();
                                    }
                                  },
                                  title: {
                                    display: true,
                                    text: 'フォロワー増加数',
                                    color: '#3b82f6'
                                  },
                                  grid: {
                                    drawOnChartArea: false,
                                  },
                                }
                              }
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
                {(() => {
                  const joinedData = joinReelData(data.reelRawDataRaw, data.reelSheetRaw);
                  const filteredJoinedData = filterJoinedReelData(joinedData, timeFilter, customStartDate, customEndDate);

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
                        result = dateB - dateA;
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

                      return (
                        <div key={index} className="bg-white/5 rounded-lg p-4 text-center">
                          <div className="w-full aspect-[9/16] bg-gray-600 rounded-lg overflow-hidden mb-3">
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
                            <div className="w-full h-full bg-gray-600 rounded-lg flex items-center justify-center text-white text-xs" style={{display: rawData[15] ? 'none' : 'flex'}}>
                              Reel {index + 1}
                            </div>
                          </div>
                          <p className="text-white text-xs mb-2">{rawData[5] || `リール ${index + 1}`}</p>
                          <div className="space-y-1">
                            <p className="text-gray-300 text-xs">再生数：<span className="text-white font-bold">{parseInt(String(rawData[6] || '0').replace(/,/g, '')).toLocaleString()}</span></p>
                            <p className="text-green-400 text-xs">いいね：{sheetData[13] || 0}</p>
                            <p className="text-blue-400 text-xs">保存：{sheetData[16] || 0}</p>
                            <p className="text-purple-400 text-xs">フォロー：{sheetData[18] || 0}</p>
                            <p className="text-orange-400 text-xs">コメント：{sheetData[14] || 0}</p>
                            <p className="text-cyan-400 text-xs">平均視聴維持率：{sheetData[9] || 'N/A'}</p>
                            <p className="text-pink-400 text-xs">平均再生時間：{sheetData[8] || 'N/A'}</p>
                            <p className="text-yellow-400 text-xs">動画の尺：{sheetData[6] || 'N/A'}</p>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-gray-400 text-center col-span-full">データがありません</p>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* Stories Detail */}
        {activeTab === 'stories' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-purple-900/30 to-blue-900/30 rounded-xl p-6 backdrop-blur-sm border border-white/10">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-white">ストーリー詳細 ({summary.totalStories}件)</h3>

                {/* Sort Controls */}
                <div className="flex items-center space-x-3">
                  <span className="text-white text-sm">並び替え:</span>
                  <select
                    value={storySortBy}
                    onChange={(e) => setStorySortBy(e.target.value)}
                    className="bg-white/10 backdrop-blur-md border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="date" className="bg-gray-800 text-white">投稿日</option>
                    <option value="views" className="bg-gray-800 text-white">閲覧数</option>
                    <option value="viewRate" className="bg-gray-800 text-white">閲覧率</option>
                    <option value="reactions" className="bg-gray-800 text-white">反応数</option>
                  </select>
                  <button
                    onClick={() => setStorySortOrder(storySortOrder === 'desc' ? 'asc' : 'desc')}
                    className="bg-white/10 backdrop-blur-md border border-white/20 rounded-lg px-3 py-2 text-white text-sm hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                    title={storySortOrder === 'desc' ? '降順 (高い順/新しい順)' : '昇順 (低い順/古い順)'}
                  >
                    {storySortOrder === 'desc' ? '↓' : '↑'}
                  </button>
                </div>
              </div>

              {/* Stories View Rate Chart */}
              {(() => {
                const filteredStoriesProcessed = getFilteredData(data.storiesProcessed || [], timeFilter, 0);

                if (!filteredStoriesProcessed || filteredStoriesProcessed.length <= 1) {
                  return null;
                }

                // ストーリー詳細と同じロジックを使用
                const storyData = filteredStoriesProcessed.slice(1);

                if (!storyData || storyData.length === 0) {
                  return null;
                }


                // 日付別にデータを集計（日付を正規化）
                const dailyStoryData = {};
                storyData.forEach(story => {
                  const dateTimeStr = story[0]; // 投稿日時 column (storiesProcessedの場合)
                  const viewRate = parseFloat(String(story[5] || '').replace('%', '')) || 0; // 閲覧率列から直接取得

                  if (dateTimeStr) {
                    // ストーリーの日付時刻を日付のみに正規化 (2025/09/15 15:04:46 -> 2025/9/15)
                    let normalizedDate;
                    try {
                      const date = new Date(dateTimeStr);
                      const year = date.getFullYear();
                      const month = date.getMonth() + 1; // 0-based month
                      const day = date.getDate();
                      normalizedDate = `${year}/${month}/${day}`;
                    } catch {
                      console.log(`Date parsing failed for: ${dateTimeStr}`);
                      return;
                    }


                    if (!dailyStoryData[normalizedDate]) {
                      dailyStoryData[normalizedDate] = {
                        postCount: 0,
                        viewRates: [],
                        maxViewRate: 0
                      };
                    }

                    dailyStoryData[normalizedDate].postCount += 1;
                    if (viewRate > 0) {
                      dailyStoryData[normalizedDate].viewRates.push(viewRate);
                      dailyStoryData[normalizedDate].maxViewRate = Math.max(
                        dailyStoryData[normalizedDate].maxViewRate,
                        viewRate
                      );
                    }
                  }
                });

                // dailyDataから日付軸を取得
                const filteredDailyData = getFilteredDailyData(data.dailyRaw, timeFilter);

                if (!filteredDailyData.data || filteredDailyData.data.length === 0) {
                  return null;
                }

                // 今日の日付を取得（JST基準）
                const today = new Date();
                const todayJST = new Date(today.getFullYear(), today.getMonth(), today.getDate());

                // 今日のデータを除外（昨日まで）
                const dailyChartData = filteredDailyData.data.filter(row => {
                  const dateStr = String(row[0] || '').trim();
                  const date = parseDate(dateStr);
                  if (!date) return false;

                  const rowDateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
                  return rowDateOnly < todayJST;
                });


                // チャートデータを作成
                const chartData = dailyChartData.map(row => {
                  const dateStr = String(row[0] || '').trim();

                  // 日付を正規化してマッピング
                  let normalizedDateStr;
                  const parsedDate = parseDate(dateStr);
                  if (parsedDate) {
                    const year = parsedDate.getFullYear();
                    const month = parsedDate.getMonth() + 1;
                    const day = parsedDate.getDate();
                    normalizedDateStr = `${year}/${month}/${day}`;
                  } else {
                    normalizedDateStr = dateStr;
                  }

                  const storyInfo = dailyStoryData[normalizedDateStr];

                  const result = {
                    date: dateStr,
                    postCount: storyInfo ? storyInfo.postCount : 0,
                    maxViewRate: storyInfo ? storyInfo.maxViewRate : 0
                  };

                  return result;
                });

                const dayCount = chartData.length;
                console.log(`Stories chart: ${storyData.length} stories processed into ${dayCount} chart points`);

                if (chartData.length === 0) {
                  return null;
                }

                // グラフの幅を日数に応じて動的に調整
                const chartWidth = Math.max(300, dayCount * 20); // 最小300px、1日あたり20px
                const isWideChart = chartWidth > 600;

                return (
                  <div className="bg-white/5 rounded-lg p-4 mb-6">
                    <h4 className="text-lg font-semibold text-white mb-4">ストーリー閲覧率遷移 ({dayCount}日間)</h4>
                    <div className={`h-48 ${isWideChart ? 'overflow-x-auto' : ''}`}>
                      <div style={{ minWidth: isWideChart ? `${chartWidth}px` : '100%', height: '192px' }}>
                      <Line
                        data={{
                          labels: chartData.map(item => {
                            try {
                              const dateStr = String(item.date || '').trim();
                              const date = parseDate(dateStr);
                              if (date) {
                                return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
                              }
                              return dateStr;
                            } catch {
                              return item.date;
                            }
                          }),
                          datasets: [
                            {
                              type: 'bar',
                              label: '投稿数',
                              data: chartData.map(item => item.postCount),
                              backgroundColor: 'rgba(147, 51, 234, 0.6)',
                              borderColor: 'rgb(147, 51, 234)',
                              borderWidth: 1,
                              yAxisID: 'y1',
                            },
                            {
                              type: 'line',
                              label: '最高閲覧率 (%)',
                              data: chartData.map(item => item.maxViewRate),
                              borderColor: 'rgb(34, 197, 94)',
                              backgroundColor: 'rgba(34, 197, 94, 0.1)',
                              tension: 0.4,
                              fill: false,
                              pointBackgroundColor: 'rgb(34, 197, 94)',
                              pointBorderColor: '#fff',
                              pointBorderWidth: 2,
                              yAxisID: 'y',
                            }
                          ],
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          interaction: {
                            mode: 'index',
                            intersect: false,
                          },
                          elements: {
                            point: {
                              radius: dayCount > 20 ? 2 : 3, // 日数が多い場合はポイントを小さく
                            }
                          },
                          plugins: {
                            legend: {
                              labels: { color: '#fff', font: { size: 11 } }
                            }
                          },
                          scales: {
                            x: {
                              ticks: { color: '#fff', font: { size: 10 } },
                              grid: { color: 'rgba(255,255,255,0.1)' }
                            },
                            y: {
                              type: 'linear',
                              display: true,
                              position: 'left',
                              ticks: {
                                color: '#fff',
                                font: { size: 10 },
                                callback: function(value) {
                                  return value + '%';
                                }
                              },
                              grid: { color: 'rgba(255,255,255,0.1)' },
                              beginAtZero: true,
                              max: 40
                            },
                            y1: {
                              type: 'linear',
                              display: true,
                              position: 'right',
                              ticks: {
                                color: '#fff',
                                font: { size: 10 },
                                callback: function(value) {
                                  return value + '件';
                                }
                              },
                              grid: {
                                drawOnChartArea: false,
                              },
                              beginAtZero: true,
                              max: 4
                            }
                          }
                        }}
                      />
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
                {(() => {
                  const filteredStoriesProcessed = getFilteredData(data.storiesProcessed, timeFilter, 0);

                  if (!filteredStoriesProcessed || filteredStoriesProcessed.length <= 1) {
                    return <p className="text-gray-400 text-center col-span-full">データがありません</p>;
                  }

                  // ソート機能
                  const storyData = filteredStoriesProcessed.slice(1);
                  const sortedStories = storyData.sort((a, b) => {
                    let result = 0;

                    switch (storySortBy) {
                      case 'date':
                        const dateA = new Date(a[0] || '');
                        const dateB = new Date(b[0] || '');
                        result = dateB - dateA;
                        break;
                      case 'views':
                        const viewsA = parseInt(String(a[3] || '').replace(/,/g, '')) || 0;
                        const viewsB = parseInt(String(b[3] || '').replace(/,/g, '')) || 0;
                        result = viewsB - viewsA;
                        break;
                      case 'viewRate':
                        const rateA = parseFloat(String(a[5] || '').replace('%', '')) || 0;
                        const rateB = parseFloat(String(b[5] || '').replace('%', '')) || 0;
                        result = rateB - rateA;
                        break;
                      case 'reactions':
                        const reactionsA = parseInt(String(a[4] || '').replace(/,/g, '')) || 0;
                        const reactionsB = parseInt(String(b[4] || '').replace(/,/g, '')) || 0;
                        result = reactionsB - reactionsA;
                        break;
                      default:
                        return 0;
                    }

                    // 昇順の場合は結果を反転
                    return storySortOrder === 'asc' ? -result : result;
                  });

                  return sortedStories.map((story, index) => (
                      <div key={index} className="bg-white/5 rounded-lg p-4 text-center">
                        <div className="w-full aspect-[9/16] bg-gray-600 rounded-lg overflow-hidden mb-3">
                          {story[6] && story[6].trim() ? (
                            <img
                              src={convertToGoogleUserContent(story[6])}
                              alt={`Story ${index + 1}`}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                console.log('Story thumbnail load error:', story[6]);
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                const fallback = target.nextElementSibling as HTMLElement;
                                if (fallback) fallback.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <div className="w-full h-full bg-gray-600 rounded-lg flex items-center justify-center text-white text-xs" style={{display: (story[6] && story[6].trim()) ? 'none' : 'flex'}}>
                            <div className="text-center">
                              <div className="text-sm mb-1">📱</div>
                              <div>Story {index + 1}</div>
                              <div className="text-xs text-gray-400 mt-1">No thumbnail</div>
                            </div>
                          </div>
                        </div>
                        <p className="text-white text-xs mb-2">{story[0] || `ストーリー ${index + 1}`}</p>
                        <div className="space-y-1">
                          <p className="text-blue-400 text-xs">閲覧数：<span className="text-white font-semibold">{parseInt(String(story[3] || '').replace(/,/g, '')).toLocaleString()}</span></p>
                          <p className="text-purple-400 text-xs">閲覧率：<span className="text-white font-semibold">{story[5] || 'N/A'}</span></p>
                          <p className="text-green-400 text-xs">反応数：{story[4] || 0}</p>
                        </div>
                      </div>
                    ));
                })()}
              </div>
            </div>
          </div>
        )}

        {/* Daily Data Detail */}
        {activeTab === 'daily' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-purple-900/30 to-blue-900/30 rounded-xl p-6 backdrop-blur-sm border border-white/10">
              <h3 className="text-xl font-semibold text-white mb-4">デイリーデータ - 絞込期間: {timeFilter === '1week' ? '1週間' : timeFilter === '1month' ? '1ヶ月' : timeFilter === '3months' ? '3ヶ月' : timeFilter === '1year' ? '1年' : '全期間'}</h3>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/20">
                      {(() => {
                        const { headers } = getFilteredDailyData(data.dailyRaw, timeFilter);
                        return headers.map((header, index) => (
                          <th key={index} className="text-left text-white text-xs p-2 min-w-[120px]">
                            {header || '---'}
                          </th>
                        ));
                      })()}
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const { headers, data: dailyData } = getFilteredDailyData(data.dailyRaw, timeFilter);

                      if (dailyData.length === 0) {
                        return (
                          <tr>
                            <td colSpan={headers.length || 15} className="text-yellow-400 text-center p-8">
                              {timeFilter === 'all' ? 'データがありません' : `選択された期間（${timeFilter === '1week' ? '1週間' : timeFilter === '1month' ? '1ヶ月' : timeFilter === '3months' ? '3ヶ月' : '1年'}）に該当するデータがありません`}
                            </td>
                          </tr>
                        );
                      }

                      return dailyData.map((row, index) => (
                        <tr key={index} className="border-b border-white/10 hover:bg-white/5">
                          {row.map((cell, cellIndex) => (
                            <td key={cellIndex} className="text-white text-xs p-2">
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

        {/* Footer */}
        <div className="mt-12 text-center border-t border-white/10 pt-6">
          <p className="text-gray-400 text-sm">© 2025 Powered by ANALYCA</p>
        </div>
      </div>
    </div>
  );
}