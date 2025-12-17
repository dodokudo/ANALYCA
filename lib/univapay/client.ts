/**
 * UnivaPay API Client for ANALYCA
 * https://docs.univapay.com/
 */

const UNIVAPAY_API_URL = process.env.UNIVAPAY_API_URL ?? 'https://api.univapay.com';
const UNIVAPAY_JWT = process.env.UNIVAPAY_JWT ?? '';
const UNIVAPAY_SECRET = process.env.UNIVAPAY_SECRET ?? '';
const UNIVAPAY_STORE_ID = process.env.UNIVAPAY_STORE_ID ?? '';

export interface UnivaPayCharge {
  id: string;
  store_id: string;
  transaction_token_id: string;
  requested_amount: number;
  requested_currency: string;
  charged_amount: number;
  charged_currency: string;
  status: 'pending' | 'awaiting' | 'successful' | 'failed' | 'error' | 'authorized' | 'canceled';
  metadata?: Record<string, string>;
  mode: 'live' | 'test';
  created_on: string;
  descriptor?: string;
  error?: {
    code: string;
    message: string;
  };
}

export interface UnivaPaySubscription {
  id: string;
  store_id: string;
  transaction_token_id: string;
  amount: number;
  currency: string;
  status: 'unverified' | 'unconfirmed' | 'canceled' | 'unpaid' | 'suspended' | 'current' | 'completed';
  period: 'monthly' | 'weekly' | 'daily' | 'biweekly' | 'semimonthly';
  initial_amount?: number;
  next_payment_date?: string;
  metadata?: Record<string, string>;
  mode: 'live' | 'test';
  created_on: string;
}

export interface UnivaPayListResponse<T> {
  items: T[];
  has_more: boolean;
  total_hits?: number;
}

export interface CreateSubscriptionParams {
  transaction_token_id: string;
  amount: number;
  currency?: string;
  period: 'monthly' | 'weekly' | 'daily' | 'biweekly' | 'semimonthly';
  initial_amount?: number;
  metadata?: Record<string, string>;
}

export interface CreateChargeParams {
  transaction_token_id: string;
  amount: number;
  currency?: string;
  capture?: boolean;
  metadata?: Record<string, string>;
}

function getAuthHeader(): string {
  return `Bearer ${UNIVAPAY_SECRET}.${UNIVAPAY_JWT}`;
}

async function fetchUnivaPay<T>(
  endpoint: string,
  options?: {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    body?: Record<string, unknown>;
    params?: Record<string, string | number | undefined>;
  },
): Promise<T> {
  const url = new URL(endpoint, UNIVAPAY_API_URL);
  const method = options?.method ?? 'GET';

  if (options?.params) {
    Object.entries(options.params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.append(key, String(value));
      }
    });
  }

  const fetchOptions: RequestInit = {
    method,
    headers: {
      'Authorization': getAuthHeader(),
      'Content-Type': 'application/json',
    },
  };

  if (options?.body && (method === 'POST' || method === 'PATCH')) {
    fetchOptions.body = JSON.stringify(options.body);
  }

  const response = await fetch(url.toString(), fetchOptions);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`UnivaPay API error: ${response.status} ${errorText}`);
  }

  return response.json();
}

/**
 * サブスクリプション（定期課金）を作成
 */
export async function createSubscription(
  params: CreateSubscriptionParams,
): Promise<UnivaPaySubscription> {
  const storeId = UNIVAPAY_STORE_ID;
  if (!storeId) {
    throw new Error('UNIVAPAY_STORE_ID is not configured');
  }

  return fetchUnivaPay<UnivaPaySubscription>(
    `/stores/${storeId}/subscriptions`,
    {
      method: 'POST',
      body: {
        transaction_token_id: params.transaction_token_id,
        amount: params.amount,
        currency: params.currency ?? 'JPY',
        period: params.period,
        initial_amount: params.initial_amount,
        metadata: params.metadata,
      },
    },
  );
}

/**
 * サブスクリプション詳細を取得
 */
export async function getSubscription(subscriptionId: string): Promise<UnivaPaySubscription> {
  const storeId = UNIVAPAY_STORE_ID;
  if (!storeId) {
    throw new Error('UNIVAPAY_STORE_ID is not configured');
  }

  return fetchUnivaPay<UnivaPaySubscription>(`/stores/${storeId}/subscriptions/${subscriptionId}`);
}

/**
 * サブスクリプション一覧を取得
 */
export async function listSubscriptions(
  params?: { status?: string; mode?: 'live' | 'test'; limit?: number },
): Promise<UnivaPayListResponse<UnivaPaySubscription>> {
  const storeId = UNIVAPAY_STORE_ID;
  if (!storeId) {
    throw new Error('UNIVAPAY_STORE_ID is not configured');
  }

  return fetchUnivaPay<UnivaPayListResponse<UnivaPaySubscription>>(
    `/stores/${storeId}/subscriptions`,
    { params: params as Record<string, string | number | undefined> },
  );
}

/**
 * 単発課金を作成
 */
export async function createCharge(
  params: CreateChargeParams,
): Promise<UnivaPayCharge> {
  const storeId = UNIVAPAY_STORE_ID;
  if (!storeId) {
    throw new Error('UNIVAPAY_STORE_ID is not configured');
  }

  return fetchUnivaPay<UnivaPayCharge>(
    `/stores/${storeId}/charges`,
    {
      method: 'POST',
      body: {
        transaction_token_id: params.transaction_token_id,
        amount: params.amount,
        currency: params.currency ?? 'JPY',
        capture: params.capture ?? true,
        metadata: params.metadata,
      },
    },
  );
}

/**
 * 課金詳細を取得
 */
export async function getCharge(chargeId: string): Promise<UnivaPayCharge> {
  const storeId = UNIVAPAY_STORE_ID;
  if (!storeId) {
    throw new Error('UNIVAPAY_STORE_ID is not configured');
  }

  return fetchUnivaPay<UnivaPayCharge>(`/stores/${storeId}/charges/${chargeId}`);
}

/**
 * 課金一覧を取得
 */
export async function listCharges(
  params?: { from?: string; to?: string; status?: string; mode?: 'live' | 'test'; limit?: number },
): Promise<UnivaPayListResponse<UnivaPayCharge>> {
  const storeId = UNIVAPAY_STORE_ID;
  if (!storeId) {
    throw new Error('UNIVAPAY_STORE_ID is not configured');
  }

  return fetchUnivaPay<UnivaPayListResponse<UnivaPayCharge>>(
    `/stores/${storeId}/charges`,
    { params: params as Record<string, string | number | undefined> },
  );
}

/**
 * UnivaPay設定を取得（フロントエンド用）
 */
export function getUnivaPayConfig() {
  return {
    storeId: UNIVAPAY_STORE_ID,
    // フロントエンドで使うのはJWTのみ（Secretは渡さない）
    appId: UNIVAPAY_JWT,
  };
}
