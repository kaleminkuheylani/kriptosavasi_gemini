import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

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
  sector?: string;
}

// Hisse sektorleri - genisletilmis liste
const STOCK_SECTORS: Record<string, string> = {
  // Bankacilik
  'GARAN': 'Bankacilik', 'AKBNK': 'Bankacilik', 'ISCTR': 'Bankacilik',
  'YKBNK': 'Bankacilik', 'HALKB': 'Bankacilik', 'VAKBN': 'Bankacilik',
  'SKBNK': 'Bankacilik', 'TSKB': 'Bankacilik', 'CTRP': 'Bankacilik',
  'QNBFB': 'Bankacilik', 'ABDHH': 'Bankacilik', 'ALBRK': 'Bankacilik',
  
  // Holding
  'KCHOL': 'Holding', 'SAHOL': 'Holding', 'EKGYO': 'Holding',
  'KONTR': 'Holding', 'MGROS': 'Holding', 'DOHOL': 'Holding',
  'SAYAS': 'Holding', 'AYES': 'Holding', 'BAGFS': 'Holding',
  
  // Teknoloji
  'ASELS': 'Teknoloji', 'TKFEN': 'Teknoloji', 'LINK': 'Teknoloji',
  'VESTL': 'Teknoloji', 'ARCLK': 'Teknoloji', 'FROTO': 'Otomotiv',
  'THYAO': 'Havacilik', 'PGSUS': 'Havacilik', 'KRBOL': 'Teknoloji',
  'LOGO': 'Teknoloji', 'NETAS': 'Teknoloji', 'INDAT': 'Teknoloji',
  'DEVA': 'Saglik', 'SELEC': 'Teknoloji', 'ATES': 'Teknoloji',
  
  // Otomotiv
  'TOASO': 'Otomotiv', 'FROTO': 'Otomotiv', 'TMSNZ': 'Otomotiv',
  'BMC': 'Otomotiv', 'OYAKC': 'Otomotiv', 'MAVI': 'Tekstil',
  
  // Enerji
  'TUPRS': 'Enerji', 'PETKM': 'Enerji', 'DESA': 'Enerji',
  'AYGAZ': 'Enerji', 'IPO': 'Enerji', 'ZOREN': 'Enerji',
  'AKSEN': 'Enerji', 'GEN': 'Enerji', 'TRILC': 'Enerji',
  'TSGYO': 'Enerji', 'KUTPO': 'Enerji', 'SAYGY': 'Enerji',
  
  // Gida
  'ULKER': 'Gida', 'TUKAS': 'Gida', 'KONFR': 'Gida', 'TARAF': 'Gida',
  'KLRFS': 'Gida', 'EREGL': 'Gida', 'BALAT': 'Gida', 'KERVN': 'Gida',
  'PKENT': 'Gida', 'ETILR': 'Gida', 'KIPA': 'Gida', 'MARTI': 'Gida',
  
  // Insaat
  'ENKAI': 'Insaat', 'GUBRF': 'Insaat', 'EGEEN': 'Insaat',
  'HEKTS': 'Insaat', 'YAPI': 'Insaat', 'ASFEN': 'Insaat',
  'CIMSA': 'Insaat', 'KONYA': 'Insaat', 'TUKTK': 'Insaat',
  
  // Tekstil
  'SISE': 'Tekstil', 'KARSN': 'Tekstil', 'SANKO': 'Tekstil',
  'BANVT': 'Tekstil', 'ADANA': 'Tekstil', 'FENIS': 'Tekstil',
  'POLHO': 'Tekstil', 'KRDMD': 'Metal', 'ERBOS': 'Metal',
  
  // Telekomunikasyon
  'TCELL': 'Telekomunikasyon', 'TKCELL': 'Telekomunikasyon',
  'TEBNK': 'Telekomunikasyon', 'TURHL': 'Telekomunikasyon',
  
  // Icecek
  'CCOLA': 'Icecek', 'MEYGS': 'Icecek', 'ANHYT': 'Icecek',
  'BFREN': 'Icecek', 'PNSUT': 'Icecek', 'KONFR': 'Gida',
  
  // Turizm
  'METUR': 'Turizm', 'MAVI': 'Tekstil', 'NTTUR': 'Turizm',
  'AVTUR': 'Turizm', 'IHEM': 'Turizm', 'VKFYO': 'Turizm',
  
  // Metal
  'KRDMD': 'Metal', 'ERBOS': 'Metal', 'IZMDC': 'Metal',
  'BURCE': 'Metal', 'DAGHL': 'Metal', 'METUR': 'Turizm',
  
  // Savunma
  'ASELS': 'Savunma', 'OTKAR': 'Savunma', 'FNMA': 'Savunma',
  'HAVEL': 'Savunma', 'SNKRN': 'Savunma',
  
  // Sigortacilik
  'AKGRT': 'Sigortacilik', 'ANHYT': 'Sigortacilik', 'GARAN': 'Bankacilik',
  
  // Emlak
  'ISGYO': 'Emlak', 'AKFGY': 'Emlak', 'YYLGY': 'Emlak',
  'SOKE': 'Emlak', 'EGEEN': 'Insaat', 'KAPLM': 'Emlak',
  
  // Perakende
  'MGROS': 'Perakende', 'SOKM': 'Perakende', 'BIMAS': 'Perakende',
  'KIPA': 'Perakende', 'CARFB': 'Perakende', 'TKFEN': 'Teknoloji',
};

