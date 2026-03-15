import type { MetadataRoute } from 'next';
import { fetchBistStocks } from '@/lib/bist-stocks';

export const revalidate = 3600;

function getBaseUrl(): string {
  const explicitUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicitUrl) return explicitUrl.replace(/\/+$/, '');

  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) return `https://${vercelUrl.replace(/\/+$/, '')}`;

  return 'http://localhost:3000';
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getBaseUrl();
  const now = new Date();

  const routes: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/`,
      lastModified: now,
      changeFrequency: 'hourly',
      priority: 1,
    },
  ];

  try {
    const stocks = await fetchBistStocks();
    const uniqueSymbols = [...new Set(stocks.map(stock => stock.code.toUpperCase()))];

    const stockRoutes: MetadataRoute.Sitemap = uniqueSymbols.map(symbol => ({
      url: `${baseUrl}/stocks/${encodeURIComponent(symbol)}`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.7,
    }));

    return [...routes, ...stockRoutes];
  } catch {
    return routes;
  }
}
