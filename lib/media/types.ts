export type MediaArticleStatus = 'draft' | 'review' | 'approved' | 'scheduled' | 'published' | 'archived';

export type MediaEmbedProvider = 'youtube' | 'instagram' | 'threads';

export type MediaContentBlock =
  | { id: string; type: 'paragraph'; text: string }
  | { id: string; type: 'heading'; level: 2 | 3; text: string }
  | { id: string; type: 'list'; items: string[] }
  | { id: string; type: 'quote'; text: string; source: string }
  | { id: string; type: 'image'; url: string; alt: string; caption: string }
  | { id: string; type: 'embed'; provider: MediaEmbedProvider; url: string; caption: string }
  | {
      id: string;
      type: 'cta';
      headline: string;
      body: string;
      label: string;
      url: string;
      placement: string;
    };

export type MediaArticleSource = {
  title: string;
  url: string;
  publisher: string;
};

export type MediaArticle = {
  id: string;
  slug: string;
  title: string;
  description: string;
  coverImageUrl: string;
  coverImageAlt: string;
  blocks: MediaContentBlock[];
  tags: string[];
  sources: MediaArticleSource[];
  status: MediaArticleStatus;
  authorName: string;
  authorBio: string;
  scheduledAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  revision: number;
  aiMetadata: Record<string, unknown> | null;
};

export type MediaArticleInput = Omit<
  MediaArticle,
  'id' | 'createdAt' | 'updatedAt' | 'revision' | 'publishedAt'
> & {
  id?: string;
  publishedAt?: string | null;
};

export type MediaSettings = {
  siteName: string;
  siteDescription: string;
  lineUrl: string;
  lineLabel: string;
  lineHeadline: string;
  lineBody: string;
  lineBannerImageUrl: string;
  authorName: string;
  authorBio: string;
  instagramAccountUrl: string;
  youtubeAccountUrl: string;
  threadsAccountUrl: string;
  sidebarEmbedUrls: string[];
  rankingDays: number;
  pinnedArticleIds: string[];
  footerText: string;
};

export type MediaArticleWithViews = MediaArticle & {
  views: number;
};

export const DEFAULT_MEDIA_SETTINGS: MediaSettings = {
  siteName: 'ANALYCA Media',
  siteDescription: 'SNS運用とWebマーケティングを、実践に変えるためのメディア。',
  lineUrl: '',
  lineLabel: 'LINEで最新情報を受け取る',
  lineHeadline: '運用に使える情報をLINEで',
  lineBody: '新着記事や実践ノウハウをまとめてお届けします。',
  lineBannerImageUrl: '',
  authorName: 'ANALYCA編集部',
  authorBio: 'SNS運用とデータ分析の実践情報を発信します。',
  instagramAccountUrl: '',
  youtubeAccountUrl: '',
  threadsAccountUrl: '',
  sidebarEmbedUrls: [],
  rankingDays: 30,
  pinnedArticleIds: [],
  footerText: 'ANALYCAが、SNS運用の判断と実行を支えます。',
};

export function createMediaBlock(type: MediaContentBlock['type']): MediaContentBlock {
  const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  switch (type) {
    case 'heading':
      return { id, type, level: 2, text: '' };
    case 'list':
      return { id, type, items: [''] };
    case 'quote':
      return { id, type, text: '', source: '' };
    case 'image':
      return { id, type, url: '', alt: '', caption: '' };
    case 'embed':
      return { id, type, provider: 'youtube', url: '', caption: '' };
    case 'cta':
      return { id, type, headline: '', body: '', label: '', url: '', placement: 'article-inline' };
    default:
      return { id, type: 'paragraph', text: '' };
  }
}
