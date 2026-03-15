'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bot,
  Coins,
  Flame,
  LayoutGrid,
  Menu,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

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
  };
  assets: CryptoAsset[];
}

interface CryptoApiResponse {
  success: boolean;
  data?: CryptoSnapshot;
  error?: string;
  hint?: string;
}

interface MacroSnapshot {
  usdTry: number;
  eurTry: number;
  gbpTry: number;
  updatedAt: string;
  source: 'open-er-api' | 'fallback';
}

interface MacroApiResponse {
  success: boolean;
  data?: MacroSnapshot;
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

function formatTry(value: number): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 2,
  }).format(value);
}

function scoreClass(score: number): string {
  if (score >= 70) return 'text-emerald-300';
  if (score <= 35) return 'text-red-300';
  return 'text-amber-300';
}

function riskLabel(level: RiskLevel): string {
  if (level === 'low') return 'Dusuk';
  if (level === 'medium') return 'Orta';
  return 'Yuksek';
}

function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / 86400000);
}

function buildDailyComment(snapshot: CryptoSnapshot | null, dayKey: string): { title: string; body: string[] } {
  if (!snapshot) {
    return {
      title: 'Gunluk Genel Yorum',
      body: [
        'CoinMarketCap verileri yuklenince otomatik gunluk yorum olusacak.',
        'Yorum her gun saat 00:00 sonrasinda yeni gun verisine gore tazelenir.',
      ],
    };
  }

  const d = new Date(`${dayKey}T00:00:00`);
  const tonePool = [
    'Momentum agirlikli bir gun acilisi goruluyor.',
    'Likidite odakli denge arayisi dikkat cekiyor.',
    'Risk dagilimi secici bir piyasa davranisina isaret ediyor.',
    'Piyasa geneli temkinli ama firsat pencereleri acik.',
    'Denge bozulmadan yonlu hareket arayisi suruyor.',
  ];
  const tone = tonePool[dayOfYear(d) % tonePool.length];

  const breadth = snapshot.market.positive24hCount - snapshot.market.negative24hCount;
  const breadthText = breadth >= 0 ? 'yukselenler one cikiyor' : 'dusenler baskin';
  const riskText =
    snapshot.analysis.overallVolatility >= 65
      ? 'Volatilite yuksek, kaldirac kullanimi konusunda dikkatli olunmali.'
      : 'Volatilite dengeli, fiyat salinimlari nispeten kontrol altinda.';

  return {
    title: `Gunluk Genel Yorum - ${dayKey}`,
    body: [
      tone,
      `Toplam market cap degisimi ${formatPercent(snapshot.market.marketCapChange24h)} ve piyasa genisligi tarafinda ${breadthText}.`,
      `Momentum ortalamasi ${snapshot.analysis.overallMomentum}, likidite ortalamasi ${snapshot.analysis.overallLiquidity} seviyesinde.`,
      riskText,
    ],
  };
}

