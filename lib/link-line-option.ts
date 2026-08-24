import { BigQuery } from '@google-cloud/bigquery';
import { v4 as uuidv4 } from 'uuid';

export const LINK_LINE_OPTION_CODE = 'link-line';
export const LINK_LINE_OPTION_PRICE = 4980;
export const LINK_LINE_OPTION_NAME = 'リンク計測・LINE連携オプション';

const COMPLIMENTARY_LINK_LINE_USER_IDS = new Set([
  '33833959932919231',
]);

const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || process.env.PROJECT_ID || 'mark-454114';
const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || process.env.GOOGLE_CREDENTIALS || '{}';
const datasetName = 'analyca';

function parseCredentials(json: string): Record<string, unknown> {
  try {
    return JSON.parse(json);
  } catch {
    return {};
  }
}

const credentials = parseCredentials(credentialsJson);
const bigquery = new BigQuery({
  projectId,
  ...(typeof credentials.client_email === 'string' ? { credentials } : {}),
});
const dataset = bigquery.dataset(datasetName);

let ensureTablesPromise: Promise<void> | null = null;

async function runQuery(
  query: string,
  params?: Record<string, unknown>,
  types?: Record<string, string>,
): Promise<Record<string, unknown>[]> {
  const [rows] = await bigquery.query({ query, params, types });
  return rows as Record<string, unknown>[];
}

async function runDml(
  query: string,
  params?: Record<string, unknown>,
  types?: Record<string, string>,
): Promise<void> {
  const [job] = await bigquery.createQueryJob({ query, params, types });
  await job.getQueryResults();
}

export async function ensureLinkLineOptionTables(): Promise<void> {
  if (!ensureTablesPromise) {
    ensureTablesPromise = (async () => {
      const statements = [
        `
          CREATE TABLE IF NOT EXISTS \`${projectId}.${datasetName}.user_options\` (
            user_id STRING NOT NULL,
            option_code STRING NOT NULL,
            subscription_id STRING,
            status STRING NOT NULL,
            started_at TIMESTAMP,
            expires_at TIMESTAMP,
            canceled_at TIMESTAMP,
            created_at TIMESTAMP NOT NULL,
            updated_at TIMESTAMP NOT NULL
          )
        `,
        `
          CREATE TABLE IF NOT EXISTS \`${projectId}.${datasetName}.link_line_settings\` (
            user_id STRING NOT NULL,
            line_access_token STRING,
            line_account_name STRING,
            line_account_id STRING,
            token_verified_at TIMESTAMP,
            created_at TIMESTAMP NOT NULL,
            updated_at TIMESTAMP NOT NULL
          )
        `,
        `
          CREATE TABLE IF NOT EXISTS \`${projectId}.${datasetName}.option_short_links\` (
            id STRING NOT NULL,
            user_id STRING NOT NULL,
            short_code STRING NOT NULL,
            slug STRING NOT NULL,
            management_name STRING,
            destination_url STRING NOT NULL,
            title STRING,
            description STRING,
            ogp_image_url STRING,
            is_active BOOL NOT NULL,
            created_at TIMESTAMP NOT NULL,
            updated_at TIMESTAMP NOT NULL
          )
        `,
        `
          CREATE TABLE IF NOT EXISTS \`${projectId}.${datasetName}.option_click_logs\` (
            id STRING NOT NULL,
            short_link_id STRING NOT NULL,
            user_id STRING NOT NULL,
            clicked_at TIMESTAMP NOT NULL,
            referrer STRING,
            user_agent STRING,
            device_type STRING
          )
        `,
        `
          CREATE TABLE IF NOT EXISTS \`${projectId}.${datasetName}.line_friend_daily\` (
            user_id STRING NOT NULL,
            date DATE NOT NULL,
            followers INT64 NOT NULL,
            targeted_reaches INT64,
            blocks INT64,
            account_name STRING,
            created_at TIMESTAMP NOT NULL,
            updated_at TIMESTAMP NOT NULL
          )
        `,
      ];

      for (const statement of statements) {
        await runDml(statement);
      }
    })().catch((error) => {
      ensureTablesPromise = null;
      throw error;
    });
  }

  return ensureTablesPromise;
}

function unwrapBigQueryValue(value: unknown): unknown {
  if (value && typeof value === 'object' && 'value' in value) {
    return (value as { value?: unknown }).value;
  }
  return value;
}

