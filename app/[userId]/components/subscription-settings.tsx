'use client';

import { useState, useEffect, useCallback } from 'react';
import { PLANS } from '@/lib/univapay/plans';

interface SubscriptionSettingsProps {
  userId: string;
}

interface SubscriptionData {
  subscription_id: string | null;
  plan_id: string | null;
  subscription_status: string;
  subscription_created_at: string | null;
  subscription_expires_at: string | null;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return '-';
  }
}

function formatPrice(price: number): string {
  return `${price.toLocaleString('ja-JP')}円/月`;
}

function getStatusLabel(status: string): { text: string; className: string } {
  switch (status) {
    case 'current':
      return { text: 'アクティブ', className: 'bg-green-100 text-green-800' };
    case 'unpaid':
      return { text: '未払い', className: 'bg-yellow-100 text-yellow-800' };
    case 'canceled':
      return { text: '解約済み', className: 'bg-gray-100 text-gray-600' };
    case 'suspended':
      return { text: '停止中', className: 'bg-red-100 text-red-800' };
    default:
      return { text: 'なし', className: 'bg-gray-100 text-gray-500' };
  }
}

export default function SubscriptionSettings({ userId }: SubscriptionSettingsProps) {
  const [data, setData] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [cancelResult, setCancelResult] = useState<{ success: boolean; message: string } | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/subscription/status?userId=${encodeURIComponent(userId)}`);
      const json = await res.json();
      if (json.success) {
        setData({
          subscription_id: json.subscription_id,
          plan_id: json.plan_id,
          subscription_status: json.subscription_status,
          subscription_created_at: json.subscription_created_at,
          subscription_expires_at: json.subscription_expires_at,
        });
      } else {
        setError(json.error || 'データの取得に失敗しました');
      }
    } catch {
      setError('通信エラーが発生しました');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleCancel = async () => {
    setCanceling(true);
    setCancelResult(null);
    try {
      const res = await fetch('/api/subscription/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const json = await res.json();
      if (json.success) {
        setCancelResult({ success: true, message: '解約が完了しました' });
        setShowConfirm(false);
        await fetchStatus();
      } else {
        setCancelResult({ success: false, message: json.error || '解約に失敗しました' });
      }
    } catch {
      setCancelResult({ success: false, message: '通信エラーが発生しました' });
    } finally {
      setCanceling(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-5 bg-gray-200 rounded w-1/3"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <p className="text-red-600 text-sm">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const planInfo = data.plan_id ? PLANS[data.plan_id] : null;
  const statusInfo = getStatusLabel(data.subscription_status);
  const isCanceled = data.subscription_status === 'canceled';
  const hasSubscription = data.subscription_id && data.subscription_status !== 'none';

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">サブスクリプション</h3>

      {!hasSubscription ? (
        <p className="text-gray-500 text-sm">プランが設定されていません</p>
      ) : (
        <div className="space-y-4">
          {/* プラン情報 */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">プラン</p>
              <p className="text-base font-medium text-gray-900">
                {planInfo ? `${planInfo.name} (${planInfo.subtitle})` : data.plan_id || '-'}
              </p>
            </div>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusInfo.className}`}>
              {statusInfo.text}
            </span>
          </div>

          {/* 料金 */}
          {planInfo && (
            <div>
              <p className="text-sm text-gray-500">月額料金</p>
              <p className="text-base font-medium text-gray-900">{formatPrice(planInfo.price)}</p>
            </div>
          )}

          {/* 開始日 */}
          {data.subscription_created_at && (
            <div>
              <p className="text-sm text-gray-500">利用開始日</p>
              <p className="text-sm text-gray-900">{formatDate(data.subscription_created_at)}</p>
            </div>
          )}

          {/* 解約済みの場合: 利用期限表示 */}
          {isCanceled && data.subscription_expires_at && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-sm text-amber-800">
                {formatDate(data.subscription_expires_at)}までご利用いただけます
              </p>
            </div>
          )}

          {/* 解約結果メッセージ */}
          {cancelResult && (
            <div className={`rounded-lg p-3 text-sm ${cancelResult.success ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
              {cancelResult.message}
            </div>
          )}

          {/* 解約ボタン（アクティブ or 未払い時のみ表示） */}
          {!isCanceled && (data.subscription_status === 'current' || data.subscription_status === 'unpaid') && (
            <div className="pt-2">
              {!showConfirm ? (
                <button
                  onClick={() => setShowConfirm(true)}
                  className="text-sm text-gray-500 underline hover:text-gray-700 transition-colors"
                >
                  サブスクリプションを解約する
                </button>
              ) : (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
                  <p className="text-sm text-gray-700">
                    本当に解約しますか？解約後も次回課金日までご利用いただけます。
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={handleCancel}
                      disabled={canceling}
                      className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {canceling ? '処理中...' : '解約する'}
                    </button>
                    <button
                      onClick={() => setShowConfirm(false)}
                      disabled={canceling}
                      className="px-4 py-2 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                    >
                      キャンセル
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
