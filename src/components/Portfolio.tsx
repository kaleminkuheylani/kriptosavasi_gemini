import React from 'react';
import { motion } from 'motion/react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip as RechartsTooltip 
} from 'recharts';
import { Wallet, Plus, ArrowUpRight, ArrowDownRight, History } from 'lucide-react';
import { MOCK_COINS } from '../constants';
import { formatCurrency, cn } from '../utils';

const Portfolio: React.FC = () => {
  const portfolioData = [
    { name: 'Bitcoin', value: 45, color: '#F7931A' },
    { name: 'Ethereum', value: 30, color: '#627EEA' },
    { name: 'Solana', value: 15, color: '#14F195' },
    { name: 'Diğer', value: 10, color: '#828282' },
  ];

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-2">Portföyüm</h1>
          <p className="text-zinc-500 text-sm">Varlıklarınızın performansını takip edin.</p>
        </div>
        <button className="flex items-center gap-2 px-6 py-2.5 bg-emerald-500 text-black rounded-xl font-bold text-sm hover:bg-emerald-400 transition-all active:scale-95">
          <Plus size={18} /> Varlık Ekle
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Main Stats */}
        <div className="lg:col-span-8 space-y-8">
          <div className="p-8 bg-gradient-to-br from-[#0f0f0f] to-[#050505] border border-white/5 rounded-3xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <Wallet size={120} />
            </div>
            <div className="relative z-10">
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Toplam Bakiye</p>
              <h2 className="text-5xl font-bold tracking-tighter mb-4">$124,532.84</h2>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1 text-emerald-500 font-bold">
                  <ArrowUpRight size={18} />
                  <span>+$12,430.20 (11.2%)</span>
                </div>
                <span className="text-zinc-500 text-sm">Son 24 saat</span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Varlıklarım</h3>
              <button className="text-xs font-bold text-emerald-500 hover:text-emerald-400 transition-colors flex items-center gap-1">
                Tümünü Gör <History size={14} />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {MOCK_COINS.slice(0, 4).map((coin, i) => (
                <motion.div
                  key={coin.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="p-4 bg-[#0a0a0a] border border-white/5 rounded-2xl flex items-center justify-between group hover:border-emerald-500/30 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center font-bold">
                      {coin.symbol[0]}
                    </div>
                    <div>
                      <p className="font-bold text-sm">{coin.name}</p>
                      <p className="text-xs text-zinc-500">0.45 {coin.symbol}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-sm font-bold">{formatCurrency(coin.price * 0.45)}</p>
                    <div className={cn(
                      "text-[10px] font-bold flex items-center justify-end gap-1",
                      coin.change24h >= 0 ? "text-emerald-500" : "text-rose-500"
                    )}>
                      {coin.change24h >= 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                      {Math.abs(coin.change24h)}%
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* Allocation */}
        <div className="lg:col-span-4 space-y-8">
          <div className="p-6 bg-[#0a0a0a] border border-white/5 rounded-3xl">
            <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-6">Dağılım</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={portfolioData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {portfolioData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                    itemStyle={{ color: '#fff' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3 mt-4">
              {portfolioData.map((item) => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }}></div>
                    <span className="text-xs text-zinc-400">{item.name}</span>
                  </div>
                  <span className="text-xs font-bold">{item.value}%</span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-6 bg-[#0a0a0a] border border-white/5 rounded-3xl">
            <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-4">Son İşlemler</h3>
            <div className="space-y-4">
              {[
                { type: 'Alım', asset: 'BTC', amount: '0.012', date: '2 saat önce', status: 'Tamamlandı' },
                { type: 'Satım', asset: 'SOL', amount: '15.4', date: '5 saat önce', status: 'Tamamlandı' },
              ].map((tx, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center",
                      tx.type === 'Alım' ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                    )}>
                      {tx.type === 'Alım' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                    </div>
                    <div>
                      <p className="font-bold">{tx.type} {tx.asset}</p>
                      <p className="text-zinc-500">{tx.date}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{tx.amount} {tx.asset}</p>
                    <p className="text-emerald-500/70">{tx.status}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Portfolio;
