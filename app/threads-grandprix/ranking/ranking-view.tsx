'use client';

import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { PostRankingRow, RankChange, RankingData, RankingScopeKey } from './data';

type PostSortKey = 'views' | 'likes';
type TabKey = RankingScopeKey | 'me';

function formatNumber(value: number): string {
  return value.toLocaleString('ja-JP');
}

function formatDelta(value: number): string {
  return value > 0 ? `+${formatNumber(value)}` : formatNumber(value);
}

function formatMd(dateStr: string): string {
  const [, month, day] = dateStr.split('-');
  return `${Number(month)}/${Number(day)}`;
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

function useCountUp(target: number, duration = 900): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
}

function CountUp({ value, prefix = '', suffix = '' }: { value: number; prefix?: string; suffix?: string }) {
  const animated = useCountUp(value);
  return (
    <span>
      {prefix}
      {formatNumber(animated)}
      {suffix}
    </span>
  );
}

function RankChangeBadge({ change }: { change: RankChange }) {
  if (change === null) return null;
  if (change === 'new') {
    return <span className="rounded-md bg-[#ff2f7d]/15 px-1.5 py-0.5 text-[10px] font-black text-[#d71862]">NEW</span>;
  }
  if (change > 0) {
    return <span className="text-xs font-black text-[#00a876]">▲{change}</span>;
  }
  if (change < 0) {
    return <span className="text-xs font-black text-[#e0503a]">▼{Math.abs(change)}</span>;
  }
  return <span className="text-xs font-black text-slate-400">→</span>;
}

