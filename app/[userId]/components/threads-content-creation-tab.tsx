type ThreadsContentCreationTabProps = {
  onOpenSchedule: () => void;
};

const WORKFLOW_STEPS = [
  { label: '内容初稿', detail: '内容と事実を確認', status: 'current' },
  { label: '本人文体', detail: 'YOKOらしい文体へ調整', status: 'waiting' },
  { label: 'LINE確認', detail: 'クライアントへ確認依頼', status: 'waiting' },
  { label: '予約待ち', detail: '承認後に日時を指定', status: 'waiting' },
] as const;

export default function ThreadsContentCreationTab({ onOpenSchedule }: ThreadsContentCreationTabProps) {
  return (
    <div className="space-y-4">
      <section className="ui-card p-4 md:p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-[color:var(--color-text-primary)]">Threads投稿作成</h2>
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                OpenAI API接続待ち
              </span>
            </div>
            <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">
              内容確認と本人文体の調整を分け、LINE確認後に予約投稿へ進みます。
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenSchedule}
            className="h-10 shrink-0 rounded-[var(--radius-sm)] border border-[color:var(--color-accent)] px-4 text-sm font-semibold text-[color:var(--color-accent)] transition-colors hover:bg-purple-50"
          >
            予約投稿を開く
          </button>
        </div>

        <ol className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {WORKFLOW_STEPS.map((step, index) => (
            <li
              key={step.label}
              className={`rounded-[var(--radius-md)] border p-3 ${
                step.status === 'current'
                  ? 'border-purple-200 bg-purple-50'
                  : 'border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)]'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                  step.status === 'current'
                    ? 'bg-purple-600 text-white'
                    : 'bg-white text-[color:var(--color-text-secondary)]'
                }`}>
                  {index + 1}
                </span>
                <span className="text-sm font-semibold text-[color:var(--color-text-primary)]">{step.label}</span>
              </div>
              <p className="mt-2 text-xs text-[color:var(--color-text-secondary)]">{step.detail}</p>
            </li>
          ))}
        </ol>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.75fr)]">
        <section className="ui-card p-4 md:p-6">
          <div>
            <label htmlFor="threads-post-theme" className="text-sm font-semibold text-[color:var(--color-text-primary)]">
              投稿テーマ
            </label>
            <textarea
              id="threads-post-theme"
              rows={4}
              disabled
              placeholder="例：Instagramリールの内容をThreads投稿へ転用"
              className="mt-2 w-full resize-y rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-slate-50 px-3 py-3 text-sm text-slate-500 outline-none disabled:cursor-not-allowed"
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled
              className="h-10 rounded-[var(--radius-sm)] bg-gradient-to-r from-purple-500 to-emerald-400 px-4 text-sm font-semibold text-white opacity-45 disabled:cursor-not-allowed"
            >
              内容初稿を作成
            </button>
            <button
              type="button"
              disabled
              className="h-10 rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-white px-4 text-sm font-semibold text-slate-400 disabled:cursor-not-allowed"
            >
              本人文体に整える
            </button>
            <button
              type="button"
              disabled
              className="h-10 rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-white px-4 text-sm font-semibold text-slate-400 disabled:cursor-not-allowed"
            >
              LINEに送る
            </button>
          </div>
          <p className="mt-3 text-xs text-[color:var(--color-text-secondary)]">
            API接続までは投稿生成とLINE送信を停止しています。既存の予約投稿画面はそのまま利用できます。
          </p>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {['メイン投稿', 'コメント1', 'コメント2'].map((label) => (
              <div key={label} className="rounded-[var(--radius-md)] border border-dashed border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold text-slate-500">{label}</p>
                <p className="mt-3 text-sm text-slate-400">生成後の文章がここに表示されます。</p>
              </div>
            ))}
          </div>
        </section>

        <aside className="ui-card p-4 md:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-[color:var(--color-text-primary)]">OpenAI API</h3>
              <p className="mt-1 text-xs text-[color:var(--color-text-secondary)]">トークン・料金確認</p>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">未接続</span>
          </div>

          <dl className="mt-5 divide-y divide-[color:var(--color-border)] rounded-[var(--radius-md)] border border-[color:var(--color-border)]">
            {[
              ['APIキー', 'サーバー側で設定予定'],
              ['モデル', '未設定'],
              ['入力トークン', '—'],
              ['出力トークン', '—'],
              ['推定料金', '—'],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-4 px-3 py-3">
                <dt className="text-xs text-[color:var(--color-text-secondary)]">{label}</dt>
                <dd className="text-right text-sm font-medium text-[color:var(--color-text-primary)]">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs leading-5 text-[color:var(--color-text-secondary)]">
            APIキーはブラウザへ保存せず、実装時にサーバー環境変数で管理します。
          </p>
        </aside>
      </div>
    </div>
  );
}
