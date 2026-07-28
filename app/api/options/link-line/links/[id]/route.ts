import { NextRequest, NextResponse } from 'next/server';
import {
  deactivateOptionShortLink,
  getLinkLineOptionRecord,
  optionHasAccess,
  updateOptionShortLink,
} from '@/lib/link-line-option';

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function parseAuthorizedRequest(request: NextRequest): Promise<{
  userId: string;
  body: Record<string, unknown>;
}> {
  const body = await request.json() as Record<string, unknown>;
  const userId = typeof body.userId === 'string' ? body.userId.trim() : '';
  if (!userId) throw new Error('userId is required');
  if (!optionHasAccess(await getLinkLineOptionRecord(userId))) {
    throw new Error('この機能を使うにはオプション契約が必要です');
  }
  return { userId, body };
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const [{ id }, { userId, body }] = await Promise.all([
      context.params,
      parseAuthorizedRequest(request),
    ]);
    await updateOptionShortLink({
      id,
      userId,
      managementName: typeof body.managementName === 'string' ? body.managementName : null,
      destinationUrl: String(body.destinationUrl || ''),
      title: typeof body.title === 'string' ? body.title : null,
      description: typeof body.description === 'string' ? body.description : null,
      ogpImageUrl: typeof body.ogpImageUrl === 'string' ? body.ogpImageUrl : null,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[link-line-option/links] update failed:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'リンク更新に失敗しました' },
      { status: 400 },
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const [{ id }, { userId }] = await Promise.all([
      context.params,
      parseAuthorizedRequest(request),
    ]);
    await deactivateOptionShortLink(id, userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[link-line-option/links] deactivate failed:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'リンク停止に失敗しました' },
      { status: 400 },
    );
  }
}
