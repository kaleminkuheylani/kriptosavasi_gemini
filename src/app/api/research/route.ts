import { NextRequest, NextResponse } from 'next/server';
import { webSearchTool, Agent, AgentInputItem, Runner, withTrace } from '@openai/agents';
import { z } from 'zod';

// ─── 1. SCHEMA ─────────────────────────────────────────────────────────────
// Doldurulacak structured output: boş bırakılan alanlar null döner
const OzetSchema = z.object({
  stock:             z.string().describe('Hisse senedi kodu, örn: THYAO'),
  company_name:      z.string().nullable().describe('Şirket tam adı'),
  price:             z.number().nullable().describe('Güncel fiyat (TRY)'),
  currency:          z.string().default('TRY'),
  sector:            z.string().nullable().describe('Sektör, örn: Havacılık'),
  industry:          z.string().nullable().describe('Alt endüstri'),
  pe_ratio:          z.number().nullable().describe('Hisse F/K oranı'),
  industry_pe:       z.number().nullable().describe('Sektör ortalama F/K'),
  industry_growth:   z.string().nullable().describe('Sektör büyüme kapasitesi özeti'),
  summary:           z.string().describe('Kısa yatırım özeti (2-3 cümle)'),
});

type OzetOutput = z.infer<typeof OzetSchema>;

// ─── 2. TOOLS ──────────────────────────────────────────────────────────────
const webSearch = webSearchTool({
  filters: { allowed_domains: ['tr.investing.com', 'finans.mynet.com', 'kap.org.tr'] },
  searchContextSize: 'medium',
  userLocation: { country: 'TR', type: 'approximate' },
});

// ─── 3. AGENTS ─────────────────────────────────────────────────────────────

// Agent 1: Araştırmacı — web'den ham veri toplar
const webResearchAgent = new Agent({
  name: 'BIST Arastirmaci',
  instructions: `Sen BIST hisse senetlerini araştıran bir analistsin.
Görev: Verilen hisse senedi için aşağıdakileri bul ve SADECE Türkçe, ham veri olarak döndür:
1. Güncel fiyat ve son 1 aylık performans
2. Şirketin faaliyet gösterdiği sektör ve endüstri
3. Varsa F/K (P/E) oranı
4. Sektörün büyüme kapasitesi ve genel durumu
5. Sektör ortalama F/K oranı

Bulunan verileri düzgün JSON'a dönüştürme — ham metin olarak döndür.`,
  model: 'gpt-4.1',
  tools: [webSearch],
  modelSettings: {
    temperature: 0,
    topP: 1,
    maxTokens: 1200,
    store: true,
  },
});

// Agent 2: Analist — araştırma çıktısını structured output'a dönüştürür
const ozetAgent = new Agent({
  name: 'BIST Analist',
  instructions: `Sen yapılandırılmış finansal veri çıkaran bir analistsin.
Önceki araştırmacının ham verisini alacaksın.
Görerin: Araştırma metninden aşağıdaki alanları çıkararak JSON schema'ya uygun doldur.
- Değer bulunamazsa null bırak.
- pe_ratio: hissenin F/K oranı (sayı)
- industry_pe: sektör ortalama F/K (sayı)
- industry_growth: sektörün büyüme kapasitesi (kısa metin)
- summary: yatırımcıya yönelik 2-3 cümlelik özet`,
  model: 'gpt-4.1',
  outputType: OzetSchema,
  modelSettings: {
    temperature: 0.3,
    topP: 1,
    maxTokens: 700,
    store: true,
  },
});

// ─── 4. WORKFLOW ────────────────────────────────────────────────────────────
async function runResearch(symbol: string): Promise<{
  stock: string;
  price: number | null;
  currency: string;
  sector: string | null;
  industry: string | null;
  pe_ratio: number | null;
  industry_pe: number | null;
  industry_growth: string | null;
  company_name: string | null;
  summary: string;
  raw_research: string;
}> {
  return await withTrace(`BIST Research: ${symbol}`, async () => {
    const runner = new Runner({
      traceMetadata: {
        __trace_source__: 'bist-research',
        symbol,
      },
    });

    // Konuşma geçmişi — agentlar arasında context taşır
    const conversationHistory: AgentInputItem[] = [
      {
        role: 'user',
        content: [{
          type: 'input_text',
          text: `Hisse senedi: ${symbol}`,
        }],
      },
    ];

    // ── Agent 1: Web araştırması ──
    const researchResult = await runner.run(
      webResearchAgent,
      [
        ...conversationHistory,
        {
          role: 'user',
          content: [{
            type: 'input_text',
            // {{hisse senedi}} template fix — gerçek sembol enjekte ediliyor
            text: `${symbol} hisse senedi hakkında yukarıda belirtilen bilgileri bul.`,
          }],
        },
      ],
    );

    if (!researchResult.finalOutput) {
      throw new Error('Araştırmacı agent sonuç döndürmedi');
    }

    const rawResearch: string = researchResult.finalOutput;

    // Araştırma çıktısı sonraki agenta context olarak aktarılıyor
    conversationHistory.push(
      ...researchResult.newItems.map((item) => item.rawItem),
    );

    // ── Agent 2: Structured output ──
    const ozetResult = await runner.run(
      ozetAgent,
      [
        ...conversationHistory,
        {
          role: 'user',
          content: [{
            type: 'input_text',
            // industry ve stock değişkenleri artık context'ten geliyor — template injection değil
            text: `Yukarıdaki araştırma verilerinden ${symbol} için yapılandırılmış finansal özet çıkar.`,
          }],
        },
      ],
    );

    if (!ozetResult.finalOutput) {
      throw new Error('Analist agent sonuç döndürmedi');
    }

    const parsed: OzetOutput = ozetResult.finalOutput;

    return {
      stock:            parsed.stock || symbol,
      company_name:     parsed.company_name,
      price:            parsed.price,
      currency:         parsed.currency,
      sector:           parsed.sector,
      industry:         parsed.industry,
      pe_ratio:         parsed.pe_ratio,      // P/E → pe_ratio (geçerli JS key)
      industry_pe:      parsed.industry_pe,
      industry_growth:  parsed.industry_growth,
      summary:          parsed.summary,
      raw_research:     rawResearch,
    };
  });
}

// ─── 5. API ROUTE ───────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const symbol: string = (body.symbol || '').toUpperCase().trim();

    if (!symbol) {
      return NextResponse.json(
        { success: false, error: 'Hisse kodu gerekli (örn: THYAO)' },
        { status: 400 },
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'OPENAI_API_KEY tanımlı değil' },
        { status: 500 },
      );
    }

    const result = await runResearch(symbol);

    return NextResponse.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Bilinmeyen hata';
    console.error('Research error:', message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
