import { after, NextRequest, NextResponse } from 'next/server';
import { getPublicOptionShortLink, logOptionLinkClick } from '@/lib/link-line-option';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ code: string[] }>;
}

const CRAWLER_PATTERN = /facebookexternalhit|facebot|twitterbot|linkedinbot|slackbot|discordbot|telegrambot|whatsapp|pinterest|redditbot|applebot|googlebot|bingbot|duckduckbot|yandexbot|baiduspider|embedly|threadsbot|meta-externalagent|linebot|line-poker|bytespider|crawler|spider|preview/i;

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function buildOgpHtml(link: NonNullable<Awaited<ReturnType<typeof getPublicOptionShortLink>>>): string {
  const title = escapeHtml(link.title || link.managementName || 'ANALYCA Link');
  const description = escapeHtml(link.description || '');
  const destination = escapeHtml(link.destinationUrl);
  const image = link.ogpImageUrl ? escapeHtml(link.ogpImageUrl) : '';
  const imageMeta = image
    ? `<meta property="og:image" content="${image}"><meta name="twitter:image" content="${image}">`
    : '';

  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><meta property="og:title" content="${title}"><meta property="og:description" content="${description}"><meta property="og:url" content="${destination}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${title}"><meta name="twitter:description" content="${description}">${imageMeta}<meta http-equiv="refresh" content="0;url=${destination}"></head><body><a href="${destination}">リンクを開く</a></body></html>`;
}

function getDeviceType(userAgent: string): string {
  if (/tablet|ipad/i.test(userAgent)) return 'tablet';
  if (/mobile|iphone|android/i.test(userAgent)) return 'mobile';
  return 'desktop';
}

export async function GET(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const { code: segments } = await context.params;
  const shortCode = segments.join('/');
  const link = await getPublicOptionShortLink(shortCode);
  if (!link) return new NextResponse('Not Found', { status: 404 });

  const userAgent = request.headers.get('user-agent') || '';
  if (CRAWLER_PATTERN.test(userAgent)) {
    return new NextResponse(buildOgpHtml(link), {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
      },
    });
  }

  after(() => {
    logOptionLinkClick({
      shortLinkId: link.id,
      userId: link.userId,
      referrer: request.headers.get('referer'),
      userAgent,
      deviceType: getDeviceType(userAgent),
    }).catch((error) => console.error('[link-line-option/click] failed:', error));
  });

  return NextResponse.redirect(link.destinationUrl, {
    status: 307,
    headers: { 'cache-control': 'no-store' },
  });
}
