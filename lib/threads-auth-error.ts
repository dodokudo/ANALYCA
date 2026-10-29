export const THREADS_REAUTH_MESSAGE = 'Threadsとの連携が切れています。パスワード変更や認証の有効期限切れなどが原因です。これまでANALYCAで使っていたThreadsアカウントで再ログインしてください。';

/** Match Meta token errors, including previously persisted worker error strings. */
export function isThreadsAuthError(error: unknown): boolean {
  if (error instanceof Error) return isThreadsAuthError(error.message);
  if (typeof error === 'string') {
    if (error.includes(THREADS_REAUTH_MESSAGE)) return true;
    // API routes and workers may prefix the original JSON with a description.
    const start = error.indexOf('{');
    if (start >= 0) {
      try { return isThreadsAuthError(JSON.parse(error.slice(start))); } catch { /* non-JSON message */ }
    }
    return /Error validating access token|access token (?:has expired|is invalid)|session has been invalidated/i.test(error);
  }
  if (!error || typeof error !== 'object') return false;
  const value = error as { code?: unknown; error?: unknown; message?: unknown };
  return value.code === 190 || value.code === '190' ||
    isThreadsAuthError(value.error) || isThreadsAuthError(value.message);
}
