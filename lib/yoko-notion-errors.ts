export class YokoNotionError extends Error {
  readonly status: number;

  constructor(status: number, detail: string) {
    super(`Notion API request failed: ${status} ${detail}`);
    this.name = 'YokoNotionError';
    this.status = status;
  }
}

export function yokoNotionSyncErrorMessage(error: unknown): string {
  if (error instanceof YokoNotionError) {
    if (error.status === 401) {
      return 'Notion連携の認証が切れているため、投稿を作成できません。管理者にNotion接続の更新を依頼してください。再試行だけでは解消しません。';
    }
    if (error.status === 403 || error.status === 404) {
      return 'Notionの台本を参照できません。管理者に台本ページとデータベースの共有・アクセス権の確認を依頼してください。';
    }
  }
  if (error instanceof Error && error.message === 'NOTION_API_TOKEN is not configured') {
    return 'Notion連携が設定されていないため、投稿を作成できません。管理者にNotion接続の設定を依頼してください。';
  }
  return 'Notionの最新台本を同期できませんでした。少し待ってから、もう一度「投稿作成」を押してください。';
}
