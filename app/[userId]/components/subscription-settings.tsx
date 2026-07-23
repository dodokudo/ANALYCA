'use client';

import { useState, useEffect, useCallback } from 'react';
import Script from 'next/script';
import {
  getMonthlyEquivalentPrice,
  getPlanBillingCycle,
  getPlanIdForBillingCycle,
  PLANS,
  PUBLIC_PLAN_BASE_IDS,
  type PlanBillingCycle,
  type PublicPlanBaseId,
} from '@/lib/univapay/plans';

declare global {
interface Window {
    UnivapayCheckout: {
      submit: (iframe: Element) => Promise<{ id: string; [key: string]: unknown }>;
    };
  }
}

interface SubscriptionSettingsProps {
  userId: string;
  initialData?: SubscriptionStatusResponse | null;
}

export interface SubscriptionStatusResponse {
  success: boolean;
  error?: string;
  subscription_id: string | null;
  plan_id: string | null;
  subscription_status: string;
  subscription_created_at: string | null;
  subscription_expires_at: string | null;
  trial_ends_at: string | null;
  pending_plan_id?: string | null;
  pending_subscription_id?: string | null;
  plan_change_effective_at?: string | null;
}

interface SubscriptionData {
  subscription_id: string | null;
  plan_id: string | null;
  subscription_status: string;
  subscription_created_at: string | null;
  subscription_expires_at: string | null;
  trial_ends_at: string | null;
  pending_plan_id: string | null;
  pending_subscription_id: string | null;
  plan_change_effective_at: string | null;
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

function formatPrice(planId: string, price: number): string {
  if (getPlanBillingCycle(planId) === 'yearly') {
    return `${price.toLocaleString('ja-JP')}円/年（月あたり${getMonthlyEquivalentPrice(planId).toLocaleString('ja-JP')}円）`;
  }
  return `${price.toLocaleString('ja-JP')}円/月`;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return '[unserializable]';
  }
}

