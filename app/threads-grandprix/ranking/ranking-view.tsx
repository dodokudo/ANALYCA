'use client';

import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import type { RankingData, RankingScopeKey } from './data';

function formatNumber(value: number): string {
  return value.toLocaleString('ja-JP');
}

function formatDelta(value: number): string {
  return value > 0 ? `+${formatNumber(value)}` : formatNumber(value);
}

function rankLabel(rank: number): string {
  if (rank === 1) return '🏆';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `${rank}位`;
}

function rankClass(rank: number): string {
  if (rank === 1) return 'bg-[linear-gradient(135deg,#fff5ad,#f6b900)] text-[#6b4200]';
  if (rank === 2) return 'bg-[linear-gradient(135deg,#ffffff,#b8c4d8)] text-[#344256]';
  if (rank === 3) return 'bg-[linear-gradient(135deg,#ffd8b1,#c46b26)] text-[#5d2b08]';
  return 'bg-[#0877d9] text-white';
}

function ProfileAvatar({ src, username }: { src: string; username: string }) {
  const [failed, setFailed] = useState(false);
  const initial = (username || '?').slice(0, 1).toUpperCase();

  if (!src || failed) {
    return (
      <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[linear-gradient(135deg,#0877d9,#00c889)] text-sm font-black text-white ring-2 ring-white">
        {initial}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={`@${username}`}
      className="h-11 w-11 shrink-0 rounded-full object-cover ring-2 ring-white"
      onError={() => setFailed(true)}
    />
  );
}

export default function RankingView({ data }: { data: RankingData }) {
  const router = useRouter();
  const [activeKey, setActiveKey] = useState<RankingScopeKey>(data.initialScopeKey);
  const [selectedDate, setSelectedDate] = useState(data.selectedDate);
  const activeScope = useMemo(
    () => data.scopes.find((scope) => scope.key === activeKey) || data.scopes[0],
    [activeKey, data.scopes],
  );

  function handleDateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) return;
    router.push(`/threads-grandprix/ranking?date=${selectedDate}`);
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5] text-[#102033]">
      <main className="mx-auto min-h-screen w-full max-w-[560px] bg-white shadow-[0_0_60px_rgba(0,33,88,0.22)]">
        <section className="overflow-hidden bg-[#078be8]">
          <Image
            src="/threads-grandprix/ranking-header.png"
            alt="Threads グランプリ ランキング 参加者ランキング速報"
            width={2157}
            height={729}
            priority
            className="block h-auto w-full"
          />
        </section>

        <section className="-mt-4 rounded-t-[28px] bg-[#fff8e9] px-4 pb-8 pt-5">
          <div className="grid grid-cols-3 gap-2 rounded-2xl bg-white p-1.5 shadow-[0_12px_28px_rgba(0,63,132,0.15)]">
            {data.scopes.map((scope) => (
              <button
                key={scope.key}
                type="button"
                onClick={() => setActiveKey(scope.key)}
                className={`rounded-xl px-2 py-3 text-sm font-black transition ${
                  activeScope.key === scope.key ? 'bg-[#0877d9] text-white shadow-lg' : 'text-[#0877d9]'
                }`}
              >
                {scope.label}
              </button>
            ))}
          </div>

          {activeKey === 'custom' ? (
            <form onSubmit={handleDateSubmit} className="mt-4 flex gap-2 rounded-2xl bg-white p-3 shadow-sm">
              <input
                type="date"
                value={selectedDate}
                min="2026-07-07"
                max={new Date().toISOString().slice(0, 10)}
                onChange={(event) => setSelectedDate(event.target.value)}
                className="min-w-0 flex-1 rounded-xl border border-[#d8e1ee] px-3 py-3 text-base font-bold outline-none focus:border-[#0877d9]"
              />
              <button type="submit" className="rounded-xl bg-[#0877d9] px-4 py-3 text-sm font-black text-white">
                表示
              </button>
            </form>
          ) : null}

          <section className="mt-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black">フォロワー増加数</h3>
              <span className="rounded-full bg-[#00c889]/15 px-3 py-1 text-xs font-black text-[#009a67]">TOP5</span>
            </div>

            <div className="mt-3 space-y-2.5">
              {activeScope.followerRanking.length === 0 ? (
                <EmptyState />
              ) : (
                activeScope.followerRanking.map((row) => (
                  <div key={`${activeScope.key}-followers-${row.rank}-${row.threadsUsername}`} className="rounded-2xl border border-[#e8edf5] bg-white p-3 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-black shadow-sm ${rankClass(row.rank)}`}>
                          {rankLabel(row.rank)}
                        </div>
                        <ProfileAvatar src={row.profilePictureUrl} username={row.threadsUsername} />
                        <p className="min-w-0 truncate text-sm font-black">@{row.threadsUsername}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xl font-black text-[#00a876]">{formatDelta(row.followerDelta)}</p>
                        <p className="text-xs text-slate-500">現在 {formatNumber(row.followersCount)}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {activeScope.key === 'monthly' ? (
            <section className="mt-7">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-black">合計imp</h3>
                <span className="rounded-full bg-[#0877d9]/15 px-3 py-1 text-xs font-black text-[#0877d9]">TOP5</span>
              </div>

              <div className="mt-3 space-y-2.5">
                {activeScope.impressionRanking.length === 0 ? (
                  <EmptyState />
                ) : (
                  activeScope.impressionRanking.map((row) => (
                    <div key={`${activeScope.key}-impressions-${row.rank}-${row.threadsUsername}`} className="rounded-2xl border border-[#e8edf5] bg-white p-3 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-black shadow-sm ${rankClass(row.rank)}`}>
                            {rankLabel(row.rank)}
                          </div>
                          <ProfileAvatar src={row.profilePictureUrl} username={row.threadsUsername} />
                          <p className="min-w-0 truncate text-sm font-black">@{row.threadsUsername}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-xl font-black text-[#0877d9]">{formatNumber(row.totalViews)}</p>
                          <p className="text-xs text-slate-500">imp</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          ) : null}

          <section className="mt-7">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black">伸びた投稿</h3>
              <span className="rounded-full bg-[#ff2f7d]/15 px-3 py-1 text-xs font-black text-[#d71862]">imp TOP10</span>
            </div>

            <div className="mt-3 space-y-2.5">
              {activeScope.postRanking.length === 0 ? (
                <EmptyState />
              ) : (
                activeScope.postRanking.map((row) => (
                  <a
                    key={`${activeScope.key}-posts-${row.rank}-${row.permalink}`}
                    href={row.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-2xl border border-[#e8edf5] bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-black shadow-sm ${rankClass(row.rank)}`}>
                        {rankLabel(row.rank)}
                      </div>
                      <ProfileAvatar src={row.profilePictureUrl} username={row.threadsUsername} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="min-w-0 truncate text-sm font-black">@{row.threadsUsername}</p>
                          <p className="shrink-0 text-base font-black text-[#d71862]">{formatNumber(row.views)}imp</p>
                        </div>
                        <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-slate-700">{row.text}</p>
                      </div>
                    </div>
                  </a>
                ))
              )}
            </div>
          </section>
        </section>
      </main>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-[#ccd6e3] bg-white/70 p-5 text-center text-sm font-bold text-slate-400">
      まだ表示できるデータがありません
    </div>
  );
}
