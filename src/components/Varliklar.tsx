import React from 'react';
import { Coins, DollarSign, Wallet } from 'lucide-react';
import { cn } from '../utils';
import Kripto from './Market';
import Doviz from './Doviz';
import Altin from './Altin';

interface VarliklarProps {
  searchQuery: string;
}

const Varliklar: React.FC<VarliklarProps> = ({ searchQuery }) => {
  const [activeAssetTab, setActiveAssetTab] = React.useState<'kripto' | 'doviz' | 'altin'>('kripto');

  const subMenuItems = [
    { id: 'kripto' as const, label: 'Kripto', icon: Coins },
    { id: 'doviz' as const, label: 'Döviz', icon: DollarSign },
    { id: 'altin' as const, label: 'Altın', icon: Wallet },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 p-2 bg-[#0a0a0a] border border-white/5 rounded-2xl w-fit">
        {subMenuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveAssetTab(item.id)}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-all',
              activeAssetTab === item.id
                ? 'bg-emerald-500 text-black font-semibold'
                : 'text-zinc-400 hover:bg-white/5 hover:text-white',
            )}
          >
            <item.icon size={16} />
            {item.label}
          </button>
        ))}
      </div>

      {activeAssetTab === 'kripto' && <Kripto searchQuery={searchQuery} />}
      {activeAssetTab === 'doviz' && <Doviz searchQuery={searchQuery} />}
      {activeAssetTab === 'altin' && <Altin searchQuery={searchQuery} />}
    </div>
  );
};

export default Varliklar;
