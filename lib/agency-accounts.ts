// 決済ステータスとは別に管理する運用代行の利用区分。
// ユーザー名が変わっても区分を維持できるよう、ユーザーIDで定義する。
const AGENCY_USER_IDS = new Set<string>([
  '33833959932919231', // YOKO
]);

export function isAgencyAccount(userId: string): boolean {
  return AGENCY_USER_IDS.has(userId);
}
