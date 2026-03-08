import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import ZAI from 'z-ai-web-dev-sdk';

const prisma = new PrismaClient();

// Tool Definitions
const TOOLS = {
  get_stock_price: {
    description: 'Hisse senedinin güncel fiyatını ve temel bilgilerini getirir',
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
  get_kap_data: {
    description: 'KAP (Kamu Aydınlatma Platformu) bildirimlerini getirir',
    parameters: { symbol: 'string - Hisse kodu (opsiyonel)' },
  },
  scan_market: {
    description: 'Tüm piyasayı tarar, endüstri bazlı analiz yapar',
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
};

// Tool Implementations
async function getStockPrice(symbol: string) {
  try {
    const response = await fetch(`https://api.asenax.com/bist/get/${symbol.toUpperCase()}`);
    const data = await response.json();
    
    if (data.code === "0" && data.data?.hisseYuzeysel) {
      const d = data.data.hisseYuzeysel;
      return {
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
        },
      };
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
      
      return { success: true, data: historical, count: historical.length };
    }
    return { success: false, error: 'Veri bulunamadı' };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

async function getWatchlist() {
  try {
    const items = await prisma.watchlistItem.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return { success: true, data: items, count: items.length };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

async function addToWatchlist(symbol: string, name: string) {
  try {
    const existing = await prisma.watchlistItem.findFirst({
      where: { symbol: symbol.toUpperCase() },
    });
    
    if (existing) {
      return { success: false, error: 'Bu hisse zaten takip listesinde' };
    }
    
    const item = await prisma.watchlistItem.create({
      data: { symbol: symbol.toUpperCase(), name },
    });
    return { success: true, data: item };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

async function removeFromWatchlist(symbol: string) {
  try {
    await prisma.watchlistItem.deleteMany({
      where: { symbol: symbol.toUpperCase() },
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
      ? `${symbol} hisse KAP bildirim Kamu Aydınlatma Platformu`
      : 'BIST KAP bildirimler Kamu Aydınlatma Platformu bugün';
    
    const results = await zai.functions.invoke('web_search', { query, num: 10 });
    
    return { 
      success: true, 
      data: results,
      source: 'KAP Search',
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

async function scanMarket(industry?: string) {
  try {
    const response = await fetch('https://api.asenax.com/bist/list');
    const data = await response.json();
    
    let stocks = [];
    if (data.code === "0" && Array.isArray(data.data)) {
      stocks = data.data
        .filter((item: { tip?: string }) => item.tip === "Hisse")
        .map((item: { kod?: string; ad?: string }) => ({
          code: item.kod,
          name: item.ad,
        }));
    }
    
    // Get prices for top stocks
    const results = [];
    const toFetch = industry ? stocks.slice(0, 30) : stocks.slice(0, 50);
    
    for (const stock of toFetch) {
      const priceData = await getStockPrice(stock.code);
      if (priceData.success && priceData.data.price > 0) {
        results.push({
          ...stock,
          ...priceData.data,
        });
      }
    }
    
    // Sort by performance
    const sorted = results.sort((a, b) => b.changePercent - a.changePercent);
    
    return { 
      success: true, 
      data: {
        all: sorted,
        gainers: sorted.filter(s => s.changePercent > 0).slice(0, 10),
        losers: sorted.filter(s => s.changePercent < 0).sort((a, b) => a.changePercent - b.changePercent).slice(0, 10),
        total: sorted.length,
      },
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

async function getTopGainers(limit: number = 10) {
  try {
    const marketData = await scanMarket();
    if (marketData.success && marketData.data) {
      return { 
        success: true, 
        data: marketData.data.gainers.slice(0, limit),
      };
    }
    return { success: false, error: 'Veri alınamadı' };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

async function getTopLosers(limit: number = 10) {
  try {
    const marketData = await scanMarket();
    if (marketData.success && marketData.data) {
      return { 
        success: true, 
        data: marketData.data.losers.slice(0, limit),
      };
    }
    return { success: false, error: 'Veri alınamadı' };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

async function getPriceAlerts() {
  try {
    const alerts = await prisma.priceAlert.findMany({
      where: { active: true },
      orderBy: { createdAt: 'desc' },
    });
    return { success: true, data: alerts, count: alerts.length };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

async function createPriceAlert(symbol: string, targetPrice: number, condition: 'above' | 'below') {
  try {
    const alert = await prisma.priceAlert.create({
      data: {
        symbol: symbol.toUpperCase(),
        targetPrice,
        condition,
      },
    });
    return { success: true, data: alert };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Tool Executor
async function executeTool(toolName: string, params: Record<string, unknown>) {
  switch (toolName) {
    case 'get_stock_price':
      return await getStockPrice(params.symbol as string);
    case 'get_stock_history':
      return await getStockHistory(params.symbol as string, params.period as string);
    case 'get_watchlist':
      return await getWatchlist();
    case 'add_to_watchlist':
      return await addToWatchlist(params.symbol as string, params.name as string);
    case 'remove_from_watchlist':
      return await removeFromWatchlist(params.symbol as string);
    case 'web_search':
      return await webSearch(params.query as string);
    case 'read_document':
      return await readDocument(params.url as string);
    case 'get_kap_data':
      return await getKapData(params.symbol as string | undefined);
    case 'scan_market':
      return await scanMarket(params.industry as string | undefined);
    case 'get_top_gainers':
      return await getTopGainers(params.limit as number | undefined);
    case 'get_top_losers':
      return await getTopLosers(params.limit as number | undefined);
    case 'get_price_alerts':
      return await getPriceAlerts();
    case 'create_price_alert':
      return await createPriceAlert(
        params.symbol as string,
        params.targetPrice as number,
        params.condition as 'above' | 'below'
      );
    default:
      return { success: false, error: `Bilinmeyen tool: ${toolName}` };
  }
}

// AI Agent Handler
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, conversationHistory = [] } = body;

    if (!message) {
      return NextResponse.json({ success: false, error: 'Mesaj gerekli' }, { status: 400 });
    }

    // Build system prompt with tool definitions
    const toolDescriptions = Object.entries(TOOLS)
      .map(([name, info]) => `- ${name}: ${info.description}`)
      .join('\n');

    const systemPrompt = `Sen BIST 100 hisse analizi yapan bir AI asistanısın. Türkçe yanıt ver.

Kullanılabilir Araçların:
${toolDescriptions}

Kullanıcı sorusuna göre uygun araçları kullan. Yanıtında:
1. Hangi araçları kullandığını belirt
2. Sonuçları özetle
3. Öneri veya yorum yap

JSON formatında yanıt ver:
{
  "tools_to_use": ["tool1", "tool2"],
  "tool_params": { "tool1": {...}, "tool2": {...} },
  "explanation": "Kullanıcıya açıkla"
}

ÖNEMLİ: Sadece JSON döndür, başka bir şey yazma.`;

    // Call AI to determine which tools to use
    const aiResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY || 'gsk_demo'}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          ...conversationHistory.map((m: { role: string; content: string }) => ({
            role: m.role,
            content: m.content,
          })),
          { role: 'user', content: message },
        ],
        temperature: 0.3,
        max_tokens: 1000,
      }),
    });

    let toolsToUse: string[] = [];
    let toolParams: Record<string, Record<string, unknown>> = {};
    let explanation = '';

    if (aiResponse.ok) {
      const aiData = await aiResponse.json();
      const aiContent = aiData.choices?.[0]?.message?.content || '';
      
      // Parse AI response
      try {
        const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          toolsToUse = parsed.tools_to_use || [];
          toolParams = parsed.tool_params || {};
          explanation = parsed.explanation || '';
        }
      } catch {
        // Fallback: simple keyword-based tool selection
        const lowerMessage = message.toLowerCase();
        
        if (lowerMessage.includes('takip') || lowerMessage.includes('watchlist')) {
          toolsToUse.push('get_watchlist');
        }
        if (lowerMessage.includes('yükselen') || lowerMessage.includes('kazandıran')) {
          toolsToUse.push('get_top_gainers');
        }
        if (lowerMessage.includes('düşen') || lowerMessage.includes('kaybettiren')) {
          toolsToUse.push('get_top_losers');
        }
        if (lowerMessage.includes('kap') || lowerMessage.includes('bildirim')) {
          toolsToUse.push('get_kap_data');
        }
        if (lowerMessage.includes('piyasa') || lowerMessage.includes('tara') || lowerMessage.includes('sektör')) {
          toolsToUse.push('scan_market');
        }
        if (lowerMessage.includes('ara') || lowerMessage.includes('haber')) {
          toolsToUse.push('web_search');
          toolParams['web_search'] = { query: message };
        }
        
        // Extract stock symbols
        const symbolMatch = message.match(/\b([A-Z]{3,5})\b/);
        if (symbolMatch) {
          if (lowerMessage.includes('fiyat') || lowerMessage.includes('analiz')) {
            toolsToUse.push('get_stock_price');
            toolParams['get_stock_price'] = { symbol: symbolMatch[1] };
          }
          if (lowerMessage.includes('geçmiş') || lowerMessage.includes('grafik')) {
            toolsToUse.push('get_stock_history');
            toolParams['get_stock_history'] = { symbol: symbolMatch[1], period: '1M' };
          }
        }
      }
    }

    // Execute tools
    const toolResults: Record<string, unknown> = {};
    for (const tool of toolsToUse) {
      const params = toolParams[tool] || {};
      console.log(`Executing tool: ${tool} with params:`, params);
      toolResults[tool] = await executeTool(tool, params);
    }

    // Generate final response
    const finalSystemPrompt = `Sen BIST 100 hisse analizi yapan bir AI asistanısın. Türkçe yanıt ver.
Kullanıcıya hem nazik hem de bilgilendirici bir şekilde yanıt ver.
Tool sonuçlarını kullanarak detaylı bir analiz sun.
Emojiler kullan ama abartma.
Yatırım tavsiyesi vermeyi, sadece analiz yap.`;

    const finalResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY || 'gsk_demo'}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: finalSystemPrompt },
          ...conversationHistory.map((m: { role: string; content: string }) => ({
            role: m.role,
            content: m.content,
          })),
          { 
            role: 'user', 
            content: `Kullanıcı Sorusu: ${message}\n\nKullanılan Araçlar: ${toolsToUse.join(', ')}\n\nAraç Sonuçları:\n${JSON.stringify(toolResults, null, 2)}` 
          },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    let responseText = 'İşlem tamamlandı.';
    
    if (finalResponse.ok) {
      const finalData = await finalResponse.json();
      responseText = finalData.choices?.[0]?.message?.content || responseText;
    } else {
      // Fallback response with tool results
      responseText = `## İşlem Sonuçları\n\n`;
      responseText += `**Kullanılan Araçlar:** ${toolsToUse.join(', ')}\n\n`;
      
      for (const [tool, result] of Object.entries(toolResults)) {
        responseText += `### ${tool}\n`;
        responseText += '```json\n' + JSON.stringify(result, null, 2).slice(0, 500) + '\n```\n\n';
      }
    }

    return NextResponse.json({
      success: true,
      response: responseText,
      toolsUsed: toolsToUse,
      toolResults,
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