function toIsoString(value: unknown): string | null {
  const raw = unwrapBigQueryValue(value);
  if (!raw) return null;
  const date = raw instanceof Date ? raw : new Date(String(raw));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toDateString(value: unknown): string {
  const raw = unwrapBigQueryValue(value);
  if (raw instanceof Date) return raw.toISOString().slice(0, 10);
  return String(raw || '').slice(0, 10);
}

function toNumber(value: unknown): number {
  const raw = unwrapBigQueryValue(value);
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'bigint') return Number(raw);
  return Number(raw) || 0;
}

export interface LinkLineOptionRecord {
  userId: string;
  subscriptionId: string | null;
  status: string;
  startedAt: string | null;
  expiresAt: string | null;
  canceledAt: string | null;
}

export interface LinkLineDailyMetric {
  date: string;
  linkClicks: number;
  lineFollowers: number | null;
}

export interface LinkLineOptionStatus {
  optionCode: typeof LINK_LINE_OPTION_CODE;
  name: typeof LINK_LINE_OPTION_NAME;
  price: typeof LINK_LINE_OPTION_PRICE;
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
    daily: LinkLineDailyMetric[];
  };
}

export interface OptionShortLink {
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

function mapOptionRow(row: Record<string, unknown>): LinkLineOptionRecord {
  return {
    userId: String(row.user_id || ''),
    subscriptionId: row.subscription_id ? String(row.subscription_id) : null,
    status: String(row.status || 'none'),
    startedAt: toIsoString(row.started_at),
    expiresAt: toIsoString(row.expires_at),
    canceledAt: toIsoString(row.canceled_at),
  };
}

function mapShortLinkRow(row: Record<string, unknown>): OptionShortLink {
  return {
    id: String(row.id || ''),
    userId: String(row.user_id || ''),
    shortCode: String(row.short_code || ''),
    slug: String(row.slug || ''),
    managementName: row.management_name ? String(row.management_name) : null,
    destinationUrl: String(row.destination_url || ''),
    title: row.title ? String(row.title) : null,
    description: row.description ? String(row.description) : null,
    ogpImageUrl: row.ogp_image_url ? String(row.ogp_image_url) : null,
    isActive: row.is_active !== false,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
    totalClicks: toNumber(row.total_clicks),
    lastClickedAt: toIsoString(row.last_clicked_at),
  };
}

export function optionHasAccess(record: LinkLineOptionRecord | null, now = new Date()): boolean {
  if (!record) return false;
  const status = record.status.toLowerCase();
  if (status === 'current' || status === 'active' || status === 'trial') return true;
  if (status !== 'canceled' || !record.expiresAt) return false;
  const expiresAt = new Date(record.expiresAt);
  return !Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() > now.getTime();
}

export function userHasLinkLineOptionAccess(
  userId: string,
  record: LinkLineOptionRecord | null,
  now = new Date(),
): boolean {
  return COMPLIMENTARY_LINK_LINE_USER_IDS.has(userId) || optionHasAccess(record, now);
}

export async function getLinkLineOptionRecord(userId: string): Promise<LinkLineOptionRecord | null> {
  await ensureLinkLineOptionTables();
  const rows = await runQuery(
    `
      SELECT *
      FROM \`${projectId}.${datasetName}.user_options\`
      WHERE user_id = @userId AND option_code = @optionCode
      ORDER BY updated_at DESC
      LIMIT 1
    `,
    { userId, optionCode: LINK_LINE_OPTION_CODE },
  );
  return rows[0] ? mapOptionRow(rows[0]) : null;
}

export async function findLinkLineOptionBySubscriptionId(
  subscriptionId: string,
): Promise<LinkLineOptionRecord | null> {
  await ensureLinkLineOptionTables();
  const rows = await runQuery(
    `
      SELECT *
      FROM \`${projectId}.${datasetName}.user_options\`
      WHERE subscription_id = @subscriptionId AND option_code = @optionCode
      ORDER BY updated_at DESC
      LIMIT 1
    `,
    { subscriptionId, optionCode: LINK_LINE_OPTION_CODE },
  );
  return rows[0] ? mapOptionRow(rows[0]) : null;
}

export async function upsertLinkLineOptionSubscription(params: {
  userId: string;
  subscriptionId: string;
  status: string;
  startedAt: Date;
  expiresAt: Date | null;
}): Promise<void> {
  await ensureLinkLineOptionTables();
  await runDml(
    `
      MERGE \`${projectId}.${datasetName}.user_options\` T
      USING (
        SELECT
          @userId AS user_id,
          @optionCode AS option_code,
          @subscriptionId AS subscription_id,
          @status AS status,
          @startedAt AS started_at,
          @expiresAt AS expires_at
      ) S
      ON T.user_id = S.user_id AND T.option_code = S.option_code
      WHEN MATCHED THEN UPDATE SET
        subscription_id = S.subscription_id,
        status = S.status,
        started_at = S.started_at,
        expires_at = S.expires_at,
        canceled_at = NULL,
        updated_at = CURRENT_TIMESTAMP()
      WHEN NOT MATCHED THEN INSERT (
        user_id, option_code, subscription_id, status, started_at, expires_at,
        canceled_at, created_at, updated_at
      ) VALUES (
        S.user_id, S.option_code, S.subscription_id, S.status, S.started_at,
        S.expires_at, NULL, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP()
      )
    `,
    {
      userId: params.userId,
      optionCode: LINK_LINE_OPTION_CODE,
      subscriptionId: params.subscriptionId,
      status: params.status,
      startedAt: params.startedAt,
      expiresAt: params.expiresAt,
    },
    { expiresAt: 'TIMESTAMP' },
  );
}

export async function updateLinkLineOptionBySubscriptionId(params: {
  subscriptionId: string;
  status: string;
  expiresAt?: Date | null;
}): Promise<void> {
  await ensureLinkLineOptionTables();
  await runDml(
    `
      UPDATE \`${projectId}.${datasetName}.user_options\`
      SET
        status = @status,
        expires_at = COALESCE(@expiresAt, expires_at),
        canceled_at = IF(@status = 'canceled', CURRENT_TIMESTAMP(), canceled_at),
        updated_at = CURRENT_TIMESTAMP()
      WHERE subscription_id = @subscriptionId
        AND option_code = @optionCode
    `,
    {
      subscriptionId: params.subscriptionId,
      optionCode: LINK_LINE_OPTION_CODE,
      status: params.status,
      expiresAt: params.expiresAt ?? null,
    },
    { expiresAt: 'TIMESTAMP' },
  );
}

export async function getLinkLineOptionStatus(userId: string): Promise<LinkLineOptionStatus> {
  await ensureLinkLineOptionTables();
  const [record, settingsRows, metricRows, latestLineRows] = await Promise.all([
    getLinkLineOptionRecord(userId),
    runQuery(
      `
        SELECT line_account_name, token_verified_at
        FROM \`${projectId}.${datasetName}.link_line_settings\`
        WHERE user_id = @userId
        ORDER BY updated_at DESC
        LIMIT 1
      `,
      { userId },
    ),
    runQuery(
      `
        WITH link_clicks AS (
          SELECT
            DATE(clicked_at, "Asia/Tokyo") AS date,
            COUNT(*) AS link_clicks
          FROM \`${projectId}.${datasetName}.option_click_logs\`
          WHERE user_id = @userId
            AND clicked_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 365 DAY)
          GROUP BY date
        ),
        line_followers AS (
          SELECT date, followers
          FROM \`${projectId}.${datasetName}.line_friend_daily\`
          WHERE user_id = @userId
            AND date >= DATE_SUB(CURRENT_DATE("Asia/Tokyo"), INTERVAL 365 DAY)
        ),
        dates AS (
          SELECT date FROM link_clicks
          UNION DISTINCT
          SELECT date FROM line_followers
        )
        SELECT
          dates.date,
          COALESCE(link_clicks.link_clicks, 0) AS link_clicks,
          line_followers.followers AS line_followers
        FROM dates
        LEFT JOIN link_clicks USING (date)
        LEFT JOIN line_followers USING (date)
        ORDER BY date DESC
      `,
      { userId },
    ),
    runQuery(
      `
        SELECT date, followers
        FROM \`${projectId}.${datasetName}.line_friend_daily\`
        WHERE user_id = @userId
        ORDER BY date DESC
        LIMIT 1
      `,
      { userId },
    ),
  ]);

  const settings = settingsRows[0];
  const daily = metricRows.map((row) => ({
    date: toDateString(row.date),
    linkClicks: toNumber(row.link_clicks),
    lineFollowers: row.line_followers === null || row.line_followers === undefined
      ? null
      : toNumber(row.line_followers),
  }));
  const latestLine = latestLineRows[0];
  const hasAccess = userHasLinkLineOptionAccess(userId, record);
  const isComplimentary = COMPLIMENTARY_LINK_LINE_USER_IDS.has(userId) && !optionHasAccess(record);

  return {
    optionCode: LINK_LINE_OPTION_CODE,
    name: LINK_LINE_OPTION_NAME,
    price: LINK_LINE_OPTION_PRICE,
    status: record?.status || (isComplimentary ? 'complimentary' : 'none'),
    subscriptionId: record?.subscriptionId || null,
    startedAt: record?.startedAt || null,
    expiresAt: record?.expiresAt || null,
    canceledAt: record?.canceledAt || null,
    hasAccess,
    isCancelScheduled: record?.status.toLowerCase() === 'canceled' && optionHasAccess(record),
    lineConfigured: Boolean(settings?.token_verified_at),
    lineAccountName: settings?.line_account_name ? String(settings.line_account_name) : null,
    metrics: {
      totalLinkClicks: daily.reduce((sum, row) => sum + row.linkClicks, 0),
      latestLineFollowers: latestLine ? toNumber(latestLine.followers) : null,
      latestLineDate: latestLine ? toDateString(latestLine.date) : null,
      daily,
    },
  };
}

export async function saveLineAccessToken(params: {
  userId: string;
  accessToken: string;
  accountName: string;
  accountId: string | null;
}): Promise<void> {
  await ensureLinkLineOptionTables();
  await runDml(
    `
      MERGE \`${projectId}.${datasetName}.link_line_settings\` T
      USING (
        SELECT
          @userId AS user_id,
          @accessToken AS line_access_token,
          @accountName AS line_account_name,
          @accountId AS line_account_id
      ) S
      ON T.user_id = S.user_id
      WHEN MATCHED THEN UPDATE SET
        line_access_token = S.line_access_token,
        line_account_name = S.line_account_name,
        line_account_id = S.line_account_id,
        token_verified_at = CURRENT_TIMESTAMP(),
        updated_at = CURRENT_TIMESTAMP()
      WHEN NOT MATCHED THEN INSERT (
        user_id, line_access_token, line_account_name, line_account_id,
        token_verified_at, created_at, updated_at
      ) VALUES (
        S.user_id, S.line_access_token, S.line_account_name, S.line_account_id,
        CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP()
      )
    `,
    {
      userId: params.userId,
      accessToken: params.accessToken,
      accountName: params.accountName,
      accountId: params.accountId,
    },
    { accountId: 'STRING' },
  );
}

function yesterdayInJapan(): { apiDate: string; date: string } {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const todayParts = formatter.formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    todayParts.find((item) => item.type === type)?.value || '';
  const todayUtc = new Date(`${part('year')}-${part('month')}-${part('day')}T00:00:00Z`);
  todayUtc.setUTCDate(todayUtc.getUTCDate() - 1);
  const date = todayUtc.toISOString().slice(0, 10);
  return { apiDate: date.replaceAll('-', ''), date };
}

interface LineBotInfo {
  displayName?: string;
  basicId?: string;
  premiumId?: string;
}

interface LineFollowerInsight {
  status?: string;
  followers?: number;
  targetedReaches?: number;
  blocks?: number;
}

async function fetchLineJson<T>(url: string, accessToken: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(15_000),
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(response.status === 401
      ? 'LINEアクセストークンを確認してください'
      : `LINE APIの取得に失敗しました (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export async function validateLineAccessToken(accessToken: string): Promise<{
  accountName: string;
  accountId: string | null;
}> {
  const botInfo = await fetchLineJson<LineBotInfo>('https://api.line.me/v2/bot/info', accessToken);
  return {
    accountName: botInfo.displayName || 'LINE公式アカウント',
    accountId: botInfo.premiumId || botInfo.basicId || null,
  };
}

export async function syncLineFriendsForUser(params: {
  userId: string;
  accessToken: string;
  accountName?: string | null;
}): Promise<{ date: string; followers: number }> {
  await ensureLinkLineOptionTables();
  const { apiDate, date } = yesterdayInJapan();
  const insight = await fetchLineJson<LineFollowerInsight>(
    `https://api.line.me/v2/bot/insight/followers?date=${apiDate}`,
    params.accessToken,
  );

  if (insight.status && insight.status !== 'ready') {
    throw new Error('LINE友だち数はまだ集計中です。時間をおいて再取得してください');
  }

  const followers = Number(insight.followers || 0);
  await runDml(
    `
      MERGE \`${projectId}.${datasetName}.line_friend_daily\` T
      USING (
        SELECT
          @userId AS user_id,
          DATE(@date) AS date,
          @followers AS followers,
          @targetedReaches AS targeted_reaches,
          @blocks AS blocks,
          @accountName AS account_name
      ) S
      ON T.user_id = S.user_id AND T.date = S.date
      WHEN MATCHED THEN UPDATE SET
        followers = S.followers,
        targeted_reaches = S.targeted_reaches,
        blocks = S.blocks,
        account_name = S.account_name,
        updated_at = CURRENT_TIMESTAMP()
      WHEN NOT MATCHED THEN INSERT (
        user_id, date, followers, targeted_reaches, blocks, account_name,
        created_at, updated_at
      ) VALUES (
        S.user_id, S.date, S.followers, S.targeted_reaches, S.blocks,
        S.account_name, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP()
      )
    `,
    {
      userId: params.userId,
      date,
      followers,
      targetedReaches: Number(insight.targetedReaches || 0),
      blocks: Number(insight.blocks || 0),
      accountName: params.accountName || null,
    },
    { accountName: 'STRING' },
  );

  return { date, followers };
}

export async function listActiveLineSettings(): Promise<Array<{
  userId: string;
  accessToken: string;
  accountName: string | null;
}>> {
  await ensureLinkLineOptionTables();
  const rows = await runQuery(
    `
      SELECT
        settings.user_id,
        settings.line_access_token,
        settings.line_account_name
      FROM \`${projectId}.${datasetName}.link_line_settings\` settings
      INNER JOIN \`${projectId}.${datasetName}.user_options\` options
        ON settings.user_id = options.user_id
        AND options.option_code = @optionCode
      WHERE settings.line_access_token IS NOT NULL
        AND (
          LOWER(options.status) IN ('current', 'active', 'trial')
          OR (
            LOWER(options.status) = 'canceled'
            AND options.expires_at > CURRENT_TIMESTAMP()
          )
        )
      QUALIFY ROW_NUMBER() OVER (
        PARTITION BY settings.user_id
        ORDER BY settings.updated_at DESC, options.updated_at DESC
      ) = 1
    `,
    { optionCode: LINK_LINE_OPTION_CODE },
  );
  return rows.map((row) => ({
    userId: String(row.user_id),
    accessToken: String(row.line_access_token),
    accountName: row.line_account_name ? String(row.line_account_name) : null,
  }));
}

function normalizeSlug(slug: string): string {
  return slug.trim().replace(/^\/+|\/+$/g, '');
}

export function validateShortLinkInput(params: {
  slug: string;
  destinationUrl: string;
  ogpImageUrl?: string | null;
}): { slug: string; destinationUrl: string; ogpImageUrl: string | null } {
  const slug = normalizeSlug(params.slug);
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(slug)) {
    throw new Error('リンクIDは半角英数字・ハイフン・アンダーバーで入力してください');
  }

