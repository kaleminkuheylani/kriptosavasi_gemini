import { NextRequest, NextResponse } from 'next/server';
import { fetchBistStocks, STOCK_SECTORS } from '@/lib/bist-stocks';
import { fetchGlobalMarketByType, fetchGlobalMarketsSnapshot } from '@/lib/twelve-data-markets';

async function getStocks() {
  const stocks = await fetchBistStocks();
  return stocks.map(s => ({ ...s, sector: STOCK_SECTORS[s.code] ?? 'Diğer' }));
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type   = searchParams.get('type');
  const symbol = searchParams.get('symbol');

  if (type === 'global') {
    const snapshot = await fetchGlobalMarketsSnapshot();
    return NextResponse.json({ success: true, data: snapshot, timestamp: snapshot.timestamp, source: snapshot.source });
  }

  if (type === 'digital' || type === 'crypto') {
    const data = await fetchGlobalMarketByType('digital');
    return NextResponse.json({ success: true, data, count: data.length, timestamp: new Date().toISOString() });
  }

  if (type === 'forex') {
    const data = await fetchGlobalMarketByType('forex');
    return NextResponse.json({ success: true, data, count: data.length, timestamp: new Date().toISOString() });
  }

  if (type === 'nasdaq') {
    const data = await fetchGlobalMarketByType('nasdaq');
    return NextResponse.json({ success: true, data, count: data.length, timestamp: new Date().toISOString() });
  }

  const stocks = await getStocks();

  // ── Kazananlar ───────────────────────────────────────────────────────────
  if (type === 'gainers') {
    const data = [...stocks]
      .filter(s => s.changePercent > 0)
      .sort((a, b) => b.changePercent - a.changePercent)
      .slice(0, 20);
    return NextResponse.json({ success: true, data, count: data.length, timestamp: new Date().toISOString() });
  }

  // ── Düşenler ─────────────────────────────────────────────────────────────
  if (type === 'losers') {
    const data = [...stocks]
      .filter(s => s.changePercent < 0)
      .sort((a, b) => a.changePercent - b.changePercent)
      .slice(0, 20);
    return NextResponse.json({ success: true, data, count: data.length, timestamp: new Date().toISOString() });
  }

  // ── En Aktif (hacim bazlı) ───────────────────────────────────────────────
  if (type === 'active' || type === 'popular') {
    const data = [...stocks]
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 20);
    return NextResponse.json({ success: true, data, count: data.length, timestamp: new Date().toISOString() });
  }

  // ── Sektörler ────────────────────────────────────────────────────────────
  if (type === 'sectors') {
    const map = new Map<string, { count: number; totalChange: number; stocks: typeof stocks }>();
    for (const s of stocks) {
      const sec = s.sector ?? 'Diğer';
      if (!map.has(sec)) map.set(sec, { count: 0, totalChange: 0, stocks: [] });
      const entry = map.get(sec)!;
      entry.count++;
      entry.totalChange += s.changePercent;
      if (entry.stocks.length < 5) entry.stocks.push(s);
    }
    const data = [...map.entries()]
      .map(([name, d]) => ({
        name,
        count: d.count,
        avgChange: +(d.totalChange / d.count).toFixed(2),
        topStocks: d.stocks,
      }))
      .sort((a, b) => b.count - a.count);
    return NextResponse.json({ success: true, data, timestamp: new Date().toISOString() });
  }

  // ── Benzer hisseler ──────────────────────────────────────────────────────
  if (type === 'similar' && symbol) {
    const symbols = symbol.toUpperCase().split(',').map(s => s.trim());
    const sectors = new Set(
      symbols.map(sym => stocks.find(s => s.code === sym)?.sector).filter(Boolean) as string[]
    );
    if (sectors.size === 0) return NextResponse.json({ success: false, error: 'Hisse bulunamadı', data: [] });
    const data = stocks
      .filter(s => !symbols.includes(s.code) && s.sector && sectors.has(s.sector))
      .slice(0, 5);
    return NextResponse.json({ success: true, data, sectors: [...sectors], timestamp: new Date().toISOString() });
  }

  // ── Iliskili hisseler (sektor benzerligi) ───────────────────────────────
  if (type === 'recommended' || type === 'related') {
    const userSymbols = (searchParams.get('symbols') ?? '')
      .split(',').map(s => s.trim().toUpperCase()).filter(Boolean);

    if (userSymbols.length === 0) {
      return NextResponse.json({ success: true, data: [], reason: 'no_reference_symbols', timestamp: new Date().toISOString() });
    }

    const userStocks = userSymbols.map(sym => stocks.find(s => s.code === sym)).filter(Boolean) as typeof stocks;
    const sectorFreq = new Map<string, number>();
    for (const s of userStocks) {
      if (s.sector) sectorFreq.set(s.sector, (sectorFreq.get(s.sector) ?? 0) + 1);
    }
    const topSectors = [...sectorFreq.entries()].sort((a, b) => b[1] - a[1]).map(([sec]) => sec);

    const data = stocks
      .filter(s => !userSymbols.includes(s.code) && s.sector && topSectors.includes(s.sector))
      .sort((a, b) => topSectors.indexOf(a.sector!) - topSectors.indexOf(b.sector!))
      .slice(0, 5);
    return NextResponse.json({ success: true, data, sectors: topSectors, timestamp: new Date().toISOString() });
  }

  // ── Varsayılan: piyasa özeti ──────────────────────────────────────────────
  const gainersCount = stocks.filter(s => s.changePercent > 0).length;
  const losersCount  = stocks.filter(s => s.changePercent < 0).length;
  const avgChange    = stocks.reduce((sum, s) => sum + s.changePercent, 0) / stocks.length;

  return NextResponse.json({
    success: true,
    data: {
      totalStocks:      stocks.length,
      gainers:          gainersCount,
      losers:           losersCount,
      unchanged:        stocks.length - gainersCount - losersCount,
      avgChangePercent: avgChange.toFixed(2),
      topGainers: [...stocks].filter(s => s.changePercent > 0)
        .sort((a, b) => b.changePercent - a.changePercent).slice(0, 5)
        .map(s => ({ symbol: s.code, name: s.name, price: s.price, changePercent: s.changePercent, sector: s.sector })),
      topLosers: [...stocks].filter(s => s.changePercent < 0)
        .sort((a, b) => a.changePercent - b.changePercent).slice(0, 5)
        .map(s => ({ symbol: s.code, name: s.name, price: s.price, changePercent: s.changePercent, sector: s.sector })),
      mostActive: [...stocks].sort((a, b) => b.volume - a.volume).slice(0, 5)
        .map(s => ({ symbol: s.code, name: s.name, price: s.price, volume: s.volume, sector: s.sector })),
    },
    timestamp: new Date().toISOString(),
  });
}
