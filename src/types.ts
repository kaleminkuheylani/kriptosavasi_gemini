export interface GenelParaData {
  [key: string]: {
    satis: string;
    alis: string;
    degisim: string;
  };
}

export interface Coin {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  marketCap: number;
  volume24h: number;
  sparkline: number[];
  category: 'BTC' | 'ETH' | 'Altcoin' | 'Stablecoin' | 'DeFi' | 'NFT' | 'FIAT' | 'Metaverse' | 'Layer1' | 'Layer2' | 'Meme' | 'AI';
}

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  date: string;
  source: string;
  url: string;
  imageUrl: string;
}

export interface PortfolioItem {
  id: string;
  symbol: string;
  amount: number;
  avgBuyPrice: number;
}
