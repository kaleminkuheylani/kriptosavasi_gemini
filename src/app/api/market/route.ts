import { NextRequest, NextResponse } from 'next/server';

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

// Cache for stock data
let cachedStocks: StockData[] = [];
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000;

async function fetchAllStocks(): Promise<StockData[]> {
  const now = Date.now();
  
  if (cachedStocks.length > 0 && (now - lastFetchTime) < CACHE_DURATION) {
    return cachedStocks;
  }
  
  try {
    const response = await fetch('https://api.asenax.com/bist/list', {
      headers: { 'Accept': 'application/json' },
    });
    
    if (!response.ok) return cachedStocks;
    
    const data = await response.json();
    
    if (data.code === "0" && Array.isArray(data.data)) {
      const stockCodes = data.data
        .filter((item: { tip?: string }) => item.tip === "Hisse")
        .map((item: { kod?: string; ad?: string }) => ({
          code: item.kod || '',
          name: item.ad || '',
        }))
        .filter((item: { code: string }) => item.code);
      
      const BATCH_SIZE = 20;
      const stocks: StockData[] = [];
      const topStocks = stockCodes.slice(0, 150);
      
      for (let i = 0; i < topStocks.length; i += BATCH_SIZE) {
        const batch = topStocks.slice(i, i + BATCH_SIZE);
        const results = await Promise.all(
          batch.map(async (stock) => {
            try {
              const detailResponse = await fetch(`https://api.asenax.com/bist/get/${stock.code}`, {
                headers: { 'Accept': 'application/json' },
              });
              
              if (detailResponse.ok) {
                const detailData = await detailResponse.json();
                if (detailData.code === "0" && detailData.data?.hisseYuzeysel) {
                  const d = detailData.data.hisseYuzeysel;
                  return {
                    code: d.sembol || stock.code,
                    name: d.aciklama || stock.name,
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
              return null;
            } catch {
              return null;
            }
          })
        );
        stocks.push(...results.filter((s): s is StockData => s !== null && s.price > 0));
      }
      
      cachedStocks = stocks;
      lastFetchTime = now;
      return stocks;
    }
  } catch (error) {
    console.error('Stock fetch error:', error);
  }
  
  return cachedStocks;
}

// GET /api/market - Market summary
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  
  const stocks = await fetchAllStocks();
  
  // Get gainers
  if (type === 'gainers') {
    const gainers = [...stocks]
      .filter(s => s.changePercent > 0)
      .sort((a, b) => b.changePercent - a.changePercent)
      .slice(0, 20);
    
    return NextResponse.json({
      success: true,
      data: gainers,
      count: gainers.length,
      timestamp: new Date().toISOString(),
    });
  }
  
  // Get losers
  if (type === 'losers') {
    const losers = [...stocks]
      .filter(s => s.changePercent < 0)
      .sort((a, b) => a.changePercent - b.changePercent)
      .slice(0, 20);
    
    return NextResponse.json({
      success: true,
      data: losers,
      count: losers.length,
      timestamp: new Date().toISOString(),
    });
  }
  
  // Default: market summary
  const gainers = stocks.filter(s => s.changePercent > 0).length;
  const losers = stocks.filter(s => s.changePercent < 0).length;
  const unchanged = stocks.filter(s => s.changePercent === 0).length;
  const totalVolume = stocks.reduce((sum, s) => sum + s.volume, 0);
  const avgChange = stocks.length > 0 
    ? stocks.reduce((sum, s) => sum + s.changePercent, 0) / stocks.length 
    : 0;
  
  const topGainers = [...stocks]
    .filter(s => s.changePercent > 0)
    .sort((a, b) => b.changePercent - a.changePercent)
    .slice(0, 5);
  
  const topLosers = [...stocks]
    .filter(s => s.changePercent < 0)
    .sort((a, b) => a.changePercent - b.changePercent)
    .slice(0, 5);
  
  const mostActive = [...stocks]
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 5);
  
  return NextResponse.json({
    success: true,
    data: {
      totalStocks: stocks.length,
      gainers,
      losers,
      unchanged,
      totalVolume,
      avgChangePercent: avgChange.toFixed(2),
      topGainers: topGainers.map(s => ({
        symbol: s.code,
        name: s.name,
        price: s.price,
        changePercent: s.changePercent,
      })),
      topLosers: topLosers.map(s => ({
        symbol: s.code,
        name: s.name,
        price: s.price,
        changePercent: s.changePercent,
      })),
      mostActive: mostActive.map(s => ({
        symbol: s.code,
        name: s.name,
        price: s.price,
        volume: s.volume,
      })),
    },
    timestamp: new Date().toISOString(),
  });
}
