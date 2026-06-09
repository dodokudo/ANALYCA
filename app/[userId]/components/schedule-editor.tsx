'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ScheduledPost, ScheduledPostMediaItem } from './schedule-types';
import { classNames } from '@/lib/classNames';

const MAX_LENGTH = 500;
const MAX_MEDIA_ITEMS = 10;

function toDateTimeLocal(value: string) {
  if (!value) return '';
  const [datePart, timePart] = value.split('T');
  if (!datePart || !timePart) return '';
  return `${datePart}T${timePart.slice(0, 5)}`;
}

type ScheduleEditorProps = {
  selectedDate: string;
  selectedItem: ScheduledPost | null;
  userId: string;
  isSaving?: boolean;
  isPublishing?: boolean;
  onSave: (payload: {
    scheduleId?: string;
    scheduledAt: string;
    mainText: string;
    comment1: string;
    comment2: string;
    comment3: string;
    comment4: string;
    comment5: string;
    comment6: string;
    comment7: string;
    mediaItems: ScheduledPostMediaItem[];
    status: 'draft' | 'scheduled';
  }) => Promise<void>;
  onPublishNow: (payload: {
    mainText: string;
    comment1: string;
    comment2: string;
    comment3: string;
    comment4: string;
    comment5: string;
    comment6: string;
    comment7: string;
    mediaItems: ScheduledPostMediaItem[];
  }) => Promise<void>;
};

