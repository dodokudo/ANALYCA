import { getUserThreadsPosts } from '@/lib/bigquery';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function ThreadsPage() {
  // テスト用: 最初のユーザーのデータを取得（実際はログインユーザーのIDを使う）
  const userId = 'test-user-id';

  let posts = [];
  let error = null;

  try {
    posts = await getUserThreadsPosts(userId, 100);
  } catch (e) {
    error = e instanceof Error ? e.message : 'データ取得に失敗しました';
    console.error('Threads data fetch error:', e);
  }

  // 集計データ
  const totalPosts = posts.length;
  const totalViews = posts.reduce((sum, post) => sum + (post.views || 0), 0);
  const totalLikes = posts.reduce((sum, post) => sum + (post.likes || 0), 0);
  const totalReplies = posts.reduce((sum, post) => sum + (post.replies || 0), 0);

  // 閲覧数でソート
  const topPosts = [...posts].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 10);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-emerald-50">
      <div className="container mx-auto px-4 py-8">
        {/* ヘッダー */}
        <div className="mb-8">
          <Link
            href="/"
            className="inline-block text-sm text-gray-600 hover:text-gray-900 mb-4"
          >
            ← ホームに戻る
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Threads インサイト</h1>
          <p className="text-gray-600 mt-2">投稿パフォーマンスの詳細分析</p>
        </div>

        {error ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6">
            <h3 className="text-red-800 font-semibold">エラー</h3>
            <p className="text-red-600 mt-2">{error}</p>
            <p className="text-sm text-red-500 mt-4">
              Threadsでログインしてデータを取得してください。
            </p>
          </div>
        ) : null}

        {/* サマリーカード */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow p-6">
            <div className="text-sm font-medium text-gray-600 uppercase">投稿数</div>
            <div className="text-3xl font-bold text-gray-900 mt-2">{totalPosts}</div>
          </div>
          <div className="bg-white rounded-xl shadow p-6">
            <div className="text-sm font-medium text-gray-600 uppercase">総閲覧数</div>
            <div className="text-3xl font-bold text-gray-900 mt-2">{totalViews.toLocaleString()}</div>
          </div>
          <div className="bg-white rounded-xl shadow p-6">
            <div className="text-sm font-medium text-gray-600 uppercase">総いいね</div>
            <div className="text-3xl font-bold text-gray-900 mt-2">{totalLikes.toLocaleString()}</div>
          </div>
          <div className="bg-white rounded-xl shadow p-6">
            <div className="text-sm font-medium text-gray-600 uppercase">総返信</div>
            <div className="text-3xl font-bold text-gray-900 mt-2">{totalReplies.toLocaleString()}</div>
          </div>
        </div>

        {/* トップコンテンツ */}
        {topPosts.length > 0 ? (
          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">トップコンテンツ</h2>
            <p className="text-sm text-gray-600 mb-6">閲覧数の多い投稿</p>

            <div className="space-y-4">
              {topPosts.map((post) => (
                <div key={post.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-2">
                    <div className="text-xs text-gray-500">
                      {new Date(post.timestamp).toLocaleString('ja-JP', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                    <div className="flex gap-4 text-xs text-gray-600">
                      <span>👁️ {post.views.toLocaleString()}</span>
                      <span>❤️ {post.likes.toLocaleString()}</span>
                      <span>💬 {post.replies.toLocaleString()}</span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap line-clamp-3">
                    {post.text}
                  </p>
                  {post.permalink ? (
                    <a
                      href={post.permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline mt-2 inline-block"
                    >
                      Threadsで見る →
                    </a>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">投稿データがありません</h2>
            <p className="text-gray-600">
              Threadsでログインして投稿データを取得してください。
            </p>
            <Link
              href="/login"
              className="inline-block mt-4 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
            >
              ログインページへ
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
