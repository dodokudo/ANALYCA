'use client';

import { useState, useEffect } from 'react';

interface ProfileData {
  id: string;
  username: string;
  name: string;
  profile_picture_url?: string;
  followers_count: number;
  follows_count: number;
  media_count: number;
  biography?: string;
  website?: string;
}

interface ProfileHeaderProps {
  userId?: string;
}

export default function ProfileHeader({ userId }: ProfileHeaderProps) {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || userId === 'demo-user') {
      setLoading(false);
      return;
    }

    const fetchProfile = async () => {
      try {
        const response = await fetch(`/api/user-profile/${userId}`);
        const result = await response.json();

        if (result.success && result.profile) {
          setProfile(result.profile);
        }
      } catch (error) {
        console.error('Failed to fetch profile:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [userId]);

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 border-b border-gray-200/70 dark:border-white/10 p-4">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse"></div>
          <div className="flex-1">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-2 animate-pulse"></div>
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-24 animate-pulse"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-slate-800 border-b border-gray-200/70 dark:border-white/10 p-4 sticky top-0 z-10">
      <div className="flex items-center space-x-3">
        {/* プロフィール画像 */}
        <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 flex-shrink-0">
          {profile.profile_picture_url ? (
            <img
              src={profile.profile_picture_url}
              alt={profile.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling?.classList.remove('hidden');
              }}
            />
          ) : null}
          <div className="w-full h-full bg-gradient-to-r from-purple-500 to-emerald-400 flex items-center justify-center text-white font-bold text-lg hidden">
            {profile.name?.charAt(0)?.toUpperCase() || profile.username?.charAt(0)?.toUpperCase() || '?'}
          </div>
        </div>

        {/* アカウント情報 */}
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-200 truncate">
            {profile.name || profile.username}
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
            @{profile.username} • {profile.followers_count.toLocaleString()}フォロワー
          </p>
        </div>

        {/* 投稿数（モバイル向け） */}
        <div className="text-right flex-shrink-0">
          <div className="text-lg font-bold text-gray-900 dark:text-gray-200">
            {profile.media_count.toLocaleString()}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400">
            投稿
          </div>
        </div>
      </div>

      {/* バイオ（デスクトップで表示） */}
      {profile.biography && (
        <div className="mt-3 hidden lg:block">
          <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
            {profile.biography}
          </p>
        </div>
      )}
    </div>
  );
}