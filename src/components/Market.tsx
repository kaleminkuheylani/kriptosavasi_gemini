import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  AreaChart, 
  Area, 
  ResponsiveContainer, 
  YAxis, 
  XAxis, 
  Tooltip 
} from 'recharts';
import { TrendingUp, TrendingDown, ArrowUpRight, BrainCircuit, Loader2, X } from 'lucide-react';
import { MOCK_COINS } from '../constants';
import { formatCurrency, formatCompactNumber, cn } from '../utils';

interface MarketProps {
  searchQuery: string;
}

const Market: React.FC<MarketProps> = ({ searchQuery }) => {
  const [selectedCategory, setSelectedCategory] = React.useState<string | null>(null);
  const [analyzingId, setAnalyzingId] = React.useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = React.useState<{ id: string, text: string } | null>(null);

  const filteredCoins = MOCK_COINS.filter(coin => {
    const matchesSearch = coin.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         coin.symbol.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || 
                           coin.category === selectedCategory || 
                           (selectedCategory === 'BTC' && coin.symbol === 'BTC') || 
                           (selectedCategory === 'ETH' && coin.symbol === 'ETH');
    return matchesSearch && matchesCategory;
  });

  const handleAIAnalysis = async (coin: any) => {
    setAnalyzingId(coin.id);
    setAnalysisResult(null);
    try {
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coinName: coin.name,
          price: coin.price,
          change: coin.change24h
        })
      });
      const data = await res.json();
      if (data.analysis) {
        setAnalysisResult({ id: coin.id, text: data.analysis });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setAnalyzingId(null);
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-2">Kripto Piyasası</h1>
          <p className="text-zinc-500 text-sm">TelegraphCoin Finans: Gerçek zamanlı kripto para verileri.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {['Hepsi', 'BTC', 'ETH', 'Altcoin', 'Stablecoin', 'DeFi', 'NFT', 'Metaverse', 'Layer1', 'Layer2', 'Meme', 'AI'].map((cat) => (
            <button 
              key={cat}
              onClick={() => setSelectedCategory(cat === 'Hepsi' ? null : cat)}
              className={cn(
                "px-4 py-1.5 rounded-full text-xs font-medium transition-all",
                (selectedCategory === cat || (cat === 'Hepsi' && !selectedCategory)) ? "bg-emerald-500 text-black" : "bg-white/5 text-zinc-400 hover:bg-white/10"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Toplam Piyasa Değeri', value: '$2.54T', change: '+1.2%', up: true },
          { label: '24s Hacim', value: '$84.2B', change: '-5.4%', up: false },
          { label: 'BTC Dominansı', value: '52.4%', change: '+0.2%', up: true },
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="p-6 bg-[#0a0a0a] border border-white/5 rounded-2xl"
          >
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">{stat.label}</p>
            <div className="flex items-end justify-between">
              <h3 className="text-2xl font-bold">{stat.value}</h3>
              <div className={cn(
                "flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg",
                stat.up ? "text-emerald-500 bg-emerald-500/10" : "text-rose-500 bg-rose-500/10"
              )}>
                {stat.up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {stat.change}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Market Table */}
      <div className="bg-[#0a0a0a] border border-white/5 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-bottom border-white/5">
                <th className="px-6 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Varlık</th>
                <th className="px-6 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Fiyat</th>
                <th className="px-6 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">24s Değişim</th>
                <th className="px-6 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Piyasa Değeri</th>
                <th className="px-6 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Son 7 Gün</th>
                <th className="px-6 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredCoins.map((coin, i) => (
                <motion.tr 
                  key={coin.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className="hover:bg-white/[0.02] transition-colors group cursor-pointer"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center font-bold text-xs">
                        {coin.symbol[0]}
                      </div>
                      <div>
                        <p className="font-bold text-sm">{coin.name}</p>
                        <p className="text-xs text-zinc-500">{coin.symbol}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-mono text-sm">{formatCurrency(coin.price)}</p>
                  </td>
                  <td className="px-6 py-4">
                    <div className={cn(
                      "flex items-center gap-1 text-xs font-bold",
                      coin.change24h >= 0 ? "text-emerald-500" : "text-rose-500"
                    )}>
                      {coin.change24h >= 0 ? '+' : ''}{coin.change24h}%
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-zinc-400">{formatCompactNumber(coin.marketCap)}</p>
                  </td>
                  <td className="px-6 py-4 w-32">
                    <div className="h-10 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={coin.sparkline.map((val, idx) => ({ val, idx }))}>
                          <defs>
                            <linearGradient id={`gradient-${coin.id}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={coin.change24h >= 0 ? "#10b981" : "#f43f5e"} stopOpacity={0.3}/>
                              <stop offset="95%" stopColor={coin.change24h >= 0 ? "#10b981" : "#f43f5e"} stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <Area 
                            type="monotone" 
                            dataKey="val" 
                            stroke={coin.change24h >= 0 ? "#10b981" : "#f43f5e"} 
                            strokeWidth={2}
                            fillOpacity={1} 
                            fill={`url(#gradient-${coin.id})`} 
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleAIAnalysis(coin)}
                        disabled={analyzingId === coin.id}
                        className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-black transition-all disabled:opacity-50"
                        title="Groq AI Analizi"
                      >
                        {analyzingId === coin.id ? <Loader2 size={16} className="animate-spin" /> : <BrainCircuit size={16} />}
                      </button>
                      <button className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-all">
                        <ArrowUpRight size={16} />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI Analysis Result Modal/Panel */}
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
                <span className="font-bold text-sm">Groq AI Analizi</span>
              </div>
              <button onClick={() => setAnalysisResult(null)} className="text-zinc-500 hover:text-white">
                <X size={16} />
              </button>
            </div>
            <div className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">
              {analysisResult.text}
            </div>
            <div className="mt-4 pt-4 border-t border-white/5 text-[10px] text-zinc-500 italic">
              * Bu analiz Groq Llama-3 tarafından üretilmiştir ve yatırım tavsiyesi değildir.
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Market;
