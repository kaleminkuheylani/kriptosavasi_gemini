'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
];

// Tab definitions
const TABS = [
  { id: 'dashboard', label: 'Ana Sayfa', icon: LayoutDashboard },
  { id: 'stocks', label: 'Hisseler', icon: Database },
  { id: 'watchlist', label: 'Takip Listem', icon: Star },
  { id: 'gainers', label: 'Yükselenler', icon: TrendingUp },
  { id: 'losers', label: 'Düşenler', icon: TrendingDown },
  { id: 'alerts', label: 'Bildirimler', icon: Bell },
];

export default function Home() {
  const { toast } = useToast();
  
  // State
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [filteredStocks, setFilteredStocks] = useState<Stock[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  
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
  
  // Detail Modal
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  const [stockDetail, setStockDetail] = useState<Stock | null>(null);
  const [historicalData, setHistoricalData] = useState<HistoricalData[]>([]);
  const [chartTimeframe, setChartTimeframe] = useState('1M');
  const [detailLoading, setDetailLoading] = useState(false);
  
  // AI Agent
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
  const [rumuzInput, setRumuzInput] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

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

  // Fetch similar stocks based on user's watchlist
  const fetchSimilarStocks = useCallback(async () => {
    try {
      // Get recommended stocks based on user's watchlist sectors
      const symbols = watchlist.map(item => item.symbol).join(',');
      const response = await fetch(`/api/market?type=recommended&symbols=${symbols}`);
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
  }, [fetchStocks, fetchWatchlist, fetchAlerts, fetchCurrentUser, fetchMarketSummary, fetchPopularStocks, fetchSectors]);

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

  const openStockDetail = async (stock: Stock) => {
    setSelectedStock(stock);
    setDetailOpen(true);
    setDetailLoading(true);
    
    try {
      const response = await fetch(`/api/stocks/${stock.code}?time=${chartTimeframe}`);
      const data = await response.json();
      if (data.success) {
        setStockDetail(data.data.detail);
        setHistoricalData(data.data.historical);
      }
    } catch {
      console.error('Detail fetch error');
    } finally {
      setDetailLoading(false);
    }
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

  // AI Agent Chat
  const sendToAgent = async () => {
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
          content: 'Bir hata oluştu. Lütfen tekrar deneyin.',
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

      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: data.success ? data.response : 'İşlem sırasında hata oluştu.',
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
    if (!rumuzInput.trim()) return;
    
    setAuthLoading(true);
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rumuz: rumuzInput.trim(),
          action: authMode,
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setCurrentUser(data.user);
        setAuthOpen(false);
        setRumuzInput('');
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

  const formatNumber = (num: number, decimals = 2) => {
    return num.toLocaleString('tr-TR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };

  const getCurrentPrice = (symbol: string): Stock | undefined => stocks.find(s => s.code === symbol);

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
                    onSeeAll={() => setActiveTab('gainers')}
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
                    onSeeAll={() => setActiveTab('losers')}
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
                    title="Sizin Icin Benzer Hisseler" 
                    icon={Sparkles} 
                    color="text-violet-400"
                  >
                    {similarStocks.length > 0 ? similarStocks.slice(0, 5).map((stock) => (
                      <StockCard key={stock.code} stock={stock} />
                    )) : (
                      <div className="p-6 text-center text-slate-500">
                        <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>Takip listenize gore benzer hisseler onerecegiz</p>
                        <p className="text-xs mt-1">Takip listenize hisse ekleyin</p>
                      </div>
                    )}
                  </SectionCard>
                </div>

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

            {/* Gainers Tab */}
            {activeTab === 'gainers' && (
              <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                <div className="p-4 border-b border-slate-800">
                  <h3 className="font-semibold text-white flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-emerald-400" />
                    Gunun Yukselenleri
                  </h3>
                </div>
                <div className="max-h-[70vh] overflow-y-auto">
                  {[...stocks].sort((a, b) => b.changePercent - a.changePercent).map((stock) => (
                    <StockCard key={stock.code} stock={stock} />
                  ))}
                </div>
              </div>
            )}

            {/* Losers Tab */}
            {activeTab === 'losers' && (
              <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                <div className="p-4 border-b border-slate-800">
                  <h3 className="font-semibold text-white flex items-center gap-2">
                    <TrendingDown className="h-5 w-5 text-red-400" />
                    Gunun Dusenleri
                  </h3>
                </div>
                <div className="max-h-[70vh] overflow-y-auto">
                  {[...stocks].sort((a, b) => a.changePercent - b.changePercent).map((stock) => (
                    <StockCard key={stock.code} stock={stock} />
                  ))}
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
                    <p className="text-slate-500 text-sm mt-2">Fiyat bildirimleri olusturmak icin AI Agent'i kullanin</p>
                    <Button 
                      className="mt-4 bg-gradient-to-r from-emerald-600 to-cyan-600"
                      onClick={() => setAgentOpen(true)}
                    >
                      <Bot className="h-4 w-4 mr-2" />
                      AI Agent ile Bildirim Olustur
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
        <DialogContent className="max-w-4xl max-h-[90vh] bg-slate-900 border-slate-800 text-white">
          {selectedStock && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold ${
                      selectedStock.changePercent > 0 ? 'bg-emerald-600/20 text-emerald-400' :
                      selectedStock.changePercent < 0 ? 'bg-red-600/20 text-red-400' :
                      'bg-slate-700 text-slate-400'
                    }`}>
                      {selectedStock.code.slice(0, 2)}
                    </div>
                    <div>
                      <DialogTitle className="text-xl">{selectedStock.code}</DialogTitle>
                      <p className="text-slate-400 text-sm">{selectedStock.name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold">{formatNumber(selectedStock.price)} TL</p>
                    <p className={`text-lg flex items-center justify-end gap-1 ${
                      selectedStock.changePercent > 0 ? 'text-emerald-400' :
                      selectedStock.changePercent < 0 ? 'text-red-400' :
                      'text-slate-400'
                    }`}>
                      {selectedStock.changePercent > 0 ? <ArrowUpRight className="h-4 w-4" /> :
                       selectedStock.changePercent < 0 ? <ArrowDownRight className="h-4 w-4" /> : null}
                      {selectedStock.change >= 0 ? '+' : ''}{formatNumber(selectedStock.change)} ({selectedStock.changePercent >= 0 ? '+' : ''}{formatNumber(selectedStock.changePercent)}%)
                    </p>
                  </div>
                </div>
              </DialogHeader>

              {/* Tabs */}
              <div className="flex gap-2 my-4">
                {['1G', '1H', '1A', '3A', '1Y'].map((time) => (
                  <Button
                    key={time}
                    variant={chartTimeframe === time ? 'default' : 'outline'}
                    size="sm"
                    className={chartTimeframe === time ? 'bg-emerald-600' : 'border-slate-700 text-slate-300'}
                    onClick={() => {
                      setChartTimeframe(time);
                      fetchHistoricalData(time);
                    }}
                  >
                    {time}
                  </Button>
                ))}
              </div>

              {detailLoading ? (
                <div className="h-[300px] flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
                </div>
              ) : historicalData.length > 0 ? (
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={historicalData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis 
                        dataKey="date" 
                        stroke="#64748b" 
                        tick={{ fill: '#94a3b8', fontSize: 12 }}
                        tickFormatter={(value) => value.slice(5)}
                      />
                      <YAxis 
                        stroke="#64748b" 
                        tick={{ fill: '#94a3b8', fontSize: 12 }}
                        domain={['auto', 'auto']}
                        tickFormatter={(value) => formatNumber(value)}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#1e293b', 
                          border: '1px solid #334155',
                          borderRadius: '8px'
                        }}
                        labelFormatter={(value) => `Tarih: ${value}`}
                        formatter={(value: number) => [formatNumber(value) + ' TL', 'Fiyat']}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="close" 
                        stroke="#10b981" 
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-slate-400">
                  Grafik verisi yok
                </div>
              )}

              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <p className="text-slate-400 text-sm">Acilis</p>
                  <p className="text-white font-medium">{formatNumber(selectedStock.open)} TL</p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <p className="text-slate-400 text-sm">Yuksek</p>
                  <p className="text-emerald-400 font-medium">{formatNumber(selectedStock.high)} TL</p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <p className="text-slate-400 text-sm">Dusuk</p>
                  <p className="text-red-400 font-medium">{formatNumber(selectedStock.low)} TL</p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <p className="text-slate-400 text-sm">Hacim</p>
                  <p className="text-white font-medium">{(selectedStock.volume / 1000).toFixed(0)}K</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 mt-6">
                <Button
                  variant={isInWatchlist(selectedStock.code) ? 'secondary' : 'default'}
                  className={isInWatchlist(selectedStock.code) ? 'bg-slate-700' : 'bg-emerald-600 hover:bg-emerald-700'}
                  onClick={() => {
                    if (isInWatchlist(selectedStock.code)) {
                      removeFromWatchlist(selectedStock.code);
                    } else {
                      addToWatchlist(selectedStock);
                    }
                  }}
                >
                  {isInWatchlist(selectedStock.code) ? (
                    <>
                      <StarOff className="h-4 w-4 mr-2" />
                      Takipten Cikar
                    </>
                  ) : (
                    <>
                      <Star className="h-4 w-4 mr-2" />
                      Takibe Al
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  className="border-slate-700 text-slate-300"
                  onClick={() => {
                    setAgentOpen(true);
                    setChatInput(`${selectedStock.code} hissesini analiz eder misin?`);
                  }}
                >
                  <Bot className="h-4 w-4 mr-2" />
                  AI Analizi
                </Button>
                <Button
                  variant="outline"
                  className="border-slate-700 text-slate-300"
                  onClick={analyzeCurrentChart}
                  disabled={chartAnalyzing}
                >
                  <LineChartIcon className="h-4 w-4 mr-2" />
                  Grafigi Analiz Et
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* AI Agent Modal */}
      <Dialog open={agentOpen} onOpenChange={setAgentOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] bg-slate-900 border-slate-800 text-white flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
                  <Bot className="h-6 w-6 text-white" />
                </div>
                <div>
                  <DialogTitle className="text-lg">AI Finans Asistani</DialogTitle>
                  <p className="text-xs text-slate-400">15 arac ile desteklenmistir</p>
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

          {/* Tool Category Selector */}
          <div className="py-2 border-b border-slate-800">
            <button
              onClick={() => setToolSelectorOpen(v => !v)}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors mb-1"
            >
              <Zap className="h-3 w-3" />
              Araç Kategorileri
              <span className="text-slate-600 ml-0.5">{toolSelectorOpen ? '▲' : '▼'}</span>
            </button>
            {toolSelectorOpen && (
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {TOOL_CATEGORIES.map(cat => {
                  const active = enabledCategories.has(cat.id);
                  return (
                    <button
                      key={cat.id}
                      onClick={() => {
                        setEnabledCategories(prev => {
                          const next = new Set(prev);
                          if (next.has(cat.id)) {
                            if (next.size > 1) next.delete(cat.id); // keep at least 1
                          } else {
                            next.add(cat.id);
                          }
                          return next;
                        });
                      }}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                        active ? cat.activeClass : cat.inactiveClass
                      }`}
                    >
                      {cat.label}
                      {active && <span className="ml-1 opacity-60">✓</span>}
                    </button>
                  );
                })}
                <button
                  onClick={() => setEnabledCategories(new Set(TOOL_CATEGORIES.map(c => c.id)))}
                  className="text-xs px-2.5 py-1 rounded-full border border-slate-700 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  Tümü
                </button>
              </div>
            )}
          </div>

          {/* Tools Used */}
          {lastToolsUsed.length > 0 && (
            <div className="flex flex-wrap gap-1 py-2">
              {lastToolsUsed.map((toolId) => {
                const tool = TOOLS.find(t => t.id === toolId);
                if (!tool) return null;
                const Icon = tool.icon;
                return (
                  <Badge key={toolId} variant="outline" className={`border-slate-700 ${tool.color}`}>
                    <Icon className="h-3 w-3 mr-1" />
                    {tool.name}
                  </Badge>
                );
              })}
            </div>
          )}

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
              placeholder="Mesajinizi yazin..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendToAgent();
                }
              }}
              className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-emerald-500"
            />
            <Button
              onClick={sendToAgent}
              disabled={chatLoading || !chatInput.trim()}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Auth Modal */}
      <Dialog open={authOpen} onOpenChange={setAuthOpen}>
        <DialogContent className="max-w-md bg-slate-900 border-slate-800 text-white">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
                {authMode === 'login' ? <LogIn className="h-6 w-6 text-white" /> : <UserPlus className="h-6 w-6 text-white" />}
              </div>
              <div>
                <DialogTitle className="text-xl">{authMode === 'login' ? 'Giris Yap' : 'Kayit Ol'}</DialogTitle>
                <p className="text-sm text-slate-400">Sifresiz, rumuz ile erisim</p>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm text-slate-400 mb-2 block">Rumuz (Kullanici Adi)</label>
              <Input
                placeholder="rumuzunuz"
                value={rumuzInput}
                onChange={(e) => setRumuzInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAuth();
                }}
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-emerald-500"
              />
            </div>

            <Button
              onClick={handleAuth}
              disabled={!rumuzInput.trim() || authLoading}
              className="w-full bg-gradient-to-r from-emerald-600 to-cyan-600 hover:opacity-90"
            >
              {authLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <KeyRound className="h-4 w-4 mr-2" />
              )}
              {authMode === 'login' ? 'Giris Yap' : 'Kayit Ol'}
            </Button>

            <div className="text-center">
              <button
                onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
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
