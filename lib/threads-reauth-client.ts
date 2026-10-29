export const THREADS_AUTH_INVALID_EVENT = 'analyca:threads-auth-invalid';
export const THREADS_BEFORE_REAUTH_EVENT = 'analyca:before-threads-reauth';

export function reportThreadsAuthError(userId: string): void {
  window.dispatchEvent(new CustomEvent(THREADS_AUTH_INVALID_EVENT, { detail: { userId } }));
}

export function beginThreadsReauthentication(userId: string): boolean {
  // Editors can prevent navigation if an upload is in flight or recovery storage fails.
  const canLeave = window.dispatchEvent(new CustomEvent(THREADS_BEFORE_REAUTH_EVENT, {
    cancelable: true, detail: { userId },
  }));
  if (!canLeave) return false;
  const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const params = new URLSearchParams({ userId, returnTo });
  window.location.assign(`/api/auth/threads/reconnect?${params}`);
  return true;
}
