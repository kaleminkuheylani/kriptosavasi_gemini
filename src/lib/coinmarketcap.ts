export interface CryptoAssetAnalysis {
  momentumScore: number;
  volatilityScore: number;
  liquidityScore: number;
  trend: 'bullish' | 'bearish' | 'sideways';
  riskLevel: 'low' | 'medium' | 'high';
  signal: 'buy' | 'hold' | 'sell';
}

export interface CryptoAsset {
  id: number;
  rank: number;
  name: string;
  symbol: string;
  slug: string;
  tags: string[];
  price: number;
  marketCap: number;
  marketCapDominance: number;
  fullyDilutedMarketCap: number;
  volume24h: number;
  volumeChange24h: number;
  circulatingSupply: number;
  totalSupply: number;
  maxSupply: number | null;
  percentChange1h: number;
  percentChange24h: number;
  percentChange7d: number;
  percentChange30d: number;
  percentChange60d: number;
  percentChange90d: number;
  analysis: CryptoAssetAnalysis;
}

export interface CryptoSnapshot {
  source: 'coinmarketcap' | 'coingecko-fallback';
  convert: string;
  timestamp: string;
  market: {
    totalMarketCap: number;
    totalVolume24h: number;
    marketCapChange24h: number;
    btcDominance: number;
    ethDominance: number;
    activeCryptocurrencies: number;
    activeMarketPairs: number;
    positive24hCount: number;
    negative24hCount: number;
    advanceDeclineRatio: number;
  };
  analysis: {
    overallMomentum: number;
    overallVolatility: number;
    overallLiquidity: number;
    highRiskAssets: Array<Pick<CryptoAsset, 'symbol' | 'name'> & { riskLevel: CryptoAssetAnalysis['riskLevel']; volatilityScore: number }>;
    topMomentum: Array<Pick<CryptoAsset, 'symbol' | 'name' | 'rank'> & { momentumScore: number }>;
    topLiquidity: Array<Pick<CryptoAsset, 'symbol' | 'name' | 'rank'> & { liquidityScore: number }>;
  };
  assets: CryptoAsset[];
}

interface CmcResponse<T> {
  status?: {
    error_code?: number;
    error_message?: string;
  };
  data: T;
}

interface CmcQuote {
  price?: number;
  volume_24h?: number;
  volume_change_24h?: number;
  percent_change_1h?: number;
  percent_change_24h?: number;
  percent_change_7d?: number;
  percent_change_30d?: number;
  percent_change_60d?: number;
  percent_change_90d?: number;
  market_cap?: number;
  market_cap_dominance?: number;
  fully_diluted_market_cap?: number;
}

interface CmcListingItem {
  id: number;
  name: string;
  symbol: string;
  slug: string;
  cmc_rank: number;
  tags?: string[];
  circulating_supply?: number;
  total_supply?: number;
  max_supply?: number | null;
  quote: Record<string, CmcQuote | undefined>;
}

interface CmcGlobalMetrics {
  active_cryptocurrencies?: number;
  active_market_pairs?: number;
  btc_dominance?: number;
  eth_dominance?: number;
  total_market_cap?: Record<string, number | undefined>;
  total_volume_24h?: Record<string, number | undefined>;
  market_cap_change_percentage_24h_usd?: number;
}

interface CoinGeckoMarketItem {
  id?: string;
  symbol?: string;
  name?: string;
  market_cap_rank?: number;
  current_price?: number;
  market_cap?: number;
  fully_diluted_valuation?: number;
  total_volume?: number;
  circulating_supply?: number;
  total_supply?: number;
  max_supply?: number | null;
  price_change_percentage_1h_in_currency?: number;
  price_change_percentage_24h_in_currency?: number;
  price_change_percentage_7d_in_currency?: number;
  price_change_percentage_30d_in_currency?: number;
  price_change_percentage_60d_in_currency?: number;
  price_change_percentage_90d_in_currency?: number;
}

