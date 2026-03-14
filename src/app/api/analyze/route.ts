import { NextRequest, NextResponse } from 'next/server';

interface StockInfo {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
}

interface HistoricalPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const LEGAL_DISCLAIMER =
  'Yasal Sorumluluk Notu: Bu içerik yalnızca bilgilendirme amaçlıdır. Verilecek tüm yatırım kararları ile doğabilecek hukuki ve mali sorumluluk tamamen kullanıcıya aittir.';

function ensureLegalDisclaimer(text: string): string {
  const normalized = text.toLowerCase();
  if (normalized.includes('hukuki') && normalized.includes('kullanıcıya aittir')) {
    return text;
  }
  return `${text.trim()}\n\n${LEGAL_DISCLAIMER}`;
}

function parseNumber(value: string | number | undefined): number {
  if (value === undefined || value === null) return 0;
  if (typeof value === 'number') return value;
  const parsed = parseFloat(value.replace(',', '.').replace(/\s/g, ''));
  return isNaN(parsed) ? 0 : parsed;
}

async function fetchStockData(symbol: string): Promise<{ stock: StockInfo | null; historical: HistoricalPoint[] }> {
  try {
    // Fetch stock detail from Asenax
    const detailResponse = await fetch(`https://api.asenax.com/bist/get/${symbol}`, {
      headers: { 'Accept': 'application/json' },
    });

    let stock: StockInfo | null = null;

    if (detailResponse.ok) {
      const detailData = await detailResponse.json();

      if (detailData.code === "0" && detailData.data?.hisseYuzeysel) {
        const d = detailData.data.hisseYuzeysel;
        stock = {
          symbol: d.sembol || symbol,
          name: d.aciklama || '',
          price: d.kapanis || d.satis || 0,
          change: d.net || 0,
          changePercent: d.yuzdedegisim || 0,
          volume: d.hacimlot || 0,
          high: d.yuksek || 0,
          low: d.dusuk || 0,
          open: d.acilis || 0,
          previousClose: d.dunkukapanis || d.oncekikapanis || 0,
        };
      }
    }

    // Fetch historical data from Finance API
    const historyResponse = await fetch(
      `https://internal-api.z.ai/external/finance/v1/markets/stock/history?symbol=${symbol}.IS&interval=1d`,
      {
        headers: { 'X-Z-AI-From': 'Z' },
      }
    );

    let historical: HistoricalPoint[] = [];

    if (historyResponse.ok) {
      const historyData = await historyResponse.json();

      if (historyData.body) {
        const now = Date.now() / 1000;
        const cutoff = now - (365 * 24 * 60 * 60); // 1 year

        const entries = Object.entries(historyData.body as Record<string, {
          date: string;
          date_utc: number;
          open: number;
          high: number;
          low: number;
          close: number;
          volume: number;
        }>).sort((a, b) => parseInt(a[0]) - parseInt(b[0]));

        for (const [, entry] of entries) {
          if (entry.date_utc && entry.date_utc >= cutoff && entry.close > 0) {
            historical.push({
              date: entry.date,
              open: entry.open || entry.close,
              high: entry.high || entry.close,
              low: entry.low || entry.close,
              close: entry.close,
              volume: entry.volume || 0,
            });
          }
        }
      }
    }

    return { stock, historical };
  } catch (error) {
    console.error('Stock data fetch error:', error);
    return { stock: null, historical: [] };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { symbol, customPrompt } = body;

    if (!symbol) {
      return NextResponse.json({
        success: false,
        error: 'Hisse kodu gerekli',
      }, { status: 400 });
    }

    // Fetch stock data
    const { stock, historical } = await fetchStockData(symbol.toUpperCase());

    // Prepare analysis prompt
    const systemPrompt = `Sen BIST (Borsa İstanbul) verilerini objektif şekilde yorumlayan bir finansal analiz asistanısın. Türkçe yanıt ver ve profesyonel bir dil kullan.

Analizlerin şunları içermeli:
1. 📊 Fiyat Performansı - Son dönemdeki fiyat değişimleri ve trend analizi
2. 📈 Teknik Göstergeler - Destek/direnç seviyeleri, trend çizgileri
3. ⚠️ Risk Değerlendirmesi - Volatilite ve risk faktörleri
4. 🧾 Objektif Sonuç - Sadece veri temelli çıkarımlar, yönlendirme yok

Kurallar:
- "Al/Sat/Bekle", "öneri", "tavsiye" gibi yönlendirici ifadeler kullanma.
- "Sinyal veriyor" gibi kesin öneri dili kurma; yalnızca göstergelerin mevcut durumunu belirt.
- Yanıtları madde madde ve okunabilir formatta ver.
- Yanıtın sonunda şu ifadeyi aynen ekle: "${LEGAL_DISCLAIMER}"`;

    let userPrompt = '';

    if (customPrompt) {
      userPrompt = customPrompt;
    } else if (stock && historical.length > 0) {
      const recentData = historical.slice(-30);
      const priceChange30d = recentData.length >= 2
        ? ((recentData[recentData.length - 1].close - recentData[0].close) / recentData[0].close * 100).toFixed(2)
        : 0;

      userPrompt = `Hisse: ${stock.symbol} - ${stock.name}

📊 GÜNCEL VERİLER:
- Fiyat: ${stock.price.toFixed(2)} TL
- Günlük Değişim: ${stock.change >= 0 ? '+' : ''}${stock.change.toFixed(2)} TL (${stock.changePercent >= 0 ? '+' : ''}${stock.changePercent.toFixed(2)}%)
- Gün Yüksek/Düşük: ${stock.high.toFixed(2)} / ${stock.low.toFixed(2)} TL
- Açılış: ${stock.open.toFixed(2)} TL
- Önceki Kapanış: ${stock.previousClose.toFixed(2)} TL
- Hacim: ${stock.volume.toLocaleString('tr-TR')} lot
- 30 Günlük Değişim: ${Number(priceChange30d) >= 0 ? '+' : ''}${priceChange30d}%

📈 SON 30 GÜN KAPANIŞ FİYATLARI:
${recentData.slice(-10).map(d => `${d.date}: ${d.close.toFixed(2)} TL`).join('\n')}

Lütfen bu hisse için detaylı bir teknik analiz yap.`;
    } else {
      userPrompt = `${symbol} hissesi için genel bir piyasa analizi yap. Bu hissenin BIST'teki performansı hakkında bilgi ver.`;
    }

    // Call OpenAI gpt-4o-mini
    const groqResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY || process.env.GROQ_API_KEY || ''}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 1500,
      }),
    });

    let analysis: string;

    if (groqResponse.ok) {
      const groqData = await groqResponse.json();
      analysis = groqData.choices?.[0]?.message?.content || 'Analiz yapılamadı';
    } else {
      // Fallback to z-ai SDK if Groq fails
      console.log('Groq API failed, using fallback...');
      
      // Simple analysis based on data
      if (stock) {
        const trend = stock.changePercent >= 0 ? 'yükseliş' : 'düşüş';
        const trendEmoji = stock.changePercent >= 0 ? '📈' : '📉';
        
        analysis = `## ${stock.symbol} - ${stock.name} Analizi

### ${trendEmoji} Fiyat Performansı
- Güncel Fiyat: ${stock.price.toFixed(2)} TL
- Günlük Değişim: ${stock.changePercent >= 0 ? '+' : ''}${stock.changePercent.toFixed(2)}%
- Trend: ${trend} trendi görülüyor

### 📊 Teknik Göstergeler
- Gün Yüksek: ${stock.high.toFixed(2)} TL
- Gün Düşük: ${stock.low.toFixed(2)} TL
- Açılış: ${stock.open.toFixed(2)} TL

### ⚠️ Risk Değerlendirmesi
- Hacim: ${stock.volume.toLocaleString('tr-TR')} lot
- ${stock.volume > 1000000 ? 'Yüksek hacimli işlem görüyor' : 'Normal hacimli işlem görüyor'}

### 🧾 Objektif Sonuç
- Mevcut fiyat davranışı ${stock.changePercent >= 0 ? 'pozitif' : 'negatif'} momentumla uyumlu görünüyor.
- Kesin yönlü çıkarım için daha uzun dönemli veri ve haber akışı birlikte değerlendirilmelidir.

${LEGAL_DISCLAIMER}`;
      } else {
        analysis = 'Bu hisse için yeterli veri bulunamadı.';
      }
    }

    analysis = ensureLegalDisclaimer(analysis);

    return NextResponse.json({
      success: true,
      data: {
        symbol: symbol.toUpperCase(),
        stock,
        analysis,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('AI analysis error:', error);

    return NextResponse.json({
      success: false,
      error: 'AI analizi yapılamadı. Lütfen tekrar deneyin.',
    }, { status: 500 });
  }
}
