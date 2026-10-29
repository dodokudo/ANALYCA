import type { ScheduledPost, SchedulePreviewData } from '@/app/[userId]/components/schedule-types';

const MAX_AGE = 2 * 60 * 60 * 1000;
const key = (userId: string) => `analyca:threads-reauth-draft:${userId}`;

export function saveThreadsReauthDraft(storage: Storage, userId: string, data: SchedulePreviewData, selectedItem: ScheduledPost | null, now = Date.now()): void {
  const post: ScheduledPost = {
    scheduleId: '', status: 'draft', scheduledAt: '', scheduledAtJst: '', scheduledDate: '',
    mainThreadId: null, comment1ThreadId: null, comment2ThreadId: null,
    errorMessage: null, createdAt: '', updatedAt: '',
    ...selectedItem, ...data,
  };
  post.scheduledAtJst = `${data.scheduledAt}:00+09:00`;
  post.scheduledAt = post.scheduledAtJst;
  post.scheduledDate = data.scheduledAt.slice(0, 10);
  const encoded = JSON.stringify({ userId, expiresAt: now + MAX_AGE, post });
  storage.setItem(key(userId), encoded);
  if (storage.getItem(key(userId)) !== encoded) throw new Error('Draft storage unavailable');
}

export function takeThreadsReauthDraft(storage: Storage, userId: string, now = Date.now()): ScheduledPost | null {
  const raw = storage.getItem(key(userId));
  if (!raw) return null;
  storage.removeItem(key(userId));
  try {
    const value = JSON.parse(raw);
    if (value.userId !== userId || !Number.isFinite(value.expiresAt) || value.expiresAt <= now) return null;
    const post = value.post;
    if (!post || typeof post.scheduleId !== 'string' || typeof post.mainText !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(post.scheduledDate)) return null;
    return post as ScheduledPost;
  } catch { return null; }
}
