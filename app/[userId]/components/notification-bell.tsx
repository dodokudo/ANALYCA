'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type NotificationItem = {
  notification_id: string;
  title: string;
  body: string | null;
  link: string | null;
  type: string | null;
  created_at: string;
  is_read: boolean;
};

type NotificationBellProps = {
  userId: string;
  variant?: 'icon' | 'sidebar';
};

function formatRelative(createdAt: string): string {
  const ts = new Date(createdAt);
  if (Number.isNaN(ts.getTime())) return '';
  const diffMs = Date.now() - ts.getTime();
  const minutes = Math.floor(diffMs / (60 * 1000));
  if (minutes < 1) return 'たった今';
  if (minutes < 60) return `${minutes}分前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}時間前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}日前`;
  return ts.toLocaleDateString('ja-JP');
}

export function NotificationBell({ userId, variant = 'icon' }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const unreadCount = useMemo(() => items.filter((i) => !i.is_read).length, [items]);

  const loadItems = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/notifications?userId=${encodeURIComponent(userId)}`);
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (err) {
      console.error('[notification-bell] load failed', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadItems();
    const interval = setInterval(loadItems, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadItems]);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (event: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  const markItem = async (notificationId: string) => {
    setItems((prev) => prev.map((item) => item.notification_id === notificationId ? { ...item, is_read: true } : item));
    try {
      await fetch(`/api/notifications?userId=${encodeURIComponent(userId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId }),
      });
    } catch (err) {
      console.error('[notification-bell] mark failed', err);
    }
  };

  const markAll = async () => {
    setItems((prev) => prev.map((item) => ({ ...item, is_read: true })));
    try {
      await fetch(`/api/notifications?userId=${encodeURIComponent(userId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAll: true }),
      });
    } catch (err) {
      console.error('[notification-bell] mark-all failed', err);
    }
  };

  const handleItemClick = (item: NotificationItem) => {
    if (!item.is_read) markItem(item.notification_id);
    if (item.link) {
      if (item.link.startsWith('?')) {
        window.location.search = item.link.slice(1);
      } else if (item.link.startsWith('http')) {
        window.open(item.link, '_blank', 'noopener,noreferrer');
      } else {
        window.location.href = item.link;
      }
    }
  };

  const bellIcon = (
    <svg className={variant === 'sidebar' ? 'w-5 h-5' : 'h-6 w-6'} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  );

  return (
    <div ref={containerRef} className="relative">
      {variant === 'sidebar' ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-md)] text-sm font-medium transition-colors ${
            open
              ? 'bg-[color:var(--color-surface-muted)] text-[color:var(--color-text-primary)]'
              : 'text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-surface-muted)]'
          }`}
          aria-label="通知"
        >
          {bellIcon}
          <span>通知</span>
          {unreadCount > 0 && (
            <span className="ml-auto inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1.5 text-[11px] font-bold text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="relative flex h-10 w-10 items-center justify-center rounded-full text-[color:var(--color-text-secondary)] transition-colors hover:bg-[color:var(--color-surface-muted)]"
          aria-label="通知"
        >
          {bellIcon}
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      )}
      {open && (
        <div className={`absolute z-50 w-80 max-w-[calc(100vw-1rem)] overflow-hidden rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-white shadow-xl ${
          variant === 'sidebar' ? 'left-full bottom-0 ml-2' : 'right-0 top-12'
        }`}>
          <div className="flex items-center justify-between border-b border-[color:var(--color-border)] px-3 py-2">
            <span className="text-sm font-semibold text-[color:var(--color-text-primary)]">通知</span>
            {unreadCount > 0 && (
              <button
                type="button"
                className="text-[11px] text-[color:var(--color-accent)] hover:underline"
                onClick={markAll}
              >
                すべて既読
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {loading && items.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-[color:var(--color-text-muted)]">読み込み中…</p>
            ) : items.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-[color:var(--color-text-muted)]">通知はありません</p>
            ) : (
              <ul className="divide-y divide-[color:var(--color-border)]">
                {items.map((item) => (
                  <li
                    key={item.notification_id}
                    onClick={() => handleItemClick(item)}
                    className={`cursor-pointer px-3 py-3 transition-colors hover:bg-[color:var(--color-surface-muted)] ${item.is_read ? '' : 'bg-indigo-50/40'}`}
                  >
                    <div className="flex items-start gap-2">
                      {!item.is_read && <span className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full bg-rose-500" />}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[color:var(--color-text-primary)]">{item.title}</p>
                        {item.body && (
                          <p className="mt-1 whitespace-pre-wrap text-xs text-[color:var(--color-text-secondary)]">{item.body}</p>
                        )}
                        <p className="mt-1 text-[10px] text-[color:var(--color-text-muted)]">{formatRelative(item.created_at)}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