function getStatusLabel(status: string): { text: string; className: string } {
  switch (status) {
    case 'current':
    case 'active':
      return { text: 'アクティブ', className: 'bg-green-100 text-green-800' };
    case 'trial':
      return { text: '7日間無料体験中', className: 'bg-blue-100 text-blue-800' };
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

function toSubscriptionData(json: SubscriptionStatusResponse): SubscriptionData {
  return {
    subscription_id: json.subscription_id,
    plan_id: json.plan_id,
    subscription_status: json.subscription_status,
    subscription_created_at: json.subscription_created_at,
    subscription_expires_at: json.subscription_expires_at,
    trial_ends_at: json.trial_ends_at,
    pending_plan_id: json.pending_plan_id ?? null,
    pending_subscription_id: json.pending_subscription_id ?? null,
    plan_change_effective_at: json.plan_change_effective_at ?? null,
  };
}

export default function SubscriptionSettings({ userId, initialData = null }: SubscriptionSettingsProps) {
  const [data, setData] = useState<SubscriptionData | null>(
    initialData?.success ? toSubscriptionData(initialData) : null
  );
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(
    initialData && !initialData.success ? initialData.error || 'データの取得に失敗しました' : null
  );
  const [showConfirm, setShowConfirm] = useState(false);
  const [showPlanChangeConfirm, setShowPlanChangeConfirm] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [changingPlan, setChangingPlan] = useState(false);
  const [selectedBasePlanId, setSelectedBasePlanId] = useState<PublicPlanBaseId>('light-threads');
  const [selectedBillingCycle, setSelectedBillingCycle] = useState<PlanBillingCycle>('monthly');
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [paymentAppId, setPaymentAppId] = useState<string | null>(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [updatingPayment, setUpdatingPayment] = useState(false);
  const [cancelResult, setCancelResult] = useState<{ success: boolean; message: string } | null>(null);
  const [planChangeResult, setPlanChangeResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [paymentResult, setPaymentResult] = useState<{ success: boolean; message: string } | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/subscription/status?userId=${encodeURIComponent(userId)}`);
      const json = (await res.json()) as SubscriptionStatusResponse;
      if (json.success) {
        setData(toSubscriptionData(json));
        setError(null);
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
    if (initialData) return;
    fetchStatus();
  }, [fetchStatus, initialData]);

  useEffect(() => {
    if (!initialData) return;
    if (initialData.success) {
      setData(toSubscriptionData(initialData));
      setError(null);
    } else {
      setError(initialData.error || 'データの取得に失敗しました');
    }
    setLoading(false);
  }, [initialData]);

  useEffect(() => {
    if (!data?.plan_id) return;
    const basePlanId = data.plan_id.replace(/-yearly$/, '') as PublicPlanBaseId;
    if (PUBLIC_PLAN_BASE_IDS.includes(basePlanId)) {
      setSelectedBasePlanId(basePlanId);
    }
    setSelectedBillingCycle(getPlanBillingCycle(data.plan_id));
  }, [data?.plan_id]);

  useEffect(() => {
    fetch('/api/payment/config')
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.config?.appId) {
          setPaymentAppId(json.config.appId);
        }
      })
      .catch((err) => {
        console.error('[subscription-settings] payment config load failed:', err);
      });
  }, []);

  const handleCancel = async () => {
    setCanceling(true);
    setCancelResult(null);
    try {
      const endpoint = data?.subscription_status === 'trial'
        ? '/api/trial/cancel'
        : '/api/subscription/cancel';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const json = await res.json();
      if (json.success) {
        const message = data?.subscription_status === 'trial'
          ? '無料体験を解約しました。今後課金は発生しません。'
          : '解約が完了しました';
        setCancelResult({ success: true, message });
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

  const handlePlanChange = async () => {
    const targetPlanId = getPlanIdForBillingCycle(selectedBasePlanId, selectedBillingCycle);
    setChangingPlan(true);
    setPlanChangeResult(null);
    try {
      const res = await fetch('/api/subscription/change-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, targetPlanId }),
      });
      const json = await res.json();

      if (json.success) {
        setPlanChangeResult({ success: true, message: json.message || 'プラン変更を予約しました' });
        setShowPlanChangeConfirm(false);
        await fetchStatus();
      } else {
        setPlanChangeResult({
          success: false,
          message: json.error || 'プラン変更に失敗しました',
        });
      }
    } catch {
      setPlanChangeResult({ success: false, message: '通信エラーが発生しました' });
    } finally {
      setChangingPlan(false);
    }
  };

  const handlePaymentMethodUpdate = async () => {
    const iframe = document.querySelector('#univapay-card-update iframe');
    if (!iframe || !window.UnivapayCheckout) {
      setPaymentResult({ success: false, message: 'カード入力フォームの準備ができていません。ページを再読み込みしてください。' });
      return;
    }

    setUpdatingPayment(true);
    setPaymentResult(null);
    try {
      const data = await window.UnivapayCheckout.submit(iframe);
      const raw = data as Record<string, unknown>;
      const tokenId =
        asString(raw.token) ||
        asString(raw.transactionToken) ||
        asString(raw.id) ||
        asString(raw.transactionTokenId);

      if (!tokenId) {
        console.error('[subscription-settings] token response:', safeStringify(data));
        setPaymentResult({ success: false, message: 'カード情報の取得に失敗しました' });
        return;
      }

      const res = await fetch('/api/subscription/payment-method', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, transactionTokenId: tokenId }),
      });
      const json = await res.json();

      if (json.success) {
        setPaymentResult({ success: true, message: 'カード情報を更新しました' });
        setShowPaymentForm(false);
        await fetchStatus();
      } else {
        setPaymentResult({ success: false, message: json.error || 'カード変更に失敗しました' });
      }
    } catch (err) {
      setPaymentResult({
        success: false,
        message: err instanceof Error ? err.message : 'カード変更に失敗しました',
      });
    } finally {
      setUpdatingPayment(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">サブスクリプション</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="h-3 w-10 bg-gray-100 rounded"></div>
              <div className="h-4 w-32 bg-gray-100 rounded animate-pulse"></div>
            </div>
            <div className="h-5 w-16 bg-gray-100 rounded-full animate-pulse"></div>
          </div>
          <div className="space-y-2">
            <div className="h-3 w-14 bg-gray-100 rounded"></div>
            <div className="h-4 w-24 bg-gray-100 rounded animate-pulse"></div>
          </div>
          <div className="space-y-2">
            <div className="h-3 w-14 bg-gray-100 rounded"></div>
            <div className="h-4 w-28 bg-gray-100 rounded animate-pulse"></div>
          </div>
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
  const isTrial = data.subscription_status === 'trial';
  const hasSubscription = data.subscription_id && data.subscription_status !== 'none';
  const targetPlanId = getPlanIdForBillingCycle(selectedBasePlanId, selectedBillingCycle);
  const targetPlanInfo = PLANS[targetPlanId];
  const pendingPlanInfo = data.pending_plan_id ? PLANS[data.pending_plan_id] : null;
  const canChangePlan = ['current', 'active', 'trial'].includes(data.subscription_status);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <Script
        src="https://widget.univapay.com/client/checkout.js"
        strategy="afterInteractive"
        onLoad={() => setScriptLoaded(true)}
      />
      <h3 className="text-lg font-semibold text-gray-900 mb-4">サブスクリプション</h3>

      {!hasSubscription ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <p className="text-sm font-medium text-gray-900">契約はありません</p>
          <p className="mt-1 text-sm text-gray-600">
            このダッシュボードは無料ログインで作成されています。カード登録・サブスクリプションがないため、解約処理は不要です。
          </p>
        </div>
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
              <p className="text-base font-medium text-gray-900">{formatPrice(data.plan_id || '', planInfo.price)}</p>
            </div>
          )}

          {/* 開始日 */}
          {data.subscription_created_at && (
            <div>
              <p className="text-sm text-gray-500">利用開始日</p>
              <p className="text-sm text-gray-900">{formatDate(data.subscription_created_at)}</p>
            </div>
          )}

          {/* 無料体験終了日（trial時） */}
          {isTrial && data.trial_ends_at && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm font-medium text-blue-900 mb-1">7日間無料体験中</p>
              <p className="text-sm text-blue-800">
                {formatDate(data.trial_ends_at)}に初回課金が発生します
              </p>
              <p className="text-xs text-blue-600 mt-2">
                体験期間中に解約すれば課金は発生しません
              </p>
            </div>
          )}

          {/* 次回更新日（アクティブ時） */}
          {!isCanceled && !isTrial && data.subscription_expires_at && (
            <div>
              <p className="text-sm text-gray-500">次回更新日</p>
              <p className="text-sm text-gray-900">{formatDate(data.subscription_expires_at)}</p>
            </div>
          )}

          {/* 解約済みの場合: 利用期限表示 */}
          {isCanceled && data.subscription_expires_at && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm font-medium text-amber-900 mb-1">解約済み</p>
              <p className="text-sm text-amber-800">
                {formatDate(data.subscription_expires_at)}まで利用可能です
              </p>
              {data.subscription_created_at && (
                <p className="text-xs text-amber-600 mt-2">
                  利用開始日: {formatDate(data.subscription_created_at)}
                </p>
              )}
            </div>
          )}

          {/* 解約結果メッセージ */}
          {cancelResult && (
            <div className={`rounded-lg p-3 text-sm ${cancelResult.success ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
              {cancelResult.message}
            </div>
          )}

          {planChangeResult && (
            <div className={`rounded-lg p-3 text-sm ${planChangeResult.success ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
              <p>{planChangeResult.message}</p>
            </div>
          )}

          {paymentResult && (
            <div className={`rounded-lg p-3 text-sm ${paymentResult.success ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
              {paymentResult.message}
            </div>
          )}

          {canChangePlan && !isCanceled && (
            <div className="rounded-xl border border-purple-200 bg-gradient-to-r from-purple-50 to-emerald-50 p-4">
              <h4 className="text-sm font-semibold text-gray-900">プラン変更</h4>
              <p className="mt-1 text-xs text-gray-600">
                変更は次回更新日に反映され、途中の追加請求や返金はありません。
              </p>

              {pendingPlanInfo && data.plan_change_effective_at ? (
                <div className="mt-3 rounded-lg border border-purple-200 bg-white/80 p-3">
                  <p className="text-xs font-semibold text-purple-900">プラン変更を予約済みです</p>
                  <p className="mt-1 text-sm font-medium text-gray-900">
                    {formatDate(data.plan_change_effective_at)}から {pendingPlanInfo.name}（{pendingPlanInfo.subtitle}）
                  </p>
                  <p className="mt-1 text-xs text-gray-600">
                    {formatPrice(data.pending_plan_id || '', pendingPlanInfo.price)}
                  </p>
                </div>
              ) : (
                <>
                  <div className="mt-4 inline-flex w-full rounded-lg bg-white p-1 shadow-sm">
                    <button
                      type="button"
                      aria-pressed={selectedBillingCycle === 'monthly'}
                      onClick={() => {
                        setSelectedBillingCycle('monthly');
                        setShowPlanChangeConfirm(false);
                      }}
                      className={`flex-1 rounded-md px-3 py-2 text-xs font-semibold transition-colors ${
                        selectedBillingCycle === 'monthly'
                          ? 'bg-purple-600 text-white'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      月払い
                    </button>
                    <button
                      type="button"
                      aria-pressed={selectedBillingCycle === 'yearly'}
                      onClick={() => {
                        setSelectedBillingCycle('yearly');
                        setShowPlanChangeConfirm(false);
                      }}
                      className={`flex-1 rounded-md px-3 py-2 text-xs font-semibold transition-colors ${
                        selectedBillingCycle === 'yearly'
                          ? 'bg-purple-600 text-white'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      年払い <span className="ml-1 text-emerald-300">20%OFF</span>
                    </button>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    {PUBLIC_PLAN_BASE_IDS.map((basePlanId) => {
                      const optionPlanId = getPlanIdForBillingCycle(basePlanId, selectedBillingCycle);
                      const option = PLANS[optionPlanId];
                      const selected = selectedBasePlanId === basePlanId;
                      return (
                        <button
                          key={basePlanId}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => {
                            setSelectedBasePlanId(basePlanId);
                            setShowPlanChangeConfirm(false);
                          }}
                          className={`rounded-lg border p-3 text-left transition-colors ${
                            selected
                              ? 'border-purple-500 bg-white ring-1 ring-purple-500'
                              : 'border-gray-200 bg-white/70 hover:border-purple-300'
                          }`}
                        >
                          <span className="block text-sm font-semibold text-gray-900">{option.name}</span>
                          <span className="mt-1 block text-[11px] leading-tight text-gray-500">{option.subtitle}</span>
                          <span className="mt-2 block text-xs font-semibold text-gray-900">
                            {selectedBillingCycle === 'yearly'
                              ? `月あたり${getMonthlyEquivalentPrice(optionPlanId).toLocaleString('ja-JP')}円`
                              : `${option.price.toLocaleString('ja-JP')}円/月`}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {!showPlanChangeConfirm ? (
                    <button
                      type="button"
                      onClick={() => {
                        setPlanChangeResult(null);
                        setShowPlanChangeConfirm(true);
                      }}
                      disabled={targetPlanId === data.plan_id}
                      className="mt-3 w-full rounded-lg bg-gradient-to-r from-purple-500 to-emerald-400 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:from-purple-600 hover:to-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {targetPlanId === data.plan_id ? '現在のプランです' : '変更内容を確認'}
                    </button>
                  ) : (
                    <div className="mt-3 rounded-lg border border-purple-200 bg-white/90 p-3">
                      <p className="text-xs font-semibold text-gray-900">この内容で変更を予約しますか？</p>
                      <p className="mt-2 text-sm font-medium text-gray-900">
                        {targetPlanInfo.name}（{targetPlanInfo.subtitle}）
                      </p>
                      <p className="mt-1 text-xs text-gray-600">{formatPrice(targetPlanId, targetPlanInfo.price)}</p>
                      <p className="mt-2 text-xs leading-relaxed text-gray-600">
                        次回更新日の{formatDate(data.subscription_expires_at)}から変更されます。
                        それまでは現在のプランを利用できます。
                      </p>
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={handlePlanChange}
                          disabled={changingPlan}
                          className="flex-1 rounded-lg bg-gradient-to-r from-purple-500 to-emerald-400 px-3 py-2 text-xs font-semibold text-white transition-all hover:from-purple-600 hover:to-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {changingPlan ? '予約中...' : '変更を予約する'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowPlanChangeConfirm(false)}
                          disabled={changingPlan}
                          className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-60"
                        >
                          戻る
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {!isCanceled && (isTrial || data.subscription_status === 'current' || data.subscription_status === 'unpaid' || data.subscription_status === 'suspended') && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-sm font-semibold text-gray-900">カード情報</h4>
                  <p className="mt-1 text-xs text-gray-600">次回以降の決済に使うカードを変更できます。</p>
                </div>
                {!showPaymentForm && (
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentResult(null);
                      setShowPaymentForm(true);
                    }}
                    className="shrink-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    カード変更
                  </button>
                )}
              </div>

              {showPaymentForm && (
                <div className="mt-4 rounded-lg border border-gray-200 bg-white p-4">
                  <div id="univapay-card-update" className="min-h-[320px]">
                    {paymentAppId ? (
                      <span
                        data-app-id={paymentAppId}
                        data-checkout="token"
                        data-amount={planInfo?.price || 0}
                        data-currency="jpy"
                        data-inline="true"
                        data-cvv-authorize="true"
                        data-require-phone-number="false"
                        data-phone-number="00000000000"
                        data-inline-item-style="padding: 10px 0; border-bottom: none;"
                        data-inline-item-label-style="color: #4b5563; font-size: 13px; font-weight: 600; margin-bottom: 6px;"
                        data-inline-text-field-style="border: 1.5px solid #e5e7eb; border-radius: 10px; padding: 14px 16px; font-size: 15px; background: #fafafa; width: 100%; box-sizing: border-box;"
                        data-inline-field-focus-style="border-color: #8b5cf6; background: #fff; box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);"
                        data-inline-field-invalid-style="border-color: #ef4444; box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);"
                      />
                    ) : (
                      <div className="flex h-[240px] items-center justify-center text-sm text-gray-400">読み込み中...</div>
                    )}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={handlePaymentMethodUpdate}
                      disabled={!scriptLoaded || !paymentAppId || updatingPayment}
                      className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {updatingPayment ? '更新中...' : 'このカードに変更'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowPaymentForm(false)}
                      disabled={updatingPayment}
                      className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                    >
                      キャンセル
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 解約ボタン（trial / アクティブ / 未払い時に表示） */}
          {!isCanceled && (isTrial || data.subscription_status === 'current' || data.subscription_status === 'unpaid') && (
            <div className="pt-2">
              {!showConfirm ? (
                <button
                  onClick={() => setShowConfirm(true)}
                  className="text-sm text-gray-500 underline hover:text-gray-700 transition-colors"
                >
                  {isTrial ? '無料体験を解約する' : 'サブスクリプションを解約する'}
                </button>
              ) : (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
                  <p className="text-sm text-gray-700">
                    {isTrial
                      ? '本当に無料体験を解約しますか？解約すると今後課金は発生せず、すぐにサービスが利用できなくなります。'
                      : '本当に解約しますか？解約後も次回課金日までご利用いただけます。'}
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
