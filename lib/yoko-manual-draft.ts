export type ManualDraftText = {
  theme: string;
  mainText: string;
  comment1: string;
  comment2: string;
};

export const MANUAL_DRAFT_BATCH_PREFIX = 'manual:';

export function manualDraftErrors(input: ManualDraftText): string[] {
  const errors: string[] = [];
  for (const [key, label] of [
    ['mainText', 'メイン投稿'], ['comment1', 'コメント欄1'], ['comment2', 'コメント欄2'],
  ] as const) {
    const value = input[key];
    if (!value.trim()) errors.push(`${label}を入力してください`);
    if (Array.from(value).length > 500) errors.push(`${label}は改行・空白込みで500文字以内にしてください`);
  }
  if (Array.from(input.theme).length > 100) errors.push('テーマは100文字以内にしてください');
  return errors;
}

export function parseManualDraft(input: Record<string, unknown>): ManualDraftText & { requestId: string } {
  if (typeof input.requestId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.requestId)) {
    throw new Error('作成情報が無効です。投稿作成を開き直してください');
  }
  for (const key of ['mainText', 'comment1', 'comment2']) {
    if (typeof input[key] !== 'string') throw new Error('メイン投稿・コメント欄1・2を入力してください');
  }
  if (input.theme !== undefined && typeof input.theme !== 'string') throw new Error('テーマを文字列で入力してください');
  const text: ManualDraftText = {
    theme: typeof input.theme === 'string' ? input.theme.trim() : '',
    mainText: input.mainText as string,
    comment1: input.comment1 as string,
    comment2: input.comment2 as string,
  };
  const errors = manualDraftErrors(text);
  if (errors.length) throw new Error(errors.join('、'));
  return {
    ...text,
    theme: text.theme || Array.from(text.mainText.trim().split('\n')[0]).slice(0,50).join(''),
    requestId: input.requestId,
  };
}
