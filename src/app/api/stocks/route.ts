import { NextResponse } from 'next/server';

interface StockData {
  code: string;
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

// Cache for stock data (5 minutes)
let cachedStocks: StockData[] = [];
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

async function fetchStockDetails(symbol: string): Promise<StockData | null> {
  try {
    const response = await fetch(`https://api.asenax.com/bist/get/${symbol}`, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) return null;

    const data = await response.json();

    if (data.code === "0" && data.data?.hisseYuzeysel) {
      const detail = data.data.hisseYuzeysel;
      return {
        code: detail.sembol || symbol,
        name: detail.aciklama || symbol,
        price: detail.kapanis || detail.satis || 0,
        change: detail.net || 0,
        changePercent: detail.yuzdedegisim || 0,
        volume: detail.hacimlot || 0,
        high: detail.yuksek || 0,
        low: detail.dusuk || 0,
        open: detail.acilis || 0,
        previousClose: detail.dunkukapanis || detail.oncekikapanis || 0,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function GET() {
  const now = Date.now();

  // Return cached data if still valid
  if (cachedStocks.length > 0 && (now - lastFetchTime) < CACHE_DURATION) {
    return NextResponse.json({
      success: true,
      data: cachedStocks,
      count: cachedStocks.length,
      timestamp: new Date(lastFetchTime).toISOString(),
      source: 'asenax-cached'
    });
  }

  try {
    // Fetch stock list
    const listResponse = await fetch('https://api.asenax.com/bist/list', {
      headers: { 'Accept': 'application/json' },
    });

    if (!listResponse.ok) {
      throw new Error(`Asenax list API error: ${listResponse.status}`);
    }

    const listData = await listResponse.json();

    let stockCodes: { code: string; name: string }[] = [];

    if (listData.code === "0" && Array.isArray(listData.data)) {
      stockCodes = listData.data
        .filter((item: { kod?: string; ad?: string; tip?: string }) => item.tip === "Hisse")
        .map((item: { kod?: string; ad?: string }) => ({
          code: item.kod || '',
          name: item.ad || '',
        }))
        .filter((item: { code: string }) => item.code);
    }

    // Fetch details for top 100 stocks in parallel batches
    const BATCH_SIZE = 20;
    const stocks: StockData[] = [];
    const topStocks = stockCodes.slice(0, 150); // Get top 150 stocks

    for (let i = 0; i < topStocks.length; i += BATCH_SIZE) {
      const batch = topStocks.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map(async (stock) => {
          const detail = await fetchStockDetails(stock.code);
          if (detail) {
            return detail;
          }
          // Return basic info if detail fetch fails
          return {
            code: stock.code,
            name: stock.name,
            price: 0,
            change: 0,
            changePercent: 0,
            volume: 0,
            high: 0,
            low: 0,
            open: 0,
            previousClose: 0,
          } as StockData;
        })
      );
      stocks.push(...results.filter((s): s is StockData => s !== null));
    }

    // Filter out stocks with no price
    const validStocks = stocks.filter(stock => stock.price > 0);

    // Update cache
    cachedStocks = validStocks;
    lastFetchTime = now;

    return NextResponse.json({
      success: true,
      data: validStocks,
      count: validStocks.length,
      timestamp: new Date().toISOString(),
      source: 'asenax'
    });

  } catch (error) {
    console.error('Stock fetch error:', error);

    // Return cached data if available even if expired
    if (cachedStocks.length > 0) {
      return NextResponse.json({
        success: true,
        data: cachedStocks,
        count: cachedStocks.length,
        timestamp: new Date(lastFetchTime).toISOString(),
        source: 'asenax-stale-cache'
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Hisse verileri alınamadı. Lütfen daha sonra tekrar deneyin.',
      data: [],
      count: 0
    }, { status: 500 });
  }
}
