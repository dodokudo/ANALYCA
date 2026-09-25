'use client';

import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from 'react';
import { trackMediaEvent } from './tracking';

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & {
  children: ReactNode;
  articleId?: string;
  placement: string;
};

export function TrackedLink({ children, articleId, placement, href = '', onClick, ...props }: Props) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    void trackMediaEvent({
      eventType: placement.startsWith('related') ? 'related_click' : 'cta_click',
      articleId,
      placement,
      targetUrl: String(href),
    });
  };
  return <a {...props} href={href} onClick={handleClick}>{children}</a>;
}
