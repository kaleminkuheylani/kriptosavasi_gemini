import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - Tüm bildirimleri getir
export async function GET() {
  try {
    const alerts = await db.priceAlert.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      success: true,
      data: alerts,
    });
  } catch (error) {
    console.error('Alerts fetch error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Bildirimler alınamadı',
      data: [],
    }, { status: 500 });
  }
}

// POST - Yeni bildirim oluştur
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { symbol, targetPrice, condition } = body;

    if (!symbol || !targetPrice || !condition) {
      return NextResponse.json({
        success: false,
        error: 'Hisse kodu, hedef fiyat ve koşul gerekli',
      }, { status: 400 });
    }

    if (condition !== 'above' && condition !== 'below') {
      return NextResponse.json({
        success: false,
        error: 'Koşul "above" veya "below" olmalı',
      }, { status: 400 });
    }

    const alert = await db.priceAlert.create({
      data: {
        symbol: symbol.toUpperCase(),
        targetPrice: parseFloat(targetPrice),
        condition,
        active: true,
        triggered: false,
      },
    });

    return NextResponse.json({
      success: true,
      data: alert,
      message: 'Bildirim oluşturuldu',
    });
  } catch (error) {
    console.error('Alert create error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Bildirim oluşturulamadı',
    }, { status: 500 });
  }
}

// PUT - Bildirim güncelle
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, active, triggered } = body;

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'ID gerekli',
      }, { status: 400 });
    }

    const updateData: { active?: boolean; triggered?: boolean } = {};
    if (typeof active === 'boolean') updateData.active = active;
    if (typeof triggered === 'boolean') updateData.triggered = triggered;

    const alert = await db.priceAlert.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: alert,
      message: 'Bildirim güncellendi',
    });
  } catch (error) {
    console.error('Alert update error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Bildirim güncellenemedi',
    }, { status: 500 });
  }
}

// DELETE - Bildirim sil
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'ID gerekli',
      }, { status: 400 });
    }

    await db.priceAlert.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Bildirim silindi',
    });
  } catch (error) {
    console.error('Alert delete error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Bildirim silinemedi',
    }, { status: 500 });
  }
}
