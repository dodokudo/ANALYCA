import { BigQuery } from '@google-cloud/bigquery';

const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || process.env.PROJECT_ID;
const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || process.env.GOOGLE_CREDENTIALS || '{}';

function parseCredentials(json: string): Record<string, unknown> {
  try {
    return JSON.parse(json);
  } catch (e) {
    console.error('Failed to parse credentials JSON:', e);
    return {};
  }
}

const bigquery = new BigQuery({
  projectId,
  credentials: parseCredentials(credentialsJson),
});

let ensureUserAccessLogsTablePromise: Promise<void> | null = null;

async function executeDML(query: string): Promise<void> {
  const [job] = await bigquery.createQueryJob({ query });
  await job.getQueryResults();
}

async function ensureUserAccessLogsTable(): Promise<void> {
  if (!ensureUserAccessLogsTablePromise) {
    ensureUserAccessLogsTablePromise = executeDML(`
      CREATE TABLE IF NOT EXISTS \`${projectId}.analyca.user_access_logs\` (
        id STRING NOT NULL,
        user_id STRING NOT NULL,
        access_path STRING,
        user_agent STRING,
        accessed_at TIMESTAMP NOT NULL
      )
    `).catch((error) => {
      ensureUserAccessLogsTablePromise = null;
      throw error;
    });
  }

  return ensureUserAccessLogsTablePromise;
}

// ========================================
// 管理者用: アフィリエイト全体統計
// ========================================

export interface AffiliateWithStats {
  user_id: string;
  affiliate_code: string;
  commission_rate: number;
  total_referrals: number;
  total_commission: number;
  created_at: string | null;
  total_clicks: number;
  conversion_rate: number;
}

export async function getAllAffiliatesWithStats(): Promise<AffiliateWithStats[]> {
  const query = `
    SELECT
      a.user_id,
      a.affiliate_code,
      a.commission_rate,
      a.total_referrals,
      a.total_commission,
      a.created_at,
      (SELECT COUNT(*) FROM \`${projectId}.analyca.affiliate_clicks\` c WHERE c.affiliate_code = a.affiliate_code) as total_clicks,
      CASE WHEN (SELECT COUNT(*) FROM \`${projectId}.analyca.affiliate_clicks\` c WHERE c.affiliate_code = a.affiliate_code) > 0
        THEN ROUND(a.total_referrals / (SELECT COUNT(*) FROM \`${projectId}.analyca.affiliate_clicks\` c WHERE c.affiliate_code = a.affiliate_code) * 100, 1)
        ELSE 0 END as conversion_rate
    FROM \`${projectId}.analyca.affiliates\` a
    ORDER BY a.total_referrals DESC
  `;

  const [rows] = await bigquery.query({ query });
  return rows as AffiliateWithStats[];
}

// ========================================
// 管理者用: コンバージョンファネル統計
// ========================================

export interface ConversionFunnelStats {
  total_conversions: number;
  total_revenue: number;
  affiliate_sources: number;
  utm_tracked: number;
}

export async function getConversionFunnelStats(): Promise<ConversionFunnelStats> {
  const query = `
    SELECT
      COUNT(*) as total_conversions,
      COALESCE(SUM(amount), 0) as total_revenue,
      COUNT(DISTINCT CASE WHEN affiliate_code != '' AND affiliate_code IS NOT NULL THEN affiliate_code END) as affiliate_sources,
      COUNT(CASE WHEN utm_source != '' AND utm_source IS NOT NULL THEN 1 END) as utm_tracked
    FROM \`${projectId}.analyca.conversion_events\`
  `;

  const [rows] = await bigquery.query({ query });
  return (rows[0] || { total_conversions: 0, total_revenue: 0, affiliate_sources: 0, utm_tracked: 0 }) as ConversionFunnelStats;
}

// ========================================
// 管理者用: ユーザーの拡張情報（email, last_login, utm, affiliate）
// ========================================

export interface UserExtendedInfo {
  user_id: string;
  email: string | null;
  plan_id: string | null;
  subscription_id: string | null;
  subscription_status: string | null;
  last_login_at: string | null;
  subscription_created_at: string | null;
  trial_ends_at: string | null;
  created_at: string | null;
  total_access_count: number;
  active_days_7d: number;
  utm_source: string | null;
  affiliate_code: string | null;
}

