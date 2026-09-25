import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { isMediaAdmin } from '@/lib/media/auth';

export const dynamic = 'force-dynamic';

export default async function MediaAdminLayout({ children }: { children: ReactNode }) {
  if (!(await isMediaAdmin())) redirect('/admin/media-login');
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-16 max-w-[1440px] items-center justify-between px-4 sm:px-6">
          <Link href="/admin/media" className="flex items-center gap-3 font-extrabold tracking-tight">
            <span className="h-7 w-2.5 -skew-x-12 rounded-sm bg-blue-600" />
            ANALYCA Media 管理
          </Link>
          <nav className="flex items-center gap-4 text-sm font-semibold text-slate-600">
            <Link href="/admin/media/new" className="rounded-lg bg-blue-600 px-4 py-2 text-white">新しい記事</Link>
            <a href="https://media.analyca.jp" target="_blank" rel="noreferrer">公開サイト</a>
            <Link href="/admin">管理トップ</Link>
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
