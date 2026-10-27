/** Keep diagnostic codes without retaining token-bearing URLs or upstream text. */
export async function instagramApiError(response: Response, operation: string): Promise<Error> {
  const body = await response.json().catch(() => ({}));
  const code = typeof body.error?.code === 'number' ? body.error.code : null;
  const subcode = typeof body.error?.error_subcode === 'number' ? body.error.error_subcode : null;
  const hint = code === 190 ? 'ログインの更新が必要です' : code === 10 || code === 200 ? 'Instagramの許可を確認してください' : '取得に失敗しました';
  return new Error(`${operation}: ${hint} (HTTP ${response.status}${code === null ? '' : `, code ${code}`}${subcode === null ? '' : `, subcode ${subcode}`})`);
}
