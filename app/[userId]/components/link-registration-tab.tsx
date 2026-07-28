'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import type {
  LinkLineOptionStatusResponse,
  LinkLineOptionView,
} from './option-dashboard';

interface ShortLinkView {
  id: string;
  userId: string;
  shortCode: string;
  slug: string;
  managementName: string | null;
  destinationUrl: string;
  title: string | null;
  description: string | null;
  ogpImageUrl: string | null;
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  totalClicks: number;
  lastClickedAt: string | null;
}

interface LinkFormState {
  slug: string;
  managementName: string;
  destinationUrl: string;
  title: string;
  description: string;
  ogpImageUrl: string;
}

const EMPTY_FORM: LinkFormState = {
  slug: '',
  managementName: '',
  destinationUrl: '',
  title: '',
  description: '',
  ogpImageUrl: '',
};

interface LinkRegistrationTabProps {
  userId: string;
  option: LinkLineOptionView;
  onStatusChange?: (status: LinkLineOptionStatusResponse) => void;
}

function formatDate(value: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('ja-JP');
}

export default function LinkRegistrationTab({
  userId,
  option,
  onStatusChange,
}: LinkRegistrationTabProps) {
  const [links, setLinks] = useState<ShortLinkView[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<LinkFormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingLink, setSavingLink] = useState(false);
  const [lineAccessToken, setLineAccessToken] = useState('');
  const [savingLine, setSavingLine] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://analyca.jp';

  const loadLinks = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/options/link-line/links?userId=${encodeURIComponent(userId)}`);
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'リンク一覧の取得に失敗しました');
      setLinks(result.links || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'リンク一覧の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadLinks();
  }, [loadLinks]);

  const recentDaily = useMemo(() => option.metrics.daily.slice(0, 31), [option.metrics.daily]);

  const saveLineSettings = async (event: FormEvent) => {
    event.preventDefault();
    if (!lineAccessToken.trim()) return;
    setSavingLine(true);
    setMessage(null);
    try {
      const response = await fetch('/api/options/link-line/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, accessToken: lineAccessToken }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'LINE初期設定に失敗しました');
      setLineAccessToken('');
      onStatusChange?.({ success: true, option: result.option });
      setMessage(result.syncWarning
        ? `LINE連携を保存しました。${result.syncWarning}`
        : 'LINE連携を保存し、友だち数を取得しました。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'LINE初期設定に失敗しました');
    } finally {
      setSavingLine(false);
    }
  };

  const saveLink = async (event: FormEvent) => {
    event.preventDefault();
    setSavingLink(true);
    setMessage(null);
    try {
      const endpoint = editingId
        ? `/api/options/link-line/links/${encodeURIComponent(editingId)}`
        : '/api/options/link-line/links';
      const response = await fetch(endpoint, {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, ...form }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'リンク保存に失敗しました');
      setForm(EMPTY_FORM);
      setEditingId(null);
      await loadLinks();
      setMessage(editingId ? 'リンクを更新しました。' : '計測リンクを発行しました。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'リンク保存に失敗しました');
    } finally {
      setSavingLink(false);
    }
  };

  const startEdit = (link: ShortLinkView) => {
    setEditingId(link.id);
    setForm({
      slug: link.slug,
      managementName: link.managementName || '',
      destinationUrl: link.destinationUrl,
      title: link.title || '',
      description: link.description || '',
      ogpImageUrl: link.ogpImageUrl || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const stopLink = async (link: ShortLinkView) => {
    if (!window.confirm(`「${link.managementName || link.slug}」を停止しますか？`)) return;
    setMessage(null);
    try {
      const response = await fetch(`/api/options/link-line/links/${encodeURIComponent(link.id)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'リンク停止に失敗しました');
      await loadLinks();
      setMessage('リンクを停止しました。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'リンク停止に失敗しました');
    }
  };

  const copyLink = async (link: ShortLinkView) => {
    await navigator.clipboard.writeText(`${appUrl}/l/${link.shortCode}`);
    setMessage('計測リンクをコピーしました。');
  };

  return (
    <div className="section-stack">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="ui-card p-4">
          <p className="text-xs font-medium text-[color:var(--color-text-secondary)]">リンククリック累計</p>
          <p className="mt-2 text-2xl font-bold text-[color:var(--color-text-primary)]">
            {option.metrics.totalLinkClicks.toLocaleString()}
          </p>
        </div>
        <div className="ui-card p-4">
          <p className="text-xs font-medium text-[color:var(--color-text-secondary)]">LINE友だち数</p>
          <p className="mt-2 text-2xl font-bold text-[color:var(--color-text-primary)]">
            {option.metrics.latestLineFollowers?.toLocaleString() ?? '-'}
          </p>
          <p className="mt-1 text-xs text-[color:var(--color-text-muted)]">
            {option.metrics.latestLineDate || 'LINE未連携'}
          </p>
        </div>
        <div className="ui-card p-4">
          <p className="text-xs font-medium text-[color:var(--color-text-secondary)]">発行リンク</p>
          <p className="mt-2 text-2xl font-bold text-[color:var(--color-text-primary)]">
            {links.filter((link) => link.isActive).length}
          </p>
        </div>
      </div>

      <section className="ui-card p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-[color:var(--color-text-primary)]">LINE初期設定</h3>
            <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">
              Messaging APIのチャンネルアクセストークン（長期）を登録します。
            </p>
          </div>
          {option.lineConfigured && (
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
              {option.lineAccountName || '連携済み'}
            </span>
          )}
        </div>
        <form onSubmit={saveLineSettings} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            type="password"
            value={lineAccessToken}
            onChange={(event) => setLineAccessToken(event.target.value)}
            placeholder={option.lineConfigured ? '新しいトークンへ変更する場合のみ入力' : 'チャンネルアクセストークンを貼り付け'}
            autoComplete="off"
            className="h-11 min-w-0 flex-1 rounded-xl border border-[color:var(--color-border)] bg-white px-3 text-sm"
          />
          <button
            type="submit"
            disabled={savingLine || !lineAccessToken.trim()}
            className="h-11 rounded-xl bg-[#06C755] px-5 text-sm font-bold text-white disabled:opacity-50"
          >
            {savingLine ? '確認中...' : option.lineConfigured ? 'トークンを更新' : 'LINEを連携'}
          </button>
        </form>
        <details className="mt-4 rounded-xl bg-[color:var(--color-surface-muted)] p-4">
          <summary className="cursor-pointer text-sm font-semibold text-[color:var(--color-text-primary)]">
            アクセストークンの取得方法
          </summary>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-[color:var(--color-text-secondary)]">
            <li>LINE Developersコンソールへログイン</li>
            <li>対象のプロバイダーとMessaging APIチャネルを選択</li>
            <li>「Messaging API設定」を開く</li>
            <li>チャンネルアクセストークン（長期）を発行して貼り付け</li>
          </ol>
          <a
            href="https://developers.line.biz/console/"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex text-sm font-semibold text-[#06C755] underline"
          >
            LINE Developersコンソールを開く
          </a>
        </details>
      </section>

      <section className="ui-card p-5 md:p-6">
        <div>
          <h3 className="text-lg font-bold text-[color:var(--color-text-primary)]">
            {editingId ? 'リンクを編集' : '計測リンクを新規発行'}
          </h3>
          <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">
            OGPはSNSでリンクをシェアしたときのタイトル・説明・画像です。
          </p>
        </div>
        <form onSubmit={saveLink} className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium text-[color:var(--color-text-secondary)]">
            管理名
            <input
              value={form.managementName}
              onChange={(event) => setForm((current) => ({ ...current, managementName: event.target.value }))}
              placeholder="例: Threadsプロフィール"
              className="mt-1.5 h-11 w-full rounded-xl border border-[color:var(--color-border)] px-3"
            />
          </label>
          <label className="text-sm font-medium text-[color:var(--color-text-secondary)]">
            リンクID
            <div className="mt-1.5 flex h-11 overflow-hidden rounded-xl border border-[color:var(--color-border)] bg-white">
              <span className="flex items-center bg-slate-50 px-3 text-xs text-slate-500">/l/{userId}/</span>
              <input
                value={form.slug}
                onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))}
                placeholder="profile"
                disabled={Boolean(editingId)}
                required
                className="min-w-0 flex-1 px-3 text-sm disabled:bg-slate-50"
              />
            </div>
          </label>
          <label className="text-sm font-medium text-[color:var(--color-text-secondary)] md:col-span-2">
            遷移先URL
            <input
              type="url"
              value={form.destinationUrl}
              onChange={(event) => setForm((current) => ({ ...current, destinationUrl: event.target.value }))}
              placeholder="https://example.com/"
              required
              className="mt-1.5 h-11 w-full rounded-xl border border-[color:var(--color-border)] px-3"
            />
          </label>
          <label className="text-sm font-medium text-[color:var(--color-text-secondary)]">
            OGPタイトル
            <input
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="シェア時に表示するタイトル"
              className="mt-1.5 h-11 w-full rounded-xl border border-[color:var(--color-border)] px-3"
            />
          </label>
          <label className="text-sm font-medium text-[color:var(--color-text-secondary)]">
            OGP画像URL
            <input
              type="url"
              value={form.ogpImageUrl}
              onChange={(event) => setForm((current) => ({ ...current, ogpImageUrl: event.target.value }))}
              placeholder="https://example.com/image.jpg"
              className="mt-1.5 h-11 w-full rounded-xl border border-[color:var(--color-border)] px-3"
            />
          </label>
          <label className="text-sm font-medium text-[color:var(--color-text-secondary)] md:col-span-2">
            OGP説明
            <textarea
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="シェア時に表示する説明"
              rows={3}
              className="mt-1.5 w-full rounded-xl border border-[color:var(--color-border)] px-3 py-2.5"
            />
          </label>
          <div className="flex flex-wrap gap-2 md:col-span-2">
            <button
              type="submit"
              disabled={savingLink}
              className="rounded-xl bg-[color:var(--color-accent)] px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
            >
              {savingLink ? '保存中...' : editingId ? '変更を保存' : '計測リンクを発行'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setForm(EMPTY_FORM);
                }}
                className="rounded-xl border border-[color:var(--color-border)] px-5 py-3 text-sm font-medium"
              >
                編集をやめる
              </button>
            )}
          </div>
        </form>
      </section>

      {message && (
        <div className="rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-800">{message}</div>
      )}

      <section className="ui-card">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-[color:var(--color-text-primary)]">登録済みリンク</h3>
            <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">クリック数はクローラーを除外して集計します。</p>
          </div>
          <button
            type="button"
            onClick={() => void loadLinks()}
            className="rounded-lg border border-[color:var(--color-border)] px-3 py-2 text-xs font-semibold"
          >
            更新
          </button>
        </div>
        {loading ? (
          <p className="mt-5 text-sm text-[color:var(--color-text-secondary)]">読み込み中...</p>
        ) : links.length === 0 ? (
          <div className="mt-5 rounded-xl bg-[color:var(--color-surface-muted)] px-4 py-8 text-center text-sm text-[color:var(--color-text-secondary)]">
            まだリンクがありません。上のフォームから最初のリンクを発行してください。
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            {links.map((link) => (
              <div key={link.id} className={`rounded-xl border p-4 ${link.isActive ? 'border-[color:var(--color-border)]' : 'border-slate-200 bg-slate-50 opacity-70'}`}>
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-[color:var(--color-text-primary)]">{link.managementName || link.slug}</p>
                      {!link.isActive && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs">停止中</span>}
                    </div>
                    <p className="mt-1 break-all text-sm font-medium text-purple-700">{appUrl}/l/{link.shortCode}</p>
                    <p className="mt-1 truncate text-xs text-[color:var(--color-text-muted)]">→ {link.destinationUrl}</p>
                  </div>
                  <div className="shrink-0 text-left md:text-right">
                    <p className="text-2xl font-bold text-[color:var(--color-text-primary)]">{link.totalClicks.toLocaleString()}</p>
                    <p className="text-xs text-[color:var(--color-text-muted)]">クリック</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 border-t border-[color:var(--color-border)] pt-3">
                  <button type="button" onClick={() => void copyLink(link)} className="rounded-lg bg-purple-50 px-3 py-2 text-xs font-semibold text-purple-700">
                    URLをコピー
                  </button>
                  {link.isActive && (
                    <>
                      <button type="button" onClick={() => startEdit(link)} className="rounded-lg border border-[color:var(--color-border)] px-3 py-2 text-xs font-semibold">
                        編集
                      </button>
                      <button type="button" onClick={() => void stopLink(link)} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600">
                        停止
                      </button>
                    </>
                  )}
                  <span className="ml-auto self-center text-xs text-[color:var(--color-text-muted)]">
                    最終クリック: {formatDate(link.lastClickedAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {recentDaily.length > 0 && (
        <section className="ui-card">
          <h3 className="text-lg font-bold text-[color:var(--color-text-primary)]">日別データ</h3>
          <div className="mt-4 overflow-x-auto rounded-xl border border-[color:var(--color-border)]">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-[color:var(--color-text-secondary)]">
                <tr>
                  <th className="px-4 py-3 text-left">日付</th>
                  <th className="px-4 py-3 text-right">リンククリック</th>
                  <th className="px-4 py-3 text-right">LINE友だち数</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--color-border)]">
                {recentDaily.map((daily) => (
                  <tr key={daily.date}>
                    <td className="px-4 py-3 font-medium">{daily.date}</td>
                    <td className="px-4 py-3 text-right">{daily.linkClicks.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">{daily.lineFollowers?.toLocaleString() ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
