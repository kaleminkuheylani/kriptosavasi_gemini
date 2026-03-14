export interface StockData {
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

// ─── Sektör haritası ────────────────────────────────────────────────────────
export const STOCK_SECTORS: Record<string, string> = {
  GARAN: 'Bankacılık', AKBNK: 'Bankacılık', ISCTR: 'Bankacılık',
  YKBNK: 'Bankacılık', HALKB: 'Bankacılık', VAKBN: 'Bankacılık',
  SKBNK: 'Bankacılık', QNBFB: 'Bankacılık', ALBRK: 'Bankacılık',
  KCHOL: 'Holding', SAHOL: 'Holding', DOHOL: 'Holding',
  ASELS: 'Savunma', OTKAR: 'Savunma',
  THYAO: 'Havacılık', PGSUS: 'Havacılık', TAVHL: 'Havacılık',
  FROTO: 'Otomotiv', TOASO: 'Otomotiv', DOAS: 'Otomotiv', ASUZU: 'Otomotiv',
  ARCLK: 'Teknoloji', VESTL: 'Teknoloji', LINK: 'Teknoloji',
  NETAS: 'Teknoloji', INDES: 'Teknoloji', TKNSA: 'Teknoloji',
  TCELL: 'Telekomünikasyon', TTKOM: 'Telekomünikasyon',
  TUPRS: 'Enerji', PETKM: 'Enerji', ZOREN: 'Enerji', AYDEM: 'Enerji',
  ENJSA: 'Enerji', EUPWR: 'Enerji', ORGE: 'Enerji',
  BIMAS: 'Perakende', MGROS: 'Perakende', SOKM: 'Perakende',
  ULKER: 'Gıda', TATGD: 'Gıda', CCOLA: 'İçecek', AEFES: 'İçecek', TBORG: 'İçecek',
  EKGYO: 'Gayrimenkul', ISGYO: 'Gayrimenkul', TRGYO: 'Gayrimenkul', SNGYO: 'Gayrimenkul',
  CIMSA: 'İnşaat', OYAKC: 'İnşaat', BTCIM: 'İnşaat', NUHCM: 'İnşaat',
  EREGL: 'Metal', KRDMD: 'Metal',
  SISE: 'Cam', ANACM: 'Cam',
  TTRAK: 'Tarım', GUBRF: 'Tarım', BAGFS: 'Tarım',
  KCHOL: 'Holding', ENKAI: 'İnşaat', TKFEN: 'Holding',
  GARAN: 'Bankacılık', SAHOL: 'Holding',
  AKSA: 'Kimya', SASA: 'Kimya', PETKM: 'Kimya', MERCN: 'Kimya',
  KORDS: 'Tekstil', MAVI: 'Tekstil', KOTON: 'Tekstil',
  KOZAL: 'Madencilik',
  FENER: 'Spor', BJKAS: 'Spor', GSRAY: 'Spor',
  CLEBI: 'Hizmet', JANTS: 'Otomotiv', BRISA: 'Otomotiv',
  ANHYT: 'Sigorta', ANSGR: 'Sigorta',
  HALKB: 'Bankacılık', ISMEN: 'Finans', KLNMA: 'Finans',
};

// ─── Statik fallback verisi (API erişilmezse kullanılır) ────────────────────
export const FALLBACK_STOCKS: StockData[] = [
  { code: 'ADEL',  name: 'ADEL KALEM',           price: 45.20,  change: 0.85,   changePercent: 1.92,  volume: 125000,   high: 46.00,  low: 44.50, open: 44.80,  previousClose: 44.35 },
  { code: 'AEFES', name: 'ANADOLU EFES',          price: 185.50, change: -2.30,  changePercent: -1.23, volume: 2100000,  high: 188.00, low: 184.00, open: 187.00, previousClose: 187.80 },
  { code: 'AKBNK', name: 'AKBANK',                price: 52.80,  change: -0.90,  changePercent: -1.68, volume: 45000000, high: 54.20,  low: 52.00, open: 53.50,  previousClose: 53.70 },
  { code: 'AKSA',  name: 'AKSA',                  price: 248.00, change: 4.50,   changePercent: 1.85,  volume: 1200000,  high: 252.00, low: 245.00, open: 246.00, previousClose: 243.50 },
  { code: 'ALARK', name: 'ALARKO',                price: 145.25, change: 1.75,   changePercent: 1.22,  volume: 680000,   high: 147.00, low: 144.00, open: 144.50, previousClose: 143.50 },
  { code: 'ARCLK', name: 'ARCELIK',               price: 98.50,  change: 1.50,   changePercent: 1.55,  volume: 2500000,  high: 100.00, low: 97.00, open: 98.00,  previousClose: 97.00 },
  { code: 'ASELS', name: 'ASELSAN',               price: 95.50,  change: 2.30,   changePercent: 2.47,  volume: 8500000,  high: 97.00,  low: 93.00, open: 93.50,  previousClose: 93.20 },
  { code: 'BIMAS', name: 'BIM',                   price: 385.00, change: 5.50,   changePercent: 1.45,  volume: 1800000,  high: 390.00, low: 382.00, open: 383.00, previousClose: 379.50 },
  { code: 'BRISA', name: 'BRISA',                 price: 285.00, change: 4.00,   changePercent: 1.42,  volume: 850000,   high: 288.00, low: 282.00, open: 283.00, previousClose: 281.00 },
  { code: 'CCOLA', name: 'COCA COLA ICECEK',      price: 268.50, change: -3.50,  changePercent: -1.29, volume: 2200000,  high: 272.00, low: 267.00, open: 271.00, previousClose: 272.00 },
  { code: 'CIMSA', name: 'CIMSA',                 price: 125.00, change: 2.00,   changePercent: 1.63,  volume: 1200000,  high: 127.00, low: 123.50, open: 124.00, previousClose: 123.00 },
  { code: 'DOHOL', name: 'DOGAN HOLDING',         price: 38.50,  change: -0.35,  changePercent: -0.90, volume: 2500000,  high: 39.00,  low: 38.20, open: 38.85,  previousClose: 38.85 },
  { code: 'ECZYT', name: 'ECZACIBASI',            price: 48.75,  change: 0.75,   changePercent: 1.56,  volume: 1500000,  high: 49.50,  low: 48.20, open: 48.50,  previousClose: 48.00 },
  { code: 'ENJSA', name: 'ENERJISA',              price: 52.40,  change: 0.80,   changePercent: 1.55,  volume: 3800000,  high: 53.20,  low: 51.80, open: 52.00,  previousClose: 51.60 },
  { code: 'ENKAI', name: 'ENKA',                  price: 85.50,  change: 1.25,   changePercent: 1.48,  volume: 2500000,  high: 86.80,  low: 84.80, open: 85.00,  previousClose: 84.25 },
  { code: 'EREGL', name: 'EREGLI DEMIR',          price: 38.50,  change: 0.80,   changePercent: 2.12,  volume: 15000000, high: 39.00,  low: 37.80, open: 38.00,  previousClose: 37.70 },
  { code: 'FENER', name: 'FENERBAHCE',            price: 125.00, change: 2.50,   changePercent: 2.04,  volume: 8500000,  high: 128.00, low: 123.00, open: 123.50, previousClose: 122.50 },
  { code: 'FROTO', name: 'FORD OTOSAN',           price: 720.00, change: 15.00,  changePercent: 2.13,  volume: 1200000,  high: 730.00, low: 710.00, open: 715.00, previousClose: 705.00 },
  { code: 'GARAN', name: 'GARANTI BANKASI',       price: 135.50, change: -4.70,  changePercent: -3.35, volume: 22912198, high: 140.70, low: 133.90, open: 138.80, previousClose: 140.20 },
  { code: 'GUBRF', name: 'GUBRE FABRIKALARI',     price: 275.00, change: 4.50,   changePercent: 1.67,  volume: 850000,   high: 279.00, low: 272.00, open: 273.50, previousClose: 270.50 },
  { code: 'HALKB', name: 'HALK BANKASI',          price: 38.25,  change: 0.75,   changePercent: 2.00,  volume: 8500000,  high: 38.80,  low: 37.80, open: 38.00,  previousClose: 37.50 },
  { code: 'ISCTR', name: 'IS BANKASI',            price: 7.85,   change: 0.15,   changePercent: 1.95,  volume: 85000000, high: 8.00,   low: 7.70, open: 7.75,   previousClose: 7.70 },
  { code: 'ISMEN', name: 'IS MENKUL',             price: 52.50,  change: 0.85,   changePercent: 1.65,  volume: 1200000,  high: 53.30,  low: 52.00, open: 52.20,  previousClose: 51.65 },
  { code: 'KARSN', name: 'KARSAN',                price: 125.50, change: 2.75,   changePercent: 2.24,  volume: 2500000,  high: 128.50, low: 123.50, open: 124.00, previousClose: 122.75 },
  { code: 'KCHOL', name: 'KOC HOLDING',           price: 165.50, change: 1.20,   changePercent: 0.73,  volume: 4200000,  high: 167.00, low: 164.00, open: 165.00, previousClose: 164.30 },
  { code: 'KOZAL', name: 'KOZA ALTIN',            price: 215.00, change: 3.75,   changePercent: 1.78,  volume: 1800000,  high: 218.50, low: 212.50, open: 213.50, previousClose: 211.25 },
  { code: 'KRDMD', name: 'KARDDEMIR',             price: 28.75,  change: 0.45,   changePercent: 1.59,  volume: 850000,   high: 29.30,  low: 28.40, open: 28.60,  previousClose: 28.30 },
  { code: 'LINK',  name: 'LINK HOLDING',          price: 125.00, change: 2.25,   changePercent: 1.83,  volume: 85000,    high: 127.50, low: 123.50, open: 124.50, previousClose: 122.75 },
  { code: 'MGROS', name: 'MIGROS',                price: 245.00, change: 4.00,   changePercent: 1.66,  volume: 850000,   high: 249.00, low: 242.50, open: 244.00, previousClose: 241.00 },
  { code: 'NTHOL', name: 'NET HOLDING',           price: 52.50,  change: 0.85,   changePercent: 1.65,  volume: 850000,   high: 53.50,  low: 52.00, open: 52.30,  previousClose: 51.65 },
  { code: 'ODAS',  name: 'ODAS ELEKTRIK',         price: 65.25,  change: 1.15,   changePercent: 1.79,  volume: 1800000,  high: 66.50,  low: 64.80, open: 65.00,  previousClose: 64.10 },
  { code: 'OTKAR', name: 'OTOKAR',                price: 545.00, change: 8.50,   changePercent: 1.58,  volume: 420000,   high: 555.00, low: 540.00, open: 542.00, previousClose: 536.50 },
  { code: 'OYAKC', name: 'OYAK CIMENTO',          price: 145.50, change: 2.25,   changePercent: 1.57,  volume: 580000,   high: 148.00, low: 144.50, open: 145.00, previousClose: 143.25 },
  { code: 'PETKM', name: 'PETKIM',                price: 42.50,  change: -0.80,  changePercent: -1.85, volume: 12000000, high: 43.50,  low: 42.00, open: 43.00,  previousClose: 43.30 },
  { code: 'PGSUS', name: 'PGS',                   price: 158.75, change: 2.75,   changePercent: 1.76,  volume: 850000,   high: 161.50, low: 157.00, open: 158.00, previousClose: 156.00 },
  { code: 'QNBFB', name: 'QNB FINANSBANK',        price: 45.80,  change: 0.75,   changePercent: 1.67,  volume: 2500000,  high: 46.60,  low: 45.30, open: 45.50,  previousClose: 45.05 },
  { code: 'RAYSG', name: 'RAY SIGORTA',           price: 38.50,  change: 0.65,   changePercent: 1.72,  volume: 320000,   high: 39.30,  low: 38.00, open: 38.20,  previousClose: 37.85 },
  { code: 'SAHOL', name: 'SABANCI HOLDING',       price: 42.80,  change: -0.40,  changePercent: -0.93, volume: 8500000,  high: 43.50,  low: 42.50, open: 43.00,  previousClose: 43.20 },
  { code: 'SASA',  name: 'SASA',                  price: 165.00, change: 3.00,   changePercent: 1.85,  volume: 3500000,  high: 168.50, low: 163.00, open: 164.00, previousClose: 162.00 },
  { code: 'SISE',  name: 'SISE CAM',              price: 42.50,  change: 0.70,   changePercent: 1.67,  volume: 18000000, high: 43.30,  low: 42.00, open: 42.20,  previousClose: 41.80 },
  { code: 'SKBNK', name: 'SEKERBANK',             price: 8.25,   change: 0.15,   changePercent: 1.85,  volume: 5500000,  high: 8.45,   low: 8.15, open: 8.20,   previousClose: 8.10 },
  { code: 'SNGYO', name: 'SINPA GMYO',            price: 15.85,  change: 0.30,   changePercent: 1.93,  volume: 3500000,  high: 16.25,  low: 15.70, open: 15.75,  previousClose: 15.55 },
  { code: 'SODA',  name: 'SODA SANAYII',          price: 525.00, change: 8.50,   changePercent: 1.65,  volume: 250000,   high: 535.00, low: 520.00, open: 522.00, previousClose: 516.50 },
  { code: 'TAVHL', name: 'TAV HAVALIMANLARI',     price: 485.00, change: 7.50,   changePercent: 1.57,  volume: 1500000,  high: 493.00, low: 480.00, open: 482.00, previousClose: 477.50 },
  { code: 'TCELL', name: 'TURKCELL',              price: 62.50,  change: 1.20,   changePercent: 1.96,  volume: 18000000, high: 63.50,  low: 61.50, open: 62.00,  previousClose: 61.30 },
  { code: 'THYAO', name: 'TURK HAVA YOLLARI',    price: 285.00, change: 5.50,   changePercent: 1.97,  volume: 12000000, high: 290.00, low: 280.00, open: 283.00, previousClose: 279.50 },
  { code: 'TOASO', name: 'TOFAS',                 price: 285.50, change: 4.50,   changePercent: 1.60,  volume: 2800000,  high: 290.00, low: 282.00, open: 283.00, previousClose: 281.00 },
  { code: 'TTRAK', name: 'TRAKYA CAM',            price: 425.00, change: 7.00,   changePercent: 1.67,  volume: 420000,   high: 433.00, low: 422.00, open: 423.00, previousClose: 418.00 },
  { code: 'TUPRS', name: 'TUPRAS',                price: 245.00, change: -3.50,  changePercent: -1.41, volume: 3500000,  high: 250.00, low: 243.00, open: 248.00, previousClose: 248.50 },
  { code: 'ULKER', name: 'ULKER',                 price: 32.50,  change: 0.55,   changePercent: 1.72,  volume: 8500000,  high: 33.20,  low: 32.10, open: 32.30,  previousClose: 31.95 },
  { code: 'VAKBN', name: 'VAKIFBANK',             price: 42.80,  change: 0.70,   changePercent: 1.66,  volume: 8500000,  high: 43.60,  low: 42.30, open: 42.50,  previousClose: 42.10 },
  { code: 'VESTL', name: 'VESTEL',                price: 78.50,  change: 2.10,   changePercent: 2.75,  volume: 6500000,  high: 80.00,  low: 77.00, open: 77.50,  previousClose: 76.40 },
  { code: 'YKBNK', name: 'YAPI KREDI',            price: 42.80,  change: 0.70,   changePercent: 1.66,  volume: 18000000, high: 43.60,  low: 42.30, open: 42.50,  previousClose: 42.10 },
  { code: 'YUNSA', name: 'YUNSA',                 price: 145.00, change: 2.50,   changePercent: 1.76,  volume: 250000,   high: 148.00, low: 143.50, open: 144.50, previousClose: 142.50 },
  { code: 'ZOREN', name: 'ZORLU ENERJI',          price: 28.75,  change: 0.50,   changePercent: 1.77,  volume: 2500000,  high: 29.30,  low: 28.40, open: 28.60,  previousClose: 28.25 },
  { code: 'ALBRK', name: 'ALBARAKA TURK',         price: 18.50,  change: 0.35,   changePercent: 1.93,  volume: 8500000,  high: 18.90,  low: 18.20, open: 18.30,  previousClose: 18.15 },
  { code: 'ANACM', name: 'ANADOLU CAM',           price: 24.80,  change: 0.45,   changePercent: 1.85,  volume: 3200000,  high: 25.20,  low: 24.50, open: 24.60,  previousClose: 24.35 },
  { code: 'ANHYT', name: 'ANADOLU HAYAT',         price: 68.50,  change: 1.20,   changePercent: 1.78,  volume: 1800000,  high: 69.50,  low: 67.80, open: 68.00,  previousClose: 67.30 },
  { code: 'ANSGR', name: 'ANADOLU SIGORTA',       price: 125.00, change: 2.25,   changePercent: 1.83,  volume: 420000,   high: 127.50, low: 123.50, open: 124.50, previousClose: 122.75 },
  { code: 'ASUZU', name: 'ANADOLU ISUZU',         price: 385.00, change: 6.50,   changePercent: 1.72,  volume: 280000,   high: 392.00, low: 382.00, open: 383.00, previousClose: 378.50 },
  { code: 'AYDEM', name: 'AYDEM ENERJI',          price: 38.20,  change: 0.65,   changePercent: 1.73,  volume: 4200000,  high: 38.90,  low: 37.80, open: 38.00,  previousClose: 37.55 },
  { code: 'BAGFS', name: 'BAGFAS GUBRE',          price: 285.00, change: 4.50,   changePercent: 1.60,  volume: 120000,   high: 290.00, low: 282.00, open: 283.50, previousClose: 280.50 },
  { code: 'BJKAS', name: 'BESIKTAS JK',           price: 68.50,  change: 1.50,   changePercent: 2.24,  volume: 5500000,  high: 70.50,  low: 67.50, open: 68.00,  previousClose: 67.00 },
  { code: 'BTCIM', name: 'BATI CIMENTO',          price: 92.50,  change: 1.50,   changePercent: 1.65,  volume: 650000,   high: 94.00,  low: 91.50, open: 92.00,  previousClose: 91.00 },
  { code: 'CLEBI', name: 'CELEBI HAVA SERVISI',   price: 245.00, change: 4.00,   changePercent: 1.66,  volume: 350000,   high: 249.00, low: 242.00, open: 243.00, previousClose: 241.00 },
  { code: 'DOAS',  name: 'DOGUS OTOMOTIV',        price: 248.50, change: -3.50,  changePercent: -1.39, volume: 1200000,  high: 253.00, low: 247.00, open: 252.00, previousClose: 252.00 },
  { code: 'ECILC', name: 'ECZACIBASI ILAC',       price: 32.50,  change: 0.55,   changePercent: 1.72,  volume: 4500000,  high: 33.20,  low: 32.10, open: 32.20,  previousClose: 31.95 },
  { code: 'EGEEN', name: 'EGE ENDUSTRI',          price: 1285.00,change: 22.00,  changePercent: 1.74,  volume: 85000,    high: 1310.00,low: 1275.00,open: 1280.00,previousClose: 1263.00 },
  { code: 'EKGYO', name: 'EMLAK KONUT GYO',       price: 22.80,  change: 0.40,   changePercent: 1.79,  volume: 42000000, high: 23.20,  low: 22.50, open: 22.60,  previousClose: 22.40 },
  { code: 'EUPWR', name: 'EUROPOWER ENERJI',      price: 28.50,  change: 0.50,   changePercent: 1.79,  volume: 2800000,  high: 29.00,  low: 28.20, open: 28.30,  previousClose: 28.00 },
  { code: 'GLYHO', name: 'GLOBAL YATIRIM HOLDING',price: 52.50,  change: 0.90,   changePercent: 1.74,  volume: 3500000,  high: 53.50,  low: 52.00, open: 52.20,  previousClose: 51.60 },
  { code: 'GSRAY', name: 'GALATASARAY',           price: 185.50, change: 4.50,   changePercent: 2.49,  volume: 12000000, high: 190.00, low: 183.00, open: 184.00, previousClose: 181.00 },
  { code: 'INDES', name: 'INDEKS BILGISAYAR',     price: 128.50, change: 2.20,   changePercent: 1.74,  volume: 580000,   high: 130.50, low: 127.00, open: 127.50, previousClose: 126.30 },
  { code: 'ISGYO', name: 'IS GYO',                price: 18.50,  change: 0.32,   changePercent: 1.76,  volume: 12000000, high: 18.90,  low: 18.30, open: 18.35,  previousClose: 18.18 },
  { code: 'JANTS', name: 'JANTSA JANT',           price: 285.00, change: 5.00,   changePercent: 1.79,  volume: 180000,   high: 291.00, low: 282.00, open: 283.00, previousClose: 280.00 },
  { code: 'KLNMA', name: 'KALKINMA YAT. BANKASI', price: 28.50,  change: 0.50,   changePercent: 1.79,  volume: 2500000,  high: 29.00,  low: 28.20, open: 28.30,  previousClose: 28.00 },
  { code: 'KORDS', name: 'KORDSA',                price: 92.50,  change: 1.60,   changePercent: 1.76,  volume: 1200000,  high: 94.00,  low: 91.50, open: 92.00,  previousClose: 90.90 },
  { code: 'KOTON', name: 'KOTON MAGAZACILIK',     price: 125.00, change: 2.25,   changePercent: 1.83,  volume: 450000,   high: 127.50, low: 123.50, open: 124.00, previousClose: 122.75 },
  { code: 'MAVI',  name: 'MAVI GIYIM',            price: 285.00, change: 5.00,   changePercent: 1.79,  volume: 850000,   high: 290.00, low: 282.00, open: 283.00, previousClose: 280.00 },
  { code: 'MERCN', name: 'MERCAN KIMYA',          price: 68.50,  change: 1.20,   changePercent: 1.78,  volume: 850000,   high: 69.80,  low: 67.80, open: 68.00,  previousClose: 67.30 },
  { code: 'NETAS', name: 'NETAS TELEKOMUNIKASYON',price: 185.00, change: 3.20,   changePercent: 1.76,  volume: 420000,   high: 188.50, low: 183.00, open: 184.00, previousClose: 181.80 },
  { code: 'NUHCM', name: 'NUH CIMENTO',           price: 125.00, change: 2.10,   changePercent: 1.71,  volume: 1800000,  high: 127.50, low: 123.50, open: 124.00, previousClose: 122.90 },
  { code: 'ORGE',  name: 'ORGE ENERJI',           price: 48.50,  change: 0.85,   changePercent: 1.78,  volume: 1200000,  high: 49.30,  low: 48.00, open: 48.20,  previousClose: 47.65 },
  { code: 'SOKM',  name: 'SOK MARKETLER',         price: 62.50,  change: 1.10,   changePercent: 1.79,  volume: 8500000,  high: 63.50,  low: 61.80, open: 62.00,  previousClose: 61.40 },
  { code: 'SAMAT', name: 'SARAY MATBAACILIK',     price: 28.50,  change: 0.50,   changePercent: 1.79,  volume: 2500000,  high: 29.00,  low: 28.20, open: 28.30,  previousClose: 28.00 },
  { code: 'TATGD', name: 'TAT GIDA',              price: 38.50,  change: 0.65,   changePercent: 1.72,  volume: 3500000,  high: 39.20,  low: 38.10, open: 38.20,  previousClose: 37.85 },
  { code: 'TBORG', name: 'TURK TUBORG',           price: 285.00, change: 4.50,   changePercent: 1.60,  volume: 180000,   high: 290.00, low: 282.00, open: 283.00, previousClose: 280.50 },
  { code: 'TKFEN', name: 'TEKFEN HOLDING',        price: 92.50,  change: 1.60,   changePercent: 1.76,  volume: 2500000,  high: 94.00,  low: 91.50, open: 92.00,  previousClose: 90.90 },
  { code: 'TKNSA', name: 'TEKNOSA',               price: 45.50,  change: 0.80,   changePercent: 1.79,  volume: 1800000,  high: 46.30,  low: 45.00, open: 45.20,  previousClose: 44.70 },
  { code: 'TTKOM', name: 'TURK TELEKOM',          price: 42.50,  change: 0.72,   changePercent: 1.72,  volume: 28000000, high: 43.20,  low: 42.00, open: 42.10,  previousClose: 41.78 },
  { code: 'TRGYO', name: 'TORUNLAR GYO',          price: 35.20,  change: 0.60,   changePercent: 1.73,  volume: 5500000,  high: 35.80,  low: 34.90, open: 35.00,  previousClose: 34.60 },
  { code: 'WENTO', name: 'WENTO ENERJI',          price: 18.50,  change: 0.32,   changePercent: 1.76,  volume: 4500000,  high: 18.90,  low: 18.20, open: 18.30,  previousClose: 18.18 },
];

// ─── Module-level cache ──────────────────────────────────────────────────────
let cachedStocks: StockData[] = [];
let lastFetchTime = 0;
const CACHE_DURATION = 60 * 1000; // 60 saniye

// ─── Twelve Data batch fetch ─────────────────────────────────────────────────
async function fetchFromTwelveData(): Promise<StockData[]> {
  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!apiKey) throw new Error('TWELVE_DATA_API_KEY eksik');

  // Twelve Data: BIST sembolleri :XIST son ekiyle gönderilir
  const symbolList = FALLBACK_STOCKS.map(s => `${s.code}:XIST`).join(',');
  const url = `https://api.twelvedata.com/quote?symbol=${symbolList}&apikey=${apiKey}`;

  const res = await fetch(url, { next: { revalidate: 60 } });
  if (!res.ok) throw new Error(`Twelve Data HTTP ${res.status}`);

  const json = await res.json();

  // Tek sembol → obje, çoklu → { SYMBOL: obje, ... }
  const quotes: Record<string, Record<string, string>> =
    FALLBACK_STOCKS.length === 1 ? { [FALLBACK_STOCKS[0].code]: json } : json;

  const merged = FALLBACK_STOCKS.map(fallback => {
    const q = quotes[fallback.code];
    if (!q || q.status === 'error' || !q.close) return fallback;

    const price         = parseFloat(q.close)          || fallback.price;
    const change        = parseFloat(q.change)         || fallback.change;
    const changePercent = parseFloat(q.percent_change) || fallback.changePercent;
    const volume        = parseInt(q.volume ?? '0')    || fallback.volume;
    const high          = parseFloat(q.high)           || fallback.high;
    const low           = parseFloat(q.low)            || fallback.low;
    const open          = parseFloat(q.open)           || fallback.open;
    const previousClose = parseFloat(q.previous_close) || fallback.previousClose;

    return { ...fallback, price, change, changePercent, volume, high, low, open, previousClose };
  });

  return merged;
}

// ─── Ana fetch fonksiyonu (cache + fallback) ─────────────────────────────────
export async function fetchBistStocks(): Promise<StockData[]> {
  const now = Date.now();

  if (cachedStocks.length > 0 && now - lastFetchTime < CACHE_DURATION) {
    return cachedStocks;
  }

  try {
    const stocks = await fetchFromTwelveData();
    cachedStocks = stocks;
    lastFetchTime = now;
    return stocks;
  } catch (err) {
    console.warn('Twelve Data fetch başarısız, fallback kullanılıyor:', err);
    if (cachedStocks.length === 0) {
      cachedStocks = FALLBACK_STOCKS;
      lastFetchTime = now;
    }
    return cachedStocks;
  }
}
