import React from 'react';
import { motion } from 'motion/react';
import { ExternalLink, Clock, Share2 } from 'lucide-react';

interface NewsProps {
  searchQuery: string;
}

const News: React.FC<NewsProps> = ({ searchQuery }) => {
  const [newsItems, setNewsItems] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchNews = async () => {
      try {
        const res = await fetch('/api/news');
        const data = await res.json();
        setNewsItems(data.items || []);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchNews();
  }, []);

  const filteredNews = newsItems.filter(item => 
    (item.title || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
    (item.summary || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return <div className="py-20 text-center text-zinc-500">Cointelegraph haberleri yükleniyor...</div>;
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-4xl font-bold tracking-tight mb-2">Cointelegraph Haberleri</h1>
        <p className="text-zinc-500 text-sm">Cointelegraph API/RSS akışından gelen en güncel haberler.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Featured News */}
        <div className="lg:col-span-8 space-y-8">
          {filteredNews.length > 0 ? filteredNews.map((item, i) => (
            <motion.article
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="group cursor-pointer"
            >
              <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                <div className="md:col-span-2 overflow-hidden rounded-2xl aspect-video md:aspect-square">
                  <img 
                    src={item.imageUrl} 
                    alt={item.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="md:col-span-3 flex flex-col justify-center space-y-4">
                  <div className="flex items-center gap-3 text-[10px] font-bold text-emerald-500 uppercase tracking-widest">
                    <span>{item.source}</span>
                    <span className="w-1 h-1 bg-zinc-700 rounded-full"></span>
                    <span className="flex items-center gap-1 text-zinc-500">
                      <Clock size={12} />
                      {item.date}
                    </span>
                  </div>
                  <h2 className="text-2xl font-bold group-hover:text-emerald-400 transition-colors leading-tight">
                    {item.title}
                  </h2>
                  <p className="text-zinc-400 text-sm line-clamp-2">
                    {item.summary}
                  </p>
                  <div className="flex items-center gap-4 pt-2">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 text-xs font-bold text-white hover:text-emerald-500 transition-colors"
                    >
                      Devamını Oku <ExternalLink size={14} />
                    </a>
                    <button className="p-2 text-zinc-500 hover:text-white transition-colors">
                      <Share2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
              <div className="mt-8 h-px bg-white/5"></div>
            </motion.article>
          )) : (
            <div className="py-20 text-center">
              <p className="text-zinc-500 italic">Aradığınız kriterlere uygun haber bulunamadı.</p>
            </div>
          )}
        </div>

        {/* Sidebar News */}
        <div className="lg:col-span-4 space-y-8">
          <div className="p-6 bg-[#0a0a0a] border border-white/5 rounded-2xl">
            <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-6">Popüler Konular</h3>
            <div className="space-y-4">
              {['Bitcoin Halving', 'Ethereum ETF', 'Meme Coins', 'AI & Crypto', 'Regulation'].map((tag) => (
                <div key={tag} className="flex items-center justify-between group cursor-pointer">
                  <span className="text-sm text-zinc-400 group-hover:text-white transition-colors">#{tag}</span>
                  <span className="text-[10px] font-bold px-2 py-1 bg-white/5 rounded-lg text-zinc-500 group-hover:bg-emerald-500/10 group-hover:text-emerald-500 transition-all">
                    12.4K
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-6 bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/10 rounded-2xl">
            <h3 className="text-sm font-bold mb-2">Bültene Abone Ol</h3>
            <p className="text-xs text-zinc-400 mb-4">Haftalık piyasa özetini e-postanıza gönderelim.</p>
            <div className="space-y-2">
              <input 
                type="email" 
                placeholder="E-posta adresiniz"
                className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-xs focus:outline-none focus:border-emerald-500/50 transition-colors"
              />
              <button className="w-full py-2 bg-emerald-500 text-black text-xs font-bold rounded-lg hover:bg-emerald-400 transition-colors">
                ABONE OL
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default News;
