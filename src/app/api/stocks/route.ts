import { NextResponse } from 'next/server';

interface StockData {
  code: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  sector?: string;
}

// Twelve Data API Key
const TWELVE_DATA_API_KEY = 'a9ee562223e34aa59be0ae4075b10085';

// Global cache
let cachedStocks: StockData[] = [];
let lastFetchTime = 0;
const CACHE_DURATION = 60 * 1000; // 1 minute

// Fallback static stocks - Full BIST 100
const FALLBACK_STOCKS: StockData[] = [
  // A
  { code: 'ADEL', name: 'ADEL KALEM', price: 45.20, change: 0.85, changePercent: 1.92, volume: 125000, high: 46.00, low: 44.50, open: 44.80, previousClose: 44.35 },
  { code: 'AEFES', name: 'ANADOLU EFES', price: 185.50, change: -2.30, changePercent: -1.23, volume: 2100000, high: 188.00, low: 184.00, open: 187.00, previousClose: 187.80 },
  { code: 'AFYON', name: 'AFYON CIMENTO', price: 89.75, change: 1.45, changePercent: 1.64, volume: 85000, high: 91.00, low: 88.50, open: 89.00, previousClose: 88.30 },
  { code: 'AGHOL', name: 'AGA OGULLARI', price: 15.80, change: 0.25, changePercent: 1.61, volume: 520000, high: 16.20, low: 15.50, open: 15.60, previousClose: 15.55 },
  { code: 'AGESA', name: 'AGESA HAYAT EMEK.', price: 78.90, change: -0.60, changePercent: -0.76, volume: 180000, high: 79.80, low: 78.20, open: 79.50, previousClose: 79.50 },
  { code: 'AKBNK', name: 'AKBANK', price: 52.80, change: -0.90, changePercent: -1.68, volume: 45000000, high: 54.20, low: 52.00, open: 53.50, previousClose: 53.70 },
  { code: 'AKCNS', name: 'AKCANS', price: 52.40, change: 0.80, changePercent: 1.55, volume: 320000, high: 53.00, low: 51.80, open: 52.00, previousClose: 51.60 },
  { code: 'AKENR', name: 'AK ENERJI', price: 158.75, change: 2.25, changePercent: 1.44, volume: 450000, high: 160.50, low: 157.00, open: 157.50, previousClose: 156.50 },
  { code: 'AKGRT', name: 'AKSIGORTA', price: 39.50, change: -0.30, changePercent: -0.75, volume: 280000, high: 40.00, low: 39.20, open: 39.80, previousClose: 39.80 },
  { code: 'AKSA', name: 'AKSA', price: 248.00, change: 4.50, changePercent: 1.85, volume: 1200000, high: 252.00, low: 245.00, open: 246.00, previousClose: 243.50 },
  { code: 'ALARK', name: 'ALARKO CARRIER', price: 145.25, change: 1.75, changePercent: 1.22, volume: 680000, high: 147.00, low: 144.00, open: 144.50, previousClose: 143.50 },
  { code: 'ALBRK', name: 'ALBARAKA', price: 18.65, change: 0.35, changePercent: 1.91, volume: 8500000, high: 19.00, low: 18.40, open: 18.50, previousClose: 18.30 },
  { code: 'ALFAS', name: 'ALFAS', price: 8.45, change: 0.15, changePercent: 1.81, volume: 1500000, high: 8.60, low: 8.35, open: 8.40, previousClose: 8.30 },
  { code: 'ALGYO', name: 'ALARKO GMYO', price: 125.50, change: -1.80, changePercent: -1.41, volume: 320000, high: 127.50, low: 124.50, open: 127.00, previousClose: 127.30 },
  { code: 'ARCLK', name: 'ARCELIK', price: 98.50, change: 1.50, changePercent: 1.55, volume: 2500000, high: 100.00, low: 97.00, open: 98.00, previousClose: 97.00 },
  { code: 'ASELS', name: 'ASELSAN', price: 95.50, change: 2.30, changePercent: 2.47, volume: 8500000, high: 97.00, low: 93.00, open: 93.50, previousClose: 93.20 },
  { code: 'ASTOR', name: 'ASTOR', price: 38.90, change: 0.70, changePercent: 1.83, volume: 1200000, high: 39.50, low: 38.20, open: 38.50, previousClose: 38.20 },
  { code: 'ATLAS', name: 'ATLAS', price: 58.75, change: -0.45, changePercent: -0.76, volume: 420000, high: 59.50, low: 58.00, open: 59.20, previousClose: 59.20 },
  // B
  { code: 'BAGFS', name: 'BAGFAS', price: 195.00, change: 3.50, changePercent: 1.83, volume: 180000, high: 198.00, low: 192.50, open: 193.00, previousClose: 191.50 },
  { code: 'BANVT', name: 'BANVIT', price: 125.50, change: 1.25, changePercent: 1.01, volume: 280000, high: 127.00, low: 124.50, open: 125.00, previousClose: 124.25 },
  { code: 'BAYRK', name: 'BAYRAK', price: 25.80, change: 0.45, changePercent: 1.77, volume: 650000, high: 26.20, low: 25.50, open: 25.60, previousClose: 25.35 },
  { code: 'BIMAS', name: 'BIM', price: 385.00, change: 5.50, changePercent: 1.45, volume: 1800000, high: 390.00, low: 382.00, open: 383.00, previousClose: 379.50 },
  { code: 'BIZIM', name: 'BIZIM', price: 42.50, change: -0.50, changePercent: -1.16, volume: 320000, high: 43.20, low: 42.00, open: 43.00, previousClose: 43.00 },
  { code: 'BOSSA', name: 'BOSSA', price: 78.25, change: 1.15, changePercent: 1.49, volume: 150000, high: 79.50, low: 77.50, open: 78.00, previousClose: 77.10 },
  { code: 'BRISA', name: 'BRISA', price: 285.00, change: 4.00, changePercent: 1.42, volume: 850000, high: 288.00, low: 282.00, open: 283.00, previousClose: 281.00 },
  // C
  { code: 'CANTE', name: 'CANTAS', price: 35.20, change: 0.65, changePercent: 1.88, volume: 180000, high: 36.00, low: 34.80, open: 35.00, previousClose: 34.55 },
  { code: 'CCOLA', name: 'COCA COLA ICECEK', price: 268.50, change: -3.50, changePercent: -1.29, volume: 2200000, high: 272.00, low: 267.00, open: 271.00, previousClose: 272.00 },
  { code: 'CEKUR', name: 'CEKIL ENDÜSTRI', price: 28.75, change: 0.35, changePercent: 1.23, volume: 120000, high: 29.20, low: 28.50, open: 28.60, previousClose: 28.40 },
  { code: 'CEMAS', name: 'CEMAS', price: 72.50, change: 1.25, changePercent: 1.75, volume: 250000, high: 74.00, low: 71.50, open: 72.00, previousClose: 71.25 },
  { code: 'CIMSA', name: 'CIMSA', price: 125.00, change: 2.00, changePercent: 1.63, volume: 1200000, high: 127.00, low: 123.50, open: 124.00, previousClose: 123.00 },
  // D
  { code: 'DAGHL', name: 'DAGELIM GIDA', price: 65.80, change: 1.20, changePercent: 1.86, volume: 320000, high: 67.00, low: 65.00, open: 65.50, previousClose: 64.60 },
  { code: 'DARDL', name: 'DARDANEL', price: 58.50, change: 0.85, changePercent: 1.47, volume: 180000, high: 59.50, low: 58.00, open: 58.20, previousClose: 57.65 },
  { code: 'DEVA', name: 'DEVA HOLDING', price: 45.75, change: -0.55, changePercent: -1.19, volume: 850000, high: 46.50, low: 45.20, open: 46.30, previousClose: 46.30 },
  { code: 'DOAS', name: 'DOGUS OTOMOTIV', price: 148.50, change: 2.25, changePercent: 1.54, volume: 580000, high: 150.00, low: 147.00, open: 147.50, previousClose: 146.25 },
  { code: 'DOBUR', name: 'DOGAN BURDA', price: 68.25, change: 1.05, changePercent: 1.56, volume: 120000, high: 69.50, low: 67.50, open: 68.00, previousClose: 67.20 },
  { code: 'DOKTA', name: 'DOKTAS', price: 155.00, change: 2.50, changePercent: 1.64, volume: 280000, high: 157.50, low: 153.50, open: 154.00, previousClose: 152.50 },
  { code: 'DOHOL', name: 'DOGAN HOLDING', price: 38.50, change: -0.35, changePercent: -0.90, volume: 2500000, high: 39.00, low: 38.20, open: 38.85, previousClose: 38.85 },
  { code: 'DGNMO', name: 'DGN MOBILITE', price: 32.40, change: 0.60, changePercent: 1.89, volume: 450000, high: 33.00, low: 32.00, open: 32.20, previousClose: 31.80 },
  // E
  { code: 'ECILC', name: 'ECILC', price: 125.50, change: 2.00, changePercent: 1.62, volume: 180000, high: 127.50, low: 124.00, open: 124.50, previousClose: 123.50 },
  { code: 'ECZYT', name: 'ECZACIBASI', price: 48.75, change: 0.75, changePercent: 1.56, volume: 1500000, high: 49.50, low: 48.20, open: 48.50, previousClose: 48.00 },
  { code: 'EGEEN', name: 'EGE ENDUSTRI', price: 85.25, change: 1.35, changePercent: 1.61, volume: 120000, high: 86.50, low: 84.50, open: 85.00, previousClose: 83.90 },
  { code: 'EKGYO', name: 'EKAP GMYO', price: 12.85, change: 0.20, changePercent: 1.58, volume: 5200000, high: 13.10, low: 12.70, open: 12.75, previousClose: 12.65 },
  { code: 'ENJSA', name: 'ENERJISA', price: 52.40, change: 0.80, changePercent: 1.55, volume: 3800000, high: 53.20, low: 51.80, open: 52.00, previousClose: 51.60 },
  { code: 'ENKAI', name: 'ENKA INSAAT', price: 85.50, change: 1.25, changePercent: 1.48, volume: 2500000, high: 86.80, low: 84.80, open: 85.00, previousClose: 84.25 },
  { code: 'EREGL', name: 'EREGLI DEMIR CELIK', price: 38.50, change: 0.80, changePercent: 2.12, volume: 15000000, high: 39.00, low: 37.80, open: 38.00, previousClose: 37.70 },
  // F
  { code: 'FENER', name: 'FENERBAHCE', price: 125.00, change: 2.50, changePercent: 2.04, volume: 8500000, high: 128.00, low: 123.00, open: 123.50, previousClose: 122.50 },
  { code: 'FORTA', name: 'FORTA', price: 28.50, change: 0.55, changePercent: 1.97, volume: 650000, high: 29.20, low: 28.00, open: 28.20, previousClose: 27.95 },
  { code: 'FROTO', name: 'FORD OTOSAN', price: 720.00, change: 15.00, changePercent: 2.13, volume: 1200000, high: 730.00, low: 710.00, open: 715.00, previousClose: 705.00 },
  // G
  { code: 'GARAN', name: 'GARANTI BANKASI', price: 135.50, change: -4.70, changePercent: -3.35, volume: 22912198, high: 140.70, low: 133.90, open: 138.80, previousClose: 140.20 },
  { code: 'GESAN', name: 'GESAN', price: 18.25, change: 0.35, changePercent: 1.96, volume: 850000, high: 18.60, low: 18.00, open: 18.10, previousClose: 17.90 },
  { code: 'GLYHO', name: 'GLOBAL YAT. HOLDING', price: 8.45, change: 0.15, changePercent: 1.81, volume: 2500000, high: 8.65, low: 8.35, open: 8.40, previousClose: 8.30 },
  { code: 'GOLTS', name: 'GOLTAS', price: 245.00, change: 4.00, changePercent: 1.66, volume: 85000, high: 249.00, low: 242.50, open: 244.00, previousClose: 241.00 },
  { code: 'GOODY', name: 'GOODYEAR', price: 185.50, change: 3.25, changePercent: 1.78, volume: 420000, high: 188.50, low: 183.00, open: 184.00, previousClose: 182.25 },
  { code: 'GSDDE', name: 'GSD DENIZ', price: 35.80, change: 0.65, changePercent: 1.85, volume: 380000, high: 36.50, low: 35.20, open: 35.50, previousClose: 35.15 },
  { code: 'GUBRF', name: 'GUBRE FABRIKALARI', price: 275.00, change: 4.50, changePercent: 1.67, volume: 850000, high: 279.00, low: 272.00, open: 273.50, previousClose: 270.50 },
  // H
  { code: 'HALKB', name: 'HALK BANKASI', price: 38.25, change: 0.75, changePercent: 2.00, volume: 8500000, high: 38.80, low: 37.80, open: 38.00, previousClose: 37.50 },
  { code: 'HEKTS', name: 'HEKTAS', price: 85.50, change: 1.50, changePercent: 1.78, volume: 120000, high: 87.00, low: 84.50, open: 85.00, previousClose: 84.00 },
  // I
  { code: 'IPEKE', name: 'IPEK DOGA ENERJI', price: 65.25, change: 1.15, changePercent: 1.79, volume: 280000, high: 66.50, low: 64.80, open: 65.00, previousClose: 64.10 },
  { code: 'ISCTR', name: 'IS BANKASI (C)', price: 7.85, change: 0.15, changePercent: 1.95, volume: 85000000, high: 8.00, low: 7.70, open: 7.75, previousClose: 7.70 },
  { code: 'ISFIN', name: 'IS FINANSAL KIRALAMA', price: 55.80, change: 0.85, changePercent: 1.55, volume: 180000, high: 56.80, low: 55.20, open: 55.50, previousClose: 54.95 },
  { code: 'ISGYO', name: 'IS GMYO', price: 18.45, change: 0.30, changePercent: 1.65, volume: 3500000, high: 18.80, low: 18.20, open: 18.30, previousClose: 18.15 },
  { code: 'ISMEN', name: 'IS MENKUL DEGERLER', price: 52.50, change: 0.85, changePercent: 1.65, volume: 1200000, high: 53.30, low: 52.00, open: 52.20, previousClose: 51.65 },
  { code: 'IZMDC', name: 'IZMIR DEMIR DOKUM', price: 85.75, change: 1.45, changePercent: 1.72, volume: 150000, high: 87.20, low: 85.00, open: 85.50, previousClose: 84.30 },
  { code: 'IZOCAM', name: 'IZOCAM', price: 95.20, change: 1.60, changePercent: 1.71, volume: 85000, high: 97.00, low: 94.50, open: 95.00, previousClose: 93.60 },
  // K
  { code: 'KAPT', name: 'KAPTAN', price: 15.80, change: 0.30, changePercent: 1.94, volume: 680000, high: 16.20, low: 15.60, open: 15.65, previousClose: 15.50 },
  { code: 'KARSN', name: 'KARSAN', price: 125.50, change: 2.75, changePercent: 2.24, volume: 2500000, high: 128.50, low: 123.50, open: 124.00, previousClose: 122.75 },
  { code: 'KARTN', name: 'KARTONSAN', price: 285.00, change: 4.50, changePercent: 1.60, volume: 120000, high: 289.00, low: 282.00, open: 283.50, previousClose: 280.50 },
  { code: 'KCHOL', name: 'KOC HOLDING', price: 165.50, change: 1.20, changePercent: 0.73, volume: 4200000, high: 167.00, low: 164.00, open: 165.00, previousClose: 164.30 },
  { code: 'KCAER', name: 'KOC AERODINAMIK', price: 68.25, change: 1.05, changePercent: 1.56, volume: 320000, high: 69.50, low: 67.50, open: 68.00, previousClose: 67.20 },
  { code: 'KCON', name: 'KOC CONSUMER', price: 42.80, change: 0.65, changePercent: 1.54, volume: 850000, high: 43.50, low: 42.20, open: 42.50, previousClose: 42.15 },
  { code: 'KERVT', name: 'KERVANSARAY', price: 8.25, change: 0.15, changePercent: 1.85, volume: 1200000, high: 8.45, low: 8.15, open: 8.20, previousClose: 8.10 },
  { code: 'KFEIN', name: 'KFEIN', price: 285.50, change: 4.25, changePercent: 1.51, volume: 180000, high: 290.00, low: 282.50, open: 284.00, previousClose: 281.25 },
  { code: 'KLRHO', name: 'KILER HOLDING', price: 12.45, change: 0.25, changePercent: 2.05, volume: 2500000, high: 12.80, low: 12.30, open: 12.40, previousClose: 12.20 },
  { code: 'KMPUR', name: 'KUMPAS', price: 45.80, change: 0.85, changePercent: 1.89, volume: 380000, high: 46.80, low: 45.20, open: 45.50, previousClose: 44.95 },
  { code: 'KONTR', name: 'KONTROLMATIK', price: 38.50, change: 0.70, changePercent: 1.85, volume: 150000, high: 39.30, low: 38.00, open: 38.20, previousClose: 37.80 },
  { code: 'KORDS', name: 'KORDSA', price: 148.50, change: 2.50, changePercent: 1.71, volume: 850000, high: 150.50, low: 147.00, open: 148.00, previousClose: 146.00 },
  { code: 'KOZAA', name: 'KOZA ANADOLU', price: 35.20, change: 0.55, changePercent: 1.59, volume: 2500000, high: 35.80, low: 34.80, open: 35.00, previousClose: 34.65 },
  { code: 'KOZAL', name: 'KOZA ALTIN', price: 215.00, change: 3.75, changePercent: 1.78, volume: 1800000, high: 218.50, low: 212.50, open: 213.50, previousClose: 211.25 },
  { code: 'KRDMD', name: 'KARDEMDENIZ', price: 28.75, change: 0.45, changePercent: 1.59, volume: 850000, high: 29.30, low: 28.40, open: 28.60, previousClose: 28.30 },
  { code: 'KRVGD', name: 'KARVAN GIDA', price: 42.50, change: 0.75, changePercent: 1.80, volume: 180000, high: 43.30, low: 42.00, open: 42.20, previousClose: 41.75 },
  // L
  { code: 'LILIUM', name: 'LILIUM', price: 28.50, change: 0.55, changePercent: 1.97, volume: 520000, high: 29.20, low: 28.10, open: 28.30, previousClose: 27.95 },
  { code: 'LINK', name: 'LINK HOLDING', price: 125.00, change: 2.25, changePercent: 1.83, volume: 85000, high: 127.50, low: 123.50, open: 124.50, previousClose: 122.75 },
  // M
  { code: 'MAKTK', name: 'MAKINA TAKIM', price: 165.50, change: 2.75, changePercent: 1.69, volume: 120000, high: 168.50, low: 164.00, open: 165.00, previousClose: 162.75 },
  { code: 'MANAS', name: 'MANAS', price: 42.80, change: 0.70, changePercent: 1.66, volume: 250000, high: 43.60, low: 42.30, open: 42.50, previousClose: 42.10 },
  { code: 'MGROS', name: 'MIGROS', price: 245.00, change: 4.00, changePercent: 1.66, volume: 850000, high: 249.00, low: 242.50, open: 244.00, previousClose: 241.00 },
  { code: 'MIATK', name: 'MIATK', price: 38.75, change: 0.65, changePercent: 1.71, volume: 180000, high: 39.50, low: 38.20, open: 38.50, previousClose: 38.10 },
  { code: 'MMCRT', name: 'MIMARLIK MERKEZI', price: 55.20, change: 0.95, changePercent: 1.75, volume: 85000, high: 56.30, low: 54.80, open: 55.00, previousClose: 54.25 },
  { code: 'MNDRS', name: 'MENDERES', price: 15.85, change: 0.30, changePercent: 1.93, volume: 680000, high: 16.25, low: 15.65, open: 15.70, previousClose: 15.55 },
  { code: 'MOBTL', name: 'MOBILIZ', price: 85.50, change: 1.45, changePercent: 1.73, volume: 150000, high: 87.00, low: 84.50, open: 85.00, previousClose: 84.05 },
  // N
  { code: 'NTHOL', name: 'NET HOLDING', price: 52.50, change: 0.85, changePercent: 1.65, volume: 850000, high: 53.50, low: 52.00, open: 52.30, previousClose: 51.65 },
  { code: 'NUHCM', name: 'NUH CIMENTO', price: 385.00, change: 6.50, changePercent: 1.72, volume: 180000, high: 392.00, low: 382.00, open: 386.00, previousClose: 378.50 },
  // O
  { code: 'ODAS', name: 'ODAS ELEKTRIK', price: 65.25, change: 1.15, changePercent: 1.79, volume: 1800000, high: 66.50, low: 64.80, open: 65.00, previousClose: 64.10 },
  { code: 'ORGE', name: 'ORGE', price: 285.50, change: 4.50, changePercent: 1.60, volume: 320000, high: 290.00, low: 282.50, open: 284.00, previousClose: 281.00 },
  { code: 'OTKAR', name: 'OTOKAR', price: 545.00, change: 8.50, changePercent: 1.58, volume: 420000, high: 555.00, low: 540.00, open: 542.00, previousClose: 536.50 },
  { code: 'OYAKC', name: 'OYAK CIMENTO', price: 145.50, change: 2.25, changePercent: 1.57, volume: 580000, high: 148.00, low: 144.50, open: 145.00, previousClose: 143.25 },
  // P
  { code: 'PARSN', name: 'PARSAN', price: 125.00, change: 2.00, changePercent: 1.63, volume: 180000, high: 127.50, low: 123.80, open: 124.50, previousClose: 123.00 },
  { code: 'PATEL', name: 'PATEL', price: 48.75, change: 0.80, changePercent: 1.67, volume: 250000, high: 49.60, low: 48.20, open: 48.50, previousClose: 47.95 },
  { code: 'PETKM', name: 'PETKIM', price: 42.50, change: -0.80, changePercent: -1.85, volume: 12000000, high: 43.50, low: 42.00, open: 43.00, previousClose: 43.30 },
  { code: 'PGSUS', name: 'PGS US', price: 158.75, change: 2.75, changePercent: 1.76, volume: 850000, high: 161.50, low: 157.00, open: 158.00, previousClose: 156.00 },
  { code: 'PNLSN', name: 'PANELSAN', price: 35.80, change: 0.65, changePercent: 1.85, volume: 120000, high: 36.50, low: 35.30, open: 35.50, previousClose: 35.15 },
  { code: 'POLHO', name: 'POL HOLDING', price: 12.85, change: 0.25, changePercent: 1.98, volume: 1500000, high: 13.15, low: 12.70, open: 12.75, previousClose: 12.60 },
  { code: 'PRKME', name: 'PERA MESA', price: 85.25, change: 1.45, changePercent: 1.73, volume: 85000, high: 86.80, low: 84.50, open: 85.00, previousClose: 83.80 },
  { code: 'PRZMA', name: 'PRIZMA', price: 28.50, change: 0.50, changePercent: 1.79, volume: 180000, high: 29.10, low: 28.10, open: 28.30, previousClose: 28.00 },
  // Q
  { code: 'QNBFB', name: 'QNB FINANSBANK', price: 45.80, change: 0.75, changePercent: 1.67, volume: 2500000, high: 46.60, low: 45.30, open: 45.50, previousClose: 45.05 },
  // R
  { code: 'RAYSG', name: 'RAY SIGORTA', price: 38.50, change: 0.65, changePercent: 1.72, volume: 320000, high: 39.30, low: 38.00, open: 38.20, previousClose: 37.85 },
  { code: 'RBNTK', name: 'ROBENTEK', price: 22.75, change: 0.40, changePercent: 1.79, volume: 420000, high: 23.25, low: 22.50, open: 22.60, previousClose: 22.35 },
  { code: 'RHEAG', name: 'RHEA GAYRIMENKUL', price: 15.20, change: 0.30, changePercent: 2.01, volume: 850000, high: 15.60, low: 15.00, open: 15.10, previousClose: 14.90 },
  // S
  { code: 'SAHOL', name: 'SABANCI HOLDING', price: 42.80, change: -0.40, changePercent: -0.93, volume: 8500000, high: 43.50, low: 42.50, open: 43.00, previousClose: 43.20 },
  { code: 'SARKY', name: 'SARKUYULARI', price: 125.50, change: 2.25, changePercent: 1.83, volume: 85000, high: 128.00, low: 124.00, open: 125.00, previousClose: 123.25 },
  { code: 'SASA', name: 'SASA', price: 165.00, change: 3.00, changePercent: 1.85, volume: 3500000, high: 168.50, low: 163.00, open: 164.00, previousClose: 162.00 },
  { code: 'SAYAS', name: 'SAYAS', price: 52.50, change: 0.85, changePercent: 1.65, volume: 180000, high: 53.40, low: 52.00, open: 52.30, previousClose: 51.65 },
  { code: 'SDTTR', name: 'SDT', price: 85.75, change: 1.45, changePercent: 1.72, volume: 120000, high: 87.20, low: 85.00, open: 85.50, previousClose: 84.30 },
  { code: 'SELEC', name: 'SELECTRONE', price: 38.25, change: 0.70, changePercent: 1.86, volume: 150000, high: 39.10, low: 37.80, open: 38.00, previousClose: 37.55 },
  { code: 'SEKFK', name: 'SEKURETTIM', price: 12.50, change: 0.25, changePercent: 2.04, volume: 2500000, high: 12.80, low: 12.35, open: 12.45, previousClose: 12.25 },
  { code: 'SKBNK', name: 'SEKERBANK', price: 8.25, change: 0.15, changePercent: 1.85, volume: 5500000, high: 8.45, low: 8.15, open: 8.20, previousClose: 8.10 },
  { code: 'SKTAS', name: 'SEKTAS', price: 145.00, change: 2.50, changePercent: 1.76, volume: 85000, high: 148.00, low: 143.50, open: 144.50, previousClose: 142.50 },
  { code: 'SMART', name: 'SMART', price: 28.75, change: 0.50, changePercent: 1.77, volume: 380000, high: 29.30, low: 28.40, open: 28.60, previousClose: 28.25 },
  { code: 'SNGYO', name: 'SINPA GMYO', price: 15.85, change: 0.30, changePercent: 1.93, volume: 3500000, high: 16.25, low: 15.70, open: 15.75, previousClose: 15.55 },
  { code: 'SNKRN', name: 'SANKURAN', price: 42.50, change: 0.75, changePercent: 1.80, volume: 180000, high: 43.40, low: 42.00, open: 42.30, previousClose: 41.75 },
  { code: 'SODA', name: 'SODA SANAYII', price: 525.00, change: 8.50, changePercent: 1.65, volume: 250000, high: 535.00, low: 520.00, open: 522.00, previousClose: 516.50 },
  { code: 'SOKM', name: 'SOK MARKET', price: 55.80, change: 0.95, changePercent: 1.73, volume: 1200000, high: 57.00, low: 55.20, open: 55.50, previousClose: 54.85 },
  { code: 'SONME', name: 'SONMEZ', price: 85.50, change: 1.50, changePercent: 1.78, volume: 180000, high: 87.20, low: 84.80, open: 85.00, previousClose: 84.00 },
  // T
  { code: 'TAVHL', name: 'TAV HAVALIMANLARI', price: 485.00, change: 7.50, changePercent: 1.57, volume: 1500000, high: 493.00, low: 480.00, open: 482.00, previousClose: 477.50 },
  { code: 'TCELL', name: 'TURKCELL', price: 62.50, change: 1.20, changePercent: 1.96, volume: 18000000, high: 63.50, low: 61.50, open: 62.00, previousClose: 61.30 },
  { code: 'TCKSK', name: 'TEKSITEN', price: 32.50, change: 0.55, changePercent: 1.72, volume: 180000, high: 33.20, low: 32.10, open: 32.30, previousClose: 31.95 },
  { code: 'TEBNK', name: 'TEB', price: 12.85, change: 0.25, changePercent: 1.98, volume: 2500000, high: 13.15, low: 12.70, open: 12.80, previousClose: 12.60 },
  { code: 'TEKFK', name: 'TEKFEN', price: 28.75, change: 0.50, changePercent: 1.77, volume: 520000, high: 29.30, low: 28.40, open: 28.60, previousClose: 28.25 },
  { code: 'TGSAS', name: 'TGS', price: 35.80, change: 0.65, changePercent: 1.85, volume: 850000, high: 36.50, low: 35.30, open: 35.50, previousClose: 35.15 },
  { code: 'THYAO', name: 'TURK HAVA YOLLARI', price: 285.00, change: 5.50, changePercent: 1.97, volume: 12000000, high: 290.00, low: 280.00, open: 283.00, previousClose: 279.50 },
  { code: 'TKFEN', name: 'TEKFEN HOLDING', price: 125.00, change: 2.00, changePercent: 1.63, volume: 580000, high: 127.50, low: 123.80, open: 124.50, previousClose: 123.00 },
  { code: 'TKNSA', name: 'TOKSANS', price: 85.25, change: 1.45, changePercent: 1.73, volume: 120000, high: 86.80, low: 84.50, open: 85.00, previousClose: 83.80 },
  { code: 'TMSN', name: 'TERMISAN', price: 165.50, change: 2.75, changePercent: 1.69, volume: 85000, high: 168.50, low: 164.00, open: 165.00, previousClose: 162.75 },
  { code: 'TOASO', name: 'TOFAS OTO. FAB.', price: 285.50, change: 4.50, changePercent: 1.60, volume: 2800000, high: 290.00, low: 282.00, open: 283.00, previousClose: 281.00 },
  { code: 'TRGYO', name: 'TORUNLAR GMYO', price: 52.50, change: 0.85, changePercent: 1.65, volume: 1800000, high: 53.50, low: 52.00, open: 52.30, previousClose: 51.65 },
  { code: 'TRILC', name: 'TRILOJIK', price: 42.80, change: 0.70, changePercent: 1.66, volume: 180000, high: 43.60, low: 42.30, open: 42.50, previousClose: 42.10 },
  { code: 'Troys', name: 'TROYS', price: 38.50, change: 0.65, changePercent: 1.72, volume: 150000, high: 39.30, low: 38.00, open: 38.20, previousClose: 37.85 },
  { code: 'TRPGYO', name: 'TORUNLAR REIT', price: 15.20, change: 0.30, changePercent: 2.01, volume: 2500000, high: 15.60, low: 15.00, open: 15.10, previousClose: 14.90 },
  { code: 'TSDL', name: 'TASDEMIR', price: 28.75, change: 0.50, changePercent: 1.77, volume: 320000, high: 29.30, low: 28.40, open: 28.60, previousClose: 28.25 },
  { code: 'TSPOR', name: 'TRABZONSPOR', price: 38.50, change: 0.70, changePercent: 1.85, volume: 2500000, high: 39.40, low: 38.00, open: 38.20, previousClose: 37.80 },
  { code: 'TTRAK', name: 'TTRAKYA', price: 425.00, change: 7.00, changePercent: 1.67, volume: 420000, high: 433.00, low: 422.00, open: 423.00, previousClose: 418.00 },
  { code: 'TUKAS', name: 'TUKAS', price: 65.80, change: 1.15, changePercent: 1.78, volume: 280000, high: 67.00, low: 65.00, open: 65.50, previousClose: 64.65 },
  { code: 'TUPRS', name: 'TUPRAS', price: 245.00, change: -3.50, changePercent: -1.41, volume: 3500000, high: 250.00, low: 243.00, open: 248.00, previousClose: 248.50 },
  { code: 'TURGG', name: 'TURKUAZ GIDA', price: 85.50, change: 1.50, changePercent: 1.78, volume: 180000, high: 87.20, low: 84.80, open: 85.00, previousClose: 84.00 },
  // U
  { code: 'UCAMP', name: 'UCAMP', price: 42.50, change: 0.75, changePercent: 1.80, volume: 150000, high: 43.40, low: 42.00, open: 42.30, previousClose: 41.75 },
  { code: 'UZMBD', name: 'UZMANBED', price: 28.50, change: 0.50, changePercent: 1.79, volume: 380000, high: 29.10, low: 28.10, open: 28.30, previousClose: 28.00 },
  // V
  { code: 'VAKBN', name: 'VAKIFBANK', price: 42.80, change: 0.70, changePercent: 1.66, volume: 8500000, high: 43.60, low: 42.30, open: 42.50, previousClose: 42.10 },
  { code: 'VANGD', name: 'VANGOLU', price: 38.50, change: 0.65, changePercent: 1.72, volume: 250000, high: 39.30, low: 38.00, open: 38.20, previousClose: 37.85 },
  { code: 'VESTL', name: 'VESTEL', price: 78.50, change: 2.10, changePercent: 2.75, volume: 6500000, high: 80.00, low: 77.00, open: 77.50, previousClose: 76.40 },
  { code: 'VKFYO', name: 'VAKIF GMYO', price: 8.45, change: 0.15, changePercent: 1.81, volume: 3500000, high: 8.65, low: 8.35, open: 8.40, previousClose: 8.30 },
  { code: 'VKNGY', name: 'VIKING', price: 52.50, change: 0.85, changePercent: 1.65, volume: 180000, high: 53.50, low: 52.00, open: 52.30, previousClose: 51.65 },
  // Y
  { code: 'YAPRK', name: 'YAPIRKREDI', price: 32.50, change: 0.55, changePercent: 1.72, volume: 12000000, high: 33.20, low: 32.10, open: 32.30, previousClose: 31.95 },
  { code: 'YATAS', name: 'YATAS', price: 85.25, change: 1.45, changePercent: 1.73, volume: 180000, high: 86.80, low: 84.50, open: 85.00, previousClose: 83.80 },
  { code: 'YGGYO', name: 'YIGIT GMYO', price: 15.85, change: 0.30, changePercent: 1.93, volume: 520000, high: 16.25, low: 15.70, open: 15.75, previousClose: 15.55 },
  { code: 'YKBNK', name: 'YAPI KREDI', price: 42.80, change: 0.70, changePercent: 1.66, volume: 18000000, high: 43.60, low: 42.30, open: 42.50, previousClose: 42.10 },
  { code: 'YUNSA', name: 'YUNSA', price: 145.00, change: 2.50, changePercent: 1.76, volume: 250000, high: 148.00, low: 143.50, open: 144.50, previousClose: 142.50 },
  // Z
  { code: 'ZOREN', name: 'ZORLU ENERJI', price: 28.75, change: 0.50, changePercent: 1.77, volume: 2500000, high: 29.30, low: 28.40, open: 28.60, previousClose: 28.25 },
];

