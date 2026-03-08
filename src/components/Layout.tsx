import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Newspaper,
  Briefcase,
  TrendingUp,
  ChevronRight,
  Menu,
  X,
  Search,
  Bell,
  User,
  Zap
} from 'lucide-react';
import { cn } from '../utils';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab, searchQuery, setSearchQuery }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [marketData, setMarketData] = useState<any>(null);

  React.useEffect(() => {
    const fetchMarketData = async () => {
      try {
        const res = await fetch('/api/market-data');
        const data = await res.json();
        setMarketData(data);
      } catch (e) {
        console.error(e);
      }
    };
    fetchMarketData();
    const interval = setInterval(fetchMarketData, 30000);
    return () => clearInterval(interval);
  }, []);

  const navItems = [
    { id: 'markets', label: 'Piyasalar', icon: Zap },
    { id: 'varliklar', label: 'Varlıklar', icon: Briefcase },
    { id: 'borsa', label: 'Borsa', icon: TrendingUp },
    { id: 'news', label: 'Haberler', icon: Newspaper },
  ];

  const marketCategories = ['BTC', 'ETH', 'Altcoin', 'Stablecoin', 'DeFi', 'NFT', 'Metaverse', 'Layer1', 'Layer2', 'Meme', 'AI'];

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-emerald-500/30">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 h-16 bg-[#0a0a0a] border-b border-white/5 z-50 flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors"
          >
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
              <Zap size={20} className="text-black fill-current" />
            </div>
            <span className="text-xl font-bold tracking-tighter italic">KriptoSavaşı</span>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-8">
          {navItems.map((item) => (
            <div key={item.id} className="relative group">
              <button
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "text-sm font-medium transition-colors hover:text-emerald-400 py-2",
                  activeTab === item.id ? "text-emerald-500" : "text-zinc-400"
                )}
              >
                {item.label}
              </button>
              {item.id === 'market' && (
                <div className="absolute top-full left-0 mt-2 w-48 bg-[#0f0f0f] border border-white/10 rounded-xl py-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all transform translate-y-2 group-hover:translate-y-0 z-50 shadow-2xl">
                  {marketCategories.map((cat) => (
                    <button
                      key={cat}
                      className="w-full text-left px-4 py-2 text-xs text-zinc-400 hover:bg-white/5 hover:text-white transition-colors"
                    >
                      {cat} Pariteleri
                    </button>
                  ))}
                </div>
              )}
              {activeTab === item.id && (
                <motion.div 
                  layoutId="nav-active"
                  className="absolute -bottom-4 left-0 right-0 h-0.5 bg-emerald-500"
                />
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <div className="relative hidden sm:block">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input 
              type="text" 
              placeholder="Ara..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-full py-1.5 pl-10 pr-4 text-sm focus:outline-none focus:border-emerald-500/50 transition-colors w-48 lg:w-64"
            />
          </div>
          <button className="p-2 hover:bg-white/5 rounded-full relative">
            <Bell size={20} className="text-zinc-400" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-emerald-500 rounded-full border-2 border-[#0a0a0a]"></span>
          </button>
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center">
            <User size={18} className="text-black" />
          </div>
        </div>
      </nav>

      {/* Sidebar */}
      <AnimatePresence mode="wait">
        {isSidebarOpen && (
          <motion.aside
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed left-0 top-16 bottom-0 w-64 bg-[#0a0a0a] border-r border-white/5 z-40 hidden lg:block"
          >
            <div className="p-6 space-y-8">
              <div>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4">Ana Menü</p>
                <div className="space-y-1">
                  {navItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all group",
                        activeTab === item.id 
                          ? "bg-emerald-500/10 text-emerald-500" 
                          : "text-zinc-400 hover:bg-white/5 hover:text-white"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <item.icon size={18} />
                        <span className="text-sm font-medium">{item.label}</span>
                      </div>
                      <ChevronRight size={14} className={cn(
                        "transition-transform",
                        activeTab === item.id ? "rotate-90" : "group-hover:translate-x-1"
                      )} />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4">Piyasa (GenelPara)</p>
                <div className="space-y-3">
                  {marketData && (
                    <>
                      <div className="flex items-center justify-between text-xs px-3">
                        <span className="text-zinc-400">USD/TRY</span>
                        <span className={cn(
                          "font-mono",
                          parseFloat(marketData.USD.degisim) >= 0 ? "text-emerald-500" : "text-rose-500"
                        )}>{marketData.USD.satis}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs px-3">
                        <span className="text-zinc-400">EUR/TRY</span>
                        <span className={cn(
                          "font-mono",
                          parseFloat(marketData.EUR.degisim) >= 0 ? "text-emerald-500" : "text-rose-500"
                        )}>{marketData.EUR.satis}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs px-3">
                        <span className="text-zinc-400">GA (Altın)</span>
                        <span className={cn(
                          "font-mono",
                          parseFloat(marketData.GA.degisim) >= 0 ? "text-emerald-500" : "text-rose-500"
                        )}>{marketData.GA.satis}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4">Hızlı Erişim</p>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-zinc-400 hover:text-white cursor-pointer transition-colors px-3">
                    <span>BTC/USDT</span>
                    <span className="text-emerald-500">+2.4%</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-zinc-400 hover:text-white cursor-pointer transition-colors px-3">
                    <span>ETH/USDT</span>
                    <span className="text-rose-500">-1.2%</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-zinc-400 hover:text-white cursor-pointer transition-colors px-3">
                    <span>SOL/USDT</span>
                    <span className="text-emerald-500">+5.8%</span>
                  </div>
                </div>
              </div>

              <div className="absolute bottom-8 left-6 right-6">
                <div className="p-4 bg-gradient-to-br from-emerald-500/20 to-teal-500/5 rounded-2xl border border-emerald-500/20">
                  <p className="text-xs font-bold text-emerald-500 mb-1">Pro'ya Geç</p>
                  <p className="text-[10px] text-zinc-400 mb-3">Gelişmiş analiz araçlarına erişin.</p>
                  <button className="w-full py-2 bg-emerald-500 text-black text-[10px] font-bold rounded-lg hover:bg-emerald-400 transition-colors">
                    YÜKSELT
                  </button>
                </div>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className={cn(
        "pt-24 pb-12 px-6 transition-all duration-300",
        isSidebarOpen ? "lg:ml-64" : "ml-0"
      )}>
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
