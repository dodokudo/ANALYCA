'use client';

import { useState } from 'react';
import { classNames } from '@/lib/classNames';
import type { ScheduledPost } from './schedule-types';

const weekdayMap: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const weekdayFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  timeZone: 'Asia/Tokyo',
});

const dayLabels = ['日', '月', '火', '水', '木', '金', '土'];

function getJstWeekdayIndex(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month, day, 0, 0, 0));
  const label = weekdayFormatter.format(date);
  return weekdayMap[label] ?? 0;
}

function formatDateKey(year: number, month: number, day: number) {
  const mm = String(month + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

function getTimeLabel(value: string) {
  const timePart = value.split('T')[1] ?? '';
  return timePart.slice(0, 5);
}

type ScheduleCalendarProps = {
  currentMonth: Date;
  selectedDate: string;
  items: ScheduledPost[];
  isLoading?: boolean;
  onMonthChange: (next: Date) => void;
  onSelectDate: (dateKey: string) => void;
  onSelectItem: (item: ScheduledPost) => void;
  onDeleteItem: (item: ScheduledPost) => void;
};

export function ScheduleCalendar({
  currentMonth,
  selectedDate,
  items,
  isLoading,
  onMonthChange,
  onSelectDate,
  onSelectItem,
  onDeleteItem,
}: ScheduleCalendarProps) {
  const [detailItem, setDetailItem] = useState<ScheduledPost | null>(null);
  const [listFilter, setListFilter] = useState<'all' | 'scheduled' | 'posted'>('scheduled');

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const monthLabel = currentMonth.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    timeZone: 'Asia/Tokyo',
  });

  const startOffset = getJstWeekdayIndex(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const countsByDate = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.scheduledDate] = (acc[item.scheduledDate] ?? 0) + 1;
    return acc;
  }, {});

  const selectedItems = items
    .filter((item) => item.scheduledDate === selectedDate)
    .filter((item) => {
      if (listFilter === 'scheduled') return item.status === 'scheduled';
      if (listFilter === 'posted') return item.status === 'posted';
      return true;
    })
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <header className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-gray-900">予約カレンダー</h2>
            <p className="mt-1 text-xs text-gray-500">{monthLabel} / JST</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="rounded-lg border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
              onClick={() => onMonthChange(new Date(year, month - 1, 1))}
              type="button"
            >
              前月
            </button>
            <button
              className="rounded-lg border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
              onClick={() => onMonthChange(new Date(year, month + 1, 1))}
              type="button"
            >
              次月
            </button>
          </div>
        </header>

        <div className="mt-4 grid grid-cols-7 gap-2 text-center text-xs text-gray-400">
          {dayLabels.map((label) => (
            <div key={label} className="font-medium">
              {label}
            </div>
          ))}
        </div>

        <div className="mt-2 grid grid-cols-7 gap-2">
          {Array.from({ length: startOffset }).map((_, index) => (
            <div key={`empty-${index}`} />
          ))}
          {Array.from({ length: daysInMonth }).map((_, index) => {
            const day = index + 1;
            const dateKey = formatDateKey(year, month, day);
            const count = countsByDate[dateKey] ?? 0;
            const isSelected = selectedDate === dateKey;

            return (
              <button
                key={dateKey}
                type="button"
                onClick={() => onSelectDate(dateKey)}
                className={classNames(
                  'flex flex-col items-center gap-1 rounded-lg border px-2 py-2 text-sm transition',
                  isSelected
                    ? 'border-blue-500 bg-blue-50 text-gray-900'
                    : 'border-gray-200 bg-white text-gray-500 hover:border-blue-400',
                )}
              >
                <span className="font-semibold">{day}</span>
                <span
                  className={classNames(
                    'text-[10px] font-medium',
                    count > 0
                      ? 'rounded-full bg-blue-100 px-2 py-0.5 text-blue-600'
                      : 'text-gray-400',
                  )}
                >
                  {count > 0 ? String(count) : '0'}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <header className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">予約一覧</h3>
            <p className="mt-1 text-xs text-gray-500">{selectedDate} / JST</p>
          </div>
          <div className="flex items-center gap-1">
            {isLoading ? <span className="mr-2 text-xs text-gray-400">読み込み中...</span> : null}
            {([
              { key: 'all', label: '一覧' },
              { key: 'scheduled', label: '予約済み' },
              { key: 'posted', label: '投稿完了' },
            ] as const).map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setListFilter(key)}
                className={classNames(
                  'rounded-full px-3 py-1 text-xs font-medium transition',
                  listFilter === key
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </header>

        {selectedItems.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center text-xs text-gray-400">
            予約がありません
          </div>
        ) : (
          <div className="space-y-3">
            {selectedItems.map((item) => (
              <div
                key={item.scheduleId}
                className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white px-3 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => onSelectItem(item)}
                title="クリックで編集"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-gray-900">
                    {getTimeLabel(item.scheduledAtJst)}
                    <span
                      className={classNames(
                        'ml-2 rounded-full px-2 py-0.5 text-[11px] font-medium',
                        item.status === 'draft' && 'bg-amber-50 text-amber-700',
                        item.status === 'scheduled' && 'bg-blue-50 text-blue-700',
                        item.status === 'processing' && 'bg-purple-50 text-purple-700',
                        item.status === 'posted' && 'bg-green-50 text-green-700',
                        item.status === 'failed' && 'bg-red-50 text-red-700',
                      )}
                    >
                      {item.status === 'draft' && '下書き'}
                      {item.status === 'scheduled' && '予約済み'}
                      {item.status === 'processing' && '投稿中'}
                      {item.status === 'posted' && '投稿完了'}
                      {item.status === 'failed' && '失敗'}
                    </span>
                  </div>
                  {(item.status === 'draft' || item.status === 'scheduled' || item.status === 'failed') && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="rounded-lg border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                        onClick={(e) => { e.stopPropagation(); onSelectItem(item); }}
                      >
                        編集
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                        onClick={(e) => { e.stopPropagation(); onDeleteItem(item); }}
                      >
                        削除
                      </button>
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500 line-clamp-2">
                  {item.mainText}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 詳細モーダル */}
      {detailItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setDetailItem(null)}
        >
          <div
            className="mx-4 max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-900">投稿内容</h3>
                <p className="mt-1 text-xs text-gray-500">
                  {detailItem.scheduledAtJst.replace('T', ' ').slice(0, 16)} JST
                </p>
              </div>
              <button
                type="button"
                className="rounded-full p-2 text-gray-400 hover:bg-gray-100"
                onClick={() => setDetailItem(null)}
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="mb-2 text-xs font-semibold text-gray-500">メイン投稿</h4>
                <div className="whitespace-pre-wrap rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-900">
                  {detailItem.mainText || '（なし）'}
                </div>
              </div>
              <div>
                <h4 className="mb-2 text-xs font-semibold text-gray-500">コメント1</h4>
                <div className="whitespace-pre-wrap rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-900">
                  {detailItem.comment1 || '（なし）'}
                </div>
              </div>
              <div>
                <h4 className="mb-2 text-xs font-semibold text-gray-500">コメント2</h4>
                <div className="whitespace-pre-wrap rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-900">
                  {detailItem.comment2 || '（なし）'}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                onClick={() => setDetailItem(null)}
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
