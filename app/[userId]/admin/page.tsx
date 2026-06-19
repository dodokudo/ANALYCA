'use client';

import { Suspense, use } from 'react';
import LoadingScreen from '@/components/LoadingScreen';
import { UserDashboardContent } from '../dashboard-page-client';

export default function AdminUserDashboardPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params);

  return (
    <Suspense fallback={<LoadingScreen message="データ読み込み中" />}>
      <UserDashboardContent userId={userId} adminAccess />
    </Suspense>
  );
}