export default function Home() {
  const [snapshot, setSnapshot] = useState<CryptoSnapshot | null>(null);
  const [macro, setMacro] = useState<MacroSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [risk, setRisk] = useState<'all' | RiskLevel>('all');
  const [sortBy, setSortBy] = useState<SortField>('marketCap');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');
  const [minMarketCap, setMinMarketCap] = useState('');
  const [minVolume24h, setMinVolume24h] = useState('');
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [dayKey, setDayKey] = useState(new Date().toISOString().slice(0, 10));

  const fetchCryptoData = useCallback(
    async (manual = false) => {
      if (manual) setRefreshing(true);
      else setLoading(true);

      const params = new URLSearchParams({
        limit: '150',
        convert: 'USD',
        sortBy,
        sortDir,
      });

      if (query.trim()) params.set('query', query.trim());
      if (risk !== 'all') params.set('risk', risk);
      if (minMarketCap.trim()) params.set('minMarketCap', minMarketCap.trim());
      if (minVolume24h.trim()) params.set('minVolume24h', minVolume24h.trim());

      try {
        const response = await fetch(`/api/crypto?${params.toString()}`);
        const payload = (await response.json()) as CryptoApiResponse;

        if (!response.ok || !payload.success || !payload.data) {
          const message = payload.error ?? 'Kripto verisi alinamadi';
          throw new Error(payload.hint ? `${message} (${payload.hint})` : message);
        }

        setSnapshot(payload.data);
        setError(null);
        const symbols = payload.data.assets.map((asset) => asset.symbol);
        setSelectedSymbol((prev) => (prev && symbols.includes(prev) ? prev : symbols[0] ?? null));
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : 'Beklenmeyen bir hata olustu');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [minMarketCap, minVolume24h, query, risk, sortBy, sortDir],
  );

  const fetchMacroData = useCallback(async () => {
    try {
      const response = await fetch('/api/macro');
      const payload = (await response.json()) as MacroApiResponse;
      if (response.ok && payload.success && payload.data) {
        setMacro(payload.data);
      }
    } catch {
      // silent fail
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void fetchCryptoData(false);
    }, 200);
    return () => clearTimeout(timeout);
  }, [fetchCryptoData]);

  useEffect(() => {
    void fetchMacroData();
    const interval = setInterval(() => void fetchMacroData(), 60000);
    return () => clearInterval(interval);
  }, [fetchMacroData]);

  useEffect(() => {
    const now = new Date();
    const nextMidnight = new Date(now);
    nextMidnight.setHours(24, 0, 0, 0);
    const msUntilMidnight = nextMidnight.getTime() - now.getTime();

    const timeout = setTimeout(() => {
      setDayKey(new Date().toISOString().slice(0, 10));
      void fetchCryptoData(true);
    }, msUntilMidnight);

    return () => clearTimeout(timeout);
  }, [dayKey, fetchCryptoData]);

  const selectedAsset = useMemo(() => {
    if (!snapshot || !selectedSymbol) return null;
    return snapshot.assets.find((asset) => asset.symbol === selectedSymbol) ?? null;
  }, [snapshot, selectedSymbol]);

  const dailyComment = useMemo(() => buildDailyComment(snapshot, dayKey), [snapshot, dayKey]);

  const trendAssets = useMemo(() => {
    if (!snapshot) return [];
    return [...snapshot.assets]
      .sort((a, b) => b.analysis.momentumScore - a.analysis.momentumScore)
      .slice(0, 6);
  }, [snapshot]);

  const topGainers = useMemo(() => {
    if (!snapshot) return [];
    return [...snapshot.assets]
      .sort((a, b) => b.percentChange24h - a.percentChange24h)
      .slice(0, 6);
  }, [snapshot]);

  const topLosers = useMemo(() => {
    if (!snapshot) return [];
    return [...snapshot.assets]
      .sort((a, b) => a.percentChange24h - b.percentChange24h)
      .slice(0, 6);
  }, [snapshot]);

  const similarAssets = useMemo(() => {
    if (!snapshot || !selectedAsset) return [];
    const baseTags = new Set(selectedAsset.tags.map((tag) => tag.toLowerCase()));
    const minCap = selectedAsset.marketCap * 0.45;
    const maxCap = selectedAsset.marketCap * 1.55;

    return snapshot.assets
      .filter((asset) => asset.symbol !== selectedAsset.symbol)
      .map((asset) => {
        const sharedTagCount = asset.tags.filter((tag) => baseTags.has(tag.toLowerCase())).length;
        const capDistance = Math.abs(asset.marketCap - selectedAsset.marketCap) / Math.max(selectedAsset.marketCap, 1);
        const similarity = sharedTagCount * 20 + (1 - Math.min(capDistance, 1)) * 80;
        return { asset, similarity };
      })
      .filter((row) => row.asset.marketCap >= minCap && row.asset.marketCap <= maxCap)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 6)
      .map((row) => row.asset);
  }, [selectedAsset, snapshot]);

  const applyToolPreset = (preset: 'momentum' | 'liquidity' | 'gainers' | 'defensive') => {
    if (preset === 'momentum') {
      setSortBy('momentumScore');
      setSortDir('desc');
      return;
    }
    if (preset === 'liquidity') {
      setSortBy('liquidityScore');
      setSortDir('desc');
      setMinVolume24h('150000000');
      return;
    }
    if (preset === 'gainers') {
      setSortBy('percentChange24h');
      setSortDir('desc');
      return;
    }
    setRisk('low');
    setSortBy('volatilityScore');
    setSortDir('asc');
  };

  const btc = snapshot?.assets.find((asset) => asset.symbol === 'BTC');
  const eth = snapshot?.assets.find((asset) => asset.symbol === 'ETH');

  const SectionCard = ({
    title,
    icon,
    assets,
    subtitle,
  }: {
    title: string;
    icon: JSX.Element;
    subtitle: string;
    assets: CryptoAsset[];
  }) => (
    <Card className="border-lime-500/20 bg-black/40 shadow-[0_0_0_1px_rgba(132,204,22,.12)]">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base text-lime-100">
          {icon}
          {title}
        </CardTitle>
        <CardDescription className="text-slate-400">{subtitle}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {assets.length > 0 ? (
          assets.map((asset) => (
            <button
              key={`${title}-${asset.symbol}`}
              onClick={() => setSelectedSymbol(asset.symbol)}
              className="grid w-full grid-cols-[56px_1fr_90px] items-center gap-2 rounded border border-slate-800 bg-slate-900/70 px-2 py-2 text-left text-xs transition hover:border-cyan-500/40"
            >
              <span className="text-slate-400">#{asset.rank}</span>
              <span>
                <span className="font-semibold text-slate-100">{asset.symbol}</span>
                <span className="ml-1 text-slate-400">{asset.name}</span>
              </span>
              <span className={asset.percentChange24h >= 0 ? 'text-emerald-300' : 'text-red-300'}>
                {formatPercent(asset.percentChange24h)}
              </span>
            </button>
          ))
        ) : (
          <p className="text-xs text-slate-500">Veri bulunamadi.</p>
        )}
      </CardContent>
    </Card>
  );

  return (
    <main className="min-h-screen overflow-x-auto bg-[#05070a] bg-[radial-gradient(circle_at_top,#0b1220_0%,#05070a_45%)] font-mono text-lime-100">
      <div className="mx-auto w-full min-w-[1480px] max-w-[1900px] px-8 py-8">
        <div className="grid grid-cols-[280px_minmax(0,1fr)] gap-6">
          <aside className="sticky top-6 space-y-4 self-start">
            <Card className="border-lime-500/25 bg-black/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Retro Kripto Terminal</CardTitle>
                <CardDescription className="text-slate-400">Yatirim tavsiyesi degildir</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button asChild variant="outline" className="w-full border-cyan-500/40 bg-cyan-950/20 hover:bg-cyan-900/40">
                  <Link href="/asistan">
                    <Bot className="mr-2 h-4 w-4" />
                    Chatbot
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  className="w-full border-slate-700 bg-slate-900 hover:bg-slate-800"
                  onClick={() => void fetchCryptoData(true)}
                  disabled={loading || refreshing}
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                  Yenile
                </Button>
                <Badge variant="outline" className="w-full justify-center border-amber-500/40 text-amber-300">
                  Yatirim tavsiyesi degildir
                </Badge>
              </CardContent>
            </Card>

            <Card className="border-cyan-500/20 bg-black/45">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Yatirim Araclari</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button size="sm" variant="outline" className="w-full border-slate-700 bg-slate-950 text-xs" onClick={() => applyToolPreset('momentum')}>
                  Momentum Tarayici
                </Button>
                <Button size="sm" variant="outline" className="w-full border-slate-700 bg-slate-950 text-xs" onClick={() => applyToolPreset('liquidity')}>
                  Likidite Filtresi
                </Button>
                <Button size="sm" variant="outline" className="w-full border-slate-700 bg-slate-950 text-xs" onClick={() => applyToolPreset('gainers')}>
                  Gunun Kazananlari
                </Button>
                <Button size="sm" variant="outline" className="w-full border-slate-700 bg-slate-950 text-xs" onClick={() => applyToolPreset('defensive')}>
                  Defansif Mod
                </Button>
              </CardContent>
            </Card>
          </aside>

          <section className="space-y-4">
            <Card className="border-lime-500/25 bg-black/50">
              <CardContent className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <img src="/logo.svg" alt="Logo" className="h-8 w-8 rounded-sm border border-lime-500/40 bg-black/60 p-1" />
                  <div>
                    <p className="text-sm text-cyan-300">KRIPTO ANALIZ TERMINALI</p>
                    <p className="text-2xl font-bold tracking-wide">CoinMarketCap Live Board</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="border-slate-700 bg-slate-900">
                        <Menu className="mr-2 h-4 w-4" />
                        Menu
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="border-slate-700 bg-slate-950 text-slate-100">
                      <DropdownMenuLabel>Hizli Islemler</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setSortDir((prev) => (prev === 'desc' ? 'asc' : 'desc'))}>
                        Siralama yonu degistir
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setRisk('all')}>Risk filtresini sifirla</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { setQuery(''); setMinMarketCap(''); setMinVolume24h(''); }}>
                        Tum filtreleri sifirla
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="border-slate-700 bg-slate-900">
                        <Wallet className="mr-2 h-4 w-4" />
                        Giris
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="border-slate-700 bg-slate-950 text-slate-100">
                      <DropdownMenuLabel>Kullanici Islemleri</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href="/asistan">Asistana git</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem disabled>E-posta ile giris (yakinda)</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>

            <Card className="border-cyan-500/20 bg-black/45">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Anlik Bilgiler (Kur ve Piyasa)</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-8 gap-2 text-xs">
                <div className="rounded border border-slate-700 bg-slate-900/70 p-2">
                  <p className="text-slate-400">USD/TRY</p>
                  <p className="font-semibold">{macro ? formatTry(macro.usdTry) : '-'}</p>
                </div>
                <div className="rounded border border-slate-700 bg-slate-900/70 p-2">
                  <p className="text-slate-400">EUR/TRY</p>
                  <p className="font-semibold">{macro ? formatTry(macro.eurTry) : '-'}</p>
                </div>
                <div className="rounded border border-slate-700 bg-slate-900/70 p-2">
                  <p className="text-slate-400">GBP/TRY</p>
                  <p className="font-semibold">{macro ? formatTry(macro.gbpTry) : '-'}</p>
                </div>
                <div className="rounded border border-slate-700 bg-slate-900/70 p-2">
                  <p className="text-slate-400">BTC</p>
                  <p className="font-semibold">{btc ? formatMoney(btc.price) : '-'}</p>
                </div>
                <div className="rounded border border-slate-700 bg-slate-900/70 p-2">
                  <p className="text-slate-400">ETH</p>
                  <p className="font-semibold">{eth ? formatMoney(eth.price) : '-'}</p>
                </div>
                <div className="rounded border border-slate-700 bg-slate-900/70 p-2">
                  <p className="text-slate-400">Toplam Market Cap</p>
                  <p className="font-semibold">{snapshot ? formatMoney(snapshot.market.totalMarketCap) : '-'}</p>
                </div>
                <div className="rounded border border-slate-700 bg-slate-900/70 p-2">
                  <p className="text-slate-400">24s Hacim</p>
                  <p className="font-semibold">{snapshot ? formatMoney(snapshot.market.totalVolume24h) : '-'}</p>
                </div>
                <div className="rounded border border-slate-700 bg-slate-900/70 p-2">
                  <p className="text-slate-400">Piyasa 24s</p>
                  <p className={snapshot && snapshot.market.marketCapChange24h >= 0 ? 'font-semibold text-emerald-300' : 'font-semibold text-red-300'}>
                    {snapshot ? formatPercent(snapshot.market.marketCapChange24h) : '-'}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-lime-500/25 bg-black/45">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-lime-300" />
                  {dailyComment.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                {dailyComment.body.map((line, index) => (
                  <p key={`daily-comment-${index}`} className="text-slate-200">
                    - {line}
                  </p>
                ))}
              </CardContent>
            </Card>

            <div className="grid grid-cols-4 gap-3">
              <SectionCard title="Trend Assetler" subtitle="Momentum skoruna gore" icon={<TrendingUp className="h-4 w-4 text-cyan-300" />} assets={trendAssets} />
              <SectionCard title="En Cok Kazandiranlar" subtitle="24 saatlik performans" icon={<Flame className="h-4 w-4 text-emerald-300" />} assets={topGainers} />
              <SectionCard title="En Cok Dusenler" subtitle="24 saatlik gerileyenler" icon={<TrendingDown className="h-4 w-4 text-red-300" />} assets={topLosers} />
              <SectionCard
                title="Benzer Assetler"
                subtitle={selectedAsset ? `${selectedAsset.symbol} baz alindi` : 'Secili asset bazli'}
                icon={<Coins className="h-4 w-4 text-amber-300" />}
                assets={similarAssets}
              />
            </div>

            <Card className="border-cyan-500/25 bg-black/45">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2">
                  <LayoutGrid className="h-4 w-4 text-cyan-300" />
                  Genel Tablo
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Kripto icin filtre, risk ve siralama secenekleri ile desktop tablo gorunumu
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-6 gap-2">
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Sembol/coin ara"
                    className="col-span-2 border-slate-700 bg-slate-950"
                  />
                  <Input
                    value={minMarketCap}
                    onChange={(event) => setMinMarketCap(event.target.value)}
                    placeholder="Min market cap"
                    className="border-slate-700 bg-slate-950"
                  />
                  <Input
                    value={minVolume24h}
                    onChange={(event) => setMinVolume24h(event.target.value)}
                    placeholder="Min 24s hacim"
                    className="border-slate-700 bg-slate-950"
                  />
                  <select
                    value={risk}
                    onChange={(event) => setRisk(event.target.value as 'all' | RiskLevel)}
                    className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                  >
                    <option value="all">Tum Riskler</option>
                    <option value="low">Dusuk Risk</option>
                    <option value="medium">Orta Risk</option>
                    <option value="high">Yuksek Risk</option>
                  </select>
                  <select
                    value={sortBy}
                    onChange={(event) => setSortBy(event.target.value as SortField)}
                    className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                  >
                    <option value="marketCap">Market Cap</option>
                    <option value="volume24h">Hacim 24s</option>
                    <option value="percentChange24h">Degisim 24s</option>
                    <option value="percentChange7d">Degisim 7g</option>
                    <option value="momentumScore">Momentum</option>
                    <option value="volatilityScore">Volatilite</option>
                    <option value="liquidityScore">Likidite</option>
                    <option value="rank">Rank</option>
                  </select>
                </div>

                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    className="border-slate-700 bg-slate-900"
                    onClick={() => setSortDir((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
                  >
                    Siralama: {sortDir === 'desc' ? 'Azalan' : 'Artan'}
                  </Button>
                </div>

                {error && (
                  <div className="rounded border border-red-900/40 bg-red-950/25 px-3 py-2 text-sm text-red-200">
                    Veri hatasi: {error}
                  </div>
                )}

                {loading ? (
                  <div className="rounded border border-slate-800 bg-slate-950/60 px-4 py-8 text-center text-slate-300">
                    CoinMarketCap verileri yukleniyor...
                  </div>
                ) : (
                  <div className="max-h-[560px] overflow-auto rounded border border-slate-800 bg-slate-950/50">
                    <div className="grid grid-cols-[50px_190px_130px_100px_100px_110px_110px_110px_120px] gap-2 border-b border-slate-800 px-3 py-2 text-xs uppercase tracking-wide text-slate-400">
                      <span>#</span>
                      <span>Asset</span>
                      <span>Fiyat</span>
                      <span>24s</span>
                      <span>7g</span>
                      <span>Momentum</span>
                      <span>Volatilite</span>
                      <span>Likidite</span>
                      <span>Risk</span>
                    </div>

                    {snapshot?.assets.map((asset) => (
                      <button
                        key={asset.id}
                        onClick={() => setSelectedSymbol(asset.symbol)}
                        className={`grid w-full grid-cols-[50px_190px_130px_100px_100px_110px_110px_110px_120px] gap-2 border-b border-slate-900 px-3 py-2 text-left text-sm transition ${
                          selectedAsset?.symbol === asset.symbol ? 'bg-cyan-950/25' : 'hover:bg-slate-900/70'
                        }`}
                      >
                        <span className="text-slate-400">#{asset.rank}</span>
                        <span>
                          <span className="font-semibold text-slate-100">{asset.symbol}</span>
                          <span className="ml-1 text-xs text-slate-400">{asset.name}</span>
                        </span>
                        <span>{formatMoney(asset.price)}</span>
                        <span className={asset.percentChange24h >= 0 ? 'text-emerald-300' : 'text-red-300'}>
                          {formatPercent(asset.percentChange24h)}
                        </span>
                        <span className={asset.percentChange7d >= 0 ? 'text-emerald-300' : 'text-red-300'}>
                          {formatPercent(asset.percentChange7d)}
                        </span>
                        <span className={scoreClass(asset.analysis.momentumScore)}>{asset.analysis.momentumScore}</span>
                        <span className="text-amber-300">{asset.analysis.volatilityScore}</span>
                        <span className={scoreClass(asset.analysis.liquidityScore)}>{asset.analysis.liquidityScore}</span>
                        <span className="inline-flex items-center gap-1">
                          {asset.analysis.riskLevel === 'high' ? <ShieldAlert className="h-3.5 w-3.5 text-red-300" /> : null}
                          {riskLabel(asset.analysis.riskLevel)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <p className="pb-3 text-center text-xs text-slate-400">
              Veri kaynagi: CoinMarketCap + anlik kur verisi. Bu platform bilgi amaclidir, yatirim tavsiyesi degildir.
            </p>
          </section>
        </div>
      </div>

      <Button
        asChild
        className="fixed bottom-6 right-6 border border-cyan-500/40 bg-cyan-700/90 text-white shadow-[0_0_24px_rgba(34,211,238,.25)] hover:bg-cyan-600"
      >
        <Link href="/asistan">
          <Bot className="mr-2 h-4 w-4" />
          Chatbot
        </Link>
      </Button>
    </main>
  );
}
