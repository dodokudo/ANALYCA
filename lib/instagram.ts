// Instagram Graph API操作用ライブラリ
// GAS互換性のためのデータ構造

import { InstagramReel, InstagramStory, InstagramInsights } from './bigquery';
import { v4 as uuidv4 } from 'uuid';

export interface InstagramUser {
  id: string;
  username: string;
  media_count: number;
  followers_count: number;
  follows_count: number;
  profile_picture_url?: string;
  name?: string;
  biography?: string;
  website?: string;
}

export interface InstagramMedia {
  id: string;
  caption?: string;
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
  media_product_type?: string;
  media_url: string;
  thumbnail_url?: string;
  permalink: string;
  timestamp: string;
  username: string;
  like_count?: number;
  comments_count?: number;
}

export interface MediaInsights {
  impressions: number;
  reach: number;
  saved?: number;
  video_views?: number;
  profile_visits?: number;
  website_clicks?: number;
  shares?: number;
  total_interactions?: number;
  replies?: number;
  follows?: number;
  navigation?: number;
}

export interface StoryInsights {
  reach: number;
  impressions: number;
  replies: number;
  profile_visits: number;
  follows: number;
  navigation: number;
}

export interface ReelInsights {
  reach: number;
  impressions: number;
  likes: number;
  comments: number;
  saves: number;
  shares: number;
  plays: number;
  total_interactions: number;
  video_view_total_time: number;
  avg_time_watched: number;
}

export class InstagramAPI {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  // 短期トークンを長期トークンに変換
  static async exchangeForLongTermToken(shortToken: string): Promise<string> {
    const response = await fetch(
      `https://graph.facebook.com/v23.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${process.env.FACEBOOK_APP_ID}&client_secret=${process.env.FACEBOOK_APP_SECRET}&fb_exchange_token=${shortToken}`
    );

    if (!response.ok) {
      throw new Error('Failed to exchange token');
    }

    const data = await response.json();
    return data.access_token;
  }

  // Instagramアカウント情報取得
  async getInstagramAccount(): Promise<InstagramUser> {
    // 1. Facebookページを取得
    const pagesResponse = await fetch(
      `https://graph.facebook.com/v23.0/me/accounts?access_token=${this.accessToken}`
    );

    if (!pagesResponse.ok) {
      const errorData = await pagesResponse.text();
      console.error('[Instagram API] Failed to fetch Facebook pages:', errorData);
      throw new Error(`Failed to fetch Facebook pages: ${errorData}`);
    }

    const pagesData = await pagesResponse.json();
    console.log('[Instagram API] Found Facebook pages:', pagesData.data?.length || 0);

    if (!pagesData.data || pagesData.data.length === 0) {
      throw new Error('No Facebook pages found. Please create a Facebook Page and link it to your Instagram Business Account. Visit: https://www.facebook.com/pages/create');
    }

    // 2. Instagramに接続されているページを探す
    for (const page of pagesData.data) {
      console.log('[Instagram API] Checking page:', page.name || page.id);
      const igResponse = await fetch(
        `https://graph.facebook.com/v23.0/${page.id}?fields=instagram_business_account&access_token=${this.accessToken}`
      );

      if (!igResponse.ok) {
        const errorData = await igResponse.text();
        console.warn('[Instagram API] Failed to check page for Instagram account:', errorData);
        continue;
      }

      const igData = await igResponse.json();

      if (igData.instagram_business_account) {
        console.log('[Instagram API] Found Instagram Business Account:', igData.instagram_business_account.id);
        // 3. Instagramアカウント詳細を取得
        const accountResponse = await fetch(
          `https://graph.facebook.com/v23.0/${igData.instagram_business_account.id}?fields=id,username,media_count,followers_count,follows_count,profile_picture_url,name,biography,website&access_token=${this.accessToken}`
        );

        if (!accountResponse.ok) {
          const errorData = await accountResponse.text();
          console.error('[Instagram API] Failed to fetch Instagram account details:', errorData);
          throw new Error(`Failed to fetch Instagram account details: ${errorData}`);
        }

        return await accountResponse.json();
      }
    }

    throw new Error('No Instagram Business Account found linked to your Facebook Pages. Please:\n1. Convert your Instagram account to a Business or Creator account\n2. Create a Facebook Page\n3. Link your Instagram account to the Facebook Page\nVisit: https://help.instagram.com/502981923235522');
  }

  // Instagramメディア一覧取得
  async getMedia(limit: number = 25): Promise<InstagramMedia[]> {
    const account = await this.getInstagramAccount();

    const response = await fetch(
      `https://graph.facebook.com/v23.0/${account.id}/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,username,like_count,comments_count&limit=${limit}&access_token=${this.accessToken}`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch Instagram media');
    }

    const data = await response.json();
    return data.data;
  }

