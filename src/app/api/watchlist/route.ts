import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - Watchlist'i getir
export async function GET() {
  try {
    const watchlist = await db.watchlistItem.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      success: true,
      data: watchlist,
    });
  } catch (error) {
    console.error('Watchlist fetch error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Takip listesi alınamadı',
      data: [],
    }, { status: 500 });
  }
}

// POST - Watchlist'e ekle
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { symbol, name, targetPrice } = body;

    if (!symbol || !name) {
      return NextResponse.json({
        success: false,
        error: 'Hisse kodu ve adı gerekli',
      }, { status: 400 });
    }

    // Zaten var mı kontrol et
    const existing = await db.watchlistItem.findFirst({
      where: { symbol: symbol.toUpperCase() },
    });

    if (existing) {
      return NextResponse.json({
        success: false,
        error: 'Bu hisse zaten takip listesinde',
        data: existing,
      }, { status: 400 });
    }

    const item = await db.watchlistItem.create({
      data: {
        symbol: symbol.toUpperCase(),
        name,
        targetPrice: targetPrice ? parseFloat(targetPrice) : null,
      },
    });

    return NextResponse.json({
      success: true,
      data: item,
      message: 'Takip listesine eklendi',
    });
  } catch (error) {
    console.error('Watchlist add error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Takip listesine eklenemedi',
    }, { status: 500 });
  }
}

// DELETE - Watchlist'ten kaldır
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const symbol = searchParams.get('symbol');

    if (!id && !symbol) {
      return NextResponse.json({
        success: false,
        error: 'ID veya sembol gerekli',
      }, { status: 400 });
    }

    if (id) {
      await db.watchlistItem.delete({
        where: { id },
      });
    } else if (symbol) {
      await db.watchlistItem.deleteMany({
        where: { symbol: symbol.toUpperCase() },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Takip listesinden kaldırıldı',
    });
  } catch (error) {
    console.error('Watchlist remove error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Takip listesinden kaldırılamadı',
    }, { status: 500 });
  }
}

// PUT - Watchlist güncelle (hedef fiyat)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, targetPrice } = body;

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'ID gerekli',
      }, { status: 400 });
    }

    const item = await db.watchlistItem.update({
      where: { id },
      data: {
        targetPrice: targetPrice ? parseFloat(targetPrice) : null,
      },
    });

    return NextResponse.json({
      success: true,
      data: item,
      message: 'Güncellendi',
    });
  } catch (error) {
    console.error('Watchlist update error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Güncellenemedi',
    }, { status: 500 });
  }
}
