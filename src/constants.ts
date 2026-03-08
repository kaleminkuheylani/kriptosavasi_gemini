import { Coin, NewsItem } from './types';

export const MOCK_COINS: Coin[] = [
  {
    id: 'bitcoin',
    symbol: 'BTC',
    name: 'Bitcoin',
    price: 64231.50,
    change24h: 2.4,
    marketCap: 1200000000000,
    volume24h: 35000000000,
    sparkline: [62000, 62500, 63000, 62800, 63500, 64000, 64231],
    category: 'BTC'
  },
  {
    id: 'ethereum',
    symbol: 'ETH',
    name: 'Ethereum',
    price: 3452.12,
    change24h: -1.2,
    marketCap: 400000000000,
    volume24h: 15000000000,
    sparkline: [3500, 3480, 3520, 3490, 3460, 3440, 3452],
    category: 'ETH'
  },
  {
    id: 'solana',
    symbol: 'SOL',
    name: 'Solana',
    price: 145.67,
    change24h: 5.8,
    marketCap: 65000000000,
    volume24h: 4000000000,
    sparkline: [130, 135, 138, 140, 142, 144, 145],
    category: 'Altcoin'
  },
  {
    id: 'tether',
    symbol: 'USDT',
    name: 'Tether',
    price: 1.00,
    change24h: 0.01,
    marketCap: 100000000000,
    volume24h: 50000000000,
    sparkline: [1, 1, 1, 1, 1, 1, 1],
    category: 'Stablecoin'
  },
  {
    id: 'chainlink',
    symbol: 'LINK',
    name: 'Chainlink',
    price: 18.45,
    change24h: 3.2,
    marketCap: 10000000000,
    volume24h: 800000000,
    sparkline: [17, 17.5, 17.8, 18, 18.2, 18.3, 18.45],
    category: 'DeFi'
  },
  {
    id: 'render',
    symbol: 'RNDR',
    name: 'Render',
    price: 10.45,
    change24h: 12.4,
    marketCap: 4000000000,
    volume24h: 500000000,
    sparkline: [8, 8.5, 9, 9.2, 9.8, 10.2, 10.45],
    category: 'AI'
  },
  {
    id: 'dogecoin',
    symbol: 'DOGE',
    name: 'Dogecoin',
    price: 0.16,
    change24h: -2.4,
    marketCap: 23000000000,
    volume24h: 2000000000,
    sparkline: [0.17, 0.165, 0.168, 0.162, 0.158, 0.155, 0.16],
    category: 'Meme'
  },
  {
    id: 'arbitrum',
    symbol: 'ARB',
    name: 'Arbitrum',
    price: 1.85,
    change24h: 1.2,
    marketCap: 2500000000,
    volume24h: 300000000,
    sparkline: [1.7, 1.75, 1.78, 1.8, 1.82, 1.83, 1.85],
    category: 'Layer2'
  },
  {
    id: 'decentraland',
    symbol: 'MANA',
    name: 'Decentraland',
    price: 0.65,
    change24h: 4.5,
    marketCap: 1200000000,
    volume24h: 150000000,
    sparkline: [0.58, 0.6, 0.62, 0.61, 0.63, 0.64, 0.65],
    category: 'Metaverse'
  }
];

export const MOCK_NEWS: NewsItem[] = [
  {
    id: '1',
    title: 'TelegraphCoin: Bitcoin 65.000 Dolar Direncini Zorluyor',
    summary: 'Lider kripto para birimi Bitcoin, kurumsal alımların artmasıyla birlikte kritik direnç seviyelerini test etmeye devam ediyor.',
    date: '2024-03-08',
    source: 'TelegraphCoin News',
    url: '#',
    imageUrl: 'https://picsum.photos/seed/bitcoin/800/400'
  },
  {
    id: '2',
    title: 'TelegraphCoin: Ethereum Spot ETF Onayı Yaklaşıyor mu?',
    summary: 'Analistler, SEC\'in Ethereum spot ETF başvuruları üzerindeki incelemelerinin olumlu sonuçlanabileceğini öngörüyor.',
    date: '2024-03-07',
    source: 'TelegraphCoin News',
    url: '#',
    imageUrl: 'https://picsum.photos/seed/ethereum/800/400'
  },
  {
    id: '3',
    title: 'TelegraphCoin: Solana Ekosistemi Büyümeye Devam Ediyor',
    summary: 'Solana ağındaki aktif cüzdan sayısı ve işlem hacmi, yeni çıkan projelerle birlikte rekor seviyelere ulaştı.',
    date: '2024-03-06',
    source: 'TelegraphCoin News',
    url: '#',
    imageUrl: 'https://picsum.photos/seed/solana/800/400'
  }
];
