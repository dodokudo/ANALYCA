'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export interface LinkLineDailyMetricView {
  date: string;
  linkClicks: number;
  lineFollowers: number | null;
}

export interface LinkLineOptionView {
  optionCode: 'link-line';
  name: string;
  price: number;
  status: string;
  subscriptionId: string | null;
  startedAt: string | null;
  expiresAt: string | null;
  canceledAt: string | null;
  hasAccess: boolean;
  isCancelScheduled: boolean;
  lineConfigured: boolean;
  lineAccountName: string | null;
  metrics: {
    totalLinkClicks: number;
    latestLineFollowers: number | null;
    latestLineDate: string | null;
    daily: LinkLineDailyMetricView[];
  };
}

export interface LinkLineOptionStatusResponse {
  success: boolean;
  option?: LinkLineOptionView;
  error?: string;
}

interface OptionDashboardProps {
  userId: string;
  initialData?: LinkLineOptionStatusResponse | null;
  onStatusChange?: (status: LinkLineOptionStatusResponse) => void;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function OptionDashboard({
  userId,
  initialData = null,
  onStatusChange,
}: OptionDashboardProps) {
  const router = useRouter();
  const [data, setData] = useState<LinkLineOptionStatusResponse | null>(initialData);
  const [loading, setLoading] = useState(!initialData);
  const [processing, setProcessing] = useState<'subscribe' | 'cancel' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [requiresPaymentMethod, setRequiresPaymentMethod] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const applyStatus = useCallback((next: LinkLineOptionStatusResponse) => {
    setData(next);
    onStatusChange?.(next);
  }, [onStatusChange]);

  useEffect(() => {
    if (initialData) {
      setData(initialData);
      setLoading(false);
      return;
    }

    let cancelled = false;
    fetch(`/api/options/link-line/status?userId=${encodeURIComponent(userId)}`)
      .then((response) => response.json())
      .then((result: LinkLineOptionStatusResponse) => {
        if (!cancelled) applyStatus(result);
      })
      .catch(() => {
        if (!cancelled) setData({ success: false, error: 'オプション情報の取得に失敗しました' });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [applyStatus, initialData, userId]);

  const subscribe = async () => {
    setProcessing('subscribe');
    setMessage(null);
    setRequiresPaymentMethod(false);
    try {
      const response = await fetch('/api/options/link-line/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          requestId: crypto.randomUUID(),
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        setRequiresPaymentMethod(Boolean(result.requiresPaymentMethod));
        throw new Error(result.error || 'オプション契約に失敗しました');
      }
      applyStatus({ success: true, option: result.option });
      setMessage('オプションを有効にしました。Threadsの「リンク登録」から初期設定できます。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'オプション契約に失敗しました');
    } finally {
      setProcessing(null);
    }
  };

  const cancelOption = async () => {
    setProcessing('cancel');
    setMessage(null);
    try {
      const response = await fetch('/api/options/link-line/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'オプション解約に失敗しました');
      }
      applyStatus({ success: true, option: result.option });
      setShowCancelConfirm(false);
      setMessage(`解約を受け付けました。${formatDate(result.option?.expiresAt)}まで利用できます。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'オプション解約に失敗しました');
    } finally {
      setProcessing(null);
    }
  };

  const option = data?.option;
  const isPending = option && ['unverified', 'unconfirmed'].includes(option.status.toLowerCase());

  if (loading) {
    return (
      <div className="ui-card p-8 text-center text-sm text-[color:var(--color-text-secondary)]">
        オプション情報を読み込んでいます...
      </div>
    );
  }

  return (
    <div className="section-stack pb-20 lg:pb-6">
      <div>
        <p className="text-sm font-semibold text-purple-600">ANALYCA オプション</p>
        <h2 className="mt-1 text-2xl font-bold text-[color:var(--color-text-primary)]">必要な機能だけ追加</h2>
        <p className="mt-2 text-sm text-[color:var(--color-text-secondary)]">
          基本プランとは別契約です。保存済みカードがあれば、ワンクリックで利用を開始できます。
        </p>
      </div>

      <section className="overflow-hidden rounded-2xl border border-purple-200 bg-white shadow-sm">
        <div className="bg-gradient-to-r from-purple-600 to-emerald-500 px-5 py-4 text-white">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-xl font-bold">リンク計測・LINE連携オプション</h3>
              <p className="mt-1 text-sm text-white/85">
                ThreadsダッシュボードにURLクリック数とLINE友だち数を追加
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold">¥4,980</p>
              <p className="text-xs text-white/80">税込・月額</p>
            </div>
          </div>
        </div>

        <div className="p-5 md:p-6">
          <div className="grid gap-3 md:grid-cols-2">
            {[
              ['URLクリック数を計測', 'ANALYCAの専用URLを発行し、クリック数を日別に集計します。'],
              ['LINE友だち数を毎日自動取得', 'LINEのアクセストークンを登録すると、友だち数を毎日自動で取得します。'],
            ].map(([title, description]) => (
              <div key={title} className="rounded-xl bg-[color:var(--color-surface-muted)] p-4">
                <div className="flex gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">
                    ✓
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-[color:var(--color-text-primary)]">{title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-[color:var(--color-text-secondary)]">{description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {message && (
            <div className={`mt-5 rounded-xl px-4 py-3 text-sm ${
              data?.success ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'
            }`}>
              {message}
            </div>
          )}

          <div className="mt-6 border-t border-[color:var(--color-border)] pt-5">
            {option?.hasAccess ? (
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                      {option.status === 'complimentary'
                        ? '無償付与'
                        : option.isCancelScheduled
                          ? '解約受付済み'
                          : '利用中'}
                    </span>
                    {option.lineConfigured && (
                      <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                        LINE連携済み
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-[color:var(--color-text-secondary)]">
                    {option.status === 'complimentary'
                      ? 'このアカウントには無償で付与されています'
                      : option.isCancelScheduled
                      ? `${formatDate(option.expiresAt)}まで利用できます`
                      : `次回更新の目安: ${formatDate(option.expiresAt)}`}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => router.replace(`/${userId}?tab=threads&threadsTab=links`)}
                    className="rounded-xl bg-[color:var(--color-accent)] px-5 py-3 text-sm font-semibold text-white hover:opacity-90"
                  >
                    リンク登録を開く
                  </button>
                  {!option.isCancelScheduled && option.status !== 'complimentary' && (
                    <button
                      type="button"
                      onClick={() => setShowCancelConfirm(true)}
                      className="rounded-xl border border-[color:var(--color-border)] px-4 py-3 text-sm font-medium text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-surface-muted)]"
                    >
                      解約する
                    </button>
                  )}
                </div>
              </div>
            ) : isPending ? (
              <div className="rounded-xl bg-blue-50 px-4 py-4 text-sm text-blue-800">
                決済を確認しています。確認後、自動的にオプションが有効になります。
              </div>
            ) : (
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-[color:var(--color-text-primary)]">すぐに利用を開始できます</p>
                  <p className="mt-1 text-xs text-[color:var(--color-text-secondary)]">
                    月額4,980円で自動更新されます。いつでも解約できます。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={subscribe}
                  disabled={processing !== null}
                  className="rounded-xl bg-gradient-to-r from-purple-600 to-emerald-500 px-6 py-3 text-sm font-bold text-white shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {processing === 'subscribe' ? '契約処理中...' : '月額4,980円で有効にする'}
                </button>
              </div>
            )}

            {requiresPaymentMethod && (
              <button
                type="button"
                onClick={() => router.replace(`/${userId}?tab=settings`)}
                className="mt-3 text-sm font-semibold text-purple-700 underline"
              >
                カード情報を登録する
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-dashed border-[color:var(--color-border)] bg-white/70 p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">今後追加予定</span>
            <h3 className="mt-3 text-lg font-bold text-[color:var(--color-text-primary)]">Threadsデイリーレポート</h3>
            <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">
              毎日のThreads投稿数・インプレッション・フォロワー増加数などがLINEに届くようになります。
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-[color:var(--color-text-primary)]">月額 ¥980</p>
            <span className="text-sm font-medium text-[color:var(--color-text-muted)]">準備中</span>
          </div>
        </div>
      </section>

      {showCancelConfirm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="解約確認を閉じる"
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowCancelConfirm(false)}
          />
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-[color:var(--color-text-primary)]">オプションを解約しますか？</h3>
            <p className="mt-3 text-sm leading-relaxed text-[color:var(--color-text-secondary)]">
              次回の自動更新を停止します。支払済み期限までは利用でき、登録済みリンクと履歴は残ります。
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCancelConfirm(false)}
                className="rounded-xl border border-[color:var(--color-border)] px-4 py-2.5 text-sm font-medium"
              >
                戻る
              </button>
              <button
                type="button"
                onClick={cancelOption}
                disabled={processing !== null}
                className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {processing === 'cancel' ? '解約処理中...' : '解約を確定する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
