'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArticleRenderer } from '@/app/media/_components/article-renderer';
import publicStyles from '@/app/media/media.module.css';
import type {
  MediaArticle,
  MediaArticleInput,
  MediaArticleSource,
  MediaArticleStatus,
  MediaContentBlock,
  MediaSettings,
} from '@/lib/media/types';
import { createMediaBlock } from '@/lib/media/types';

type Revision = { revision: number; createdAt: string; createdBy: string };

const statusLabel: Record<MediaArticleStatus, string> = {
  draft: '下書き',
  review: '確認待ち',
  approved: '承認済み',
  scheduled: '予約公開',
  published: '公開中',
  archived: '非公開',
};

function initialValue(article: MediaArticle | undefined, settings: MediaSettings): MediaArticleInput {
  if (article) return article;
  return {
    slug: '',
    title: '',
    description: '',
    coverImageUrl: '',
    coverImageAlt: '',
    blocks: [createMediaBlock('paragraph')],
    tags: [],
    sources: [],
    status: 'draft',
    authorName: settings.authorName,
    authorBio: settings.authorBio,
    scheduledAt: null,
    aiMetadata: null,
  };
}

function datetimeLocal(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function MediaArticleEditor({
  initialArticle,
  settings,
  revisions = [],
}: {
  initialArticle?: MediaArticle;
  settings: MediaSettings;
  revisions?: Revision[];
}) {
  const router = useRouter();
  const [article, setArticle] = useState<MediaArticleInput>(() => initialValue(initialArticle, settings));
  const [articleId, setArticleId] = useState(initialArticle?.id || '');
  const [revision, setRevision] = useState(initialArticle?.revision || 0);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [preview, setPreview] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [research, setResearch] = useState({ topic: '', audience: '', angle: '', keywords: '', sourceUrls: '' });
  const latestArticle = useRef(article);
  latestArticle.current = article;

  const patchArticle = <K extends keyof MediaArticleInput>(key: K, value: MediaArticleInput[K]) => {
    setArticle((current) => ({ ...current, [key]: value }));
    setDirty(true);
  };

  const persist = useCallback(async (next: MediaArticleInput, quiet = false): Promise<MediaArticle | null> => {
    if (saving) return null;
    setSaving(true);
    if (!quiet) setNotice('');
    try {
      const response = await fetch(articleId ? `/api/admin/media/articles/${articleId}` : '/api/admin/media/articles', {
        method: articleId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(articleId ? { article: next, expectedRevision: revision } : next),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || '保存できませんでした');
      const saved = payload.article as MediaArticle;
      setArticle(saved);
      setArticleId(saved.id);
      setRevision(saved.revision);
      setDirty(false);
      setNotice(quiet ? '自動保存しました' : '保存しました');
      if (!articleId) router.replace(`/admin/media/${saved.id}`);
      router.refresh();
      return saved;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '保存できませんでした');
      return null;
    } finally {
      setSaving(false);
    }
  }, [articleId, revision, router, saving]);

  useEffect(() => {
    if (!articleId || !dirty || saving) return;
    const timer = window.setTimeout(() => void persist(latestArticle.current, true), 2_000);
    return () => window.clearTimeout(timer);
  }, [article, articleId, dirty, persist, saving]);

  const updateBlock = (index: number, next: MediaContentBlock) => {
    const blocks = [...article.blocks];
    blocks[index] = next;
    patchArticle('blocks', blocks);
  };

  const addBlock = (type: MediaContentBlock['type']) => patchArticle('blocks', [...article.blocks, createMediaBlock(type)]);

  const moveBlock = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= article.blocks.length) return;
    const blocks = [...article.blocks];
    [blocks[index], blocks[target]] = [blocks[target], blocks[index]];
    patchArticle('blocks', blocks);
  };

  const uploadImage = async (file: File, onUploaded: (url: string) => void) => {
    setUploading(true);
    setNotice('');
    try {
      const body = new FormData();
      body.append('file', file);
      const response = await fetch('/api/admin/media/upload', { method: 'POST', body });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'アップロードできませんでした');
      onUploaded(payload.url);
      setNotice('画像をアップロードしました');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'アップロードできませんでした');
    } finally {
      setUploading(false);
    }
  };

  const generate = async () => {
    setGenerating(true);
    setNotice('Webを調査して記事を生成しています。数分かかる場合があります。');
    try {
      const response = await fetch('/api/admin/media/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: research.topic,
          audience: research.audience,
          angle: research.angle,
          keywords: research.keywords.split(',').map((item) => item.trim()).filter(Boolean),
          sourceUrls: research.sourceUrls.split(/\n/).map((item) => item.trim()).filter(Boolean),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || '生成できませんでした');
      const draft = payload.draft;
      setArticle((current) => ({
        ...current,
        title: draft.title,
        description: draft.description,
        slug: draft.slug,
        tags: draft.tags,
        blocks: draft.blocks,
        sources: draft.sources,
        status: 'draft',
        aiMetadata: { model: draft.model, responseId: draft.responseId, generatedAt: draft.generatedAt },
      }));
      setDirty(true);
      setNotice('下書きを生成しました。内容と出典を確認して保存してください。');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '生成できませんでした');
    } finally {
      setGenerating(false);
    }
  };

  const changeStatus = async (status: MediaArticleStatus) => {
    if (!articleId) {
      setNotice('先に下書きを保存してください');
      return;
    }
    if (status === 'scheduled' && !article.scheduledAt) {
      setNotice('予約公開日時を入力してください');
      return;
    }
    const next = { ...article, status };
    const saved = await persist(next);
    if (saved) setNotice(`${statusLabel[status]}に変更しました`);
  };

  const actions = useMemo(() => {
    const current = article.status;
    if (current === 'draft') return [['review', '確認を依頼'] as const];
    if (current === 'review') return [['draft', '下書きに戻す'] as const, ['approved', '内容を承認'] as const];
    if (current === 'approved') return [['review', '確認待ちに戻す'] as const, ['scheduled', '予約公開'] as const, ['published', '今すぐ公開'] as const];
    if (current === 'scheduled') return [['approved', '予約を解除'] as const, ['published', '今すぐ公開'] as const];
    if (current === 'published') return [];
    return [['draft', '下書きに戻す'] as const];
  }, [article.status]);

  return (
    <main className="mx-auto max-w-[1520px] px-4 py-7 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/admin/media" className="text-sm font-bold text-slate-500">記事一覧</Link>
          <span className="text-slate-300">/</span>
          <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-bold">{statusLabel[article.status]}</span>
          {dirty && <span className="text-xs font-bold text-amber-700">未保存</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setPreview((value) => !value)} className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold">
            {preview ? '編集に戻る' : 'プレビュー'}
          </button>
          <button type="button" onClick={() => void persist(article)} disabled={saving} className="rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
            {saving ? '保存中…' : articleId ? '保存' : '下書きを作成'}
          </button>
          {actions.map(([status, label]) => (
            <button type="button" onClick={() => void changeStatus(status)} disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50" key={status}>
              {label}
            </button>
          ))}
          {articleId && article.status !== 'archived' && (
            <button type="button" onClick={() => void changeStatus('archived')} className="rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-bold text-red-700">非公開にする</button>
          )}
        </div>
      </div>
      {notice && <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-900">{notice}</div>}

      {preview ? (
        <section className={`${publicStyles.shell} mx-auto max-w-[900px] rounded-xl border border-slate-200 bg-white px-5 py-10 sm:px-14`}>
          <div className={publicStyles.tags}>{article.tags.map((tag) => <span className={publicStyles.tag} key={tag}>{tag}</span>)}</div>
          <h1 className={publicStyles.articleTitle}>{article.title || '無題の記事'}</h1>
          <p className={publicStyles.articleLead}>{article.description}</p>
          <ArticleRenderer blocks={article.blocks} articleId={articleId || undefined} />
        </section>
      ) : (
        <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_390px]">
          <div className="space-y-7">
            <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
              <div className="mb-5">
                <h1 className="text-xl font-black">AIリサーチから下書きを作る</h1>
                <p className="mt-1 text-sm text-slate-500">テーマと必要な参考URLを指定します。カテゴリーは自動固定しません。</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <EditorField label="調べるテーマ" value={research.topic} onChange={(value) => setResearch((current) => ({ ...current, topic: value }))} />
                <EditorField label="想定読者" value={research.audience} onChange={(value) => setResearch((current) => ({ ...current, audience: value }))} />
                <EditorField label="記事の切り口" value={research.angle} onChange={(value) => setResearch((current) => ({ ...current, angle: value }))} />
                <EditorField label="キーワード（カンマ区切り）" value={research.keywords} onChange={(value) => setResearch((current) => ({ ...current, keywords: value }))} />
                <div className="md:col-span-2">
                  <EditorField label="優先して調べるURL（1行1件）" value={research.sourceUrls} onChange={(value) => setResearch((current) => ({ ...current, sourceUrls: value }))} area />
                </div>
              </div>
              <button type="button" onClick={generate} disabled={generating || !research.topic.trim()} className="mt-5 rounded-lg bg-blue-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">
                {generating ? 'リサーチ・生成中…' : 'Webを調査して下書きを生成'}
              </button>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
              <h2 className="mb-5 text-xl font-black">基本情報</h2>
              <div className="grid gap-4">
                <EditorField label="タイトル" value={article.title} onChange={(value) => patchArticle('title', value)} />
                <EditorField label="URLスラッグ" value={article.slug} onChange={(value) => patchArticle('slug', value)} />
                <EditorField label="概要" value={article.description} onChange={(value) => patchArticle('description', value)} area />
                <EditorField label="タグ（カンマ区切り）" value={article.tags.join(', ')} onChange={(value) => patchArticle('tags', value.split(',').map((item) => item.trim()).filter(Boolean))} />
                <div className="grid gap-4 md:grid-cols-2">
                  <EditorField label="著者名" value={article.authorName} onChange={(value) => patchArticle('authorName', value)} />
                  <EditorField label="著者プロフィール" value={article.authorBio} onChange={(value) => patchArticle('authorBio', value)} />
                </div>
                <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
                  <EditorField label="カバー画像URL" value={article.coverImageUrl} onChange={(value) => patchArticle('coverImageUrl', value)} />
                  <UploadButton disabled={uploading} onFile={(file) => void uploadImage(file, (url) => patchArticle('coverImageUrl', url))} />
                </div>
                <EditorField label="カバー画像の代替テキスト" value={article.coverImageAlt} onChange={(value) => patchArticle('coverImageAlt', value)} />
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
              <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
                <div><h2 className="text-xl font-black">本文</h2><p className="mt-1 text-sm text-slate-500">ブロックごとに編集・並び替えできます。</p></div>
                <div className="flex flex-wrap gap-2">
                  {(['paragraph', 'heading', 'list', 'quote', 'image', 'embed', 'cta'] as const).map((type) => (
                    <button type="button" onClick={() => addBlock(type)} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold" key={type}>+ {blockLabel(type)}</button>
                  ))}
                </div>
              </div>
              <div className="space-y-4">
                {article.blocks.map((block, index) => (
                  <BlockEditor
                    block={block}
                    index={index}
                    count={article.blocks.length}
                    uploading={uploading}
                    onChange={(next) => updateBlock(index, next)}
                    onMove={(direction) => moveBlock(index, direction)}
                    onRemove={() => patchArticle('blocks', article.blocks.filter((_, itemIndex) => itemIndex !== index))}
                    onUpload={(file, callback) => void uploadImage(file, callback)}
                    key={block.id}
                  />
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div><h2 className="text-xl font-black">参考情報</h2><p className="mt-1 text-sm text-slate-500">公開記事の末尾に表示されます。</p></div>
                <button type="button" onClick={() => patchArticle('sources', [...article.sources, { title: '', url: '', publisher: '' }])} className="rounded-md border border-slate-300 px-3 py-2 text-xs font-bold">+ 参考URL</button>
              </div>
              <div className="space-y-4">
                {article.sources.map((source, index) => (
                  <SourceEditor
                    source={source}
                    onChange={(next) => {
                      const sources = [...article.sources];
                      sources[index] = next;
                      patchArticle('sources', sources);
                    }}
                    onRemove={() => patchArticle('sources', article.sources.filter((_, itemIndex) => itemIndex !== index))}
                    key={`${source.url}-${index}`}
                  />
                ))}
              </div>
            </section>
          </div>

          <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="font-black">公開設定</h2>
              <label className="mt-4 block text-sm font-bold text-slate-700">
                予約日時
                <input
                  type="datetime-local"
                  value={datetimeLocal(article.scheduledAt)}
                  onChange={(event) => patchArticle('scheduledAt', event.target.value ? new Date(event.target.value).toISOString() : null)}
                  className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5"
                />
              </label>
              <p className="mt-4 text-xs leading-6 text-slate-500">AI生成後も自動公開されません。「確認待ち」→「承認済み」を経て、予約または公開します。</p>
            </section>
            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="font-black">保存履歴</h2>
              <div className="mt-4 max-h-64 space-y-3 overflow-auto text-xs text-slate-600">
                {revisions.map((item) => (
                  <div className="border-b border-slate-100 pb-3" key={`${item.revision}-${item.createdAt}`}>
                    <strong>v{item.revision}</strong><br />
                    {new Date(item.createdAt).toLocaleString('ja-JP')}
                  </div>
                ))}
                {revisions.length === 0 && <p>保存すると履歴が記録されます。</p>}
              </div>
            </section>
          </aside>
        </div>
      )}
    </main>
  );
}

function blockLabel(type: MediaContentBlock['type']): string {
  return { paragraph: '段落', heading: '見出し', list: '箇条書き', quote: '引用', image: '画像', embed: '埋め込み', cta: 'CTA' }[type];
}

function EditorField({ label, value, onChange, area = false }: { label: string; value: string; onChange: (value: string) => void; area?: boolean }) {
  const className = 'mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100';
  return (
    <label className="block text-sm font-bold text-slate-700">
      {label}
      {area
        ? <textarea rows={4} className={className} value={value} onChange={(event) => onChange(event.target.value)} />
        : <input className={className} value={value} onChange={(event) => onChange(event.target.value)} />}
    </label>
  );
}

function UploadButton({ disabled, onFile }: { disabled: boolean; onFile: (file: File) => void }) {
  return (
    <label className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold">
      {disabled ? 'アップロード中…' : '画像を選択'}
      <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={disabled} className="sr-only" onChange={(event) => {
        const file = event.target.files?.[0];
        if (file) onFile(file);
        event.target.value = '';
      }} />
    </label>
  );
}

function BlockEditor({
  block,
  index,
  count,
  uploading,
  onChange,
  onMove,
  onRemove,
  onUpload,
}: {
  block: MediaContentBlock;
  index: number;
  count: number;
  uploading: boolean;
  onChange: (block: MediaContentBlock) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
  onUpload: (file: File, callback: (url: string) => void) => void;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-xs font-black text-slate-500">{index + 1}. {blockLabel(block.type)}</span>
        <div className="flex gap-1">
          <button type="button" disabled={index === 0} onClick={() => onMove(-1)} className="rounded border border-slate-300 bg-white px-2 py-1 text-xs disabled:opacity-30">上へ</button>
          <button type="button" disabled={index === count - 1} onClick={() => onMove(1)} className="rounded border border-slate-300 bg-white px-2 py-1 text-xs disabled:opacity-30">下へ</button>
          <button type="button" onClick={onRemove} className="rounded border border-red-200 bg-white px-2 py-1 text-xs text-red-700">削除</button>
        </div>
      </div>
      {block.type === 'paragraph' && <textarea rows={6} className="w-full rounded-lg border border-slate-300 bg-white p-3" value={block.text} onChange={(event) => onChange({ ...block, text: event.target.value })} />}
      {block.type === 'heading' && (
        <div className="grid gap-3 md:grid-cols-[120px_1fr]">
          <select className="rounded-lg border border-slate-300 bg-white px-3" value={block.level} onChange={(event) => onChange({ ...block, level: Number(event.target.value) === 3 ? 3 : 2 })}>
            <option value={2}>大見出し</option><option value={3}>小見出し</option>
          </select>
          <input className="rounded-lg border border-slate-300 bg-white p-3" value={block.text} onChange={(event) => onChange({ ...block, text: event.target.value })} />
        </div>
      )}
      {block.type === 'list' && <textarea rows={5} className="w-full rounded-lg border border-slate-300 bg-white p-3" value={block.items.join('\n')} onChange={(event) => onChange({ ...block, items: event.target.value.split('\n') })} placeholder="1行に1項目" />}
      {block.type === 'quote' && (
        <div className="grid gap-3"><textarea rows={4} className="rounded-lg border border-slate-300 bg-white p-3" value={block.text} onChange={(event) => onChange({ ...block, text: event.target.value })} /><input className="rounded-lg border border-slate-300 bg-white p-3" value={block.source} onChange={(event) => onChange({ ...block, source: event.target.value })} placeholder="引用元" /></div>
      )}
      {block.type === 'image' && (
        <div className="grid gap-3">
          <div className="grid gap-3 md:grid-cols-[1fr_auto]"><input className="rounded-lg border border-slate-300 bg-white p-3" value={block.url} onChange={(event) => onChange({ ...block, url: event.target.value })} placeholder="画像URL" /><UploadButton disabled={uploading} onFile={(file) => onUpload(file, (url) => onChange({ ...block, url }))} /></div>
          <input className="rounded-lg border border-slate-300 bg-white p-3" value={block.alt} onChange={(event) => onChange({ ...block, alt: event.target.value })} placeholder="代替テキスト" />
          <input className="rounded-lg border border-slate-300 bg-white p-3" value={block.caption} onChange={(event) => onChange({ ...block, caption: event.target.value })} placeholder="キャプション" />
        </div>
      )}
      {block.type === 'embed' && (
        <div className="grid gap-3 md:grid-cols-[150px_1fr]">
          <select className="rounded-lg border border-slate-300 bg-white px-3" value={block.provider} onChange={(event) => onChange({ ...block, provider: event.target.value as typeof block.provider })}><option value="youtube">YouTube</option><option value="instagram">Instagram</option><option value="threads">Threads</option></select>
          <input className="rounded-lg border border-slate-300 bg-white p-3" value={block.url} onChange={(event) => onChange({ ...block, url: event.target.value })} placeholder="投稿URL" />
          <div className="md:col-span-2"><input className="w-full rounded-lg border border-slate-300 bg-white p-3" value={block.caption} onChange={(event) => onChange({ ...block, caption: event.target.value })} placeholder="補足説明" /></div>
        </div>
      )}
      {block.type === 'cta' && (
        <div className="grid gap-3 md:grid-cols-2">
          <input className="rounded-lg border border-slate-300 bg-white p-3" value={block.headline} onChange={(event) => onChange({ ...block, headline: event.target.value })} placeholder="見出し" />
          <input className="rounded-lg border border-slate-300 bg-white p-3" value={block.label} onChange={(event) => onChange({ ...block, label: event.target.value })} placeholder="ボタン文言" />
          <textarea rows={3} className="rounded-lg border border-slate-300 bg-white p-3 md:col-span-2" value={block.body} onChange={(event) => onChange({ ...block, body: event.target.value })} placeholder="説明" />
          <input className="rounded-lg border border-slate-300 bg-white p-3" value={block.url} onChange={(event) => onChange({ ...block, url: event.target.value })} placeholder="遷移先URL" />
          <input className="rounded-lg border border-slate-300 bg-white p-3" value={block.placement} onChange={(event) => onChange({ ...block, placement: event.target.value })} placeholder="計測名" />
        </div>
      )}
    </div>
  );
}

function SourceEditor({ source, onChange, onRemove }: { source: MediaArticleSource; onChange: (source: MediaArticleSource) => void; onRemove: () => void }) {
  return (
    <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 md:grid-cols-[1fr_1.3fr_0.7fr_auto]">
      <input className="rounded-lg border border-slate-300 bg-white p-3" value={source.title} onChange={(event) => onChange({ ...source, title: event.target.value })} placeholder="資料名" />
      <input className="rounded-lg border border-slate-300 bg-white p-3" value={source.url} onChange={(event) => onChange({ ...source, url: event.target.value })} placeholder="https://..." />
      <input className="rounded-lg border border-slate-300 bg-white p-3" value={source.publisher} onChange={(event) => onChange({ ...source, publisher: event.target.value })} placeholder="発行元" />
      <button type="button" onClick={onRemove} className="rounded-lg border border-red-200 bg-white px-3 text-sm font-bold text-red-700">削除</button>
    </div>
  );
}
