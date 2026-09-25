import { mediaUrl } from '@/lib/media/site';

export function GET() {
  return new Response([
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin/',
    'Disallow: /api/',
    `Sitemap: ${mediaUrl('/sitemap.xml')}`,
    `Host: ${mediaUrl('/')}`,
    '',
  ].join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
