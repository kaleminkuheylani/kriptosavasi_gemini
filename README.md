# CoinMarketCap Tabanli Kripto Analiz Platformu

Canli kripto para piyasasini CoinMarketCap API ile takip eden, tarama ve analiz odakli Next.js uygulamasi.

Bu proje yatirim tavsiyesi vermez; tum icerik egitim ve arastirma amaclidir.

## Ozellikler

- CoinMarketCap API ile canli piyasa verisi (top coin listing + global market metrics)
- Gelismis tarama: arama, tag, risk seviyesi, min market cap/hacim filtreleri
- Analiz skor sistemi:
  - Momentum skoru
  - Volatilite skoru
  - Likidite skoru
  - Risk seviyesi
  - AL/BEKLE/SAT sinyali
- Coin karsilastirma araci (24s / 7g performans + momentum)
- Piyasa geneli metrikler:
  - Toplam market cap
  - 24s hacim
  - BTC/ETH dominance
  - Yukselen/dusen dagilimi

## Teknoloji Yigini

- Next.js 16 (App Router)
- TypeScript 5
- Tailwind CSS 4 + shadcn/ui
- Recharts

## Kurulum

```bash
# Bagimliliklari yukle
npm install

# Gelistirme sunucusunu baslat
npm run dev
```

Uygulama varsayilan olarak `http://localhost:3000` adresinde calisir.

## Ortam Degiskenleri

`.env` dosyasinda en az su degisken olmali:

```env
COINMARKETCAP_API_KEY="your-coinmarketcap-pro-api-key"
```

Not:
- Alternatif olarak `CMC_API_KEY` de okunur.
- CoinMarketCap Pro API gereklidir (ucretsiz planda limitli istek hakki vardir).

## API Endpointleri

| Endpoint | Method | Aciklama |
|----------|--------|----------|
| `/api/crypto` | GET | CoinMarketCap verileri + analiz skorlamasi + filtre/siralama |

### `/api/crypto` Query Parametreleri

- `limit` (10-200, varsayilan: 100)
- `convert` (varsayilan: USD)
- `query` (symbol/name arama)
- `tag` (coin tag filtre)
- `risk` (`all`, `low`, `medium`, `high`)
- `minMarketCap` (USD)
- `minVolume24h` (USD)
- `sortBy` (`marketCap`, `volume24h`, `percentChange24h`, `percentChange7d`, `momentumScore`, `volatilityScore`, `liquidityScore`, `rank`)
- `sortDir` (`asc`, `desc`)

## Lisans

MIT
