'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  ComposedChart,
  ReferenceLine,
} from 'recharts';
import {
  Search,
  TrendingUp,
  TrendingDown,
  Star,
  StarOff,
  Bell,
  RefreshCw,
  Loader2,
  AlertCircle,
  BarChart3,
  Bot,
  Plus,
  Trash2,
  X,
  Send,
  Zap,
  Database,
  Globe,
  FileText,
  Building2,
  Scan,
  ArrowUpRight,
  ArrowDownRight,
  History,
  Sparkles,
  Upload,
  Image as ImageIcon,
  LineChart as LineChartIcon,
  User,
  LogIn,
  LogOut,
  UserPlus,
  KeyRound,
  LayoutDashboard,
  List,
  Users,
  Activity,
  Newspaper,
  Target,
  Info,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Types
interface Stock {
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

interface GlobalMarketItem {
  symbol: string;
  name: string;
  market: 'digital' | 'forex' | 'nasdaq';
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  volume: number;
}

interface WatchlistItem {
  id: string;
  symbol: string;
  name: string;
  targetPrice: number | null;
  createdAt: string;
}

interface PriceAlert {
  id: string;
  symbol: string;
  targetPrice: number;
  condition: string;
  active: boolean;
  triggered: boolean;
  createdAt: string;
}

interface HistoricalData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface PendingAction {
  tool: string;
  params: Record<string, unknown>;
  description: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  toolsUsed?: string[];
  pendingActions?: PendingAction[];
  suggestedQuestions?: string[];
  timestamp: Date;
}

interface CurrentUser {
  id: string;
  rumuz: string;
  avatar: string | null;
  watchlistCount: number;
  alertsCount: number;
  createdAt: string;
}

// Tool definitions for UI
const TOOLS = [
  { id: 'get_stock_price', name: 'Hisse Fiyatı', icon: BarChart3, color: 'text-emerald-400' },
  { id: 'get_stock_history', name: 'Geçmiş Veri', icon: History, color: 'text-blue-400' },
  { id: 'get_watchlist', name: 'Takip Listesi', icon: Star, color: 'text-yellow-400' },
  { id: 'add_to_watchlist', name: 'Listeye Ekle', icon: Plus, color: 'text-green-400' },
  { id: 'remove_from_watchlist', name: 'Listeden Çıkar', icon: Trash2, color: 'text-red-400' },
  { id: 'web_search', name: 'Web Araması', icon: Globe, color: 'text-purple-400' },
  { id: 'read_document', name: 'Doküman Okuma', icon: FileText, color: 'text-orange-400' },
  { id: 'read_txt_file', name: 'TXT Analizi', icon: FileText, color: 'text-amber-400' },
  { id: 'get_kap_data', name: 'KAP Verileri', icon: Building2, color: 'text-cyan-400' },
  { id: 'scan_market', name: 'Piyasa Tarama', icon: Scan, color: 'text-pink-400' },
  { id: 'get_top_gainers', name: 'Yükselenler', icon: ArrowUpRight, color: 'text-emerald-400' },
  { id: 'get_top_losers', name: 'Düşenler', icon: ArrowDownRight, color: 'text-red-400' },
  { id: 'get_price_alerts', name: 'Bildirimler', icon: Bell, color: 'text-amber-400' },
  { id: 'create_price_alert', name: 'Bildirim Oluştur', icon: Bell, color: 'text-amber-400' },
  { id: 'analyze_chart_image', name: 'Grafik Analizi', icon: LineChartIcon, color: 'text-violet-400' },
  // New tools
  { id: 'analyze_portfolio', name: 'Portföy Analizi', icon: Sparkles, color: 'text-yellow-300' },
  { id: 'compare_stocks', name: 'Hisse Karşılaştır', icon: BarChart3, color: 'text-sky-400' },
  { id: 'technical_indicators', name: 'RSI/Bollinger', icon: LineChartIcon, color: 'text-indigo-400' },
  { id: 'get_economic_calendar', name: 'Ekonomi Takvimi', icon: Building2, color: 'text-teal-400' },
  { id: 'stock_screener', name: 'Hisse Tarayıcı', icon: Scan, color: 'text-rose-400' },
  { id: 'deep_mathematical_analysis', name: 'Derin Matematik', icon: Sparkles, color: 'text-violet-300' },
];

// Tool categories for UI selector
const TOOL_CATEGORIES = [
  {
    id: 'price',
    label: 'Fiyat & Teknik',
    color: 'emerald',
    activeClass: 'bg-emerald-600/20 border-emerald-500 text-emerald-300',
    inactiveClass: 'border-slate-700 text-slate-500',
    tools: ['get_stock_price', 'get_stock_history', 'technical_indicators', 'compare_stocks'],
  },
  {
    id: 'news',
    label: 'Haber & KAP',
    color: 'blue',
    activeClass: 'bg-blue-600/20 border-blue-500 text-blue-300',
    inactiveClass: 'border-slate-700 text-slate-500',
    tools: ['web_search', 'read_document', 'get_kap_data', 'get_economic_calendar'],
  },
  {
    id: 'portfolio',
    label: 'Portföy',
    color: 'yellow',
    activeClass: 'bg-yellow-600/20 border-yellow-500 text-yellow-300',
    inactiveClass: 'border-slate-700 text-slate-500',
    tools: ['get_watchlist', 'add_to_watchlist', 'remove_from_watchlist',
            'get_price_alerts', 'create_price_alert', 'analyze_portfolio'],
  },
  {
    id: 'market',
    label: 'Piyasa',
    color: 'pink',
    activeClass: 'bg-pink-600/20 border-pink-500 text-pink-300',
    inactiveClass: 'border-slate-700 text-slate-500',
    tools: ['scan_market', 'get_top_gainers', 'get_top_losers', 'stock_screener'],
  },
  {
    id: 'deepmath',
    label: 'Derin Analiz',
    color: 'violet',
    activeClass: 'bg-violet-600/20 border-violet-500 text-violet-300',
    inactiveClass: 'border-slate-700 text-slate-500',
    tools: ['technical_indicators', 'analyze_chart_image', 'deep_mathematical_analysis'],
  },
];

// Tab definitions
const TABS = [
  { id: 'dashboard', label: 'Ana Sayfa', icon: LayoutDashboard },
  { id: 'stocks',    label: 'Hisseler',  icon: Database },
  { id: 'market',    label: 'Market',    icon: TrendingUp },
  { id: 'watchlist', label: 'Takip',     icon: Star },
  { id: 'alerts',    label: 'Bildirim',  icon: Bell },
];

const LEGAL_DISCLAIMER_TEXT =
  'Bu platform tamamen egitim amaclidir. Icerikler yatirim tavsiyesi degildir; finansal kararlarin hukuki ve mali sorumlulugu kullaniciya aittir.';

export default function Home() {
  const { toast } = useToast();
  const router = useRouter();
  
  // State
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [filteredStocks, setFilteredStocks] = useState<Stock[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [marketTab, setMarketTab] = useState<'gainers' | 'losers' | 'active'>('gainers');
  
  // Market Summary
  const [marketSummary, setMarketSummary] = useState<{
    totalStocks: number;
    gainers: number;
    losers: number;
    avgChangePercent: string;
    topGainers: Array<{ symbol: string; name: string; price: number; changePercent: number; sector?: string }>;
    topLosers: Array<{ symbol: string; name: string; price: number; changePercent: number; sector?: string }>;
    mostActive: Array<{ symbol: string; name: string; price: number; volume: number; sector?: string }>;
  } | null>(null);
  const [popularStocks, setPopularStocks] = useState<Array<{ symbol: string; name: string; count: number; price: number; changePercent: number }>>([]);
  const [sectors, setSectors] = useState<Array<{ name: string; count: number; avgChange: number; topStocks: Stock[] }>>([]);
  const [similarStocks, setSimilarStocks] = useState<Stock[]>([]);
  const [globalMarketData, setGlobalMarketData] = useState<{
    digitalCurrencies: GlobalMarketItem[];
    forex: GlobalMarketItem[];
    nasdaq: GlobalMarketItem[];
    source: string;
  } | null>(null);
  
  // Detail Modal
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  const [historicalData, setHistoricalData] = useState<HistoricalData[]>([]);
  const [chartTimeframe, setChartTimeframe] = useState('1M');
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState<'grafik' | 'teknik' | 'ai' | 'ozet'>('grafik');
  const [detailAnalysis, setDetailAnalysis] = useState<string | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  
  // Educational assistant
  const [agentOpen, setAgentOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [lastToolsUsed, setLastToolsUsed] = useState<string[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  // Tool category selector: all enabled by default
  const [enabledCategories, setEnabledCategories] = useState<Set<string>>(
    new Set(TOOL_CATEGORIES.map(c => c.id))
  );
  const [toolSelectorOpen, setToolSelectorOpen] = useState(false);
  
  // File uploads
  const txtInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [chartAnalyzing, setChartAnalyzing] = useState(false);
  
  // Auth
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Fetch current user
  const fetchCurrentUser = useCallback(async () => {
    try {
      const response = await fetch('/api/auth');
      const data = await response.json();
      if (data.success && data.user) {
        setCurrentUser(data.user);
      }
    } catch {
      console.error('Failed to fetch user');
    }
  }, []);

  // Fetch all stocks
  const fetchStocks = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    
    try {
      const response = await fetch('/api/stocks');
      const data = await response.json();
      
      if (data.success) {
        setStocks(data.data);
        setFilteredStocks(data.data);
      }
    } catch {
      toast({ title: 'Hata', description: 'Veriler alınamadı', variant: 'destructive' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  // Fetch watchlist
  const fetchWatchlist = useCallback(async () => {
    try {
      const response = await fetch('/api/watchlist');
      const data = await response.json();
      if (data.success) setWatchlist(data.data);
    } catch {}
  }, []);

  // Fetch alerts
  const fetchAlerts = useCallback(async () => {
    try {
      const response = await fetch('/api/alerts');
      const data = await response.json();
      if (data.success) setAlerts(data.data);
    } catch {}
  }, []);

  // Fetch market summary
  const fetchMarketSummary = useCallback(async () => {
    try {
      const response = await fetch('/api/market');
      const data = await response.json();
      if (data.success) {
        setMarketSummary(data.data);
      }
    } catch {}
  }, []);

  // Fetch popular stocks (most added to watchlist)
  const fetchPopularStocks = useCallback(async () => {
    try {
      const response = await fetch('/api/market?type=popular');
      const data = await response.json();
      if (data.success) {
        setPopularStocks(data.data);
      }
    } catch {}
  }, []);

  // Fetch sectors
  const fetchSectors = useCallback(async () => {
    try {
      const response = await fetch('/api/market?type=sectors');
      const data = await response.json();
      if (data.success) {
        setSectors(data.data);
      }
    } catch {}
  }, []);

  // Fetch global market data (Digital Currency, Forex, NASDAQ) from Twelve Data
  const fetchGlobalMarketData = useCallback(async () => {
    try {
      const response = await fetch('/api/market?type=global');
      const data = await response.json();
      if (data.success && data.data) {
        setGlobalMarketData({
          digitalCurrencies: data.data.digitalCurrencies ?? [],
          forex: data.data.forex ?? [],
          nasdaq: data.data.nasdaq ?? [],
          source: data.source ?? data.data.source ?? 'fallback',
        });
      }
    } catch {
      setGlobalMarketData(null);
    }
  }, []);

  // Fetch related stocks based on watchlist sectors (educational listing)
  const fetchSimilarStocks = useCallback(async () => {
    try {
      const symbols = watchlist.map(item => item.symbol).join(',');
      if (!symbols) {
        setSimilarStocks([]);
        return;
      }
      const response = await fetch(`/api/market?type=similar&symbol=${symbols}`);
      const data = await response.json();
      if (data.success) {
        setSimilarStocks(data.data);
      }
    } catch {
      setSimilarStocks([]);
    }
  }, [watchlist]);

  // Initial load
  useEffect(() => {
    fetchStocks();
    fetchWatchlist();
    fetchAlerts();
    fetchCurrentUser();
    fetchMarketSummary();
    fetchPopularStocks();
    fetchSectors();
    fetchGlobalMarketData();
  }, [fetchStocks, fetchWatchlist, fetchAlerts, fetchCurrentUser, fetchMarketSummary, fetchPopularStocks, fetchSectors, fetchGlobalMarketData]);

  // Fetch similar when watchlist changes
  useEffect(() => {
    fetchSimilarStocks();
  }, [fetchSimilarStocks]);

  // Filter stocks
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredStocks(stocks);
      return;
    }
    const query = searchQuery.toLowerCase();
    setFilteredStocks(stocks.filter(s => 
      s.code.toLowerCase().includes(query) || s.name.toLowerCase().includes(query)
    ));
  }, [searchQuery, stocks]);

  // Auto scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Countdown for verification code resend button
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown(prev => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const isInWatchlist = (symbol: string) => watchlist.some(item => item.symbol === symbol);

  const addToWatchlist = async (stock: Stock) => {
    try {
      const response = await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: stock.code, name: stock.name }),
      });
      const data = await response.json();
      if (data.success) {
        setWatchlist(prev => [...prev, data.data]);
        fetchPopularStocks();
        toast({ title: 'Eklendi', description: `${stock.code} takibe alındı` });
      }
    } catch {
      toast({ title: 'Hata', variant: 'destructive' });
    }
  };

  const removeFromWatchlist = async (symbol: string) => {
    try {
      await fetch(`/api/watchlist?symbol=${symbol}`, { method: 'DELETE' });
      setWatchlist(prev => prev.filter(item => item.symbol !== symbol));
      toast({ title: 'Kaldırıldı' });
    } catch {
      toast({ title: 'Hata', variant: 'destructive' });
    }
  };

  const openStockDetail = (stock: Stock) => {
    setSelectedStock(stock);
    router.push(`/stocks/${stock.code}`);
  };

  const fetchHistoricalData = async (time: string) => {
    if (!selectedStock) return;
    setDetailLoading(true);
    try {
      const response = await fetch(`/api/stocks/${selectedStock.code}?time=${time}`);
      const data = await response.json();
      if (data.success) setHistoricalData(data.data.historical);
    } catch {} finally {
      setDetailLoading(false);
    }
  };

  // Compute enabled tools from selected categories
  const getEnabledTools = () => {
    const allEnabled = enabledCategories.size === TOOL_CATEGORIES.length;
    if (allEnabled) return undefined; // no filter = all tools
    return TOOL_CATEGORIES
      .filter(c => enabledCategories.has(c.id))
      .flatMap(c => c.tools);
  };

  const promptAuthForChatbot = (description?: string) => {
    setAuthMode('register');
    setAuthOpen(true);
    setPasswordInput('');
    toast({
      title: 'Giris gerekli',
      description: description ?? 'Chatbotu kullanmak için önce kayıt olup giriş yapmalısınız.',
      variant: 'destructive',
    });
  };

  // Educational assistant chat
  const sendToAgent = async () => {
    if (!currentUser) {
      promptAuthForChatbot();
      return;
    }
    if (!chatInput.trim() || chatLoading) return;

    const userMessage = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage, timestamp: new Date() }]);
    setChatLoading(true);

    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          conversationHistory: chatMessages.slice(-10).map(m => ({ role: m.role, content: m.content })),
          enabledTools: getEnabledTools(),
        }),
      });
      
      const data = await response.json();
      if (!response.ok && data?.requiresAuth) {
        promptAuthForChatbot(data.error);
        return;
      }
      
      if (data.success) {
        const threadMessages: string[] = data.messages && data.messages.length > 0
          ? data.messages
          : [data.response];

        // First message carries toolsUsed badges + pendingActions
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: threadMessages[0],
          toolsUsed: data.toolsUsed,
          pendingActions: data.pendingActions,
          timestamp: new Date(),
        }]);
        setLastToolsUsed(data.toolsUsed || []);

        const suggestedQs: string[] = data.suggestedQuestions || [];
        const lastIdx = threadMessages.length - 1;

        // Remaining thread messages arrive with 600ms stagger
        // Last message gets suggestedQuestions chips
        threadMessages.slice(1).forEach((msg: string, idx: number) => {
          const isLast = idx === lastIdx - 1;
          setTimeout(() => {
            setChatMessages(prev => [...prev, {
              role: 'assistant',
              content: msg,
              suggestedQuestions: isLast && suggestedQs.length > 0 ? suggestedQs : undefined,
              timestamp: new Date(),
            }]);
          }, (idx + 1) * 600);
        });

        // If only one thread message, attach suggestedQuestions to it
        if (threadMessages.length === 1 && suggestedQs.length > 0) {
          setTimeout(() => {
            setChatMessages(prev => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last?.role === 'assistant') {
                updated[updated.length - 1] = { ...last, suggestedQuestions: suggestedQs };
              }
              return updated;
            });
          }, 100);
        }

        if (data.toolsUsed?.some((t: string) => t.includes('watchlist') || t.includes('alert'))) {
          fetchWatchlist();
          fetchAlerts();
        }
      } else {
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: data.error || 'Bir hata oluştu. Lütfen tekrar deneyin.',
          timestamp: new Date(),
        }]);
      }
    } catch {
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Bağlantı hatası. Lütfen tekrar deneyin.',
        timestamp: new Date(),
      }]);
    } finally {
      setChatLoading(false);
    }
  };

  // Confirm pending actions
  const confirmPendingActions = async (actions: PendingAction[], msgIdx: number) => {
    if (!currentUser) {
      promptAuthForChatbot();
      return;
    }
    // Disable pending on the message
    setChatMessages(prev => prev.map((m, i) =>
      i === msgIdx ? { ...m, pendingActions: undefined } : m
    ));
    setChatMessages(prev => [...prev, {
      role: 'user',
      content: '✅ Onayla',
      timestamp: new Date(),
    }]);
    setChatLoading(true);

    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmActions: actions }),
      });
      const data = await response.json();
      if (!response.ok && data?.requiresAuth) {
        promptAuthForChatbot(data.error);
        return;
      }

      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: data.success ? data.response : (data.error || 'İşlem sırasında hata oluştu.'),
        toolsUsed: data.toolsUsed,
        timestamp: new Date(),
      }]);

      if (data.toolsUsed?.some((t: string) => t.includes('watchlist') || t.includes('alert'))) {
        fetchWatchlist();
        fetchAlerts();
      }
    } catch {
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Bağlantı hatası. Lütfen tekrar deneyin.',
        timestamp: new Date(),
      }]);
    } finally {
      setChatLoading(false);
    }
  };

  // Cancel pending actions
  const cancelPendingActions = (msgIdx: number) => {
    setChatMessages(prev => prev.map((m, i) =>
      i === msgIdx ? { ...m, pendingActions: undefined } : m
    ));
    setChatMessages(prev => [...prev, {
      role: 'user',
      content: '❌ İptal',
      timestamp: new Date(),
    }, {
      role: 'assistant',
      content: 'İşlem iptal edildi.',
      timestamp: new Date(),
    }]);
  };

  // TXT File Upload Handler
  const handleTxtUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!currentUser) {
      promptAuthForChatbot();
      if (txtInputRef.current) txtInputRef.current.value = '';
      return;
    }

    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.name.endsWith('.txt')) {
      toast({ title: 'Hata', description: 'Sadece TXT dosyası yüklenebilir', variant: 'destructive' });
      return;
    }
    
    setChatMessages(prev => [...prev, { 
      role: 'user', 
      content: `Dosya yükledi: ${file.name}`, 
      timestamp: new Date() 
    }]);
    setChatLoading(true);
    
    try {
      const content = await file.text();
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          txtContent: content, 
          txtFilename: file.name 
        }),
      });
      
      const data = await response.json();
      if (!response.ok && data?.requiresAuth) {
        promptAuthForChatbot(data.error);
        return;
      }
      
      if (data.success) {
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: data.response,
          toolsUsed: data.toolsUsed,
          timestamp: new Date(),
        }]);
        setLastToolsUsed(data.toolsUsed || []);
      } else {
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: `Hata: ${data.error}`,
          timestamp: new Date(),
        }]);
      }
    } catch {
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Dosya okuma hatası. Lütfen tekrar deneyin.',
        timestamp: new Date(),
      }]);
    } finally {
      setChatLoading(false);
      if (txtInputRef.current) txtInputRef.current.value = '';
    }
  };

  // Image Upload Handler
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, symbol?: string) => {
    if (!currentUser) {
      promptAuthForChatbot();
      if (imageInputRef.current) imageInputRef.current.value = '';
      return;
    }

    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Hata', description: 'Sadece resim dosyası yüklenebilir', variant: 'destructive' });
      return;
    }
    
    setChatMessages(prev => [...prev, { 
      role: 'user', 
      content: `Grafik yükledi: ${file.name}${symbol ? ` (${symbol})` : ''}`, 
      timestamp: new Date() 
    }]);
    setChatLoading(true);
    
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        
        const response = await fetch('/api/agent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            imageBase64: base64, 
            imageSymbol: symbol 
          }),
        });
        
        const data = await response.json();
        if (!response.ok && data?.requiresAuth) {
          promptAuthForChatbot(data.error);
          setChatLoading(false);
          if (imageInputRef.current) imageInputRef.current.value = '';
          return;
        }
        
        if (data.success) {
          setChatMessages(prev => [...prev, {
            role: 'assistant',
            content: data.response,
            toolsUsed: data.toolsUsed,
            timestamp: new Date(),
          }]);
          setLastToolsUsed(data.toolsUsed || []);
        } else {
          setChatMessages(prev => [...prev, {
            role: 'assistant',
            content: `Hata: ${data.error}`,
            timestamp: new Date(),
          }]);
        }
        setChatLoading(false);
      };
      reader.readAsDataURL(file);
    } catch {
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Resim okuma hatası. Lütfen tekrar deneyin.',
        timestamp: new Date(),
      }]);
      setChatLoading(false);
    }
    
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  // Analyze current chart
  const analyzeCurrentChart = async () => {
    if (!currentUser) {
      promptAuthForChatbot();
      return;
    }
    if (!selectedStock || !historicalData.length) return;
    
    setChartAnalyzing(true);
    
    try {
      const chartContainer = document.querySelector('.recharts-wrapper');
      if (!chartContainer) {
        toast({ title: 'Hata', description: 'Grafik bulunamadı', variant: 'destructive' });
        return;
      }
      
      const svgElement = chartContainer.querySelector('svg');
      if (!svgElement) {
        toast({ title: 'Hata', description: 'Grafik SVG bulunamadı', variant: 'destructive' });
        return;
      }
      
      const svgData = new XMLSerializer().serializeToString(svgElement);
      const svgBase64 = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgData)))}`;
      
      setAgentOpen(true);
      setChatMessages(prev => [...prev, { 
        role: 'user', 
        content: `${selectedStock.code} grafiğini analiz et`, 
        timestamp: new Date() 
      }]);
      setChatLoading(true);
      
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          imageBase64: svgBase64, 
          imageSymbol: selectedStock.code 
        }),
      });
      
      const data = await response.json();
      if (!response.ok && data?.requiresAuth) {
        promptAuthForChatbot(data.error);
        return;
      }
      
      if (data.success) {
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: data.response,
          toolsUsed: data.toolsUsed,
          timestamp: new Date(),
        }]);
        setLastToolsUsed(data.toolsUsed || []);
      } else {
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: `Hata: ${data.error}`,
          timestamp: new Date(),
        }]);
      }
    } catch (error) {
      toast({ title: 'Hata', description: 'Grafik analizi başarısız', variant: 'destructive' });
    } finally {
      setChatLoading(false);
      setChartAnalyzing(false);
    }
  };

  // Auth Handler
  const handleAuth = async () => {
    if (!emailInput.trim() || !passwordInput) return;

    setAuthLoading(true);
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailInput.trim(),
          password: passwordInput,
          action: authMode,
        }),
      });

      const data = await response.json();
      if (typeof data.retryAfterSeconds === 'number' && data.retryAfterSeconds > 0) {
        setResendCooldown(prev => Math.max(prev, data.retryAfterSeconds));
      }

      if (data.success) {
        if (data.requiresConfirmation) {
          setNeedsVerification(true);
          setAuthMode('login');
          toast({ title: 'E-posta doğrulaması gerekli', description: data.message });
          setPasswordInput('');
          return;
        }
        setNeedsVerification(false);
        setCurrentUser(data.user);
        setAuthOpen(false);
        setEmailInput('');
        setPasswordInput('');
        fetchWatchlist();
        fetchAlerts();
        toast({
          title: 'Başarılı',
          description: data.message
        });
      } else {
        toast({
          title: 'Hata',
          description: data.error,
          variant: 'destructive'
        });
        if (data.requiresConfirmation) {
          setNeedsVerification(true);
          setAuthMode('login');
          setPasswordInput('');
        }
      }
    } catch {
      toast({
        title: 'Hata',
        description: 'Bağlantı hatası',
        variant: 'destructive'
      });
    } finally {
      setAuthLoading(false);
    }
  };

  const handleResendVerification = async () => {
    const email = emailInput.trim();
    if (!email) {
      toast({
        title: 'E-posta gerekli',
        description: 'Kod göndermek için e-posta adresi girin',
        variant: 'destructive',
      });
      return;
    }

    setResendLoading(true);
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          action: 'resend_verification',
        }),
      });
      const data = await response.json();
      if (typeof data.retryAfterSeconds === 'number' && data.retryAfterSeconds > 0) {
        setResendCooldown(prev => Math.max(prev, data.retryAfterSeconds));
      } else {
        setResendCooldown(prev => Math.max(prev, 45));
      }

      if (data.success) {
        setNeedsVerification(true);
        toast({ title: 'Kod gönderildi', description: data.message ?? 'Doğrulama kodu tekrar gönderildi' });
      } else {
        toast({
          title: 'Hata',
          description: data.error ?? 'Doğrulama kodu gönderilemedi',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Hata',
        description: 'Bağlantı hatası',
        variant: 'destructive',
      });
    } finally {
      setResendLoading(false);
    }
  };

  const formatNumber = (num: number, decimals = 2) => {
    return num.toLocaleString('tr-TR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };

  // Derived chart data: price area + SMA20/SMA50 overlays
  const chartData = useMemo(() => {
    return historicalData.map((d, i, arr) => {
      const sma20 = i >= 19
        ? +(arr.slice(i - 19, i + 1).reduce((s, x) => s + x.close, 0) / 20).toFixed(2)
        : null;
      const sma50 = i >= 49
        ? +(arr.slice(i - 49, i + 1).reduce((s, x) => s + x.close, 0) / 50).toFixed(2)
        : null;
      return { ...d, sma20, sma50 };
    });
  }, [historicalData]);

  // Client-side technical indicators from historicalData
  const techData = useMemo(() => {
    if (historicalData.length < 15) return null;
    const closes = historicalData.map(d => d.close);
    const highs  = historicalData.map(d => d.high);
    const lows   = historicalData.map(d => d.low);
    const lastClose = closes[closes.length - 1];

    // RSI (14)
    const changes = closes.slice(1).map((c, i) => c - closes[i]);
    const recent14 = changes.slice(-14);
    const avgGain = recent14.filter(c => c > 0).reduce((a, b) => a + b, 0) / 14;
    const avgLoss = recent14.filter(c => c < 0).map(c => Math.abs(c)).reduce((a, b) => a + b, 0) / 14;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsi = +(100 - 100 / (1 + rs)).toFixed(1);

    // SMA 20 / 50
    const sma20 = closes.length >= 20 ? +(closes.slice(-20).reduce((a, b) => a + b, 0) / 20).toFixed(2) : null;
    const sma50 = closes.length >= 50 ? +(closes.slice(-50).reduce((a, b) => a + b, 0) / 50).toFixed(2) : null;

    // Bollinger Bands (20, 2σ)
    let bb: { upper: number; middle: number; lower: number } | null = null;
    if (closes.length >= 20) {
      const mean = closes.slice(-20).reduce((a, b) => a + b, 0) / 20;
      const std = Math.sqrt(closes.slice(-20).reduce((s, c) => s + (c - mean) ** 2, 0) / 20);
      bb = { upper: +(mean + 2 * std).toFixed(2), middle: +mean.toFixed(2), lower: +(mean - 2 * std).toFixed(2) };
    }

    // MACD (12, 26, 9)
    let macd: { value: number; signal: number; histogram: number; trend: string } | null = null;
    if (closes.length >= 35) {
      const ema = (arr: number[], p: number) => {
        const k = 2 / (p + 1);
        return arr.reduce((acc, v, i) => { acc.push(i === 0 ? v : v * k + acc[i - 1] * (1 - k)); return acc; }, [] as number[]);
      };
      const e12 = ema(closes, 12), e26 = ema(closes, 26);
      const macdLine = e12.map((v, i) => v - e26[i]);
      const sigLine = ema(macdLine.slice(25), 9);
      const lm = macdLine[macdLine.length - 1], ls = sigLine[sigLine.length - 1];
      macd = { value: +lm.toFixed(3), signal: +ls.toFixed(3), histogram: +(lm - ls).toFixed(3), trend: lm > ls ? 'YUKARI' : 'AŞAĞI' };
    }

    // Stochastic %K (14)
    const stochK = (() => {
      const hh = Math.max(...highs.slice(-14)), ll = Math.min(...lows.slice(-14));
      return hh === ll ? 50 : +((lastClose - ll) / (hh - ll) * 100).toFixed(1);
    })();

    // ATR (14)
    const atr = (() => {
      if (closes.length < 15) return null;
      const trs = closes.slice(1).map((c, i) =>
        Math.max(highs[i + 1] - lows[i + 1], Math.abs(highs[i + 1] - closes[i]), Math.abs(lows[i + 1] - closes[i]))
      );
      const val = trs.slice(-14).reduce((a, b) => a + b, 0) / 14;
      return { value: +val.toFixed(2), percent: +(val / lastClose * 100).toFixed(2) };
    })();

    // Fibonacci (90-day lookback)
    const fib = (() => {
      const look = closes.slice(-90);
      const h = Math.max(...look), l = Math.min(...look), d = h - l;
      return { high: +h.toFixed(2), low: +l.toFixed(2), r236: +(h - d * 0.236).toFixed(2), r382: +(h - d * 0.382).toFixed(2), r500: +(h - d * 0.5).toFixed(2), r618: +(h - d * 0.618).toFixed(2) };
    })();

    // Composite educational status (no buy/sell phrasing)
    let signal = 'NÖTR';
    if (rsi < 30 && bb && lastClose <= bb.lower) signal = 'GÜÇLÜ POZİTİF MOMENTUM';
    else if (rsi < 40) signal = 'POZİTİF MOMENTUM';
    else if (rsi > 70 && bb && lastClose >= bb.upper) signal = 'GÜÇLÜ NEGATİF MOMENTUM';
    else if (rsi > 60) signal = 'NEGATİF MOMENTUM';

    return { rsi, sma20, sma50, bb, macd, stochK, atr, fib, signal, lastClose };
  }, [historicalData]);

  // Fetch AI analysis from /api/analyze
  const fetchAIAnalysis = useCallback(async (symbol: string) => {
    setAnalysisLoading(true);
    try {
      const resp = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol }),
      });
      const data = await resp.json();
      if (data.success) setDetailAnalysis(data.data.analysis);
    } catch { /* ignore */ } finally {
      setAnalysisLoading(false);
    }
  }, []);

  const getCurrentPrice = (symbol: string): Stock | undefined => stocks.find(s => s.code === symbol);

  const formatGlobalPrice = (item: GlobalMarketItem) => {
    if (item.market === 'forex') return formatNumber(item.price, 4);
    if (item.market === 'digital') return formatNumber(item.price >= 1000 ? 2 : 4);
    return formatNumber(item.price, 2);
  };

  // Stock Card Component
  const StockCard = ({ stock, showWatchlistButton = true }: { stock: Stock; showWatchlistButton?: boolean }) => {
    const inWatchlist = isInWatchlist(stock.code);
    
    return (
      <div 
        className="flex items-center justify-between p-3 hover:bg-slate-800/50 cursor-pointer transition-colors border-b border-slate-800 last:border-0"
        onClick={() => openStockDetail(stock)}
      >
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm ${
            stock.changePercent > 0 ? 'bg-emerald-600/20 text-emerald-400' :
            stock.changePercent < 0 ? 'bg-red-600/20 text-red-400' :
            'bg-slate-700 text-slate-400'
          }`}>
            {stock.code.slice(0, 2)}
          </div>
          <div>
            <p className="font-medium text-white">{stock.code}</p>
            <p className="text-xs text-slate-500 truncate max-w-[120px]">{stock.name}</p>
            {stock.sector && <p className="text-xs text-slate-600">{stock.sector}</p>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="font-medium text-white">{formatNumber(stock.price)} TL</p>
            <p className={`text-sm flex items-center gap-1 ${
              stock.changePercent > 0 ? 'text-emerald-400' :
              stock.changePercent < 0 ? 'text-red-400' :
              'text-slate-400'
            }`}>
              {stock.changePercent > 0 ? <ArrowUpRight className="h-3 w-3" /> :
               stock.changePercent < 0 ? <ArrowDownRight className="h-3 w-3" /> : null}
              {stock.changePercent >= 0 ? '+' : ''}{formatNumber(stock.changePercent)}%
            </p>
          </div>
          {showWatchlistButton && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (inWatchlist) {
                  removeFromWatchlist(stock.code);
                } else {
                  addToWatchlist(stock);
                }
              }}
              className={`p-2 rounded-lg transition-colors ${
                inWatchlist 
                  ? 'text-yellow-400 hover:bg-yellow-400/10' 
                  : 'text-slate-500 hover:bg-slate-700 hover:text-yellow-400'
              }`}
            >
              {inWatchlist ? <Star className="h-4 w-4 fill-current" /> : <Star className="h-4 w-4" />}
            </button>
          )}
        </div>
      </div>
    );
  };

  // Section Card Component
  const SectionCard = ({ title, icon: Icon, color, children, onSeeAll }: { 
    title: string; 
    icon: React.ElementType; 
    color: string;
    children: React.ReactNode;
    onSeeAll?: () => void;
  }) => (
    <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <h3 className="font-semibold text-white flex items-center gap-2">
          <Icon className={`h-5 w-5 ${color}`} />
          {title}
        </h3>
        {onSeeAll && (
          <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white" onClick={onSeeAll}>
            Tumu
          </Button>
        )}
      </div>
      {children}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="bg-slate-900/80 backdrop-blur-sm border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4">
          {/* Full Width Search Row */}
          <div className="flex items-center gap-3 py-3">
            {/* Full Width Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <Input
                  placeholder="Hisse ara... (kod veya ad yazın, örn: GARAN, THYAO)"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (e.target.value.trim()) {
                      setActiveTab('stocks');
                    }
                  }}
                  className="pl-12 h-14 text-base bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-emerald-500 focus-visible:border-emerald-500"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-slate-700 text-slate-400 hover:text-white"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>
            </div>

            {/* Compact Actions */}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => fetchStocks(true)}
                disabled={refreshing}
                className="h-14 w-14 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
              </Button>
              <Button
                onClick={() => setAgentOpen(true)}
                className="h-14 px-4 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:opacity-90"
              >
                <Bot className="h-5 w-5" />
              </Button>
              
              {/* User */}
              {currentUser ? (
                <button
                  onClick={async () => {
                    await fetch('/api/auth', { method: 'DELETE' });
                    setCurrentUser(null);
                    fetchWatchlist();
                    fetchAlerts();
                    toast({ title: 'Cikis yapildi' });
                  }}
                  className="h-14 w-14 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-white font-bold text-lg hover:opacity-80 transition-opacity"
                  title={`@${currentUser.rumuz} - Cikis yap`}
                >
                  {currentUser.rumuz.charAt(0).toUpperCase()}
                </button>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => setAuthOpen(true)}
                  className="h-14 w-14 border-slate-700 text-slate-300 hover:bg-slate-800"
                >
                  <LogIn className="h-5 w-5" />
                </Button>
              )}
            </div>
          </div>

          {/* Tabs Row */}
          <div className="flex items-center gap-1 pb-3 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-all ${
                  activeTab === tab.id
                    ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                <span className="text-sm font-medium">{tab.label}</span>
                {tab.id === 'watchlist' && watchlist.length > 0 && (
                  <Badge variant="secondary" className="bg-slate-700 text-slate-300 text-xs ml-1">
                    {watchlist.length}
                  </Badge>
                )}
                {tab.id === 'alerts' && alerts.length > 0 && (
                  <Badge variant="secondary" className="bg-slate-700 text-slate-300 text-xs ml-1">
                    {alerts.length}
                  </Badge>
                )}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center h-[60vh]">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
            <span className="ml-2 text-slate-400">Yukleniyor...</span>
          </div>
        ) : (
          <>
            <div className="mb-4 rounded-xl border border-amber-600/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-100">
              {LEGAL_DISCLAIMER_TEXT}
            </div>
            {/* Dashboard Tab */}
            {activeTab === 'dashboard' && (
              <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-slate-900 rounded-xl p-4 border border-slate-800">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center">
                        <Database className="h-5 w-5 text-slate-400" />
                      </div>
                      <div>
                        <p className="text-sm text-slate-400">Toplam Hisse</p>
                        <p className="text-2xl font-bold text-white">{stocks.length}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-slate-900 rounded-xl p-4 border border-emerald-800/30">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-emerald-600/20 flex items-center justify-center">
                        <TrendingUp className="h-5 w-5 text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-sm text-slate-400">Yukselenler</p>
                        <p className="text-2xl font-bold text-emerald-400">{stocks.filter(s => s.changePercent > 0).length}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-slate-900 rounded-xl p-4 border border-red-800/30">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-red-600/20 flex items-center justify-center">
                        <TrendingDown className="h-5 w-5 text-red-400" />
                      </div>
                      <div>
                        <p className="text-sm text-slate-400">Dusenler</p>
                        <p className="text-2xl font-bold text-red-400">{stocks.filter(s => s.changePercent < 0).length}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-slate-900 rounded-xl p-4 border border-slate-800">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-cyan-600/20 flex items-center justify-center">
                        <Star className="h-5 w-5 text-cyan-400" />
                      </div>
                      <div>
                        <p className="text-sm text-slate-400">Takibim</p>
                        <p className="text-2xl font-bold text-white">{watchlist.length}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Main Grid */}
                <div className="grid lg:grid-cols-2 gap-6">
                  {/* Top Gainers - 5 items */}
                  <SectionCard 
                    title="En Cok Kazandiranlar" 
                    icon={TrendingUp} 
                    color="text-emerald-400"
                    onSeeAll={() => { setMarketTab('gainers'); setActiveTab('market'); }}
                  >
                    {[...stocks].sort((a, b) => b.changePercent - a.changePercent).slice(0, 5).map((stock) => (
                      <StockCard key={stock.code} stock={stock} />
                    ))}
                  </SectionCard>

                  {/* Top Losers - 5 items */}
                  <SectionCard 
                    title="En Cok Kaybettirenler" 
                    icon={TrendingDown} 
                    color="text-red-400"
                    onSeeAll={() => { setMarketTab('losers'); setActiveTab('market'); }}
                  >
                    {[...stocks].sort((a, b) => a.changePercent - b.changePercent).slice(0, 5).map((stock) => (
                      <StockCard key={stock.code} stock={stock} />
                    ))}
                  </SectionCard>

                  {/* Popular Stocks - 5 items */}
                  <SectionCard 
                    title="Populer Hisseler" 
                    icon={Users} 
                    color="text-yellow-400"
                  >
                    {popularStocks.length > 0 ? popularStocks.slice(0, 5).map((item) => {
                      const stock = stocks.find(s => s.code === item.symbol);
                      if (!stock) return null;
                      return (
                        <div 
                          key={item.symbol} 
                          className="flex items-center justify-between p-3 hover:bg-slate-800/50 cursor-pointer transition-colors border-b border-slate-800 last:border-0"
                          onClick={() => openStockDetail(stock)}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-yellow-600/20 flex items-center justify-center text-yellow-400 font-bold text-sm">
                              {item.symbol.slice(0, 2)}
                            </div>
                            <div>
                              <p className="font-medium text-white">{item.symbol}</p>
                              <p className="text-xs text-slate-500">{item.count} kisi takip ediyor</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className="font-medium text-white">{formatNumber(stock.price)} TL</p>
                              <p className={`text-sm ${stock.changePercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {stock.changePercent >= 0 ? '+' : ''}{formatNumber(stock.changePercent)}%
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    }) : (
                      <div className="p-6 text-center text-slate-500">
                        <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>Henüz populer hisse yok</p>
                      </div>
                    )}
                  </SectionCard>

                  {/* Similar Stocks - 5 items */}
                  <SectionCard 
                    title="Takip Listesiyle Iliskili Hisseler" 
                    icon={Sparkles} 
                    color="text-violet-400"
                  >
                    {similarStocks.length > 0 ? similarStocks.slice(0, 5).map((stock) => (
                      <StockCard key={stock.code} stock={stock} />
                    )) : (
                      <div className="p-6 text-center text-slate-500">
                        <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>Takip listenizdeki sektorlerle iliskili hisseler burada listelenir</p>
                        <p className="text-xs mt-1">Listeyi doldurdukca egitim amacli karsilastirma verisi artar</p>
                      </div>
                    )}
                  </SectionCard>
                </div>

                <SectionCard
                  title="Kuresel Piyasalar (Twelve Data)"
                  icon={Globe}
                  color="text-cyan-400"
                >
                  {globalMarketData ? (
                    <div className="p-4 space-y-4">
                      <div className="grid md:grid-cols-3 gap-4">
                        {[
                          { key: 'digitalCurrencies', title: 'Digital Currency', items: globalMarketData.digitalCurrencies },
                          { key: 'forex', title: 'Forex', items: globalMarketData.forex },
                          { key: 'nasdaq', title: 'NASDAQ', items: globalMarketData.nasdaq },
                        ].map(section => (
                          <div key={section.key} className="rounded-lg border border-slate-800 bg-slate-800/30">
                            <div className="px-3 py-2 border-b border-slate-800">
                              <p className="text-sm font-semibold text-white">{section.title}</p>
                            </div>
                            <div className="p-2 space-y-1">
                              {section.items.slice(0, 4).map(item => (
                                <div key={item.symbol} className="flex items-center justify-between rounded-md px-2 py-2 hover:bg-slate-800/60">
                                  <div>
                                    <p className="text-sm font-medium text-white">{item.symbol}</p>
                                    <p className="text-[11px] text-slate-500 truncate max-w-[140px]">{item.name}</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-sm text-white">
                                      {formatGlobalPrice(item)}
                                      {item.market === 'forex' ? '' : ' USD'}
                                    </p>
                                    <p className={`text-xs ${item.changePercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                      {item.changePercent >= 0 ? '+' : ''}{formatNumber(item.changePercent, 2)}%
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Kaynak: {globalMarketData.source === 'twelvedata' ? 'Twelve Data' : 'Fallback'}
                      </p>
                    </div>
                  ) : (
                    <div className="p-6 text-center text-slate-500">
                      <Globe className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>Kuresel piyasa verileri su an alinamiyor</p>
                    </div>
                  )}
                </SectionCard>

                {/* Categories */}
                <SectionCard 
                  title="Kategoriler" 
                  icon={Building2} 
                  color="text-cyan-400"
                >
                  <div className="p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    {sectors.slice(0, 6).map((sector) => (
                      <button
                        key={sector.name}
                        onClick={() => {
                          setSearchQuery(sector.name);
                          setActiveTab('stocks');
                        }}
                        className="flex flex-col items-center gap-2 p-4 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors"
                      >
                        <Building2 className="h-6 w-6 text-cyan-400" />
                        <div className="text-center">
                          <p className="text-sm font-medium text-white">{sector.name}</p>
                          <p className="text-xs text-slate-500">{sector.count} hisse</p>
                          <p className={`text-xs ${sector.avgChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {sector.avgChange >= 0 ? '+' : ''}{formatNumber(sector.avgChange, 1)}%
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </SectionCard>
              </div>
            )}

            {/* Stocks Tab */}
            {activeTab === 'stocks' && (
              <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                  <h3 className="font-semibold text-white">Tum Hisseler</h3>
                  <Badge variant="secondary" className="bg-slate-800 text-slate-300">
                    {filteredStocks.length} hisse
                  </Badge>
                </div>
                <div className="max-h-[70vh] overflow-y-auto">
                  {filteredStocks.map((stock) => (
                    <StockCard key={stock.code} stock={stock} />
                  ))}
                </div>
              </div>
            )}

            {/* Watchlist Tab */}
            {activeTab === 'watchlist' && (
              <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                  <h3 className="font-semibold text-white flex items-center gap-2">
                    <Star className="h-5 w-5 text-yellow-400" />
                    Takip Listem
                  </h3>
                  <Badge variant="secondary" className="bg-slate-800 text-slate-300">
                    {watchlist.length} hisse
                  </Badge>
                </div>
                {watchlist.length > 0 ? (
                  <div className="max-h-[70vh] overflow-y-auto">
                    {watchlist.map((item) => {
                      const stock = getCurrentPrice(item.symbol);
                      if (!stock) return null;
                      return <StockCard key={item.id} stock={stock} />;
                    })}
                  </div>
                ) : (
                  <div className="p-12 text-center">
                    <Star className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                    <p className="text-slate-400 text-lg">Takip listeniz bos</p>
                    <p className="text-slate-500 text-sm mt-2">Hisseleri takibe almak icin yildiz ikonuna tiklayin</p>
                    <Button 
                      variant="outline" 
                      className="mt-4 border-slate-700 text-slate-300"
                      onClick={() => setActiveTab('stocks')}
                    >
                      Hisselere Goz At
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Market Tab */}
            {activeTab === 'market' && (
              <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                {/* Alt sekme başlıkları */}
                <div className="flex border-b border-slate-800">
                  {([
                    { id: 'gainers', label: 'Kazananlar', icon: TrendingUp,   color: 'text-emerald-400', active: 'border-emerald-500 text-emerald-400' },
                    { id: 'losers',  label: 'Düşenler',   icon: TrendingDown, color: 'text-red-400',     active: 'border-red-500 text-red-400' },
                    { id: 'active',  label: 'En Aktif',   icon: BarChart3,    color: 'text-sky-400',     active: 'border-sky-500 text-sky-400' },
                  ] as const).map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setMarketTab(tab.id)}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium border-b-2 transition-colors ${
                        marketTab === tab.id
                          ? tab.active + ' bg-slate-800/50'
                          : 'border-transparent text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      <tab.icon className={`h-4 w-4 ${marketTab === tab.id ? tab.color : ''}`} />
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* İçerik */}
                <div className="max-h-[70vh] overflow-y-auto">
                  {marketTab === 'gainers' &&
                    [...stocks]
                      .filter(s => s.changePercent > 0)
                      .sort((a, b) => b.changePercent - a.changePercent)
                      .map(stock => <StockCard key={stock.code} stock={stock} />)
                  }
                  {marketTab === 'losers' &&
                    [...stocks]
                      .filter(s => s.changePercent < 0)
                      .sort((a, b) => a.changePercent - b.changePercent)
                      .map(stock => <StockCard key={stock.code} stock={stock} />)
                  }
                  {marketTab === 'active' &&
                    [...stocks]
                      .sort((a, b) => b.volume - a.volume)
                      .map(stock => <StockCard key={stock.code} stock={stock} />)
                  }
                </div>
              </div>
            )}

            {/* Alerts Tab */}
            {activeTab === 'alerts' && (
              <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                  <h3 className="font-semibold text-white flex items-center gap-2">
                    <Bell className="h-5 w-5 text-amber-400" />
                    Fiyat Bildirimleri
                  </h3>
                  <Button 
                    size="sm" 
                    className="bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => {
                      setAgentOpen(true);
                      setChatInput('Yeni bir fiyat bildirimi olustur: ');
                    }}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Yeni Bildirim
                  </Button>
                </div>
                {alerts.length > 0 ? (
                  <div className="max-h-[70vh] overflow-y-auto">
                    {alerts.map((alert) => {
                      const stock = getCurrentPrice(alert.symbol);
                      return (
                        <div 
                          key={alert.id} 
                          className="flex items-center justify-between p-4 border-b border-slate-800 hover:bg-slate-800/50"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                              alert.condition === 'above' ? 'bg-emerald-600/20' : 'bg-red-600/20'
                            }`}>
                              {alert.condition === 'above' ? (
                                <ArrowUpRight className="h-5 w-5 text-emerald-400" />
                              ) : (
                                <ArrowDownRight className="h-5 w-5 text-red-400" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-white">{alert.symbol}</p>
                              <p className="text-sm text-slate-400">
                                {alert.condition === 'above' ? 'Uzerine ciktiginda' : 'Altina dugtunde'} {formatNumber(alert.targetPrice)} TL
                              </p>
                              <p className="text-xs text-slate-500">
                                Simdiki: {stock ? formatNumber(stock.price) : '?'} TL
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={alert.active ? 'default' : 'secondary'} className={
                              alert.active ? 'bg-emerald-600/20 text-emerald-400' : 'bg-slate-700 text-slate-400'
                            }>
                              {alert.active ? 'Aktif' : 'Pasif'}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-slate-400 hover:text-red-400"
                              onClick={async () => {
                                try {
                                  await fetch(`/api/alerts?id=${alert.id}`, { method: 'DELETE' });
                                  setAlerts(prev => prev.filter(a => a.id !== alert.id));
                                  toast({ title: 'Bildirim silindi' });
                                } catch {
                                  toast({ title: 'Hata', variant: 'destructive' });
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-12 text-center">
                    <Bell className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                    <p className="text-slate-400 text-lg">Henuz bildirim yok</p>
                    <p className="text-slate-500 text-sm mt-2">Fiyat bildirimi olusturmak icin analiz asistanini kullanin</p>
                    <Button 
                      className="mt-4 bg-gradient-to-r from-emerald-600 to-cyan-600"
                      onClick={() => setAgentOpen(true)}
                    >
                      <Bot className="h-4 w-4 mr-2" />
                      Analiz Asistani ile Bildirim Olustur
                    </Button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* Stock Detail Modal */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] bg-slate-900 border-slate-800 text-white flex flex-col p-0 overflow-hidden gap-0">
          {selectedStock && (
            <>
              {/* ── Header ── */}
              <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-slate-800 shrink-0">
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-lg shrink-0 ${
                    selectedStock.changePercent > 0 ? 'bg-emerald-600/20 text-emerald-400 ring-1 ring-emerald-500/30' :
                    selectedStock.changePercent < 0 ? 'bg-red-600/20 text-red-400 ring-1 ring-red-500/30' :
                    'bg-slate-700 text-slate-400'
                  }`}>
                    {selectedStock.code.slice(0, 2)}
                  </div>
                  <div>
                    <DialogTitle className="text-2xl font-bold tracking-tight">{selectedStock.code}</DialogTitle>
                    <p className="text-slate-400 text-sm mt-0.5">{selectedStock.name}</p>
                    {selectedStock.sector && (
                      <Badge variant="outline" className="mt-1.5 text-[10px] border-slate-700 text-slate-500 h-5">
                        {selectedStock.sector}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <p className="text-3xl font-bold tabular-nums">{formatNumber(selectedStock.price)} <span className="text-lg text-slate-400">TL</span></p>
                  <p className={`text-sm flex items-center justify-end gap-1 mt-1 ${
                    selectedStock.changePercent > 0 ? 'text-emerald-400' :
                    selectedStock.changePercent < 0 ? 'text-red-400' : 'text-slate-400'
                  }`}>
                    {selectedStock.changePercent > 0 ? <ArrowUpRight className="h-4 w-4" /> :
                     selectedStock.changePercent < 0 ? <ArrowDownRight className="h-4 w-4" /> : null}
                    {selectedStock.change >= 0 ? '+' : ''}{formatNumber(selectedStock.change)} TL
                    &nbsp;({selectedStock.changePercent >= 0 ? '+' : ''}{formatNumber(selectedStock.changePercent)}%)
                  </p>
                  <div className="flex gap-2 mt-2 justify-end">
                    <Button
                      size="sm"
                      className={`h-7 text-xs ${isInWatchlist(selectedStock.code) ? 'bg-slate-700 hover:bg-slate-600' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                      onClick={() => { if (isInWatchlist(selectedStock.code)) removeFromWatchlist(selectedStock.code); else addToWatchlist(selectedStock); }}
                    >
                      {isInWatchlist(selectedStock.code) ? <StarOff className="h-3 w-3 mr-1" /> : <Star className="h-3 w-3 mr-1" />}
                      {isInWatchlist(selectedStock.code) ? 'Takipten Çıkar' : 'Takibe Al'}
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs border-slate-700 text-slate-300"
                      onClick={() => { setAgentOpen(true); setChatInput(`${selectedStock.code} derin matematik analizi`); setDetailOpen(false); }}>
                      <Bot className="h-3 w-3 mr-1" /> Analiz Sohbeti
                    </Button>
                  </div>
                </div>
              </div>

              {/* ── Tab Navigation ── */}
              <div className="flex border-b border-slate-800 shrink-0 bg-slate-900/80 px-2">
                {([
                  { id: 'grafik' as const, label: '📊 Grafik' },
                  { id: 'teknik' as const, label: '📈 Teknik Analiz' },
                  { id: 'ai'     as const, label: '🧭 Egitimsel Analiz' },
                  { id: 'ozet'   as const, label: '📋 Özet' },
                ]).map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setDetailTab(tab.id);
                      if (tab.id === 'ai' && !detailAnalysis && !analysisLoading) fetchAIAnalysis(selectedStock.code);
                    }}
                    className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                      detailTab === tab.id
                        ? 'border-emerald-500 text-emerald-400'
                        : 'border-transparent text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* ── Tab Content ── */}
              <div className="flex-1 overflow-y-auto">

                {/* ─── GRAFIK TAB ─── */}
                {detailTab === 'grafik' && (
                  <div className="p-5">
                    {/* Timeframe selector */}
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-xs text-slate-500 mr-1">Dönem:</span>
                      {([['1G','1M'],['1H','3M'],['1A','6M'],['3A','1Y'],['5Y','5Y']] as [string,string][]).map(([lbl, val]) => (
                        <Button key={val} size="sm" variant={chartTimeframe === val ? 'default' : 'outline'}
                          className={`h-7 text-xs px-3 ${chartTimeframe === val ? 'bg-emerald-600 hover:bg-emerald-700' : 'border-slate-700 text-slate-400 hover:text-white'}`}
                          onClick={() => { setChartTimeframe(val); fetchHistoricalData(val); }}>
                          {lbl}
                        </Button>
                      ))}
                    </div>

                    {detailLoading ? (
                      <div className="h-72 flex items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
                      </div>
                    ) : chartData.length > 0 ? (
                      <>
                        {/* ComposedChart: area price + volume bars + SMA lines */}
                        <ResponsiveContainer width="100%" height={300}>
                          <ComposedChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                            <defs>
                              <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%"  stopColor={selectedStock.changePercent >= 0 ? '#10b981' : '#ef4444'} stopOpacity={0.25}/>
                                <stop offset="95%" stopColor={selectedStock.changePercent >= 0 ? '#10b981' : '#ef4444'} stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false}/>
                            <XAxis dataKey="date" tick={{ fill:'#475569', fontSize:10 }} tickFormatter={v => v.slice(5)} axisLine={false} tickLine={false} interval="preserveStartEnd"/>
                            <YAxis yAxisId="vol" orientation="left" tick={{ fill:'#334155', fontSize:9 }} tickFormatter={v => v > 1e6 ? `${(v/1e6).toFixed(0)}M` : v > 1000 ? `${(v/1000).toFixed(0)}K` : String(v)} axisLine={false} tickLine={false} width={38}/>
                            <YAxis yAxisId="px"  orientation="right" tick={{ fill:'#475569', fontSize:10 }} domain={['auto','auto']} tickFormatter={v => formatNumber(v,0)} axisLine={false} tickLine={false} width={58}/>
                            <Tooltip
                              contentStyle={{ backgroundColor:'#0f172a', border:'1px solid #1e293b', borderRadius:'10px', fontSize:'12px' }}
                              labelFormatter={v => `📅 ${v}`}
                              formatter={(value: number, name: string) => {
                                if (name === 'volume') return [`${(value/1000).toFixed(0)}K lot`, 'Hacim'];
                                if (name === 'sma20')  return [formatNumber(value) + ' TL', 'SMA 20'];
                                if (name === 'sma50')  return [formatNumber(value) + ' TL', 'SMA 50'];
                                return [formatNumber(value) + ' TL', 'Kapanış'];
                              }}
                            />
                            <Bar yAxisId="vol" dataKey="volume" fill="#1e293b" opacity={0.7} maxBarSize={5} radius={[1,1,0,0]}/>
                            <Area yAxisId="px" type="monotone" dataKey="close" stroke={selectedStock.changePercent >= 0 ? '#10b981' : '#ef4444'} strokeWidth={2} fill="url(#priceGrad)" dot={false} activeDot={{ r:4 }}/>
                            {chartData.some(d => d.sma20 !== null) && (
                              <Line yAxisId="px" type="monotone" dataKey="sma20" stroke="#f59e0b" strokeWidth={1.5} dot={false} strokeDasharray="4 2"/>
                            )}
                            {chartData.some(d => d.sma50 !== null) && (
                              <Line yAxisId="px" type="monotone" dataKey="sma50" stroke="#3b82f6" strokeWidth={1.5} dot={false} strokeDasharray="6 3"/>
                            )}
                          </ComposedChart>
                        </ResponsiveContainer>

                        {/* Chart legend */}
                        <div className="flex items-center gap-5 mt-2 justify-end text-[11px] text-slate-500 pr-2">
                          <span className="flex items-center gap-1.5">
                            <span className="w-5 h-0.5 rounded" style={{ background: selectedStock.changePercent >= 0 ? '#10b981' : '#ef4444' }}/>
                            Kapanış
                          </span>
                          {chartData.some(d => d.sma20) && <span className="flex items-center gap-1.5"><span className="w-5 h-0.5 rounded" style={{ background:'#f59e0b' }}/>SMA 20</span>}
                          {chartData.some(d => d.sma50) && <span className="flex items-center gap-1.5"><span className="w-5 h-0.5 rounded" style={{ background:'#3b82f6' }}/>SMA 50</span>}
                          <span className="flex items-center gap-1.5"><span className="w-3 h-2.5 rounded-sm inline-block bg-slate-700"/>Hacim</span>
                        </div>
                      </>
                    ) : (
                      <div className="h-72 flex items-center justify-center text-slate-500">Grafik verisi bulunamadı</div>
                    )}

                    {/* OHLCV stats */}
                    <div className="grid grid-cols-5 gap-2 mt-5">
                      {[
                        { label:'Açılış',       value: formatNumber(selectedStock.open) + ' TL',       color:'text-white' },
                        { label:'Günün Yükseği',value: formatNumber(selectedStock.high) + ' TL',       color:'text-emerald-400' },
                        { label:'Günün Düşüğü', value: formatNumber(selectedStock.low) + ' TL',        color:'text-red-400' },
                        { label:'Önceki Kapanış',value: formatNumber(selectedStock.previousClose)+' TL',color:'text-slate-300' },
                        { label:'Hacim',         value: selectedStock.volume > 1e6 ? `${(selectedStock.volume/1e6).toFixed(1)}M` : `${(selectedStock.volume/1000).toFixed(0)}K`, color:'text-slate-300' },
                      ].map(s => (
                        <div key={s.label} className="bg-slate-800/40 rounded-xl p-3 text-center">
                          <p className="text-slate-500 text-[10px] mb-1">{s.label}</p>
                          <p className={`font-semibold text-sm ${s.color}`}>{s.value}</p>
                        </div>
                      ))}
                    </div>

                    {/* Chart analysis button */}
                    <div className="mt-4 flex gap-2">
                      <Button variant="outline" size="sm" className="border-slate-700 text-slate-400 text-xs"
                        onClick={analyzeCurrentChart} disabled={chartAnalyzing}>
                        <LineChartIcon className="h-3.5 w-3.5 mr-1.5"/>
                        {chartAnalyzing ? 'Analiz ediliyor...' : 'Grafik Egitimsel Analizi'}
                      </Button>
                    </div>
                  </div>
                )}

                {/* ─── TEKNİK ANALİZ TAB ─── */}
                {detailTab === 'teknik' && (
                  <div className="p-5">
                    {!techData ? (
                      <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-500">
                        <Activity className="h-10 w-10 opacity-40"/>
                        <p>Teknik analiz için yeterli veri yok</p>
                        <p className="text-xs text-slate-600">Minimum 15 günlük veri gerekli — daha uzun dönem seçin</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Signal banner */}
                        <div className={`rounded-2xl p-4 text-center ${
                          techData.signal === 'GÜÇLÜ POZİTİF MOMENTUM' ? 'bg-emerald-600/20 border border-emerald-500/40' :
                          techData.signal === 'POZİTİF MOMENTUM'       ? 'bg-emerald-700/15 border border-emerald-600/30' :
                          techData.signal === 'GÜÇLÜ NEGATİF MOMENTUM' ? 'bg-red-600/20 border border-red-500/40' :
                          techData.signal === 'NEGATİF MOMENTUM'       ? 'bg-red-700/15 border border-red-600/30' :
                                                             'bg-slate-700/30 border border-slate-600/30'
                        }`}>
                          <p className="text-xs text-slate-500 mb-1 uppercase tracking-wider">Bilesik Gosterge Durumu</p>
                          <p className={`text-2xl font-bold ${
                            techData.signal.includes('POZİTİF') ? 'text-emerald-400' :
                            techData.signal.includes('NEGATİF') ? 'text-red-400' : 'text-slate-300'
                          }`}>{techData.signal}</p>
                          <p className="text-xs text-slate-600 mt-1">RSI + Bollinger kombinasyonu</p>
                        </div>

                        {/* RSI + Stochastic */}
                        <div className="grid grid-cols-2 gap-3">
                          {/* RSI */}
                          <div className="bg-slate-800/40 rounded-2xl p-4">
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-xs font-medium text-slate-400">RSI (14)</p>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                                techData.rsi < 30 ? 'bg-emerald-500/20 text-emerald-400' :
                                techData.rsi > 70 ? 'bg-red-500/20 text-red-400' : 'bg-slate-700 text-slate-400'
                              }`}>
                                {techData.rsi < 30 ? 'Asiri Dusuk Bolge' : techData.rsi > 70 ? 'Asiri Yuksek Bolge' : 'Normal'}
                              </span>
                            </div>
                            <p className={`text-4xl font-bold mb-4 tabular-nums ${
                              techData.rsi < 30 ? 'text-emerald-400' : techData.rsi > 70 ? 'text-red-400' : 'text-white'
                            }`}>{techData.rsi}</p>
                            <div className="relative h-2 rounded-full overflow-hidden bg-slate-700">
                              <div className="absolute inset-0 flex">
                                <div className="w-[30%] bg-emerald-500/50 rounded-l-full"/>
                                <div className="w-[40%] bg-yellow-500/30"/>
                                <div className="w-[30%] bg-red-500/50 rounded-r-full"/>
                              </div>
                              <div className="absolute top-0 w-2 h-2 bg-white rounded-full shadow-md -translate-x-1/2" style={{ left:`${Math.min(Math.max(techData.rsi,0),100)}%` }}/>
                            </div>
                            <div className="flex justify-between text-[9px] text-slate-600 mt-1.5">
                              <span>0 Dusuk</span><span>50</span><span>Yuksek 100</span>
                            </div>
                          </div>

                          {/* Stochastic */}
                          <div className="bg-slate-800/40 rounded-2xl p-4">
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-xs font-medium text-slate-400">Stochastic %K (14)</p>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                                techData.stochK < 20 ? 'bg-emerald-500/20 text-emerald-400' :
                                techData.stochK > 80 ? 'bg-red-500/20 text-red-400' : 'bg-slate-700 text-slate-400'
                              }`}>
                                {techData.stochK < 20 ? 'Asiri Dusuk Bolge' : techData.stochK > 80 ? 'Asiri Yuksek Bolge' : 'Normal'}
                              </span>
                            </div>
                            <p className={`text-4xl font-bold mb-4 tabular-nums ${
                              techData.stochK < 20 ? 'text-emerald-400' : techData.stochK > 80 ? 'text-red-400' : 'text-white'
                            }`}>{techData.stochK}</p>
                            <div className="relative h-2 rounded-full overflow-hidden bg-slate-700">
                              <div className="absolute inset-0 flex">
                                <div className="w-[20%] bg-emerald-500/50 rounded-l-full"/>
                                <div className="w-[60%] bg-slate-600/40"/>
                                <div className="w-[20%] bg-red-500/50 rounded-r-full"/>
                              </div>
                              <div className="absolute top-0 w-2 h-2 bg-white rounded-full shadow-md -translate-x-1/2" style={{ left:`${Math.min(Math.max(techData.stochK,0),100)}%` }}/>
                            </div>
                            <div className="flex justify-between text-[9px] text-slate-600 mt-1.5">
                              <span>0</span><span>50</span><span>100</span>
                            </div>
                          </div>
                        </div>

                        {/* MACD */}
                        {techData.macd && (
                          <div className="bg-slate-800/40 rounded-2xl p-4">
                            <p className="text-xs font-medium text-slate-400 mb-3">MACD (12, 26, 9)</p>
                            <div className="grid grid-cols-3 gap-3 text-center">
                              {[
                                { label:'MACD Çizgisi', value: techData.macd.value, color: techData.macd.value >= 0 ? 'text-emerald-400' : 'text-red-400' },
                                { label:'Referans Çizgisi', value: techData.macd.signal, color: 'text-yellow-400' },
                                { label:'Histogram', value: techData.macd.histogram, color: techData.macd.histogram >= 0 ? 'text-emerald-400' : 'text-red-400' },
                              ].map(m => (
                                <div key={m.label} className="bg-slate-800/60 rounded-xl p-3">
                                  <p className="text-[10px] text-slate-500 mb-1">{m.label}</p>
                                  <p className={`text-xl font-bold tabular-nums ${m.color}`}>{m.value}</p>
                                </div>
                              ))}
                            </div>
                            <div className={`mt-3 text-center text-xs py-1.5 rounded-full font-medium ${
                              techData.macd.trend === 'YUKARI' ? 'bg-emerald-600/20 text-emerald-400' : 'bg-red-600/20 text-red-400'
                            }`}>
                              MACD Trendi: {techData.macd.trend === 'YUKARI' ? '▲ Yukarı (Yükseliş baskısı)' : '▼ Aşağı (Düşüş baskısı)'}
                            </div>
                          </div>
                        )}

                        {/* Bollinger Bands */}
                        {techData.bb && (
                          <div className="bg-slate-800/40 rounded-2xl p-4">
                            <p className="text-xs font-medium text-slate-400 mb-3">Bollinger Bantları (SMA20, ±2σ)</p>
                            {/* Position bar */}
                            <div className="flex items-center gap-2 mb-3">
                              <span className="text-[10px] text-emerald-400 w-14 text-right">{formatNumber(techData.bb.lower)}</span>
                              <div className="flex-1 relative h-4 bg-gradient-to-r from-emerald-900/40 via-slate-700/40 to-red-900/40 rounded-full overflow-hidden">
                                <div
                                  className="absolute top-0.5 bottom-0.5 w-2 bg-white rounded-full shadow"
                                  style={{ left:`calc(${Math.max(0,Math.min(100,((selectedStock.price - techData.bb.lower)/(techData.bb.upper - techData.bb.lower))*100))}% - 4px)` }}
                                />
                              </div>
                              <span className="text-[10px] text-red-400 w-14">{formatNumber(techData.bb.upper)}</span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-center">
                              <div><p className="text-[10px] text-slate-500">Alt Bant</p><p className="text-sm font-semibold text-emerald-400">{formatNumber(techData.bb.lower)}</p></div>
                              <div><p className="text-[10px] text-slate-500">Orta (SMA20)</p><p className="text-sm font-semibold text-yellow-400">{formatNumber(techData.bb.middle)}</p></div>
                              <div><p className="text-[10px] text-slate-500">Üst Bant</p><p className="text-sm font-semibold text-red-400">{formatNumber(techData.bb.upper)}</p></div>
                            </div>
                            <p className={`text-[10px] text-center mt-2 ${
                              selectedStock.price >= techData.bb.upper ? 'text-red-400' :
                              selectedStock.price <= techData.bb.lower ? 'text-emerald-400' : 'text-slate-500'
                            }`}>
                              Mevcut fiyat: {selectedStock.price >= techData.bb.upper ? '⚠ Üst bant üzerinde (aşırı alım)' :
                                             selectedStock.price <= techData.bb.lower ? '⚠ Alt bant altında (aşırı satım)' : '✓ Bant içinde'}
                            </p>
                          </div>
                        )}

                        {/* SMA + ATR */}
                        <div className="grid grid-cols-3 gap-3">
                          <div className="bg-slate-800/40 rounded-2xl p-4">
                            <p className="text-[10px] text-slate-500 mb-2">SMA 20</p>
                            <p className="text-2xl font-bold text-yellow-400 tabular-nums">{techData.sma20 ? formatNumber(techData.sma20) : '—'}</p>
                            {techData.sma20 && <p className={`text-xs mt-1 ${selectedStock.price > techData.sma20 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {selectedStock.price > techData.sma20 ? '▲ Üstünde' : '▼ Altında'}
                            </p>}
                          </div>
                          <div className="bg-slate-800/40 rounded-2xl p-4">
                            <p className="text-[10px] text-slate-500 mb-2">SMA 50</p>
                            <p className="text-2xl font-bold text-blue-400 tabular-nums">{techData.sma50 ? formatNumber(techData.sma50) : '—'}</p>
                            {techData.sma50 && <p className={`text-xs mt-1 ${selectedStock.price > techData.sma50 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {selectedStock.price > techData.sma50 ? '▲ Üstünde' : '▼ Altında'}
                            </p>}
                          </div>
                          <div className="bg-slate-800/40 rounded-2xl p-4">
                            <p className="text-[10px] text-slate-500 mb-2">ATR (14) Volatilite</p>
                            <p className="text-2xl font-bold text-purple-400 tabular-nums">{techData.atr ? formatNumber(techData.atr.value) : '—'}</p>
                            {techData.atr && <p className="text-xs text-slate-500 mt-1">%{techData.atr.percent} günlük</p>}
                          </div>
                        </div>

                        {/* Fibonacci Levels */}
                        <div className="bg-slate-800/40 rounded-2xl p-4">
                          <p className="text-xs font-medium text-slate-400 mb-3">Fibonacci Geri Çekilme Seviyeleri <span className="text-slate-600">(90 günlük yüksek/düşük)</span></p>
                          <div className="space-y-1.5">
                            {[
                              { label:'0% — Dönem Zirvesi',   value: techData.fib.high, color:'text-red-400' },
                              { label:'23.6%',                value: techData.fib.r236, color:'text-orange-400' },
                              { label:'38.2%',                value: techData.fib.r382, color:'text-yellow-400' },
                              { label:'50%',                  value: techData.fib.r500, color:'text-slate-300' },
                              { label:'61.8% — Altın Oran',  value: techData.fib.r618, color:'text-emerald-400' },
                              { label:'100% — Dönem Dibi',   value: techData.fib.low,  color:'text-blue-400' },
                            ].map(({ label, value, color }) => {
                              const isNear = Math.abs(selectedStock.price - value) / value < 0.015;
                              return (
                                <div key={label} className={`flex items-center justify-between text-xs px-3 py-1.5 rounded-lg ${isNear ? 'bg-emerald-500/10 border border-emerald-500/25' : 'hover:bg-slate-700/30'}`}>
                                  <span className="text-slate-500">{label}</span>
                                  <div className="flex items-center gap-2">
                                    <span className={`font-mono font-semibold ${color}`}>{formatNumber(value)} TL</span>
                                    {isNear && <span className="text-emerald-400 text-[10px] bg-emerald-500/20 px-1.5 py-0.5 rounded-full">Yakın</span>}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ─── EGITIMSEL ANALIZ TAB ─── */}
                {detailTab === 'ai' && (
                  <div className="p-5">
                    {analysisLoading ? (
                      <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <Loader2 className="h-10 w-10 animate-spin text-emerald-400"/>
                        <p className="text-slate-400 text-sm">Egitimsel analiz hazirlaniyor...</p>
                        <p className="text-slate-600 text-xs">Piyasa verileri ve haberler işleniyor</p>
                      </div>
                    ) : detailAnalysis ? (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <Sparkles className="h-3.5 w-3.5 text-emerald-400"/>
                          <span>Egitimsel amacli otomatik olusturuldu · Yatirim tavsiyesi degildir · Hukuki ve mali sorumluluk kullaniciya aittir</span>
                        </div>
                        <div className="bg-slate-800/30 rounded-2xl p-5 text-sm text-slate-300 leading-relaxed whitespace-pre-wrap border border-slate-700/40">
                          {detailAnalysis}
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" className="border-slate-700 text-slate-400 text-xs h-8"
                            onClick={() => { setDetailAnalysis(null); fetchAIAnalysis(selectedStock.code); }}>
                            <RefreshCw className="h-3 w-3 mr-1.5"/> Yenile
                          </Button>
                          <Button size="sm" variant="outline" className="border-slate-700 text-slate-400 text-xs h-8"
                            onClick={() => { setAgentOpen(true); setChatInput(`${selectedStock.code} hakkında sormak istiyorum`); setDetailOpen(false); }}>
                            <Bot className="h-3 w-3 mr-1.5"/> Analiz Sohbetinde Devam Et
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center">
                          <Bot className="h-8 w-8 text-slate-600"/>
                        </div>
                        <p className="text-slate-400 font-medium">Egitimsel analiz henuz baslatilmadi</p>
                        <p className="text-slate-600 text-xs text-center max-w-xs">
                          {selectedStock.code} için güncel fiyat, geçmiş veri ve piyasa haberleri analiz edilecek
                        </p>
                        <Button className="bg-emerald-600 hover:bg-emerald-700 mt-2" onClick={() => fetchAIAnalysis(selectedStock.code)}>
                          <Sparkles className="h-4 w-4 mr-2"/> Analiz Başlat
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* ─── ÖZET TAB ─── */}
                {detailTab === 'ozet' && (
                  <div className="p-5 space-y-4">
                    {/* Günlük fiyat özeti */}
                    <div className="bg-slate-800/40 rounded-2xl p-4">
                      <p className="text-xs text-slate-500 font-medium mb-3 uppercase tracking-wider">Günlük Fiyat Özeti</p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                          { label:'Açılış',        value: formatNumber(selectedStock.open) + ' TL',            color:'text-white' },
                          { label:'Gün Yükseği',   value: formatNumber(selectedStock.high) + ' TL',            color:'text-emerald-400' },
                          { label:'Gün Düşüğü',    value: formatNumber(selectedStock.low) + ' TL',             color:'text-red-400' },
                          { label:'Önceki Kapanış',value: formatNumber(selectedStock.previousClose) + ' TL',   color:'text-slate-300' },
                        ].map(s => (
                          <div key={s.label} className="bg-slate-800/60 rounded-xl p-3 text-center">
                            <p className="text-[10px] text-slate-500 mb-1">{s.label}</p>
                            <p className={`font-semibold text-sm ${s.color}`}>{s.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Hacim + Değişim */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-800/40 rounded-2xl p-4">
                        <p className="text-xs text-slate-500 mb-2">İşlem Hacmi</p>
                        <p className="text-3xl font-bold tabular-nums">
                          {selectedStock.volume > 1e6 ? `${(selectedStock.volume/1e6).toFixed(2)}M` : `${(selectedStock.volume/1000).toFixed(0)}K`}
                        </p>
                        <p className="text-xs text-slate-600 mt-1">lot</p>
                      </div>
                      <div className={`rounded-2xl p-4 ${selectedStock.changePercent >= 0 ? 'bg-emerald-900/20 border border-emerald-800/30' : 'bg-red-900/20 border border-red-800/30'}`}>
                        <p className="text-xs text-slate-500 mb-2">Günlük Değişim</p>
                        <p className={`text-3xl font-bold tabular-nums ${selectedStock.changePercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {selectedStock.changePercent >= 0 ? '+' : ''}{formatNumber(selectedStock.changePercent)}%
                        </p>
                        <p className={`text-sm mt-1 ${selectedStock.changePercent >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                          {selectedStock.change >= 0 ? '+' : ''}{formatNumber(selectedStock.change)} TL
                        </p>
                      </div>
                    </div>

                    {/* Dönem içi aralık */}
                    {historicalData.length > 0 && (() => {
                      const cls = historicalData.map(d => d.close);
                      const rHigh = Math.max(...cls), rLow = Math.min(...cls);
                      const pos = Math.max(0, Math.min(100, ((selectedStock.price - rLow) / (rHigh - rLow)) * 100));
                      return (
                        <div className="bg-slate-800/40 rounded-2xl p-4">
                          <p className="text-xs text-slate-500 font-medium mb-3 uppercase tracking-wider">Dönem İçi Fiyat Aralığı</p>
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-xs text-red-400 w-16 text-right tabular-nums">{formatNumber(rLow)}</span>
                            <div className="flex-1 relative h-3 bg-slate-700 rounded-full overflow-hidden">
                              <div className="absolute inset-y-0 rounded-full bg-gradient-to-r from-red-500 via-yellow-500 to-emerald-500" style={{ width:`${pos}%` }}/>
                              <div className="absolute top-0.5 bottom-0.5 w-2 bg-white rounded-full shadow -translate-x-1/2" style={{ left:`${pos}%` }}/>
                            </div>
                            <span className="text-xs text-emerald-400 w-16 tabular-nums">{formatNumber(rHigh)}</span>
                          </div>
                          <p className="text-xs text-slate-500 text-center">
                            Mevcut fiyat aralığın <span className="text-white font-semibold">%{formatNumber(pos, 0)}</span> seviyesinde
                          </p>
                        </div>
                      );
                    })()}

                    {/* Eylem butonları */}
                    <div className="space-y-2 pt-2">
                      <Button className={`w-full ${isInWatchlist(selectedStock.code) ? 'bg-slate-700 hover:bg-slate-600' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                        onClick={() => { if (isInWatchlist(selectedStock.code)) removeFromWatchlist(selectedStock.code); else addToWatchlist(selectedStock); }}>
                        {isInWatchlist(selectedStock.code) ? <StarOff className="h-4 w-4 mr-2"/> : <Star className="h-4 w-4 mr-2"/>}
                        {isInWatchlist(selectedStock.code) ? 'Takipten Çıkar' : 'Takibe Al'}
                      </Button>
                      <Button variant="outline" className="w-full border-slate-700 text-slate-300"
                        onClick={() => { setAgentOpen(true); setChatInput(`${selectedStock.code} için fiyat bildirimi oluştur`); setDetailOpen(false); }}>
                        <Bell className="h-4 w-4 mr-2"/> Fiyat Bildirimi Oluştur
                      </Button>
                      <Button variant="outline" className="w-full border-slate-700 text-slate-300"
                        onClick={() => { setDetailTab('ai'); if (!detailAnalysis && !analysisLoading) fetchAIAnalysis(selectedStock.code); }}>
                        <Sparkles className="h-4 w-4 mr-2"/> Egitimsel Analizi Goruntule
                      </Button>
                    </div>
                  </div>
                )}

              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Egitimsel Asistan Modal */}
      <Dialog open={agentOpen} onOpenChange={setAgentOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] bg-slate-900 border-slate-800 text-white flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
                  <Bot className="h-6 w-6 text-white" />
                </div>
                <div>
                  <DialogTitle className="text-lg">Egitimsel Finans Asistani</DialogTitle>
                  <p className="text-xs text-slate-400">21 arac · Veri odakli egitimsel analiz</p>
                </div>
              </div>
              <div className="flex gap-2">
                <input
                  ref={txtInputRef}
                  type="file"
                  accept=".txt"
                  className="hidden"
                  onChange={handleTxtUpload}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="border-slate-700 text-slate-300"
                  onClick={() => txtInputRef.current?.click()}
                >
                  <FileText className="h-4 w-4 mr-1" />
                  TXT
                </Button>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleImageUpload(e)}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="border-slate-700 text-slate-300"
                  onClick={() => imageInputRef.current?.click()}
                >
                  <ImageIcon className="h-4 w-4 mr-1" />
                  Grafik
                </Button>
              </div>
            </div>
          </DialogHeader>

          {/* Tool Panel - Always Visible */}
          <div className="border-b border-slate-800 bg-slate-950/40">
            {/* Category Toggle Row */}
            <div className="flex items-center gap-1 px-3 pt-2 pb-1 overflow-x-auto scrollbar-none">
              <Zap className="h-3 w-3 text-slate-500 shrink-0 mr-0.5" />
              {TOOL_CATEGORIES.map(cat => {
                const active = enabledCategories.has(cat.id);
                const catToolCount = cat.tools.length;
                return (
                  <button
                    key={cat.id}
                    onClick={() => {
                      setEnabledCategories(prev => {
                        const next = new Set(prev);
                        if (next.has(cat.id)) {
                          if (next.size > 1) next.delete(cat.id);
                        } else {
                          next.add(cat.id);
                        }
                        return next;
                      });
                    }}
                    className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md border whitespace-nowrap transition-all shrink-0 ${
                      active ? cat.activeClass : cat.inactiveClass
                    }`}
                  >
                    {active && <span className="text-[9px]">✓</span>}
                    {cat.label}
                    <span className="opacity-50">({catToolCount})</span>
                  </button>
                );
              })}
              <button
                onClick={() => setEnabledCategories(new Set(TOOL_CATEGORIES.map(c => c.id)))}
                className="text-[11px] px-2 py-0.5 rounded-md border border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-500 transition-colors shrink-0"
              >
                Tümü
              </button>
            </div>

            {/* Tool Grid - All tools visible */}
            <div className="flex flex-wrap gap-1 px-3 py-2">
              {TOOL_CATEGORIES.flatMap(cat =>
                cat.tools.map(toolId => {
                  const tool = TOOLS.find(t => t.id === toolId);
                  if (!tool) return null;
                  const Icon = tool.icon;
                  const isEnabled = enabledCategories.has(cat.id);
                  const wasUsed = lastToolsUsed.includes(toolId);
                  const isRunning = chatLoading && wasUsed;

                  return (
                    <div
                      key={`${cat.id}-${toolId}`}
                      title={tool.name}
                      className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border transition-all ${
                        isRunning
                          ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300 animate-pulse'
                          : wasUsed
                          ? `bg-slate-700/50 border-slate-600/60 ${tool.color}`
                          : isEnabled
                          ? 'bg-slate-800/60 border-slate-700/40 text-slate-500 hover:text-slate-300 hover:border-slate-600'
                          : 'bg-slate-900/30 border-slate-800/30 text-slate-700 opacity-40'
                      }`}
                    >
                      <Icon className="h-2.5 w-2.5 shrink-0" />
                      <span className="truncate max-w-[72px]">{tool.name}</span>
                    </div>
                  );
                }).filter(Boolean)
              )}
            </div>

            {/* Live tool execution status */}
            {chatLoading && (
              <div className="flex items-center gap-1.5 px-3 pb-2">
                <Loader2 className="h-3 w-3 text-emerald-400 animate-spin shrink-0" />
                <span className="text-[10px] text-emerald-400">Araçlar çalışıyor...</span>
                {lastToolsUsed.length > 0 && (
                  <span className="text-[10px] text-slate-500">
                    ({lastToolsUsed.map(id => TOOLS.find(t => t.id === id)?.name).filter(Boolean).join(', ')})
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Chat Messages - Scrollable div instead of ScrollArea */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="space-y-4 p-4">
              {chatMessages.length === 0 && (
                <div className="text-center py-8">
                  <Bot className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400">Merhaba! Size nasil yardimci olabilirim?</p>
                  <div className="flex flex-wrap gap-2 justify-center mt-4">
                    {[
                      'Gunun yukselen hisseleri',
                      'THYAO hisse analizi',
                      'THYAO derin matematik analizi',
                      'Portfoyumu analiz et',
                      'THYAO ve GARAN karsilastir',
                      'ASELS RSI hesapla',
                      'Ekonomi takvimi',
                    ].map((suggestion) => (
                      <Button
                        key={suggestion}
                        variant="outline"
                        size="sm"
                        className="border-slate-700 text-slate-400 hover:text-white"
                        onClick={() => {
                          setChatInput(suggestion);
                        }}
                      >
                        {suggestion}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              {chatMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[85%] rounded-xl px-4 py-2 ${
                    msg.role === 'user'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-800 text-slate-200'
                  }`}>
                    <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                    {msg.toolsUsed && msg.toolsUsed.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-slate-700">
                        {msg.toolsUsed.map((toolId) => {
                          const tool = TOOLS.find(t => t.id === toolId);
                          if (!tool) return null;
                          const Icon = tool.icon;
                          return (
                            <Badge key={toolId} variant="outline" className={`text-xs border-slate-600 ${tool.color}`}>
                              <Icon className="h-3 w-3 mr-1" />
                              {tool.name}
                            </Badge>
                          );
                        })}
                      </div>
                    )}
                    {msg.suggestedQuestions && msg.suggestedQuestions.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-700">
                        <p className="text-xs text-slate-500 mb-2">💡 İlgili sorular:</p>
                        <div className="flex flex-col gap-1.5">
                          {msg.suggestedQuestions.map((q, qIdx) => (
                            <button
                              key={qIdx}
                              onClick={() => { setChatInput(q); }}
                              className="text-left text-xs px-3 py-1.5 rounded-lg bg-slate-700/60 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-600/40 hover:border-emerald-500/50 transition-colors"
                            >
                              {q}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {msg.pendingActions && msg.pendingActions.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-700 space-y-2">
                        <p className="text-xs text-slate-400 font-medium">🔐 Onay Bekleniyor:</p>
                        {msg.pendingActions.map((action, aIdx) => (
                          <div key={aIdx} className="flex items-center gap-2 text-xs bg-slate-700/50 rounded-lg px-3 py-2">
                            {action.tool === 'add_to_watchlist' && <Star className="h-3.5 w-3.5 text-yellow-400 shrink-0" />}
                            {action.tool === 'remove_from_watchlist' && <Trash2 className="h-3.5 w-3.5 text-red-400 shrink-0" />}
                            {action.tool === 'create_price_alert' && <Bell className="h-3.5 w-3.5 text-amber-400 shrink-0" />}
                            <span className="text-slate-300 flex-1">{action.description}</span>
                          </div>
                        ))}
                        <div className="flex gap-2 mt-2">
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7 px-3"
                            onClick={() => confirmPendingActions(msg.pendingActions!, idx)}
                            disabled={chatLoading}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Onayla
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-slate-600 text-slate-400 hover:text-white text-xs h-7 px-3"
                            onClick={() => cancelPendingActions(idx)}
                            disabled={chatLoading}
                          >
                            <X className="h-3 w-3 mr-1" />
                            İptal
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="bg-slate-800 rounded-xl px-4 py-2">
                    <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          </div>

          {/* Chat Input */}
          <div className="flex gap-2 pt-4 border-t border-slate-800">
            <Input
              placeholder={currentUser ? 'Mesajinizi yazin...' : 'Chatbotu kullanmak icin giris yapin'}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendToAgent();
                }
              }}
              disabled={!currentUser}
              className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-emerald-500"
            />
            <Button
              onClick={sendToAgent}
              disabled={!currentUser || chatLoading || !chatInput.trim()}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Auth Modal */}
      <Dialog
        open={authOpen}
        onOpenChange={(open) => {
          setAuthOpen(open);
          if (!open) {
            setNeedsVerification(false);
            setResendCooldown(0);
          }
        }}
      >
        <DialogContent className="max-w-md bg-slate-900 border-slate-800 text-white">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
                {authMode === 'login' ? <LogIn className="h-6 w-6 text-white" /> : <UserPlus className="h-6 w-6 text-white" />}
              </div>
              <div>
                <DialogTitle className="text-xl">{authMode === 'login' ? 'Giris Yap' : 'Kayit Ol'}</DialogTitle>
                <p className="text-sm text-slate-400">E-posta ve sifre ile guvenli erisim</p>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm text-slate-400 mb-2 block">E-posta</label>
              <Input
                type="email"
                placeholder="ornek@email.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAuth(); }}
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-emerald-500"
              />
            </div>

            <div>
              <label className="text-sm text-slate-400 mb-2 block">Sifre</label>
              <Input
                type="password"
                placeholder="En az 8 karakter, harf ve rakam"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAuth(); }}
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-emerald-500"
              />
            </div>

            <Button
              onClick={handleAuth}
              disabled={!emailInput.trim() || !passwordInput || authLoading}
              className="w-full bg-gradient-to-r from-emerald-600 to-cyan-600 hover:opacity-90"
            >
              {authLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <KeyRound className="h-4 w-4 mr-2" />
              )}
              {authMode === 'login' ? 'Giris Yap' : 'Kayit Ol'}
            </Button>

            {(needsVerification || authMode === 'login') && (
              <div className="space-y-2">
                {needsVerification && (
                  <p className="text-xs text-amber-300">
                    E-posta doğrulaması bekleniyor. Kod gelmediyse yeniden gönderebilirsiniz.
                  </p>
                )}
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleResendVerification}
                  disabled={!emailInput.trim() || resendLoading || authLoading || resendCooldown > 0}
                  className="w-full border-slate-700 bg-slate-800/70 hover:bg-slate-700 text-slate-200"
                >
                  {resendLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  {resendCooldown > 0
                    ? `Yeniden gonder (${resendCooldown}s)`
                    : 'Dogrulama kodunu yeniden gonder'}
                </Button>
              </div>
            )}

            <div className="text-center">
              <button
                onClick={() => {
                  setAuthMode(authMode === 'login' ? 'register' : 'login');
                  setNeedsVerification(false);
                }}
                className="text-sm text-slate-400 hover:text-white transition-colors"
              >
                {authMode === 'login' ? 'Hesabiniz yok mu? Kayit olun' : 'Zaten hesabiniz var mi? Giris yapin'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
