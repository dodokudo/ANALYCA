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
  last_login_at: string | null;
  utm_source: string | null;
  affiliate_code: string | null;
}

export async function getUsersExtendedInfo(): Promise<UserExtendedInfo[]> {
  const query = `
    SELECT
      u.user_id,
      u.email,
      u.last_login_at,
      ce.utm_source,
      r.affiliate_code
    FROM \`${projectId}.analyca.users\` u
    LEFT JOIN (
      SELECT user_id, utm_source,
        ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at ASC) as rn
      FROM \`${projectId}.analyca.conversion_events\`
      WHERE utm_source IS NOT NULL AND utm_source != ''
    ) ce ON u.user_id = ce.user_id AND ce.rn = 1
    LEFT JOIN (
      SELECT referred_user_id, affiliate_code,
        ROW_NUMBER() OVER (PARTITION BY referred_user_id ORDER BY created_at ASC) as rn
      FROM \`${projectId}.analyca.referrals\`
    ) r ON u.user_id = r.referred_user_id AND r.rn = 1
    ORDER BY u.created_at DESC
  `;

  const [rows] = await bigquery.query({ query });
  return rows as UserExtendedInfo[];
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
