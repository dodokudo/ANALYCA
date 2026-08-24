import { NextRequest, NextResponse } from 'next/server';
import {
  getLinkLineOptionRecord,
  getLinkLineOptionStatus,
  saveLineAccessToken,
  syncLineFriendsForUser,
  userHasLinkLineOptionAccess,
  validateLineAccessToken,
} from '@/lib/link-line-option';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userId = typeof body?.userId === 'string' ? body.userId.trim() : '';
    const accessToken = typeof body?.accessToken === 'string' ? body.accessToken.trim() : '';
    if (!userId || !accessToken) {
      return NextResponse.json(
        { success: false, error: 'ユーザーIDとアクセストークンを入力してください' },
        { status: 400 },
      );
    }

    const option = await getLinkLineOptionRecord(userId);
    if (!userHasLinkLineOptionAccess(userId, option)) {
      return NextResponse.json(
        { success: false, error: 'この機能を使うにはオプション契約が必要です' },
        { status: 403 },
      );
    }

    const account = await validateLineAccessToken(accessToken);
    await saveLineAccessToken({
      userId,
      accessToken,
      accountName: account.accountName,
      accountId: account.accountId,
    });

    let syncWarning: string | null = null;
    try {
      await syncLineFriendsForUser({
        userId,
        accessToken,
        accountName: account.accountName,
      });
    } catch (error) {
      syncWarning = error instanceof Error ? error.message : '友だち数の初回取得は翌日の自動取得で行います';
    }

    return NextResponse.json({
      success: true,
      syncWarning,
      option: await getLinkLineOptionStatus(userId),
    });
  } catch (error) {
    console.error('[link-line-option/settings] failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'LINE初期設定に失敗しました',
      },
      { status: 500 },
    );
  }
}
