import type { MetadataRoute } from 'next';
import { mediaUrl } from '@/lib/media/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/admin/', '/api/'] },
    sitemap: mediaUrl('/sitemap.xml'),
  };
}
