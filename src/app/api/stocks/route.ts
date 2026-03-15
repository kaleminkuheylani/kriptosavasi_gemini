import { NextResponse } from 'next/server';
import { fetchBistStocks } from '@/lib/bist-stocks';

export async function GET() {
  const stocks = await fetchBistStocks();

  return NextResponse.json({
    success: true,
    data: stocks,
    count: stocks.length,
    timestamp: new Date().toISOString(),
    source: process.env.NOSYAPI_API_KEY
      ? 'nosyapi'
      : process.env.TWELVE_DATA_API_KEY
        ? 'twelvedata'
        : 'fallback',
  });
}
