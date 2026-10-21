import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { isTemplateAllowed } from '@/lib/template-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const userId = new URL(request.url).searchParams.get('userId');
  const headers = { 'Cache-Control': 'private, no-store' };

  // Use the same dashboard-ID scoping as other account-specific features.
  if (!isTemplateAllowed(userId)) {
    return Response.json({ error: '対象外のアカウントです' }, { status: 403, headers });
  }

  const html = await readFile(path.join(process.cwd(), 'lib/templates/threads-kata.html'), 'utf8');
  return new Response(html, {
    headers: {
      ...headers,
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': "frame-ancestors 'self'",
      'X-Frame-Options': 'SAMEORIGIN',
      'X-Content-Type-Options': 'nosniff',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
