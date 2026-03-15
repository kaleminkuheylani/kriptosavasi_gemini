import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';
import { fetchCryptoSnapshot, type CryptoAsset, type CryptoSnapshot } from '@/lib/coinmarketcap';

const LEGAL_DISCLAIMER =
  'Yasal Sorumluluk Notu: Bu icerik yalnizca bilgilendirme amaclidir. Verilecek tum yatirim kararlari ile dogabilecek hukuki ve mali sorumluluk tamamen kullaniciya aittir.';

const TOOLS = {
  get_crypto_snapshot: {
    description: 'CoinMarketCap kaynakli genel kripto piyasa ozetini getirir',
    parameters: {},
  },
  get_asset_detail: {
    description: 'Sembol bazli coin detayini getirir (fiyat, market cap, degisim, analiz skorlar)',
    parameters: { symbol: 'string - ORN: BTC, ETH, SOL' },
  },
  read_txt_file: {
    description: 'Yuklenen TXT dosyasini analiz eder',
    parameters: { content: 'string', filename: 'string (opsiyonel)' },
  },
  analyze_chart_image: {
    description: 'Yuklenen grafik gorselini VLM ile analiz eder',
    parameters: { imageBase64: 'string', symbol: 'string (opsiyonel)' },
  },
};

interface PendingAction {
  tool: string;
  params: Record<string, unknown>;
  description: string;
}

interface AgentRequestBody {
  message?: string;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  txtContent?: string;
  txtFilename?: string;
  imageBase64?: string;
  imageSymbol?: string;
  confirmActions?: PendingAction[];
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: value >= 1_000_000_000 ? 'compact' : 'standard',
    maximumFractionDigits: value >= 100 ? 2 : 6,
  }).format(value);
}

function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function extractSymbols(message: string): string[] {
  const matches = message.toUpperCase().match(/\b[A-Z0-9]{2,10}\b/g) ?? [];
  return [...new Set(matches)];
}

function buildMarketSummary(snapshot: CryptoSnapshot): string {
  return [
    `Toplam Piyasa Degeri: ${formatMoney(snapshot.market.totalMarketCap)}`,
    `24s Hacim: ${formatMoney(snapshot.market.totalVolume24h)}`,
    `Piyasa Degisimi 24s: ${formatPercent(snapshot.market.marketCapChange24h)}`,
    `Yukselen/Dusen: ${snapshot.market.positive24hCount}/${snapshot.market.negative24hCount}`,
    `BTC Dominance: ${snapshot.market.btcDominance.toFixed(2)}%`,
    `ETH Dominance: ${snapshot.market.ethDominance.toFixed(2)}%`,
    `Ortalama Momentum: ${snapshot.analysis.overallMomentum}`,
    `Ortalama Volatilite: ${snapshot.analysis.overallVolatility}`,
  ].join('\n');
}

function buildAssetSummary(asset: CryptoAsset): string {
  return [
    `${asset.name} (${asset.symbol})`,
    `Fiyat: ${formatMoney(asset.price)}`,
    `24s: ${formatPercent(asset.percentChange24h)} | 7g: ${formatPercent(asset.percentChange7d)}`,
    `Market Cap: ${formatMoney(asset.marketCap)} | Hacim 24s: ${formatMoney(asset.volume24h)}`,
    `Momentum: ${asset.analysis.momentumScore} | Volatilite: ${asset.analysis.volatilityScore} | Likidite: ${asset.analysis.liquidityScore}`,
    `Trend: ${asset.analysis.trend} | Risk: ${asset.analysis.riskLevel} | Sinyal: ${asset.analysis.signal}`,
  ].join('\n');
}

function splitThreadAndQuestions(raw: string): { messages: string[]; suggestedQuestions: string[] } {
  const fallbackQuestions = [
    'BTC icin detayli teknik gorunum nedir?',
    'ETH ve SOL momentum karsilastirmasi yapar misin?',
    'Yuksek riskli coinleri listeler misin?',
  ];

  const normalized = raw.trim();
  const questionMatch = normalized.match(/\nSORULAR:\s*(.+)$/m);
  const suggestedQuestions = questionMatch
    ? questionMatch[1]
        .split('|')
        .map((q) => q.trim())
        .filter((q) => q.length > 5)
    : fallbackQuestions;

  const clean = questionMatch ? normalized.replace(/\nSORULAR:\s*(.+)$/m, '').trim() : normalized;
  const thread = clean
    .split('|||')
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  const messages = thread.length > 0 ? thread : [clean];
  const hasLegal = messages.some((message) => message.toLowerCase().includes('hukuki ve mali sorumluluk'));
  if (!hasLegal) {
    messages[messages.length - 1] = `${messages[messages.length - 1]}\n\n⚖️ ${LEGAL_DISCLAIMER}`;
  }

  return {
    messages,
    suggestedQuestions: suggestedQuestions.slice(0, 3),
  };
}

