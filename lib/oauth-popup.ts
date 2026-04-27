/**
 * OAuth認証をポップアップウィンドウで実行するユーティリティ
 *
 * Instagram 2FAが入るとOAuthのredirect先が消失する問題への対策。
 * ポップアップ方式にすることで、メインページが残り、
 * 2FAでフローが壊れてもユーザーが迷子にならない。
 *
 * 通信チャネル:
 * 1. postMessage (primary) - window.openerが生きている場合
 * 2. localStorage (fallback) - Cross-Origin-Opener-Policyでopenerが切れた場合
 */

import { safeLocalStorage } from './safe-storage';

export const OAUTH_STORAGE_KEY = 'oauth-callback-data';

export interface OAuthCallbackData {
  userId: string;
  tab: string;
  syncing?: string;
}

export class PopupBlockedError extends Error {
  constructor() {
    super('popup_blocked');
    this.name = 'PopupBlockedError';
  }
}

/**
 * OAuthポップアップを開き、認証完了を待つ
 *
 * @param url OAuth認証URL
 * @returns userId と tab を含むコールバックデータ
 * @throws PopupBlockedError ブラウザがポップアップをブロックした場合
 */
export function openOAuthPopup(url: string): Promise<OAuthCallbackData> {
  // 前回のデータが残っていたら消す
  safeLocalStorage.removeItem(OAUTH_STORAGE_KEY);

  return new Promise((resolve, reject) => {
    const width = 600;
    const height = 700;
    const left = Math.round(window.screenX + (window.outerWidth - width) / 2);
    const top = Math.round(window.screenY + (window.outerHeight - height) / 2);

    const features = `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes,status=yes`;

    const popup = window.open(url, 'oauth_popup', features);

    if (!popup || popup.closed) {
      reject(new PopupBlockedError());
      return;
    }

    let resolved = false;

    function done(data: OAuthCallbackData) {
      if (resolved) return;
      resolved = true;
      cleanup();
      safeLocalStorage.removeItem(OAUTH_STORAGE_KEY);
      resolve(data);
    }

    // Channel 1: postMessage（window.openerが生きている場合）
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'oauth-callback') {
        done({
          userId: event.data.userId,
          tab: event.data.tab,
          syncing: event.data.syncing,
        });
      }
    };

    // Channel 2: localStorage（COOPでopenerが切れた場合のフォールバック）
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== OAUTH_STORAGE_KEY || !event.newValue) return;
      try {
        const data = JSON.parse(event.newValue) as OAuthCallbackData;
        if (data.userId) {
          done(data);
        }
      } catch { /* ignore parse errors */ }
    };

    window.addEventListener('message', handleMessage);
    window.addEventListener('storage', handleStorage);

    // ポップアップが閉じられた場合の検知
    const pollTimer = setInterval(() => {
      if (!popup.closed) return;
      if (resolved) return;

      // ポップアップが閉じた直後、localStorageにデータがあるかチェック
      const raw = safeLocalStorage.getItem(OAUTH_STORAGE_KEY);
      if (raw) {
        try {
          const data = JSON.parse(raw) as OAuthCallbackData;
          if (data.userId) {
            done(data);
            return;
          }
        } catch { /* ignore */ }
      }

      cleanup();
      reject(new Error('popup_closed'));
    }, 500);

    function cleanup() {
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('storage', handleStorage);
      clearInterval(pollTimer);
    }
  });
}
