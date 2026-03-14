import { NextRequest, NextResponse } from 'next/server';

interface NewsItem {
  title: string;
  link: string;
  publishedAt: string;
  source: string;
}

const newsCache: Record<string, { data: NewsItem[]; timestamp: number }> = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function stripCdata(text: string): string {
  return text.replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '');
}

function extractTag(itemXml: string, tag: string): string {
  const match = itemXml.match(new RegExp(`<${tag}(?:\\s+[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i'));
  if (!match) return '';
  return decodeHtmlEntities(stripCdata(match[1].trim()));
}

function parseRssItems(xml: string): NewsItem[] {
  const items: NewsItem[] = [];
  const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/gi);

  for (const match of itemMatches) {
    const itemXml = match[1];
    const titleRaw = extractTag(itemXml, 'title');
    const link = extractTag(itemXml, 'link');
    const publishedAt = extractTag(itemXml, 'pubDate');
    const source = extractTag(itemXml, 'source') || 'Bilinmeyen kaynak';

    if (!titleRaw || !link) continue;

    const title = titleRaw.replace(/\s+/g, ' ').trim();
    items.push({ title, link, publishedAt, source });
  }

  return items;
}

async function fetchRelatedNews(symbol: string): Promise<NewsItem[]> {
  const query = `${symbol} hisse BIST OR "Borsa Istanbul"`;
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=tr&gl=TR&ceid=TR:tr`;

  const response = await fetch(url, {
    headers: {
      Accept: 'application/rss+xml, application/xml, text/xml',
    },
    next: { revalidate: 300 },
  });

  if (!response.ok) {
    throw new Error(`News RSS request failed with status ${response.status}`);
  }

  const xml = await response.text();
  return parseRssItems(xml);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const { symbol } = await params;
    const code = symbol.toUpperCase();
    const limitParam = Number(request.nextUrl.searchParams.get('limit') || 6);
    const limit = Math.max(1, Math.min(20, Number.isNaN(limitParam) ? 6 : limitParam));

    const cacheKey = `${code}_${limit}`;
    const cached = newsCache[cacheKey];
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json({
        success: true,
        data: cached.data,
        count: cached.data.length,
        source: 'cache',
        timestamp: new Date().toISOString(),
      });
    }

    const news = (await fetchRelatedNews(code)).slice(0, limit);
    newsCache[cacheKey] = { data: news, timestamp: Date.now() };

    return NextResponse.json({
      success: true,
      data: news,
      count: news.length,
      source: 'google-news-rss',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Related news fetch error:', error);
    return NextResponse.json({
      success: false,
      error: 'Ilgili haberler alinamadi',
      data: [],
      count: 0,
    });
  }
}
