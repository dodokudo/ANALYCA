import type {
  MediaArticleInput,
  MediaArticleSource,
  MediaArticleStatus,
  MediaContentBlock,
  MediaSettings,
} from '@/lib/media/types';
import { DEFAULT_MEDIA_SETTINGS } from '@/lib/media/types';

const ARTICLE_STATUSES = new Set<MediaArticleStatus>([
  'draft',
  'review',
  'approved',
  'scheduled',
  'published',
  'archived',
]);

function text(value: unknown, max = 10_000): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function validUrl(value: unknown): string {
  const raw = text(value, 2_000);
  if (!raw) return '';
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : '';
  } catch {
    return '';
  }
}

export function normalizeMediaSlug(value: unknown): string {
  const normalized = text(value, 180)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s/\\?#[\]@!$&'()*+,;=:%]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
  return normalized || `article-${Date.now()}`;
}

function normalizeBlock(raw: unknown): MediaContentBlock | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  const id = text(value.id, 120) || crypto.randomUUID();
  const type = text(value.type, 30);
  if (type === 'heading') {
    return { id, type, level: value.level === 3 ? 3 : 2, text: text(value.text, 500) };
  }
  if (type === 'paragraph') return { id, type, text: text(value.text, 20_000) };
  if (type === 'list') {
    const items = Array.isArray(value.items) ? value.items.map((item) => text(item, 2_000)).filter(Boolean) : [];
    return { id, type, items };
  }
  if (type === 'quote') return { id, type, text: text(value.text, 5_000), source: text(value.source, 500) };
  if (type === 'image') {
    return { id, type, url: validUrl(value.url), alt: text(value.alt, 500), caption: text(value.caption, 1_000) };
  }
  if (type === 'embed') {
    const provider = value.provider === 'instagram' || value.provider === 'threads' ? value.provider : 'youtube';
    return { id, type, provider, url: validUrl(value.url), caption: text(value.caption, 1_000) };
  }
  if (type === 'cta') {
    return {
      id,
      type,
      headline: text(value.headline, 500),
      body: text(value.body, 2_000),
      label: text(value.label, 200),
      url: validUrl(value.url),
      placement: text(value.placement, 100) || 'article-inline',
    };
  }
  return null;
}

function normalizeSource(raw: unknown): MediaArticleSource | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  const url = validUrl(value.url);
  if (!url) return null;
  return { title: text(value.title, 500) || url, url, publisher: text(value.publisher, 300) };
}

function nullableDate(value: unknown): string | null {
  const raw = text(value, 80);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function normalizeMediaArticleInput(raw: unknown): MediaArticleInput {
  const value = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const status = ARTICLE_STATUSES.has(value.status as MediaArticleStatus)
    ? value.status as MediaArticleStatus
    : 'draft';
  const blocks = Array.isArray(value.blocks)
    ? value.blocks.map(normalizeBlock).filter((block): block is MediaContentBlock => Boolean(block))
    : [];
  const sources = Array.isArray(value.sources)
    ? value.sources.map(normalizeSource).filter((source): source is MediaArticleSource => Boolean(source))
    : [];
  const tags = Array.isArray(value.tags)
    ? [...new Set(value.tags.map((tag) => text(tag, 80)).filter(Boolean))].slice(0, 20)
    : [];
  return {
    ...(text(value.id, 120) ? { id: text(value.id, 120) } : {}),
    slug: normalizeMediaSlug(value.slug || value.title),
    title: text(value.title, 300),
    description: text(value.description, 1_000),
    coverImageUrl: validUrl(value.coverImageUrl),
    coverImageAlt: text(value.coverImageAlt, 500),
    blocks,
    tags,
    sources,
    status,
    authorName: text(value.authorName, 200),
    authorBio: text(value.authorBio, 1_000),
    scheduledAt: nullableDate(value.scheduledAt),
    publishedAt: nullableDate(value.publishedAt),
    aiMetadata: value.aiMetadata && typeof value.aiMetadata === 'object'
      ? value.aiMetadata as Record<string, unknown>
      : null,
  };
}

export function validatePublishableArticle(article: MediaArticleInput): string[] {
  const errors: string[] = [];
  if (!article.title) errors.push('タイトルを入力してください');
  if (!article.description) errors.push('概要を入力してください');
  if (!article.slug) errors.push('URLスラッグを入力してください');
  if (article.blocks.length === 0) errors.push('本文を1ブロック以上入力してください');
  if (!article.authorName) errors.push('著者名を入力してください');
  if (article.status === 'scheduled' && !article.scheduledAt) errors.push('予約公開日時を入力してください');
  return errors;
}

export function normalizeMediaSettings(raw: unknown): MediaSettings {
  const value = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  return {
    siteName: text(value.siteName, 200) || DEFAULT_MEDIA_SETTINGS.siteName,
    siteDescription: text(value.siteDescription, 1_000) || DEFAULT_MEDIA_SETTINGS.siteDescription,
    lineUrl: validUrl(value.lineUrl),
    lineLabel: text(value.lineLabel, 200) || DEFAULT_MEDIA_SETTINGS.lineLabel,
    lineHeadline: text(value.lineHeadline, 300) || DEFAULT_MEDIA_SETTINGS.lineHeadline,
    lineBody: text(value.lineBody, 1_000) || DEFAULT_MEDIA_SETTINGS.lineBody,
    lineBannerImageUrl: validUrl(value.lineBannerImageUrl),
    authorName: text(value.authorName, 200) || DEFAULT_MEDIA_SETTINGS.authorName,
    authorBio: text(value.authorBio, 1_000) || DEFAULT_MEDIA_SETTINGS.authorBio,
    authorImageUrl: validUrl(value.authorImageUrl),
    instagramAccountUrl: validUrl(value.instagramAccountUrl),
    youtubeAccountUrl: validUrl(value.youtubeAccountUrl),
    threadsAccountUrl: validUrl(value.threadsAccountUrl),
    sidebarEmbedUrls: Array.isArray(value.sidebarEmbedUrls)
      ? value.sidebarEmbedUrls.map(validUrl).filter(Boolean).slice(0, 3)
      : [],
    rankingDays: Math.min(365, Math.max(1, Number(value.rankingDays) || DEFAULT_MEDIA_SETTINGS.rankingDays)),
    pinnedArticleIds: Array.isArray(value.pinnedArticleIds)
      ? value.pinnedArticleIds.map((id) => text(id, 120)).filter(Boolean).slice(0, 20)
      : [],
    footerText: text(value.footerText, 500) || DEFAULT_MEDIA_SETTINGS.footerText,
  };
}
