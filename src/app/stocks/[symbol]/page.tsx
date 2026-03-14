'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  ExternalLink,
  Loader2,
  MessageSquare,
  Newspaper,
  RefreshCw,
  Sparkles,
  Star,
  StarOff,
  TrendingDown,
  TrendingUp,
  Trash2,
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
import { Textarea } from '@/components/ui/textarea';
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

interface RelatedNewsItem {
  title: string;
  link: string;
  publishedAt: string;
  source: string;
}

interface RelatedNewsApiResponse {
  success: boolean;
  data: RelatedNewsItem[];
}

interface CurrentUser {
  id: string;
  rumuz: string;
}

interface StockComment {
  id: string;
  symbol: string;
  userId: string;
  authorName: string;
  content: string;
  createdAt: string;
}

interface StockCommentsApiResponse {
  success: boolean;
  data: StockComment[];
}

function formatNumber(value: number, fractionDigits = 2): string {
  return value.toLocaleString('tr-TR', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

function formatNewsDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatStatusLabel(value: string | null | undefined): string {
  if (!value) return '-';
  return value.replaceAll('_', ' ');
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

function calculateEMA(values: number[], period: number): number[] {
  if (values.length === 0) return [];
  const k = 2 / (period + 1);
  const ema = [values[0]];
  for (let i = 1; i < values.length; i++) {
    ema.push(values[i] * k + ema[i - 1] * (1 - k));
  }
  return ema;
}

function calculateMACD(values: number[]) {
  if (values.length < 35) return null;
  const ema12 = calculateEMA(values, 12);
  const ema26 = calculateEMA(values, 26);
  const macdLine = ema12.map((v, i) => v - ema26[i]);
  const signalLine = calculateEMA(macdLine.slice(25), 9);
  if (signalLine.length < 2 || macdLine.length < 2) return null;

  const lastMacd = macdLine[macdLine.length - 1];
  const lastSignal = signalLine[signalLine.length - 1];
  const prevMacd = macdLine[macdLine.length - 2];
  const prevSignal = signalLine[signalLine.length - 2];
  let crossSignal: 'BULLISH' | 'BEARISH' | null = null;
  if (prevMacd < prevSignal && lastMacd > lastSignal) crossSignal = 'BULLISH';
  if (prevMacd > prevSignal && lastMacd < lastSignal) crossSignal = 'BEARISH';

  return {
    value: +lastMacd.toFixed(3),
    signal: +lastSignal.toFixed(3),
    histogram: +(lastMacd - lastSignal).toFixed(3),
    trend: lastMacd > lastSignal ? 'YUKARI' : 'ASAGI',
    crossSignal,
  };
}

function calculateStochastic(highs: number[], lows: number[], closes: number[], period = 14) {
  if (closes.length < period) return null;
  const highestHigh = Math.max(...highs.slice(-period));
  const lowestLow = Math.min(...lows.slice(-period));
  const lastClose = closes[closes.length - 1];
  if (highestHigh === lowestLow) return { value: 50, signal: 'NOTR' };

  const k = +(((lastClose - lowestLow) / (highestHigh - lowestLow)) * 100).toFixed(2);
  if (k < 20) return { value: k, signal: 'ASIRI_DUSUK_BOLGE' };
  if (k > 80) return { value: k, signal: 'ASIRI_YUKSEK_BOLGE' };
  return { value: k, signal: 'NOTR' };
}

function calculateATR(highs: number[], lows: number[], closes: number[], period = 14) {
  if (closes.length < period + 1) return null;
  const trueRanges: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    trueRanges.push(
      Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1])
      )
    );
  }
  const atr = trueRanges.slice(-period).reduce((acc, val) => acc + val, 0) / period;
  const lastClose = closes[closes.length - 1];
  return { value: +atr.toFixed(2), percent: +((atr / lastClose) * 100).toFixed(2) };
}

function calculateFibonacci(values: number[]) {
  if (values.length < 2) return null;
  const lookback = values.slice(-Math.min(values.length, 90));
  const high = Math.max(...lookback);
  const low = Math.min(...lookback);
  const diff = high - low;
  return {
    high: +high.toFixed(2),
    low: +low.toFixed(2),
    r236: +(high - diff * 0.236).toFixed(2),
    r382: +(high - diff * 0.382).toFixed(2),
    r500: +(high - diff * 0.5).toFixed(2),
    r618: +(high - diff * 0.618).toFixed(2),
  };
}

