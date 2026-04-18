'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

type CommentData = {
  id: string;
  text: string;
  views: number;
  depth: number;
};

type RepostButtonProps = {
  userId: string;
  postId: string;
  mainText: string;
  comments: CommentData[];
};

const COMMENT_SLOT_LIMIT = 7;
const TEXT_LENGTH_LIMIT = 500;

type Eligibility = { eligible: boolean; reason?: string };

function cleanContent(text: string) {
  return (text ?? '').replace(/^【メイン投稿】\s*/g, '').replace(/^【コメント\d+】\s*/g, '');
}

function evaluate(mainText: string, comments: CommentData[]): Eligibility {
  const cleanedMain = cleanContent(mainText).trim();
  if (!cleanedMain) return { eligible: false, reason: '本文空' };
  if (cleanedMain.length > TEXT_LENGTH_LIMIT) return { eligible: false, reason: '本文500字超' };
  if (comments.length < 2) return { eligible: false, reason: 'コメ<2' };
  const tooLong = comments.slice(0, COMMENT_SLOT_LIMIT).find((c) => cleanContent(c.text).length > TEXT_LENGTH_LIMIT);
  if (tooLong) return { eligible: false, reason: 'コメ500字超' };
  return { eligible: true, reason: undefined };
}

function RepostTrigger({
  eligibility,
  onOpen,
}: {
  eligibility: Eligibility;
  onOpen: (event: React.MouseEvent) => void;
}) {
  const reason = eligibility.eligible ? null : eligibility.reason;
  const label = reason ?? '再投稿';
  const title = reason ?? '同じ内容で再投稿を予約';
  return (
    <button
      type="button"
      disabled={!eligibility.eligible}
      title={title}
      onClick={onOpen}
      className="rounded-full border border-[color:var(--color-accent)] bg-[color:var(--color-accent)] px-2.5 py-0.5 text-[11px] font-medium text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
    >
      {label}
    </button>
  );
}

function getDefaultScheduledAt() {
  const now = new Date();
  now.setMinutes(now.getMinutes() + 60);
  now.setSeconds(0);
  now.setMilliseconds(0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

export function RepostButton({ userId, postId, mainText, comments }: RepostButtonProps) {
  const sortedComments = useMemo(
    () => [...comments].sort((a, b) => a.depth - b.depth),
    [comments],
  );
  const eligibility = useMemo(() => evaluate(mainText, sortedComments), [mainText, sortedComments]);

  const [open, setOpen] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [portalMounted, setPortalMounted] = useState(false);

  useEffect(() => {
    setPortalMounted(true);
  }, []);

  const handleOpen = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (!eligibility.eligible) return;
    setScheduledAt(getDefaultScheduledAt());
    setSubmitError(null);
    setOpen(true);
  };

  const handleClose = () => {
    if (submitting) return;
    setOpen(false);
    setSubmitError(null);
  };

  const handleSubmit = async () => {
    if (!scheduledAt) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const commentTexts = sortedComments.slice(0, COMMENT_SLOT_LIMIT).map((c) => cleanContent(c.text));
      const body: Record<string, unknown> = {
        scheduledAt,
        mainText: cleanContent(mainText),
        comment1: commentTexts[0] ?? '',
        comment2: commentTexts[1] ?? '',
        comment3: commentTexts[2] ?? '',
        comment4: commentTexts[3] ?? '',
        comment5: commentTexts[4] ?? '',
        comment6: commentTexts[5] ?? '',
        comment7: commentTexts[6] ?? '',
        status: 'scheduled',
      };
      const res = await fetch(`/api/schedule/threads?userId=${encodeURIComponent(userId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || '予約の登録に失敗しました');
      setOpen(false);
      setSuccessMessage('再投稿を予約しました。予約投稿タブで編集できます。');
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : '予約の登録に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  const usedCount = Math.min(sortedComments.length, COMMENT_SLOT_LIMIT);
  const overflow = Math.max(0, sortedComments.length - COMMENT_SLOT_LIMIT);
  const previewComments = sortedComments.slice(0, COMMENT_SLOT_LIMIT);

  return (
    <>
      <RepostTrigger eligibility={eligibility} onOpen={handleOpen} />
      {successMessage && portalMounted && createPortal(
        <div
          key={`repost-toast-${postId}`}
          className="fixed bottom-6 right-6 z-[60] rounded-[var(--radius-sm)] border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs text-emerald-700 shadow-lg"
        >
          {successMessage}
        </div>,
        document.body,
      )}
      {portalMounted && open && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={handleClose}
        >
          <div
            className="w-full max-w-lg rounded-[var(--radius-md)] bg-white p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold text-[color:var(--color-text-primary)]">再投稿の予約</h3>
              <button
                type="button"
                className="text-sm text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)]"
                onClick={handleClose}
                disabled={submitting}
              >
                閉じる
              </button>
            </header>
            <p className="mb-3 text-xs text-[color:var(--color-text-secondary)]">
              同じ本文とコメント{usedCount}件を指定日時に再投稿します。
              {overflow > 0 ? `元の投稿はコメント${sortedComments.length}件ですが、再投稿は先頭${COMMENT_SLOT_LIMIT}件までです。` : ''}
              登録後は予約投稿タブで編集できます。
            </p>
            <label className="mb-1 block text-xs font-medium text-[color:var(--color-text-secondary)]">
              投稿日時（JST）
            </label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(event) => setScheduledAt(event.target.value)}
              className="mb-3 h-10 w-full rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--color-accent)]"
              disabled={submitting}
            />
            <div className="mb-3 max-h-64 overflow-y-auto text-xs text-[color:var(--color-text-primary)]">
              <p className="whitespace-pre-wrap">{cleanContent(mainText)}</p>
              {previewComments.length > 0 && (
                <>
                  <div className="my-3 border-t border-gray-200" />
                  <p className="mb-2 text-xs font-medium text-gray-500">コメント欄</p>
                  <div className="space-y-2">
                    {previewComments.map((c, idx) => (
                      <div key={c.id ?? idx} className="rounded-md bg-gray-50 p-2">
                        <div className="mb-1 flex items-center gap-2 text-[10px] text-gray-400">
                          <span className="font-medium text-purple-600">コメント{idx + 1}</span>
                        </div>
                        <p className="whitespace-pre-wrap text-gray-700">{cleanContent(c.text)}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
            {submitError && (
              <div className="mb-3 rounded-[var(--radius-sm)] border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {submitError}
              </div>
            )}
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={handleClose}
                disabled={submitting}
                className="rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-white px-4 py-2 text-sm text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-surface-muted)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || !scheduledAt}
                className="rounded-[var(--radius-sm)] border border-[color:var(--color-accent)] bg-[color:var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? '登録中…' : '再投稿を予約'}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
