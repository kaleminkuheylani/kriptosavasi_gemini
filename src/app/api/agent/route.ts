import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import ZAI from 'z-ai-web-dev-sdk';
import { cookies } from 'next/headers';

const prisma = new PrismaClient();

// Helper - Get current user
async function getCurrentUserId() {
  const cookieStore = await cookies();
  return cookieStore.get('userId')?.value || null;
}

// Tool Definitions
const TOOLS = {
  get_stock_price: {
    description: 'Hisse senedinin güncel fiyatını getirir. API başarısız olursa web aramasına döner. 1 aylık geçmiş özeti (trend, SMA, % değişim) ve kullanıcının takip listesi/alert durumunu da döndürür.',
    parameters: { symbol: 'string - Hisse kodu (örn: ASELS, THYAO)' },
  },
  get_stock_history: {
    description: 'Hisse senedinin geçmiş fiyat verilerini getirir',
    parameters: { symbol: 'string', period: 'string (1M, 3M, 6M, 1Y, 3Y, 5Y)' },
  },
  get_watchlist: {
    description: 'Kullanıcının takip listesini veritabanından çeker',
    parameters: {},
  },
  add_to_watchlist: {
    description: 'Hisseni takip listesine ekler',
    parameters: { symbol: 'string', name: 'string' },
  },
  remove_from_watchlist: {
    description: 'Hisseni takip listesinden kaldırır',
    parameters: { symbol: 'string' },
  },
  web_search: {
    description: 'Web\'de arama yapar, güncel haberler ve bilgiler getirir',
    parameters: { query: 'string - Arama sorgusu' },
  },
  read_document: {
    description: 'Web sayfası veya doküman okur, içeriği çıkarır',
    parameters: { url: 'string - Okunacak URL' },
  },
  read_txt_file: {
    description: 'TXT dosyası içeriğini okur ve analiz eder. Kullanıcının yüklediği rapor, analiz veya metin dosyalarını işler.',
    parameters: { content: 'string - TXT dosyasının içeriği', filename: 'string - Dosya adı (opsiyonel)' },
  },
  get_kap_data: {
    description: 'KAP (Kamu Aydınlatma Platformu) bildirimlerini getirir',
    parameters: { symbol: 'string - Hisse kodu (opsiyonel)' },
  },
  scan_market: {
    description: 'Tüm piyasayı tarar, sektör bazlı analiz yapar',
    parameters: { industry: 'string - Sektör adı (opsiyonel)' },
  },
  get_top_gainers: {
    description: 'Günün en çok yükselen hisselerini getirir',
    parameters: { limit: 'number - Kaç hisse (varsayılan: 10)' },
  },
  get_top_losers: {
    description: 'Günün en çok düşen hisselerini getirir',
    parameters: { limit: 'number - Kaç hisse (varsayılan: 10)' },
  },
  get_price_alerts: {
    description: 'Kullanıcının fiyat bildirimlerini listeler',
    parameters: {},
  },
  create_price_alert: {
    description: 'Fiyat bildirimi oluşturur',
    parameters: { symbol: 'string', targetPrice: 'number', condition: '"above" | "below"' },
  },
  analyze_chart_image: {
    description: 'Hisse grafiği veya finansal grafik görselini VLM ile analiz eder. Trend, destek/direnç, formasyon tespiti yapar.',
    parameters: { imageBase64: 'string - Base64 encoded image', symbol: 'string - Hisse kodu (opsiyonel)' },
  },
};

// Tools that require explicit user confirmation before execution
const CONFIRMATION_REQUIRED_TOOLS = ['add_to_watchlist', 'remove_from_watchlist', 'create_price_alert'];

interface PendingAction {
  tool: string;
  params: Record<string, unknown>;
  description: string;
}

function describePendingAction(tool: string, params: Record<string, unknown>): string {
  switch (tool) {
    case 'add_to_watchlist':
      return `**${params.symbol}** hissesini takip listesine ekle`;
    case 'remove_from_watchlist':
      return `**${params.symbol}** hissesini takip listesinden çıkar`;
    case 'create_price_alert':
      return `**${params.symbol}** için ${params.targetPrice} TL ${params.condition === 'above' ? 'üzerine çıkınca' : 'altına inince'} bildirim oluştur`;
    default:
      return tool;
  }
}

// Stock price cache
const stockPriceCache: Record<string, { data: unknown; timestamp: number }> = {};
const CACHE_TTL = 60000; // 1 minute