function ProfileAvatar({ src, username, size = 'md' }: { src: string; username: string; size?: 'md' | 'lg' | 'xl' }) {
  const [failed, setFailed] = useState(false);
  const initial = (username || '?').slice(0, 1).toUpperCase();
  const sizeClass = size === 'xl' ? 'h-16 w-16 text-lg' : size === 'lg' ? 'h-14 w-14 text-base' : 'h-11 w-11 text-sm';

  if (!src || failed) {
    return (
      <div
        className={`flex ${sizeClass} shrink-0 items-center justify-center overflow-hidden rounded-full bg-[linear-gradient(135deg,#0877d9,#00c889)] font-black text-white ring-2 ring-white`}
      >
        {initial}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={`@${username}`}
      className={`${sizeClass} shrink-0 rounded-full object-cover ring-2 ring-white`}
      onError={() => setFailed(true)}
    />
  );
}

function PodiumSpot({
  rank,
  username,
  profilePictureUrl,
  value,
  rankChange,
  highlighted,
}: {
  rank: number;
  username: string;
  profilePictureUrl: string;
  value: number;
  rankChange: RankChange;
  highlighted: boolean;
}) {
  const isFirst = rank === 1;
  const barHeight = rank === 1 ? 'h-20' : rank === 2 ? 'h-14' : 'h-10';
  const barClass =
    rank === 1
      ? 'bg-[linear-gradient(180deg,#ffe58a,#f6b900)]'
      : rank === 2
        ? 'bg-[linear-gradient(180deg,#f2f6fc,#b8c4d8)]'
        : 'bg-[linear-gradient(180deg,#ffd8b1,#c46b26)]';

  return (
    <div className={`flex min-w-0 flex-1 flex-col items-center justify-end gap-1.5 ${highlighted ? 'rounded-2xl bg-[#0877d9]/10 pt-2' : ''}`}>
      <div className="flex items-center gap-1">
        <span className={isFirst ? 'text-2xl' : 'text-xl'}>{rankLabel(rank)}</span>
        <RankChangeBadge change={rankChange} />
      </div>
      <ProfileAvatar src={profilePictureUrl} username={username} size={isFirst ? 'xl' : 'lg'} />
      <p className="w-full truncate px-1 text-center text-xs font-black">@{username}</p>
      <p className={`font-black text-[#00a876] ${isFirst ? 'text-xl' : 'text-base'}`}>
        <CountUp value={value} prefix={value > 0 ? '+' : ''} />
      </p>
      <div className={`w-full rounded-t-xl ${barHeight} ${barClass} flex items-start justify-center pt-1.5`}>
        <span className="text-sm font-black opacity-70">{rank}</span>
      </div>
    </div>
  );
}

export default function RankingView({ data }: { data: RankingData }) {
  const router = useRouter();
  const [activeKey, setActiveKey] = useState<TabKey>(data.meUsername ? 'me' : data.initialScopeKey);
  const [selectedDate, setSelectedDate] = useState(data.selectedDate);
  const [postSort, setPostSort] = useState<PostSortKey>('views');

  const activeScope = useMemo(
    () => data.scopes.find((scope) => scope.key === activeKey) || data.scopes[0],
    [activeKey, data.scopes],
  );

  const meUsername = data.meUsername;
  const personal = activeScope.personal;

  const sortedPosts = useMemo<PostRankingRow[]>(() => {
    const posts = [...activeScope.postRanking];
    posts.sort((a, b) => (postSort === 'likes' ? b.likes - a.likes || b.views - a.views : b.views - a.views || b.likes - a.likes));
    return posts.slice(0, 10).map((post, index) => ({ ...post, rank: index + 1 }));
  }, [activeScope.postRanking, postSort]);

  function buildQuery(overrides: { date?: string; me?: string }): string {
    const params = new URLSearchParams();
    if (data.event.eventId) params.set('event', data.event.eventId);
    const date = overrides.date !== undefined ? overrides.date : activeKey === 'custom' ? data.selectedDate : '';
    if (date) params.set('date', date);
    const me = overrides.me !== undefined ? overrides.me : meUsername;
    if (me) params.set('me', me);
    const query = params.toString();
    return query ? `?${query}` : '';
  }

  function handleDateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) return;
    router.push(`/threads-grandprix/ranking${buildQuery({ date: selectedDate })}`);
  }

  function handleMeSelect(username: string) {
    const normalized = username.trim().replace(/^@/, '').toLowerCase();
    router.push(`/threads-grandprix/ranking${buildQuery({ me: normalized })}`);
  }

  const shareText = personal
    ? `${data.event.name}、現在フォロワー増加${personal.followerRank ? `${personal.followerRank}位` : '参戦中'}（${activeScope.dateLabel}）🔥 #Threadsグランプリ`
    : `${data.event.name} 開催中🔥 #Threadsグランプリ`;
  const shareUrl = `https://www.threads.net/intent/post?text=${encodeURIComponent(`${shareText}\nhttps://analyca.jp/threads-grandprix/ranking`)}`;

  const isMe = (username: string) => !!meUsername && username.toLowerCase().replace(/^@/, '') === meUsername;

  return (
    <div className="min-h-screen bg-[#f5f5f5] text-[#102033]">
      <main className="mx-auto min-h-screen w-full max-w-[560px] bg-white shadow-[0_0_60px_rgba(0,33,88,0.22)]">
        <section className="bg-[linear-gradient(135deg,#078be8,#3fb1ff)] px-5 pb-9 pt-7 text-white">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <h1 className="whitespace-nowrap text-xl font-black leading-tight">{data.event.name}</h1>
              <p className="mt-1 text-xs font-bold text-white/80">参加者ランキング速報</p>
            </div>
            <div className="shrink-0 text-right">
              {data.event.isFinished ? (
                <p className="rounded-full bg-[#f6b900] px-3 py-1.5 text-xs font-black text-[#6b4200]">結果発表</p>
              ) : (
                <>
                  <p className="text-[10px] font-black tracking-widest text-white/70">残り</p>
                  <p className="text-4xl font-black leading-none text-[#ffe58a]">
                    {data.event.daysRemaining}
                    <span className="ml-0.5 text-base">日</span>
                  </p>
                </>
              )}
            </div>
          </div>
          {!data.event.isFinished ? (
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#00c889,#ffe58a)] transition-all"
                style={{ width: `${Math.round((data.event.elapsedDays / data.event.totalDays) * 100)}%` }}
              />
            </div>
          ) : null}
          {data.events.length > 1 ? (
            <select
              value={data.event.eventId}
              onChange={(event) => router.push(`/threads-grandprix/ranking?event=${encodeURIComponent(event.target.value)}`)}
              className="mt-4 w-full rounded-xl border border-white/30 bg-white/10 px-3 py-2 text-sm font-bold text-white outline-none"
            >
              {data.events.map((event) => (
                <option key={event.eventId} value={event.eventId} className="text-[#102033]">
                  {event.name}
                </option>
              ))}
            </select>
          ) : null}
        </section>

        <section className="-mt-4 rounded-t-[28px] bg-[#fff8e9] px-4 pb-8 pt-5">
          <div className="grid grid-cols-4 gap-1.5 rounded-2xl bg-white p-1.5 shadow-[0_12px_28px_rgba(0,63,132,0.15)]">
            {[...data.scopes.map((scope) => ({ key: scope.key as TabKey, label: scope.label })), { key: 'me' as TabKey, label: '自分の順位' }].map(
              (tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveKey(tab.key)}
                  className={`rounded-xl px-1 py-3 text-xs font-black transition ${
                    activeKey === tab.key ? 'bg-[#0877d9] text-white shadow-lg' : 'text-[#0877d9]'
                  }`}
                >
                  {tab.label}
                </button>
              ),
            )}
          </div>

          {activeKey === 'custom' ? (
            <form onSubmit={handleDateSubmit} className="mt-4 flex gap-2 rounded-2xl bg-white p-3 shadow-sm">
              <input
                type="date"
                value={selectedDate}
                min={data.event.startDate}
                max={data.event.endDate}
                onChange={(event) => setSelectedDate(event.target.value)}
                className="min-w-0 flex-1 rounded-xl border border-[#d8e1ee] px-3 py-3 text-base font-bold outline-none focus:border-[#0877d9]"
              />
              <button type="submit" className="rounded-xl bg-[#0877d9] px-4 py-3 text-sm font-black text-white">
                表示
              </button>
            </form>
          ) : null}

          {activeKey === 'me' ? (
            <section className="mt-4">
              <div className="rounded-2xl border border-[#e8edf5] bg-white p-3 shadow-sm">
                <p className="text-xs font-black text-slate-500">自分のアカウントを選ぶ</p>
                <select
                  value={meUsername}
                  onChange={(event) => handleMeSelect(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-[#d8e1ee] bg-white px-3 py-3 text-base font-bold outline-none focus:border-[#0877d9]"
                >
                  <option value="">-- 参加者から選択 --</option>
                  {data.participants.map((username) => (
                    <option key={username} value={username.toLowerCase().replace(/^@/, '')}>
                      @{username}
                    </option>
                  ))}
                </select>
              </div>

              {meUsername && !data.scopes.some((scope) => scope.personal) ? (
                <p className="mt-3 rounded-xl bg-[#fff2f2] px-3 py-2.5 text-xs font-bold text-[#c2402e]">
                  @{meUsername} のデータが見つかりません。
                </p>
              ) : null}

              {data.scopes
                .filter((scope) => scope.key !== 'custom' && scope.personal)
                .map((scope) => {
                  const stats = scope.personal!;
                  return (
                    <div key={`me-${scope.key}`} className="mt-3 rounded-2xl bg-[linear-gradient(120deg,#f2f9ff,#effcf6)] p-3 shadow-sm">
                      <div className="flex items-center gap-3">
                        <ProfileAvatar src={stats.profilePictureUrl} username={stats.threadsUsername} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-black">@{stats.threadsUsername}</p>
                          <p className="text-[11px] font-bold text-slate-500">
                            {scope.label}（{scope.dateLabel}）・{stats.participantCount}名中
                          </p>
                        </div>
                      </div>
                      <div className="mt-2.5 grid grid-cols-2 gap-2">
                        <div className="rounded-xl bg-white p-2.5 text-center">
                          <p className="text-[10px] font-black text-slate-500">フォロワー増加</p>
                          <p className="text-lg font-black text-[#00a876]">
                            {stats.followerRank ? `${stats.followerRank}位` : '—'}
                            <span className="ml-1 text-xs">({formatDelta(stats.followerDelta)})</span>
                          </p>
                          {stats.followerRank && stats.followerRank > 1 && stats.followerGapToAbove !== null ? (
                            <p className="text-[10px] font-bold text-slate-500">
                              {stats.followerRank - 1}位まであと{formatNumber(stats.followerGapToAbove + 1)}人
                            </p>
                          ) : stats.followerRank === 1 ? (
                            <p className="text-[10px] font-bold text-[#c99400]">現在トップ🏆</p>
                          ) : null}
                        </div>
                        <div className="rounded-xl bg-white p-2.5 text-center">
                          <p className="text-[10px] font-black text-slate-500">imp</p>
                          <p className="text-lg font-black text-[#0877d9]">
                            {stats.impressionRank ? `${stats.impressionRank}位` : '—'}
                          </p>
                          <p className="text-[10px] font-bold text-slate-500">{formatNumber(stats.impressionViews)}imp</p>
                        </div>
                        <div className="col-span-2 rounded-xl bg-white p-2.5 text-center">
                          <p className="text-[10px] font-black text-slate-500">投稿数</p>
                          <p className="text-lg font-black text-[#7c3aed]">
                            {stats.postCountRank ? `${stats.postCountRank}位` : '—'}
                            <span className="ml-1 text-xs">({formatNumber(stats.postCount)}本)</span>
                          </p>
                          {scope.key === 'monthly' ? (
                            <p className="text-[10px] font-bold text-slate-500">1日平均 {stats.avgPostsPerDay}本</p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </section>
          ) : null}

          <section className={`mt-6 ${activeKey === 'me' ? 'hidden' : ''}`}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black">フォロワー増加数</h3>
              <span className="rounded-full bg-[#00c889]/15 px-3 py-1 text-xs font-black text-[#009a67]">
                {activeScope.dateLabel}
              </span>
            </div>

            {activeScope.followerRanking.length === 0 ? (
              <div className="mt-3">
                <EmptyState />
              </div>
            ) : (
              <>
                <div className="mt-4 flex items-end gap-2 rounded-2xl border border-[#f0e6cc] bg-[linear-gradient(180deg,#fffdf5,#fff4d6)] px-3 pt-4">
                  {[activeScope.followerRanking[1], activeScope.followerRanking[0], activeScope.followerRanking[2]]
                    .filter(Boolean)
                    .map((row) => (
                      <PodiumSpot
                        key={`podium-${activeScope.key}-${row.threadsUsername}`}
                        rank={row.rank}
                        username={row.threadsUsername}
                        profilePictureUrl={row.profilePictureUrl}
                        value={row.followerDelta}
                        rankChange={row.rankChange}
                        highlighted={isMe(row.threadsUsername)}
                      />
                    ))}
                </div>

                <div className="mt-3 space-y-2.5">
                  {activeScope.followerRanking.slice(3).map((row) => (
                    <div
                      key={`${activeScope.key}-followers-${row.rank}-${row.threadsUsername}`}
                      className={`rounded-2xl border bg-white p-3 shadow-sm ${
                        isMe(row.threadsUsername) ? 'border-[#0877d9] ring-2 ring-[#0877d9]/25' : 'border-[#e8edf5]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div
                            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-black shadow-sm ${rankClass(row.rank)}`}
                          >
                            {rankLabel(row.rank)}
                          </div>
                          <ProfileAvatar src={row.profilePictureUrl} username={row.threadsUsername} />
                          <div className="min-w-0">
                            <p className="min-w-0 truncate text-sm font-black">@{row.threadsUsername}</p>
                            <RankChangeBadge change={row.rankChange} />
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-xl font-black text-[#00a876]">
                            <CountUp value={row.followerDelta} prefix={row.followerDelta > 0 ? '+' : ''} />
                          </p>
                          <p className="text-xs text-slate-500">現在 {formatNumber(row.followersCount)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>

          <section className={`mt-7 ${activeKey === 'me' || activeScope.key === 'yesterday' ? 'hidden' : ''}`}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black">合計imp</h3>
              <span className="rounded-full bg-[#0877d9]/15 px-3 py-1 text-xs font-black text-[#0877d9]">
                {activeScope.impLabel}
              </span>
            </div>

            <div className="mt-3 space-y-2.5">
              {activeScope.impressionRanking.length === 0 ? (
                <EmptyState />
              ) : (
                activeScope.impressionRanking.map((row) => (
                  <div
                    key={`${activeScope.key}-impressions-${row.rank}-${row.threadsUsername}`}
                    className={`rounded-2xl border bg-white p-3 shadow-sm ${
                      isMe(row.threadsUsername) ? 'border-[#0877d9] ring-2 ring-[#0877d9]/25' : 'border-[#e8edf5]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-black shadow-sm ${rankClass(row.rank)}`}
                        >
                          {rankLabel(row.rank)}
                        </div>
                        <ProfileAvatar src={row.profilePictureUrl} username={row.threadsUsername} />
                        <div className="min-w-0">
                          <p className="min-w-0 truncate text-sm font-black">@{row.threadsUsername}</p>
                          <RankChangeBadge change={row.rankChange} />
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xl font-black text-[#0877d9]">
                          <CountUp value={row.totalViews} />
                        </p>
                        <p className="text-xs text-slate-500">imp</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className={`mt-7 ${activeKey === 'me' ? 'hidden' : ''}`}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black">{activeScope.postLabel}</h3>
              <div className="flex rounded-full bg-white p-0.5 shadow-sm">
                {(
                  [
                    { key: 'views', label: 'imp順' },
                    { key: 'likes', label: 'いいね順' },
                  ] as Array<{ key: PostSortKey; label: string }>
                ).map((sort) => (
                  <button
                    key={sort.key}
                    type="button"
                    onClick={() => setPostSort(sort.key)}
                    className={`rounded-full px-3 py-1 text-xs font-black transition ${
                      postSort === sort.key ? 'bg-[#ff2f7d]/15 text-[#d71862]' : 'text-slate-400'
                    }`}
                  >
                    {sort.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-3 space-y-2.5">
              {sortedPosts.length === 0 ? (
                <EmptyState />
              ) : (
                sortedPosts.map((row) => (
                  <a
                    key={`${activeScope.key}-posts-${row.rank}-${row.permalink}`}
                    href={row.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`block rounded-2xl border bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                      isMe(row.threadsUsername) ? 'border-[#0877d9] ring-2 ring-[#0877d9]/25' : 'border-[#e8edf5]'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-black shadow-sm ${rankClass(row.rank)}`}
                      >
                        {rankLabel(row.rank)}
                      </div>
                      <ProfileAvatar src={row.profilePictureUrl} username={row.threadsUsername} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="min-w-0 truncate text-sm font-black">@{row.threadsUsername}</p>
                          <p className="shrink-0 text-base font-black text-[#d71862]">
                            {postSort === 'likes' ? `♥${formatNumber(row.likes)}` : `${formatNumber(row.views)}imp`}
                          </p>
                        </div>
                        <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-slate-700">{row.text}</p>
                        <p className="mt-1 text-[11px] font-bold text-slate-400">
                          {formatNumber(row.views)}imp・♥{formatNumber(row.likes)}・💬{formatNumber(row.replies)}
                        </p>
                      </div>
                    </div>
                  </a>
                ))
              )}
            </div>
          </section>

          <section className={`mt-7 ${activeKey === 'me' || activeScope.postCountRanking.length === 0 ? 'hidden' : ''}`}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black">投稿数</h3>
              <span className="rounded-full bg-[#7c3aed]/15 px-3 py-1 text-xs font-black text-[#7c3aed]">
                {activeScope.dateLabel}
              </span>
            </div>

            <div className="mt-3 space-y-2.5">
              {activeScope.postCountRanking.map((row) => (
                <div
                  key={`${activeScope.key}-postcount-${row.rank}-${row.threadsUsername}`}
                  className={`rounded-2xl border bg-white p-3 shadow-sm ${
                    isMe(row.threadsUsername) ? 'border-[#0877d9] ring-2 ring-[#0877d9]/25' : 'border-[#e8edf5]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-black shadow-sm ${rankClass(row.rank)}`}
                      >
                        {rankLabel(row.rank)}
                      </div>
                      <ProfileAvatar src={row.profilePictureUrl} username={row.threadsUsername} />
                      <div className="min-w-0">
                        <p className="min-w-0 truncate text-sm font-black">@{row.threadsUsername}</p>
                        {activeScope.key === 'monthly' ? (
                          <p className="text-[11px] font-bold text-slate-500">1日平均 {row.avgPerDay}本</p>
                        ) : null}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xl font-black text-[#7c3aed]">
                        <CountUp value={row.postCount} />
                      </p>
                      <p className="text-xs text-slate-500">投稿</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="mt-7 rounded-2xl bg-[#102033] p-4 text-center">
            <p className="text-sm font-black text-white">今の順位をThreadsでシェアして盛り上げよう</p>
            <a
              href={shareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2.5 inline-block rounded-xl bg-[linear-gradient(90deg,#00c889,#0877d9)] px-6 py-3 text-sm font-black text-white"
            >
              Threadsに投稿する
            </a>
          </div>
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