  const destinationUrl = new URL(params.destinationUrl);
  if (destinationUrl.protocol !== 'http:' && destinationUrl.protocol !== 'https:') {
    throw new Error('遷移先URLはhttpまたはhttpsで入力してください');
  }

  let ogpImageUrl: string | null = null;
  if (params.ogpImageUrl?.trim()) {
    const imageUrl = new URL(params.ogpImageUrl.trim());
    if (imageUrl.protocol !== 'http:' && imageUrl.protocol !== 'https:') {
      throw new Error('OGP画像URLはhttpまたはhttpsで入力してください');
    }
    ogpImageUrl = imageUrl.toString();
  }

  return { slug, destinationUrl: destinationUrl.toString(), ogpImageUrl };
}

export async function listOptionShortLinks(userId: string): Promise<OptionShortLink[]> {
  await ensureLinkLineOptionTables();
  const rows = await runQuery(
    `
      SELECT
        links.*,
        COUNT(clicks.id) AS total_clicks,
        MAX(clicks.clicked_at) AS last_clicked_at
      FROM \`${projectId}.${datasetName}.option_short_links\` links
      LEFT JOIN \`${projectId}.${datasetName}.option_click_logs\` clicks
        ON clicks.short_link_id = links.id
      WHERE links.user_id = @userId
      GROUP BY
        links.id, links.user_id, links.short_code, links.slug,
        links.management_name, links.destination_url, links.title,
        links.description, links.ogp_image_url, links.is_active,
        links.created_at, links.updated_at
      ORDER BY links.created_at DESC
    `,
    { userId },
  );
  return rows.map(mapShortLinkRow);
}

