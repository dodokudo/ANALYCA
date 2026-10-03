/**
 * UnivaPay API Client for ANALYCA
 * https://docs.univapay.com/
 */

import type { UnivaPaySubscriptionPeriod } from './plans';

const UNIVAPAY_API_URL = process.env.UNIVAPAY_API_URL ?? 'https://api.univapay.com';
const UNIVAPAY_JWT = process.env.UNIVAPAY_JWT ?? '';
const UNIVAPAY_SECRET = process.env.UNIVAPAY_SECRET ?? '';
const UNIVAPAY_STORE_ID = process.env.UNIVAPAY_STORE_ID ?? '';
const DEFAULT_SUBSCRIPTION_RETRY_INTERVAL = 'P1D';

export interface UnivaPayCharge {
  id: string;
  subscription_id?: string | null;
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
  period: UnivaPaySubscriptionPeriod | 'weekly' | 'daily' | 'biweekly' | 'quarterly' | 'semiannually';
  initial_amount?: number;
  next_payment_date?: string;
  next_payment?: {
    due_date?: string;
    amount?: number;
    currency?: string;
    is_paid?: boolean;
  };
  metadata?: Record<string, string>;
  mode: 'live' | 'test';
  created_on: string;
}

export interface UnivaPayListResponse<T> {
  items: T[];
  has_more: boolean;
  total_hits?: number;
  next_cursor?: string;
}

export interface UnivaPayTransactionToken {
  id: string;
  store_id: string;
  email?: string;
  active: boolean;
  mode: 'live' | 'test';
  created_on: string;
}

export interface CreateSubscriptionParams {
  transaction_token_id: string;
  amount: number;
  currency?: string;
  period: UnivaPaySubscriptionPeriod | 'weekly' | 'daily' | 'biweekly' | 'quarterly' | 'semiannually';
  initial_amount?: number;
  schedule_settings?: {
    start_on?: string; // ISO date string (YYYY-MM-DD) - delays first charge until this date
    zone_id?: string;
    retry_interval?: string;
  };
  metadata?: Record<string, string>;
  idempotencyKey?: string;
}

export interface CreateChargeParams {
  transaction_token_id: string;
  amount: number;
  currency?: string;
  capture?: boolean;
  metadata?: Record<string, string>;
  idempotencyKey?: string;
}

export interface UpdateSubscriptionParams {
  transaction_token_id?: string;
  amount?: number;
  metadata?: Record<string, string>;
  status?: 'unpaid' | 'suspended';
  schedule_settings?: {
    start_on?: string;
    termination_mode?: 'immediate' | 'on_next_payment';
    retry_interval?: string;
  };
  next_payment?: {
    amount?: number;
    due_date?: string;
    terminate_with_status?: '' | 'suspended' | 'canceled';
  };
}

function getAuthHeader(): string {
  return `Bearer ${UNIVAPAY_SECRET}.${UNIVAPAY_JWT}`;
}

const UNIVAPAY_TIMEOUT_MS = 8000;
const UNIVAPAY_MAX_RETRIES = 2;

