import { redirect } from 'next/navigation';
import Link from 'next/link';

interface ThreadsPageProps {
  searchParams?: {
    userId?: string;
  };
}

export default function ThreadsPage({ searchParams }: ThreadsPageProps) {
  const userId = searchParams?.userId;

  if (userId) {
    redirect(`/analyca/${userId}?tab=threads`);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-emerald-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-xl p-10 max-w-lg w-full text-center space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">Threadsダッシュボード</h1>
        <p className="text-gray-600 leading-relaxed">
          Threadsの投稿データは、ログイン後の統合ダッシュボードからInstagramと並んで確認できます。
        </p>
        <div className="space-y-3">
          <p className="text-sm text-gray-500">
            まだログインしていない場合は、以下のボタンからThreadsでログインしてください。
          </p>
          <Link
            href="/login?tab=threads"
            className="inline-block bg-gray-900 hover:bg-black text-white font-semibold py-3 px-6 rounded-xl transition-colors"
          >
            Threadsでログインする
          </Link>
        </div>
        <p className="text-xs text-gray-400">
          ログイン後、自動的にダッシュボードが作成され「Threads」タブでデータを切り替えられます。
        </p>
      </div>
    </div>
  );
}