  // メディアのインサイト取得
  async getMediaInsights(mediaId: string): Promise<MediaInsights> {
    const response = await fetch(
      `https://graph.facebook.com/v23.0/${mediaId}/insights?metric=impressions,reach,saved,video_views&access_token=${this.accessToken}`
    );

    if (!response.ok) {
      console.warn(`Failed to fetch insights for media ${mediaId}`);
      return { impressions: 0, reach: 0 };
    }

    const data = await response.json();
    const insights: MediaInsights = { impressions: 0, reach: 0 };

    data.data.forEach((metric: { name: string; values: { value: number }[] }) => {
      if (metric.values && metric.values.length > 0) {
        const value = metric.values[0].value;
        switch (metric.name) {
          case 'impressions':
            insights.impressions = value;
            break;
          case 'reach':
            insights.reach = value;
            break;
          case 'saved':
            insights.saved = value;
            break;
          case 'video_views':
            insights.video_views = value;
            break;
        }
      }
    });

    return insights;
  }

  // アカウントインサイト取得
  async getAccountInsights(since: string, until: string): Promise<{
    impressions: number;
    reach: number;
    profile_views: number;
    website_clicks: number;
  }> {
    const account = await this.getInstagramAccount();

    const response = await fetch(
      `https://graph.facebook.com/v23.0/${account.id}/insights?metric=impressions,reach,profile_views,website_clicks&period=day&since=${since}&until=${until}&access_token=${this.accessToken}`
    );

    if (!response.ok) {
      console.warn('Failed to fetch account insights');
      return { impressions: 0, reach: 0, profile_views: 0, website_clicks: 0 };
    }

    const data = await response.json();
    const insights = { impressions: 0, reach: 0, profile_views: 0, website_clicks: 0 };

    data.data.forEach((metric: { name: string; values: { value: number }[] }) => {
      if (metric.values && metric.values.length > 0) {
        const value = metric.values[metric.values.length - 1].value; // 最新の値を取得
        switch (metric.name) {
          case 'impressions':
            insights.impressions = value;
            break;
          case 'reach':
            insights.reach = value;
            break;
          case 'profile_views':
            insights.profile_views = value;
            break;
          case 'website_clicks':
            insights.website_clicks = value;
            break;
        }
      }
    });

    return insights;
  }

  // リールデータ取得（GAS reel rawdata 準拠）
  async getReelsData(userId: string, limit: number = 50): Promise<InstagramReel[]> {
    const account = await this.getInstagramAccount();

    // リール（動画）メディアのみを取得
    const response = await fetch(
      `https://graph.facebook.com/v23.0/${account.id}/media?fields=id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count&limit=${limit}&access_token=${this.accessToken}`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch Instagram media');
    }

    const data = await response.json();
    const reels = data.data.filter((media: InstagramMedia) =>
      media.media_type === 'VIDEO' && media.media_product_type === 'REELS'
    );

    // 各リールのインサイトを取得
    const reelsWithInsights = await Promise.all(
      reels.map(async (reel: InstagramMedia): Promise<InstagramReel> => {
        try {
          const insights = await this.getReelInsights(reel.id);

          return {
            id: uuidv4(),
            user_id: userId,
            instagram_id: reel.id,
            caption: reel.caption || '',
            media_product_type: reel.media_product_type || 'REELS',
            media_type: reel.media_type,
            permalink: reel.permalink,
            timestamp: new Date(reel.timestamp),
            views: insights.plays || 0,
            reach: insights.reach || 0,
            total_interactions: insights.total_interactions || 0,
            like_count: insights.likes || reel.like_count || 0,
            comments_count: insights.comments || reel.comments_count || 0,
            saved: insights.saves || 0,
            shares: insights.shares || 0,
            video_view_total_time_hours: (insights.video_view_total_time / 3600).toString(),
            avg_watch_time_seconds: insights.avg_time_watched || 0,
            thumbnail_url: reel.thumbnail_url
          };
        } catch (error) {
          console.warn(`Failed to get insights for reel ${reel.id}:`, error);
          return {
            id: uuidv4(),
            user_id: userId,
            instagram_id: reel.id,
            caption: reel.caption || '',
            media_product_type: reel.media_product_type || 'REELS',
            media_type: reel.media_type,
            permalink: reel.permalink,
            timestamp: new Date(reel.timestamp),
            views: 0,
            reach: 0,
            total_interactions: 0,
            like_count: reel.like_count || 0,
            comments_count: reel.comments_count || 0,
            saved: 0,
            shares: 0,
            video_view_total_time_hours: '0',
            avg_watch_time_seconds: 0,
            thumbnail_url: reel.thumbnail_url
          };
        }
      })
    );

    return reelsWithInsights;
  }