function calculateWilliamsR(highs: number[], lows: number[], closes: number[], period = 14) {
  if (closes.length < period) return null;
  const highestHigh = Math.max(...highs.slice(-period));
  const lowestLow = Math.min(...lows.slice(-period));
  const lastClose = closes[closes.length - 1];
  if (highestHigh === lowestLow) return { value: -50, signal: 'NOTR' };

  const r = +(((highestHigh - lastClose) / (highestHigh - lowestLow)) * -100).toFixed(2);
  if (r > -20) return { value: r, signal: 'ASIRI_YUKSEK_BOLGE' };
  if (r < -80) return { value: r, signal: 'ASIRI_DUSUK_BOLGE' };
  return { value: r, signal: 'NOTR' };
}

function calculateCCI(highs: number[], lows: number[], closes: number[], period = 20) {
  if (closes.length < period) return null;
  const typical = Array.from({ length: period }, (_, idx) => {
    const i = closes.length - period + idx;
    return (highs[i] + lows[i] + closes[i]) / 3;
  });
  const mean = typical.reduce((acc, val) => acc + val, 0) / period;
  const meanDev = typical.reduce((acc, val) => acc + Math.abs(val - mean), 0) / period;
  const lastTypical = (highs[highs.length - 1] + lows[lows.length - 1] + closes[closes.length - 1]) / 3;
  const cci = meanDev === 0 ? 0 : +(((lastTypical - mean) / (0.015 * meanDev)).toFixed(2));

  if (cci > 100) return { value: cci, signal: 'ASIRI_YUKSEK_BOLGE' };
  if (cci < -100) return { value: cci, signal: 'ASIRI_DUSUK_BOLGE' };
  return { value: cci, signal: 'NOTR' };
}

function calculateROC(values: number[], period = 10) {
  if (values.length < period + 1) return null;
  const latest = values[values.length - 1];
  const prev = values[values.length - 1 - period];
  const roc = +(((latest - prev) / prev) * 100).toFixed(2);
  return { value: roc, trend: roc >= 0 ? 'POZITIF' : 'NEGATIF' };
}

function calculateOBV(closes: number[], volumes: number[]) {
  if (closes.length < 2) return null;
  let obv = 0;
  const obvSeries: number[] = [0];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > closes[i - 1]) obv += volumes[i];
    else if (closes[i] < closes[i - 1]) obv -= volumes[i];
    obvSeries.push(obv);
  }
  return {
    value: Math.round(obv),
    trend: obvSeries[obvSeries.length - 1] >= obvSeries[0] ? 'POZITIF' : 'NEGATIF',
  };
}

