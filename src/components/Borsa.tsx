import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { LayoutDashboard, TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';
import { cn } from '../utils';

interface BorsaProps {
  searchQuery: string;
}

const Borsa: React.FC<BorsaProps> = ({ searchQuery }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) return <div className="py-20 text-center text-zinc-500">Yükleniyor...</div>;

  const items = data ? Object.entries(data)
    .filter(([key]) => ['XU100', 'XU030', 'XU050'].includes(key))
    .filter(([key]) => key.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-4xl font-bold tracking-tight mb-2">Borsa İstanbul</h1>
        <p className="text-zinc-500 text-sm">TelegraphCoin Finans: BIST endeksleri ve borsa verileri.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map(([key, val]: [string, any], i) => (
          <motion.div
            key={key}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="p-6 bg-[#0a0a0a] border border-white/5 rounded-2xl hover:border-blue-500/30 transition-all"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                  <BarChart3 size={20} />
                </div>
                <div>
                  <h3 className="font-bold">{key}</h3>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest">BIST Endeksi</p>
                </div>
              </div>
              <div className={cn(
                "px-2 py-1 rounded-lg text-[10px] font-bold",
                parseFloat(val.degisim) >= 0 ? "text-emerald-500 bg-emerald-500/10" : "text-rose-500 bg-rose-500/10"
              )}>
                {val.degisim}%
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-end justify-between">
                <span className="text-[10px] text-zinc-500 uppercase">Endeks Değeri</span>
                <span className="text-3xl font-mono font-bold">{val.satis}</span>
              </div>
              <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: '70%' }}
                  className={cn(
                    "h-full rounded-full",
                    parseFloat(val.degisim) >= 0 ? "bg-emerald-500" : "bg-rose-500"
                  )}
                />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="p-8 bg-[#0a0a0a] border border-white/5 rounded-3xl text-center">
        <p className="text-zinc-500 text-sm italic">Hisse senedi detayları ve derinlik analizleri yakında eklenecektir.</p>
      </div>
    </div>
  );
};

export default Borsa;
