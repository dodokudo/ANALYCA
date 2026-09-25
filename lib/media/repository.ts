import { randomUUID } from 'node:crypto';
import { BigQuery } from '@google-cloud/bigquery';
import type {
  MediaArticle,
  MediaArticleInput,
  MediaArticleWithViews,
  MediaSettings,
} from '@/lib/media/types';
import { DEFAULT_MEDIA_SETTINGS } from '@/lib/media/types';

const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || process.env.PROJECT_ID;
const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || process.env.GOOGLE_CREDENTIALS || '{}';
const DATASET = 'analyca';
const ARTICLES_TABLE = 'media_articles';
const REVISIONS_TABLE = 'media_article_revisions';
const SETTINGS_TABLE = 'media_settings';
const EVENTS_TABLE = 'media_events';

function parseCredentials(json: string): Record<string, unknown> {
  try {
    return JSON.parse(json);
  } catch {
    return {};
  }
}

const client = new BigQuery({
  projectId,
  location: 'asia-northeast1',
  credentials: parseCredentials(credentialsJson),
});

let ensureTablesPromise: Promise<void> | null = null;

async function executeDml(query: string, params: Record<string, unknown> = {}): Promise<void> {
  const [job] = await client.createQueryJob({ query, params });
  await job.getQueryResults();
}

export async function ensureMediaTables(): Promise<void> {
  if (!projectId) throw new Error('Google Cloud project is not configured');
  if (!ensureTablesPromise) {
    ensureTablesPromise = executeDml(`
      CREATE TABLE IF NOT EXISTS \`${projectId}.${DATASET}.${ARTICLES_TABLE}\` (
        article_id STRING NOT NULL,
        slug STRING NOT NULL,
        title STRING NOT NULL,
        description STRING,
        cover_image_url STRING,
        cover_image_alt STRING,
        blocks_json STRING NOT NULL,
        tags_json STRING NOT NULL,
        sources_json STRING NOT NULL,
        status STRING NOT NULL,
        author_name STRING,
        author_bio STRING,
        scheduled_at TIMESTAMP,
        published_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL,
        updated_at TIMESTAMP NOT NULL,
        revision INT64 NOT NULL,
        ai_metadata_json STRING
      );

      CREATE TABLE IF NOT EXISTS \`${projectId}.${DATASET}.${REVISIONS_TABLE}\` (
        revision_id STRING NOT NULL,
        article_id STRING NOT NULL,
        revision INT64 NOT NULL,
        snapshot_json STRING NOT NULL,
        created_by STRING,
        created_at TIMESTAMP NOT NULL
      );

      CREATE TABLE IF NOT EXISTS \`${projectId}.${DATASET}.${SETTINGS_TABLE}\` (
        setting_key STRING NOT NULL,
        value_json STRING NOT NULL,
        updated_at TIMESTAMP NOT NULL
      );

      CREATE TABLE IF NOT EXISTS \`${projectId}.${DATASET}.${EVENTS_TABLE}\` (
        event_id STRING NOT NULL,
        event_type STRING NOT NULL,
        article_id STRING,
        placement STRING,
        target_url STRING,
        session_id STRING,
        path STRING,
        referrer STRING,
        user_agent STRING,
        created_at TIMESTAMP NOT NULL
      )
      PARTITION BY DATE(created_at)
      CLUSTER BY event_type, article_id;
    `).catch((error) => {
      ensureTablesPromise = null;
      throw error;
    });
  }
  return ensureTablesPromise;
}

function json<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string' || !value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function stringValue(value: unknown): string {
  if (value && typeof value === 'object' && 'value' in value) {
    return String((value as { value: unknown }).value || '');
  }
  return value == null ? '' : String(value);
}

