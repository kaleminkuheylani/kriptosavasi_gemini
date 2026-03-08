import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { cn } from '../utils';

interface DovizProps {
  searchQuery: string;
}

const Doviz: React.FC<DovizProps> = ({ searchQuery }) => {
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
    .filter(([key]) => ['USD', 'EUR', 'GBP', 'CHF', 'CAD', 'RUB', 'AED'].includes(key))
    .filter(([key]) => key.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-4xl font-bold tracking-tight mb-2">Döviz Kurları</h1>
        <p className="text-zinc-500 text-sm">TelegraphCoin Finans: Anlık döviz piyasası verileri.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map(([key, val]: [string, any], i) => (
          <motion.div
            key={key}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="p-6 bg-[#0a0a0a] border border-white/5 rounded-2xl hover:border-emerald-500/30 transition-all group"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                  <DollarSign size={20} />
                </div>
                <div>
                  <h3 className="font-bold">{key} / TRY</h3>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Döviz Çifti</p>
                </div>
              </div>
              <div className={cn(
                "px-2 py-1 rounded-lg text-[10px] font-bold",
                parseFloat(val.degisim) >= 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
              )}>
                {val.degisim}%
              </div>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[10px] text-zinc-500 uppercase mb-1">Satış Fiyatı</p>
                <p className="text-2xl font-mono font-bold">{val.satis}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-zinc-500 uppercase mb-1">Alış</p>
                <p className="text-sm font-mono text-zinc-400">{val.alis}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default Doviz;
