/** fetch resolves even for HTTP errors; a JSON success:false is also a failure. */
export async function requireSuccessfulSyncs(requests: Promise<Response>[]): Promise<void> {
  const results = await Promise.allSettled(requests.map(async request => {
    const response = await request;
    const body = await response.json();
    if (!response.ok || body.success !== true) {
      const endpoint = response.url ? new URL(response.url).pathname.split('/').slice(-2).join('/') : 'sync';
      throw new Error(`${endpoint}: ${typeof body.error === 'string' ? body.error : `HTTP ${response.status}`}`);
    }
  }));
  const errors = results.flatMap(result => result.status === 'rejected' ? [result.reason instanceof Error ? result.reason.message : '通信に失敗しました'] : []);
  if (errors.length) throw new Error(errors.join(' / '));
}
