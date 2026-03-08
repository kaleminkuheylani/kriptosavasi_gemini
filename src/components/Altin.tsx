import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Wallet, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '../utils';

interface AltinProps {
  searchQuery: string;
}

const Altin: React.FC<AltinProps> = ({ searchQuery }) => {
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
    .filter(([key]) => ['GA', 'C', 'Y', 'T', 'ONS'].includes(key))
    .filter(([key]) => key.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

  const getLabel = (key: string) => {
    const labels: any = {
      'GA': 'Gram Altın',
      'C': 'Çeyrek Altın',
      'Y': 'Yarım Altın',
      'T': 'Tam Altın',
      'ONS': 'Ons Altın'
    };
    return labels[key] || key;
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-4xl font-bold tracking-tight mb-2">Altın Piyasası</h1>
        <p className="text-zinc-500 text-sm">TelegraphCoin Finans: Güncel altın fiyatları ve değişimleri.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map(([key, val]: [string, any], i) => (
          <motion.div
            key={key}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            className="p-6 bg-gradient-to-br from-[#0a0a0a] to-[#050505] border border-white/5 rounded-2xl hover:border-yellow-500/30 transition-all group"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center text-yellow-500">
                  <Wallet size={20} />
                </div>
                <div>
                  <h3 className="font-bold">{getLabel(key)}</h3>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Kıymetli Maden</p>
                </div>
              </div>
              <div className={cn(
                "flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg",
                parseFloat(val.degisim) >= 0 ? "text-emerald-500 bg-emerald-500/10" : "text-rose-500 bg-rose-500/10"
              )}>
                {parseFloat(val.degisim) >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {val.degisim}%
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <span className="text-[10px] text-zinc-500 uppercase">Satış</span>
                <span className="text-2xl font-mono font-bold text-yellow-500">{val.satis}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-white/5">
                <span className="text-[10px] text-zinc-400 uppercase">Alış</span>
                <span className="text-sm font-mono text-zinc-500">{val.alis}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default Altin;
