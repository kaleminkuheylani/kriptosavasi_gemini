'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Gauge,
  RefreshCw,
  Search,
  ShieldAlert,
  TrendingUp,
  Waves,
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';

type RiskLevel = 'low' | 'medium' | 'high';
type SortField =
  | 'marketCap'
  | 'volume24h'
  | 'percentChange24h'
  | 'percentChange7d'
  | 'momentumScore'
  | 'volatilityScore'
  | 'liquidityScore'
  | 'rank';
type SortDirection = 'asc' | 'desc';

interface CryptoAsset {
  id: number;
  rank: number;
  name: string;
  symbol: string;
  tags: string[];
  price: number;
  marketCap: number;
  volume24h: number;
  marketCapDominance: number;
  percentChange24h: number;
  percentChange7d: number;
  analysis: {
    momentumScore: number;
    volatilityScore: number;
    liquidityScore: number;
    trend: 'bullish' | 'bearish' | 'sideways';
    riskLevel: RiskLevel;
    signal: 'buy' | 'hold' | 'sell';
  };
}

interface CryptoSnapshot {
  source: 'coinmarketcap';
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
    highRiskAssets: Array<{ symbol: string; name: string; riskLevel: RiskLevel; volatilityScore: number }>;
    topMomentum: Array<{ symbol: string; name: string; rank: number; momentumScore: number }>;
    topLiquidity: Array<{ symbol: string; name: string; rank: number; liquidityScore: number }>;
  };
  assets: CryptoAsset[];
}

interface CryptoApiResponse {
  success: boolean;
  data?: CryptoSnapshot;
  error?: string;
  count?: number;
}

function formatMoney(value: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    notation: value >= 1_000_000_000 ? 'compact' : 'standard',
    maximumFractionDigits: value >= 100 ? 2 : 6,
  }).format(value);
}

function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function riskLabel(level: RiskLevel): string {
  if (level === 'low') return 'Dusuk';
  if (level === 'medium') return 'Orta';
  return 'Yuksek';
}

function signalLabel(signal: 'buy' | 'hold' | 'sell'): string {
  if (signal === 'buy') return 'AL';
  if (signal === 'sell') return 'SAT';
  return 'BEKLE';
}

function signalClass(signal: 'buy' | 'hold' | 'sell'): string {
  if (signal === 'buy') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
  if (signal === 'sell') return 'bg-red-500/10 text-red-400 border-red-500/30';
  return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
}

function scoreClass(score: number): string {
  if (score >= 70) return 'text-emerald-400';
  if (score <= 35) return 'text-red-400';
  return 'text-amber-400';
}

