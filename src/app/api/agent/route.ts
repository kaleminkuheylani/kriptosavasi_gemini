import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';
import { cookies } from 'next/headers';
import { serverClient } from '@/lib/supabase';

// ─── Supabase client helper (uses user's session JWT for RLS) ────────────────
async function getAgentSupabaseClient() {
  const cs = await cookies();
  const token = cs.get('sb-access-token')?.value ?? null;
  return { sb: serverClient(token), token };
}

// ─── Rate Limiting ────────────────────────────────────────────────────────────
// In-memory for per-minute sliding window (too granular for DB)
// Daily token budget is persisted in Supabase user_usage table

interface RpmEntry { requests: number[] }
const rpmStore = new Map<string, RpmEntry>();

const LIMITS = {
  user:  { rpm: 15, dailyTokens: 60_000 },
  guest: { rpm:  5, dailyTokens: 15_000 },
};

const LEGAL_DISCLAIMER =
  'Yasal Sorumluluk Notu: Bu içerik yalnızca bilgilendirme amaçlıdır. Verilecek tüm yatırım kararları ile doğabilecek hukuki ve mali sorumluluk tamamen kullanıcıya aittir.';

/** Per-minute sliding window — checked synchronously, no DB needed */
function checkRpm(userId: string | null): boolean {
  const key = userId || 'guest';
  const limits = userId ? LIMITS.user : LIMITS.guest;
  if (!rpmStore.has(key)) rpmStore.set(key, { requests: [] });
  const entry = rpmStore.get(key)!;
  const now = Date.now();
  entry.requests = entry.requests.filter(t => now - t < 60_000);
  const over = entry.requests.length >= limits.rpm;
  entry.requests.push(now);
  return over; // true = throttled
}

/**
 * Check + record daily usage in Supabase user_usage table.
 * Returns { throttled, maxTokens }.
 * Falls back to unthrottled on DB error so users aren't blocked by Supabase issues.
 */
async function checkAndRecordUsage(
  userId: string | null,
  sb: ReturnType<typeof serverClient>,
): Promise<{ throttled: boolean; maxTokens: number }> {
  const limits = userId ? LIMITS.user : LIMITS.guest;

  // Guests: no DB tracking, just RPM
  if (!userId) {
    return { throttled: false, maxTokens: 1500 };
  }

  try {
    const today = new Date().toISOString().slice(0, 10);

    const { data: row } = await sb
      .from('user_usage')
      .select('request_count, token_count')
      .eq('user_id', userId)
      .eq('date', today)
      .maybeSingle();

    const requestCount = (row?.request_count ?? 0) as number;
    const tokenCount   = (row?.token_count   ?? 0) as number;

    // Increment request counter
    await sb.from('user_usage').upsert(
      { user_id: userId, date: today, request_count: requestCount + 1, token_count: tokenCount },
      { onConflict: 'user_id,date' }
    );

    if (tokenCount >= limits.dailyTokens) return { throttled: true,  maxTokens: 0   };
    if (requestCount >= limits.rpm * 10)  return { throttled: false, maxTokens: 400 }; // soft
    return { throttled: false, maxTokens: 1500 };
  } catch {
    return { throttled: false, maxTokens: 1500 }; // fail open
  }
}

async function recordTokenUsage(
  userId: string | null,
  tokens: number,
  sb: ReturnType<typeof serverClient>,
) {
  if (!userId || tokens <= 0) return;
  try {
    const today = new Date().toISOString().slice(0, 10);
    const { data: row } = await sb
      .from('user_usage')
      .select('token_count')
      .eq('user_id', userId)
      .eq('date', today)
      .maybeSingle();

    const prev = (row?.token_count ?? 0) as number;
    await sb.from('user_usage').upsert(
      { user_id: userId, date: today, token_count: prev + tokens },
      { onConflict: 'user_id,date' }
    );
  } catch { /* ignore */ }
}
// ─────────────────────────────────────────────────────────────────────────────