export function ScheduleEditor({
  selectedDate,
  selectedItem,
  userId,
  isSaving,
  isPublishing,
  onSave,
  onPublishNow,
}: ScheduleEditorProps) {
  const [scheduledAt, setScheduledAt] = useState('');
  const [mainText, setMainText] = useState('');
  const [comment1, setComment1] = useState('');
  const [comment2, setComment2] = useState('');
  const [comment3, setComment3] = useState('');
  const [comment4, setComment4] = useState('');
  const [comment5, setComment5] = useState('');
  const [comment6, setComment6] = useState('');
  const [comment7, setComment7] = useState('');
  const [mediaItems, setMediaItems] = useState<ScheduledPostMediaItem[]>([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedItem) {
      setScheduledAt(toDateTimeLocal(selectedItem.scheduledAtJst));
      setMainText(selectedItem.mainText);
      setComment1(selectedItem.comment1);
      setComment2(selectedItem.comment2);
      setComment3(selectedItem.comment3);
      setComment4(selectedItem.comment4);
      setComment5(selectedItem.comment5);
      setComment6(selectedItem.comment6);
      setComment7(selectedItem.comment7);
      setMediaItems(selectedItem.mediaItems || []);
      setError(null);
      return;
    }

    const nextDefault = selectedDate ? `${selectedDate}T09:00` : '';
    setScheduledAt(nextDefault);
    setMainText('');
    setComment1('');
    setComment2('');
    setComment3('');
    setComment4('');
    setComment5('');
    setComment6('');
    setComment7('');
    setMediaItems([]);
    setError(null);
  }, [selectedDate, selectedItem]);

  const mainLength = mainText.length;
  const comment1Length = comment1.length;
  const comment2Length = comment2.length;
  const comment3Length = comment3.length;
  const comment4Length = comment4.length;
  const comment5Length = comment5.length;
  const comment6Length = comment6.length;
  const comment7Length = comment7.length;

  const optionalCommentsValid =
    comment3Length <= MAX_LENGTH &&
    comment4Length <= MAX_LENGTH &&
    comment5Length <= MAX_LENGTH &&
    comment6Length <= MAX_LENGTH &&
    comment7Length <= MAX_LENGTH;

  const isValidForSchedule = useMemo(() => {
    return (
      scheduledAt &&
      mainText.trim().length > 0 &&
      comment1.trim().length > 0 &&
      comment2.trim().length > 0 &&
      mainLength <= MAX_LENGTH &&
      comment1Length <= MAX_LENGTH &&
      comment2Length <= MAX_LENGTH &&
      optionalCommentsValid
    );
  }, [scheduledAt, mainText, comment1, comment2, mainLength, comment1Length, comment2Length, optionalCommentsValid]);

  const isValidForPublish = useMemo(() => {
    return (
      mainText.trim().length > 0 &&
      comment1.trim().length > 0 &&
      comment2.trim().length > 0 &&
      mainLength <= MAX_LENGTH &&
      comment1Length <= MAX_LENGTH &&
      comment2Length <= MAX_LENGTH &&
      optionalCommentsValid
    );
  }, [mainText, comment1, comment2, mainLength, comment1Length, comment2Length, optionalCommentsValid]);

  const handleMediaUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const nextFiles = Array.from(files);
    if (mediaItems.length + nextFiles.length > MAX_MEDIA_ITEMS) {
      setError(`メディアは最大${MAX_MEDIA_ITEMS}件までです。`);
      return;
    }

    setUploadingMedia(true);
    setError(null);
    try {
      const uploadGroup = selectedItem?.scheduleId || `${Date.now()}`;
      const res = await fetch(`/api/schedule/threads/media?userId=${encodeURIComponent(userId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uploadGroup,
          files: nextFiles.map((file) => ({ name: file.name, type: file.type, size: file.size })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'メディアのアップロードに失敗しました');
      }

      const uploadTargets = Array.isArray(data.uploadTargets) ? data.uploadTargets : [];
      if (uploadTargets.length !== nextFiles.length) {
        throw new Error('アップロードURLの作成に失敗しました');
      }

      const uploaded: ScheduledPostMediaItem[] = [];
      for (let index = 0; index < nextFiles.length; index++) {
        const file = nextFiles[index];
        const target = uploadTargets[index];
        const uploadRes = await fetch(target.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': target.contentType || file.type },
          body: file,
        });
        if (!uploadRes.ok) {
          throw new Error(`${file.name}のアップロードに失敗しました`);
        }
        uploaded.push({
          url: target.url,
          type: target.type === 'VIDEO' ? 'VIDEO' : 'IMAGE',
          name: target.name || file.name,
        });
      }

      setMediaItems((current) => [...current, ...uploaded].slice(0, MAX_MEDIA_ITEMS));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'メディアのアップロードに失敗しました');
    } finally {
      setUploadingMedia(false);
    }
  };

  const removeMediaItem = (index: number) => {
    setMediaItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleSubmit = async (status: 'draft' | 'scheduled') => {
    if (!isValidForSchedule) {
      setError('未入力または文字数超過の項目があります。');
      return;
    }
    setError(null);
    await onSave({
      scheduleId: selectedItem?.scheduleId,
      scheduledAt,
      mainText,
      comment1,
      comment2,
      comment3,
      comment4,
      comment5,
      comment6,
      comment7,
      mediaItems,
      status,
    });
  };

  const handlePublishNow = async () => {
    if (!isValidForPublish) {
      setError('メイン投稿とコメントを入力してください。');
      return;
    }
    setError(null);
    await onPublishNow({
      mainText,
      comment1,
      comment2,
      comment3,
      comment4,
      comment5,
      comment6,
      comment7,
      mediaItems,
    });
  };

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm h-fit">
      <header className="mb-4">
        <h2 className="text-base font-semibold text-gray-900">予約エディタ</h2>
        <p className="mt-1 text-xs text-gray-500">
          {selectedItem ? '選択中の予約を編集' : '新規予約を作成'}
        </p>
      </header>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs font-medium text-gray-500">
            予約日時（JST）
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(event) => setScheduledAt(event.target.value)}
              className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
            />
          </label>
          <div className="flex flex-col">
            <span className="text-xs font-medium text-gray-500">即時投稿</span>
            <button
              type="button"
              className="mt-2 h-[42px] rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              disabled={isPublishing || isSaving}
              onClick={handlePublishNow}
            >
              {isPublishing ? '投稿中...' : '今すぐ投稿'}
            </button>
          </div>
        </div>

        <label className="block text-xs font-medium text-gray-500">
          メイン投稿（必須）
          <textarea
            value={mainText}
            onChange={(event) => setMainText(event.target.value)}
            rows={4}
            className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          />
          <div className={classNames('mt-1 text-right text-[11px]', mainLength > MAX_LENGTH ? 'text-red-500' : 'text-gray-400')}>
            {mainLength}/{MAX_LENGTH}
          </div>
        </label>

        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-medium text-gray-600">画像 / 動画</div>
              <div className="mt-1 text-[11px] text-gray-400">最大{MAX_MEDIA_ITEMS}件、投稿本文に添付</div>
            </div>
            <label className="cursor-pointer rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50">
              {uploadingMedia ? 'アップロード中...' : '追加'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime"
                multiple
                disabled={uploadingMedia || mediaItems.length >= MAX_MEDIA_ITEMS}
                className="hidden"
                onChange={(event) => {
                  void handleMediaUpload(event.target.files);
                  event.target.value = '';
                }}
              />
            </label>
          </div>

          {mediaItems.length > 0 ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {mediaItems.map((item, index) => (
                <div key={`${item.url}-${index}`} className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-2">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-gray-100 text-[10px] font-semibold text-gray-500">
                    {item.type === 'IMAGE' ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      'VIDEO'
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium text-gray-700">{item.name || `${item.type} ${index + 1}`}</div>
                    <div className="text-[11px] text-gray-400">{item.type}</div>
                  </div>
                  <button
                    type="button"
                    className="rounded-md px-2 py-1 text-xs text-rose-600 hover:bg-rose-50"
                    onClick={() => removeMediaItem(index)}
                  >
                    削除
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <label className="block text-xs font-medium text-gray-500">
          コメント1（必須）
          <textarea
            value={comment1}
            onChange={(event) => setComment1(event.target.value)}
            rows={9}
            className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          />
          <div className={classNames('mt-1 text-right text-[11px]', comment1Length > MAX_LENGTH ? 'text-red-500' : 'text-gray-400')}>
            {comment1Length}/{MAX_LENGTH}
          </div>
        </label>

        <label className="block text-xs font-medium text-gray-500">
          コメント2（必須）
          <textarea
            value={comment2}
            onChange={(event) => setComment2(event.target.value)}
            rows={9}
            className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          />
          <div className={classNames('mt-1 text-right text-[11px]', comment2Length > MAX_LENGTH ? 'text-red-500' : 'text-gray-400')}>
            {comment2Length}/{MAX_LENGTH}
          </div>
        </label>

        {([
          { index: 3, value: comment3, length: comment3Length, setter: setComment3 },
          { index: 4, value: comment4, length: comment4Length, setter: setComment4 },
          { index: 5, value: comment5, length: comment5Length, setter: setComment5 },
          { index: 6, value: comment6, length: comment6Length, setter: setComment6 },
          { index: 7, value: comment7, length: comment7Length, setter: setComment7 },
        ] as const).map((c) => (
          <label key={c.index} className="block text-xs font-medium text-gray-500">
            コメント{c.index}（任意）
            <textarea
              value={c.value}
              onChange={(event) => c.setter(event.target.value)}
              rows={9}
              className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
            />
            <div className={classNames('mt-1 text-right text-[11px]', c.length > MAX_LENGTH ? 'text-red-500' : 'text-gray-400')}>
              {c.length}/{MAX_LENGTH}
            </div>
          </label>
        ))}

        {error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            disabled={isSaving}
            onClick={() => handleSubmit('draft')}
          >
            {isSaving ? '保存中...' : '下書き保存'}
          </button>
          <button
            type="button"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            disabled={isSaving}
            onClick={() => handleSubmit('scheduled')}
          >
            {isSaving ? '登録中...' : '予約登録'}
          </button>
        </div>
      </div>
    </section>
  );
}