  // ストーリーデータ取得（GAS stories rawdata 準拠）
  async getStoriesData(userId: string): Promise<InstagramStory[]> {
    const account = await this.getInstagramAccount();

    const response = await fetch(
      `https://graph.facebook.com/v23.0/${account.id}/stories?fields=id,media_type,media_url,thumbnail_url,timestamp&access_token=${this.accessToken}`
    );

    if (!response.ok) {
      console.warn('Failed to fetch stories data');
      return [];
    }

    const data = await response.json();

    const storiesWithInsights = await Promise.all(
      data.data.map(async (story: { id: string; media_type: string; media_url: string; thumbnail_url: string; timestamp: string }): Promise<InstagramStory> => {
        try {
          const insights = await this.getStoryInsights(story.id);

          return {
            id: uuidv4(),
            user_id: userId,
            instagram_id: story.id,
            thumbnail_url: story.thumbnail_url,
            timestamp: new Date(story.timestamp),
            views: insights.impressions || 0,
            reach: insights.reach || 0,
            replies: insights.replies || 0,
            total_interactions: insights.replies + insights.follows + insights.profile_visits,
            follows: insights.follows || 0,
            profile_visits: insights.profile_visits || 0,
            navigation: insights.navigation || 0
          };
        } catch (error) {
          console.warn(`Failed to get insights for story ${story.id}:`, error);
          return {
            id: uuidv4(),
            user_id: userId,
            instagram_id: story.id,
            thumbnail_url: story.thumbnail_url,
            timestamp: new Date(story.timestamp),
            views: 0,
            reach: 0,
            replies: 0,
            total_interactions: 0,
            follows: 0,
            profile_visits: 0,
            navigation: 0
          };
        }
      })
    );

    return storiesWithInsights;
  }

  // インサイトデータ取得（GAS Instagram insight 準拠）
  async getInsightsData(userId: string): Promise<InstagramInsights> {
    const account = await this.getInstagramAccount();
    const today = new Date();
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

    const accountInsights = await this.getAccountInsights(
      yesterday.toISOString().split('T')[0],
      today.toISOString().split('T')[0]
    );

    return {
      id: uuidv4(),
      user_id: userId,
      date: today.toISOString().split('T')[0],
      followers_count: account.followers_count,
      posts_count: account.media_count,
      reach: accountInsights.reach,
      engagement: Math.round((accountInsights.reach * 0.05)), // 仮の計算
      profile_views: accountInsights.profile_views,
      website_clicks: accountInsights.website_clicks
    };
  }

  // リールインサイト取得
  async getReelInsights(mediaId: string): Promise<ReelInsights> {
    const response = await fetch(
      `https://graph.facebook.com/v23.0/${mediaId}/insights?metric=reach,impressions,likes,comments,saves,shares,plays,total_interactions,video_view_total_time,avg_time_watched&access_token=${this.accessToken}`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch reel insights for ${mediaId}`);
    }

    const data = await response.json();
    const insights: ReelInsights = {
      reach: 0,
      impressions: 0,
      likes: 0,
      comments: 0,
      saves: 0,
      shares: 0,
      plays: 0,
      total_interactions: 0,
      video_view_total_time: 0,
      avg_time_watched: 0
    };

    data.data.forEach((metric: { name: string; values: { value: number }[] }) => {
      if (metric.values && metric.values.length > 0) {
        const value = metric.values[0].value;
        switch (metric.name) {
          case 'reach':
            insights.reach = value;
            break;
          case 'impressions':
            insights.impressions = value;
            break;
          case 'likes':
            insights.likes = value;
            break;
          case 'comments':
            insights.comments = value;
            break;
          case 'saves':
            insights.saves = value;
            break;
          case 'shares':
            insights.shares = value;
            break;
          case 'plays':
            insights.plays = value;
            break;
          case 'total_interactions':
            insights.total_interactions = value;
            break;
          case 'video_view_total_time':
            insights.video_view_total_time = value;
            break;
          case 'avg_time_watched':
            insights.avg_time_watched = value;
            break;
        }
      }
    });

    return insights;
  }

  // ストーリーインサイト取得
  async getStoryInsights(storyId: string): Promise<StoryInsights> {
    const response = await fetch(
      `https://graph.facebook.com/v23.0/${storyId}/insights?metric=reach,impressions,replies,profile_visits,follows,navigation&access_token=${this.accessToken}`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch story insights for ${storyId}`);
    }

    const data = await response.json();
    const insights: StoryInsights = {
      reach: 0,
      impressions: 0,
      replies: 0,
      profile_visits: 0,
      follows: 0,
      navigation: 0
    };

    data.data.forEach((metric: { name: string; values: { value: number }[] }) => {
      if (metric.values && metric.values.length > 0) {
        const value = metric.values[0].value;
        switch (metric.name) {
          case 'reach':
            insights.reach = value;
            break;
          case 'impressions':
            insights.impressions = value;
            break;
          case 'replies':
            insights.replies = value;
            break;
          case 'profile_visits':
            insights.profile_visits = value;
            break;
          case 'follows':
            insights.follows = value;
            break;
          case 'navigation':
            insights.navigation = value;
            break;
        }
      }
    });

    return insights;
  }

  // 完全なデータセット取得（GAS構造準拠）
  async getCompleteDataset(userId: string): Promise<{
    account: InstagramUser;
    reels: InstagramReel[];
    stories: InstagramStory[];
    insights: InstagramInsights;
  }> {
    const [account, reels, stories, insights] = await Promise.all([
      this.getInstagramAccount(),
      this.getReelsData(userId),
      this.getStoriesData(userId),
      this.getInsightsData(userId)
    ]);

    return {
      account,
      reels,
      stories,
      insights
    };
  }
}