export default function Home() {
  const [snapshot, setSnapshot] = useState<CryptoSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [tag, setTag] = useState('');
  const [risk, setRisk] = useState<'all' | RiskLevel>('all');
  const [sortBy, setSortBy] = useState<SortField>('marketCap');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');
  const [minMarketCap, setMinMarketCap] = useState('');
  const [minVolume24h, setMinVolume24h] = useState('');

  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [compareSymbols, setCompareSymbols] = useState<string[]>([]);

  const fetchCryptoData = useCallback(
    async (isManualRefresh = false) => {
      if (isManualRefresh) setRefreshing(true);
      else setLoading(true);

      const params = new URLSearchParams({
        limit: '120',
        convert: 'USD',
        sortBy,
        sortDir,
      });

      if (query.trim()) params.set('query', query.trim());
      if (tag.trim()) params.set('tag', tag.trim());
      if (risk !== 'all') params.set('risk', risk);
      if (minMarketCap.trim()) params.set('minMarketCap', minMarketCap.trim());
      if (minVolume24h.trim()) params.set('minVolume24h', minVolume24h.trim());

      try {
        const response = await fetch(`/api/crypto?${params.toString()}`);
        const payload = (await response.json()) as CryptoApiResponse;

        if (!response.ok || !payload.success || !payload.data) {
          throw new Error(payload.error ?? 'Kripto verisi alinamadi');
        }

        setSnapshot(payload.data);
        setError(null);

        const symbols = payload.data.assets.map((item) => item.symbol);
        setSelectedSymbol((prev) => (prev && symbols.includes(prev) ? prev : symbols[0] ?? null));
        setCompareSymbols((prev) => prev.filter((symbol) => symbols.includes(symbol)));
      } catch (fetchError) {
        setSnapshot(null);
        setError(fetchError instanceof Error ? fetchError.message : 'Beklenmeyen bir hata olustu');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [minMarketCap, minVolume24h, query, risk, sortBy, sortDir, tag],
  );

  useEffect(() => {
    const timeout = setTimeout(() => {
      void fetchCryptoData(false);
    }, 250);

    return () => clearTimeout(timeout);
  }, [fetchCryptoData]);

  const selectedAsset = useMemo(() => {
    if (!snapshot || !selectedSymbol) return null;
    return snapshot.assets.find((asset) => asset.symbol === selectedSymbol) ?? null;
  }, [selectedSymbol, snapshot]);

  const compareData = useMemo(() => {
    if (!snapshot || compareSymbols.length === 0) return [];
    return compareSymbols
      .map((symbol) => snapshot.assets.find((asset) => asset.symbol === symbol))
      .filter((asset): asset is CryptoAsset => Boolean(asset))
      .map((asset) => ({
        symbol: asset.symbol,
        change24h: Number(asset.percentChange24h.toFixed(2)),
        change7d: Number(asset.percentChange7d.toFixed(2)),
        momentum: asset.analysis.momentumScore,
        volatility: asset.analysis.volatilityScore,
        liquidity: asset.analysis.liquidityScore,
      }));
  }, [compareSymbols, snapshot]);

  const toggleCompare = (symbol: string) => {
    setCompareSymbols((prev) => {
      if (prev.includes(symbol)) return prev.filter((item) => item !== symbol);
      if (prev.length >= 5) return [...prev.slice(1), symbol];
      return [...prev, symbol];
    });
  };

  const riskDistribution = useMemo(() => {
    const distribution = { low: 0, medium: 0, high: 0 };
    if (!snapshot) return distribution;

    for (const asset of snapshot.assets) {
      distribution[asset.analysis.riskLevel]++;
    }
    return distribution;
  }, [snapshot]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 md:px-8">
        <section className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-900/70 p-5 shadow-2xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">CoinMarketCap Kripto Analiz Merkezi</h1>
              <p className="mt-1 text-sm text-slate-300">
                Canli piyasa verisi, momentum/risk skorlari ve karsilastirma araclari tek panelde.
              </p>
            </div>
            <Button
              variant="outline"
              className="border-slate-700 bg-slate-900 hover:bg-slate-800"
              onClick={() => void fetchCryptoData(true)}
              disabled={loading || refreshing}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Yenile
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            <Card className="border-slate-800 bg-slate-950/60">
              <CardHeader className="pb-2">
                <CardDescription>Toplam Piyasa Degeri</CardDescription>
                <CardTitle className="text-xl">{snapshot ? formatMoney(snapshot.market.totalMarketCap) : '-'}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-slate-800 bg-slate-950/60">
              <CardHeader className="pb-2">
                <CardDescription>24s Hacim</CardDescription>
                <CardTitle className="text-xl">{snapshot ? formatMoney(snapshot.market.totalVolume24h) : '-'}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-slate-800 bg-slate-950/60">
              <CardHeader className="pb-2">
                <CardDescription>Piyasa Degisimi (24s)</CardDescription>
                <CardTitle className={snapshot && snapshot.market.marketCapChange24h >= 0 ? 'text-emerald-400 text-xl' : 'text-red-400 text-xl'}>
                  {snapshot ? formatPercent(snapshot.market.marketCapChange24h) : '-'}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-slate-800 bg-slate-950/60">
              <CardHeader className="pb-2">
                <CardDescription>Breadth (Yukselen/Dusen)</CardDescription>
                <CardTitle className="text-xl">
                  {snapshot ? `${snapshot.market.positive24hCount}/${snapshot.market.negative24hCount}` : '-'}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-3 rounded-xl border border-slate-800 bg-slate-900/70 p-4 md:grid-cols-2 xl:grid-cols-6">
          <div className="relative xl:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Sembol veya coin ara (BTC, Ethereum...)"
              className="border-slate-700 bg-slate-950 pl-9"
            />
          </div>
          <Input
            value={tag}
            onChange={(event) => setTag(event.target.value)}
            placeholder="Tag filtre (defi, layer-1...)"
            className="border-slate-700 bg-slate-950"
          />
          <Input
            value={minMarketCap}
            onChange={(event) => setMinMarketCap(event.target.value)}
            placeholder="Min MarketCap (USD)"
            className="border-slate-700 bg-slate-950"
          />
          <Input
            value={minVolume24h}
            onChange={(event) => setMinVolume24h(event.target.value)}
            placeholder="Min Hacim 24s (USD)"
            className="border-slate-700 bg-slate-950"
          />
          <div className="flex gap-2">
            <select
              value={risk}
              onChange={(event) => setRisk(event.target.value as 'all' | RiskLevel)}
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            >
              <option value="all">Tum Riskler</option>
              <option value="low">Dusuk Risk</option>
              <option value="medium">Orta Risk</option>
              <option value="high">Yuksek Risk</option>
            </select>
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as SortField)}
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            >
              <option value="marketCap">Market Cap</option>
              <option value="volume24h">Hacim 24s</option>
              <option value="percentChange24h">Degisim 24s</option>
              <option value="percentChange7d">Degisim 7g</option>
              <option value="momentumScore">Momentum Skoru</option>
              <option value="volatilityScore">Volatilite Skoru</option>
              <option value="liquidityScore">Likidite Skoru</option>
              <option value="rank">CMK Sirasi</option>
            </select>
          </div>
          <div className="flex justify-end xl:col-span-6">
            <Button
              variant="ghost"
              className="text-slate-300 hover:bg-slate-800 hover:text-white"
              onClick={() => setSortDir((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
            >
              Siralama: {sortDir === 'desc' ? 'Azalan' : 'Artan'}
            </Button>
          </div>
        </section>

        {error && (
          <Card className="border-red-900/40 bg-red-950/30">
            <CardContent className="flex items-start gap-3 p-4 text-red-200">
              <AlertTriangle className="mt-0.5 h-5 w-5" />
              <div>
                <p className="font-semibold">Veri alinamadi</p>
                <p className="text-sm">{error}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <Card className="border-slate-800 bg-slate-900/70">
            <CardContent className="p-8 text-center text-slate-300">CoinMarketCap verileri yukleniyor...</CardContent>
          </Card>
        ) : snapshot ? (
          <>
            <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <Card className="border-slate-800 bg-slate-900/70 xl:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle>Piyasa Taramasi</CardTitle>
                  <CardDescription>Satira tiklayarak detay analizini sag panelde goruntule.</CardDescription>
                </CardHeader>
                <CardContent className="max-h-[600px] overflow-auto">
                  <div className="min-w-[850px]">
                    <div className="grid grid-cols-[60px_180px_120px_120px_120px_120px_120px_120px] gap-2 border-b border-slate-800 pb-2 text-xs uppercase tracking-wide text-slate-400">
                      <span>#</span>
                      <span>Coin</span>
                      <span>Fiyat</span>
                      <span>24s</span>
                      <span>7g</span>
                      <span>Momentum</span>
                      <span>Volatilite</span>
                      <span>Islem</span>
                    </div>
                    {snapshot.assets.map((asset) => {
                      const selected = selectedSymbol === asset.symbol;
                      const compared = compareSymbols.includes(asset.symbol);
                      return (
                        <button
                          key={asset.id}
                          onClick={() => setSelectedSymbol(asset.symbol)}
                          className={`grid w-full grid-cols-[60px_180px_120px_120px_120px_120px_120px_120px] gap-2 border-b border-slate-900 py-2 text-left text-sm transition ${
                            selected ? 'bg-slate-800/60' : 'hover:bg-slate-900/80'
                          }`}
                        >
                          <span className="text-slate-400">#{asset.rank}</span>
                          <span>
                            <span className="font-medium">{asset.name}</span>
                            <span className="ml-2 text-xs text-slate-400">{asset.symbol}</span>
                          </span>
                          <span>{formatMoney(asset.price, snapshot.convert)}</span>
                          <span className={asset.percentChange24h >= 0 ? 'text-emerald-400' : 'text-red-400'}>{formatPercent(asset.percentChange24h)}</span>
                          <span className={asset.percentChange7d >= 0 ? 'text-emerald-400' : 'text-red-400'}>{formatPercent(asset.percentChange7d)}</span>
                          <span className={scoreClass(asset.analysis.momentumScore)}>{asset.analysis.momentumScore}</span>
                          <span className={scoreClass(100 - asset.analysis.volatilityScore)}>{asset.analysis.volatilityScore}</span>
                          <span>
                            <Badge
                              variant="outline"
                              className={compared ? 'border-emerald-500/40 text-emerald-400' : 'border-slate-700 text-slate-400'}
                              onClick={(event) => {
                                event.stopPropagation();
                                toggleCompare(asset.symbol);
                              }}
                            >
                              {compared ? 'Secili' : 'Karsilastir'}
                            </Badge>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-800 bg-slate-900/70">
                <CardHeader>
                  <CardTitle>Detayli Coin Analizi</CardTitle>
                  <CardDescription>Momentum, risk ve likidite bazli teknik skorlar.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {selectedAsset ? (
                    <>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-lg font-semibold">{selectedAsset.name}</p>
                          <p className="text-sm text-slate-400">{selectedAsset.symbol}</p>
                        </div>
                        <Badge variant="outline" className={signalClass(selectedAsset.analysis.signal)}>
                          {signalLabel(selectedAsset.analysis.signal)}
                        </Badge>
                      </div>
                      <p className="text-2xl font-bold">{formatMoney(selectedAsset.price, snapshot.convert)}</p>
                      <Separator className="bg-slate-800" />
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-md border border-slate-800 bg-slate-950/70 p-3">
                          <p className="text-slate-400">Momentum</p>
                          <p className={`text-lg font-semibold ${scoreClass(selectedAsset.analysis.momentumScore)}`}>
                            {selectedAsset.analysis.momentumScore}
                          </p>
                        </div>
                        <div className="rounded-md border border-slate-800 bg-slate-950/70 p-3">
                          <p className="text-slate-400">Volatilite</p>
                          <p className={`text-lg font-semibold ${scoreClass(100 - selectedAsset.analysis.volatilityScore)}`}>
                            {selectedAsset.analysis.volatilityScore}
                          </p>
                        </div>
                        <div className="rounded-md border border-slate-800 bg-slate-950/70 p-3">
                          <p className="text-slate-400">Likidite</p>
                          <p className={`text-lg font-semibold ${scoreClass(selectedAsset.analysis.liquidityScore)}`}>
                            {selectedAsset.analysis.liquidityScore}
                          </p>
                        </div>
                        <div className="rounded-md border border-slate-800 bg-slate-950/70 p-3">
                          <p className="text-slate-400">Risk</p>
                          <p className="text-lg font-semibold">{riskLabel(selectedAsset.analysis.riskLevel)}</p>
                        </div>
                      </div>
                      <div className="space-y-2 text-xs text-slate-300">
                        <p>Trend: {selectedAsset.analysis.trend}</p>
                        <p>Piyasa Degeri: {formatMoney(selectedAsset.marketCap, snapshot.convert)}</p>
                        <p>24s Hacim: {formatMoney(selectedAsset.volume24h, snapshot.convert)}</p>
                        <p>Dominance: {selectedAsset.marketCapDominance.toFixed(2)}%</p>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-slate-400">Analiz icin listeden bir coin sec.</p>
                  )}
                </CardContent>
              </Card>
            </section>

            <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <Card className="border-slate-800 bg-slate-900/70 xl:col-span-2">
                <CardHeader>
                  <CardTitle>Karsilastirma Araci</CardTitle>
                  <CardDescription>En fazla 5 coin secip performans ve skorlarini kiyasla.</CardDescription>
                </CardHeader>
                <CardContent className="h-[320px]">
                  {compareData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={compareData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                        <XAxis dataKey="symbol" stroke="#94a3b8" />
                        <YAxis stroke="#94a3b8" />
                        <Tooltip
                          contentStyle={{ background: '#020617', border: '1px solid #334155' }}
                          labelStyle={{ color: '#cbd5e1' }}
                        />
                        <Bar dataKey="change24h" name="24s %" fill="#22c55e" />
                        <Bar dataKey="change7d" name="7g %" fill="#3b82f6" />
                        <Bar dataKey="momentum" name="Momentum" fill="#eab308" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-slate-400">
                      Tablodan en az 1 coin secerek karsilastirma grafigi olustur.
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-slate-800 bg-slate-900/70">
                <CardHeader>
                  <CardTitle>Analiz Ozeti</CardTitle>
                  <CardDescription>Toplam piyasa risk/momentum dagilimi.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-950/60 p-3">
                    <span className="inline-flex items-center gap-2 text-slate-300">
                      <Gauge className="h-4 w-4" />
                      Ortalama Momentum
                    </span>
                    <span className={`font-semibold ${scoreClass(snapshot.analysis.overallMomentum)}`}>
                      {snapshot.analysis.overallMomentum}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-950/60 p-3">
                    <span className="inline-flex items-center gap-2 text-slate-300">
                      <Waves className="h-4 w-4" />
                      Ortalama Volatilite
                    </span>
                    <span className="font-semibold text-amber-300">{snapshot.analysis.overallVolatility}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-950/60 p-3">
                    <span className="inline-flex items-center gap-2 text-slate-300">
                      <Activity className="h-4 w-4" />
                      Ortalama Likidite
                    </span>
                    <span className={`font-semibold ${scoreClass(snapshot.analysis.overallLiquidity)}`}>
                      {snapshot.analysis.overallLiquidity}
                    </span>
                  </div>
                  <Separator className="bg-slate-800" />
                  <div className="space-y-1 text-xs text-slate-300">
                    <p className="inline-flex items-center gap-2">
                      <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                      Yukselenler: {snapshot.market.positive24hCount}
                    </p>
                    <p className="inline-flex items-center gap-2">
                      <ArrowDownRight className="h-3.5 w-3.5 text-red-400" />
                      Dusenler: {snapshot.market.negative24hCount}
                    </p>
                    <p className="inline-flex items-center gap-2">
                      <ArrowUpRight className="h-3.5 w-3.5 text-sky-400" />
                      A/D Orani: {snapshot.market.advanceDeclineRatio}
                    </p>
                    <p className="inline-flex items-center gap-2">
                      <ShieldAlert className="h-3.5 w-3.5 text-amber-400" />
                      Risk Dagilimi: D{riskDistribution.low} / O{riskDistribution.medium} / Y{riskDistribution.high}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </section>

            <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Card className="border-slate-800 bg-slate-900/70">
                <CardHeader>
                  <CardTitle>Top Momentum Coinleri</CardTitle>
                  <CardDescription>Kisa-orta vade fiyat ivmesine gore ilk 8.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {snapshot.analysis.topMomentum.map((item) => (
                    <div key={item.symbol} className="flex items-center justify-between rounded border border-slate-800 bg-slate-950/60 px-3 py-2">
                      <span>
                        #{item.rank} {item.symbol}
                      </span>
                      <span className={scoreClass(item.momentumScore)}>{item.momentumScore}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-slate-800 bg-slate-900/70">
                <CardHeader>
                  <CardTitle>Yuksek Risk Alarmi</CardTitle>
                  <CardDescription>Volatilitesi yuksek ve oynak coinler.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {snapshot.analysis.highRiskAssets.length > 0 ? (
                    snapshot.analysis.highRiskAssets.map((item) => (
                      <div key={item.symbol} className="flex items-center justify-between rounded border border-red-900/40 bg-red-950/20 px-3 py-2">
                        <span>{item.symbol}</span>
                        <span className="text-red-300">Volatilite {item.volatilityScore}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-slate-400">Anlik olarak yuksek riskli coin bulunmadi.</p>
                  )}
                </CardContent>
              </Card>
            </section>
          </>
        ) : null}

        <p className="pt-2 text-center text-xs text-slate-500">
          Veri kaynagi: CoinMarketCap API • Bu platform bilgi amaclidir, yatirim tavsiyesi degildir.
        </p>
      </div>
    </main>
  );
}