function iso(value: unknown): string | null {
  const raw = stringValue(value);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function mapArticle(row: Record<string, unknown>): MediaArticle {
  return {
    id: stringValue(row.article_id),
    slug: stringValue(row.slug),
    title: stringValue(row.title),
    description: stringValue(row.description),
    coverImageUrl: stringValue(row.cover_image_url),
    coverImageAlt: stringValue(row.cover_image_alt),
    blocks: json(row.blocks_json, []),
    tags: json(row.tags_json, []),
    sources: json(row.sources_json, []),
    status: stringValue(row.status) as MediaArticle['status'],
    authorName: stringValue(row.author_name),
    authorBio: stringValue(row.author_bio),
    scheduledAt: iso(row.scheduled_at),
    publishedAt: iso(row.effective_published_at ?? row.published_at),
    createdAt: iso(row.created_at) || new Date(0).toISOString(),
    updatedAt: iso(row.updated_at) || new Date(0).toISOString(),
    revision: Number(row.revision || 1),
    aiMetadata: json(row.ai_metadata_json, null),
  };
}

function articleParams(input: MediaArticleInput): Record<string, unknown> {
  return {
    slug: input.slug,
    title: input.title,
    description: input.description,
    coverImageUrl: input.coverImageUrl,
    coverImageAlt: input.coverImageAlt,
    blocksJson: JSON.stringify(input.blocks),
    tagsJson: JSON.stringify(input.tags),
    sourcesJson: JSON.stringify(input.sources),
    status: input.status,
    authorName: input.authorName,
    authorBio: input.authorBio,
    scheduledAt: input.scheduledAt || '',
    publishedAt: input.publishedAt || '',
    aiMetadataJson: input.aiMetadata ? JSON.stringify(input.aiMetadata) : '',
  };
}

async function assertUniqueSlug(slug: string, exceptId = ''): Promise<void> {
  const [rows] = await client.query({
    query: `
      SELECT article_id
      FROM \`${projectId}.${DATASET}.${ARTICLES_TABLE}\`
      WHERE slug = @slug AND (@exceptId = '' OR article_id != @exceptId)
      LIMIT 1
    `,
    params: { slug, exceptId },
  });
  if (rows.length > 0) throw new Error('同じURLスラッグの記事がすでにあります');
}

async function saveRevision(article: MediaArticle, createdBy: string): Promise<void> {
  await executeDml(`
    INSERT INTO \`${projectId}.${DATASET}.${REVISIONS_TABLE}\`
      (revision_id, article_id, revision, snapshot_json, created_by, created_at)
    VALUES
      (@revisionId, @articleId, @revision, @snapshotJson, @createdBy, CURRENT_TIMESTAMP())
  `, {
    revisionId: randomUUID(),
    articleId: article.id,
    revision: article.revision,
    snapshotJson: JSON.stringify(article),
    createdBy,
  });
}

export async function createMediaArticle(input: MediaArticleInput, createdBy: string): Promise<MediaArticle> {
  await ensureMediaTables();
  await assertUniqueSlug(input.slug);
  const id = input.id || randomUUID();
  const params = articleParams(input);
  await executeDml(`
    INSERT INTO \`${projectId}.${DATASET}.${ARTICLES_TABLE}\` (
      article_id, slug, title, description, cover_image_url, cover_image_alt,
      blocks_json, tags_json, sources_json, status, author_name, author_bio,
      scheduled_at, published_at, created_at, updated_at, revision, ai_metadata_json
    ) VALUES (
      @id, @slug, @title, @description, NULLIF(@coverImageUrl, ''), NULLIF(@coverImageAlt, ''),
      @blocksJson, @tagsJson, @sourcesJson, @status, NULLIF(@authorName, ''), NULLIF(@authorBio, ''),
      SAFE_CAST(NULLIF(@scheduledAt, '') AS TIMESTAMP),
      CASE WHEN @status = 'published' THEN COALESCE(SAFE_CAST(NULLIF(@publishedAt, '') AS TIMESTAMP), CURRENT_TIMESTAMP()) ELSE SAFE_CAST(NULLIF(@publishedAt, '') AS TIMESTAMP) END,
      CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP(), 1, NULLIF(@aiMetadataJson, '')
    )
  `, { id, ...params });
  const article = await getMediaArticleById(id);
  if (!article) throw new Error('記事の保存後読み込みに失敗しました');
  await saveRevision(article, createdBy);
  return article;
}

export async function updateMediaArticle(
  id: string,
  input: MediaArticleInput,
  createdBy: string,
  expectedRevision?: number,
): Promise<MediaArticle> {
  await ensureMediaTables();
  const current = await getMediaArticleById(id);
  if (!current) throw new Error('記事が見つかりません');
  if (expectedRevision && current.revision !== expectedRevision) {
    throw new Error('別の更新が保存されています。画面を再読み込みしてください');
  }
  await assertUniqueSlug(input.slug, id);
  const params = {
    id,
    ...articleParams(input),
    shouldPublishNow: input.status === 'published' && !current.publishedAt,
  };
  await executeDml(`
    UPDATE \`${projectId}.${DATASET}.${ARTICLES_TABLE}\`
    SET slug = @slug,
        title = @title,
        description = @description,
        cover_image_url = NULLIF(@coverImageUrl, ''),
        cover_image_alt = NULLIF(@coverImageAlt, ''),
        blocks_json = @blocksJson,
        tags_json = @tagsJson,
        sources_json = @sourcesJson,
        status = @status,
        author_name = NULLIF(@authorName, ''),
        author_bio = NULLIF(@authorBio, ''),
        scheduled_at = SAFE_CAST(NULLIF(@scheduledAt, '') AS TIMESTAMP),
        published_at = CASE
          WHEN @shouldPublishNow THEN CURRENT_TIMESTAMP()
          WHEN NULLIF(@publishedAt, '') IS NOT NULL THEN SAFE_CAST(@publishedAt AS TIMESTAMP)
          ELSE published_at
        END,
        ai_metadata_json = NULLIF(@aiMetadataJson, ''),
        updated_at = CURRENT_TIMESTAMP(),
        revision = revision + 1
    WHERE article_id = @id
  `, params);
  const article = await getMediaArticleById(id);
  if (!article) throw new Error('記事の更新後読み込みに失敗しました');
  await saveRevision(article, createdBy);
  return article;
}

export async function getMediaArticleById(id: string): Promise<MediaArticle | null> {
  await ensureMediaTables();
  const [rows] = await client.query({
    query: `SELECT * FROM \`${projectId}.${DATASET}.${ARTICLES_TABLE}\` WHERE article_id = @id LIMIT 1`,
    params: { id },
  });
  return rows[0] ? mapArticle(rows[0] as Record<string, unknown>) : null;
}

export async function getPublicMediaArticleBySlug(slug: string): Promise<MediaArticle | null> {
  await ensureMediaTables();
  const [rows] = await client.query({
    query: `
      SELECT *, COALESCE(published_at, scheduled_at) AS effective_published_at
      FROM \`${projectId}.${DATASET}.${ARTICLES_TABLE}\`
      WHERE slug = @slug
        AND (status = 'published' OR (status = 'scheduled' AND scheduled_at <= CURRENT_TIMESTAMP()))
      LIMIT 1
    `,
    params: { slug },
  });
  return rows[0] ? mapArticle(rows[0] as Record<string, unknown>) : null;
}

export async function listMediaArticles(options: {
  publicOnly?: boolean;
  limit?: number;
  tag?: string;
  query?: string;
} = {}): Promise<MediaArticle[]> {
  await ensureMediaTables();
  const limit = Math.min(100, Math.max(1, options.limit || 50));
  const where = [options.publicOnly
    ? `(status = 'published' OR (status = 'scheduled' AND scheduled_at <= CURRENT_TIMESTAMP()))`
    : `status != 'archived'`];
  if (options.tag) where.push(`EXISTS (SELECT 1 FROM UNNEST(JSON_VALUE_ARRAY(tags_json)) tag WHERE tag = @tag)`);
  if (options.query) where.push(`(LOWER(title) LIKE @search OR LOWER(description) LIKE @search)`);
  const [rows] = await client.query({
    query: `
      SELECT *, COALESCE(published_at, scheduled_at) AS effective_published_at
      FROM \`${projectId}.${DATASET}.${ARTICLES_TABLE}\`
      WHERE ${where.join(' AND ')}
      ORDER BY COALESCE(published_at, scheduled_at, updated_at) DESC
      LIMIT ${limit}
    `,
    params: {
      ...(options.tag ? { tag: options.tag } : {}),
      ...(options.query ? { search: `%${options.query.toLowerCase()}%` } : {}),
    },
  });
  return rows.map((row) => mapArticle(row as Record<string, unknown>));
}

export async function listMediaRevisions(articleId: string): Promise<Array<{
  revision: number;
  createdAt: string;
  createdBy: string;
}>> {
  await ensureMediaTables();
  const [rows] = await client.query({
    query: `
      SELECT revision, created_at, created_by
      FROM \`${projectId}.${DATASET}.${REVISIONS_TABLE}\`
      WHERE article_id = @articleId
      ORDER BY revision DESC
      LIMIT 30
    `,
    params: { articleId },
  });
  return rows.map((row) => ({
    revision: Number(row.revision || 0),
    createdAt: iso(row.created_at) || '',
    createdBy: stringValue(row.created_by),
  }));
}

export async function getMediaSettings(): Promise<MediaSettings> {
  await ensureMediaTables();
  const [rows] = await client.query({
    query: `
      SELECT value_json
      FROM \`${projectId}.${DATASET}.${SETTINGS_TABLE}\`
      WHERE setting_key = 'global'
      ORDER BY updated_at DESC
      LIMIT 1
    `,
  });
  return rows[0] ? { ...DEFAULT_MEDIA_SETTINGS, ...json(rows[0].value_json, {}) } : DEFAULT_MEDIA_SETTINGS;
}

export async function saveMediaSettings(settings: MediaSettings): Promise<MediaSettings> {
  await ensureMediaTables();
  await executeDml(`
    MERGE \`${projectId}.${DATASET}.${SETTINGS_TABLE}\` target
    USING (SELECT 'global' AS setting_key, @valueJson AS value_json) source
    ON target.setting_key = source.setting_key
    WHEN MATCHED THEN UPDATE SET value_json = source.value_json, updated_at = CURRENT_TIMESTAMP()
    WHEN NOT MATCHED THEN INSERT (setting_key, value_json, updated_at)
      VALUES (source.setting_key, source.value_json, CURRENT_TIMESTAMP())
  `, { valueJson: JSON.stringify(settings) });
  return settings;
}

export async function recordMediaEvent(input: {
  eventType: 'page_view' | 'cta_click' | 'related_click' | 'social_click';
  articleId?: string;
  placement?: string;
  targetUrl?: string;
  sessionId?: string;
  path?: string;
  referrer?: string;
  userAgent?: string;
}): Promise<void> {
  await ensureMediaTables();
  await client.dataset(DATASET).table(EVENTS_TABLE).insert([{
    event_id: randomUUID(),
    event_type: input.eventType,
    article_id: input.articleId || null,
    placement: input.placement || null,
    target_url: input.targetUrl || null,
    session_id: input.sessionId || null,
    path: input.path || null,
    referrer: input.referrer || null,
    user_agent: input.userAgent || null,
    created_at: new Date().toISOString(),
  }]);
}

export async function getPopularMediaArticles(limit = 5): Promise<MediaArticleWithViews[]> {
  await ensureMediaTables();
  const settings = await getMediaSettings();
  const [rows] = await client.query({
    query: `
      WITH view_counts AS (
        SELECT article_id, COUNT(*) AS views
        FROM \`${projectId}.${DATASET}.${EVENTS_TABLE}\`
        WHERE event_type = 'page_view'
          AND created_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL @rankingDays DAY)
          AND NOT REGEXP_CONTAINS(LOWER(COALESCE(user_agent, '')), r'bot|crawler|spider|preview')
        GROUP BY article_id
      )
      SELECT article.*, COALESCE(views.views, 0) AS views,
        COALESCE(article.published_at, article.scheduled_at) AS effective_published_at
      FROM \`${projectId}.${DATASET}.${ARTICLES_TABLE}\` article
      LEFT JOIN view_counts views USING (article_id)
      WHERE article.status = 'published'
        OR (article.status = 'scheduled' AND article.scheduled_at <= CURRENT_TIMESTAMP())
      ORDER BY views DESC, effective_published_at DESC
      LIMIT 30
    `,
    params: { rankingDays: settings.rankingDays },
  });
  const articles = rows.map((row) => ({
    ...mapArticle(row as Record<string, unknown>),
    views: Number(row.views || 0),
  }));
  const pinned = new Map(settings.pinnedArticleIds.map((id, index) => [id, index]));
  return articles
    .sort((a, b) => {
      const aPin = pinned.get(a.id);
      const bPin = pinned.get(b.id);
      if (aPin !== undefined || bPin !== undefined) return (aPin ?? 10_000) - (bPin ?? 10_000);
      return b.views - a.views || (b.publishedAt || '').localeCompare(a.publishedAt || '');
    })
    .slice(0, Math.min(10, Math.max(1, limit)));
}

export async function getMediaOverview(): Promise<{
  totalArticles: number;
  publishedArticles: number;
  views30d: number;
  ctaClicks30d: number;
}> {
  await ensureMediaTables();
  const [rows] = await client.query({
    query: `
      SELECT
        (SELECT COUNT(*) FROM \`${projectId}.${DATASET}.${ARTICLES_TABLE}\` WHERE status != 'archived') AS total_articles,
        (SELECT COUNT(*) FROM \`${projectId}.${DATASET}.${ARTICLES_TABLE}\`
          WHERE status = 'published' OR (status = 'scheduled' AND scheduled_at <= CURRENT_TIMESTAMP())) AS published_articles,
        (SELECT COUNT(*) FROM \`${projectId}.${DATASET}.${EVENTS_TABLE}\`
          WHERE event_type = 'page_view' AND created_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)) AS views_30d,
        (SELECT COUNT(*) FROM \`${projectId}.${DATASET}.${EVENTS_TABLE}\`
          WHERE event_type = 'cta_click' AND created_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)) AS cta_clicks_30d
    `,
  });
  const row = rows[0] || {};
  return {
    totalArticles: Number(row.total_articles || 0),
    publishedArticles: Number(row.published_articles || 0),
    views30d: Number(row.views_30d || 0),
    ctaClicks30d: Number(row.cta_clicks_30d || 0),
  };
}
