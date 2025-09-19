import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { accessToken } = await request.json();

    // 1. 短期トークンから長期トークンに変換
    const longTermToken = await exchangeForLongTermToken(accessToken);

    // 2. Instagramアカウント情報を取得
    const instagramAccount = await getInstagramAccount(longTermToken);

    // 3. データを取得（現在のGASスクリプトと同じロジック）
    const instagramData = await fetchInstagramData(instagramAccount.id, longTermToken);

    // 4. スプレッドシートに保存（既存のシステム活用）
    await saveToSpreadsheet(instagramData);

    return NextResponse.json({
      success: true,
      message: 'ダッシュボードが作成されました！',
      accountInfo: {
        username: instagramAccount.username,
        followerCount: instagramAccount.followers_count
      }
    });

  } catch (error) {
    console.error('Error creating dashboard:', error);
    return NextResponse.json({
      success: false,
      error: 'ダッシュボード作成に失敗しました'
    }, { status: 500 });
  }
}

// 短期トークンを長期トークンに変換
async function exchangeForLongTermToken(shortToken: string) {
  const response = await fetch(
    `https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${process.env.FACEBOOK_APP_ID}&client_secret=${process.env.FACEBOOK_APP_SECRET}&fb_exchange_token=${shortToken}`
  );
  const data = await response.json();
  return data.access_token;
}

// Instagramアカウント情報取得
async function getInstagramAccount(accessToken: string) {
  const response = await fetch(
    `https://graph.facebook.com/v18.0/me/accounts?access_token=${accessToken}`
  );
  const data = await response.json();

  // Instagramに接続されているページを探す
  for (const page of data.data) {
    const igResponse = await fetch(
      `https://graph.facebook.com/v18.0/${page.id}?fields=instagram_business_account&access_token=${accessToken}`
    );
    const igData = await igResponse.json();

    if (igData.instagram_business_account) {
      return {
        id: igData.instagram_business_account.id,
        username: page.name, // または実際のInstagramユーザー名を取得
        followers_count: 0 // 後で取得
      };
    }
  }

  throw new Error('Instagramアカウントが見つかりません');
}

// Instagramデータ取得（既存のGASロジックと同じ）
async function fetchInstagramData(accountId: string, accessToken: string) {
  // ここに現在のGASで使っているデータ取得ロジックを移植
  const response = await fetch(
    `https://graph.facebook.com/v18.0/${accountId}/media?fields=id,caption,media_type,media_url,thumbnail_url,timestamp,like_count,comments_count&access_token=${accessToken}`
  );

  return await response.json();
}

// スプレッドシートに保存（既存システム活用）
async function saveToSpreadsheet(data: any) {
  // 既存のGoogle Sheets APIを使用
  // または現在のGASスクリプトを呼び出し
}