async function fetchUnivaPay<T>(
  endpoint: string,
  options?: {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    body?: Record<string, unknown>;
    params?: Record<string, string | number | undefined>;
    idempotencyKey?: string;
    ignoreNotFound?: boolean;
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

  const baseFetchOptions: RequestInit = {
    method,
    headers: {
      'Authorization': getAuthHeader(),
      'Content-Type': 'application/json',
    },
  };

  if (options?.idempotencyKey) {
    (baseFetchOptions.headers as Record<string, string>)['Idempotency-Key'] = options.idempotencyKey;
  }

  if (options?.body && (method === 'POST' || method === 'PATCH')) {
    baseFetchOptions.body = JSON.stringify(options.body);
  }

  // POST/PATCHは冪等性が保証できないのでリトライしない（重複課金防止）
  const isRetryable = method === 'GET' || method === 'DELETE';
  const maxAttempts = isRetryable ? UNIVAPAY_MAX_RETRIES : 1;

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), UNIVAPAY_TIMEOUT_MS);

    try {
      const response = await fetch(url.toString(), {
        ...baseFetchOptions,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        if (method === 'GET' && response.status === 429 && attempt < maxAttempts) {
          const retryAfter = Number(response.headers.get('retry-after')) || 1;
          await response.body?.cancel();
          await new Promise(resolve => setTimeout(resolve, Math.min(5000, Math.max(1000, retryAfter * 1000))));
          continue;
        }
        if (response.status === 404 && options?.ignoreNotFound) {
          return undefined as T;
        }
        const errorText = await response.text();
        throw new Error(`UnivaPay API error: ${response.status} ${errorText}`);
      }

      // DELETE returns 204 No Content
      if (method === 'DELETE' || response.status === 204) {
        return undefined as T;
      }

      return await response.json();
    } catch (err) {
      clearTimeout(timeoutId);
      lastError = err;
      const isTimeout = err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError');
      if (!isTimeout || attempt === maxAttempts) {
        throw isTimeout
          ? new Error(`UnivaPay API timeout after ${UNIVAPAY_TIMEOUT_MS}ms (${method} ${endpoint})`)
          : err;
      }
      // タイムアウトかつリトライ可能 → 少し待って再試行
      await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
    }
  }
  throw lastError;
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

  const body: Record<string, unknown> = {
    transaction_token_id: params.transaction_token_id,
    amount: params.amount,
    currency: params.currency ?? 'JPY',
    period: params.period,
    initial_amount: params.initial_amount,
    metadata: params.metadata,
  };

  body.schedule_settings = {
    retry_interval: DEFAULT_SUBSCRIPTION_RETRY_INTERVAL,
    ...params.schedule_settings,
  };

  return fetchUnivaPay<UnivaPaySubscription>(
    `/subscriptions`,
    {
      method: 'POST',
      body,
      idempotencyKey: params.idempotencyKey,
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

  const subscription = await fetchUnivaPay<UnivaPaySubscription>(
    `/stores/${storeId}/subscriptions/${subscriptionId}`,
  );

  return {
    ...subscription,
    next_payment_date: subscription.next_payment_date || subscription.next_payment?.due_date,
  };
}

/**
 * 既存サブスクリプションを更新
 */
export async function updateSubscription(
  subscriptionId: string,
  params: UpdateSubscriptionParams,
  idempotencyKey?: string,
): Promise<UnivaPaySubscription> {
  const storeId = UNIVAPAY_STORE_ID;
  if (!storeId) {
    throw new Error('UNIVAPAY_STORE_ID is not configured');
  }

  const subscription = await fetchUnivaPay<UnivaPaySubscription>(
    `/stores/${storeId}/subscriptions/${subscriptionId}`,
    {
      method: 'PATCH',
      body: params as Record<string, unknown>,
      idempotencyKey,
    },
  );

  return {
    ...subscription,
    next_payment_date: subscription.next_payment_date || subscription.next_payment?.due_date,
  };
}

/**
 * サブスクリプション一覧を取得
 */
export async function listSubscriptions(
  params?: { status?: string; mode?: 'live' | 'test'; limit?: number; cursor?: string },
): Promise<UnivaPayListResponse<UnivaPaySubscription>> {
  const storeId = UNIVAPAY_STORE_ID;
  if (!storeId) {
    throw new Error('UNIVAPAY_STORE_ID is not configured');
  }

  const response = await fetchUnivaPay<UnivaPayListResponse<UnivaPaySubscription>>(
    `/stores/${storeId}/subscriptions`,
    { params: params as Record<string, string | number | undefined> },
  );

  return {
    ...response,
    items: response.items.map((subscription) => ({
      ...subscription,
      next_payment_date: subscription.next_payment_date || subscription.next_payment?.due_date,
    })),
  };
}

export async function getTransactionToken(
  transactionTokenId: string,
): Promise<UnivaPayTransactionToken> {
  const storeId = UNIVAPAY_STORE_ID;
  if (!storeId) {
    throw new Error('UNIVAPAY_STORE_ID is not configured');
  }

  return fetchUnivaPay<UnivaPayTransactionToken>(
    `/stores/${storeId}/tokens/${transactionTokenId}`,
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
      idempotencyKey: params.idempotencyKey,
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
  params?: { from?: string; to?: string; status?: string; mode?: 'live' | 'test'; limit?: number; cursor?: string },
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

export interface UnivaPayRefund {
  id: string;
  charge_id: string;
  status: 'pending' | 'successful' | 'failed' | 'error';
  amount: number;
  currency: string;
  mode: 'live' | 'test';
}

export async function listChargeRefunds(chargeId: string, cursor?: string): Promise<UnivaPayListResponse<UnivaPayRefund>> {
  if (!UNIVAPAY_STORE_ID) throw new Error('UNIVAPAY_STORE_ID is not configured');
  return fetchUnivaPay<UnivaPayListResponse<UnivaPayRefund>>(
    `/stores/${UNIVAPAY_STORE_ID}/charges/${encodeURIComponent(chargeId)}/refunds`,
    { params: { limit: 100, cursor } },
  );
}

export async function collectUnivaPayPages<T extends { id: string }>(
  fetchPage: (cursor?: string) => Promise<UnivaPayListResponse<T>>,
): Promise<T[]> {
  const items = new Map<string, T>();
  const cursors = new Set<string>();
  let cursor: string | undefined;
  for (let page = 0; page < 1000; page++) {
    const result = await fetchPage(cursor);
    if (!Array.isArray(result.items) || typeof result.has_more !== 'boolean') throw new Error('決済履歴の応答が不正です');
    result.items.forEach(item => items.set(item.id, item));
    if (!result.has_more) return [...items.values()];
    const next = result.next_cursor || result.items.at(-1)?.id;
    if (!next || cursors.has(next)) throw new Error('決済履歴を最後まで取得できませんでした');
    cursors.add(next); cursor = next;
  }
  throw new Error('決済履歴の取得上限を超えました');
}

export async function listAllSubscriptions(): Promise<UnivaPaySubscription[]> {
  return collectUnivaPayPages(cursor => listSubscriptions({ mode: 'live', limit: 100, cursor }));
}

/**
 * サブスクリプションをキャンセル
 */
export async function cancelSubscription(subscriptionId: string): Promise<void> {
  const storeId = UNIVAPAY_STORE_ID;
  if (!storeId) {
    throw new Error('UNIVAPAY_STORE_ID is not configured');
  }

  // UnivaPay仕様: statusのPATCHはFORBIDDEN_PARAMETER。DELETEメソッドでキャンセル。
  await fetchUnivaPay(
    `/stores/${storeId}/subscriptions/${subscriptionId}`,
    { method: 'DELETE', ignoreNotFound: true },
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

/**
 * リカーリングトークンを削除（トライアルキャンセル時）
 */
export async function deleteRecurringToken(tokenId: string): Promise<void> {
  const storeId = UNIVAPAY_STORE_ID;
  if (!storeId) {
    throw new Error('UNIVAPAY_STORE_ID is not configured');
  }

  await fetchUnivaPay(
    `/tokens/${tokenId}`,
    { method: 'DELETE' },
  );
}

/**
 * リカーリングトークンからサブスクリプションを作成（トライアル→有料変換時）
 */
export async function createSubscriptionFromToken(params: {
  recurringTokenId: string;
  amount: number;
  initialAmount?: number;
  currency?: string;
  period?: UnivaPaySubscriptionPeriod | 'weekly' | 'daily' | 'biweekly' | 'quarterly' | 'semiannually';
  schedule_settings?: {
    start_on?: string;
    zone_id?: string;
    retry_interval?: string;
  };
  metadata?: Record<string, string>;
  idempotencyKey?: string;
}): Promise<UnivaPaySubscription> {
  const storeId = UNIVAPAY_STORE_ID;
  if (!storeId) {
    throw new Error('UNIVAPAY_STORE_ID is not configured');
  }

  const subscription = await fetchUnivaPay<UnivaPaySubscription>(
    `/subscriptions`,
    {
      method: 'POST',
      body: {
        transaction_token_id: params.recurringTokenId,
        amount: params.amount,
        initial_amount: params.initialAmount,
        currency: params.currency ?? 'JPY',
        period: params.period ?? 'monthly',
        schedule_settings: {
          retry_interval: DEFAULT_SUBSCRIPTION_RETRY_INTERVAL,
          ...params.schedule_settings,
        },
        metadata: params.metadata,
      },
      idempotencyKey: params.idempotencyKey,
    },
  );

  return {
    ...subscription,
    next_payment_date: subscription.next_payment_date || subscription.next_payment?.due_date,
  };
}
