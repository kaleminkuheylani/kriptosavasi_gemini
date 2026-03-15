import { NextRequest, NextResponse } from 'next/server';
import { fetchCryptoSnapshot, type CryptoAsset } from '@/lib/coinmarketcap';

type SortField = 'marketCap' | 'volume24h' | 'percentChange24h' | 'percentChange7d' | 'momentumScore' | 'volatilityScore' | 'liquidityScore' | 'rank';
type SortDirection = 'asc' | 'desc';
type RiskFilter = 'all' | 'low' | 'medium' | 'high';

function compareValues(a: number, b: number, direction: SortDirection): number {
  return direction === 'asc' ? a - b : b - a;
}

function sortAssets(assets: CryptoAsset[], field: SortField, direction: SortDirection): CryptoAsset[] {
  const sorted = [...assets];
  sorted.sort((a, b) => {
    if (field === 'momentumScore') return compareValues(a.analysis.momentumScore, b.analysis.momentumScore, direction);
    if (field === 'volatilityScore') return compareValues(a.analysis.volatilityScore, b.analysis.volatilityScore, direction);
    if (field === 'liquidityScore') return compareValues(a.analysis.liquidityScore, b.analysis.liquidityScore, direction);
    return compareValues(a[field], b[field], direction);
  });
  return sorted;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = Number.parseInt(searchParams.get('limit') ?? '100', 10);
  const convert = (searchParams.get('convert') ?? 'USD').toUpperCase();
  const query = (searchParams.get('query') ?? '').trim().toLowerCase();
  const tag = (searchParams.get('tag') ?? '').trim().toLowerCase();
  const sortBy = (searchParams.get('sortBy') ?? 'marketCap') as SortField;
  const sortDir = (searchParams.get('sortDir') ?? 'desc') as SortDirection;
  const risk = (searchParams.get('risk') ?? 'all') as RiskFilter;
  const minMarketCap = Number.parseFloat(searchParams.get('minMarketCap') ?? '0');
  const minVolume24h = Number.parseFloat(searchParams.get('minVolume24h') ?? '0');

  try {
    const snapshot = await fetchCryptoSnapshot(limit, convert);
    let assets = [...snapshot.assets];

    if (query) {
      assets = assets.filter((asset) => {
        return asset.symbol.toLowerCase().includes(query) || asset.name.toLowerCase().includes(query);
      });
    }

    if (tag) {
      assets = assets.filter((asset) => asset.tags.some((assetTag) => assetTag.toLowerCase().includes(tag)));
    }

    if (risk !== 'all') {
      assets = assets.filter((asset) => asset.analysis.riskLevel === risk);
    }

    if (Number.isFinite(minMarketCap) && minMarketCap > 0) {
      assets = assets.filter((asset) => asset.marketCap >= minMarketCap);
    }

    if (Number.isFinite(minVolume24h) && minVolume24h > 0) {
      assets = assets.filter((asset) => asset.volume24h >= minVolume24h);
    }

    const allowedSortFields: SortField[] = ['marketCap', 'volume24h', 'percentChange24h', 'percentChange7d', 'momentumScore', 'volatilityScore', 'liquidityScore', 'rank'];
    const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'marketCap';
    const safeSortDir: SortDirection = sortDir === 'asc' ? 'asc' : 'desc';
    assets = sortAssets(assets, safeSortBy, safeSortDir);

    return NextResponse.json({
      success: true,
      data: {
        ...snapshot,
        assets,
      },
      filters: {
        query: query || null,
        tag: tag || null,
        risk,
        minMarketCap: Number.isFinite(minMarketCap) ? minMarketCap : 0,
        minVolume24h: Number.isFinite(minVolume24h) ? minVolume24h : 0,
        sortBy: safeSortBy,
        sortDir: safeSortDir,
      },
      count: assets.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Beklenmeyen bir hata olustu';
    console.error('CoinMarketCap /api/crypto hatasi:', error);
    const missingKey =
      message.toLowerCase().includes('api key eksik') ||
      message.toLowerCase().includes('coinmarketcap_api_key eksik');

    return NextResponse.json(
      {
        success: false,
        error: message,
        hint: missingKey
          ? 'CoinMarketCap key tanimla: COINMARKETCAP_API_KEY (alternatif: CMC_API_KEY / CMC_PRO_API_KEY).'
          : 'CoinMarketCap servisi gecici olarak cevap vermiyor olabilir. Biraz sonra tekrar deneyin.',
      },
      { status: 503 },
    );
  }
}
