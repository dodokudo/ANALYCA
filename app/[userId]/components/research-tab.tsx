'use client';

import { FormEvent, useState } from 'react';

/**
 * Content research: two searches, nothing else.
 *
 * Each panel maps one-to-one onto one requested permission, and results are shown
 * straight from the API without any stored state in between. That keeps the screen
 * legible in an App Review screencast, where the reviewer has no audio and about a
 * minute of attention.
 */

interface SearchPost {
  id: string;
  username?: string;
  text?: string;
  timestamp: string;
  permalink?: string;
}

interface SearchResult {
  keyword: string;
  posts: SearchPost[];
  authors: { username: string; postCount: number }[];
}

interface Profile {
  username: string;
  name?: string;
  biography?: string;
  profile_picture_url?: string;
  is_verified?: boolean;
  follower_count?: number;
  likes_count?: number;
  replies_count?: number;
  reposts_count?: number;
  quotes_count?: number;
  views_count?: number;
}

interface SelfReply {
  text: string;
  depth: number;
  permalink: string;
  secondsAfterRoot: number | null;
}

interface ProfilePost {
  id: string;
  text: string;
  timestamp: string;
  permalink: string;
  mediaType: string;
  textLength: number;
  hasReplies: boolean;
}

interface ProfileResult {
  profile: Profile;
  posts: ProfilePost[];
}

const numberFormat = new Intl.NumberFormat('ja-JP');

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('ja-JP', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatGap(seconds: number | null): string {
  if (seconds === null) return '';
  if (seconds < 60) return `本体の${seconds}秒後`;
  if (seconds < 3600) return `本体の${Math.round(seconds / 60)}分後`;
  return `本体の${Math.round(seconds / 3600)}時間後`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-sm)] border border-[color:var(--color-border)] px-3 py-2">
      <div className="text-xs text-[color:var(--color-text-secondary)]">{label}</div>
      <div className="mt-0.5 text-base font-bold tabular-nums text-[color:var(--color-text-primary)]">
        {value}
      </div>
    </div>
  );
}

