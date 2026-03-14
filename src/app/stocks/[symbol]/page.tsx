'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  Loader2,
  RefreshCw,
  Star,
  StarOff,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';

type Timeframe = '1M' | '3M' | '6M' | '1Y' | '3Y' | '5Y';

interface StockDetail {
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

interface HistoricalDataPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface StockDetailApiResponse {
  success: boolean;
  data: {
    detail: StockDetail | null;
    historical: HistoricalDataPoint[];
  };
  error?: string;
}

interface StocksApiResponse {
  success: boolean;
  data: StockDetail[];
}

interface WatchlistItem {
  id: string;
  symbol: string;
}

function formatNumber(value: number, fractionDigits = 2): string {
  return value.toLocaleString('tr-TR', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

function calculateSMA(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const last = values.slice(-period);
  return last.reduce((acc, current) => acc + current, 0) / period;
}

function calculateRSI(values: number[], period = 14): number | null {
  if (values.length <= period) return null;

  const changes = values.slice(1).map((value, index) => value - values[index]);
  const lastChanges = changes.slice(-period);
  const gains = lastChanges.filter(change => change > 0);
  const losses = lastChanges.filter(change => change < 0).map(loss => Math.abs(loss));

  const avgGain = gains.length > 0 ? gains.reduce((acc, gain) => acc + gain, 0) / period : 0;
  const avgLoss = losses.length > 0 ? losses.reduce((acc, loss) => acc + loss, 0) / period : 0;

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function calculateVolatility(values: number[]): number | null {
  if (values.length < 2) return null;

  const returns = values.slice(1).map((value, index) => (value - values[index]) / values[index]);
  const mean = returns.reduce((acc, item) => acc + item, 0) / returns.length;
  const variance = returns.reduce((acc, item) => acc + (item - mean) ** 2, 0) / returns.length;
  const dailyStd = Math.sqrt(variance);
  return dailyStd * Math.sqrt(252) * 100;
}

export default function StockDetailPage() {
  const params = useParams<{ symbol: string }>();
  const symbol = (params.symbol || '').toUpperCase();
  const { toast } = useToast();

  const [timeframe, setTimeframe] = useState<Timeframe>('6M');
  const [stockDetail, setStockDetail] = useState<StockDetail | null>(null);
  const [historicalData, setHistoricalData] = useState<HistoricalDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [watchlistLoading, setWatchlistLoading] = useState(false);

  const fetchWatchlist = useCallback(async () => {
    try {
      const response = await fetch('/api/watchlist');
      const data = await response.json();
      if (data.success) {
        setWatchlist((data.data ?? []) as WatchlistItem[]);
      }
    } catch {
      setWatchlist([]);
    }
  }, []);

  const fetchFallbackStockDetail = useCallback(async (): Promise<StockDetail | null> => {
    try {
      const response = await fetch('/api/stocks');
      const data: StocksApiResponse = await response.json();
      if (!data.success) return null;
      return data.data.find(item => item.code === symbol) ?? null;
    } catch {
      return null;
    }
  }, [symbol]);

  const fetchDetail = useCallback(
    async (selectedTimeframe: Timeframe, showBlockingLoader = false) => {
      if (!symbol) return;

      if (showBlockingLoader) setLoading(true);
      else setRefreshing(true);

      try {
        const response = await fetch(`/api/stocks/${encodeURIComponent(symbol)}?time=${selectedTimeframe}`);
        const data: StockDetailApiResponse = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Detay verisi alinamadi');
        }

        let detail = data.data.detail;
        if (!detail) {
          detail = await fetchFallbackStockDetail();
        }

        setStockDetail(detail);
        setHistoricalData(data.data.historical ?? []);
      } catch {
        toast({
          title: 'Hata',
          description: 'Hisse detay verileri alinamadi',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [fetchFallbackStockDetail, symbol, toast]
  );

  useEffect(() => {
    fetchDetail(timeframe, true);
  }, [fetchDetail, timeframe]);

  useEffect(() => {
    fetchWatchlist();
  }, [fetchWatchlist]);

  const isInWatchlist = useMemo(
    () => watchlist.some(item => item.symbol.toUpperCase() === symbol),
    [watchlist, symbol]
  );

  const closeSeries = useMemo(() => historicalData.map(item => item.close), [historicalData]);
  const sma20 = useMemo(() => calculateSMA(closeSeries, 20), [closeSeries]);
  const sma50 = useMemo(() => calculateSMA(closeSeries, 50), [closeSeries]);
  const rsi14 = useMemo(() => calculateRSI(closeSeries, 14), [closeSeries]);
  const volatility = useMemo(() => calculateVolatility(closeSeries), [closeSeries]);

  const periodPerformance = useMemo(() => {
    if (historicalData.length < 2) return null;
    const first = historicalData[0].close;
    const last = historicalData[historicalData.length - 1].close;
    if (!first) return null;
    const change = last - first;
    const changePercent = (change / first) * 100;
    return { change, changePercent };
  }, [historicalData]);

  const maxVolume = useMemo(() => {
    if (historicalData.length === 0) return 0;
    return Math.max(...historicalData.map(item => item.volume));
  }, [historicalData]);

  const latestPrice = stockDetail?.price ?? historicalData[historicalData.length - 1]?.close ?? 0;
  const dailyHigh = stockDetail?.high ?? 0;
  const dailyLow = stockDetail?.low ?? 0;
  const rangePosition =
    dailyHigh > dailyLow ? ((latestPrice - dailyLow) / (dailyHigh - dailyLow)) * 100 : 0;

  const handleToggleWatchlist = async () => {
    if (!stockDetail || watchlistLoading) return;
    setWatchlistLoading(true);
    try {
      if (isInWatchlist) {
        const response = await fetch(`/api/watchlist?symbol=${stockDetail.code}`, { method: 'DELETE' });
        const data = await response.json();
        if (!data.success) throw new Error(data.error);
        setWatchlist(prev => prev.filter(item => item.symbol.toUpperCase() !== stockDetail.code));
        toast({ title: 'Takipten cikarildi', description: `${stockDetail.code} listeden kaldirildi` });
      } else {
        const response = await fetch('/api/watchlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbol: stockDetail.code, name: stockDetail.name }),
        });
        const data = await response.json();
        if (!data.success) throw new Error(data.error);
        setWatchlist(prev => [...prev, data.data as WatchlistItem]);
        toast({ title: 'Takibe alindi', description: `${stockDetail.code} takip listesine eklendi` });
      }
    } catch {
      toast({
        title: 'Hata',
        description: 'Takip listesi islemi yapilamadi',
        variant: 'destructive',
      });
    } finally {
      setWatchlistLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-center px-4 py-16">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
          <span className="ml-3 text-slate-300">Detaylar yukleniyor...</span>
        </div>
      </div>
    );
  }

  if (!stockDetail) {
    return (
      <div className="min-h-screen bg-slate-950 text-white">
        <div className="mx-auto max-w-7xl px-4 py-10">
          <Link href="/" className="inline-flex items-center gap-2 text-slate-400 hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            Ana sayfaya don
          </Link>
          <Card className="mt-6 border-slate-800 bg-slate-900">
            <CardContent className="py-12 text-center">
              <p className="text-lg font-medium text-white">Hisse bulunamadi: {symbol}</p>
              <p className="mt-2 text-sm text-slate-400">Lutfen farkli bir hisse kodu deneyin.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-2">
            <Link href="/" className="inline-flex items-center gap-2 text-slate-400 hover:text-white">
              <ArrowLeft className="h-4 w-4" />
              Ana sayfa
            </Link>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{stockDetail.code}</h1>
              <Badge variant="secondary" className="bg-slate-800 text-slate-300">
                Detayli Hisse Sayfasi
              </Badge>
            </div>
            <p className="text-sm text-slate-400">{stockDetail.name}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              className="border-slate-700 text-slate-300"
              onClick={() => fetchDetail(timeframe)}
              disabled={refreshing}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Yenile
            </Button>
            <Button
              variant={isInWatchlist ? 'secondary' : 'default'}
              className={isInWatchlist ? 'bg-slate-700 text-white' : 'bg-emerald-600 hover:bg-emerald-700'}
              onClick={handleToggleWatchlist}
              disabled={watchlistLoading}
            >
              {watchlistLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : isInWatchlist ? (
                <StarOff className="mr-2 h-4 w-4" />
              ) : (
                <Star className="mr-2 h-4 w-4" />
              )}
              {isInWatchlist ? 'Takipten Cikar' : 'Takibe Al'}
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="border-slate-800 bg-slate-900">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-400">Son Fiyat</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <p className="text-3xl font-bold">{formatNumber(latestPrice)} TL</p>
                <p
                  className={`inline-flex items-center gap-1 text-sm ${
                    stockDetail.changePercent >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {stockDetail.changePercent >= 0 ? (
                    <ArrowUpRight className="h-4 w-4" />
                  ) : (
                    <ArrowDownRight className="h-4 w-4" />
                  )}
                  {stockDetail.change >= 0 ? '+' : ''}
                  {formatNumber(stockDetail.change)} ({stockDetail.changePercent >= 0 ? '+' : ''}
                  {formatNumber(stockDetail.changePercent)}%)
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-slate-900">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-400">Gunluk Aralik</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Dusuk</span>
                <span className="font-medium text-red-400">{formatNumber(dailyLow)} TL</span>
              </div>
              <div className="h-2 overflow-hidden rounded bg-slate-800">
                <div
                  className="h-full bg-gradient-to-r from-red-500 via-amber-500 to-emerald-500"
                  style={{ width: `${Math.max(0, Math.min(100, rangePosition))}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Yuksek</span>
                <span className="font-medium text-emerald-400">{formatNumber(dailyHigh)} TL</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-slate-900">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-400">Hacim ve Acilis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Hacim</span>
                <span>{formatNumber(stockDetail.volume, 0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Acilis</span>
                <span>{formatNumber(stockDetail.open)} TL</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Onceki Kapanis</span>
                <span>{formatNumber(stockDetail.previousClose)} TL</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-slate-900">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-400">{timeframe} Performansi</CardTitle>
            </CardHeader>
            <CardContent>
              {periodPerformance ? (
                <div className="space-y-2">
                  <p
                    className={`inline-flex items-center gap-1 text-lg font-semibold ${
                      periodPerformance.changePercent >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {periodPerformance.changePercent >= 0 ? (
                      <TrendingUp className="h-5 w-5" />
                    ) : (
                      <TrendingDown className="h-5 w-5" />
                    )}
                    {periodPerformance.changePercent >= 0 ? '+' : ''}
                    {formatNumber(periodPerformance.changePercent)}%
                  </p>
                  <p className="text-sm text-slate-400">
                    {periodPerformance.change >= 0 ? '+' : ''}
                    {formatNumber(periodPerformance.change)} TL
                  </p>
                </div>
              ) : (
                <p className="text-sm text-slate-500">Yeterli gecmis veri yok</p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="border-slate-800 bg-slate-900">
          <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <CardTitle>Fiyat Grafigi</CardTitle>
            <div className="flex flex-wrap gap-2">
              {(['1M', '3M', '6M', '1Y', '3Y', '5Y'] as Timeframe[]).map(item => (
                <Button
                  key={item}
                  size="sm"
                  variant={item === timeframe ? 'default' : 'outline'}
                  className={
                    item === timeframe ? 'bg-emerald-600 hover:bg-emerald-700' : 'border-slate-700 text-slate-300'
                  }
                  onClick={() => setTimeframe(item)}
                >
                  {item}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {historicalData.length > 0 ? (
              <>
                <div className="h-[340px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={historicalData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis
                        dataKey="date"
                        stroke="#64748b"
                        tick={{ fill: '#94a3b8', fontSize: 12 }}
                        tickFormatter={(value: string) => value.slice(5)}
                      />
                      <YAxis
                        stroke="#64748b"
                        tick={{ fill: '#94a3b8', fontSize: 12 }}
                        tickFormatter={(value: number) => `${formatNumber(value, 0)}`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          border: '1px solid #334155',
                          borderRadius: '8px',
                        }}
                        labelFormatter={(label: string) => `Tarih: ${label}`}
                        formatter={(value: number, key: string) => [
                          `${formatNumber(value)} TL`,
                          key === 'close' ? 'Kapanis' : key,
                        ]}
                      />
                      <Line type="monotone" dataKey="close" stroke="#10b981" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <Separator className="bg-slate-800" />

                <div className="h-[180px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={historicalData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="date" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} hide />
                      <YAxis
                        stroke="#64748b"
                        tick={{ fill: '#94a3b8', fontSize: 11 }}
                        tickFormatter={(value: number) => `${Math.round(value / 1000)}K`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          border: '1px solid #334155',
                          borderRadius: '8px',
                        }}
                        formatter={(value: number) => [`${formatNumber(value, 0)}`, 'Hacim']}
                      />
                      <Bar dataKey="volume" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            ) : (
              <div className="flex h-[320px] items-center justify-center text-slate-400">
                Bu hisse icin gecmis grafik verisi yok.
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="border-slate-800 bg-slate-900">
            <CardHeader>
              <CardTitle>Teknik Gostergeler</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between rounded-lg bg-slate-800/50 px-3 py-2">
                <span className="text-slate-400">SMA 20</span>
                <span>{sma20 ? `${formatNumber(sma20)} TL` : '-'}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-slate-800/50 px-3 py-2">
                <span className="text-slate-400">SMA 50</span>
                <span>{sma50 ? `${formatNumber(sma50)} TL` : '-'}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-slate-800/50 px-3 py-2">
                <span className="text-slate-400">RSI 14</span>
                <span>{rsi14 ? formatNumber(rsi14) : '-'}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-slate-800/50 px-3 py-2">
                <span className="text-slate-400">Yillik Volatilite</span>
                <span>{volatility ? `${formatNumber(volatility)}%` : '-'}</span>
              </div>
              <p className="pt-1 text-xs text-slate-500">
                RSI &gt; 70 asiri alim, RSI &lt; 30 asiri satim bolgesini isaret edebilir.
              </p>
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-slate-900">
            <CardHeader>
              <CardTitle>Son 10 Islem Gunu</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {historicalData.slice(-10).reverse().map(row => (
                  <div
                    key={row.date}
                    className="grid grid-cols-5 items-center rounded-lg bg-slate-800/40 px-3 py-2 text-xs sm:text-sm"
                  >
                    <span className="col-span-2 text-slate-300">{row.date}</span>
                    <span className="text-right text-slate-400">{formatNumber(row.open)}</span>
                    <span className="text-right text-slate-400">{formatNumber(row.close)}</span>
                    <span className="text-right text-slate-500">
                      {maxVolume > 0 ? `${Math.round((row.volume / maxVolume) * 100)}%` : '0%'}
                    </span>
                  </div>
                ))}
                {historicalData.length === 0 && <p className="text-sm text-slate-500">Veri bulunamadi.</p>}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