async function fetchWithRetry(url: string, retries = 3): Promise<Response | null> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(15000), // 15 second timeout
      });
      if (response.ok) return response;
    } catch (error) {
      console.error(`Attempt ${i + 1} failed for ${url}:`, error);
    }
    // Wait before retry
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  return null;
}

// Fetch BIST stock list from Twelve Data
async function fetchBISTStockList(): Promise<{ code: string; name: string }[]> {
  try {
    const response = await fetchWithRetry(
      `https://api.twelvedata.com/stocks?exchange=BIST&apikey=${TWELVE_DATA_API_KEY}`
    );
    if (!response) return [];
    
    const data = await response.json();
    if (data.data && Array.isArray(data.data)) {
      return data.data
        .filter((item: { type?: string }) => item.type === 'Common Stock')
        .map((item: { symbol: string; name: string }) => ({
          code: item.symbol,
          name: item.name,
        }));
    }
  } catch (error) {
    console.error('Twelve Data list error:', error);
  }
  return [];
}

// Fetch stock quote from Twelve Data
async function fetchTwelveDataQuote(symbol: string): Promise<StockData | null> {
  try {
    const response = await fetch(
      `https://api.twelvedata.com/quote?symbol=${symbol}&exchange=BIST&apikey=${TWELVE_DATA_API_KEY}`,
      { signal: AbortSignal.timeout(10000) }
    );
    
    if (!response.ok) return null;
    
    const data = await response.json();
    
    if (data.symbol && data.close) {
      return {
        code: data.symbol,
        name: data.name || symbol,
        price: parseFloat(data.close) || 0,
        change: parseFloat(data.change) || 0,
        changePercent: parseFloat(data.percent_change) || 0,
        volume: parseInt(data.volume) || 0,
        high: parseFloat(data.high) || 0,
        low: parseFloat(data.low) || 0,
        open: parseFloat(data.open) || 0,
        previousClose: parseFloat(data.previous_close) || 0,
      };
    }
  } catch (error) {
    console.error(`Twelve Data quote error for ${symbol}:`, error);
  }
  return null;
}

