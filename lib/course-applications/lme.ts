import type { Friend } from './domain';

export async function lmeRequest<T>(path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
  const key = process.env.LME_API_KEY;
  if (!key) throw new Error('LME API not configured');
  const response = await fetch(`https://api.lmes.jp/v1/${path}`, {
    method: body ? 'POST' : 'GET', cache: 'no-store', signal: AbortSignal.timeout(15_000),
    headers: { 'X-LME-API-KEY': key, ...(body ? { 'Content-Type': 'application/json' } : {}), ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = await response.json();
  if (!response.ok || json.success !== true) throw new Error(`LME request failed (${response.status})`);
  return json.data as T;
}
export const fetchFriend = async (id: number) => (await lmeRequest<{ friend: Friend }>(`friends/detail?lmessage_friend_id=${id}`)).friend;
export const notifyDownloads = async (friendId: number, url: string, id: string, hasBankPayment: boolean) => lmeRequest('messages/push', {
  friend_id: friendId, id_type: 'lmessage_friend_id',
  messages: [{ type: 'text', text: `領収書の準備ができました。\nこちらからダウンロードできます。\n${url}\n\n${hasBankPayment ? '銀行振込分の請求書も同じページにございます。請求書はお支払い済みのため、追加のお支払いは不要です。\n' : ''}PDFはご入力のメールアドレスにもお送りします。` }],
}, `documents-${id}`);