export default function ResearchTab({ userId }: { userId: string }) {
  const [keyword, setKeyword] = useState('');
  const [searchMode, setSearchMode] = useState<'KEYWORD' | 'TAG'>('KEYWORD');
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [username, setUsername] = useState('');
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [profileResult, setProfileResult] = useState<ProfileResult | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [openPostId, setOpenPostId] = useState<string | null>(null);
  const [replies, setReplies] = useState<Record<string, SelfReply[]>>({});
  const [loadingReplyId, setLoadingReplyId] = useState<string | null>(null);

  const runSearch = async (event: FormEvent) => {
    event.preventDefault();
    if (!keyword.trim()) return;
    setSearching(true);
    setSearchError(null);

    try {
      const params = new URLSearchParams({ userId, q: keyword, mode: searchMode });
      const res = await fetch(`/api/research/search?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '検索に失敗しました');
      setSearchResult(json);
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : String(e));
      setSearchResult(null);
    } finally {
      setSearching(false);
    }
  };

  const lookupProfile = async (target: string) => {
    if (!target.trim()) return;
    setUsername(target);
    setLoadingProfile(true);
    setProfileError(null);
    setOpenPostId(null);
    setReplies({});

    try {
      const params = new URLSearchParams({ userId, username: target });
      const res = await fetch(`/api/research/profile?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '取得に失敗しました');
      setProfileResult(json);
    } catch (e) {
      setProfileError(e instanceof Error ? e.message : String(e));
      setProfileResult(null);
    } finally {
      setLoadingProfile(false);
    }
  };

  const toggleReplies = async (post: ProfilePost) => {
    if (openPostId === post.id) {
      setOpenPostId(null);
      return;
    }
    setOpenPostId(post.id);
    if (replies[post.id]) return;

    setLoadingReplyId(post.id);
    try {
      const params = new URLSearchParams({
        userId,
        postId: post.id,
        username: profileResult?.profile.username ?? username,
        postedAt: post.timestamp,
      });
      const res = await fetch(`/api/research/thread?${params.toString()}`);
      const json = await res.json();
      if (res.ok) setReplies((prev) => ({ ...prev, [post.id]: json.replies ?? [] }));
    } catch {
      /* keep the row open but empty rather than breaking the list */
    } finally {
      setLoadingReplyId(null);
    }
  };

  const profile = profileResult?.profile;
  const posts = profileResult?.posts ?? [];
  const replyPostCount = posts.filter((p) => p.hasReplies).length;
  const avgLength = posts.length
    ? Math.round(posts.reduce((sum, p) => sum + p.textLength, 0) / posts.length)
    : 0;

  return (
    <div className="space-y-6">
      {/* キーワード検索 = threads_keyword_search */}
      <section className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-white p-5">
        <div className="flex flex-wrap items-baseline gap-2">
          <h3 className="text-base font-bold text-[color:var(--color-text-primary)]">
            キーワードで投稿を検索する
          </h3>
          <code className="rounded bg-[color:var(--color-surface-muted)] px-1.5 py-0.5 text-xs text-[color:var(--color-text-secondary)]">
            threads_keyword_search
          </code>
        </div>
        <p className="mt-1 text-xs text-[color:var(--color-text-secondary)]">
          キーワードまたはトピックタグで、Threadsの公開投稿を検索します。
        </p>

        <form onSubmit={runSearch} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1">
            <span className="mb-1 block text-xs font-medium text-[color:var(--color-text-secondary)]">
              キーワード
            </span>
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Threads運用"
              className="h-11 w-full rounded-[var(--radius-sm)] border border-[color:var(--color-border)] px-3 text-sm"
            />
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium text-[color:var(--color-text-secondary)]">
              検索モード
            </span>
            <select
              value={searchMode}
              onChange={(e) => setSearchMode(e.target.value as 'KEYWORD' | 'TAG')}
              className="h-11 rounded-[var(--radius-sm)] border border-[color:var(--color-border)] px-3 text-sm"
            >
              <option value="KEYWORD">キーワード</option>
              <option value="TAG">トピックタグ</option>
            </select>
          </label>
          <button
            type="submit"
            disabled={searching}
            className="h-11 rounded-[var(--radius-sm)] bg-[color:var(--color-text-primary)] px-6 text-sm font-medium text-white disabled:opacity-50"
          >
            {searching ? '検索中…' : '検索'}
          </button>
        </form>

        {searchError && (
          <p className="mt-3 rounded-[var(--radius-sm)] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {searchError}
          </p>
        )}

        {searchResult && (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-[color:var(--color-text-primary)]">
              「{searchResult.keyword}」の検索結果：投稿 {searchResult.posts.length}件 /
              アカウント {searchResult.authors.length}件
            </p>

            {searchResult.authors.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-[color:var(--color-text-secondary)]">
                  投稿していたアカウント：
                </span>
                {searchResult.authors.map((a) => (
                  <button
                    key={a.username}
                    onClick={() => lookupProfile(a.username)}
                    className="rounded-full border border-[color:var(--color-border)] px-3 py-1 text-xs hover:bg-[color:var(--color-surface-muted)]"
                  >
                    @{a.username}（{a.postCount}件）を調べる →
                  </button>
                ))}
              </div>
            )}

            <div className="max-h-80 divide-y divide-[color:var(--color-border)] overflow-y-auto rounded-[var(--radius-sm)] border border-[color:var(--color-border)]">
              {searchResult.posts.map((p) => (
                <div key={p.id} className="px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[color:var(--color-text-secondary)]">
                    <span className="font-medium text-[color:var(--color-text-primary)]">
                      @{p.username}
                    </span>
                    <span>{formatDateTime(p.timestamp)}</span>
                    {p.permalink && (
                      <a
                        href={p.permalink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-purple-600 hover:underline"
                      >
                        Threadsで開く
                      </a>
                    )}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-[color:var(--color-text-primary)]">
                    {p.text || '（本文なし）'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* アカウント検索 = threads_profile_discovery */}
      <section className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-white p-5">
        <div className="flex flex-wrap items-baseline gap-2">
          <h3 className="text-base font-bold text-[color:var(--color-text-primary)]">
            アカウントのプロフィールと公開投稿を見る
          </h3>
          <code className="rounded bg-[color:var(--color-surface-muted)] px-1.5 py-0.5 text-xs text-[color:var(--color-text-secondary)]">
            threads_profile_discovery
          </code>
        </div>
        <p className="mt-1 text-xs text-[color:var(--color-text-secondary)]">
          usernameを指定して、公開プロフィール（フォロワー数など）と公開投稿を取得します。
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            lookupProfile(username);
          }}
          className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <label className="flex-1">
            <span className="mb-1 block text-xs font-medium text-[color:var(--color-text-secondary)]">
              username
            </span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="meta"
              className="h-11 w-full rounded-[var(--radius-sm)] border border-[color:var(--color-border)] px-3 text-sm"
            />
          </label>
          <button
            type="submit"
            disabled={loadingProfile}
            className="h-11 rounded-[var(--radius-sm)] bg-[color:var(--color-text-primary)] px-6 text-sm font-medium text-white disabled:opacity-50"
          >
            {loadingProfile ? '取得中…' : '取得'}
          </button>
        </form>

        {profileError && (
          <p className="mt-3 rounded-[var(--radius-sm)] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {profileError}
          </p>
        )}

        {profile && (
          <div className="mt-5 space-y-4">
            <div className="flex items-start gap-3">
              {profile.profile_picture_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.profile_picture_url}
                  alt=""
                  className="h-14 w-14 rounded-full object-cover"
                />
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[color:var(--color-text-primary)]">
                    {profile.name || profile.username}
                  </span>
                  {profile.is_verified && <span className="text-xs text-blue-500">✓ 認証済み</span>}
                </div>
                <div className="text-sm text-[color:var(--color-text-secondary)]">
                  @{profile.username}
                </div>
                {profile.biography && (
                  <p className="mt-1 text-sm text-[color:var(--color-text-primary)]">
                    {profile.biography}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat
                label="フォロワー"
                value={
                  profile.follower_count === undefined
                    ? '—'
                    : numberFormat.format(profile.follower_count)
                }
              />
              <Stat label="取得した投稿" value={`${posts.length}件`} />
              <Stat label="返信がある投稿" value={`${replyPostCount}件`} />
              <Stat label="本文の平均文字数" value={`${avgLength}字`} />
            </div>

            <div className="divide-y divide-[color:var(--color-border)] rounded-[var(--radius-sm)] border border-[color:var(--color-border)]">
              {posts.map((post) => (
                <div key={post.id} className="px-3 py-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[color:var(--color-text-secondary)]">
                    <span>{formatDateTime(post.timestamp)}</span>
                    <span>{post.textLength}字</span>
                    {post.mediaType && post.mediaType !== 'TEXT_POST' && (
                      <span className="rounded-full bg-[color:var(--color-surface-muted)] px-2 py-0.5">
                        {post.mediaType}
                      </span>
                    )}
                    {replies[post.id]?.length ? (
                      <span className="rounded-full bg-purple-100 px-2 py-0.5 text-purple-700">
                        本人の返信 {replies[post.id].length}件
                      </span>
                    ) : null}
                    {post.permalink && (
                      <a
                        href={post.permalink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-purple-600 hover:underline"
                      >
                        Threadsで開く
                      </a>
                    )}
                  </div>

                  <p className="mt-1.5 whitespace-pre-wrap text-sm text-[color:var(--color-text-primary)]">
                    {post.text || '（本文なし）'}
                  </p>

                  {post.hasReplies && (
                    <>
                      <button
                        onClick={() => toggleReplies(post)}
                        className="mt-2 text-xs text-purple-600 hover:underline"
                      >
                        {openPostId === post.id ? '返信を閉じる' : '本人が続けた返信を見る'}
                      </button>

                      {openPostId === post.id && (
                        <div className="mt-2 space-y-2 border-l-2 border-purple-200 pl-3">
                          {loadingReplyId === post.id && (
                            <p className="text-xs text-[color:var(--color-text-secondary)]">
                              読み込み中…
                            </p>
                          )}
                          {loadingReplyId !== post.id && !replies[post.id]?.length && (
                            <p className="text-xs text-[color:var(--color-text-secondary)]">
                              本人が続けた返信はありません
                            </p>
                          )}
                          {replies[post.id]?.map((reply, index) => (
                            <div key={index}>
                              <div className="flex items-center gap-2 text-xs text-[color:var(--color-text-secondary)]">
                                <span className="rounded bg-purple-100 px-1.5 py-0.5 text-purple-700">
                                  {reply.depth}段目
                                </span>
                                <span>{formatGap(reply.secondsAfterRoot)}</span>
                              </div>
                              <p className="mt-0.5 whitespace-pre-wrap text-sm text-[color:var(--color-text-primary)]">
                                {reply.text || '（本文なし）'}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