async function getStockPrice(symbol: string) {
  const cached = stockPriceCache[symbol];
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    const response = await fetch(`https://api.asenax.com/bist/get/${symbol.toUpperCase()}`);
    const data = await response.json();
    
    if (data.code === "0" && data.data?.hisseYuzeysel) {
      const d = data.data.hisseYuzeysel;
      const result = {
        success: true,
        data: {
          symbol: d.sembol,
          name: d.aciklama,
          price: d.kapanis,
          change: d.net,
          changePercent: d.yuzdedegisim,
          volume: d.hacimlot,
          high: d.yuksek,
          low: d.dusuk,
          open: d.acilis,
          previousClose: d.dunkukapanis,
          ceiling: d.tavan,
          floor: d.taban,
        },
      };
      stockPriceCache[symbol] = { data: result, timestamp: Date.now() };
      return result;
    }
    return { success: false, error: 'Hisse bulunamadı' };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

async function getStockHistory(symbol: string, period: string = '1M') {
  try {
    const rangeMap: Record<string, number> = {
      '1M': 30, '3M': 90, '6M': 180, '1Y': 365, '3Y': 1095, '5Y': 1825,
    };
    const days = rangeMap[period] || 30;
    
    const response = await fetch(
      `https://internal-api.z.ai/external/finance/v1/markets/stock/history?symbol=${symbol.toUpperCase()}.IS&interval=1d`,
      { headers: { 'X-Z-AI-From': 'Z' } }
    );
    
    const data = await response.json();
    const now = Date.now() / 1000;
    const cutoff = now - (days * 24 * 60 * 60);
    
    if (data.body) {
      const historical = Object.values(data.body as Record<string, {
        date: string;
        date_utc: number;
        open: number;
        high: number;
        low: number;
        close: number;
        volume: number;
      }>)
        .filter((e) => e.date_utc >= cutoff)
        .map((e) => ({
          date: e.date,
          open: e.open,
          high: e.high,
          low: e.low,
          close: e.close,
          volume: e.volume,
        }));
      
      // Calculate technical indicators
      const closes = historical.map(h => h.close);
      const sma20 = closes.length >= 20 ? closes.slice(-20).reduce((a, b) => a + b, 0) / 20 : null;
      const sma50 = closes.length >= 50 ? closes.slice(-50).reduce((a, b) => a + b, 0) / 50 : null;
      
      return { 
        success: true, 
        data: historical, 
        count: historical.length,
        indicators: { sma20, sma50 },
        trend: sma20 && sma50 ? (sma20 > sma50 ? 'BULLISH' : 'BEARISH') : 'NEUTRAL',
      };
    }
    return { success: false, error: 'Veri bulunamadı' };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Web search fallback for stock price when API is unavailable
async function webSearchForPrice(symbol: string) {
  try {
    const zai = await ZAI.create();
    const query = `${symbol} hisse fiyat bugün BIST borsa TL`;
    const results = await zai.functions.invoke('web_search', { query, num: 3 });
    const items = extractSearchContent(results);
    return {
      success: true,
      note: 'Asenax API erişilemedi — web aramasından elde edildi',
      searchResults: items.slice(0, 3),
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Enhanced stock price: API + web fallback + 1M history summary + user status
async function getStockPriceEnhanced(symbol: string, userId: string | null) {
  const sym = symbol.toUpperCase();

  // Step 1: API price (with cache)
  const apiResult = await getStockPrice(sym) as {
    success: boolean;
    data?: Record<string, unknown>;
    error?: string;
  };

  let priceData: Record<string, unknown> | null = null;
  let priceSource = 'api';

  if (apiResult.success && apiResult.data) {
    priceData = apiResult.data;
  } else {
    // Step 2: Fallback to web search
    priceSource = 'web_search_fallback';
    const webResult = await webSearchForPrice(sym) as {
      success: boolean;
      note?: string;
      searchResults?: unknown[];
      error?: string;
    };
    if (webResult.success) {
      priceData = {
        symbol: sym,
        note: webResult.note,
        searchResults: webResult.searchResults,
      };
    }
  }

  // Step 3: 1-month historical summary (parallel with step 4)
  const [histResult, watchlistItem, activeAlerts] = await Promise.all([
    getStockHistory(sym, '1M') as Promise<{
      success: boolean;
      data?: Array<{ date: string; close: number; high: number; low: number; volume: number }>;
      indicators?: { sma20: number | null; sma50: number | null };
      trend?: string;
    }>,
    userId
      ? prisma.watchlistItem.findFirst({ where: { symbol: sym, userId } })
      : Promise.resolve(null),
    userId
      ? prisma.priceAlert.findMany({ where: { symbol: sym, userId, active: true } })
      : Promise.resolve([]),
  ]);

  let historicalSummary: Record<string, unknown> | null = null;
  if (histResult.success && histResult.data && histResult.data.length > 0) {
    const closes = histResult.data.map(d => d.close);
    const highs = histResult.data.map(d => d.high);
    const lows = histResult.data.map(d => d.low);
    const first = closes[0];
    const last = closes[closes.length - 1];
    historicalSummary = {
      period: '1M',
      dataPoints: histResult.data.length,
      firstClose: first,
      lastClose: last,
      monthChangePercent: first ? +((last - first) / first * 100).toFixed(2) : null,
      high1M: Math.max(...highs),
      low1M: Math.min(...lows),
      sma20: histResult.indicators?.sma20 ? +histResult.indicators.sma20.toFixed(2) : null,
      sma50: histResult.indicators?.sma50 ? +histResult.indicators.sma50.toFixed(2) : null,
      trend: histResult.trend || 'NEUTRAL',
    };
  }

  // Step 4: User status for this symbol
  const userStatus = userId
    ? {
        isInWatchlist: !!watchlistItem,
        addedAt: watchlistItem?.createdAt ?? null,
        targetPrice: watchlistItem?.targetPrice ?? null,
        activeAlerts: activeAlerts.map(a => ({
          targetPrice: a.targetPrice,
          condition: a.condition,
          triggered: a.triggered,
        })),
        alertCount: activeAlerts.length,
      }
    : { isInWatchlist: false, note: 'Giriş yapılmamış' };

  return {
    success: !!priceData,
    priceSource,
    data: priceData,
    historical: historicalSummary,
    userStatus,
  };
}

async function getWatchlist(userId: string | null) {
  try {
    const items = await prisma.watchlistItem.findMany({ 
      where: userId ? { userId } : { userId: null },
      orderBy: { createdAt: 'desc' } 
    });
    return { success: true, data: items, count: items.length };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

async function addToWatchlist(symbol: string, name: string, userId: string | null) {
  try {
    const existing = await prisma.watchlistItem.findFirst({
      where: { symbol: symbol.toUpperCase(), userId: userId || null },
    });
    if (existing) return { success: false, error: 'Bu hisse zaten takip listesinde' };
    
    const item = await prisma.watchlistItem.create({
      data: { symbol: symbol.toUpperCase(), name, userId: userId || null },
    });
    return { success: true, data: item };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

async function removeFromWatchlist(symbol: string, userId: string | null) {
  try {
    await prisma.watchlistItem.deleteMany({ 
      where: { symbol: symbol.toUpperCase(), userId: userId || null } 
    });
    return { success: true, message: `${symbol} takip listesinden kaldırıldı` };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

async function webSearch(query: string) {
  try {
    const zai = await ZAI.create();
    const results = await zai.functions.invoke('web_search', { query, num: 5 });
    return { success: true, data: results };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Step 1: LLM generates better search queries
async function generateSearchQueries(userMessage: string): Promise<string[]> {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY || process.env.GROQ_API_KEY || ''}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Sen bir arama uzmanısın. Kullanıcının sorusunu daha iyi web aramaları için optimize et.
BIST, hisse, finans ve Türk piyasası konularında uzmanlaşmışsın.
JSON formatında sadece 2-3 arama sorgusu döndür. Başka açıklama yapma.
Örnek: {"queries": ["THYAO hisse analiz 2024", "Türk Hava Yolları KAP bildirimi", "THYAO teknik analiz"]}`
          },
          {
            role: 'user',
            content: `Şu soru için en iyi 2-3 arama sorgusunu üret: "${userMessage}"`
          }
        ],
        temperature: 0.3,
        max_tokens: 200,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed.queries) && parsed.queries.length > 0) {
          return parsed.queries.slice(0, 3);
        }
      }
    }
  } catch (_e) {
    // Fallback to original message
  }
  return [userMessage];
}

// Step 2: Extract title + paragraphs from raw search results
function extractSearchContent(rawResults: unknown): Array<{ title: string; snippet: string; url?: string }> {
  if (!rawResults) return [];
  const items: Array<{ title: string; snippet: string; url?: string }> = [];

  const tryExtract = (obj: unknown) => {
    if (!obj || typeof obj !== 'object') return;
    const o = obj as Record<string, unknown>;

    if (typeof o.title === 'string' || typeof o.snippet === 'string' || typeof o.description === 'string') {
      items.push({
        title: (o.title || o.name || '') as string,
        snippet: (o.snippet || o.description || o.content || o.body || '') as string,
        url: (o.url || o.link || o.href || '') as string,
      });
      return;
    }

    for (const val of Object.values(o)) {
      if (Array.isArray(val)) {
        for (const item of val) tryExtract(item);
      } else if (val && typeof val === 'object') {
        tryExtract(val);
      }
    }
  };

  tryExtract(rawResults);
  return items.filter(i => i.title || i.snippet).slice(0, 6);
}

// Step 3: Summarize extracted content with gpt-4o-mini
async function summarizeSearchResults(
  items: Array<{ title: string; snippet: string; url?: string }>,
  userMessage: string
): Promise<string> {
  if (items.length === 0) return 'Arama sonucu bulunamadı.';

  const itemsText = items
    .map((item, i) => `[${i + 1}] Başlık: ${item.title}\nİçerik: ${item.snippet.slice(0, 300)}${item.url ? `\nKaynak: ${item.url}` : ''}`)
    .join('\n\n');

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY || process.env.GROQ_API_KEY || ''}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Sen bir haber ve finans analiz asistanısın. Verilen arama sonuçlarını kullanıcının sorusuyla ilişkilendirerek özetle.
Sadece başlık ve paragraf bilgilerini kullan. Kaynaklara atıfta bulun. Türkçe yanıt ver.`
          },
          {
            role: 'user',
            content: `Kullanıcı sorusu: "${userMessage}"\n\nArama sonuçları:\n${itemsText}\n\nBu sonuçları kullanıcı sorusuyla ilgili şekilde özetle.`
          }
        ],
        temperature: 0.5,
        max_tokens: 1000,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return data.choices?.[0]?.message?.content || itemsText;
    }
  } catch (_e) {
    // Fallback to raw items
  }

  return items.map(i => `• **${i.title}**: ${i.snippet}`).join('\n');
}

// Enhanced web search: query generation → parallel search → extract → summarize
async function enhancedWebSearch(userMessage: string) {
  try {
    console.log('🔍 [enhancedWebSearch] Sorgular üretiliyor...');
    const queries = await generateSearchQueries(userMessage);
    console.log('🔍 [enhancedWebSearch] Üretilen sorgular:', queries);

    const zai = await ZAI.create();

    // Parallel search for all queries
    const searchPromises = queries.map(q =>
      zai.functions.invoke('web_search', { query: q, num: 5 }).catch(() => null)
    );
    const rawResults = await Promise.all(searchPromises);

    // Extract title + paragraphs from all results
    const allItems: Array<{ title: string; snippet: string; url?: string }> = [];
    for (const raw of rawResults) {
      if (raw) allItems.push(...extractSearchContent(raw));
    }

    // Deduplicate by title
    const seen = new Set<string>();
    const uniqueItems = allItems.filter(item => {
      const key = item.title.slice(0, 60);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    console.log(`🔍 [enhancedWebSearch] ${uniqueItems.length} sonuç bulundu, özetleniyor...`);

    // Summarize
    const summary = await summarizeSearchResults(uniqueItems, userMessage);

    return {
      success: true,
      data: {
        queries,
        items: uniqueItems,
        summary,
      },
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

async function readDocument(url: string) {
  try {
    const zai = await ZAI.create();
    const result = await zai.functions.invoke('page_reader', { url });
    return { 
      success: true, 
      data: {
        title: result.data?.title,
        content: result.data?.html?.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').slice(0, 3000),
        url,
      },
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

async function getKapData(symbol?: string) {
  try {
    const zai = await ZAI.create();
    const query = symbol 
      ? `${symbol} hisse KAP bildirim Kamu Aydınlatma Platformu son`
      : 'BIST KAP bildirimler Kamu Aydınlatma Platformu bugün önemli';
    
    const results = await zai.functions.invoke('web_search', { query, num: 10 });
    return { success: true, data: results, source: 'KAP Search' };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Market scanner with all stock prices
let marketCache: { data: unknown; timestamp: number } | null = null;
const MARKET_CACHE_TTL = 120000; // 2 minutes

async function scanMarket(industry?: string) {
  if (marketCache && Date.now() - marketCache.timestamp < MARKET_CACHE_TTL) {
    return marketCache.data;
  }

  try {
    // Get stock list
    const listResponse = await fetch('https://api.asenax.com/bist/list');
    const listData = await listResponse.json();
    
    let stocks: { code: string; name: string }[] = [];
    if (listData.code === "0" && Array.isArray(listData.data)) {
      stocks = listData.data
        .filter((item: { tip?: string }) => item.tip === "Hisse")
        .map((item: { kod?: string; ad?: string }) => ({ code: item.kod, name: item.ad }));
    }
    
    // Batch fetch prices
    const results: Array<{
      code: string;
      name: string;
      price: number;
      changePercent: number;
      volume: number;
      high: number;
      low: number;
    }> = [];
    
    const toFetch = stocks.slice(0, 100);
    
    // Parallel fetch in batches
    const batchSize = 20;
    for (let i = 0; i < toFetch.length; i += batchSize) {
      const batch = toFetch.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async (stock) => {
          const priceData = await getStockPrice(stock.code);
          if (priceData.success && priceData.data.price > 0) {
            return {
              code: stock.code,
              name: stock.name,
              ...priceData.data,
            };
          }
          return null;
        })
      );
      results.push(...batchResults.filter(Boolean) as typeof results);
    }
    
    // Sort and categorize
    const sorted = results.sort((a, b) => b.changePercent - a.changePercent);
    
    const result = { 
      success: true, 
      data: {
        all: sorted,
        gainers: sorted.filter(s => s.changePercent > 0).slice(0, 15),
        losers: sorted.filter(s => s.changePercent < 0).sort((a, b) => a.changePercent - b.changePercent).slice(0, 15),
        total: sorted.length,
        avgChange: sorted.reduce((a, b) => a + b.changePercent, 0) / sorted.length,
      },
    };
    
    marketCache = { data: result, timestamp: Date.now() };
    return result;
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

async function getTopGainers(limit: number = 10) {
  const marketData = await scanMarket();
  if (marketData.success && marketData.data) {
    return { success: true, data: marketData.data.gainers.slice(0, limit) };
  }
  return { success: false, error: 'Veri alınamadı' };
}

async function getTopLosers(limit: number = 10) {
  const marketData = await scanMarket();
  if (marketData.success && marketData.data) {
    return { success: true, data: marketData.data.losers.slice(0, limit) };
  }
  return { success: false, error: 'Veri alınamadı' };
}

async function getPriceAlerts(userId: string | null) {
  try {
    const alerts = await prisma.priceAlert.findMany({
      where: { active: true, userId: userId || null },
      orderBy: { createdAt: 'desc' },
    });
    return { success: true, data: alerts, count: alerts.length };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

async function createPriceAlert(symbol: string, targetPrice: number, condition: 'above' | 'below', userId: string | null) {
  try {
    const alert = await prisma.priceAlert.create({
      data: { symbol: symbol.toUpperCase(), targetPrice, condition, userId: userId || null },
    });
    return { success: true, data: alert };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// TXT File Analysis
async function readTxtFile(content: string, filename?: string) {
  try {
    // Analyze the TXT content using gpt-4o-mini
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY || process.env.GROQ_API_KEY || ''}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Sen profesyonel bir finansal analiz asistanısın. Kullanıcının yüklediği TXT dosyasını analiz et ve:
1. Dosyanın içeriğini özetle
2. Finansal veriler varsa analiz et
3. Önemli noktaları vurgula
4. Varsa hisse senedi kodlarını tespit et
5. Yatırımcı için önemli bilgileri çıkar

Türkçe yanıt ver ve profesyonel bir rapor formatı kullan.`
          },
          {
            role: 'user',
            content: `Dosya adı: ${filename || 'bilinmiyor'}\n\nDosya içeriği:\n\`\`\`\n${content.slice(0, 5000)}\n\`\`\`\n\nBu dosyayı analiz et ve raporla.`
          }
        ],
        temperature: 0.3,
        max_tokens: 1200,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return {
        success: true,
        analysis: data.choices?.[0]?.message?.content,
        filename,
        contentLength: content.length,
      };
    }

    return { success: false, error: 'Analiz başarısız' };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Chart Image Analysis with VLM
async function analyzeChartImage(imageBase64: string, symbol?: string) {
  try {
    const zai = await ZAI.create();
    
    const prompt = `Sen profesyonel bir teknik analiz uzmanısın. Bu finansal grafiği detaylı şekilde analiz et ve:

📊 **GENEL GÖRÜNÜM**
- Grafik türünü belirle (çubuk, çizgi, mum vs.)
- Zaman aralığını tahmin et
- Genel trend yönü (yükseliş, düşüş, yatay)

📈 **TEKNİK ANALİZ**
- Destek seviyeleri (varsa)
- Direnç seviyeleri (varsa)
- Trend çizgileri
- Formasyonlar (bayrak, omuz-baş-omuz, üçgen vs.)

📉 **GÖSTERGELER** (görünürse)
- Hareketli ortalamalar
- Hacim analizi
- RSI/MACD benzeri göstergeler

⚠️ **RİSK DEĞERLENDİRMESİ**
- Güncel pozisyon değerlendirmesi
- Olası senaryolar
- Risk noktaları

💡 **SONUÇ**
- Kısa vadeli görünüm
- Orta vadeli görünüm
- Dikkat edilmesi gerekenler

${symbol ? `Hisse: ${symbol}` : ''}

Not: Bu analiz yatırım tavsiyesi değildir, sadece teknik analiz özetidir.`;

    const response = await zai.chat.completions.createVision({
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: imageBase64.startsWith('data:') ? imageBase64 : `data:image/png;base64,${imageBase64}` } }
          ]
        }
      ],
      thinking: { type: 'disabled' }
    });

    return {
      success: true,
      analysis: response.choices?.[0]?.message?.content,
      symbol,
    };
  } catch (error) {
    console.error('VLM Error:', error);
    return { success: false, error: String(error) };
  }
}

// Tool Executor
async function executeTool(toolName: string, params: Record<string, unknown>, userId: string | null) {
  const startTime = Date.now();
  let result;
  
  switch (toolName) {
    case 'get_stock_price':
      result = await getStockPriceEnhanced(params.symbol as string, userId);
      break;
    case 'get_stock_history':
      result = await getStockHistory(params.symbol as string, params.period as string);
      break;
    case 'get_watchlist':
      result = await getWatchlist(userId);
      break;
    case 'add_to_watchlist':
      result = await addToWatchlist(params.symbol as string, params.name as string, userId);
      break;
    case 'remove_from_watchlist':
      result = await removeFromWatchlist(params.symbol as string, userId);
      break;
    case 'web_search':
      result = await enhancedWebSearch(params.query as string);
      break;
    case 'read_document':
      result = await readDocument(params.url as string);
      break;
    case 'get_kap_data':
      result = await getKapData(params.symbol as string | undefined);
      break;
    case 'scan_market':
      result = await scanMarket(params.industry as string | undefined);
      break;
    case 'get_top_gainers':
      result = await getTopGainers(params.limit as number | undefined);
      break;
    case 'get_top_losers':
      result = await getTopLosers(params.limit as number | undefined);
      break;
    case 'get_price_alerts':
      result = await getPriceAlerts(userId);
      break;
    case 'create_price_alert':
      result = await createPriceAlert(
        params.symbol as string,
        params.targetPrice as number,
        params.condition as 'above' | 'below',
        userId
      );
      break;
    case 'read_txt_file':
      result = await readTxtFile(params.content as string, params.filename as string | undefined);
      break;
    case 'analyze_chart_image':
      result = await analyzeChartImage(params.imageBase64 as string, params.symbol as string | undefined);
      break;
    default:
      result = { success: false, error: `Bilinmeyen tool: ${toolName}` };
  }
  
  return {
    ...result,
    _meta: { tool: toolName, duration: Date.now() - startTime },
  };
}

// Intelligent Tool Selector - Determines which tools to use based on user query
function selectToolsForQuery(message: string): {
  tools: string[];
  params: Record<string, Record<string, unknown>>;
  queryType: string;
  queryMeta: Record<string, unknown>;
} {
  const lowerMessage = message.toLowerCase();
  const tools: string[] = [];
  const params: Record<string, Record<string, unknown>> = {};

  // Extract stock symbols
  const symbolMatches = message.match(/\b([A-Z]{3,5})\b/g) || [];
  const upperMessage = message.toUpperCase();
  const additionalMatches = upperMessage.match(/([A-Z]{3,5})/g) || [];
  const allMatches = [...symbolMatches, ...additionalMatches];
  const symbols = [...new Set(allMatches.map(s => s.toUpperCase()))].filter(s =>
    s.length >= 3 && s.length <= 5 && /^[A-Z]+$/.test(s)
  );

  console.log('🔍 Extracted symbols:', symbols);

  // Extract budget amount (e.g. "50000 lira", "10k TL", "50 bin")
  const budgetMatch = message.match(/(\d[\d.,]*)\s*(bin\s*)?(lira|tl|₺)/i);
  const budgetAmount = budgetMatch
    ? parseFloat(budgetMatch[1].replace(/\./g, '').replace(',', '.')) *
      (budgetMatch[2] ? 1000 : 1)
    : null;

  // Extract time period for predictions (e.g. "30 gün", "2 hafta", "3 ay")
  const periodMatch = message.match(/(\d+)\s*(gün|hafta|ay)/i);
  const periodDays = periodMatch
    ? parseInt(periodMatch[1]) *
      (periodMatch[2].startsWith('hafta') ? 7 : periodMatch[2].startsWith('ay') ? 30 : 1)
    : null;

  // ── Query type detection (priority order) ───────────────────────────────

  // 1. PRICE PREDICTION: "X gün sonra", "tahmin", "ne olur", "kaç olur"
  const isPricePrediction = /tahmin|tahmini\s*fiyat|\bgün sonra\b|hafta sonra|ay sonra|kaç olur|ne olur|fiyat.*ne|öngörü/i.test(message);

  // 2. SELL DECISION: "satmalı mıyım", "satsam mı", "satayım mı"
  const isSellDecision = /satmal[ıi]\s*m[ıi]y[ıi]m|satmal[ıi]\s*m[ıi]|satsam\s*m[ıi]|satay[ıi]m\s*m[ıi]|sat\s*m[ıi]y[ıi]m|elden\s*ç[ıi]karsam|sat[a-z]*\s*m[ıi]/i.test(message);

  // 3. BUDGET ADVICE: "X lira param var", "X TL yatırım", no specific stock action
  const isBudgetAdvice = budgetAmount !== null &&
    /param\s*var|yatıracağım|yatırsam|ne\s*(yapmalı|yapmali|almalı|almali)|yatırım\s*(yapmalı|tavsiye|öneri)/i.test(message);

  // ── Tool selection per query type ────────────────────────────────────────

  if (isPricePrediction && symbols.length > 0) {
    for (const symbol of symbols) {
      tools.push('get_stock_price');
      params[`get_stock_price_${symbol}`] = { symbol };
      tools.push('get_stock_history');
      params[`get_stock_history_${symbol}`] = { symbol, period: '1Y' };
      tools.push('get_kap_data');
      params[`get_kap_data_${symbol}`] = { symbol };
      tools.push('web_search');
      params[`web_search_pred_${symbol}`] = {
        query: `${symbol} hisse hedef fiyat analist tahmin 2025`,
      };
    }
    return { tools: [...new Set(tools)], params, queryType: 'price_prediction', queryMeta: { symbols, periodDays } };
  }

  if (isSellDecision && symbols.length > 0) {
    for (const symbol of symbols) {
      tools.push('get_stock_price');
      params[`get_stock_price_${symbol}`] = { symbol };
      tools.push('get_stock_history');
      params[`get_stock_history_${symbol}`] = { symbol, period: '6M' };
      tools.push('get_kap_data');
      params[`get_kap_data_${symbol}`] = { symbol };
      tools.push('web_search');
      params[`web_search_sell_${symbol}`] = {
        query: `${symbol} hisse sat analiz hedef fiyat 2025`,
      };
    }
    return { tools: [...new Set(tools)], params, queryType: 'sell_decision', queryMeta: { symbols } };
  }

  if (isBudgetAdvice) {
    tools.push('scan_market');
    params['scan_market'] = {};
    tools.push('get_top_gainers');
    params['get_top_gainers'] = { limit: 10 };
    tools.push('get_top_losers');
    params['get_top_losers'] = { limit: 10 };
    tools.push('web_search');
    params['web_search_budget'] = {
      query: `BIST yatırım fırsatları portföy önerisi ${budgetAmount ? budgetAmount + ' TL' : ''}`,
    };
    return { tools: [...new Set(tools)], params, queryType: 'budget_advice', queryMeta: { budgetAmount } };
  }

  // === PORTFOLIO/HOLD QUESTIONS (with specific stock) ===
  if ((lowerMessage.includes('ne yapmalı') || lowerMessage.includes('ne yapmali') ||
       lowerMessage.includes('tutmalı') || lowerMessage.includes('alsam mı') ||
       lowerMessage.includes('portföy') || lowerMessage.includes('lot')) && symbols.length > 0) {
    for (const symbol of symbols) {
      tools.push('get_stock_price');
      params[`get_stock_price_${symbol}`] = { symbol };
      tools.push('get_stock_history');
      params[`get_stock_history_${symbol}`] = { symbol, period: '3M' };
      tools.push('get_kap_data');
      params[`get_kap_data_${symbol}`] = { symbol };
      tools.push('web_search');
      params[`web_search_${symbol}`] = { query: `${symbol} hisse analiz haber yorum` };
    }
    return { tools: [...new Set(tools)], params, queryType: 'portfolio_question', queryMeta: { symbols } };
  }

  // === WHERE TO INVEST TODAY ===
  if (lowerMessage.includes('nereye') || lowerMessage.includes('yatırım') ||
      lowerMessage.includes('öneri') || lowerMessage.includes('hangi hisse') ||
      lowerMessage.includes('bugün ne')) {
    tools.push('scan_market');
    params['scan_market'] = {};
    tools.push('get_top_gainers');
    params['get_top_gainers'] = { limit: 10 };
    tools.push('get_top_losers');
    params['get_top_losers'] = { limit: 10 };
    tools.push('get_kap_data');
    params['get_kap_data'] = {};
    tools.push('web_search');
    params['web_search_market'] = { query: 'BIST borsa piyasa analiz bugün öneri' };
    return { tools: [...new Set(tools)], params, queryType: 'market_overview', queryMeta: {} };
  }

  // === ANALYSIS REQUESTS ===
  if (lowerMessage.includes('analiz') || lowerMessage.includes('incel') || lowerMessage.includes('detay')) {
    if (symbols.length > 0) {
      for (const symbol of symbols) {
        tools.push('get_stock_price');
        params[`get_stock_price_${symbol}`] = { symbol };
        tools.push('get_stock_history');
        params[`get_stock_history_${symbol}`] = { symbol, period: '6M' };
        tools.push('get_kap_data');
        params[`get_kap_data_${symbol}`] = { symbol };
      }
    } else {
      tools.push('scan_market');
      params['scan_market'] = {};
    }
    return { tools: [...new Set(tools)], params, queryType: 'analysis', queryMeta: { symbols } };
  }

  // === WATCHLIST OPERATIONS ===
  if (lowerMessage.includes('takip') || lowerMessage.includes('listem') || lowerMessage.includes('watchlist')) {
    if (lowerMessage.includes('ekle') || lowerMessage.includes('kaydet')) {
      for (const symbol of symbols) {
        tools.push('get_stock_price');
        params[`get_stock_price_${symbol}`] = { symbol };
        tools.push('add_to_watchlist');
        params[`add_to_watchlist_${symbol}`] = { symbol, name: '' };
      }
    } else if (lowerMessage.includes('kaldır') || lowerMessage.includes('sil') || lowerMessage.includes('çıkar')) {
      for (const symbol of symbols) {
        tools.push('remove_from_watchlist');
        params[`remove_from_watchlist_${symbol}`] = { symbol };
      }
    } else {
      tools.push('get_watchlist');
      params['get_watchlist'] = {};
    }
    return { tools: [...new Set(tools)], params, queryType: 'watchlist', queryMeta: { symbols } };
  }

  // === ALERTS ===
  if (lowerMessage.includes('bildirim') || lowerMessage.includes('alarm') || lowerMessage.includes('uyarı')) {
    if (lowerMessage.includes('oluştur') || lowerMessage.includes('kur') || lowerMessage.includes('ayarla')) {
      const priceMatch = message.match(/(\d+[.,]?\d*)/);
      const targetPrice = priceMatch ? parseFloat(priceMatch[1].replace(',', '.')) : null;
      const condition = lowerMessage.includes('üzer') || lowerMessage.includes('yukarı') ? 'above' : 'below';
      if (targetPrice) {
        for (const symbol of symbols) {
          tools.push('create_price_alert');
          params[`create_price_alert_${symbol}`] = { symbol, targetPrice, condition };
        }
      }
    } else {
      tools.push('get_price_alerts');
      params['get_price_alerts'] = {};
    }
    return { tools: [...new Set(tools)], params, queryType: 'alert', queryMeta: { symbols } };
  }

  // === GAINERS / LOSERS ===
  if (lowerMessage.includes('yükselen') || lowerMessage.includes('kazandıran') || lowerMessage.includes('en çok')) {
    tools.push('get_top_gainers');
    params['get_top_gainers'] = { limit: 15 };
    tools.push('scan_market');
    params['scan_market'] = {};
    return { tools: [...new Set(tools)], params, queryType: 'gainers', queryMeta: {} };
  }
  if (lowerMessage.includes('düşen') || lowerMessage.includes('kaybettiren') || lowerMessage.includes('kaybeden')) {
    tools.push('get_top_losers');
    params['get_top_losers'] = { limit: 15 };
    tools.push('scan_market');
    params['scan_market'] = {};
    return { tools: [...new Set(tools)], params, queryType: 'losers', queryMeta: {} };
  }

  // === KAP ===
  if (lowerMessage.includes('kap') || lowerMessage.includes('açıklama')) {
    tools.push('get_kap_data');
    params['get_kap_data'] = symbols.length > 0 ? { symbol: symbols[0] } : {};
    return { tools: [...new Set(tools)], params, queryType: 'kap', queryMeta: { symbols } };
  }

  // === MARKET SCAN ===
  if (lowerMessage.includes('piyasa') || lowerMessage.includes('bist') || lowerMessage.includes('borsa') || lowerMessage.includes('sektör')) {
    tools.push('scan_market');
    params['scan_market'] = {};
    tools.push('get_top_gainers');
    params['get_top_gainers'] = { limit: 10 };
    tools.push('get_top_losers');
    params['get_top_losers'] = { limit: 10 };
    return { tools: [...new Set(tools)], params, queryType: 'market_scan', queryMeta: {} };
  }

  // === NEWS ===
  if (lowerMessage.includes('haber') || lowerMessage.includes('son')) {
    tools.push('web_search');
    params['web_search'] = { query: message };
    if (symbols.length > 0) {
      tools.push('get_kap_data');
      params['get_kap_data'] = { symbol: symbols[0] };
    }
    return { tools: [...new Set(tools)], params, queryType: 'news', queryMeta: { symbols } };
  }

  // === SPECIFIC STOCK ===
  if (symbols.length > 0) {
    for (const symbol of symbols) {
      tools.push('get_stock_price');
      params[`get_stock_price_${symbol}`] = { symbol };
    }
    return { tools: [...new Set(tools)], params, queryType: 'stock_price', queryMeta: { symbols } };
  }

  // === GENERAL ===
  tools.push('scan_market');
  params['scan_market'] = {};
  return { tools: [...new Set(tools)], params, queryType: 'general', queryMeta: {} };
}

// Builds a compact text representation of tool results for the final LLM
// For web_search, uses the pre-generated summary instead of raw items to save tokens
function buildToolResultsText(toolResults: Record<string, unknown>): string {
  const parts: string[] = [];

  for (const [tool, result] of Object.entries(toolResults)) {
    const r = result as { success: boolean; data?: unknown; error?: string; _meta?: unknown };
    if (!r.success) {
      parts.push(`### ${tool}\nHata: ${r.error}`);
      continue;
    }

    if (tool === 'web_search') {
      const d = r.data as { queries?: string[]; summary?: string; items?: unknown[] } | null;
      if (d) {
        const queriesText = d.queries ? `Kullanılan Sorgular: ${d.queries.join(' | ')}` : '';
        const summaryText = d.summary || '';
        parts.push(`### web_search\n${queriesText}\n\n${summaryText}`);
      }
    } else if (tool === 'get_stock_price') {
      const enhanced = result as {
        success: boolean;
        priceSource?: string;
        data?: unknown;
        historical?: Record<string, unknown> | null;
        userStatus?: Record<string, unknown> | null;
      };
      const lines: string[] = [`### get_stock_price (kaynak: ${enhanced.priceSource || 'api'})`];
      if (enhanced.data) {
        lines.push('**Fiyat Verisi:**\n' + JSON.stringify(enhanced.data, null, 2).slice(0, 400));
      }
      if (enhanced.historical) {
        const h = enhanced.historical;
        lines.push(
          `**1 Aylık Özet:** ${h.monthChangePercent}% değişim | Trend: ${h.trend} | ` +
          `SMA20: ${h.sma20} | SMA50: ${h.sma50} | 1M Yüksek: ${h.high1M} | 1M Düşük: ${h.low1M}`
        );
      }
      if (enhanced.userStatus) {
        const u = enhanced.userStatus as { isInWatchlist?: boolean; addedAt?: unknown; targetPrice?: unknown; alertCount?: number; note?: string };
        if (u.isInWatchlist) {
          lines.push(
            `**Kullanıcı Durumu:** Takip listesinde ✓ | ` +
            `Eklenme: ${u.addedAt} | Hedef fiyat: ${u.targetPrice ?? 'yok'} | Aktif alert: ${u.alertCount ?? 0}`
          );
        } else {
          lines.push(`**Kullanıcı Durumu:** Takip listesinde değil${u.note ? ` (${u.note})` : ''}`);
        }
      }
      parts.push(lines.join('\n'));
    } else {
      parts.push(`### ${tool}\n${JSON.stringify(r.data, null, 2).slice(0, 800)}`);
    }
  }

  return parts.join('\n\n');
}

// AI Agent Handler
export async function POST(request: NextRequest) {
  try {
    // Get current user
    const userId = await getCurrentUserId();
    
    const body = await request.json();
    const {
      message,
      conversationHistory = [],
      txtContent,
      txtFilename,
      imageBase64,
      imageSymbol,
      confirmActions,   // PendingAction[] — user approved these actions
    } = body;

    if (!message && !txtContent && !imageBase64 && !confirmActions) {
      return NextResponse.json({ success: false, error: 'Mesaj, dosya veya resim gerekli' }, { status: 400 });
    }

    // ── Confirmed actions path ────────────────────────────────────────────
    if (confirmActions && Array.isArray(confirmActions) && confirmActions.length > 0) {
      console.log('✅ Confirmed actions:', confirmActions.map((a: PendingAction) => a.tool));
      const toolResults: Record<string, unknown> = {};

      for (const action of confirmActions as PendingAction[]) {
        const result = await executeTool(action.tool, action.params, userId);
        toolResults[action.tool] = result;
      }

      const successList = (confirmActions as PendingAction[])
        .map(a => `• ${a.description}`)
        .join('\n');

      const responseText = `✅ **İşlemler tamamlandı:**\n${successList}`;

      if ((confirmActions as PendingAction[]).some(a =>
        a.tool.includes('watchlist') || a.tool.includes('alert')
      )) {
        // Signal frontend to refresh watchlist/alerts
      }

      return NextResponse.json({
        success: true,
        response: responseText,
        toolsUsed: (confirmActions as PendingAction[]).map(a => a.tool),
        toolResults,
        timestamp: new Date().toISOString(),
      });
    }
    // ─────────────────────────────────────────────────────────────────────

    console.log('📥 User message:', message);

    // Handle TXT file upload
    if (txtContent) {
      console.log('📄 TXT file uploaded:', txtFilename);
      const result = await readTxtFile(txtContent, txtFilename);
      
      return NextResponse.json({
        success: true,
        response: result.success ? result.analysis : `Hata: ${result.error}`,
        toolsUsed: ['read_txt_file'],
        toolResults: { read_txt_file: result },
        timestamp: new Date().toISOString(),
      });
    }

    // Handle image analysis
    if (imageBase64) {
      console.log('🖼️ Image uploaded for analysis');
      const result = await analyzeChartImage(imageBase64, imageSymbol);
      
      return NextResponse.json({
        success: true,
        response: result.success ? result.analysis : `Hata: ${result.error}`,
        toolsUsed: ['analyze_chart_image'],
        toolResults: { analyze_chart_image: result },
        timestamp: new Date().toISOString(),
      });
    }

    // Intelligent tool selection
    const { tools, params, queryType, queryMeta } = selectToolsForQuery(message);
    console.log('🎯 Query type:', queryType, '| Meta:', queryMeta);

    // Separate immediate tools from those requiring user confirmation
    const immediateTools = tools.filter(t => !CONFIRMATION_REQUIRED_TOOLS.includes(t));
    const pendingActions: PendingAction[] = tools
      .filter(t => CONFIRMATION_REQUIRED_TOOLS.includes(t))
      .map(t => ({
        tool: t,
        params: params[t] || params[Object.keys(params).find(k => k.startsWith(t)) ?? ''] || {},
        description: describePendingAction(
          t,
          params[t] || params[Object.keys(params).find(k => k.startsWith(t)) ?? ''] || {}
        ),
      }));

    console.log('🔧 Immediate tools:', immediateTools);
    console.log('⏳ Pending (needs confirmation):', pendingActions.map(a => a.tool));

    // Execute only immediate tools in parallel
    const toolResults: Record<string, unknown> = {};
    const executionPromises = immediateTools.map(async (tool) => {
      const toolParams = params[tool] || params[Object.keys(params).find(k => k.startsWith(tool)) ?? ''] || {};
      const result = await executeTool(tool, toolParams, userId);
      return { tool, result };
    });

    const results = await Promise.all(executionPromises);
    for (const { tool, result } of results) {
      toolResults[tool] = result;
    }

    // ── Build query-type-specific user prompt ────────────────────────────
    const pendingNote = pendingActions.length > 0
      ? `\n\nBEKLEYEN İŞLEMLER (onay soracaksın):\n${pendingActions.map(a => `- ${a.description}`).join('\n')}`
      : '';

    let userPromptContent = '';

    if (queryType === 'price_prediction') {
      const { symbols: syms, periodDays: days } = queryMeta as { symbols: string[]; periodDays: number | null };
      userPromptContent = `Kullanıcı Sorusu: "${message}"
Hisse: ${syms.join(', ')} | Süre: ${days ? days + ' gün' : 'belirtilmedi'}

Araç Sonuçları:
${buildToolResultsText(toolResults)}

THREAD FORMAT: Yanıtını "|||" ile ayırdığın 3 kısa mesaj olarak ver:
Mesaj 1 — 📈 Mevcut durum + trend (3-4 madde, kısa)
Mesaj 2 — 🎯 Analist hedefleri + tahmin senaryoları
Mesaj 3 — ⚠️ Risk faktörleri + not${pendingNote}`;
    } else if (queryType === 'sell_decision') {
      const { symbols: syms } = queryMeta as { symbols: string[] };
      userPromptContent = `Kullanıcı Sorusu: "${message}"
Hisse: ${syms.join(', ')}

Araç Sonuçları:
${buildToolResultsText(toolResults)}

THREAD FORMAT: Yanıtını "|||" ile ayırdığın 3 kısa mesaj olarak ver:
Mesaj 1 — 📊 Fiyat durumu + son performans (3-4 madde)
Mesaj 2 — 🔍 Teknik ve temel sinyaller (güçlü/zayıf noktalar)
Mesaj 3 — 💡 Sonuç değerlendirmesi (yatırım tavsiyesi değil, sadece analiz) + not${pendingNote}`;
    } else if (queryType === 'budget_advice') {
      const { budgetAmount: budget } = queryMeta as { budgetAmount: number | null };
      userPromptContent = `Kullanıcı Sorusu: "${message}"
Bütçe: ${budget ? budget.toLocaleString('tr-TR') + ' TL' : 'belirtilmedi'}

Araç Sonuçları:
${buildToolResultsText(toolResults)}

THREAD FORMAT: Yanıtını "|||" ile ayırdığın 3 kısa mesaj olarak ver:
Mesaj 1 — 💰 Piyasa durumu + fırsat özeti (3-4 madde)
Mesaj 2 — 📋 Sektör dağılımı önerisi${budget ? ` (${budget.toLocaleString('tr-TR')} TL için)` : ''} + öne çıkan hisseler
Mesaj 3 — ⚠️ Risk uyarısı + not${pendingNote}`;
    } else {
      userPromptContent = `Kullanıcı Sorusu: "${message}"

Araç Sonuçları:
${buildToolResultsText(toolResults)}

THREAD FORMAT: Yanıtını "|||" ile ayırdığın 2-3 kısa mesaj olarak ver. Her mesaj kısa ve odaklı olsun.${pendingNote}`;
    }

    const systemPrompt = `Sen profesyonel bir BIST hisse analiz asistanısın. Türkçe yanıt ver.
Yatırım TAVSİYESİ VERME, sadece ANALİZ yap. Emoji kullan ama abartma. Her mesaj maksimum 5 madde içersin.
Yanıtı MUTLAKA şu formatta döndür:

[thread mesajları "|||" ile ayrılmış]
SORULAR: soru1 | soru2 | soru3

Örnek:
📊 İlk mesaj içeriği ||| 🔍 İkinci mesaj içeriği ||| ⚠️ Üçüncü mesaj içeriği
SORULAR: GARAN 3 ay sonraki fiyatı ne olur? | AKBNK ile karşılaştırır mısın? | Temettü verimi nedir?

"SORULAR:" satırı her zaman son satır olmalı, 3 kısa Türkçe soru içermeli.`;

    const finalResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY || process.env.GROQ_API_KEY || ''}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          ...conversationHistory.slice(-4).map((m: { role: string; content: string }) => ({
            role: m.role,
            content: m.content,
          })),
          { role: 'user', content: userPromptContent },
        ],
        temperature: 0.7,
        max_tokens: 1500,
      }),
    });

    let rawText = '';

    if (finalResponse.ok) {
      const finalData = await finalResponse.json();
      rawText = finalData.choices?.[0]?.message?.content || '';
    } else {
      rawText = `İşlem tamamlandı. Araçlar: ${immediateTools.join(', ')}`;
    }

    // Extract "SORULAR:" line for suggested questions
    let suggestedQuestions: string[] = [];
    let cleanText = rawText;
    const soruMatch = rawText.match(/\nSOROLAR:\s*(.+)$|SORULAR:\s*(.+)$/m);
    if (soruMatch) {
      const soruStr = soruMatch[1] || soruMatch[2] || '';
      suggestedQuestions = soruStr
        .split('|')
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 5);
      cleanText = rawText.replace(/\nSOROLAR:.+$|SORULAR:.+$/m, '').trim();
    }

    // Split into thread messages on "|||"
    const messages = cleanText
      .split('|||')
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0);

    return NextResponse.json({
      success: true,
      response: messages[0] || rawText,   // backwards compat
      messages,                            // thread messages
      suggestedQuestions,
      toolsUsed: immediateTools,
      toolResults,
      pendingActions: pendingActions.length > 0 ? pendingActions : undefined,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Agent error:', error);
    return NextResponse.json({
      success: false,
      error: 'Bir hata oluştu. Lütfen tekrar deneyin.',
    }, { status: 500 });
  }
}

// GET endpoint for tool list
export async function GET() {
  return NextResponse.json({
    success: true,
    tools: TOOLS,
    count: Object.keys(TOOLS).length,
  });
}