export async function getUsersExtendedInfo(): Promise<UserExtendedInfo[]> {
  await ensureUserAccessLogsTable();

  const query = `
    WITH user_access_stats AS (
      SELECT
        user_id,
        COUNT(*) AS total_access_count,
        COUNT(DISTINCT IF(
          accessed_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY),
          DATE(accessed_at, 'Asia/Tokyo'),
          NULL
        )) AS active_days_7d
      FROM \`${projectId}.analyca.user_access_logs\`
      GROUP BY user_id
    )
    SELECT
      u.user_id,
      u.email,
      u.plan_id,
      u.subscription_id,
      u.subscription_status,
      u.last_login_at,
      u.subscription_created_at,
      u.trial_ends_at,
      u.created_at,
      COALESCE(
        ua.total_access_count,
        IF(u.last_login_at IS NULL, 0, 1)
      ) AS total_access_count,
      COALESCE(
        ua.active_days_7d,
        IF(
          u.last_login_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY),
          1,
          0
        )
      ) AS active_days_7d,
      ce.utm_source,
      r.affiliate_code,
      COALESCE(
        u.trial_ends_at,
        IF(
          u.subscription_status = 'trial' AND fc.created_at IS NOT NULL,
          TIMESTAMP_ADD(fc.created_at, INTERVAL 7 DAY),
          NULL
        )
      ) AS trial_ends_at
    FROM \`${projectId}.analyca.users\` u
    LEFT JOIN user_access_stats ua ON u.user_id = ua.user_id
    LEFT JOIN (
      SELECT user_id, utm_source,
        ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at ASC) as rn
      FROM \`${projectId}.analyca.conversion_events\`
      WHERE utm_source IS NOT NULL AND utm_source != ''
    ) ce ON u.user_id = ce.user_id AND ce.rn = 1
    LEFT JOIN (
      SELECT user_id, created_at,
        ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at ASC) as rn
      FROM \`${projectId}.analyca.conversion_events\`
      WHERE event_type = 'trial_start'
    ) fc ON u.user_id = fc.user_id AND fc.rn = 1
    LEFT JOIN (
      SELECT referred_user_id, affiliate_code,
        ROW_NUMBER() OVER (PARTITION BY referred_user_id ORDER BY created_at ASC) as rn
      FROM \`${projectId}.analyca.referrals\`
    ) r ON u.user_id = r.referred_user_id AND r.rn = 1
    ORDER BY u.created_at DESC
  `;

  const [rows] = await bigquery.query({ query });
  return rows.map((row: Record<string, unknown>) => ({
    user_id: row.user_id as string,
    email: (row.email as string | null) || null,
    plan_id: (row.plan_id as string | null) || null,
    subscription_id: (row.subscription_id as string | null) || null,
    subscription_status: (row.subscription_status as string | null) || null,
    last_login_at:
      typeof row.last_login_at === 'object' &&
      row.last_login_at !== null &&
      'value' in row.last_login_at
        ? String((row.last_login_at as { value?: string }).value || '')
        : (row.last_login_at as string | null) || null,
    subscription_created_at:
      typeof row.subscription_created_at === 'object' &&
      row.subscription_created_at !== null &&
      'value' in row.subscription_created_at
        ? String((row.subscription_created_at as { value?: string }).value || '')
        : (row.subscription_created_at as string | null) || null,
    trial_ends_at:
      typeof row.trial_ends_at === 'object' &&
      row.trial_ends_at !== null &&
      'value' in row.trial_ends_at
        ? String((row.trial_ends_at as { value?: string }).value || '')
        : (row.trial_ends_at as string | null) || null,
    created_at:
      typeof row.created_at === 'object' &&
      row.created_at !== null &&
      'value' in row.created_at
        ? String((row.created_at as { value?: string }).value || '')
        : (row.created_at as string | null) || null,
    total_access_count: Number(row.total_access_count || 0),
    active_days_7d: Number(row.active_days_7d || 0),
    utm_source: (row.utm_source as string | null) || null,
    affiliate_code: (row.affiliate_code as string | null) || null,
  }));
}

// ========================================
// アフィリエイト: 日別クリック統計（過去30日）
// ========================================

export interface DailyClickStat {
  date: string;
  clicks: number;
}

export async function getAffiliateDailyClicks(affiliateCode: string): Promise<DailyClickStat[]> {
  const query = `
    SELECT
      FORMAT_DATE('%Y-%m-%d', DATE(clicked_at)) as date,
      COUNT(*) as clicks
    FROM \`${projectId}.analyca.affiliate_clicks\`
    WHERE affiliate_code = @code
      AND clicked_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
    GROUP BY DATE(clicked_at)
    ORDER BY date
  `;

  const [rows] = await bigquery.query({
    query,
    params: { code: affiliateCode },
  });
  return rows as DailyClickStat[];
}

// ========================================
// アフィリエイト: 紹介ユーザーのプラン内訳
// ========================================

export interface PlanBreakdown {
  plan_id: string;
  count: number;
  revenue: number;
}

export async function getAffiliatePlanBreakdown(affiliateCode: string): Promise<PlanBreakdown[]> {
  const query = `
    SELECT
      COALESCE(plan_id, 'unknown') as plan_id,
      COUNT(*) as count,
      COALESCE(SUM(payment_amount), 0) as revenue
    FROM \`${projectId}.analyca.referrals\`
    WHERE affiliate_code = @code
    GROUP BY plan_id
  `;

  const [rows] = await bigquery.query({
    query,
    params: { code: affiliateCode },
  });
  return rows as PlanBreakdown[];
}