export async function createOptionShortLink(params: {
  userId: string;
  slug: string;
  managementName?: string | null;
  destinationUrl: string;
  title?: string | null;
  description?: string | null;
  ogpImageUrl?: string | null;
}): Promise<OptionShortLink> {
  await ensureLinkLineOptionTables();
  const validated = validateShortLinkInput(params);
  const shortCode = `${params.userId}/${validated.slug}`;
  const existing = await runQuery(
    `
      SELECT id
      FROM \`${projectId}.${datasetName}.option_short_links\`
      WHERE short_code = @shortCode
      LIMIT 1
    `,
    { shortCode },
  );
  if (existing.length > 0) {
    throw new Error('このリンクIDは既に登録されています');
  }

  const id = uuidv4();
  await dataset.table('option_short_links').insert([{
    id,
    user_id: params.userId,
    short_code: shortCode,
    slug: validated.slug,
    management_name: params.managementName?.trim() || null,
    destination_url: validated.destinationUrl,
    title: params.title?.trim() || null,
    description: params.description?.trim() || null,
    ogp_image_url: validated.ogpImageUrl,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }]);

  return {
    id,
    userId: params.userId,
    shortCode,
    slug: validated.slug,
    managementName: params.managementName?.trim() || null,
    destinationUrl: validated.destinationUrl,
    title: params.title?.trim() || null,
    description: params.description?.trim() || null,
    ogpImageUrl: validated.ogpImageUrl,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    totalClicks: 0,
    lastClickedAt: null,
  };
}

