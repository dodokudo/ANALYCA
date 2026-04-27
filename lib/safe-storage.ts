/**
 * Safari Private Browsing や localStorage が無効化された環境でも落ちない安全ラッパー
 * window.localStorage が null/undefined を返す、QuotaExceededError 等を全て握りつぶす
 */

function getStore(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

export const safeLocalStorage = {
  getItem(key: string): string | null {
    const store = getStore();
    if (!store) return null;
    try {
      return store.getItem(key);
    } catch {
      return null;
    }
  },

  setItem(key: string, value: string): void {
    const store = getStore();
    if (!store) return;
    try {
      store.setItem(key, value);
    } catch {
      // QuotaExceededError や Safari Private のエラーを無視
    }
  },

  removeItem(key: string): void {
    const store = getStore();
    if (!store) return;
    try {
      store.removeItem(key);
    } catch {
      // ignore
    }
  },
};
