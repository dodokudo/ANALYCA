'use client';

import { useState, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
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
  Title,
  Tooltip,
  Legend,
  Filler
);

interface ApiResponse {
  instagramRaw: any[][];
  storiesRaw: any[][];
  reelRawDataRaw: any[][];
  reelSheetRaw: any[][];
  dailyRaw: any[][];
  dataInfo: {
    instagramRows: number;
    storiesRows: number;
    reelRawDataRows: number;
    reelSheetRows: number;
    dailyRows: number;
  };
}

function KPICard({ title, value, change, icon }: { title: string; value: string; change?: string; icon: string }) {
  return (
    <div className="bg-gradient-to-br from-purple-900/30 to-blue-900/30 rounded-xl p-6 backdrop-blur-sm border border-white/10">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-300 text-sm">{title}</p>
          <p className="text-3xl font-bold text-white">{value}</p>
          {change && <p className="text-sm text-green-400">{change}</p>}
        </div>
        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
          icon === 'F' ? 'bg-purple-500' :
          icon === 'R' ? 'bg-blue-500' :
          icon === 'P' ? 'bg-green-500' :
          icon === 'W' ? 'bg-orange-500' :
          'bg-green-600'
        }`}>
          <span className="text-white font-bold">{icon}</span>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState<ApiResponse>({
    instagramRaw: [],
    storiesRaw: [],
    reelRawDataRaw: [],
    reelSheetRaw: [],
    dailyRaw: [],
    dataInfo: {
      instagramRows: 0,
      storiesRows: 0,
      reelRawDataRows: 0,
      reelSheetRows: 0,
      dailyRows: 0
    }
  });
  const [activeTab, setActiveTab] = useState('main');
  const [timeFilter, setTimeFilter] = useState('1month');
  const [mounted, setMounted] = useState(false);

  // 修正されたparseDate関数 - 全日付形式対応
  const parseDate = (dateStr) => {
    if (!dateStr || typeof dateStr !== 'string') {
      return null;
    }

    // 不正なデータをフィルタリング
    const invalidPatterns = [
      /^[0-9]{17,}/,  // 17桁以上の数字のみ
      /今さ、API/,      // 特定の文字列
      /デイリーのシート/,  // 特定の文字列
    ];
    
    for (const pattern of invalidPatterns) {
      if (pattern.test(dateStr)) {
        return null;
      }
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

      // 「2025年6月20日(木)」形式
      const fullDateMatch = str.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日\([^)]+\)$/);
      if (fullDateMatch) {
        const [, year, month, day] = fullDateMatch;
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      }

      // 「2025年6月20日」形式（曜日なし）
      const fullDateNoWeekMatch = str.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日$/);
      if (fullDateNoWeekMatch) {
        const [, year, month, day] = fullDateNoWeekMatch;
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      }

      // 「6月20日(木)」形式 - 強制的に2025年
      const monthDayMatch = str.match(/^(\d{1,2})月(\d{1,2})日\([^)]+\)$/);
      if (monthDayMatch) {
        const [, month, day] = monthDayMatch;
        return new Date(2025, parseInt(month) - 1, parseInt(day));
      }

      // 「6月20日」形式 - 強制的に2025年
      const monthDaySimpleMatch = str.match(/^(\d{1,2})月(\d{1,2})日$/);
      if (monthDaySimpleMatch) {
        const [, month, day] = monthDaySimpleMatch;
        return new Date(2025, parseInt(month) - 1, parseInt(day));
      }

      return null;
    } catch (error) {
      console.error('parseDate エラー:', error, '元値:', dateStr);
      return null;
    }
  };

  useEffect(() => {
    setMounted(true);
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const response = await fetch('/api/data');
      const result = await response.json();
      
      if (result.error) {
        console.error('API returned error:', result.error);
        return;
      }
      
      setData(result);
    } catch (error) {
      console.error('データ取得エラー:', error);
    }
  };

  // マウント前は読み込み画面を表示
  if (!mounted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-white text-xl">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-white mb-2">GEM QUEEN</h1>
          <p className="text-purple-200">Instagram Analytics Dashboard</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <KPICard
            title="フォロワー数"
            value="0"
            change="+0"
            icon="F"
          />
          <KPICard
            title="リーチ数"
            value="0"
            icon="R"
          />
          <KPICard
            title="プロフィール表示"
            value="0"
            icon="P"
          />
          <KPICard
            title="Webクリック数"
            value="0"
            icon="W"
          />
          <KPICard
            title="LINE登録者数"
            value="0"
            change="期間内合計"
            icon="L"
          />
        </div>

        {/* Message */}
        <div className="bg-gradient-to-br from-purple-900/30 to-blue-900/30 rounded-xl p-6 backdrop-blur-sm border border-white/10 text-center">
          <h3 className="text-xl font-semibold text-white mb-4">ダッシュボードが正常にデプロイされました！</h3>
          <p className="text-purple-200 mb-4">Google Sheets APIの設定を完了すると、実際のデータが表示されます。</p>
          <div className="text-gray-300 text-sm">
            <p>• フォロワー推移グラフ</p>
            <p>• トップリール・ストーリー</p>
            <p>• デイリーデータ</p>
            <p>• 期間フィルタリング機能</p>
          </div>
        </div>
      </div>
    </div>
  );
}