interface CoinGeckoGlobalResponse {
  data?: {
    active_cryptocurrencies?: number;
    markets?: number;
    total_market_cap?: Record<string, number | undefined>;
    total_volume?: Record<string, number | undefined>;
    market_cap_percentage?: Record<string, number | undefined>;
    market_cap_change_percentage_24h_usd?: number;
  };
}

interface SnapshotMarketStats {
  totalMarketCap: number;
  totalVolume24h: number;
  marketCapChange24h: number;
  btcDominance: number;
  ethDominance: number;
  activeCryptocurrencies: number;
  activeMarketPairs: number;
}

const API_BASE = 'https://pro-api.coinmarketcap.com';
const CACHE_DURATION_MS = 60 * 1000;
const API_KEY_ENV_NAMES = [
  'COINMARKETCAP_API_KEY',
  'CMC_API_KEY',
  'CMC_PRO_API_KEY',
  'NEXT_PUBLIC_COINMARKETCAP_API_KEY',
  'NEXT_PUBLIC_CMC_API_KEY',
] as const;

let cachedSnapshot: CryptoSnapshot | null = null;
let cachedAt = 0;

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeScore(value: number, min: number, max: number): number {
  if (max <= min) return 50;
  const scaled = ((value - min) / (max - min)) * 100;
  return Math.round(clamp(scaled, 0, 100));
}

function buildAnalysis(coin: {
  percentChange1h: number;
  percentChange24h: number;
  percentChange7d: number;
  percentChange30d: number;
  marketCap: number;
  volume24h: number;
}): CryptoAssetAnalysis {
  const weightedMomentum =
    coin.percentChange1h * 0.1 +
    coin.percentChange24h * 0.25 +
    coin.percentChange7d * 0.4 +
    coin.percentChange30d * 0.25;
  const momentumScore = normalizeScore(weightedMomentum, -35, 35);

  const realizedVolatility =
    Math.abs(coin.percentChange1h) * 0.15 +
    Math.abs(coin.percentChange24h) * 0.35 +
    Math.abs(coin.percentChange7d) * 0.35 +
    Math.abs(coin.percentChange30d) * 0.15;
  const volatilityScore = normalizeScore(realizedVolatility, 0, 25);

  const volumeToMarketCap = coin.marketCap > 0 ? coin.volume24h / coin.marketCap : 0;
  const liquidityBlend = volumeToMarketCap * 100 + Math.log10(Math.max(coin.marketCap, 1)) * 8;
  const liquidityScore = normalizeScore(liquidityBlend, 10, 90);

  let trend: CryptoAssetAnalysis['trend'] = 'sideways';
  if (coin.percentChange24h > 1 && coin.percentChange7d > 2) trend = 'bullish';
  if (coin.percentChange24h < -1 && coin.percentChange7d < -2) trend = 'bearish';

  let riskLevel: CryptoAssetAnalysis['riskLevel'] = 'low';
  if (volatilityScore > 70 || liquidityScore < 35) riskLevel = 'high';
  else if (volatilityScore > 45 || liquidityScore < 55) riskLevel = 'medium';

  let signal: CryptoAssetAnalysis['signal'] = 'hold';
  if (momentumScore >= 65 && riskLevel !== 'high') signal = 'buy';
  else if (momentumScore <= 35 || trend === 'bearish') signal = 'sell';

  return {
    momentumScore,
    volatilityScore,
    liquidityScore,
    trend,
    riskLevel,
    signal,
  };
}

