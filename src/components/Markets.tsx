import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Wallet, 
  BarChart3, 
  Zap,
  BrainCircuit,
  Loader2,
  X,
  ArrowUpRight
} from 'lucide-react';
import { MOCK_COINS } from '../constants';
import { formatCurrency, formatCompactNumber, cn } from '../utils';

interface MarketsProps {
  searchQuery: string;
}

const Markets: React.FC<MarketsProps> = ({ searchQuery }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<{ id: string, text: string } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/market-data');
        const json = await res.json();
        setData(json);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleAIAnalysis = async (item: any, type: string) => {
    setAnalyzingId(item.id || item.symbol);
    setAnalysisResult(null);
    try {
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coinName: item.name || item.symbol,
          price: item.price || item.satis,
          change: item.change24h || item.degisim
        })
      });
      const data = await res.json();
      if (data.analysis) {
        setAnalysisResult({ id: item.id || item.symbol, text: data.analysis });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setAnalyzingId(null);
    }
  };

  const filteredCoins = MOCK_COINS.filter(coin => 
    coin.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    coin.symbol.toLowerCase().includes(searchQuery.toLowerCase())
  ).slice(0, 5);

  const dovizItems = data ? Object.entries(data)
    .filter(([key]) => ['USD', 'EUR', 'GBP'].includes(key))
    .filter(([key]) => key.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

  const altinItems = data ? Object.entries(data)
    .filter(([key]) => ['GA', 'C', 'ONS'].includes(key))
    .filter(([key]) => key.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

  const borsaItems = data ? Object.entries(data)
    .filter(([key]) => ['XU100', 'XU030'].includes(key))
    .filter(([key]) => key.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

  if (loading) return <div className="py-20 text-center text-zinc-500">Piyasalar yükleniyor...</div>;

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-4xl font-bold tracking-tight mb-2">Piyasa Ekranı</h1>
        <p className="text-zinc-500 text-sm">TelegraphCoin Finans: Tüm enstrümanlar tek bir panelde.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Crypto & Borsa */}
        <div className="lg:col-span-8 space-y-8">
          {/* Kripto Section */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-emerald-500">
                <Zap size={20} />
                <h2 className="font-bold uppercase tracking-widest text-sm">Kripto Paralar</h2>
              </div>
              <button className="text-xs text-zinc-500 hover:text-white transition-colors">Tümünü Gör</button>
            </div>
            <div className="bg-[#0a0a0a] border border-white/5 rounded-2xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <tbody className="divide-y divide-white/5">
                  {filteredCoins.map((coin) => (
                    <tr key={coin.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center font-bold text-[10px]">
                            {coin.symbol[0]}
                          </div>
                          <div>
                            <p className="font-bold text-sm">{coin.name}</p>
                            <p className="text-[10px] text-zinc-500">{coin.symbol}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-sm">
                        {formatCurrency(coin.price)}
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "text-xs font-bold",
                          coin.change24h >= 0 ? "text-emerald-500" : "text-rose-500"
                        )}>
                          {coin.change24h >= 0 ? '+' : ''}{coin.change24h}%
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => handleAIAnalysis(coin, 'crypto')}
                          className="p-2 rounded-lg hover:bg-emerald-500/10 text-zinc-500 hover:text-emerald-500 transition-all"
                        >
                          {analyzingId === coin.id ? <Loader2 size={14} className="animate-spin" /> : <BrainCircuit size={14} />}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Borsa Section */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-blue-500">
                <BarChart3 size={20} />
                <h2 className="font-bold uppercase tracking-widest text-sm">Borsa İstanbul</h2>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {borsaItems.map(([key, val]: [string, any]) => (
                <div key={key} className="p-5 bg-[#0a0a0a] border border-white/5 rounded-2xl flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">{key}</p>
                    <p className="text-xl font-mono font-bold">{val.satis}</p>
                  </div>
                  <div className={cn(
                    "px-2 py-1 rounded-lg text-xs font-bold",
                    parseFloat(val.degisim) >= 0 ? "text-emerald-500 bg-emerald-500/10" : "text-rose-500 bg-rose-500/10"
                  )}>
                    {val.degisim}%
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Right Column: Doviz & Altin */}
        <div className="lg:col-span-4 space-y-8">
          {/* Doviz Section */}
          <section>
            <div className="flex items-center gap-2 text-zinc-400 mb-4">
              <DollarSign size={20} />
              <h2 className="font-bold uppercase tracking-widest text-sm">Döviz</h2>
            </div>
            <div className="bg-[#0a0a0a] border border-white/5 rounded-2xl divide-y divide-white/5">
              {dovizItems.map(([key, val]: [string, any]) => (
                <div key={key} className="p-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                  <div>
                    <p className="font-bold text-sm">{key} / TRY</p>
                    <p className="text-[10px] text-zinc-500">Döviz Kuru</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-sm font-bold">{val.satis}</p>
                    <p className={cn(
                      "text-[10px] font-bold",
                      parseFloat(val.degisim) >= 0 ? "text-emerald-500" : "text-rose-500"
                    )}>{val.degisim}%</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Altin Section */}
          <section>
            <div className="flex items-center gap-2 text-yellow-500 mb-4">
              <Wallet size={20} />
              <h2 className="font-bold uppercase tracking-widest text-sm">Altın</h2>
            </div>
            <div className="bg-[#0a0a0a] border border-white/5 rounded-2xl divide-y divide-white/5">
              {altinItems.map(([key, val]: [string, any]) => (
                <div key={key} className="p-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                  <div>
                    <p className="font-bold text-sm">{key === 'GA' ? 'Gram Altın' : key === 'C' ? 'Çeyrek' : 'Ons'}</p>
                    <p className="text-[10px] text-zinc-500">Altın Piyasası</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-sm font-bold text-yellow-500">{val.satis}</p>
                    <p className={cn(
                      "text-[10px] font-bold",
                      parseFloat(val.degisim) >= 0 ? "text-emerald-500" : "text-rose-500"
                    )}>{val.degisim}%</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* AI Analysis Result Modal */}
      <AnimatePresence>
        {analysisResult && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 right-8 left-8 md:left-auto md:w-96 bg-[#0f0f0f] border border-emerald-500/30 rounded-2xl p-6 shadow-2xl z-50"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-emerald-500">
                <BrainCircuit size={20} />
                <span className="font-bold text-sm">TelegraphCoin AI Analizi</span>
              </div>
              <button onClick={() => setAnalysisResult(null)} className="text-zinc-500 hover:text-white">
                <X size={16} />
              </button>
            </div>
            <div className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">
              {analysisResult.text}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Markets;
