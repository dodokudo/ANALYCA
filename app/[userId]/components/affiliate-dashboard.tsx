'use client';

import { useState, useEffect, useCallback } from 'react';

interface AffiliateDashboardProps {
  userId: string;
}

interface Referral {
  id: string;
  plan_id: string;
  payment_amount: number;
  commission_amount: number;
  status: string;
  created_at: string;
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return '-';
  }
}

function getStatusLabel(status: string): { text: string; className: string } {
  switch (status) {
    case 'confirmed':
      return { text: '確定', className: 'bg-green-100 text-green-800' };
    case 'paid':
      return { text: '支払済', className: 'bg-blue-100 text-blue-800' };
    default:
      return { text: '保留中', className: 'bg-yellow-100 text-yellow-800' };
  }
}

export default function AffiliateDashboard({ userId }: AffiliateDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [registered, setRegistered] = useState(false);
  const [affiliateCode, setAffiliateCode] = useState<string | null>(null);
  const [totalReferrals, setTotalReferrals] = useState(0);
  const [totalCommission, setTotalCommission] = useState(0);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [registering, setRegistering] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/affiliate/dashboard?userId=${encodeURIComponent(userId)}`);
      const json = await res.json();
      if (json.success) {
        setRegistered(json.registered);
        if (json.registered) {
          setAffiliateCode(json.affiliate_code);
          setTotalReferrals(json.total_referrals);
          setTotalCommission(json.total_commission);
          setReferrals(json.referrals || []);
        }
      }
    } catch {
      setError('データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRegister = async () => {
    setRegistering(true);
    setError(null);
    try {
      const res = await fetch('/api/affiliate/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const json = await res.json();
      if (json.success) {
        setAffiliateCode(json.affiliate_code);
        setRegistered(true);
      } else {
        setError(json.error || '登録に失敗しました');
      }
    } catch {
      setError('通信エラーが発生しました');
    } finally {
      setRegistering(false);
    }
  };

  const handleCopy = async () => {
    if (!affiliateCode) return;
    const url = `https://analyca.jp/?ref=${affiliateCode}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-5 bg-gray-200 rounded w-1/3"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">紹介プログラム</h3>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      {!registered ? (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            ANALYCAを紹介して、初回決済額の50%をコミッションとして受け取れます。
          </p>
          <button
            onClick={handleRegister}
            disabled={registering}
            className="w-full bg-gradient-to-r from-purple-500 to-emerald-400 hover:from-purple-600 hover:to-emerald-500 text-white font-semibold py-3 px-4 rounded-xl transition-all disabled:opacity-50"
          >
            {registering ? '登録中...' : '紹介コードを発行する'}
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {/* 紹介リンク */}
          <div>
            <p className="text-sm text-gray-500 mb-2">あなたの紹介リンク</p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={`https://analyca.jp/?ref=${affiliateCode}`}
                className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 select-all"
              />
              <button
                onClick={handleCopy}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  copied
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {copied ? 'コピー済み' : 'コピー'}
              </button>
            </div>
          </div>

          {/* 集計 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-purple-50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-purple-700">{totalReferrals}</p>
              <p className="text-xs text-purple-600 mt-1">紹介数</p>
            </div>
            <div className="bg-emerald-50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-emerald-700">{totalCommission.toLocaleString()}円</p>
              <p className="text-xs text-emerald-600 mt-1">累計コミッション</p>
            </div>
          </div>

          {/* 紹介実績テーブル */}
          {referrals.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">紹介実績</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 text-gray-500 font-medium">日付</th>
                      <th className="text-left py-2 text-gray-500 font-medium">プラン</th>
                      <th className="text-right py-2 text-gray-500 font-medium">コミッション</th>
                      <th className="text-right py-2 text-gray-500 font-medium">ステータス</th>
                    </tr>
                  </thead>
                  <tbody>
                    {referrals.map((r) => {
                      const status = getStatusLabel(r.status);
                      return (
                        <tr key={r.id} className="border-b border-gray-100">
                          <td className="py-2 text-gray-600">{formatDate(r.created_at)}</td>
                          <td className="py-2 text-gray-600">{r.plan_id || '-'}</td>
                          <td className="py-2 text-right text-gray-900 font-medium">{r.commission_amount.toLocaleString()}円</td>
                          <td className="py-2 text-right">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${status.className}`}>
                              {status.text}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <p className="text-xs text-gray-400">
            コミッションの払い出しについてはお問い合わせください。
          </p>
        </div>
      )}
    </div>
  );
}
