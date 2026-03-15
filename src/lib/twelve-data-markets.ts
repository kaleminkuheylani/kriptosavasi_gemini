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
  source: 'twelvedata' | 'fallback';
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
  fallback: Omit<GlobalMarketData, 'symbol' | 'name' | 'market'>;
}

const GLOBAL_INSTRUMENTS: GlobalMarketInstrument[] = [
  {
    providerSymbol: 'BTC/USD',
    symbol: 'BTC/USD',
    name: 'Bitcoin',
    market: 'digital',
    fallback: { price: 84350, change: 620, changePercent: 0.74, high: 84980, low: 83420, open: 83730, previousClose: 83730, volume: 109823 },
  },
  {
    providerSymbol: 'ETH/USD',
    symbol: 'ETH/USD',
    name: 'Ethereum',
    market: 'digital',
    fallback: { price: 3965, change: -18, changePercent: -0.45, high: 4028, low: 3912, open: 3983, previousClose: 3983, volume: 742281 },
  },
  {
    providerSymbol: 'SOL/USD',
    symbol: 'SOL/USD',
    name: 'Solana',
    market: 'digital',
    fallback: { price: 184.6, change: 3.5, changePercent: 1.93, high: 187.4, low: 178.9, open: 181.1, previousClose: 181.1, volume: 1257731 },
  },
  {
    providerSymbol: 'XRP/USD',
    symbol: 'XRP/USD',
    name: 'XRP',
    market: 'digital',
    fallback: { price: 0.634, change: 0.004, changePercent: 0.63, high: 0.641, low: 0.621, open: 0.63, previousClose: 0.63, volume: 2045017 },
  },
  {
    providerSymbol: 'EUR/USD',
    symbol: 'EUR/USD',
    name: 'Euro / US Dollar',
    market: 'forex',
    fallback: { price: 1.0912, change: 0.0012, changePercent: 0.11, high: 1.0935, low: 1.0878, open: 1.09, previousClose: 1.09, volume: 0 },
  },
  {
    providerSymbol: 'GBP/USD',
    symbol: 'GBP/USD',
    name: 'British Pound / US Dollar',
    market: 'forex',
    fallback: { price: 1.2784, change: -0.0016, changePercent: -0.13, high: 1.2822, low: 1.2748, open: 1.28, previousClose: 1.28, volume: 0 },
  },
  {
    providerSymbol: 'USD/JPY',
    symbol: 'USD/JPY',
    name: 'US Dollar / Japanese Yen',
    market: 'forex',
    fallback: { price: 149.23, change: 0.41, changePercent: 0.28, high: 149.58, low: 148.71, open: 148.82, previousClose: 148.82, volume: 0 },
  },
  {
    providerSymbol: 'USD/TRY',
    symbol: 'USD/TRY',
    name: 'US Dollar / Turkish Lira',
    market: 'forex',
    fallback: { price: 36.81, change: 0.17, changePercent: 0.46, high: 36.85, low: 36.54, open: 36.64, previousClose: 36.64, volume: 0 },
  },
  {
    providerSymbol: 'AAPL',
    symbol: 'AAPL',
    name: 'Apple',
    market: 'nasdaq',
    fallback: { price: 214.9, change: 1.8, changePercent: 0.84, high: 216.1, low: 211.8, open: 213.2, previousClose: 213.1, volume: 53182544 },
  },
  {
    providerSymbol: 'MSFT',
    symbol: 'MSFT',
    name: 'Microsoft',
    market: 'nasdaq',
    fallback: { price: 421.6, change: -2.4, changePercent: -0.57, high: 425.9, low: 418.2, open: 423.9, previousClose: 424.0, volume: 22193752 },
  },
  {
    providerSymbol: 'NVDA',
    symbol: 'NVDA',
    name: 'NVIDIA',
    market: 'nasdaq',
    fallback: { price: 962.4, change: 15.2, changePercent: 1.6, high: 971.8, low: 943.4, open: 949.6, previousClose: 947.2, volume: 44701983 },
  },
  {
    providerSymbol: 'AMZN',
    symbol: 'AMZN',
    name: 'Amazon',
    market: 'nasdaq',
    fallback: { price: 181.3, change: 0.9, changePercent: 0.5, high: 182.6, low: 178.7, open: 179.8, previousClose: 180.4, volume: 31754422 },
  },
];

const CACHE_DURATION = 60 * 1000;
let cachedSnapshot: GlobalMarketsSnapshot | null = null;
let lastFetchTime = 0;

function parseNumeric(value: string | number | undefined, fallback: number): number {
  if (value === undefined || value === null || value === '') return fallback;
  const raw = typeof value === 'number' ? value : Number.parseFloat(String(value).replace(',', '.'));
  return Number.isFinite(raw) ? raw : fallback;
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

function toGlobalMarketData(instrument: GlobalMarketInstrument, quote?: TwelveDataQuote): GlobalMarketData {
  const fallback = instrument.fallback;
  if (!quote || quote.status === 'error') {
    return {
      symbol: instrument.symbol,
      name: instrument.name,
      market: instrument.market,
      ...fallback,
    };
  }

  const price = parseNumeric(quote.close, fallback.price);
  const previousClose = parseNumeric(quote.previous_close, fallback.previousClose);
  const derivedChange = price - previousClose;
  const change = parseNumeric(quote.change, derivedChange);
  const derivedPercent = previousClose === 0 ? fallback.changePercent : (change / previousClose) * 100;
  const changePercent = parseNumeric(quote.percent_change, derivedPercent);

  return {
    symbol: instrument.symbol,
    name: instrument.name,
    market: instrument.market,
    price,
    change,
    changePercent,
    high: parseNumeric(quote.high, fallback.high),
    low: parseNumeric(quote.low, fallback.low),
    open: parseNumeric(quote.open, fallback.open),
    previousClose,
    volume: Math.round(parseNumeric(quote.volume, fallback.volume)),
  };
}

function buildFallbackSnapshot(): GlobalMarketsSnapshot {
  const data = GLOBAL_INSTRUMENTS.map(instrument => toGlobalMarketData(instrument));
  return {
    digitalCurrencies: data.filter(item => item.market === 'digital'),
    forex: data.filter(item => item.market === 'forex'),
    nasdaq: data.filter(item => item.market === 'nasdaq'),
    source: 'fallback',
    timestamp: new Date().toISOString(),
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
  const merged = GLOBAL_INSTRUMENTS.map(instrument => {
    const quote =
      quoteMap[instrument.providerSymbol] ??
      quoteMap[instrument.symbol] ??
      quoteMap[instrument.providerSymbol.toUpperCase()] ??
      quoteMap[instrument.symbol.toUpperCase()];
    return toGlobalMarketData(instrument, quote);
  });

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

  try {
    const snapshot = await fetchFromTwelveData();
    cachedSnapshot = snapshot;
    lastFetchTime = now;
    return snapshot;
  } catch (error) {
    console.warn('Global market verileri alınamadı, fallback kullanılıyor:', error);
    if (!cachedSnapshot) {
      cachedSnapshot = buildFallbackSnapshot();
      lastFetchTime = now;
    }
    return cachedSnapshot;
  }
}

export async function fetchGlobalMarketByType(type: GlobalMarketType): Promise<GlobalMarketData[]> {
  const snapshot = await fetchGlobalMarketsSnapshot();
  if (type === 'digital') return snapshot.digitalCurrencies;
  if (type === 'forex') return snapshot.forex;
  return snapshot.nasdaq;
}
