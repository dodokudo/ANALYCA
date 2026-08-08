'use client';

import type { SchedulePreviewData, ScheduledPostMediaItem } from './schedule-types';

type SchedulePreviewProps = {
  data: SchedulePreviewData;
  username: string;
  profilePicture?: string;
};

type IconProps = {
  className?: string;
};

function HeartIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ReplyIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7A8.38 8.38 0 0 1 4 11.5a8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RepostIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m17 2 4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 11V9a3 3 0 0 1 3-3h15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m7 22-4-4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 13v2a3 3 0 0 1-3 3H3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ShareIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m22 2-7 20-4-9-9-4 20-7Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M22 2 11 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MoreIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="19" cy="12" r="1.5" />
    </svg>
  );
}

function Avatar({ profilePicture, username, size = 'main' }: { profilePicture?: string; username: string; size?: 'main' | 'reply' }) {
  const dimensions = size === 'main' ? 'h-10 w-10' : 'h-8 w-8';
  return (
    <div className={`${dimensions} shrink-0 overflow-hidden rounded-full bg-neutral-200`}>
      {profilePicture ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={profilePicture} alt={`${username}のプロフィール写真`} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-black text-xs font-semibold text-white">
          {username.slice(0, 1).toUpperCase()}
        </div>
      )}
    </div>
  );
}

function MediaPreview({ items }: { items: ScheduledPostMediaItem[] }) {
  const firstItem = items[0];
  if (!firstItem) return null;

  return (
    <div className="relative mt-3 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50">
      {firstItem.type === 'IMAGE' ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={firstItem.url} alt={firstItem.altText || ''} className="max-h-[430px] w-full object-contain" />
      ) : (
        <video src={firstItem.url} controls muted playsInline className="max-h-[430px] w-full bg-black object-contain" />
      )}
      {items.length > 1 ? (
        <div className="absolute right-3 top-3 rounded-full bg-black/70 px-2 py-1 text-[11px] font-medium text-white">
          1/{items.length}
        </div>
      ) : null}
    </div>
  );
}

function ThreadActions() {
  const iconClassName = 'h-[19px] w-[19px]';
  return (
    <div className="thread-action mt-3 flex items-center gap-5 text-black" aria-label="Threadsの投稿アクション表示">
      <HeartIcon className={iconClassName} />
      <ReplyIcon className={iconClassName} />
      <RepostIcon className={iconClassName} />
      <ShareIcon className={iconClassName} />
    </div>
  );
}

function formatPreviewTime(value: string) {
  if (!value) return '予約前';
  const [datePart, timePart = ''] = value.split('T');
  const [, month = '', day = ''] = datePart.split('-');
  return `${Number(month)}/${Number(day)} ${timePart.slice(0, 5)}`;
}

export function SchedulePreview({ data, username, profilePicture }: SchedulePreviewProps) {
  const replies = [
    { text: data.comment1, mediaItems: data.comment1MediaItems },
    { text: data.comment2, mediaItems: data.comment2MediaItems },
    { text: data.comment3, mediaItems: [] },
    { text: data.comment4, mediaItems: [] },
    { text: data.comment5, mediaItems: [] },
    { text: data.comment6, mediaItems: [] },
    { text: data.comment7, mediaItems: [] },
  ].filter((reply) => reply.text.trim() || reply.mediaItems.length > 0);

  return (
    <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
      <header className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-neutral-950">投稿プレビュー</h2>
          <p className="mt-0.5 text-[11px] text-neutral-500">Threadsでの表示イメージ</p>
        </div>
        <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[10px] font-medium text-neutral-600">PC</span>
      </header>

      <div className="bg-white">
        <article className="px-4 py-4 text-neutral-950">
          <div className="flex items-start gap-3">
            <div className="relative self-stretch">
              <Avatar profilePicture={profilePicture} username={username} />
              {replies.length > 0 ? <div className="absolute bottom-0 left-1/2 top-12 w-px -translate-x-1/2 bg-neutral-300" /> : null}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 leading-none">
                <span className="truncate text-[14px] font-semibold">{username}</span>
                <span className="text-[13px] text-neutral-500">{formatPreviewTime(data.scheduledAt)}</span>
                <MoreIcon className="ml-auto h-5 w-5 text-neutral-500" />
              </div>
              <p className={`mt-2 whitespace-pre-wrap break-words text-[14px] leading-[1.45] ${data.mainText ? 'text-neutral-950' : 'text-neutral-400'}`}>
                {data.mainText || '投稿本文を入力すると、ここに表示されます。'}
              </p>
              <MediaPreview items={data.mediaItems} />
              <ThreadActions />
            </div>
          </div>
        </article>

        {replies.map((reply, index) => (
          <article key={`${index}-${reply.text.slice(0, 24)}`} className="border-t border-neutral-100 px-4 py-3 text-neutral-950">
            <div className="flex items-start gap-3">
              <div className="relative self-stretch">
                <Avatar profilePicture={profilePicture} username={username} size="reply" />
                {index < replies.length - 1 ? <div className="absolute bottom-0 left-1/2 top-10 w-px -translate-x-1/2 bg-neutral-300" /> : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 leading-none">
                  <span className="truncate text-[13px] font-semibold">{username}</span>
                  <span className="text-[12px] text-neutral-500">返信</span>
                  <MoreIcon className="ml-auto h-4 w-4 text-neutral-500" />
                </div>
                {reply.text ? <p className="mt-2 whitespace-pre-wrap break-words text-[13px] leading-[1.45]">{reply.text}</p> : null}
                <MediaPreview items={reply.mediaItems} />
                <ThreadActions />
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
