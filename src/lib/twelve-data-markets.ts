export type GlobalMarketType = 'digital' | 'forex' | 'nasdaq';

export interface GlobalMarketData {
  symbol: string;
  name: string;
  market: GlobalMarketType;
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  volume: number;
}

export interface GlobalMarketsSnapshot {
  digitalCurrencies: GlobalMarketData[];
  forex: GlobalMarketData[];
  nasdaq: GlobalMarketData[];
  source: 'twelvedata';
  timestamp: string;
}

interface TwelveDataQuote {
  symbol?: string;
  close?: string;
  change?: string;
  percent_change?: string;
  high?: string;
  low?: string;
  open?: string;
  previous_close?: string;
  volume?: string;
  status?: string;
}

interface GlobalMarketInstrument {
  providerSymbol: string;
  symbol: string;
  name: string;
  market: GlobalMarketType;
}

const GLOBAL_INSTRUMENTS: GlobalMarketInstrument[] = [
  {
    providerSymbol: 'BTC/USD',
    symbol: 'BTC/USD',
    name: 'Bitcoin',
    market: 'digital',
  },
  {
    providerSymbol: 'ETH/USD',
    symbol: 'ETH/USD',
    name: 'Ethereum',
    market: 'digital',
  },
  {
    providerSymbol: 'SOL/USD',
    symbol: 'SOL/USD',
    name: 'Solana',
    market: 'digital',
  },
  {
    providerSymbol: 'XRP/USD',
    symbol: 'XRP/USD',
    name: 'XRP',
    market: 'digital',
  },
  {
    providerSymbol: 'EUR/USD',
    symbol: 'EUR/USD',
    name: 'Euro / US Dollar',
    market: 'forex',
  },
  {
    providerSymbol: 'GBP/USD',
    symbol: 'GBP/USD',
    name: 'British Pound / US Dollar',
    market: 'forex',
  },
  {
    providerSymbol: 'USD/JPY',
    symbol: 'USD/JPY',
    name: 'US Dollar / Japanese Yen',
    market: 'forex',
  },
  {
    providerSymbol: 'USD/TRY',
    symbol: 'USD/TRY',
    name: 'US Dollar / Turkish Lira',
    market: 'forex',
  },
  {
    providerSymbol: 'AAPL',
    symbol: 'AAPL',
    name: 'Apple',
    market: 'nasdaq',
  },
  {
    providerSymbol: 'MSFT',
    symbol: 'MSFT',
    name: 'Microsoft',
    market: 'nasdaq',
  },
  {
    providerSymbol: 'NVDA',
    symbol: 'NVDA',
    name: 'NVIDIA',
    market: 'nasdaq',
  },
  {
    providerSymbol: 'AMZN',
    symbol: 'AMZN',
    name: 'Amazon',
    market: 'nasdaq',
  },
];

const CACHE_DURATION = 60 * 1000;
let cachedSnapshot: GlobalMarketsSnapshot | null = null;
let lastFetchTime = 0;

function parseNumeric(value: string | number | undefined): number | null {
  if (value === undefined || value === null || value === '') return null;
  const raw = typeof value === 'number' ? value : Number.parseFloat(String(value).replace(',', '.'));
  return Number.isFinite(raw) ? raw : null;
}

function normalizeQuoteMap(payload: unknown): Record<string, TwelveDataQuote> {
  if (!payload || typeof payload !== 'object') return {};
  const obj = payload as Record<string, unknown>;

  // Single-symbol quote response
  if (typeof obj.symbol === 'string' && (obj.close !== undefined || obj.open !== undefined)) {
    return { [obj.symbol]: obj as TwelveDataQuote };
  }

  // Multi-symbol quote response
  const quoteMap: Record<string, TwelveDataQuote> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value && typeof value === 'object') {
      quoteMap[key] = value as TwelveDataQuote;
    }
  }
  return quoteMap;
}

function toGlobalMarketData(instrument: GlobalMarketInstrument, quote?: TwelveDataQuote): GlobalMarketData | null {
  if (!quote || quote.status === 'error') return null;

  const price = parseNumeric(quote.close);
  if (price === null) return null;

  const previousClose = parseNumeric(quote.previous_close) ?? price;
  const derivedChange = price - previousClose;
  const change = parseNumeric(quote.change) ?? derivedChange;
  const derivedPercent = previousClose === 0 ? 0 : (change / previousClose) * 100;
  const changePercent = parseNumeric(quote.percent_change) ?? derivedPercent;

  return {
    symbol: instrument.symbol,
    name: instrument.name,
    market: instrument.market,
    price,
    change,
    changePercent,
    high: parseNumeric(quote.high) ?? price,
    low: parseNumeric(quote.low) ?? price,
    open: parseNumeric(quote.open) ?? previousClose,
    previousClose,
    volume: Math.round(parseNumeric(quote.volume) ?? 0),
  };
}

async function fetchFromTwelveData(): Promise<GlobalMarketsSnapshot> {
  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!apiKey) throw new Error('TWELVE_DATA_API_KEY eksik');

  const symbols = GLOBAL_INSTRUMENTS.map(item => item.providerSymbol).join(',');
  const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbols)}&apikey=${apiKey}`;
  const response = await fetch(url, { next: { revalidate: 60 } });

  if (!response.ok) {
    throw new Error(`Twelve Data HTTP ${response.status}`);
  }

  const payload = (await response.json()) as Record<string, unknown>;
  if ((payload as { status?: string }).status === 'error') {
    throw new Error(String((payload as { message?: string }).message ?? 'Twelve Data hatası'));
  }

  const quoteMap = normalizeQuoteMap(payload);
  const merged = GLOBAL_INSTRUMENTS
    .map(instrument => {
      const quote =
        quoteMap[instrument.providerSymbol] ??
        quoteMap[instrument.symbol] ??
        quoteMap[instrument.providerSymbol.toUpperCase()] ??
        quoteMap[instrument.symbol.toUpperCase()];
      return toGlobalMarketData(instrument, quote);
    })
    .filter((item): item is GlobalMarketData => Boolean(item));

  if (merged.length === 0) {
    throw new Error('Twelve Data gecerli piyasa verisi donmedi');
  }

  return {
    digitalCurrencies: merged.filter(item => item.market === 'digital'),
    forex: merged.filter(item => item.market === 'forex'),
    nasdaq: merged.filter(item => item.market === 'nasdaq'),
    source: 'twelvedata',
    timestamp: new Date().toISOString(),
  };
}

export async function fetchGlobalMarketsSnapshot(): Promise<GlobalMarketsSnapshot> {
  const now = Date.now();
  if (cachedSnapshot && now - lastFetchTime < CACHE_DURATION) {
    return cachedSnapshot;
  }

  const snapshot = await fetchFromTwelveData();
  cachedSnapshot = snapshot;
  lastFetchTime = now;
  return snapshot;
}

export async function fetchGlobalMarketByType(type: GlobalMarketType): Promise<GlobalMarketData[]> {
  const snapshot = await fetchGlobalMarketsSnapshot();
  if (type === 'digital') return snapshot.digitalCurrencies;
  if (type === 'forex') return snapshot.forex;
  return snapshot.nasdaq;
}
