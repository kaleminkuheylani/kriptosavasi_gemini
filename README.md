# BIST 100 AI Finans Asistani

BIST 100 hisse senetleri icin yapay zeka destekli finansal analiz platformu.

## Ozellikler

### Hisse Senedi Analizi
- Canli BIST 100 hisse fiyatlari
- Gecmis fiyat verileri ve grafikler
- Teknik analiz gostergeleri (SMA, trend)
- AI destekli grafik analizi (VLM)

### AI Finans Asistani
- 15 farkli AI araci
- Hisse fiyati sorgulama
- Piyasa tarama
- KAP bildirimleri
- Web aramasi
- TXT dosya analizi
- Grafik resim analizi

### Kullanici Sistemi
- Rumuz ile kayit/giris (sifresiz)
- Kisisel takip listesi
- Fiyat bildirimleri
- 7 gunluk oturum

### Veri Kaynaklari
- Asenax API (canli hisse verileri)
- Finance API (gecmis veriler)
- Groq API (LLM)
- z-ai-web-dev-sdk (VLM, web arama)

## Teknoloji Yigini

- Next.js 16 (App Router)
- TypeScript 5
- Tailwind CSS 4
- shadcn/ui
- Prisma ORM + SQLite
- Recharts (grafikler)
- z-ai-web-dev-sdk

## Kurulum

```bash
# Bagimliliklari yukle
bun install

# Veritabani olustur
bun run db:push

# Gelistirme sunucusunu baslat
bun run dev
```

Uygulama http://localhost:3000 adresinde calisacaktir.

## API Endpointleri

| Endpoint | Method | Aciklama |
|----------|--------|----------|
| /api/stocks | GET | Tum hisseleri listele |
| /api/stocks/[symbol] | GET | Hisse detayi ve grafik |
| /api/auth | GET/POST/DELETE | Kullanici islemleri |
| /api/watchlist | CRUD | Takip listesi |
| /api/alerts | CRUD | Fiyat bildirimleri |
| /api/agent | POST | AI Agent |

## AI Agent Araclari

1. get_stock_price - Hisse fiyati
2. get_stock_history - Gecmis veriler
3. get_watchlist - Takip listesi
4. add_to_watchlist - Listeye ekle
5. remove_from_watchlist - Listeden kaldir
6. web_search - Web aramasi
7. read_document - Dokuman okuma
8. read_txt_file - TXT analizi
9. get_kap_data - KAP bildirimleri
10. scan_market - Piyasa tarama
11. get_top_gainers - Yukselenler
12. get_top_losers - Dusenler
13. get_price_alerts - Bildirimler
14. create_price_alert - Bildirim olustur
15. analyze_chart_image - Grafik analizi

## Proje Yapisi

```
src/
├── app/
│   ├── api/
│   │   ├── agent/route.ts      # AI Agent
│   │   ├── auth/route.ts       # Kimlik dogrulama
│   │   ├── alerts/route.ts     # Bildirimler
│   │   ├── watchlist/route.ts  # Takip listesi
│   │   └── stocks/             # Hisse verileri
│   └── page.tsx                # Ana sayfa
├── components/ui/              # shadcn/ui bilesenleri
├── hooks/                      # React hooklari
└── lib/                        # Yardimci fonksiyonlar

prisma/
└── schema.prisma               # Veritabani semasi
```

## Ortam Degiskenleri

.env dosyasinda:
```
DATABASE_URL="file:./db/custom.db"
GROQ_API_KEY="your-groq-api-key"
```

## Lisans

MIT
