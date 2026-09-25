'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { MediaArticle, MediaSettings } from '@/lib/media/types';

const statusLabel: Record<MediaArticle['status'], string> = {
  draft: '下書き',
  review: '確認待ち',
  approved: '承認済み',
  scheduled: '予約公開',
  published: '公開中',
  archived: '非公開',
};

function dateLabel(value: string | null): string {
  if (!value) return '-';
  return new Intl.DateTimeFormat('ja-JP', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export function MediaAdminDashboard({
  initialArticles,
  overview,
  initialSettings,
}: {
  initialArticles: MediaArticle[];
  overview: { totalArticles: number; publishedArticles: number; views30d: number; ctaClicks30d: number };
  initialSettings: MediaSettings;
}) {
  const [settings, setSettings] = useState(initialSettings);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState('');

  const update = <K extends keyof MediaSettings>(key: K, value: MediaSettings[K]) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const saveSettings = async () => {
    setSaving(true);
    setNotice('');
    try {
      const response = await fetch('/api/admin/media/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || '保存できませんでした');
      setSettings(payload.settings);
      setNotice('メディア設定を保存しました');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '保存できませんでした');
    } finally {
      setSaving(false);
    }
  };

  const uploadLineBanner = async (file: File) => {
    setUploading(true);
    setNotice('');
    try {
      const body = new FormData();
      body.append('file', file);
      const response = await fetch('/api/admin/media/upload', { method: 'POST', body });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'アップロードできませんでした');
      update('lineBannerImageUrl', payload.url);
      setNotice('画像を設定しました。「設定を保存」を押してください。');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'アップロードできませんでした');
    } finally {
      setUploading(false);
    }
  };

  return (
    <main className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight">メディア運用</h1>
          <p className="mt-2 text-sm text-slate-600">記事作成から承認、公開、LINEクリック確認までを管理します。</p>
        </div>
        <Link href="/admin/media/new" className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-bold text-white">AIリサーチから記事を作る</Link>
      </div>

      <section className="grid gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['全記事', overview.totalArticles],
          ['公開記事', overview.publishedArticles],
          ['30日閲覧', overview.views30d],
          ['30日CTAクリック', overview.ctaClicks30d],
        ].map(([label, value]) => (
          <div className="bg-white p-5" key={String(label)}>
            <p className="text-xs font-bold text-slate-500">{label}</p>
            <p className="mt-2 text-3xl font-black tabular-nums">{Number(value).toLocaleString('ja-JP')}</p>
          </div>
        ))}
      </section>

      <section className="mt-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-extrabold">記事</h2>
          <span className="text-sm text-slate-500">{initialArticles.length}件</span>
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-5 py-3">記事</th>
                <th className="px-5 py-3">状態</th>
                <th className="px-5 py-3">公開日時</th>
                <th className="px-5 py-3">更新</th>
                <th className="px-5 py-3">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {initialArticles.map((article) => (
                <tr key={article.id}>
                  <td className="max-w-xl px-5 py-4">
                    <div className="font-bold">{article.title || '無題の記事'}</div>
                    <div className="mt-1 truncate text-xs text-slate-500">/{article.slug}</div>
                  </td>
                  <td className="px-5 py-4"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold">{statusLabel[article.status]}</span></td>
                  <td className="px-5 py-4 text-slate-600">{dateLabel(article.publishedAt || article.scheduledAt)}</td>
                  <td className="px-5 py-4 text-slate-600">{dateLabel(article.updatedAt)}</td>
                  <td className="px-5 py-4"><Link className="font-bold text-blue-700" href={`/admin/media/${article.id}`}>編集</Link></td>
                </tr>
              ))}
              {initialArticles.length === 0 && (
                <tr><td className="px-5 py-12 text-center text-slate-500" colSpan={5}>記事はまだありません。</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-12 rounded-xl border border-slate-200 bg-white p-6">
        <div className="mb-6">
          <h2 className="text-xl font-extrabold">サイト・導線設定</h2>
          <p className="mt-1 text-sm text-slate-500">公開サイトの表示、LINEバナー、公式アカウント、ランキングを設定します。</p>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="メディア名" value={settings.siteName} onChange={(value) => update('siteName', value)} />
          <Field label="既定の著者名" value={settings.authorName} onChange={(value) => update('authorName', value)} />
          <Field label="サイト説明" value={settings.siteDescription} onChange={(value) => update('siteDescription', value)} area />
          <Field label="著者プロフィール" value={settings.authorBio} onChange={(value) => update('authorBio', value)} area />
          <Field label="LINE URL" value={settings.lineUrl} onChange={(value) => update('lineUrl', value)} />
          <Field label="LINEボタン文言" value={settings.lineLabel} onChange={(value) => update('lineLabel', value)} />
          <Field label="LINE見出し" value={settings.lineHeadline} onChange={(value) => update('lineHeadline', value)} />
          <Field label="LINE説明" value={settings.lineBody} onChange={(value) => update('lineBody', value)} />
          <div>
            <Field label="LINEバナー画像URL" value={settings.lineBannerImageUrl} onChange={(value) => update('lineBannerImageUrl', value)} />
            <label className="mt-2 inline-flex cursor-pointer rounded-md border border-slate-300 px-3 py-2 text-xs font-bold">
              {uploading ? 'アップロード中…' : 'バナー画像を選択'}
              <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={uploading} className="sr-only" onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void uploadLineBanner(file);
                event.target.value = '';
              }} />
            </label>
          </div>
          <Field label="ランキング集計日数" value={String(settings.rankingDays)} onChange={(value) => update('rankingDays', Number(value))} type="number" />
          <Field label="InstagramアカウントURL" value={settings.instagramAccountUrl} onChange={(value) => update('instagramAccountUrl', value)} />
          <Field label="YouTubeアカウントURL" value={settings.youtubeAccountUrl} onChange={(value) => update('youtubeAccountUrl', value)} />
          <Field label="ThreadsアカウントURL" value={settings.threadsAccountUrl} onChange={(value) => update('threadsAccountUrl', value)} />
          <Field
            label="サイドバー埋め込み投稿URL（1行1件・最大3件）"
            value={settings.sidebarEmbedUrls.join('\n')}
            onChange={(value) => update('sidebarEmbedUrls', value.split('\n').map((item) => item.trim()).filter(Boolean).slice(0, 3))}
            area
          />
          <Field label="フッター文言" value={settings.footerText} onChange={(value) => update('footerText', value)} />
          <Field
            label="ランキング固定記事ID（カンマ区切り）"
            value={settings.pinnedArticleIds.join(',')}
            onChange={(value) => update('pinnedArticleIds', value.split(',').map((item) => item.trim()).filter(Boolean))}
            area
          />
        </div>
        <div className="mt-6 flex items-center gap-4">
          <button type="button" onClick={saveSettings} disabled={saving} className="rounded-lg bg-slate-950 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">
            {saving ? '保存中…' : '設定を保存'}
          </button>
          {notice && <p className="text-sm font-medium text-slate-600">{notice}</p>}
        </div>
      </section>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  area = false,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  area?: boolean;
  type?: string;
}) {
  const className = 'mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100';
  return (
    <label className="text-sm font-bold text-slate-700">
      {label}
      {area ? (
        <textarea className={className} rows={3} value={value} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <input className={className} type={type} value={value} onChange={(event) => onChange(event.target.value)} />
      )}
    </label>
  );
}
