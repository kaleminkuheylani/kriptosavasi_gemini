import { NextResponse } from 'next/server';

interface MacroSnapshot {
  usdTry: number;
  eurTry: number;
  gbpTry: number;
  updatedAt: string;
  source: 'open-er-api' | 'fallback';
}

const CACHE_TTL_MS = 60 * 1000;

let cachedSnapshot: MacroSnapshot | null = null;
let cachedAt = 0;

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function fallbackSnapshot(): MacroSnapshot {
  return {
    usdTry: 38,
    eurTry: 41,
    gbpTry: 48,
    updatedAt: new Date().toISOString(),
    source: 'fallback',
  };
}

async function fetchMacroSnapshot(): Promise<MacroSnapshot> {
  const now = Date.now();
  if (cachedSnapshot && now - cachedAt < CACHE_TTL_MS) {
    return cachedSnapshot;
  }

  try {
    const response = await fetch('https://open.er-api.com/v6/latest/USD', {
      cache: 'no-store',
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = (await response.json()) as { rates?: Record<string, number>; result?: string; time_last_update_utc?: string };
    if (payload.result !== 'success' || !payload.rates) {
      throw new Error('Kur servisi basarisiz');
    }

    const usdTry = toNumber(payload.rates.TRY);
    const usdEur = toNumber(payload.rates.EUR);
    const usdGbp = toNumber(payload.rates.GBP);

    if (usdTry <= 0 || usdEur <= 0 || usdGbp <= 0) {
      throw new Error('Kur verisi gecersiz');
    }

    const snapshot: MacroSnapshot = {
      usdTry,
      eurTry: usdTry / usdEur,
      gbpTry: usdTry / usdGbp,
      updatedAt: payload.time_last_update_utc ? new Date(payload.time_last_update_utc).toISOString() : new Date().toISOString(),
      source: 'open-er-api',
    };

    cachedSnapshot = snapshot;
    cachedAt = now;
    return snapshot;
  } catch {
    const snapshot = fallbackSnapshot();
    cachedSnapshot = snapshot;
    cachedAt = now;
    return snapshot;
  }
}

export async function GET() {
  const data = await fetchMacroSnapshot();
  return NextResponse.json({ success: true, data });
}
