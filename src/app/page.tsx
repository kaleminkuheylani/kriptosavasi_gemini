'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
  Menu,
  ChevronRight,
  ChevronDown,
  MessageCircle,
  Send,
  Sparkles,
  Home,
  Heart,
  BellRing,
  LineChartIcon,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
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

interface MarketSummary {
  totalStocks: number;
  gainers: number;
  losers: number;
  unchanged: number;
  totalVolume: number;
  avgChangePercent: string;
  topGainers: Array<{ symbol: string; name: string; price: number; changePercent: number }>;
  topLosers: Array<{ symbol: string; name: string; price: number; changePercent: number }>;
  mostActive: Array<{ symbol: string; name: string; price: number; volume: number }>;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  actions?: Array<{ tool: string; success: boolean; result: unknown }>;
}

type ActiveView = 'stocks' | 'watchlist' | 'alerts' | 'agent' | 'gainers' | 'losers';

export default function Home() {
  const { toast } = useToast();
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  // State
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [filteredStocks, setFilteredStocks] = useState<Stock[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeView, setActiveView] = useState<ActiveView>('stocks');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [agentPanelOpen, setAgentPanelOpen] = useState(false);
  const [marketSummary, setMarketSummary] = useState<MarketSummary | null>(null);
  
  // Detail Modal
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  const [stockDetail, setStockDetail] = useState<StockDetail | null>(null);
  const [historicalData, setHistoricalData] = useState<HistoricalData[]>([]);
  const [chartTimeframe, setChartTimeframe] = useState('1M');
  const [detailLoading, setDetailLoading] = useState(false);
  
  // AI Analysis
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiTab, setAiTab] = useState('chart');
  
  // Alert Modal
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertTargetPrice, setAlertTargetPrice] = useState('');
  const [alertCondition, setAlertCondition] = useState<'above' | 'below'>('above');
  
  // AI Agent Chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  // Market sub-menu
  const [marketMenuOpen, setMarketMenuOpen] = useState(false);

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
      } else {
        toast({
          title: 'Hata',
          description: data.error || 'Hisse verileri alınamadı',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Hata',
        description: 'Sunucu ile iletişim kurulamadı',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  // Fetch market summary
  const fetchMarketSummary = useCallback(async () => {
    try {
      const response = await fetch('/api/market');
      const data = await response.json();
      
      if (data.success) {
        setMarketSummary(data.data);
      }
    } catch (error) {
      console.error('Market summary fetch error:', error);
    }
  }, []);

  // Fetch watchlist
  const fetchWatchlist = useCallback(async () => {
    try {
      const response = await fetch('/api/watchlist');
      const data = await response.json();
      
      if (data.success) {
        setWatchlist(data.data);
      }
    } catch (error) {
      console.error('Watchlist fetch error:', error);
    }
  }, []);

  // Fetch alerts
  const fetchAlerts = useCallback(async () => {
    try {
      const response = await fetch('/api/alerts');
      const data = await response.json();
      
      if (data.success) {
        setAlerts(data.data);
      }
    } catch (error) {
      console.error('Alerts fetch error:', error);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchStocks();
    fetchWatchlist();
    fetchAlerts();
    fetchMarketSummary();
  }, [fetchStocks, fetchWatchlist, fetchAlerts, fetchMarketSummary]);

  // Filter stocks based on search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredStocks(stocks);
      return;
    }
    
    const query = searchQuery.toLowerCase();
    const filtered = stocks.filter(
      stock =>
        stock.code.toLowerCase().includes(query) ||
        stock.name.toLowerCase().includes(query)
    );
    setFilteredStocks(filtered);
  }, [searchQuery, stocks]);

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Check if stock is in watchlist
  const isInWatchlist = (symbol: string) => {
    return watchlist.some(item => item.symbol === symbol);
  };

  // Add to watchlist
  const addToWatchlist = async (stock: Stock) => {
    try {
      const response = await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: stock.code,
          name: stock.name,
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setWatchlist(prev => [...prev, data.data]);
        toast({
          title: 'Başarılı',
          description: `${stock.code} takip listesine eklendi`,
        });
      } else {
        toast({
          title: 'Uyarı',
          description: data.error || 'Eklenemedi',
          variant: 'default',
        });
      }
    } catch {
      toast({
        title: 'Hata',
        description: 'İşlem başarısız',
        variant: 'destructive',
      });
    }
  };

  // Remove from watchlist
  const removeFromWatchlist = async (symbol: string) => {
    try {
      const response = await fetch(`/api/watchlist?symbol=${symbol}`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      if (data.success) {
        setWatchlist(prev => prev.filter(item => item.symbol !== symbol));
        toast({
          title: 'Başarılı',
          description: `${symbol} takip listesinden kaldırıldı`,
        });
      }
    } catch {
      toast({
        title: 'Hata',
        description: 'İşlem başarısız',
        variant: 'destructive',
      });
    }
  };

  // Open stock detail
  const openStockDetail = async (stock: Stock) => {
    setSelectedStock(stock);
    setDetailOpen(true);
    setDetailLoading(true);
    setAiAnalysis('');
    setAiTab('chart');
    
    try {
      const response = await fetch(`/api/stocks/${stock.code}?time=${chartTimeframe}`);
      const data = await response.json();
      
      if (data.success) {
        setStockDetail(data.data.detail);
        setHistoricalData(data.data.historical);
      }
    } catch (error) {
      console.error('Stock detail fetch error:', error);
    } finally {
      setDetailLoading(false);
    }
  };

  // Fetch historical data with different timeframe
  const fetchHistoricalData = async (time: string) => {
    if (!selectedStock) return;
    
    setDetailLoading(true);
    try {
      const response = await fetch(`/api/stocks/${selectedStock.code}?time=${time}`);
      const data = await response.json();
      
      if (data.success) {
        setHistoricalData(data.data.historical);
      }
    } catch (error) {
      console.error('Historical data fetch error:', error);
    } finally {
      setDetailLoading(false);
    }
  };

  // Run AI Analysis
  const runAiAnalysis = async () => {
    if (!selectedStock) return;
    
    setAiLoading(true);
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: selectedStock.code }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setAiAnalysis(data.data.analysis);
      } else {
        toast({
          title: 'Hata',
          description: data.error || 'AI analizi yapılamadı',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Hata',
        description: 'AI analizi sırasında hata oluştu',
        variant: 'destructive',
      });
    } finally {
      setAiLoading(false);
    }
  };

  // Create price alert
  const createAlert = async () => {
    if (!selectedStock || !alertTargetPrice) return;
    
    try {
      const response = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: selectedStock.code,
          targetPrice: parseFloat(alertTargetPrice),
          condition: alertCondition,
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setAlerts(prev => [...prev, data.data]);
        setAlertOpen(false);
        setAlertTargetPrice('');
        toast({
          title: 'Başarılı',
          description: `Fiyat bildirimi oluşturuldu: ${selectedStock.code} ${alertCondition === 'above' ? '>' : '<'} ${alertTargetPrice} TL`,
        });
      } else {
        toast({
          title: 'Hata',
          description: data.error || 'Bildirim oluşturulamadı',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Hata',
        description: 'İşlem başarısız',
        variant: 'destructive',
      });
    }
  };

  // Delete alert
  const deleteAlert = async (id: string) => {
    try {
      const response = await fetch(`/api/alerts?id=${id}`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      if (data.success) {
        setAlerts(prev => prev.filter(a => a.id !== id));
        toast({
          title: 'Başarılı',
          description: 'Bildirim silindi',
        });
      }
    } catch {
      toast({
        title: 'Hata',
        description: 'Silme işlemi başarısız',
        variant: 'destructive',
      });
    }
  };

  // Send chat message to AI Agent
  const sendChatMessage = async () => {
    if (!chatInput.trim() || chatLoading) return;
    
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: chatInput,
      timestamp: new Date(),
    };
    
    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setChatLoading(true);
    
    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: chatInput,
          context: {
            watchlist: watchlist.map(w => w.symbol),
            alerts: alerts.map(a => ({ symbol: a.symbol, targetPrice: a.targetPrice })),
          },
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.response,
          timestamp: new Date(),
          actions: data.actions,
        };
        
        setChatMessages(prev => [...prev, assistantMessage]);
        
        // Refresh data if actions were taken
        if (data.actions?.length > 0) {
          fetchWatchlist();
          fetchAlerts();
        }
      } else {
        toast({
          title: 'Hata',
          description: data.error || 'AI yanıt veremedi',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Hata',
        description: 'AI ile iletişim kurulamadı',
        variant: 'destructive',
      });
    } finally {
      setChatLoading(false);
    }
  };

  // Get current price for watchlist item
  const getCurrentPrice = (symbol: string): Stock | undefined => {
    return stocks.find(s => s.code === symbol);
  };

  // Format number
  const formatNumber = (num: number, decimals = 2) => {
    return num.toLocaleString('tr-TR', { 
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals 
    });
  };

  // Get filtered stocks for view
  const getDisplayStocks = () => {
    if (activeView === 'gainers') {
      return [...stocks].filter(s => s.changePercent > 0).sort((a, b) => b.changePercent - a.changePercent);
    }
    if (activeView === 'losers') {
      return [...stocks].filter(s => s.changePercent < 0).sort((a, b) => a.changePercent - b.changePercent);
    }
    return filteredStocks;
  };

  // Sidebar navigation items
  const navItems = [
    { id: 'stocks' as ActiveView, label: 'Hisseler', icon: Home },
    { id: 'watchlist' as ActiveView, label: 'Takip Listem', icon: Heart, badge: watchlist.length },
    { id: 'alerts' as ActiveView, label: 'Bildirimler', icon: BellRing, badge: alerts.filter(a => a.active).length },
    { id: 'agent' as ActiveView, label: 'AI Ajan', icon: Bot },
  ];

  // Render sidebar content
  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-600 rounded-lg">
            <BarChart3 className="h-5 w-5 text-white" />
          </div>
          {!sidebarCollapsed && (
            <div>
              <h1 className="text-lg font-bold text-white">BIST 100</h1>
              <p className="text-xs text-slate-400">Hisse Analizi</p>
            </div>
          )}
        </div>
      </div>

      {/* Search */}
      {!sidebarCollapsed && (
        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Hisse ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-emerald-500 h-9"
            />
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              setActiveView(item.id);
              setMobileSidebarOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
              activeView === item.id
                ? 'bg-emerald-600 text-white'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <item.icon className="h-5 w-5" />
            {!sidebarCollapsed && (
              <>
                <span className="flex-1 text-left">{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <Badge className="bg-slate-700 text-slate-200 text-xs px-1.5">
                    {item.badge}
                  </Badge>
                )}
              </>
            )}
          </button>
        ))}

        {/* Market Dropdown */}
        <Collapsible open={marketMenuOpen} onOpenChange={setMarketMenuOpen}>
          <CollapsibleTrigger className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-slate-300 hover:bg-slate-800 hover:text-white`}>
            <LineChartIcon className="h-5 w-5" />
            {!sidebarCollapsed && (
              <>
                <span className="flex-1 text-left">Piyasa</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${marketMenuOpen ? 'rotate-180' : ''}`} />
              </>
            )}
          </CollapsibleTrigger>
          <CollapsibleContent className="ml-4 mt-1 space-y-1">
            <button
              onClick={() => {
                setActiveView('gainers');
                setMobileSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm ${
                activeView === 'gainers'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <TrendingUp className="h-4 w-4" />
              Yükselenler
            </button>
            <button
              onClick={() => {
                setActiveView('losers');
                setMobileSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm ${
                activeView === 'losers'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <TrendingDown className="h-4 w-4" />
              Düşenler
            </button>
          </CollapsibleContent>
        </Collapsible>
      </nav>

      {/* Bottom Actions */}
      <div className="p-4 border-t border-slate-700 space-y-2">
        <Button
          variant="outline"
          size="sm"
          className="w-full border-slate-600 text-slate-300 hover:bg-slate-700"
          onClick={() => fetchStocks(true)}
          disabled={refreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          {!sidebarCollapsed && 'Yenile'}
        </Button>
        
        <Button
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
          onClick={() => setAgentPanelOpen(true)}
        >
          <MessageCircle className="h-4 w-4 mr-2" />
          {!sidebarCollapsed && 'AI Ajan'}
        </Button>
      </div>
    </div>
  );

  // Render stock list item
  const StockListItem = ({ stock }: { stock: Stock }) => (
    <div
      className="flex items-center justify-between p-4 hover:bg-slate-700/50 cursor-pointer transition-colors border-b border-slate-700/50"
      onClick={() => openStockDetail(stock)}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-bold text-white">{stock.code}</span>
          {isInWatchlist(stock.code) && (
            <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />
          )}
        </div>
        <p className="text-sm text-slate-400 truncate">{stock.name}</p>
      </div>
      
      <div className="flex items-center gap-4">
        <div className="text-right">
          <div className="font-bold text-white">
            {formatNumber(stock.price)} TL
          </div>
          <div className={`text-sm flex items-center gap-1 justify-end ${
            stock.change >= 0 ? 'text-emerald-400' : 'text-red-400'
          }`}>
            {stock.change >= 0 ? (
              <ArrowUpRight className="h-3 w-3" />
            ) : (
              <ArrowDownRight className="h-3 w-3" />
            )}
            {stock.change >= 0 ? '+' : ''}{formatNumber(stock.changePercent)}%
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-400 hover:text-yellow-400 hover:bg-slate-600"
            onClick={(e) => {
              e.stopPropagation();
              if (isInWatchlist(stock.code)) {
                removeFromWatchlist(stock.code);
              } else {
                addToWatchlist(stock);
              }
            }}
          >
            {isInWatchlist(stock.code) ? (
              <StarOff className="h-4 w-4" />
            ) : (
              <Star className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden md:flex flex-col bg-slate-900 border-r border-slate-700 transition-all duration-300 ${
          sidebarCollapsed ? 'w-16' : 'w-64'
        }`}
      >
        <SidebarContent />
        
        {/* Collapse Toggle */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="absolute top-1/2 -translate-y-1/2 -right-3 w-6 h-6 bg-slate-800 border border-slate-700 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
        >
          <ChevronRight className={`h-3 w-3 transition-transform ${sidebarCollapsed ? 'rotate-180' : ''}`} />
        </button>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-slate-900 border-b border-slate-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="text-slate-300"
            onClick={() => setMobileSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-emerald-400" />
            <span className="font-bold text-white">BIST 100</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-slate-400 border-slate-600">
            {stocks.length} Hisse
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            className="text-slate-300"
            onClick={() => setAgentPanelOpen(true)}
          >
            <Bot className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileSidebarOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/50"
          onClick={() => setMobileSidebarOpen(false)}
        >
          <aside
            className="w-64 h-full bg-slate-900 border-r border-slate-700"
            onClick={(e) => e.stopPropagation()}
          >
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col md:pt-0 pt-14">
        {/* Desktop Header */}
        <header className="hidden md:flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <div>
            <h2 className="text-xl font-bold text-white">
              {activeView === 'stocks' && 'Tüm Hisseler'}
              {activeView === 'watchlist' && 'Takip Listem'}
              {activeView === 'alerts' && 'Bildirimler'}
              {activeView === 'agent' && 'AI Ajan'}
              {activeView === 'gainers' && 'En Çok Yükselenler'}
              {activeView === 'losers' && 'En Çok Düşenler'}
            </h2>
            <p className="text-slate-400 text-sm">
              {activeView === 'stocks' && `${filteredStocks.length} hisse listelendi`}
              {activeView === 'watchlist' && `${watchlist.length} hisse takip ediliyor`}
              {activeView === 'alerts' && `${alerts.filter(a => a.active).length} aktif bildirim`}
              {activeView === 'gainers' && 'Günün en çok yükselen hisseleri'}
              {activeView === 'losers' && 'Günün en çok düşen hisseleri'}
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Market Summary Mini */}
            {marketSummary && (
              <div className="hidden lg:flex items-center gap-4 px-4 py-2 bg-slate-800 rounded-lg">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-400" />
                  <span className="text-sm text-slate-300">{marketSummary.gainers}</span>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-red-400" />
                  <span className="text-sm text-slate-300">{marketSummary.losers}</span>
                </div>
              </div>
            )}
            
            <Button
              variant="outline"
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
              onClick={() => setAgentPanelOpen(true)}
            >
              <Bot className="h-4 w-4 mr-2" />
              AI Ajan
              <Sparkles className="h-3 w-3 ml-2 text-yellow-400" />
            </Button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-auto p-4 md:p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
              <span className="ml-2 text-slate-400">Hisseler yükleniyor...</span>
            </div>
          ) : (
            <>
              {/* Stocks View */}
              {(activeView === 'stocks' || activeView === 'gainers' || activeView === 'losers') && (
                <Card className="bg-slate-900/50 border-slate-800">
                  <CardContent className="p-0">
                    <ScrollArea className="h-[calc(100vh-220px)] md:h-[calc(100vh-220px)]">
                      <div className="divide-y divide-slate-700/50">
                        {getDisplayStocks().map((stock) => (
                          <StockListItem key={stock.code} stock={stock} />
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}

              {/* Watchlist View */}
              {activeView === 'watchlist' && (
                <Card className="bg-slate-900/50 border-slate-800">
                  <CardContent className="p-0">
                    {watchlist.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                        <Heart className="h-12 w-12 mb-2" />
                        <p>Takip listesi boş</p>
                        <p className="text-sm mt-1">Hisselerden yıldız butonuna tıklayarak ekleyebilirsiniz</p>
                      </div>
                    ) : (
                      <ScrollArea className="h-[calc(100vh-220px)]">
                        <div className="divide-y divide-slate-700/50">
                          {watchlist.map((item) => {
                            const currentStock = getCurrentPrice(item.symbol);
                            return (
                              <div
                                key={item.id}
                                className="flex items-center justify-between p-4 hover:bg-slate-700/50 cursor-pointer transition-colors"
                                onClick={() => currentStock && openStockDetail(currentStock)}
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-white">{item.symbol}</span>
                                    <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />
                                  </div>
                                  <p className="text-sm text-slate-400 truncate">{item.name}</p>
                                  {item.targetPrice && (
                                    <p className="text-xs text-amber-400 mt-1">
                                      Hedef: {formatNumber(item.targetPrice)} TL
                                    </p>
                                  )}
                                </div>
                                
                                <div className="flex items-center gap-4">
                                  {currentStock ? (
                                    <div className="text-right">
                                      <div className="font-bold text-white">
                                        {formatNumber(currentStock.price)} TL
                                      </div>
                                      <div className={`text-sm flex items-center gap-1 justify-end ${
                                        currentStock.change >= 0 ? 'text-emerald-400' : 'text-red-400'
                                      }`}>
                                        {currentStock.change >= 0 ? '+' : ''}{formatNumber(currentStock.changePercent)}%
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-slate-500 text-sm">Fiyat yok</span>
                                  )}
                                  
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-slate-400 hover:text-red-400 hover:bg-slate-600"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      removeFromWatchlist(item.symbol);
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Alerts View */}
              {activeView === 'alerts' && (
                <Card className="bg-slate-900/50 border-slate-800">
                  <CardContent className="p-0">
                    {alerts.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                        <Bell className="h-12 w-12 mb-2" />
                        <p>Aktif bildirim yok</p>
                        <p className="text-sm mt-1">Hisse detayından fiyat bildirimi oluşturabilirsiniz</p>
                      </div>
                    ) : (
                      <ScrollArea className="h-[calc(100vh-220px)]">
                        <div className="divide-y divide-slate-700/50">
                          {alerts.map((alert) => {
                            const currentStock = getCurrentPrice(alert.symbol);
                            const isTriggered = alert.condition === 'above' 
                              ? currentStock && currentStock.price >= alert.targetPrice
                              : currentStock && currentStock.price <= alert.targetPrice;
                            
                            return (
                              <div
                                key={alert.id}
                                className={`flex items-center justify-between p-4 ${
                                  isTriggered ? 'bg-emerald-900/30' : 'hover:bg-slate-700/50'
                                } transition-colors`}
                              >
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-white">{alert.symbol}</span>
                                    {isTriggered ? (
                                      <Badge className="bg-emerald-600 text-white">
                                        <Bell className="h-3 w-3 mr-1" />
                                        Tetiklendi!
                                      </Badge>
                                    ) : (
                                      <Badge variant="outline" className="border-slate-600 text-slate-300">
                                        {alert.condition === 'above' ? 'Üzerine' : 'Altına'}
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-sm text-slate-400 mt-1">
                                    Hedef: {formatNumber(alert.targetPrice)} TL
                                    {currentStock && (
                                      <span className="ml-2">
                                        (Güncel: {formatNumber(currentStock.price)} TL)
                                      </span>
                                    )}
                                  </p>
                                </div>
                                
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-slate-400 hover:text-red-400 hover:bg-slate-600"
                                    onClick={() => deleteAlert(alert.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* AI Agent View */}
              {activeView === 'agent' && (
                <Card className="bg-slate-900/50 border-slate-800 h-[calc(100vh-220px)] flex flex-col">
                  <CardHeader className="border-b border-slate-800 pb-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10 bg-emerald-600">
                        <AvatarFallback className="bg-emerald-600 text-white">
                          <Bot className="h-5 w-5" />
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <CardTitle className="text-white text-lg">AI Borsa Asistanı</CardTitle>
                        <p className="text-slate-400 text-sm">Hisse analizi, takip listesi ve bildirim işlemleri</p>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="flex-1 flex flex-col p-0">
                    <ScrollArea className="flex-1 p-4">
                      {chatMessages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center py-8">
                          <Zap className="h-12 w-12 text-emerald-400 mb-4" />
                          <h3 className="text-lg font-semibold text-white mb-2">AI Ajanına Hoş Geldiniz</h3>
                          <p className="text-slate-400 mb-4 max-w-md">
                            BIST hisseleri hakkında sorularınızı sorun, analiz isteyin, takip listesi ve bildirim oluşturun.
                          </p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 w-full max-w-md">
                            {[
                              'ASELS hissesini analiz et',
                              'En çok yükselenler hangileri?',
                              'THYAO\'yu takip listeme ekle',
                              'Piyasa özeti nedir?',
                            ].map((suggestion) => (
                              <Button
                                key={suggestion}
                                variant="outline"
                                className="border-slate-700 text-slate-300 hover:bg-slate-800 justify-start"
                                onClick={() => {
                                  setChatInput(suggestion);
                                }}
                              >
                                {suggestion}
                              </Button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {chatMessages.map((msg) => (
                            <div
                              key={msg.id}
                              className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}
                            >
                              {msg.role === 'assistant' && (
                                <Avatar className="h-8 w-8 bg-emerald-600 flex-shrink-0">
                                  <AvatarFallback className="bg-emerald-600 text-white">
                                    <Bot className="h-4 w-4" />
                                  </AvatarFallback>
                                </Avatar>
                              )}
                              <div className={`max-w-[80%] rounded-lg p-3 ${
                                msg.role === 'user'
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-slate-800 text-slate-200'
                              }`}>
                                <div className="whitespace-pre-wrap text-sm">{msg.content}</div>
                                {msg.actions && msg.actions.length > 0 && (
                                  <div className="mt-2 pt-2 border-t border-slate-700 space-y-1">
                                    {msg.actions.map((action, idx) => (
                                      <div key={idx} className="flex items-center gap-2 text-xs">
                                        <Badge variant="outline" className="text-xs border-slate-600 text-slate-400">
                                          {action.tool}
                                        </Badge>
                                        <span className={action.success ? 'text-emerald-400' : 'text-red-400'}>
                                          {action.success ? '✓' : '✗'}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                          <div ref={chatEndRef} />
                        </div>
                      )}
                    </ScrollArea>
                    
                    <div className="p-4 border-t border-slate-800">
                      <div className="flex gap-2">
                        <Input
                          placeholder="Mesajınızı yazın... (örn: ASELS fiyatı nedir?)"
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
                          className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                          disabled={chatLoading}
                        />
                        <Button
                          onClick={sendChatMessage}
                          disabled={!chatInput.trim() || chatLoading}
                          className="bg-emerald-600 hover:bg-emerald-700"
                        >
                          {chatLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </main>

      {/* AI Agent Side Panel */}
      <Dialog open={agentPanelOpen} onOpenChange={setAgentPanelOpen}>
        <DialogContent className="max-w-lg h-[80vh] bg-slate-900 border-slate-700 flex flex-col p-0">
          <DialogHeader className="p-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10 bg-emerald-600">
                <AvatarFallback className="bg-emerald-600 text-white">
                  <Bot className="h-5 w-5" />
                </AvatarFallback>
              </Avatar>
              <div>
                <DialogTitle className="text-white">AI Borsa Asistanı</DialogTitle>
                <DialogDescription className="text-slate-400">
                  Hisse analizi ve işlemler
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          
          <ScrollArea className="flex-1 p-4">
            {chatMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-8">
                <Zap className="h-10 w-10 text-emerald-400 mb-4" />
                <p className="text-slate-400 mb-4">
                  Merhaba! Size nasıl yardımcı olabilirim?
                </p>
                <div className="space-y-2 w-full">
                  {[
                    'ASELS hissesini analiz et',
                    'En çok yükselenler hangileri?',
                    'Piyasa özeti nedir?',
                  ].map((suggestion) => (
                    <Button
                      key={suggestion}
                      variant="outline"
                      className="w-full border-slate-700 text-slate-300 hover:bg-slate-800 justify-start"
                      onClick={() => setChatInput(suggestion)}
                    >
                      {suggestion}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}
                  >
                    {msg.role === 'assistant' && (
                      <Avatar className="h-8 w-8 bg-emerald-600 flex-shrink-0">
                        <AvatarFallback className="bg-emerald-600 text-white">
                          <Bot className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div className={`max-w-[80%] rounded-lg p-3 ${
                      msg.role === 'user'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-800 text-slate-200'
                    }`}>
                      <div className="whitespace-pre-wrap text-sm">{msg.content}</div>
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
            )}
          </ScrollArea>
          
          <div className="p-4 border-t border-slate-800">
            <div className="flex gap-2">
              <Input
                placeholder="Mesajınızı yazın..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
                className="bg-slate-800 border-slate-700 text-white"
                disabled={chatLoading}
              />
              <Button
                onClick={sendChatMessage}
                disabled={!chatInput.trim() || chatLoading}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {chatLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Stock Detail Modal */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              {selectedStock?.code}
              <span className="text-slate-400 font-normal text-base">
                {stockDetail?.name || selectedStock?.name}
              </span>
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Güncel: {stockDetail?.price ? `${formatNumber(stockDetail.price)} TL` : '-'}
              {stockDetail && (
                <span className={`ml-2 ${stockDetail.changePercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  ({stockDetail.changePercent >= 0 ? '+' : ''}{formatNumber(stockDetail.changePercent)}%)
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 mb-4">
            <Button
              variant="outline"
              size="sm"
              className="border-slate-600 text-slate-300 hover:bg-slate-700"
              onClick={() => selectedStock && (
                isInWatchlist(selectedStock.code) 
                  ? removeFromWatchlist(selectedStock.code)
                  : addToWatchlist(selectedStock)
              )}
            >
              {selectedStock && isInWatchlist(selectedStock.code) ? (
                <>
                  <StarOff className="h-4 w-4 mr-1" />
                  Takipten Çıkar
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-1" />
                  Takibe Ekle
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-slate-600 text-slate-300 hover:bg-slate-700"
              onClick={() => setAlertOpen(true)}
            >
              <Bell className="h-4 w-4 mr-1" />
              Bildirim Oluştur
            </Button>
          </div>

          {/* Detail Tabs */}
          <div className="flex gap-2 mb-4 border-b border-slate-700 pb-2">
            <Button
              variant={aiTab === 'chart' ? 'default' : 'ghost'}
              size="sm"
              className={aiTab === 'chart' ? 'bg-emerald-600 hover:bg-emerald-700' : 'text-slate-400 hover:text-white'}
              onClick={() => setAiTab('chart')}
            >
              <BarChart3 className="h-4 w-4 mr-1" />
              Grafik
            </Button>
            <Button
              variant={aiTab === 'analysis' ? 'default' : 'ghost'}
              size="sm"
              className={aiTab === 'analysis' ? 'bg-emerald-600 hover:bg-emerald-700' : 'text-slate-400 hover:text-white'}
              onClick={() => {
                setAiTab('analysis');
                if (!aiAnalysis && !aiLoading) runAiAnalysis();
              }}
            >
              <Bot className="h-4 w-4 mr-1" />
              AI Analizi
            </Button>
          </div>

          {aiTab === 'chart' && (
            <>
              {/* Timeframe Buttons */}
              <div className="flex gap-2 mb-4">
                {['1M', '3M', '6M', '1Y', '3Y', '5Y'].map((tf) => (
                  <Button
                    key={tf}
                    variant={chartTimeframe === tf ? 'default' : 'outline'}
                    size="sm"
                    className={chartTimeframe === tf 
                      ? 'bg-emerald-600 hover:bg-emerald-700' 
                      : 'border-slate-600 text-slate-300 hover:bg-slate-700'
                    }
                    onClick={() => {
                      setChartTimeframe(tf);
                      fetchHistoricalData(tf);
                    }}
                  >
                    {tf}
                  </Button>
                ))}
              </div>

              {detailLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
                </div>
              ) : historicalData.length > 0 ? (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={historicalData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis 
                        dataKey="date" 
                        stroke="#94a3b8"
                        tick={{ fontSize: 10 }}
                        tickFormatter={(value) => value?.slice(0, 10) || ''}
                      />
                      <YAxis 
                        stroke="#94a3b8"
                        domain={['auto', 'auto']}
                        tickFormatter={(value) => value.toFixed(0)}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#1e293b', 
                          border: '1px solid #334155',
                          borderRadius: '8px'
                        }}
                        labelStyle={{ color: '#f1f5f9' }}
                        itemStyle={{ color: '#10b981' }}
                        formatter={(value: number) => [formatNumber(value), 'Fiyat']}
                      />
                      <Line
                        type="monotone"
                        dataKey="close"
                        stroke="#10b981"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, fill: '#10b981' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <BarChart3 className="h-12 w-12 mb-2" />
                  <p>Grafik verisi bulunamadı</p>
                </div>
              )}

              {/* Stock Details */}
              {stockDetail && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                  <div className="bg-slate-800 rounded-lg p-3">
                    <div className="text-xs text-slate-400">Gün Yüksek</div>
                    <div className="text-lg font-bold text-white">{formatNumber(stockDetail.high)} TL</div>
                  </div>
                  <div className="bg-slate-800 rounded-lg p-3">
                    <div className="text-xs text-slate-400">Gün Düşük</div>
                    <div className="text-lg font-bold text-white">{formatNumber(stockDetail.low)} TL</div>
                  </div>
                  <div className="bg-slate-800 rounded-lg p-3">
                    <div className="text-xs text-slate-400">Açılış</div>
                    <div className="text-lg font-bold text-white">{formatNumber(stockDetail.open)} TL</div>
                  </div>
                  <div className="bg-slate-800 rounded-lg p-3">
                    <div className="text-xs text-slate-400">Önceki Kapanış</div>
                    <div className="text-lg font-bold text-white">{formatNumber(stockDetail.previousClose)} TL</div>
                  </div>
                </div>
              )}
            </>
          )}

          {aiTab === 'analysis' && (
            <>
              {aiLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
                  <span className="ml-2 text-slate-400">AI analiz yapıyor...</span>
                </div>
              ) : aiAnalysis ? (
                <ScrollArea className="h-80">
                  <div className="prose prose-invert prose-sm max-w-none">
                    <div className="whitespace-pre-wrap text-slate-300 leading-relaxed">
                      {aiAnalysis}
                    </div>
                  </div>
                </ScrollArea>
              ) : (
                <div className="flex flex-col items-center justify-center py-12">
                  <Bot className="h-12 w-12 text-slate-400 mb-4" />
                  <p className="text-slate-400 mb-4">AI analizi için tıklayın</p>
                  <Button
                    onClick={runAiAnalysis}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    <Bot className="h-4 w-4 mr-2" />
                    Analiz Yap
                  </Button>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Alert Creation Modal */}
      <Dialog open={alertOpen} onOpenChange={setAlertOpen}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Bell className="h-5 w-5 text-amber-400" />
              Fiyat Bildirimi Oluştur
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {selectedStock?.code} için fiyat bildirimi ayarla
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Koşul</Label>
              <div className="flex gap-2">
                <Button
                  variant={alertCondition === 'above' ? 'default' : 'outline'}
                  className={alertCondition === 'above' 
                    ? 'bg-emerald-600 hover:bg-emerald-700' 
                    : 'border-slate-600 text-slate-300 hover:bg-slate-700'
                  }
                  onClick={() => setAlertCondition('above')}
                >
                  <TrendingUp className="h-4 w-4 mr-1" />
                  Üzerine
                </Button>
                <Button
                  variant={alertCondition === 'below' ? 'default' : 'outline'}
                  className={alertCondition === 'below' 
                    ? 'bg-red-600 hover:bg-red-700' 
                    : 'border-slate-600 text-slate-300 hover:bg-slate-700'
                  }
                  onClick={() => setAlertCondition('below')}
                >
                  <TrendingDown className="h-4 w-4 mr-1" />
                  Altına
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Hedef Fiyat (TL)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder={stockDetail?.price?.toFixed(2) || '0.00'}
                value={alertTargetPrice}
                onChange={(e) => setAlertTargetPrice(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white"
              />
              {stockDetail && (
                <p className="text-xs text-slate-500">
                  Güncel fiyat: {formatNumber(stockDetail.price)} TL
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setAlertOpen(false)}
                className="border-slate-600 text-slate-300"
              >
                İptal
              </Button>
              <Button
                onClick={createAlert}
                disabled={!alertTargetPrice}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <Bell className="h-4 w-4 mr-2" />
                Oluştur
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