async function summarizeText(content: string, filename?: string): Promise<string> {
  try {
    const zai = await ZAI.create();
    const response = await zai.chat.completions.create({
      messages: [
        {
          role: 'user',
          content: `Asagidaki TXT icerigini Turkce ozetle. En fazla 8 madde kullan.
Dosya: ${filename ?? 'bilinmiyor'}

Icerik:
${content.slice(0, 7000)}

Son satira su metni aynen ekle:
${LEGAL_DISCLAIMER}`,
        },
      ],
      thinking: { type: 'disabled' },
    } as Parameters<typeof zai.chat.completions.create>[0]);

    const text = (response as { choices?: Array<{ message?: { content?: string } }> }).choices?.[0]?.message?.content;
    if (text && text.trim().length > 0) return text;
  } catch {
    // ignore and fallback below
  }

  return [
    `TXT dosyasi okundu (${filename ?? 'adsiz'}, ${content.length} karakter).`,
    'Otomatik analiz servisine su an ulasilamiyor; tekrar dener misin?',
    `⚖️ ${LEGAL_DISCLAIMER}`,
  ].join('\n');
}

async function analyzeImage(imageBase64: string, symbol?: string): Promise<string> {
  try {
    const zai = await ZAI.create();
    const response = await zai.chat.completions.createVision({
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Bu kripto grafik gorselini Turkce analiz et.
- Trend
- Destek/direnc ihtimali
- Volatilite notu
- Risk faktoru

${symbol ? `Sembol: ${symbol}` : ''}
Son satira su metni aynen ekle:
${LEGAL_DISCLAIMER}`,
            },
            {
              type: 'image_url',
              image_url: {
                url: imageBase64.startsWith('data:') ? imageBase64 : `data:image/png;base64,${imageBase64}`,
              },
            },
          ],
        },
      ],
      thinking: { type: 'disabled' },
    });

    const text = response.choices?.[0]?.message?.content;
    if (text && text.trim().length > 0) return text;
  } catch {
    // ignore and fallback below
  }

  return [
    'Grafik gorseli alindi ancak VLM analizi su an tamamlanamadi.',
    'Lutfen farkli bir gorsel ile tekrar deneyin.',
    `⚖️ ${LEGAL_DISCLAIMER}`,
  ].join('\n');
}

function buildFallbackAnalysis(message: string, snapshot: CryptoSnapshot, focusedAssets: CryptoAsset[]): string {
  const topMomentum = snapshot.analysis.topMomentum.slice(0, 3).map((asset) => `${asset.symbol}(${asset.momentumScore})`).join(', ');
  const highRisk = snapshot.analysis.highRiskAssets.slice(0, 3).map((asset) => `${asset.symbol}(${asset.volatilityScore})`).join(', ');

  const focusText =
    focusedAssets.length > 0
      ? focusedAssets.map((asset) => buildAssetSummary(asset)).join('\n\n')
      : 'Mesajda net bir sembol tespit edilmedi. Genel piyasa gorunumu paylasildi.';

  return [
    `📊 Genel Piyasa Ozeti\n${buildMarketSummary(snapshot)}`,
    `🔎 Sembol Analizi\n${focusText}`,
    `⚠️ Risk ve Ivmeler\nTop Momentum: ${topMomentum || '-'}\nYuksek Riskli: ${highRisk || '-'}\nKullanici Mesaji: "${message}"\n⚖️ ${LEGAL_DISCLAIMER}`,
    'SORULAR: BTC icin kritik seviyeler neler? | ETH ve SOL risk karsilastirmasi yapar misin? | Top momentum coinlerini aciklar misin?',
  ].join('\n\n||| ');
}

async function generateAssistantReply(
  message: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  snapshot: CryptoSnapshot,
  focusedAssets: CryptoAsset[],
): Promise<string> {
  const marketSummary = buildMarketSummary(snapshot);
  const focusedSummary = focusedAssets.length > 0
    ? focusedAssets.map((asset) => buildAssetSummary(asset)).join('\n\n')
    : 'Mesajdaki semboller CoinMarketCap listesinde bulunamadi.';

  const context = `Kullanici mesaji: "${message}"

GENEL PIYASA:
${marketSummary}

SEMBOL ODAKLI VERI:
${focusedSummary}`;

  try {
    const zai = await ZAI.create();
    const response = await zai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `Sen kripto veri asistanisin. Sadece CoinMarketCap verisine dayan.
Kripto disi piyasa anlatimi yapma.
Yanit formati:
Mesaj1 ||| Mesaj2 ||| Mesaj3
SORULAR: soru1 | soru2 | soru3
Son mesajin icinde su metin gecmeli:
${LEGAL_DISCLAIMER}`,
        },
        ...history.slice(-6).map((item) => ({ role: item.role, content: item.content })),
        { role: 'user', content: context },
      ],
      thinking: { type: 'disabled' },
    } as Parameters<typeof zai.chat.completions.create>[0]);

    const content = (response as { choices?: Array<{ message?: { content?: string } }> }).choices?.[0]?.message?.content;
    if (content && content.trim().length > 0) return content;
  } catch {
    // ignore and fallback below
  }

  return buildFallbackAnalysis(message, snapshot, focusedAssets);
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as AgentRequestBody;
    const { message, conversationHistory = [], txtContent, txtFilename, imageBase64, imageSymbol, confirmActions } = body;

    if (confirmActions && confirmActions.length > 0) {
      return NextResponse.json({
        success: true,
        response: 'Onay isteyen bir islem tanimli degil. Kripto asistani salt analiz modunda calisiyor.',
        toolsUsed: [],
        pendingActions: [],
        timestamp: new Date().toISOString(),
      });
    }

    if (txtContent) {
      const summary = await summarizeText(txtContent, txtFilename);
      const parsed = splitThreadAndQuestions(summary);
      return NextResponse.json({
        success: true,
        response: parsed.messages[0],
        messages: parsed.messages,
        suggestedQuestions: parsed.suggestedQuestions,
        toolsUsed: ['read_txt_file'],
        timestamp: new Date().toISOString(),
      });
    }

    if (imageBase64) {
      const analysis = await analyzeImage(imageBase64, imageSymbol);
      const parsed = splitThreadAndQuestions(analysis);
      return NextResponse.json({
        success: true,
        response: parsed.messages[0],
        messages: parsed.messages,
        suggestedQuestions: parsed.suggestedQuestions,
        toolsUsed: ['analyze_chart_image'],
        timestamp: new Date().toISOString(),
      });
    }

    if (!message || message.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'Mesaj gerekli' }, { status: 400 });
    }

    const snapshot = await fetchCryptoSnapshot(120, 'USD');
    const knownSymbols = new Set(snapshot.assets.map((asset) => asset.symbol.toUpperCase()));
    const extractedSymbols = extractSymbols(message).filter((symbol) => knownSymbols.has(symbol));
    const focusedAssets = snapshot.assets.filter((asset) => extractedSymbols.includes(asset.symbol.toUpperCase())).slice(0, 5);

    const rawReply = await generateAssistantReply(message, conversationHistory, snapshot, focusedAssets);
    const parsed = splitThreadAndQuestions(rawReply);

    return NextResponse.json({
      success: true,
      response: parsed.messages[0],
      messages: parsed.messages,
      suggestedQuestions: parsed.suggestedQuestions,
      toolsUsed: focusedAssets.length > 0 ? ['get_crypto_snapshot', 'get_asset_detail'] : ['get_crypto_snapshot'],
      pendingActions: [],
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('/api/agent error:', error);
    const message = error instanceof Error ? error.message : 'Bilinmeyen hata';
    const normalized = message.toLowerCase();
    const missingKey =
      normalized.includes('api key eksik') ||
      normalized.includes('coinmarketcap_api_key') ||
      normalized.includes('cmc_api_key');
    const rateLimited = normalized.includes('http 429');

    return NextResponse.json(
      {
        success: false,
        error: missingKey
          ? 'CoinMarketCap API anahtari tanimli degil. Asistan veri olmadan analiz uretemiyor.'
          : rateLimited
            ? 'CoinMarketCap istek limiti gecici olarak dolu. Biraz sonra tekrar deneyin.'
            : 'Kripto asistani gecici olarak cevap veremiyor. Lutfen tekrar deneyin.',
        hint: missingKey
          ? 'COINMARKETCAP_API_KEY veya CMC_API_KEY ortam degiskenini tanimlayin.'
          : undefined,
      },
      { status: missingKey ? 503 : rateLimited ? 429 : 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    tools: TOOLS,
    count: Object.keys(TOOLS).length,
  });
}
