'use client';

import { useMemo, useState } from 'react';
import type { RankingData, RankingScopeKey } from './data';

function formatNumber(value: number): string {
  return value.toLocaleString('ja-JP');
}

function formatDelta(value: number): string {
  return value > 0 ? `+${formatNumber(value)}` : formatNumber(value);
}

function rankLabel(rank: number): string {
  if (rank === 1) return '1位';
  if (rank === 2) return '2位';
  if (rank === 3) return '3位';
  return `${rank}位`;
}

export default function RankingView({ data }: { data: RankingData }) {
  const [activeKey, setActiveKey] = useState<RankingScopeKey>('today');
  const activeScope = useMemo(
    () => data.scopes.find((scope) => scope.key === activeKey) || data.scopes[0],
    [activeKey, data.scopes],
  );

  return (
    <div className="min-h-screen bg-[#f5f5f5] text-[#102033]">
      <main className="mx-auto min-h-screen w-full max-w-[560px] bg-white shadow-[0_0_60px_rgba(0,33,88,0.22)]">
        <section className="relative overflow-hidden bg-[linear-gradient(180deg,#03a9f4_0%,#0877d9_48%,#fff6df_100%)] px-5 pb-8 pt-7 text-white">
          <div className="absolute -right-10 top-4 h-32 w-32 rounded-full bg-yellow-300/35 blur-2xl" />
          <div className="absolute -left-10 bottom-2 h-28 w-28 rounded-full bg-pink-300/35 blur-2xl" />

          <div className="relative">
            <p className="inline-flex rounded-full bg-white/20 px-3 py-1 text-xs font-bold backdrop-blur">
              7月のお祭り企画
            </p>
            <h1 className="mt-4 text-4xl font-black leading-tight">
              Threads
              <br />
              グランプリ夏
            </h1>
            <p className="mt-3 text-sm font-semibold text-white/90">
              参加者ランキング速報
            </p>
          </div>
        </section>

        <section className="-mt-4 rounded-t-[28px] bg-[#fff8e9] px-4 pb-8 pt-5">
          <div className="grid grid-cols-3 gap-2 rounded-2xl bg-white p-1.5 shadow-[0_12px_28px_rgba(0,63,132,0.15)]">
            {data.scopes.map((scope) => (
              <button
                key={scope.key}
                type="button"
                onClick={() => setActiveKey(scope.key)}
                className={`rounded-xl px-3 py-3 text-sm font-black transition ${
                  activeScope.key === scope.key
                    ? 'bg-[#0877d9] text-white shadow-lg'
                    : 'text-[#0877d9]'
                }`}
              >
                {scope.label}
              </button>
            ))}
          </div>

          <div className="mt-5 rounded-2xl border border-white bg-white/90 px-4 py-4 shadow-[0_12px_28px_rgba(0,63,132,0.12)]">
            <p className="text-xs font-bold text-[#0877d9]">{activeScope.dateLabel}</p>
            <h2 className="mt-1 text-xl font-black">現在のTOP5</h2>
            <p className="mt-1 text-xs text-slate-500">
              データ取得状況により、表示は更新タイミングで変動します。
            </p>
          </div>

          <section className="mt-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black">フォロワー増加数</h3>
              <span className="rounded-full bg-[#00c889]/15 px-3 py-1 text-xs font-black text-[#009a67]">
                TOP5
              </span>
            </div>

            <div className="mt-3 space-y-3">
              {activeScope.followerRanking.length === 0 ? (
                <EmptyState />
              ) : (
                activeScope.followerRanking.map((row) => (
                  <div
                    key={`${activeScope.key}-followers-${row.rank}-${row.threadsUsername}`}
                    className="rounded-2xl border border-[#e8edf5] bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#0877d9] text-sm font-black text-white">
                          {rankLabel(row.rank)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black">@{row.threadsUsername}</p>
                          <p className="truncate text-xs text-slate-500">{row.lineName}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-black text-[#00a876]">
                          {formatDelta(row.followerDelta)}
                        </p>
                        <p className="text-xs text-slate-500">現在 {formatNumber(row.followersCount)}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="mt-7">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black">伸びた投稿</h3>
              <span className="rounded-full bg-[#ff2f7d]/15 px-3 py-1 text-xs font-black text-[#d71862]">
                表示数TOP5
              </span>
            </div>

            <div className="mt-3 space-y-3">
              {activeScope.postRanking.length === 0 ? (
                <EmptyState />
              ) : (
                activeScope.postRanking.map((row) => (
                  <a
                    key={`${activeScope.key}-posts-${row.rank}-${row.permalink}`}
                    href={row.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-2xl border border-[#e8edf5] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-[#ffcc33] px-2.5 py-1 text-xs font-black text-[#7a4b00]">
                            {rankLabel(row.rank)}
                          </span>
                          <p className="truncate text-sm font-black">@{row.threadsUsername}</p>
                        </div>
                        <p className="mt-2 text-sm leading-relaxed text-slate-700">{row.text}</p>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs font-bold">
                      <div className="rounded-xl bg-[#eef7ff] px-2 py-2 text-[#0877d9]">
                        {formatNumber(row.views)}
                        <br />
                        表示
                      </div>
                      <div className="rounded-xl bg-[#fff3f7] px-2 py-2 text-[#d71862]">
                        {formatNumber(row.likes)}
                        <br />
                        いいね
                      </div>
                      <div className="rounded-xl bg-[#f2fff8] px-2 py-2 text-[#009a67]">
                        {formatNumber(row.replies)}
                        <br />
                        返信
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
