/**
 * Threads Graph API Client
 *
 * Handles authentication, data fetching, and insights for Threads.
 * Similar to Instagram Graph API structure.
 */

const GRAPH_BASE = 'https://graph.threads.net/v1.0';

export interface ThreadsPost {
  id: string;
  text: string;
  timestamp: string;
  permalink: string;
  media_type: string;
  is_quote_post?: boolean;
}

export interface ThreadsInsights {
  views?: number;
  likes?: number;
  replies?: number;
  reposts?: number;
  quotes?: number;
}

export interface ThreadsAccountInfo {
  id: string;
  username: string;
  threads_profile_picture_url?: string;
  threads_biography?: string;
}

export interface ThreadsMetrics {
  views: number;
  likes: number;
  replies: number;
  reposts: number;
  quotes: number;
  followers_count: number;
}

export class ThreadsAPI {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  /**
   * Exchange authorization code for short-lived token (OAuth Step 3)
   */
  static async exchangeCodeForShortToken(
    code: string,
    redirectUri: string
  ): Promise<{ access_token: string; user_id: string }> {
    const params = new URLSearchParams({
      client_id: process.env.NEXT_PUBLIC_THREADS_APP_ID || '',
      client_secret: process.env.THREADS_APP_SECRET || '',
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code,
    });

    const response = await fetch('https://graph.threads.net/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to exchange Threads authorization code: ${error}`);
    }

    return await response.json();
  }

  /**
   * Exchange short-lived token for long-lived token (60 days)
   */
  static async exchangeForLongTermToken(shortToken: string): Promise<string> {
    const response = await fetch(
      `https://graph.threads.net/access_token?grant_type=th_exchange_token&client_secret=${process.env.THREADS_APP_SECRET}&access_token=${shortToken}`
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to exchange Threads token: ${error}`);
    }

    const data = await response.json();
    return data.access_token;
  }

  /**
   * Refresh long-lived token (extends expiration by 60 days)
   */
  static async refreshLongTermToken(longToken: string): Promise<string> {
    const response = await fetch(
      `https://graph.threads.net/refresh_access_token?grant_type=th_refresh_token&access_token=${longToken}`
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to refresh Threads token: ${error}`);
    }

    const data = await response.json();
    return data.access_token;
  }

  /**
   * Get Threads account information
   */
  async getAccountInfo(): Promise<ThreadsAccountInfo> {
    const response = await fetch(
      `${GRAPH_BASE}/me?fields=id,username,threads_profile_picture_url,threads_biography&access_token=${this.accessToken}`
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get Threads account info: ${error}`);
    }

    return await response.json();
  }

  /**
   * Get user's Threads posts (media)
   */
  async getPosts(limit = 100): Promise<ThreadsPost[]> {
    const response = await fetch(
      `${GRAPH_BASE}/me/threads?fields=id,text,timestamp,permalink,media_type,is_quote_post&limit=${limit}&access_token=${this.accessToken}`
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get Threads posts: ${error}`);
    }

    const data = await response.json();
    return data.data || [];
  }

  /**
   * Get insights for a specific post
   */
  async getPostInsights(postId: string): Promise<ThreadsInsights> {
    try {
      const response = await fetch(
        `${GRAPH_BASE}/${postId}/insights?metric=views,likes,replies,reposts,quotes&access_token=${this.accessToken}`
      );

      if (!response.ok) {
        console.warn(`Failed to get insights for post ${postId}`);
        return {};
      }

      const data = await response.json();
      const insights: ThreadsInsights = {};

      if (data.data && Array.isArray(data.data)) {
        for (const metric of data.data) {
          switch (metric.name) {
            case 'views':
              insights.views = metric.values?.[0]?.value || 0;
              break;
            case 'likes':
              insights.likes = metric.values?.[0]?.value || 0;
              break;
            case 'replies':
              insights.replies = metric.values?.[0]?.value || 0;
              break;
            case 'reposts':
              insights.reposts = metric.values?.[0]?.value || 0;
              break;
            case 'quotes':
              insights.quotes = metric.values?.[0]?.value || 0;
              break;
          }
        }
      }

      return insights;
    } catch (error) {
      console.warn(`Error getting insights for post ${postId}:`, error);
      return {};
    }
  }

  /**
   * Get account-level metrics
   */
  async getAccountMetrics(): Promise<ThreadsMetrics> {
    try {
      const response = await fetch(
        `${GRAPH_BASE}/me/threads_insights?metric=views,likes,replies,reposts,quotes,followers_count&access_token=${this.accessToken}`
      );

      if (!response.ok) {
        console.warn('Failed to get account metrics');
        return {
          views: 0,
          likes: 0,
          replies: 0,
          reposts: 0,
          quotes: 0,
          followers_count: 0,
        };
      }

      const data = await response.json();
      const metrics: ThreadsMetrics = {
        views: 0,
        likes: 0,
        replies: 0,
        reposts: 0,
        quotes: 0,
        followers_count: 0,
      };

      if (data.data && Array.isArray(data.data)) {
        for (const metric of data.data) {
          const value = metric.values?.[0]?.value || 0;
          switch (metric.name) {
            case 'views':
              metrics.views = value;
              break;
            case 'likes':
              metrics.likes = value;
              break;
            case 'replies':
              metrics.replies = value;
              break;
            case 'reposts':
              metrics.reposts = value;
              break;
            case 'quotes':
              metrics.quotes = value;
              break;
            case 'followers_count':
              metrics.followers_count = value;
              break;
          }
        }
      }

      return metrics;
    } catch (error) {
      console.warn('Error getting account metrics:', error);
      return {
        views: 0,
        likes: 0,
        replies: 0,
        reposts: 0,
        quotes: 0,
        followers_count: 0,
      };
    }
  }

  /**
   * Get all posts with their insights
   */
  async getPostsWithInsights(limit = 100): Promise<Array<ThreadsPost & { insights: ThreadsInsights }>> {
    const posts = await this.getPosts(limit);
    const postsWithInsights = await Promise.all(
      posts.map(async (post) => {
        const insights = await this.getPostInsights(post.id);
        return {
          ...post,
          insights,
        };
      })
    );

    return postsWithInsights;
  }
}
