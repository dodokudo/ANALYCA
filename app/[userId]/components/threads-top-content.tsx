'use client';

import { useMemo, useState } from 'react';
import { RepostButton } from './repost-button';
import type { MonthlyReportPost } from '@/lib/threads-monthly-report';

export interface ThreadsContentComment {
  id: string;
  parent_post_id: string;
  text: string;
  views: number;
  depth: number;
}

function safeFormatDateTime(timestamp: string | Date | null | undefined): string {
  if (!timestamp) return '-';
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleString('ja-JP', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '-';
  }
}

function safeGetTime(timestamp: string | Date | null | undefined): number {
  if (!timestamp) return 0;
  try {
    const date = new Date(timestamp);
    return isNaN(date.getTime()) ? 0 : date.getTime();
  } catch {
    return 0;
  }
}

export function ThreadsTopContent({ userId, posts, comments }: {
  userId: string;
  posts: MonthlyReportPost[];
  comments: ThreadsContentComment[];
}) {
  const [expandedPosts, setExpandedPosts] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'postedAt' | 'views' | 'likes'>('views');
  const [showAllPosts, setShowAllPosts] = useState(false);
  const toggleExpand = (postId: string) => {
    setExpandedPosts((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
  };

  // コメント紐付け
  const commentsByPostId = useMemo(() => {
    const map = new Map<string, ThreadsContentComment[]>();
    comments.forEach((c) => {
      if (!map.has(c.parent_post_id)) map.set(c.parent_post_id, []);
      map.get(c.parent_post_id)!.push(c);
    });
    return map;
  }, [comments]);

  // ソート
  const sortedPosts = useMemo(() => {
    return [...posts].sort((a, b) => {
      if (sortBy === 'views') return (b.views || 0) - (a.views || 0);
      if (sortBy === 'likes') return (b.likes || 0) - (a.likes || 0);
      return safeGetTime(b.timestamp) - safeGetTime(a.timestamp);
    });
  }, [posts, sortBy]);

  // 遷移率計算（depth毎に最もviewsが多いコメントでファネルを構成）
  const getTransitionRates = (post: MonthlyReportPost) => {
    const postComments = commentsByPostId.get(post.threads_id) || [];
    const postViews = post.views || 0;
    if (!postComments.length || postViews === 0) return { transitions: [], overallRate: null };

    // depth毎に最もviewsが多いコメントを選出
    const byDepth = new Map<number, ThreadsContentComment>();
    for (const c of postComments) {
      const d = c.depth || 0;
      const existing = byDepth.get(d);
      if (!existing || (c.views || 0) > (existing.views || 0)) {
        byDepth.set(d, c);
      }
    }
    const depthKeys = [...byDepth.keys()].sort((a, b) => a - b);
    if (depthKeys.length === 0) return { transitions: [], overallRate: null };

    const transitions: { from: string; to: string; rate: number; views: number }[] = [];
    const firstComment = byDepth.get(depthKeys[0])!;
    const firstViews = firstComment.views || 0;
    transitions.push({ from: 'メイン', to: 'コメント欄1', rate: postViews > 0 ? (firstViews / postViews) * 100 : 0, views: firstViews });

    for (let i = 1; i < depthKeys.length; i++) {
      const prevComment = byDepth.get(depthKeys[i - 1])!;
      const currComment = byDepth.get(depthKeys[i])!;
      const prevViews = prevComment.views || 0;
      const currViews = currComment.views || 0;
      if (prevViews > 0) {
        transitions.push({
          from: `コメント欄${i}`,
          to: `コメント欄${i + 1}`,
          rate: (currViews / prevViews) * 100,
          views: currViews,
        });
      }
    }
    const lastComment = byDepth.get(depthKeys[depthKeys.length - 1])!;
    const lastViews = lastComment.views || 0;
    const overallRate = postViews > 0 ? (lastViews / postViews) * 100 : null;
    return { transitions, overallRate };
  };

  const INITIAL_DISPLAY_COUNT = 20;
  const displayedPosts = showAllPosts ? sortedPosts : sortedPosts.slice(0, INITIAL_DISPLAY_COUNT);
  const hasMorePosts = sortedPosts.length > INITIAL_DISPLAY_COUNT;

  return (
    <>
      {/* トップコンテンツ */}
      {displayedPosts.length > 0 && (
        <div className="ui-card">
          <header className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[color:var(--color-text-primary)]">トップコンテンツ</h2>
              <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">反応が高かった投稿 ({displayedPosts.length}/{sortedPosts.length}件)</p>
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'postedAt' | 'views' | 'likes')}
              className="h-9 w-40 rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-white px-3 text-sm text-[color:var(--color-text-secondary)]"
            >
              <option value="views">閲覧数</option>
              <option value="likes">いいね数</option>
              <option value="postedAt">投稿日時</option>
            </select>
          </header>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {displayedPosts.map((post, idx) => {
              const isExpanded = expandedPosts.has(post.id);
              const { transitions, overallRate } = getTransitionRates(post);
              const isTop10 = idx < 10;
              const rank = idx + 1;
              const postComments = commentsByPostId.get(post.threads_id) || [];

              return (
                <div
                  key={post.id}
                  className={`rounded-[var(--radius-md)] border bg-white p-3 shadow-[var(--shadow-soft)] cursor-pointer ${
                    isTop10 ? 'border-amber-300 bg-amber-50/30' : 'border-[color:var(--color-border)]'
                  }`}
                  onClick={() => toggleExpand(post.id)}
                >
                  <div className="flex items-center justify-between text-xs text-[color:var(--color-text-muted)]">
                    <div className="flex items-center gap-2">
                      {isTop10 && (
                        <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${
                          rank === 1 ? 'bg-yellow-400 text-yellow-900' :
                          rank === 2 ? 'bg-gray-300 text-gray-700' :
                          rank === 3 ? 'bg-amber-600 text-white' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {rank}
                        </span>
                      )}
                      <span>{safeFormatDateTime(post.timestamp)}</span>
                      {postComments.length > 0 && (
                        <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-700">
                          コメント欄{postComments.length}つ
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span>閲覧 {(post.views || 0).toLocaleString()}</span>
                      <span>いいね {(post.likes || 0).toLocaleString()}</span>
                      <RepostButton
                        userId={userId}
                        postId={post.id}
                        mainText={post.text}
                        comments={postComments.map((c) => ({
                          id: c.id,
                          text: c.text,
                          views: c.views,
                          depth: c.depth,
                        }))}
                      />
                    </div>
                  </div>

                  {transitions.length > 0 && (
                    <div className="mt-2 rounded-md bg-gradient-to-r from-purple-50 to-indigo-50 p-2 border border-purple-100">
                      <div className="flex items-center gap-1 flex-wrap text-[10px]">
                        <div className="flex flex-col items-center">
                          <span className="text-gray-500">メイン</span>
                          <span className="font-bold text-gray-700">{(post.views || 0).toLocaleString()}</span>
                        </div>
                        {transitions.map((t, tIdx) => {
                          const isFirst = tIdx === 0;
                          const rate = t.rate || 0;
                          const colorClass = isFirst
                            ? rate >= 10 ? 'text-green-600' : 'text-red-500'
                            : rate >= 80 ? 'text-green-600' : rate >= 50 ? 'text-yellow-600' : 'text-red-500';
                          return (
                            <div key={tIdx} className="flex items-center gap-1">
                              <div className="flex flex-col items-center px-1">
                                <span className="text-gray-400">→</span>
                                <span className={`font-bold ${colorClass}`}>{rate.toFixed(1)}%</span>
                              </div>
                              <div className="flex flex-col items-center">
                                <span className="text-gray-500">{t.to}</span>
                                <span className="font-bold text-gray-700">{(t.views || 0).toLocaleString()}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {overallRate !== null && transitions.length > 1 && (
                        <div className="mt-1 pt-1 border-t border-purple-200 flex items-center gap-1 text-[10px]">
                          <span className="text-gray-500">全体遷移率:</span>
                          <span className={`font-bold ${overallRate >= 1 ? 'text-blue-600' : 'text-gray-500'}`}>{overallRate.toFixed(2)}%</span>
                        </div>
                      )}
                    </div>
                  )}

                  <p className="mt-2 text-sm text-[color:var(--color-text-primary)] whitespace-pre-wrap">
                    {isExpanded ? post.text : (post.text && post.text.length > 80 ? post.text.slice(0, 80) + '…' : post.text || '(テキストなし)')}
                  </p>

                  {isExpanded && postComments.length > 0 && (
                    <div className="mt-3 space-y-2 border-t border-gray-200 pt-3">
                      <p className="text-xs font-medium text-gray-500">コメント欄</p>
                      {[...postComments]
                        .sort((a, b) => a.depth - b.depth)
                        .map((comment, cidx) => (
                        <div
                          key={comment.id}
                          className="rounded-md bg-gray-50 p-2 text-xs"
                        >
                          <div className="flex items-center gap-2 text-[10px] text-gray-400 mb-1">
                            <span className="font-medium text-purple-600">コメント{cidx + 1}</span>
                            <span>閲覧 {comment.views.toLocaleString()}</span>
                          </div>
                          <p className="text-gray-700 whitespace-pre-wrap">{comment.text}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {post.permalink && (
                    <a
                      href={post.permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="mt-2 text-xs text-[color:var(--color-accent)] hover:underline inline-block"
                    >
                      Threadsで見る →
                    </a>
                  )}
                </div>
              );
            })}
          </div>
          {hasMorePosts && (
            <div className="mt-4 flex justify-center">
              <button
                onClick={() => setShowAllPosts(!showAllPosts)}
                className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-white px-6 py-2 text-sm font-medium text-[color:var(--color-text-secondary)] transition-colors hover:bg-[color:var(--color-surface-muted)]"
              >
                {showAllPosts ? '閉じる' : `続きを見る (残り${sortedPosts.length - INITIAL_DISPLAY_COUNT}件)`}
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