// Fetch stock details from Asenax (fallback)
async function fetchStockDetails(symbol: string): Promise<StockData | null> {
  const response = await fetchWithRetry(`https://api.asenax.com/bist/get/${symbol}`);
  if (!response) return null;

  try {
    const data = await response.json();
    if (data.code === "0" && data.data?.hisseYuzeysel) {
      const detail = data.data.hisseYuzeysel;
      return {
        code: detail.sembol || symbol,
        name: detail.aciklama || symbol,
        price: detail.kapanis || detail.satis || 0,
        change: detail.net || 0,
        changePercent: detail.yuzdedegisim || 0,
        volume: detail.hacimlot || 0,
        high: detail.yuksek || 0,
        low: detail.dusuk || 0,
        open: detail.acilis || 0,
        previousClose: detail.dunkukapanis || detail.oncekikapanis || 0,
      };
    }
  } catch {
    return null;
  }
  return null;
}

export async function GET() {
  const now = Date.now();

  // Return cached data if still valid
  if (cachedStocks.length > 50 && (now - lastFetchTime) < CACHE_DURATION) {
    return NextResponse.json({
      success: true,
      data: cachedStocks,
      count: cachedStocks.length,
      timestamp: new Date(lastFetchTime).toISOString(),
      source: 'cache'
    });
  }

  console.log('Fetching stocks from Twelve Data...');
  const stocks: StockData[] = [];

  try {
    // Get BIST stock list from Twelve Data
    const stockList = await fetchBISTStockList();
    console.log(`Twelve Data returned ${stockList.length} stocks`);

    if (stockList.length > 0) {
      // Sort alphabetically and take top stocks
      const sortedStocks = stockList.sort((a, b) => a.code.localeCompare(b.code));
      const topStocks = sortedStocks.slice(0, 100); // Limit to 100 for API rate limits

      // Fetch quotes in batches
      const BATCH_SIZE = 8; // Smaller batches for Twelve Data
      const BATCH_DELAY = 200; // ms between batches

      for (let i = 0; i < topStocks.length; i += BATCH_SIZE) {
        const batch = topStocks.slice(i, i + BATCH_SIZE);
        
        const results = await Promise.all(
          batch.map(async (stock) => {
            const quote = await fetchTwelveDataQuote(stock.code);
            if (quote && quote.price > 0) {
              return quote;
            }
            return null;
          })
        );

        const validResults = results.filter((s): s is StockData => s !== null);
        stocks.push(...validResults);

        console.log(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${validResults.length}/${batch.length} stocks fetched`);

        // Delay between batches
        if (i + BATCH_SIZE < topStocks.length) {
          await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
        }
      }

      console.log(`Total stocks from Twelve Data: ${stocks.length}`);
    }

    // If we got enough stocks from Twelve Data
    if (stocks.length > 30) {
      // Merge with fallback for missing stocks
      const apiCodes = new Set(stocks.map(s => s.code));
      const missingStocks = FALLBACK_STOCKS.filter(s => !apiCodes.has(s.code));
      
      const mergedStocks = [...stocks, ...missingStocks.slice(0, 50)];
      mergedStocks.sort((a, b) => a.code.localeCompare(b.code));

      cachedStocks = mergedStocks;
      lastFetchTime = now;

      return NextResponse.json({
        success: true,
        data: mergedStocks,
        count: mergedStocks.length,
        timestamp: new Date().toISOString(),
        source: 'twelvedata'
      });
    }

    // Fallback to Asenax API
    console.log('Twelve Data insufficient, trying Asenax...');
    throw new Error('Insufficient data from Twelve Data');

  } catch (error) {
    console.error('Primary API error:', error);

    // Try Asenax as fallback
    try {
      const listResponse = await fetchWithRetry('https://api.asenax.com/bist/list');
      
      if (listResponse) {
        const listData = await listResponse.json();
        let stockCodes: { code: string; name: string }[] = [];

        if (listData.code === "0" && Array.isArray(listData.data)) {
          stockCodes = listData.data
            .filter((item: { kod?: string; ad?: string; tip?: string }) => item.tip === "Hisse")
            .map((item: { kod?: string; ad?: string }) => ({
              code: item.kod || '',
              name: item.ad || '',
            }))
            .filter((item: { code: string }) => item.code);
        }

        const asenaxStocks: StockData[] = [];
        const BATCH_SIZE = 10;
        const sortedStocks = stockCodes.sort((a, b) => a.code.localeCompare(b.code)).slice(0, 100);

        for (let i = 0; i < sortedStocks.length; i += BATCH_SIZE) {
          const batch = sortedStocks.slice(i, i + BATCH_SIZE);
          
          const results = await Promise.all(
            batch.map(async (stock) => {
              const detail = await fetchStockDetails(stock.code);
              if (detail && detail.price > 0) return detail;
              return null;
            })
          );

          asenaxStocks.push(...results.filter((s): s is StockData => s !== null));
          
          if (i + BATCH_SIZE < sortedStocks.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }

        if (asenaxStocks.length > 30) {
          cachedStocks = asenaxStocks;
          lastFetchTime = now;
          return NextResponse.json({
            success: true,
            data: asenaxStocks,
            count: asenaxStocks.length,
            timestamp: new Date().toISOString(),
            source: 'asenax'
          });
        }
      }
    } catch (asenaxError) {
      console.error('Asenax fallback error:', asenaxError);
    }

    // Return cached data if available
    if (cachedStocks.length > 30) {
      return NextResponse.json({
        success: true,
        data: cachedStocks,
        count: cachedStocks.length,
        timestamp: new Date(lastFetchTime).toISOString(),
        source: 'stale-cache'
      });
    }

    // Return fallback data
    cachedStocks = FALLBACK_STOCKS;
    lastFetchTime = now;
    return NextResponse.json({
      success: true,
      data: FALLBACK_STOCKS,
      count: FALLBACK_STOCKS.length,
      timestamp: new Date().toISOString(),
      source: 'fallback'
    });
  }
}