async function coinMarketCapFetch<T>(path: string, params: Record<string, string | number>): Promise<T> {
  const apiKey = API_KEY_ENV_NAMES
    .map((name) => process.env[name])
    .find((value) => typeof value === 'string' && value.trim().length > 0)
    ?.trim();

  if (!apiKey) {
    throw new Error(`CoinMarketCap API key eksik. Desteklenen env: ${API_KEY_ENV_NAMES.join(', ')}`);
  }

  const url = new URL(`${API_BASE}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }

  let response: Response | null = null;
  let lastBody = '';
  let lastStatus = 0;

  for (let attempt = 0; attempt < 3; attempt++) {
    response = await fetch(url, {
      headers: {
        'X-CMC_PRO_API_KEY': apiKey,
        Accept: 'application/json',
      },
      cache: 'no-store',
    });

    if (response.ok) break;

    lastStatus = response.status;
    lastBody = await response.text();
    const shouldRetry = response.status === 429 || response.status >= 500;

    if (!shouldRetry || attempt === 2) {
      throw new Error(`CoinMarketCap HTTP ${response.status}: ${lastBody.slice(0, 220)}`);
    }

    const waitMs = (attempt + 1) * 400;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  if (!response) {
    throw new Error(
      `CoinMarketCap yanit vermedi${lastStatus ? ` (HTTP ${lastStatus})` : ''}${lastBody ? `: ${lastBody.slice(0, 180)}` : ''}`,
    );
  }

  const payload = (await response.json()) as CmcResponse<T>;
  if (payload.status?.error_code && payload.status.error_code !== 0) {
    throw new Error(payload.status.error_message ?? 'CoinMarketCap API hatası');
  }

  return payload.data;
}

async function fetchListings(limit: number, convert: string): Promise<CryptoAsset[]> {
  const data = await coinMarketCapFetch<CmcListingItem[]>('/v1/cryptocurrency/listings/latest', {
    start: 1,
    limit,
    convert,
    sort: 'market_cap',
    sort_dir: 'desc',
  });

  return data
    .map((item) => {
      const quote = item.quote?.[convert];
      if (!quote) return null;

      const mapped = {
        id: item.id,
        rank: toNumber(item.cmc_rank),
        name: item.name,
        symbol: item.symbol,
        slug: item.slug,
        tags: item.tags ?? [],
        price: toNumber(quote.price),
        marketCap: toNumber(quote.market_cap),
        marketCapDominance: toNumber(quote.market_cap_dominance),
        fullyDilutedMarketCap: toNumber(quote.fully_diluted_market_cap),
        volume24h: toNumber(quote.volume_24h),
        volumeChange24h: toNumber(quote.volume_change_24h),
        circulatingSupply: toNumber(item.circulating_supply),
        totalSupply: toNumber(item.total_supply),
        maxSupply: item.max_supply === null || item.max_supply === undefined ? null : toNumber(item.max_supply),
        percentChange1h: toNumber(quote.percent_change_1h),
        percentChange24h: toNumber(quote.percent_change_24h),
        percentChange7d: toNumber(quote.percent_change_7d),
        percentChange30d: toNumber(quote.percent_change_30d),
        percentChange60d: toNumber(quote.percent_change_60d),
        percentChange90d: toNumber(quote.percent_change_90d),
      };

      return {
        ...mapped,
        analysis: buildAnalysis(mapped),
      } as CryptoAsset;
    })
    .filter((item): item is CryptoAsset => Boolean(item));
}

async function fetchGlobalMetrics(convert: string): Promise<CmcGlobalMetrics> {
  return coinMarketCapFetch<CmcGlobalMetrics>('/v1/global-metrics/quotes/latest', {
    convert,
  });
}

async function fetchCoinGeckoSnapshot(limit: number, convert: string): Promise<CryptoSnapshot> {
  const vsCurrency = convert.toLowerCase();
  const marketsUrl = new URL('https://api.coingecko.com/api/v3/coins/markets');
  marketsUrl.searchParams.set('vs_currency', vsCurrency);
  marketsUrl.searchParams.set('order', 'market_cap_desc');
  marketsUrl.searchParams.set('per_page', String(clamp(limit, 10, 200)));
  marketsUrl.searchParams.set('page', '1');
  marketsUrl.searchParams.set('sparkline', 'false');
  marketsUrl.searchParams.set('price_change_percentage', '1h,24h,7d,30d,60d,90d');

  const [marketsResponse, globalResponse] = await Promise.all([
    fetch(marketsUrl, { cache: 'no-store' }),
    fetch('https://api.coingecko.com/api/v3/global', { cache: 'no-store' }),
  ]);

  if (!marketsResponse.ok) {
    throw new Error(`CoinGecko markets HTTP ${marketsResponse.status}`);
  }
  if (!globalResponse.ok) {
    throw new Error(`CoinGecko global HTTP ${globalResponse.status}`);
  }

  const markets = (await marketsResponse.json()) as CoinGeckoMarketItem[];
  const globalPayload = (await globalResponse.json()) as CoinGeckoGlobalResponse;
  if (!Array.isArray(markets) || markets.length === 0) {
    throw new Error('CoinGecko gecerli market verisi donmedi');
  }

  const assets = markets
    .map((item, index) => {
      const rank = Math.max(1, Math.round(toNumber(item.market_cap_rank, index + 1)));
      const symbol = (item.symbol ?? `asset-${rank}`).toUpperCase();
      const mapped = {
        id: rank,
        rank,
        name: item.name ?? symbol,
        symbol,
        slug: item.id ?? symbol.toLowerCase(),
        tags: [] as string[],
        price: toNumber(item.current_price),
        marketCap: toNumber(item.market_cap),
        marketCapDominance: 0,
        fullyDilutedMarketCap: toNumber(item.fully_diluted_valuation),
        volume24h: toNumber(item.total_volume),
        volumeChange24h: 0,
        circulatingSupply: toNumber(item.circulating_supply),
        totalSupply: toNumber(item.total_supply),
        maxSupply: item.max_supply === null || item.max_supply === undefined ? null : toNumber(item.max_supply),
        percentChange1h: toNumber(item.price_change_percentage_1h_in_currency),
        percentChange24h: toNumber(item.price_change_percentage_24h_in_currency),
        percentChange7d: toNumber(item.price_change_percentage_7d_in_currency),
        percentChange30d: toNumber(item.price_change_percentage_30d_in_currency),
        percentChange60d: toNumber(item.price_change_percentage_60d_in_currency),
        percentChange90d: toNumber(item.price_change_percentage_90d_in_currency),
      };

      return {
        ...mapped,
        analysis: buildAnalysis(mapped),
      } as CryptoAsset;
    })
    .filter((asset) => asset.marketCap > 0 || asset.price > 0);

  if (assets.length === 0) {
    throw new Error('CoinGecko sonuclarindan islenebilir coin bulunamadi');
  }

  const marketStats: SnapshotMarketStats = {
    totalMarketCap: toNumber(globalPayload.data?.total_market_cap?.[vsCurrency]),
    totalVolume24h: toNumber(globalPayload.data?.total_volume?.[vsCurrency]),
    marketCapChange24h: toNumber(globalPayload.data?.market_cap_change_percentage_24h_usd),
    btcDominance: toNumber(globalPayload.data?.market_cap_percentage?.btc),
    ethDominance: toNumber(globalPayload.data?.market_cap_percentage?.eth),
    activeCryptocurrencies: toNumber(globalPayload.data?.active_cryptocurrencies),
    activeMarketPairs: toNumber(globalPayload.data?.markets),
  };

  return buildSnapshot('coingecko-fallback', convert.toUpperCase(), assets, marketStats);
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function buildSnapshot(source: CryptoSnapshot['source'], convert: string, assets: CryptoAsset[], market: SnapshotMarketStats): CryptoSnapshot {
  const positive24hCount = assets.filter((asset) => asset.percentChange24h > 0).length;
  const negative24hCount = assets.filter((asset) => asset.percentChange24h < 0).length;
  const highRiskAssets = assets
    .filter((asset) => asset.analysis.riskLevel === 'high')
    .sort((a, b) => b.analysis.volatilityScore - a.analysis.volatilityScore)
    .slice(0, 8)
    .map((asset) => ({
      symbol: asset.symbol,
      name: asset.name,
      riskLevel: asset.analysis.riskLevel,
      volatilityScore: asset.analysis.volatilityScore,
    }));

  return {
    source,
    convert,
    timestamp: new Date().toISOString(),
    market: {
      totalMarketCap: market.totalMarketCap,
      totalVolume24h: market.totalVolume24h,
      marketCapChange24h: market.marketCapChange24h,
      btcDominance: market.btcDominance,
      ethDominance: market.ethDominance,
      activeCryptocurrencies: market.activeCryptocurrencies,
      activeMarketPairs: market.activeMarketPairs,
      positive24hCount,
      negative24hCount,
      advanceDeclineRatio: negative24hCount === 0 ? positive24hCount : +(positive24hCount / negative24hCount).toFixed(2),
    },
    analysis: {
      overallMomentum: Math.round(average(assets.map((asset) => asset.analysis.momentumScore))),
      overallVolatility: Math.round(average(assets.map((asset) => asset.analysis.volatilityScore))),
      overallLiquidity: Math.round(average(assets.map((asset) => asset.analysis.liquidityScore))),
      highRiskAssets,
      topMomentum: [...assets]
        .sort((a, b) => b.analysis.momentumScore - a.analysis.momentumScore)
        .slice(0, 8)
        .map((asset) => ({
          symbol: asset.symbol,
          name: asset.name,
          rank: asset.rank,
          momentumScore: asset.analysis.momentumScore,
        })),
      topLiquidity: [...assets]
        .sort((a, b) => b.analysis.liquidityScore - a.analysis.liquidityScore)
        .slice(0, 8)
        .map((asset) => ({
          symbol: asset.symbol,
          name: asset.name,
          rank: asset.rank,
          liquidityScore: asset.analysis.liquidityScore,
        })),
    },
    assets,
  };
}

export async function fetchCryptoSnapshot(limit = 100, convert = 'USD'): Promise<CryptoSnapshot> {
  const normalizedLimit = clamp(Math.round(limit), 10, 200);
  const normalizedConvert = convert.toUpperCase();

  const now = Date.now();
  if (
    cachedSnapshot &&
    now - cachedAt < CACHE_DURATION_MS &&
    cachedSnapshot.convert === normalizedConvert &&
    cachedSnapshot.assets.length === normalizedLimit
  ) {
    return cachedSnapshot;
  }

  try {
    const [assets, globalMetrics] = await Promise.all([
      fetchListings(normalizedLimit, normalizedConvert),
      fetchGlobalMetrics(normalizedConvert),
    ]);

    if (assets.length === 0) {
      throw new Error('CoinMarketCap gecerli veri donmedi');
    }

    const snapshot = buildSnapshot('coinmarketcap', normalizedConvert, assets, {
      totalMarketCap: toNumber(globalMetrics.total_market_cap?.[normalizedConvert]),
      totalVolume24h: toNumber(globalMetrics.total_volume_24h?.[normalizedConvert]),
      marketCapChange24h: toNumber(globalMetrics.market_cap_change_percentage_24h_usd),
      btcDominance: toNumber(globalMetrics.btc_dominance),
      ethDominance: toNumber(globalMetrics.eth_dominance),
      activeCryptocurrencies: toNumber(globalMetrics.active_cryptocurrencies),
      activeMarketPairs: toNumber(globalMetrics.active_market_pairs),
    });

    cachedSnapshot = snapshot;
    cachedAt = now;
    return snapshot;
  } catch (error) {
    try {
      const fallbackSnapshot = await fetchCoinGeckoSnapshot(normalizedLimit, normalizedConvert);
      cachedSnapshot = fallbackSnapshot;
      cachedAt = now;
      return fallbackSnapshot;
    } catch (fallbackError) {
      const originalMessage = error instanceof Error ? error.message : 'CoinMarketCap hatasi';
      const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : 'CoinGecko fallback hatasi';

      if (cachedSnapshot && cachedSnapshot.convert === normalizedConvert) {
        return cachedSnapshot;
      }

      throw new Error(`Kripto veri kaynaklarina ulasilamadi. CMC: ${originalMessage}. CoinGecko: ${fallbackMessage}`);
    }
  }
}