// Use stocks API instead of duplicating fetch logic
async function fetchAllStocks(): Promise<StockData[]> {
  try {
    const response = await fetch('http://localhost:3000/api/stocks');
    const data = await response.json();
    if (data.success && Array.isArray(data.data)) {
      return data.data.map((s: StockData) => ({
        ...s,
        sector: STOCK_SECTORS[s.code] || 'Diger',
      }));
    }
  } catch (error) {
    console.error('Failed to fetch stocks:', error);
  }
  return [];
}

// GET /api/market - Market summary
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const symbol = searchParams.get('symbol'); // For similar stocks
  
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
  
  // Get most active (by volume)
  if (type === 'active') {
    const active = [...stocks]
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 20);

    return NextResponse.json({
      success: true,
      data: active.map(s => ({
        symbol: s.code,
        name: s.name,
        price: s.price,
        change: s.change,
        changePercent: s.changePercent,
        volume: s.volume,
        sector: s.sector || 'Diger',
      })),
      count: active.length,
      timestamp: new Date().toISOString(),
    });
  }

  // Get popular (most added to watchlist)
  if (type === 'popular') {
    try {
      const popularStocks = await db.watchlistItem.groupBy({
        by: ['symbol', 'name'],
        _count: {
          symbol: true,
        },
        orderBy: {
          _count: {
            symbol: 'desc',
          },
        },
        take: 10,
      });
      
      const popularWithData = popularStocks.map(item => {
        const stockData = stocks.find(s => s.code === item.symbol);
        return {
          symbol: item.symbol,
          name: item.name,
          count: item._count.symbol,
          price: stockData?.price || 0,
          changePercent: stockData?.changePercent || 0,
        };
      });
      
      return NextResponse.json({
        success: true,
        data: popularWithData,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      return NextResponse.json({
        success: false,
        error: 'Popular stocks fetch failed',
        data: [],
      });
    }
  }
  
  // Get sectors/categories
  if (type === 'sectors') {
    const sectorMap = new Map<string, { count: number; stocks: StockData[] }>();
    
    for (const stock of stocks) {
      const sector = stock.sector || 'Diger';
      if (!sectorMap.has(sector)) {
        sectorMap.set(sector, { count: 0, stocks: [] });
      }
      const sectorData = sectorMap.get(sector)!;
      sectorData.count++;
      if (sectorData.stocks.length < 5) {
        sectorData.stocks.push(stock);
      }
    }
    
    const sectors = Array.from(sectorMap.entries())
      .map(([name, data]) => ({
        name,
        count: data.count,
        avgChange: data.stocks.length > 0 
          ? data.stocks.reduce((sum, s) => sum + s.changePercent, 0) / data.stocks.length 
          : 0,
        topStocks: data.stocks.slice(0, 5),
      }))
      .sort((a, b) => b.count - a.count);
    
    return NextResponse.json({
      success: true,
      data: sectors,
      timestamp: new Date().toISOString(),
    });
  }
  
  // Get similar stocks (same sector)
  if (type === 'similar' && symbol) {
    const symbols = symbol.toUpperCase().split(',').map(s => s.trim());
    
    // Find all sectors from the given symbols
    const targetSectors = new Set<string>();
    for (const sym of symbols) {
      const stock = stocks.find(s => s.code === sym);
      if (stock?.sector) {
        targetSectors.add(stock.sector);
      }
    }
    
    if (targetSectors.size === 0) {
      return NextResponse.json({
        success: false,
        error: 'Stocks not found',
        data: [],
      });
    }
    
    // Find similar stocks from those sectors, excluding the given symbols
    const similarStocks = stocks
      .filter(s => !symbols.includes(s.code) && s.sector && targetSectors.has(s.sector))
      .slice(0, 5);
    
    return NextResponse.json({
      success: true,
      data: similarStocks,
      sectors: Array.from(targetSectors),
      timestamp: new Date().toISOString(),
    });
  }
  
  // Get recommended stocks based on user's watchlist
  if (type === 'recommended') {
    const userSymbols = searchParams.get('symbols')?.split(',').map(s => s.trim().toUpperCase()).filter(s => s) || [];
    
    if (userSymbols.length === 0) {
      // Return top gainers if no user symbols
      const topGainers = [...stocks]
        .filter(s => s.changePercent > 0)
        .sort((a, b) => b.changePercent - a.changePercent)
        .slice(0, 5);
      
      return NextResponse.json({
        success: true,
        data: topGainers,
        reason: 'top_gainers',
        timestamp: new Date().toISOString(),
      });
    }
    
    // Find user's stocks with sectors
    const userStocks = userSymbols
      .map(sym => stocks.find(s => s.code === sym))
      .filter((s): s is StockData => s !== undefined);
    
    // Find user's sectors
    const userSectors = new Map<string, number>();
    for (const stock of userStocks) {
      if (stock.sector) {
        userSectors.set(stock.sector, (userSectors.get(stock.sector) || 0) + 1);
      }
    }
    
    // Sort sectors by frequency
    const topSectors = [...userSectors.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([sector]) => sector);
    
    // Calculate average performance of user's watchlist
    const avgPerformance = userStocks.length > 0
      ? userStocks.reduce((sum, s) => sum + s.changePercent, 0) / userStocks.length
      : 0;
    
    // Find similar stocks from those sectors (excluding user's stocks)
    let recommended = stocks
      .filter(s => !userSymbols.includes(s.code) && s.sector && topSectors.includes(s.sector))
      .sort((a, b) => {
        // Prioritize stocks from most common sectors
        const aIndex = topSectors.indexOf(a.sector || '');
        const bIndex = topSectors.indexOf(b.sector || '');
        if (aIndex !== bIndex) return aIndex - bIndex;
        // Then sort by change percent
        return b.changePercent - a.changePercent;
      });
    
    // If not enough sector matches, add stocks with similar performance
    if (recommended.length < 5) {
      const performanceRange = 5; // +/- 5% range
      const similarPerformance = stocks
        .filter(s => 
          !userSymbols.includes(s.code) && 
          !recommended.find(r => r.code === s.code) &&
          Math.abs(s.changePercent - avgPerformance) <= performanceRange
        )
        .sort((a, b) => Math.abs(a.changePercent - avgPerformance) - Math.abs(b.changePercent - avgPerformance));
      
      recommended = [...recommended, ...similarPerformance];
    }
    
    // If still not enough, add top gainers
    if (recommended.length < 5) {
      const topGainers = stocks
        .filter(s => !userSymbols.includes(s.code) && !recommended.find(r => r.code === s.code))
        .sort((a, b) => b.changePercent - a.changePercent);
      
      recommended = [...recommended, ...topGainers];
    }
    
    return NextResponse.json({
      success: true,
      data: recommended.slice(0, 5),
      sectors: topSectors,
      avgPerformance: avgPerformance.toFixed(2),
      timestamp: new Date().toISOString(),
    });
  }
  
  // Default: market summary
  const gainersCount = stocks.filter(s => s.changePercent > 0).length;
  const losersCount = stocks.filter(s => s.changePercent < 0).length;
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
      gainers: gainersCount,
      losers: losersCount,
      unchanged,
      totalVolume,
      avgChangePercent: avgChange.toFixed(2),
      topGainers: topGainers.map(s => ({
        symbol: s.code,
        name: s.name,
        price: s.price,
        changePercent: s.changePercent,
        sector: s.sector,
      })),
      topLosers: topLosers.map(s => ({
        symbol: s.code,
        name: s.name,
        price: s.price,
        changePercent: s.changePercent,
        sector: s.sector,
      })),
      mostActive: mostActive.map(s => ({
        symbol: s.code,
        name: s.name,
        price: s.price,
        volume: s.volume,
        sector: s.sector,
      })),
    },
    timestamp: new Date().toISOString(),
  });
}