/** Get the authenticated Supabase user id from the session cookie */
async function getCurrentUserId(): Promise<string | null> {
  const cs = await cookies();
  const token = cs.get('sb-access-token')?.value ?? null;
  if (!token) return null;
  try {
    const { data: { user } } = await serverClient(token).auth.getUser();
    return user?.id ?? null;
  } catch { return null; }
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
  analyze_portfolio: {
    description: 'Kullanıcının tüm takip listesi hisselerini analiz eder. Güncel fiyat, toplam değer, en iyi/kötü performer, portföy özeti döndürür.',
    parameters: {},
  },
  compare_stocks: {
    description: '2-5 hisseyi yan yana karşılaştırır: fiyat, günlük değişim, 1 aylık trend, hacim, SMA göstergeleri.',
    parameters: { symbols: 'string[] - Karşılaştırılacak hisse kodları (örn: ["THYAO","GARAN","AKBNK"])' },
  },
  technical_indicators: {
    description: 'Hisse için teknik göstergeleri hesaplar: RSI(14), SMA(20/50), Bollinger Bands. Gösterge bazlı durum özeti üretir.',
    parameters: { symbol: 'string - Hisse kodu', period: 'string - 1M|3M|6M (varsayılan: 3M)' },
  },
  get_economic_calendar: {
    description: 'Yaklaşan TCMB faiz kararları, BIST önemli açıklamalar, şirket bilanço takvimini getirir.',
    parameters: { days: 'number - Önümüzdeki kaç gün (varsayılan: 30)' },
  },
  stock_screener: {
    description: 'Kriterlere göre hisse filtreler ve tarar. Değişim yönü, hacim, fiyat aralığı, sektöre göre filtreleme yapar.',
    parameters: {
      minChange: 'number - Minimum değişim yüzdesi (örn: 2 = %2 üzeri yükselenler)',
      maxChange: 'number - Maksimum değişim yüzdesi',
      minVolume: 'number - Minimum işlem hacmi (lot)',
      sector:    'string - Sektör filtresi (opsiyonel)',
    },
  },
  deep_mathematical_analysis: {
    description: 'Hisse için kapsamlı matematiksel derinlik analizi yapar: MACD, Stochastic Oscillator, ATR (volatilite), Fibonacci seviyeleri, Williams %R, CCI, Momentum/ROC, Yıllıklaştırılmış Volatilite, OBV (hacim-bazlı akış) ve Bileşik Durum skoru hesaplar.',
    parameters: {
      symbol: 'string - Hisse kodu',
      period: 'string - Veri periyodu 3M|6M|1Y (varsayılan: 6M)',
    },
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

  // Step 3: 1-month historical summary + user status (parallel)
  const sbClient = serverClient(await (async () => {
    const cs = await cookies();
    return cs.get('sb-access-token')?.value ?? null;
  })());

  const [histResult, wlRow, alertRows] = await Promise.all([
    getStockHistory(sym, '1M') as Promise<{
      success: boolean;
      data?: Array<{ date: string; close: number; high: number; low: number; volume: number }>;
      indicators?: { sma20: number | null; sma50: number | null };
      trend?: string;
    }>,
    userId
      ? sbClient.from('watchlist_items').select('*').eq('user_id', userId).eq('symbol', sym).maybeSingle()
      : Promise.resolve({ data: null }),
    userId
      ? sbClient.from('price_alerts').select('*').eq('user_id', userId).eq('symbol', sym).eq('active', true)
      : Promise.resolve({ data: [] }),
  ]);

  const watchlistItem = wlRow.data as Record<string, unknown> | null;
  const activeAlerts  = (alertRows.data ?? []) as Array<Record<string, unknown>>;

  let historicalSummary: Record<string, unknown> | null = null;
  if (histResult.success && histResult.data && histResult.data.length > 0) {
    const closes = histResult.data.map(d => d.close);
    const highs  = histResult.data.map(d => d.high);
    const lows   = histResult.data.map(d => d.low);
    const first  = closes[0];
    const last   = closes[closes.length - 1];
    historicalSummary = {
      period: '1M',
      dataPoints: histResult.data.length,
      firstClose: first,
      lastClose:  last,
      monthChangePercent: first ? +((last - first) / first * 100).toFixed(2) : null,
      high1M: Math.max(...highs),
      low1M:  Math.min(...lows),
      sma20: histResult.indicators?.sma20 ? +histResult.indicators.sma20.toFixed(2) : null,
      sma50: histResult.indicators?.sma50 ? +histResult.indicators.sma50.toFixed(2) : null,
      trend: histResult.trend || 'NEUTRAL',
    };
  }

  const userStatus = userId
    ? {
        isInWatchlist: !!watchlistItem,
        addedAt:       watchlistItem?.created_at ?? null,
        targetPrice:   watchlistItem?.target_price ?? null,
        activeAlerts:  activeAlerts.map(a => ({
          targetPrice: a.target_price,
          condition:   a.condition,
          triggered:   a.triggered,
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
  if (!userId) return { success: true, data: [], count: 0 };
  try {
    const cs = await cookies();
    const token = cs.get('sb-access-token')?.value ?? null;
    const sb = serverClient(token);
    const { data, error } = await sb
      .from('watchlist_items')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return { success: true, data: data ?? [], count: data?.length ?? 0 };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

async function addToWatchlist(symbol: string, name: string, userId: string | null) {
  if (!userId) return { success: false, error: 'Giriş yapmanız gerekli' };
  try {
    const normalizedSymbol = String(symbol || '').trim().toUpperCase();
    if (!/^[A-Z0-9.-]{1,15}$/.test(normalizedSymbol)) {
      return { success: false, error: 'Geçerli bir hisse kodu gerekli' };
    }
    const normalizedName = typeof name === 'string' && name.trim().length > 0
      ? name.trim().slice(0, 120)
      : normalizedSymbol;

    const cs = await cookies();
    const token = cs.get('sb-access-token')?.value ?? null;
    const sb = serverClient(token);

    const { data: existing } = await sb
      .from('watchlist_items')
      .select('id')
      .eq('user_id', userId)
      .eq('symbol', normalizedSymbol)
      .maybeSingle();

    if (existing) return { success: false, error: 'Bu hisse zaten takip listesinde' };

    const { data, error } = await sb
      .from('watchlist_items')
      .insert({ user_id: userId, symbol: normalizedSymbol, name: normalizedName })
      .select()
      .single();
    if (error) {
      if ((error as { code?: string }).code === '23505') {
        return { success: false, error: 'Bu hisse zaten takip listesinde' };
      }
      throw error;
    }
    return { success: true, data };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

async function removeFromWatchlist(symbol: string, userId: string | null) {
  if (!userId) return { success: false, error: 'Giriş yapmanız gerekli' };
  try {
    const cs = await cookies();
    const token = cs.get('sb-access-token')?.value ?? null;
    const sb = serverClient(token);
    const { error } = await sb
      .from('watchlist_items')
      .delete()
      .eq('user_id', userId)
      .eq('symbol', symbol.toUpperCase());
    if (error) throw error;
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
    const zai = await ZAI.create();
    const response = await zai.chat.completions.create({
      messages: [
        {
          role: 'user' as const,
          content: `Sen bir arama uzmanısın. BIST, hisse, finans ve Türk piyasası konularında uzmanlaşmışsın.
Şu soru için en iyi 2-3 web arama sorgusunu JSON formatında üret. Başka açıklama yapma.
Format: {"queries": ["sorgu1", "sorgu2", "sorgu3"]}

Soru: "${userMessage}"`,
        }
      ],
      thinking: { type: 'disabled' },
    } as Parameters<typeof zai.chat.completions.create>[0]);

    const content = (response as { choices?: Array<{ message?: { content?: string } }> }).choices?.[0]?.message?.content || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed.queries) && parsed.queries.length > 0) {
        return parsed.queries.slice(0, 3);
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

// Step 3: Summarize extracted content
async function summarizeSearchResults(
  items: Array<{ title: string; snippet: string; url?: string }>,
  userMessage: string
): Promise<string> {
  if (items.length === 0) return 'Arama sonucu bulunamadı.';

  const itemsText = items
    .map((item, i) => `[${i + 1}] Başlık: ${item.title}\nİçerik: ${item.snippet.slice(0, 300)}${item.url ? `\nKaynak: ${item.url}` : ''}`)
    .join('\n\n');

  try {
    const zai = await ZAI.create();
    const response = await zai.chat.completions.create({
      messages: [
        {
          role: 'user' as const,
          content: `Sen bir haber ve finans analiz asistanısın. Verilen arama sonuçlarını kullanıcının sorusuyla ilişkilendirerek Türkçe özetle. Kaynaklara atıfta bulun.

Kullanıcı sorusu: "${userMessage}"

Arama sonuçları:
${itemsText}

Bu sonuçları kullanıcı sorusuyla ilgili şekilde özetle.`,
        }
      ],
      thinking: { type: 'disabled' },
    } as Parameters<typeof zai.chat.completions.create>[0]);

    const content = (response as { choices?: Array<{ message?: { content?: string } }> }).choices?.[0]?.message?.content || '';
    if (content) return content;
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
  if (!userId) return { success: true, data: [], count: 0 };
  try {
    const cs = await cookies();
    const token = cs.get('sb-access-token')?.value ?? null;
    const sb = serverClient(token);
    const { data, error } = await sb
      .from('price_alerts')
      .select('*')
      .eq('active', true)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return { success: true, data: data ?? [], count: data?.length ?? 0 };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

async function createPriceAlert(symbol: string, targetPrice: number, condition: 'above' | 'below', userId: string | null) {
  if (!userId) return { success: false, error: 'Giriş yapmanız gerekli' };
  try {
    const cs = await cookies();
    const token = cs.get('sb-access-token')?.value ?? null;
    const sb = serverClient(token);
    const { data, error } = await sb
      .from('price_alerts')
      .insert({ user_id: userId, symbol: symbol.toUpperCase(), target_price: targetPrice, condition })
      .select()
      .single();
    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// TXT File Analysis
async function readTxtFile(content: string, filename?: string) {
  try {
    const zai = await ZAI.create();
    const response = await zai.chat.completions.create({
      messages: [
        {
          role: 'user' as const,
          content: `Sen profesyonel bir finansal analiz asistanısın. Aşağıdaki TXT dosyasını analiz et:
1. Dosyanın içeriğini özetle
2. Finansal veriler varsa analiz et
3. Önemli noktaları vurgula
4. Varsa hisse senedi kodlarını tespit et
5. Yatırımcı için önemli bilgileri çıkar

Türkçe yanıt ver ve profesyonel rapor formatı kullan.

Dosya adı: ${filename || 'bilinmiyor'}

Dosya içeriği:
\`\`\`
${content.slice(0, 5000)}
\`\`\``,
        }
      ],
      thinking: { type: 'disabled' },
    } as Parameters<typeof zai.chat.completions.create>[0]);

    const analysis = (response as { choices?: Array<{ message?: { content?: string } }> }).choices?.[0]?.message?.content;
    if (analysis) {
      return { success: true, analysis, filename, contentLength: content.length };
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

Not: Bu analiz yatırım tavsiyesi değildir, sadece teknik analiz özetidir. ${LEGAL_DISCLAIMER}`;

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

// ─── New Tool Implementations ─────────────────────────────────────────────────

async function analyzePortfolio(userId: string | null) {
  try {
    const watchlistResult = await getWatchlist(userId) as { success: boolean; data?: Array<{ symbol: string; name: string; targetPrice?: number | null }> };
    if (!watchlistResult.success || !watchlistResult.data || watchlistResult.data.length === 0) {
      return { success: false, error: 'Takip listesi boş veya alınamadı' };
    }
    const items = watchlistResult.data;

    // Fetch prices in parallel
    const priceResults = await Promise.all(
      items.map(async (item) => {
        const p = await getStockPrice(item.symbol) as { success: boolean; data?: Record<string, number & string> };
        return { symbol: item.symbol, name: item.name, targetPrice: item.targetPrice ?? null, price: p };
      })
    );

    const portfolio = priceResults
      .filter(r => r.price.success && r.price.data)
      .map(r => {
        const d = r.price.data as Record<string, number & string>;
        return {
          symbol: r.symbol,
          name: r.name,
          price: d.price as number,
          change: d.change as number,
          changePercent: d.changePercent as number,
          volume: d.volume as number,
          targetPrice: r.targetPrice,
          targetDiff: r.targetPrice ? +(((d.price as number) - r.targetPrice) / r.targetPrice * 100).toFixed(2) : null,
        };
      });

    if (portfolio.length === 0) return { success: false, error: 'Fiyat verisi alınamadı' };

    const sorted = [...portfolio].sort((a, b) => b.changePercent - a.changePercent);
    const avgChange = portfolio.reduce((s, p) => s + p.changePercent, 0) / portfolio.length;

    return {
      success: true,
      data: {
        items: portfolio,
        count: portfolio.length,
        bestPerformer: sorted[0],
        worstPerformer: sorted[sorted.length - 1],
        avgChangePercent: +avgChange.toFixed(2),
        gainers: portfolio.filter(p => p.changePercent > 0).length,
        losers:  portfolio.filter(p => p.changePercent < 0).length,
      },
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

async function compareStocks(symbols: string[]) {
  if (!symbols || symbols.length < 2) return { success: false, error: 'En az 2 hisse kodu gerekli' };
  const syms = symbols.slice(0, 5).map(s => s.toUpperCase());

  try {
    const results = await Promise.all(syms.map(async (sym) => {
      const [priceRes, histRes] = await Promise.all([
        getStockPrice(sym) as Promise<{ success: boolean; data?: Record<string, number & string> }>,
        getStockHistory(sym, '1M') as Promise<{ success: boolean; data?: Array<{ close: number }>; indicators?: { sma20: number | null; sma50: number | null }; trend?: string }>,
      ]);

      const price = priceRes.success && priceRes.data ? priceRes.data : null;
      const hist = histRes.success && histRes.data && histRes.data.length > 0 ? histRes.data : null;
      const monthChange = hist
        ? +(((hist[hist.length - 1].close - hist[0].close) / hist[0].close) * 100).toFixed(2)
        : null;

      return {
        symbol: sym,
        price:         price?.price ?? null,
        change:        price?.change ?? null,
        changePercent: price?.changePercent ?? null,
        volume:        price?.volume ?? null,
        high:          price?.high ?? null,
        low:           price?.low ?? null,
        monthChange,
        sma20:  histRes.indicators?.sma20 ?? null,
        trend:  histRes.trend ?? 'NEUTRAL',
      };
    }));

    return { success: true, data: results, count: results.length };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

function calcTechnicalIndicators(closes: number[]) {
  if (closes.length < 20) return null;

  // SMA
  const sma20 = closes.slice(-20).reduce((a, b) => a + b, 0) / 20;
  const sma50 = closes.length >= 50 ? closes.slice(-50).reduce((a, b) => a + b, 0) / 50 : null;

  // RSI(14)
  const changes = closes.slice(-15).map((c, i, arr) => (i === 0 ? 0 : c - arr[i - 1]));
  const gains = changes.filter(c => c > 0);
  const losses = changes.filter(c => c < 0).map(c => Math.abs(c));
  const avgGain = gains.reduce((a, b) => a + b, 0) / 14;
  const avgLoss = losses.reduce((a, b) => a + b, 0) / 14;
  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  const rsi = +(100 - 100 / (1 + rs)).toFixed(2);

  // Bollinger Bands (SMA20 ± 2σ)
  const mean = sma20;
  const variance = closes.slice(-20).reduce((s, c) => s + Math.pow(c - mean, 2), 0) / 20;
  const stddev = Math.sqrt(variance);
  const bbUpper = +(mean + 2 * stddev).toFixed(2);
  const bbLower = +(mean - 2 * stddev).toFixed(2);
  const bbMiddle = +mean.toFixed(2);

  const lastClose = closes[closes.length - 1];

  // Composite educational status (no buy/sell phrasing)
  let signal = 'NÖTR';
  if (rsi < 30 && lastClose <= bbLower) signal = 'GÜÇLÜ POZİTİF MOMENTUM';
  else if (rsi < 40) signal = 'POZİTİF MOMENTUM BÖLGESİ';
  else if (rsi > 70 && lastClose >= bbUpper) signal = 'GÜÇLÜ NEGATİF MOMENTUM';
  else if (rsi > 60) signal = 'NEGATİF MOMENTUM BÖLGESİ';

  return {
    rsi,
    sma20: +sma20.toFixed(2),
    sma50: sma50 ? +sma50.toFixed(2) : null,
    bbUpper,
    bbMiddle,
    bbLower,
    lastClose: +lastClose.toFixed(2),
    signal,
    trendVsSma20: lastClose > sma20 ? 'ÜSTÜNDE' : 'ALTINDA',
    trendVsSma50: sma50 ? (lastClose > sma50 ? 'ÜSTÜNDE' : 'ALTINDA') : null,
  };
}

async function technicalIndicators(symbol: string, period: string = '3M') {
  try {
    const histResult = await getStockHistory(symbol.toUpperCase(), period) as {
      success: boolean;
      data?: Array<{ close: number; high: number; low: number; volume: number }>;
    };

    if (!histResult.success || !histResult.data || histResult.data.length < 20) {
      return { success: false, error: 'Yeterli veri yok (min 20 gün gerekli)' };
    }

    const closes = histResult.data.map(d => d.close);
    const highs = histResult.data.map(d => d.high);
    const lows = histResult.data.map(d => d.low);
    const volumes = histResult.data.map(d => d.volume);

    const indicators = calcTechnicalIndicators(closes);
    if (!indicators) return { success: false, error: 'Gösterge hesaplanamadı' };

    const deep = calcDeepMathIndicators(closes, highs, lows, volumes);

    return { success: true, symbol: symbol.toUpperCase(), period, data: { ...indicators, ...deep } };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// ─── Deep Mathematical Analysis Functions ──────────────────────────────────────

function calcEMA(data: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const ema = [data[0]];
  for (let i = 1; i < data.length; i++) {
    ema.push(data[i] * k + ema[i - 1] * (1 - k));
  }
  return ema;
}

function calcMACDIndicator(closes: number[]) {
  if (closes.length < 35) return null;
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  const macdLine = ema12.map((v, i) => v - ema26[i]);
  const signalLine = calcEMA(macdLine.slice(25), 9);
  const lastMACD = macdLine[macdLine.length - 1];
  const lastSignal = signalLine[signalLine.length - 1];
  const prevMACD = macdLine[macdLine.length - 2];
  const prevSignal = signalLine[signalLine.length - 2];
  const histogram = lastMACD - lastSignal;
  let crossSignal: string | null = null;
  if (prevMACD < prevSignal && lastMACD > lastSignal) crossSignal = 'BULLISH_KESIŞIM';
  else if (prevMACD > prevSignal && lastMACD < lastSignal) crossSignal = 'BEARISH_KESIŞIM';
  return {
    macdLine: +lastMACD.toFixed(3),
    signalLine: +lastSignal.toFixed(3),
    histogram: +histogram.toFixed(3),
    trend: lastMACD > lastSignal ? 'YUKARI' : 'AŞAĞI',
    crossSignal,
  };
}

function calcStochasticIndicator(highs: number[], lows: number[], closes: number[], period = 14) {
  if (closes.length < period) return null;
  const highestHigh = Math.max(...highs.slice(-period));
  const lowestLow = Math.min(...lows.slice(-period));
  const lastClose = closes[closes.length - 1];
  const k = highestHigh === lowestLow ? 50 : +((lastClose - lowestLow) / (highestHigh - lowestLow) * 100).toFixed(2);
  let signal = 'NÖTR';
  if (k < 20) signal = 'AŞIRI DÜŞÜK BÖLGE';
  else if (k > 80) signal = 'AŞIRI YÜKSEK BÖLGE';
  return { k, signal };
}

function calcATRIndicator(highs: number[], lows: number[], closes: number[], period = 14) {
  if (closes.length < period + 1) return null;
  const trueRanges: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const tr = Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1]));
    trueRanges.push(tr);
  }
  const atr = trueRanges.slice(-period).reduce((a, b) => a + b, 0) / period;
  const lastClose = closes[closes.length - 1];
  return { atr: +atr.toFixed(2), atrPercent: +(atr / lastClose * 100).toFixed(2) };
}

function calcFibonacciLevels(closes: number[]) {
  const lookback = Math.min(closes.length, 90);
  const high = Math.max(...closes.slice(-lookback));
  const low = Math.min(...closes.slice(-lookback));
  const diff = high - low;
  return {
    high: +high.toFixed(2),
    low: +low.toFixed(2),
    r236: +(high - diff * 0.236).toFixed(2),
    r382: +(high - diff * 0.382).toFixed(2),
    r500: +(high - diff * 0.500).toFixed(2),
    r618: +(high - diff * 0.618).toFixed(2),
    r786: +(high - diff * 0.786).toFixed(2),
  };
}

function calcWilliamsR(highs: number[], lows: number[], closes: number[], period = 14) {
  if (closes.length < period) return null;
  const highestHigh = Math.max(...highs.slice(-period));
  const lowestLow = Math.min(...lows.slice(-period));
  const lastClose = closes[closes.length - 1];
  const r = highestHigh === lowestLow ? -50 : +((highestHigh - lastClose) / (highestHigh - lowestLow) * -100).toFixed(2);
  let signal = 'NÖTR';
  if (r > -20) signal = 'AŞIRI YÜKSEK BÖLGE';
  else if (r < -80) signal = 'AŞIRI DÜŞÜK BÖLGE';
  return { value: r, signal };
}

function calcCCIIndicator(highs: number[], lows: number[], closes: number[], period = 20) {
  if (closes.length < period) return null;
  const typicals = Array.from({ length: period }, (_, i) => {
    const idx = closes.length - period + i;
    return (highs[idx] + lows[idx] + closes[idx]) / 3;
  });
  const mean = typicals.reduce((a, b) => a + b, 0) / period;
  const meanDev = typicals.reduce((s, t) => s + Math.abs(t - mean), 0) / period;
  const lastTypical = (highs[highs.length - 1] + lows[lows.length - 1] + closes[closes.length - 1]) / 3;
  const cci = meanDev === 0 ? 0 : +((lastTypical - mean) / (0.015 * meanDev)).toFixed(2);
  let signal = 'NÖTR';
  if (cci > 100) signal = 'AŞIRI YÜKSEK BÖLGE';
  else if (cci < -100) signal = 'AŞIRI DÜŞÜK BÖLGE';
  return { value: cci, signal };
}

function calcMomentumROC(closes: number[], period = 10) {
  if (closes.length < period + 1) return null;
  const roc = +((closes[closes.length - 1] - closes[closes.length - 1 - period]) / closes[closes.length - 1 - period] * 100).toFixed(2);
  return { roc, trend: roc > 0 ? 'POZİTİF' : 'NEGATİF' };
}

function calcAnnualizedVolatility(closes: number[]) {
  if (closes.length < 2) return null;
  const returns = closes.slice(1).map((c, i) => Math.log(c / closes[i]));
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((s, r) => s + Math.pow(r - mean, 2), 0) / returns.length;
  const annualVol = +(Math.sqrt(variance) * Math.sqrt(252) * 100).toFixed(2);
  let level = 'ORTA';
  if (annualVol < 20) level = 'DÜŞÜK';
  else if (annualVol > 50) level = 'YÜKSEK';
  return { annualVolatility: annualVol, level };
}

function calcOBVIndicator(closes: number[], volumes: number[]) {
  if (closes.length < 2) return null;
  let obv = 0;
  const obvSeries: number[] = [0];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > closes[i - 1]) obv += volumes[i];
    else if (closes[i] < closes[i - 1]) obv -= volumes[i];
    obvSeries.push(obv);
  }
  // OBV EMA trend
  const recentOBV = obvSeries.slice(-20);
  const obvTrend = recentOBV[recentOBV.length - 1] > recentOBV[0] ? 'POZİTİF' : 'NEGATİF';
  return { obv: Math.round(obv), trend: obvTrend };
}

function calcDeepMathIndicators(closes: number[], highs: number[], lows: number[], volumes: number[]) {
  const macd = calcMACDIndicator(closes);
  const stochastic = calcStochasticIndicator(highs, lows, closes);
  const atr = calcATRIndicator(highs, lows, closes);
  const fibonacci = calcFibonacciLevels(closes);
  const williamsR = calcWilliamsR(highs, lows, closes);
  const cci = calcCCIIndicator(highs, lows, closes);
  const momentum = calcMomentumROC(closes);
  const volatility = calcAnnualizedVolatility(closes);
  const obv = calcOBVIndicator(closes, volumes);

  // Composite signal scoring
  let bullSignals = 0, bearSignals = 0;
  if (macd?.trend === 'YUKARI') bullSignals++; else if (macd?.trend === 'AŞAĞI') bearSignals++;
  if (stochastic?.signal === 'AŞIRI DÜŞÜK BÖLGE') bullSignals++; else if (stochastic?.signal === 'AŞIRI YÜKSEK BÖLGE') bearSignals++;
  if (williamsR?.signal === 'AŞIRI DÜŞÜK BÖLGE') bullSignals++; else if (williamsR?.signal === 'AŞIRI YÜKSEK BÖLGE') bearSignals++;
  if (cci?.signal === 'AŞIRI DÜŞÜK BÖLGE') bullSignals++; else if (cci?.signal === 'AŞIRI YÜKSEK BÖLGE') bearSignals++;
  if (momentum?.trend === 'POZİTİF') bullSignals++; else if (momentum?.trend === 'NEGATİF') bearSignals++;
  if (obv?.trend === 'POZİTİF') bullSignals++; else if (obv?.trend === 'NEGATİF') bearSignals++;

  let compositeSignal = 'NÖTR';
  if (bullSignals >= 4) compositeSignal = 'GÜÇLÜ POZİTİF MOMENTUM';
  else if (bullSignals >= 3) compositeSignal = 'POZİTİF MOMENTUM';
  else if (bearSignals >= 4) compositeSignal = 'GÜÇLÜ NEGATİF MOMENTUM';
  else if (bearSignals >= 3) compositeSignal = 'NEGATİF MOMENTUM';

  return { macd, stochastic, atr, fibonacci, williamsR, cci, momentum, volatility, obv, compositeSignal, bullSignals, bearSignals };
}

async function deepMathematicalAnalysis(symbol: string, period: string = '6M') {
  try {
    const histResult = await getStockHistory(symbol.toUpperCase(), period) as {
      success: boolean;
      data?: Array<{ close: number; high: number; low: number; volume: number }>;
    };

    if (!histResult.success || !histResult.data || histResult.data.length < 20) {
      return { success: false, error: 'Yeterli veri yok (min 20 gün gerekli)' };
    }

    const closes = histResult.data.map(d => d.close);
    const highs = histResult.data.map(d => d.high);
    const lows = histResult.data.map(d => d.low);
    const volumes = histResult.data.map(d => d.volume);

    const base = calcTechnicalIndicators(closes);
    const deep = calcDeepMathIndicators(closes, highs, lows, volumes);

    return {
      success: true,
      symbol: symbol.toUpperCase(),
      period,
      dataPoints: closes.length,
      data: { ...base, ...deep },
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

async function getEconomicCalendar(days: number = 30) {
  try {
    const zai = await ZAI.create();
    const queries = [
      `TCMB faiz kararı tarihi ${new Date().getFullYear()}`,
      `BIST şirket bilanço açıklama takvimi önümüzdeki ${days} gün`,
      `Türkiye ekonomi takvim enflasyon TUIK açıklama`,
    ];
    const results = await Promise.all(
      queries.map(q => zai.functions.invoke('web_search', { query: q, num: 3 }).catch(() => null))
    );
    return {
      success: true,
      data: { queries, results: results.filter(Boolean), daysAhead: days },
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

async function stockScreener(params: {
  minChange?: number;
  maxChange?: number;
  minVolume?: number;
  sector?: string;
}) {
  try {
    const marketData = await scanMarket() as {
      success: boolean;
      data?: {
        all: Array<{ code: string; name: string; price: number; changePercent: number; volume: number }>;
      };
    };

    if (!marketData.success || !marketData.data?.all) {
      return { success: false, error: 'Piyasa verisi alınamadı' };
    }

    let stocks = marketData.data.all;

    if (params.minChange !== undefined) stocks = stocks.filter(s => s.changePercent >= params.minChange!);
    if (params.maxChange !== undefined) stocks = stocks.filter(s => s.changePercent <= params.maxChange!);
    if (params.minVolume !== undefined) stocks = stocks.filter(s => s.volume >= params.minVolume!);

    const top = stocks.slice(0, 20);
    return {
      success: true,
      data: {
        matches: top,
        count: top.length,
        totalScanned: marketData.data.all.length,
        filters: params,
      },
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// ─────────────────────────────────────────────────────────────────────────────

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
    case 'analyze_portfolio':
      result = await analyzePortfolio(userId);
      break;
    case 'compare_stocks':
      result = await compareStocks(params.symbols as string[]);
      break;
    case 'technical_indicators':
      result = await technicalIndicators(params.symbol as string, params.period as string | undefined);
      break;
    case 'get_economic_calendar':
      result = await getEconomicCalendar(params.days as number | undefined);
      break;
    case 'stock_screener':
      result = await stockScreener(params as { minChange?: number; maxChange?: number; minVolume?: number; sector?: string });
      break;
    case 'deep_mathematical_analysis':
      result = await deepMathematicalAnalysis(params.symbol as string, params.period as string | undefined);
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
        query: `${symbol} hisse teknik veri raporu 2025`,
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
        query: `${symbol} hisse risk getiri analizi 2025`,
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
      query: `BIST sektor dagilimi risk yonetimi egitim ${budgetAmount ? budgetAmount + ' TL' : ''}`,
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

  // === PORTFOLIO ANALYSIS ===
  if (lowerMessage.includes('portföy') && (lowerMessage.includes('analiz') || lowerMessage.includes('durum') || lowerMessage.includes('takip'))) {
    tools.push('analyze_portfolio');
    params['analyze_portfolio'] = {};
    return { tools, params, queryType: 'portfolio_analysis', queryMeta: {} };
  }

  // === STOCK COMPARISON ===
  if ((lowerMessage.includes('karşılaştır') || lowerMessage.includes('vs') || lowerMessage.includes('farkı')) && symbols.length >= 2) {
    tools.push('compare_stocks');
    params['compare_stocks'] = { symbols };
    return { tools, params, queryType: 'comparison', queryMeta: { symbols } };
  }

  // === DEEP MATHEMATICAL ANALYSIS ===
  if ((lowerMessage.includes('derin analiz') || lowerMessage.includes('matematiksel') || lowerMessage.includes('macd') || lowerMessage.includes('fibonacci') || lowerMessage.includes('stochastic') || lowerMessage.includes('williams') || lowerMessage.includes('atr') || lowerMessage.includes('obv') || lowerMessage.includes('cci')) && symbols.length > 0) {
    tools.push('deep_mathematical_analysis');
    params['deep_mathematical_analysis'] = { symbol: symbols[0], period: '6M' };
    tools.push('get_stock_price');
    params[`get_stock_price_${symbols[0]}`] = { symbol: symbols[0] };
    return { tools, params, queryType: 'deep_math', queryMeta: { symbols } };
  }

  // === TECHNICAL INDICATORS ===
  if ((lowerMessage.includes('rsi') || lowerMessage.includes('bollinger') || lowerMessage.includes('teknik gösterge') || lowerMessage.includes('sma')) && symbols.length > 0) {
    tools.push('technical_indicators');
    params['technical_indicators'] = { symbol: symbols[0], period: '3M' };
    tools.push('get_stock_price');
    params[`get_stock_price_${symbols[0]}`] = { symbol: symbols[0] };
    return { tools, params, queryType: 'technical', queryMeta: { symbols } };
  }

  // === ECONOMIC CALENDAR ===
  if (lowerMessage.includes('tcmb') || lowerMessage.includes('faiz kararı') || lowerMessage.includes('bilanço') || lowerMessage.includes('takvim') || lowerMessage.includes('ekonomi takvim')) {
    tools.push('get_economic_calendar');
    params['get_economic_calendar'] = { days: 30 };
    tools.push('web_search');
    params['web_search_econ'] = { query: 'TCMB BIST ekonomi takvim 2025' };
    return { tools, params, queryType: 'economic_calendar', queryMeta: {} };
  }

  // === STOCK SCREENER ===
  if (lowerMessage.includes('filtrele') || lowerMessage.includes('tara') || lowerMessage.includes('tarayıcı') ||
      (lowerMessage.includes('hacmi yüksek') && (lowerMessage.includes('yükselen') || lowerMessage.includes('düşen')))) {
    const minChangeMatch = message.match(/min.*?(%|\s)([\d.]+)/i);
    const minVolumeMatch = message.match(/hacim.*?([\d.]+)/i);
    tools.push('stock_screener');
    params['stock_screener'] = {
      minChange: lowerMessage.includes('yükselen') ? 1 : undefined,
      maxChange: lowerMessage.includes('düşen') ? -1 : undefined,
      minVolume: minVolumeMatch ? parseFloat(minVolumeMatch[1]) : undefined,
    };
    if (minChangeMatch) (params['stock_screener'] as Record<string, unknown>).minChange = parseFloat(minChangeMatch[2]);
    return { tools, params, queryType: 'screener', queryMeta: {} };
  }

  // === MARKET OVERVIEW INTENT ===
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
    params['web_search_market'] = { query: 'BIST borsa piyasa ozeti bugun' };
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

// Sanitize conversation history: merge consecutive same-role messages,
// ensure starts with user, ends with assistant (before new user message)
function sanitizeHistory(
  history: Array<{ role: string; content: string }>
): Array<{ role: 'user' | 'assistant'; content: string }> {
  const filtered = history
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => ({ role: m.role as 'user' | 'assistant', content: String(m.content || '') }));

  // Merge consecutive same-role messages (e.g. multiple assistant thread messages)
  const merged: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  for (const msg of filtered) {
    if (merged.length > 0 && merged[merged.length - 1].role === msg.role) {
      merged[merged.length - 1] = {
        role: msg.role,
        content: merged[merged.length - 1].content + '\n' + msg.content,
      };
    } else {
      merged.push({ ...msg });
    }
  }

  // Must start with user
  while (merged.length > 0 && merged[0].role !== 'user') merged.shift();

  return merged;
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

function ensureThreadLegalDisclaimer(text: string): string {
  const normalized = text.toLowerCase();
  if (normalized.includes('hukuki') && normalized.includes('kullanıcıya aittir')) {
    return text;
  }
  if (!text.trim()) return `⚖️ ${LEGAL_DISCLAIMER}`;
  return `${text.trim()} ||| ⚖️ ${LEGAL_DISCLAIMER}`;
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
      enabledTools,     // string[] — UI'dan seçilen araç kategorisi araçları
    } = body;

    if (!message && !txtContent && !imageBase64 && !confirmActions) {
      return NextResponse.json({ success: false, error: 'Mesaj, dosya veya resim gerekli' }, { status: 400 });
    }

    // ── Rate Limiting ─────────────────────────────────────────────────────
    const rpmThrottled = checkRpm(userId);
    const sb = await getAgentSupabaseClient();
    const { throttled, maxTokens: allowedTokens } = await checkAndRecordUsage(userId, sb);
    if (throttled && !rpmThrottled) {
      // Günlük bütçe tükendi — sessizce kısa yanıt ver
      return NextResponse.json({
        success: true,
        response: '📊 Şu an yoğun kullanım var, biraz sonra tekrar dene.',
        messages: ['📊 Şu an yoğun kullanım var, biraz sonra tekrar dene.'],
        suggestedQuestions: [],
        toolsUsed: [],
        timestamp: new Date().toISOString(),
      });
    }
    // ─────────────────────────────────────────────────────────────────────

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
    const { tools: rawTools, params, queryType, queryMeta } = selectToolsForQuery(message);
    console.log('🎯 Query type:', queryType, '| Meta:', queryMeta);

    // Filter tools by user-selected categories (if any)
    const tools = (enabledTools && Array.isArray(enabledTools) && enabledTools.length > 0)
      ? rawTools.filter((t: string) => enabledTools.includes(t))
      : rawTools;

    // Separate immediate tools from those requiring user confirmation
    const immediateTools = tools.filter((t: string) => !CONFIRMATION_REQUIRED_TOOLS.includes(t));
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
Mesaj 2 — 🎯 Veri temelli senaryolar (kesinlik belirtmeden)
Mesaj 3 — ⚠️ Risk faktörleri + not${pendingNote}`;
    } else if (queryType === 'sell_decision') {
      const { symbols: syms } = queryMeta as { symbols: string[] };
      userPromptContent = `Kullanıcı Sorusu: "${message}"
Hisse: ${syms.join(', ')}

Araç Sonuçları:
${buildToolResultsText(toolResults)}

THREAD FORMAT: Yanıtını "|||" ile ayırdığın 3 kısa mesaj olarak ver:
Mesaj 1 — 📊 Fiyat durumu + son performans (3-4 madde)
Mesaj 2 — 🔍 Teknik ve temel göstergelerin özeti (güçlü/zayıf noktalar)
Mesaj 3 — 🧾 Objektif sonuç değerlendirmesi + not${pendingNote}`;
    } else if (queryType === 'budget_advice') {
      const { budgetAmount: budget } = queryMeta as { budgetAmount: number | null };
      userPromptContent = `Kullanıcı Sorusu: "${message}"
Bütçe: ${budget ? budget.toLocaleString('tr-TR') + ' TL' : 'belirtilmedi'}

Araç Sonuçları:
${buildToolResultsText(toolResults)}

THREAD FORMAT: Yanıtını "|||" ile ayırdığın 3 kısa mesaj olarak ver:
Mesaj 1 — 💰 Piyasa durumu + genel görünüm özeti (3-4 madde)
Mesaj 2 — 📋 Sektör dağılımı görünümü${budget ? ` (${budget.toLocaleString('tr-TR')} TL için)` : ''} + örnek veri seti özeti
Mesaj 3 — ⚠️ Risk uyarısı + not${pendingNote}`;
    } else {
      userPromptContent = `Kullanıcı Sorusu: "${message}"

Araç Sonuçları:
${buildToolResultsText(toolResults)}

THREAD FORMAT: Yanıtını "|||" ile ayırdığın 2-3 kısa mesaj olarak ver. Her mesaj kısa ve odaklı olsun.${pendingNote}`;
    }

    const systemPrompt = `Sen egitim odakli bir BIST veri analiz asistanisin. Turkce yanit ver.
Yalnızca objektif, veri-temelli analiz yap. Yatırım tavsiyesi, öneri veya yönlendirme verme.
Yonlendirici eylem cagrisi iceren ifadeler kullanma. "Sinyal" yerine "gösterge durumu" ifadesini tercih et.
Emoji kullan ama abartma. Her mesaj maksimum 5 madde içersin.

Matematiksel göstergeler varsa şu şekilde yorumla:
- RSI < 30 = asiri dusuk bolge | RSI > 70 = asiri yuksek bolge
- MACD histogramı pozitif = yükseliş baskısı | negatif = düşüş baskısı
- Stochastic %K < 20 = asiri dusuk bolge | %K > 80 = asiri yuksek bolge
- ATR% = günlük volatilite tahmini olarak kullan
- Fibonacci seviyeleri destek/direnç noktası olarak göster
- Williams %R < -80 = asiri dusuk bolge | > -20 = asiri yuksek bolge
- CCI < -100 = asiri dusuk bolge | > 100 = asiri yuksek bolge
- Bileşik Durum (compositeSignal): birden fazla göstergenin ortalamasını yansıtır
- OBV trendi: hacimle fiyat hareketi tutarlılığını gösterir

Yanıtı MUTLAKA şu formatta döndür:

[thread mesajları "|||" ile ayrılmış]
SORULAR: soru1 | soru2 | soru3

Örnek:
📊 İlk mesaj içeriği ||| 🔍 İkinci mesaj içeriği ||| ⚠️ Üçüncü mesaj içeriği
SORULAR: GARAN 3 ay sonraki fiyatı ne olur? | AKBNK ile karşılaştırır mısın? | Temettü verimi nedir?

"SORULAR:" satırı her zaman son satır olmalı, 3 kısa Türkçe soru içermeli.
Thread mesajlarının birinde şu cümle aynen geçmeli: "${LEGAL_DISCLAIMER}"`;

    // Sanitize and build conversation history (avoids consecutive-role errors with Claude)
    const cleanHistory = sanitizeHistory(
      conversationHistory.slice(-8) as Array<{ role: string; content: string }>
    ).slice(-4);

    const chatMessages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [
      { role: 'system', content: systemPrompt },
      ...cleanHistory,
      { role: 'user', content: userPromptContent },
    ];

    let rawText = '';
    try {
      const zai = await ZAI.create();
      const finalResponse = await zai.chat.completions.create({
        messages: chatMessages,
        thinking: { type: 'disabled' },
      } as Parameters<typeof zai.chat.completions.create>[0]);
      rawText = (finalResponse as { choices?: Array<{ message?: { content?: string } }> }).choices?.[0]?.message?.content || '';
      // Approximate token usage
      const approxTokens = Math.ceil(rawText.length / 4);
      if (approxTokens > 0) recordTokenUsage(userId, approxTokens, sb);
    } catch (_zaiErr) {
      // Fallback: direct API call with sanitized messages
      try {
        const fallbackResp = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY || process.env.GROQ_API_KEY || ''}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: chatMessages,
            temperature: 0.7,
            max_tokens: allowedTokens,
          }),
        });
        if (fallbackResp.ok) {
          const fallbackData = await fallbackResp.json();
          rawText = fallbackData.choices?.[0]?.message?.content || '';
          const usage = fallbackData.usage?.total_tokens ?? 0;
          if (usage > 0) recordTokenUsage(userId, usage, sb);
        }
      } catch (_fallbackErr) {
        // ignore
      }
      if (!rawText) rawText = `İşlem tamamlandı. Araçlar: ${immediateTools.join(', ')}`;
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

    cleanText = ensureThreadLegalDisclaimer(cleanText);

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