function composeDeepSignal(input: {
  macdTrend?: string;
  stochasticSignal?: string;
  williamsSignal?: string;
  cciSignal?: string;
  rocTrend?: string;
  obvTrend?: string;
}) {
  let bull = 0;
  let bear = 0;
  if (input.macdTrend === 'YUKARI') bull++; else if (input.macdTrend === 'ASAGI') bear++;
  if (input.stochasticSignal === 'ASIRI_DUSUK_BOLGE') bull++; else if (input.stochasticSignal === 'ASIRI_YUKSEK_BOLGE') bear++;
  if (input.williamsSignal === 'ASIRI_DUSUK_BOLGE') bull++; else if (input.williamsSignal === 'ASIRI_YUKSEK_BOLGE') bear++;
  if (input.cciSignal === 'ASIRI_DUSUK_BOLGE') bull++; else if (input.cciSignal === 'ASIRI_YUKSEK_BOLGE') bear++;
  if (input.rocTrend === 'POZITIF') bull++; else if (input.rocTrend === 'NEGATIF') bear++;
  if (input.obvTrend === 'POZITIF') bull++; else if (input.obvTrend === 'NEGATIF') bear++;

  let composite = 'NOTR';
  if (bull >= 4) composite = 'GUCLU_POZITIF_MOMENTUM';
  else if (bull >= 3) composite = 'POZITIF_MOMENTUM';
  else if (bear >= 4) composite = 'GUCLU_NEGATIF_MOMENTUM';
  else if (bear >= 3) composite = 'NEGATIF_MOMENTUM';

  return { bull, bear, composite };
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
  const [relatedNews, setRelatedNews] = useState<RelatedNewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [comments, setComments] = useState<StockComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentInput, setCommentInput] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [deepAiLoading, setDeepAiLoading] = useState(false);
  const [deepAiComment, setDeepAiComment] = useState<string | null>(null);

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

  const fetchRelatedNews = useCallback(async () => {
    if (!symbol) return;
    setNewsLoading(true);
    try {
      const response = await fetch(`/api/stocks/${encodeURIComponent(symbol)}/news?limit=8`);
      const data: RelatedNewsApiResponse = await response.json();
      if (data.success) {
        setRelatedNews(data.data ?? []);
      } else {
        setRelatedNews([]);
      }
    } catch {
      setRelatedNews([]);
    } finally {
      setNewsLoading(false);
    }
  }, [symbol]);

  const fetchCurrentUser = useCallback(async () => {
    try {
      const response = await fetch('/api/auth');
      const data = await response.json();
      if (data.success && data.user) {
        setCurrentUser({ id: data.user.id, rumuz: data.user.rumuz });
      } else {
        setCurrentUser(null);
      }
    } catch {
      setCurrentUser(null);
    }
  }, []);

  const fetchComments = useCallback(async () => {
    if (!symbol) return;
    setCommentsLoading(true);
    try {
      const response = await fetch(`/api/stocks/${encodeURIComponent(symbol)}/comments?limit=50`);
      const data: StockCommentsApiResponse = await response.json();
      if (data.success) {
        setComments(data.data ?? []);
      } else {
        setComments([]);
      }
    } catch {
      setComments([]);
    } finally {
      setCommentsLoading(false);
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

  useEffect(() => {
    fetchRelatedNews();
  }, [fetchRelatedNews]);

  useEffect(() => {
    fetchCurrentUser();
    fetchComments();
  }, [fetchComments, fetchCurrentUser]);

  useEffect(() => {
    // Avoid showing stale educational commentary when symbol/timeframe changes
    setDeepAiComment(null);
  }, [symbol, timeframe]);

  const isInWatchlist = useMemo(
    () => watchlist.some(item => item.symbol.toUpperCase() === symbol),
    [watchlist, symbol]
  );

  const closeSeries = useMemo(() => historicalData.map(item => item.close), [historicalData]);
  const sma20 = useMemo(() => calculateSMA(closeSeries, 20), [closeSeries]);
  const sma50 = useMemo(() => calculateSMA(closeSeries, 50), [closeSeries]);
  const rsi14 = useMemo(() => calculateRSI(closeSeries, 14), [closeSeries]);
  const volatility = useMemo(() => calculateVolatility(closeSeries), [closeSeries]);
  const deepAnalysis = useMemo(() => {
    if (historicalData.length < 20) return null;
    const closes = historicalData.map(item => item.close);
    const highs = historicalData.map(item => item.high);
    const lows = historicalData.map(item => item.low);
    const volumes = historicalData.map(item => item.volume);

    const macd = calculateMACD(closes);
    const stochastic = calculateStochastic(highs, lows, closes);
    const atr = calculateATR(highs, lows, closes);
    const fibonacci = calculateFibonacci(closes);
    const williamsR = calculateWilliamsR(highs, lows, closes);
    const cci = calculateCCI(highs, lows, closes);
    const roc = calculateROC(closes);
    const obv = calculateOBV(closes, volumes);

    const score = composeDeepSignal({
      macdTrend: macd?.trend,
      stochasticSignal: stochastic?.signal,
      williamsSignal: williamsR?.signal,
      cciSignal: cci?.signal,
      rocTrend: roc?.trend,
      obvTrend: obv?.trend,
    });

    return {
      macd,
      stochastic,
      atr,
      fibonacci,
      williamsR,
      cci,
      roc,
      obv,
      ...score,
    };
  }, [historicalData]);

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

  const handleSubmitComment = async () => {
    if (!currentUser) {
      toast({
        title: 'Giris gerekli',
        description: 'Yorum yapabilmek icin once giris yapmalisiniz',
        variant: 'destructive',
      });
      return;
    }
    const trimmed = commentInput.trim();
    if (trimmed.length < 2) {
      toast({
        title: 'Yorum kisa',
        description: 'Yorum en az 2 karakter olmali',
        variant: 'destructive',
      });
      return;
    }

    setCommentSubmitting(true);
    try {
      const response = await fetch(`/api/stocks/${encodeURIComponent(symbol)}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: trimmed }),
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Yorum eklenemedi');
      }
      setComments(prev => [data.data as StockComment, ...prev]);
      setCommentInput('');
      toast({ title: 'Yorum eklendi' });
    } catch (error) {
      toast({
        title: 'Hata',
        description: error instanceof Error ? error.message : 'Yorum eklenemedi',
        variant: 'destructive',
      });
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      const response = await fetch(
        `/api/stocks/${encodeURIComponent(symbol)}/comments?id=${encodeURIComponent(commentId)}`,
        { method: 'DELETE' }
      );
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Yorum silinemedi');
      }
      setComments(prev => prev.filter(item => item.id !== commentId));
      toast({ title: 'Yorum silindi' });
    } catch (error) {
      toast({
        title: 'Hata',
        description: error instanceof Error ? error.message : 'Yorum silinemedi',
        variant: 'destructive',
      });
    }
  };

  const handleDeepAiCommentary = async () => {
    if (!deepAnalysis) return;
    setDeepAiLoading(true);
    try {
      const prompt = `Aşağıdaki hisse verilerine göre Türkçe, kısa ve net bir "derinlik analizi yorumu" üret.

Format:
1) Genel Görünüm
2) Göstergelerin Özeti
3) Riskler ve Belirsizlikler
4) İzlenecek Veri Seviyeleri

Kurallar:
- En fazla 12 satır
- Maddeli ve sade yaz
- Sadece verilen verilerden çıkarım yap
- Kesin hüküm verme
- Yonlendirici eylem cagrisi, oneriler veya kesin yon ifadesi kullanma
- Son satıra şu ifadeyi aynen ekle: "Yasal Sorumluluk Notu: Bu içerik yalnızca bilgilendirme amaçlıdır. Verilecek tüm yatırım kararları ile doğabilecek hukuki ve mali sorumluluk tamamen kullanıcıya aittir."

Hisse: ${stockDetail?.code ?? symbol}
Fiyat: ${latestPrice}
Günlük Değişim (%): ${stockDetail?.changePercent ?? 0}
Zaman Dilimi: ${timeframe}

Bileşik Durum Skoru: ${deepAnalysis.composite}
Bull Skor: ${deepAnalysis.bull}
Bear Skor: ${deepAnalysis.bear}

MACD: ${deepAnalysis.macd?.value ?? '-'} | Referans Hat: ${deepAnalysis.macd?.signal ?? '-'} | Hist: ${deepAnalysis.macd?.histogram ?? '-'} | Trend: ${deepAnalysis.macd?.trend ?? '-'}
Stochastic %K: ${deepAnalysis.stochastic?.value ?? '-'} | Durum: ${deepAnalysis.stochastic?.signal ?? '-'}
ATR: ${deepAnalysis.atr?.value ?? '-'} | ATR%: ${deepAnalysis.atr?.percent ?? '-'}
Williams %R: ${deepAnalysis.williamsR?.value ?? '-'} | Durum: ${deepAnalysis.williamsR?.signal ?? '-'}
CCI: ${deepAnalysis.cci?.value ?? '-'} | Durum: ${deepAnalysis.cci?.signal ?? '-'}
ROC(10): ${deepAnalysis.roc?.value ?? '-'} | Trend: ${deepAnalysis.roc?.trend ?? '-'}
OBV: ${deepAnalysis.obv?.value ?? '-'} | Trend: ${deepAnalysis.obv?.trend ?? '-'}

Fibonacci:
High: ${deepAnalysis.fibonacci?.high ?? '-'}
0.236: ${deepAnalysis.fibonacci?.r236 ?? '-'}
0.382: ${deepAnalysis.fibonacci?.r382 ?? '-'}
0.500: ${deepAnalysis.fibonacci?.r500 ?? '-'}
0.618: ${deepAnalysis.fibonacci?.r618 ?? '-'}
Low: ${deepAnalysis.fibonacci?.low ?? '-'}`;

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, customPrompt: prompt }),
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Egitimsel degerlendirme olusturulamadi');
      }

      setDeepAiComment((data.data?.analysis as string) || 'Egitimsel degerlendirme alinamadi.');
    } catch (error) {
      toast({
        title: 'Hata',
        description: error instanceof Error ? error.message : 'Egitimsel degerlendirme olusturulamadi',
        variant: 'destructive',
      });
    } finally {
      setDeepAiLoading(false);
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
          <Link href="/" className="inline-flex items-center gap-2 text-slate-200 hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            Ana sayfaya don
          </Link>
          <Card className="mt-6 border-slate-800 bg-slate-900">
            <CardContent className="py-12 text-center">
              <p className="text-lg font-medium text-white">Hisse bulunamadi: {symbol}</p>
              <p className="mt-2 text-sm text-slate-300">Lutfen farkli bir hisse kodu deneyin.</p>
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
            <Link href="/" className="inline-flex items-center gap-2 text-slate-200 hover:text-white">
              <ArrowLeft className="h-4 w-4" />
              Ana sayfa
            </Link>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{stockDetail.code}</h1>
              <Badge variant="secondary" className="bg-slate-800 text-slate-300">
                Detayli Hisse Sayfasi
              </Badge>
            </div>
            <p className="text-sm text-slate-200">{stockDetail.name}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              className="border-slate-700 text-slate-300"
              onClick={() => {
                fetchDetail(timeframe);
                fetchRelatedNews();
                fetchComments();
              }}
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

        <div className="rounded-lg border border-amber-600/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          Bu sayfadaki tum icerikler egitim amaclidir. Yatirim tavsiyesi degildir; finansal kararlarin hukuki ve mali sorumlulugu kullaniciya aittir.
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="border-slate-800 bg-slate-900">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-300">Son Fiyat</CardTitle>
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
              <CardTitle className="text-sm font-medium text-slate-300">Gunluk Aralik</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-300">Dusuk</span>
                <span className="font-medium text-red-400">{formatNumber(dailyLow)} TL</span>
              </div>
              <div className="h-2 overflow-hidden rounded bg-slate-800">
                <div
                  className="h-full bg-gradient-to-r from-red-500 via-amber-500 to-emerald-500"
                  style={{ width: `${Math.max(0, Math.min(100, rangePosition))}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-300">Yuksek</span>
                <span className="font-medium text-emerald-400">{formatNumber(dailyHigh)} TL</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-slate-900">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-300">Hacim ve Acilis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Hacim</span>
                <span>{formatNumber(stockDetail.volume, 0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Acilis</span>
                <span>{formatNumber(stockDetail.open)} TL</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Onceki Kapanis</span>
                <span>{formatNumber(stockDetail.previousClose)} TL</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-slate-900">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-300">{timeframe} Performansi</CardTitle>
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
                  <p className="text-sm text-slate-300">
                    {periodPerformance.change >= 0 ? '+' : ''}
                    {formatNumber(periodPerformance.change)} TL
                  </p>
                </div>
              ) : (
                <p className="text-sm text-slate-400">Yeterli gecmis veri yok</p>
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
              <div className="flex h-[320px] items-center justify-center text-slate-300">
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
                <span className="text-slate-300">SMA 20</span>
                <span>{sma20 ? `${formatNumber(sma20)} TL` : '-'}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-slate-800/50 px-3 py-2">
                <span className="text-slate-300">SMA 50</span>
                <span>{sma50 ? `${formatNumber(sma50)} TL` : '-'}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-slate-800/50 px-3 py-2">
                <span className="text-slate-300">RSI 14</span>
                <span>{rsi14 ? formatNumber(rsi14) : '-'}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-slate-800/50 px-3 py-2">
                <span className="text-slate-300">Yillik Volatilite</span>
                <span>{volatility ? `${formatNumber(volatility)}%` : '-'}</span>
              </div>
              <p className="pt-1 text-xs text-slate-400">
                RSI &gt; 70 asiri yuksek, RSI &lt; 30 asiri dusuk bolgeyi isaret edebilir.
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
                    <span className="text-right text-slate-300">{formatNumber(row.open)}</span>
                    <span className="text-right text-slate-300">{formatNumber(row.close)}</span>
                    <span className="text-right text-slate-400">
                      {maxVolume > 0 ? `${Math.round((row.volume / maxVolume) * 100)}%` : '0%'}
                    </span>
                  </div>
                ))}
                {historicalData.length === 0 && <p className="text-sm text-slate-400">Veri bulunamadi.</p>}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-slate-800 bg-slate-900">
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-violet-400" />
              Egitimsel Derinlik Analizi
            </CardTitle>
            <Button
              size="sm"
              className="bg-violet-600 hover:bg-violet-700 text-white"
              onClick={handleDeepAiCommentary}
              disabled={!deepAnalysis || deepAiLoading}
            >
              {deepAiLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Degerlendirme Olustur
            </Button>
          </CardHeader>
          <CardContent>
            {deepAnalysis ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    className={
                      deepAnalysis.composite === 'GUCLU_POZITIF_MOMENTUM'
                        ? 'bg-emerald-600/20 text-emerald-400'
                        : deepAnalysis.composite === 'POZITIF_MOMENTUM'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : deepAnalysis.composite === 'GUCLU_NEGATIF_MOMENTUM'
                        ? 'bg-red-600/20 text-red-400'
                        : deepAnalysis.composite === 'NEGATIF_MOMENTUM'
                        ? 'bg-red-500/20 text-red-300'
                        : 'bg-slate-700 text-slate-200'
                    }
                  >
                    Bilesik Gosterge Durumu: {deepAnalysis.composite.replaceAll('_', ' ')}
                  </Badge>
                  <Badge variant="secondary" className="bg-slate-800 text-slate-300">
                    Bull: {deepAnalysis.bull}
                  </Badge>
                  <Badge variant="secondary" className="bg-slate-800 text-slate-300">
                    Bear: {deepAnalysis.bear}
                  </Badge>
                </div>

                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4 text-sm">
                  <div className="rounded-lg bg-slate-800/50 p-3">
                    <p className="text-slate-300">MACD</p>
                    <p className="font-medium text-white">
                      {deepAnalysis.macd ? `${deepAnalysis.macd.value} / ${deepAnalysis.macd.signal}` : '-'}
                    </p>
                    <p className="text-xs text-slate-400">
                      {deepAnalysis.macd ? `Hist: ${deepAnalysis.macd.histogram}` : ''}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-800/50 p-3">
                    <p className="text-slate-300">Stochastic %K</p>
                    <p className="font-medium text-white">
                      {deepAnalysis.stochastic ? `${formatNumber(deepAnalysis.stochastic.value)} (${formatStatusLabel(deepAnalysis.stochastic.signal)})` : '-'}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-800/50 p-3">
                    <p className="text-slate-300">ATR</p>
                    <p className="font-medium text-white">
                      {deepAnalysis.atr ? `${formatNumber(deepAnalysis.atr.value)} (${formatNumber(deepAnalysis.atr.percent)}%)` : '-'}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-800/50 p-3">
                    <p className="text-slate-300">ROC (10)</p>
                    <p className={`font-medium ${deepAnalysis.roc?.value && deepAnalysis.roc.value >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {deepAnalysis.roc ? `${deepAnalysis.roc.value >= 0 ? '+' : ''}${formatNumber(deepAnalysis.roc.value)}%` : '-'}
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2 text-sm">
                  <div className="rounded-lg bg-slate-800/40 p-3">
                    <p className="mb-2 font-medium text-white">Fibonacci Seviyeleri</p>
                    {deepAnalysis.fibonacci ? (
                      <div className="space-y-1 text-slate-300">
                        <div className="flex justify-between"><span>High</span><span>{formatNumber(deepAnalysis.fibonacci.high)} TL</span></div>
                        <div className="flex justify-between"><span>0.236</span><span>{formatNumber(deepAnalysis.fibonacci.r236)} TL</span></div>
                        <div className="flex justify-between"><span>0.382</span><span>{formatNumber(deepAnalysis.fibonacci.r382)} TL</span></div>
                        <div className="flex justify-between"><span>0.500</span><span>{formatNumber(deepAnalysis.fibonacci.r500)} TL</span></div>
                        <div className="flex justify-between"><span>0.618</span><span>{formatNumber(deepAnalysis.fibonacci.r618)} TL</span></div>
                        <div className="flex justify-between"><span>Low</span><span>{formatNumber(deepAnalysis.fibonacci.low)} TL</span></div>
                      </div>
                    ) : (
                      <p className="text-slate-400">Yeterli veri yok</p>
                    )}
                  </div>

                  <div className="rounded-lg bg-slate-800/40 p-3">
                    <p className="mb-2 font-medium text-white">Ek Gosterge Ozeti</p>
                    <div className="space-y-1 text-slate-300">
                      <div className="flex justify-between">
                        <span>Williams %R</span>
                        <span>{deepAnalysis.williamsR ? `${formatNumber(deepAnalysis.williamsR.value)} (${formatStatusLabel(deepAnalysis.williamsR.signal)})` : '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>CCI</span>
                        <span>{deepAnalysis.cci ? `${formatNumber(deepAnalysis.cci.value)} (${formatStatusLabel(deepAnalysis.cci.signal)})` : '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>OBV</span>
                        <span>{deepAnalysis.obv ? `${deepAnalysis.obv.value.toLocaleString('tr-TR')} (${deepAnalysis.obv.trend})` : '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>MACD Trend</span>
                        <span>{deepAnalysis.macd?.trend ?? '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Volatilite (Yillik)</span>
                        <span>{volatility ? `${formatNumber(volatility)}%` : '-'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {deepAiComment ? (
                  <div className="rounded-lg border border-violet-700/50 bg-violet-900/15 p-3">
                    <p className="mb-2 text-sm font-medium text-violet-300">Egitimsel Derinlik Degerlendirmesi</p>
                    <p className="whitespace-pre-wrap text-sm text-slate-100">{deepAiComment}</p>
                    <p className="mt-2 text-xs text-slate-400">
                      Yasal Sorumluluk Notu: Bu içerik yalnızca bilgilendirme amaçlıdır. Verilecek tüm yatırım kararları ile doğabilecek hukuki ve mali sorumluluk tamamen kullanıcıya aittir.
                    </p>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-slate-400">
                Derinlik analiz icin en az 20 gunluk gecmis veri gerekli.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              <Newspaper className="h-5 w-5 text-cyan-400" />
              Ilgili Haberler
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="text-slate-300 hover:text-white"
              onClick={fetchRelatedNews}
              disabled={newsLoading}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${newsLoading ? 'animate-spin' : ''}`} />
              Yenile
            </Button>
          </CardHeader>
          <CardContent>
            {newsLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
                <span className="ml-2 text-sm text-slate-300">Haberler yukleniyor...</span>
              </div>
            ) : relatedNews.length > 0 ? (
              <div className="space-y-2">
                {relatedNews.map((newsItem, index) => (
                  <a
                    key={`${newsItem.link}-${index}`}
                    href={newsItem.link}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="block rounded-lg border border-slate-800 bg-slate-800/30 p-3 transition-colors hover:bg-slate-800/60"
                  >
                    <p className="line-clamp-2 text-sm font-medium text-white">{newsItem.title}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-300">
                      <Badge variant="secondary" className="bg-slate-700 text-slate-300">
                        {newsItem.source}
                      </Badge>
                      <span>{formatNewsDate(newsItem.publishedAt)}</span>
                      <span className="inline-flex items-center gap-1 text-cyan-400">
                        Habere git
                        <ExternalLink className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-slate-400">
                Bu hisse icin su an listelenecek haber bulunamadi.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-emerald-400" />
              Yorumlar
            </CardTitle>
            <Badge variant="secondary" className="bg-slate-800 text-slate-300">
              {comments.length} yorum
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-800/30 p-3">
              <Textarea
                value={commentInput}
                onChange={e => setCommentInput(e.target.value)}
                placeholder={
                  currentUser
                    ? `${symbol} hakkinda gorusunuzu yazin...`
                    : 'Yorum yazmak icin once giris yapin'
                }
                className="min-h-[90px] border-slate-700 bg-slate-900 text-white placeholder:text-slate-400"
                disabled={!currentUser || commentSubmitting}
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-400">
                  {currentUser
                    ? `Yazan: @${currentUser.rumuz}`
                    : 'Giris icin ana sayfadan kullanici ikonuna tiklayabilirsiniz'}
                </p>
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700"
                  disabled={!currentUser || commentSubmitting || commentInput.trim().length < 2}
                  onClick={handleSubmitComment}
                >
                  {commentSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Yorum Gonder
                </Button>
              </div>
            </div>

            {commentsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
                <span className="ml-2 text-sm text-slate-300">Yorumlar yukleniyor...</span>
              </div>
            ) : comments.length > 0 ? (
              <div className="space-y-2">
                {comments.map(item => (
                  <div key={item.id} className="rounded-lg border border-slate-800 bg-slate-800/25 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-white">@{item.authorName}</p>
                        <p className="text-xs text-slate-400">{formatNewsDate(item.createdAt)}</p>
                      </div>
                      {currentUser?.id === item.userId ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-slate-400 hover:text-red-400"
                          onClick={() => handleDeleteComment(item.id)}
                          title="Yorumu sil"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-slate-200">{item.content}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-6 text-center text-sm text-slate-400">
                Bu hisse icin henuz yorum yok. Ilk yorumu siz yapin.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
