export const STORED_STYLE_AUDIT_ERROR_PREFIX = '本人文体監査NG（監査案保存済み）:';
export const MANUAL_STYLE_AUDIT_PENDING_PREFIX = '修正稿保存済み（再監査待ち）:';
export const MANUAL_STYLE_AUDIT_ERROR_PREFIX = '本人文体監査NG（修正稿は保持）:';

export function countYokoText(value: string): number {
  return Array.from(value.replace(/[\s\u3000]/g, '')).length;
}

export function isEditableStyleAuditState(lastError: string | null): boolean {
  return Boolean(lastError && [
    STORED_STYLE_AUDIT_ERROR_PREFIX,
    MANUAL_STYLE_AUDIT_PENDING_PREFIX,
    MANUAL_STYLE_AUDIT_ERROR_PREFIX,
  ].some((prefix) => lastError.startsWith(prefix)));
}

export function reportedCommentLength(lastError: string, commentNumber: 1 | 2): number | null {
  const match = lastError.match(new RegExp(`コメント${commentNumber}[^\n]*?[（(](\\d+)文字[）)]`));
  return match ? Number(match[1]) : null;
}

export function hasStaleStyleLengthError(input: {
  lastError: string | null;
  comment1: string;
  comment2: string;
}): boolean {
  if (!isEditableStyleAuditState(input.lastError) || !input.lastError) return false;
  const reported1 = reportedCommentLength(input.lastError, 1);
  const reported2 = reportedCommentLength(input.lastError, 2);
  return (reported1 !== null && reported1 !== countYokoText(input.comment1))
    || (reported2 !== null && reported2 !== countYokoText(input.comment2));
}

export function yokoCommentLengthGuide(value: string): string {
  const length = countYokoText(value);
  if (length < 370) return `${length}文字（あと${370 - length}文字）`;
  if (length > 500) return `${length}文字（${length - 500}文字オーバー）`;
  return `${length}文字（範囲内）`;
}

export function manualStyleAuditFailureMessage(issues: string[]): string {
  return `${MANUAL_STYLE_AUDIT_ERROR_PREFIX} ${issues.join('、') || '監査結果がありません'}`;
}