export async function updateOptionShortLink(params: {
  id: string;
  userId: string;
  managementName?: string | null;
  destinationUrl: string;
  title?: string | null;
  description?: string | null;
  ogpImageUrl?: string | null;
}): Promise<void> {
  await ensureLinkLineOptionTables();
  const validated = validateShortLinkInput({
    slug: 'unchanged',
    destinationUrl: params.destinationUrl,
    ogpImageUrl: params.ogpImageUrl,
  });
  await runDml(
    `
      UPDATE \`${projectId}.${datasetName}.option_short_links\`
      SET
        management_name = @managementName,
        destination_url = @destinationUrl,
        title = @title,
        description = @description,
        ogp_image_url = @ogpImageUrl,
        updated_at = CURRENT_TIMESTAMP()
      WHERE id = @id AND user_id = @userId
    `,
    {
      id: params.id,
      userId: params.userId,
      managementName: params.managementName?.trim() || null,
      destinationUrl: validated.destinationUrl,
      title: params.title?.trim() || null,
      description: params.description?.trim() || null,
      ogpImageUrl: validated.ogpImageUrl,
    },
    {
      managementName: 'STRING',
      title: 'STRING',
      description: 'STRING',
      ogpImageUrl: 'STRING',
    },
  );
}

export async function deactivateOptionShortLink(id: string, userId: string): Promise<void> {
  await ensureLinkLineOptionTables();
  await runDml(
    `
      UPDATE \`${projectId}.${datasetName}.option_short_links\`
      SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP()
      WHERE id = @id AND user_id = @userId
    `,
    { id, userId },
  );
}

export async function getPublicOptionShortLink(shortCode: string): Promise<OptionShortLink | null> {
  await ensureLinkLineOptionTables();
  const rows = await runQuery(
    `
      SELECT links.*, 0 AS total_clicks, NULL AS last_clicked_at
      FROM \`${projectId}.${datasetName}.option_short_links\` links
      WHERE short_code = @shortCode AND is_active = TRUE
      LIMIT 1
    `,
    { shortCode },
  );
  return rows[0] ? mapShortLinkRow(rows[0]) : null;
}

export async function logOptionLinkClick(params: {
  shortLinkId: string;
  userId: string;
  referrer?: string | null;
  userAgent?: string | null;
  deviceType?: string | null;
}): Promise<void> {
  await dataset.table('option_click_logs').insert([{
    id: uuidv4(),
    short_link_id: params.shortLinkId,
    user_id: params.userId,
    clicked_at: new Date().toISOString(),
    referrer: params.referrer || null,
    user_agent: params.userAgent || null,
    device_type: params.deviceType || null,
  }]);
}
