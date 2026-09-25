'use client';

import { useEffect } from 'react';

type MediaEvent = {
  eventType: 'page_view' | 'cta_click' | 'related_click' | 'social_click';
  articleId?: string;
  placement?: string;
  targetUrl?: string;
};

function sessionId(): string {
  const key = 'analycaMediaSessionId';
  const current = window.sessionStorage.getItem(key);
  if (current) return current;
  const next = window.crypto.randomUUID();
  window.sessionStorage.setItem(key, next);
  return next;
}

export async function trackMediaEvent(input: MediaEvent): Promise<void> {
  if (typeof window === 'undefined') return;
  const body = JSON.stringify({
    ...input,
    sessionId: sessionId(),
    path: window.location.pathname,
    referrer: document.referrer,
  });
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/media/events', new Blob([body], { type: 'application/json' }));
    return;
  }
  await fetch('/api/media/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true });
}

export function MediaPageView({ articleId }: { articleId?: string }) {
  useEffect(() => {
    void trackMediaEvent({ eventType: 'page_view', articleId });
  }, [articleId]);
  return null;
}
