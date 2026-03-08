import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { cookies } from 'next/headers';

const prisma = new PrismaClient();

// Avatar renkleri
const AVATAR_COLORS = [
  'emerald', 'cyan', 'violet', 'amber', 'rose', 
  'blue', 'green', 'purple', 'orange', 'pink'
];

function getRandomAvatarColor() {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

// GET - Mevcut kullanıcıyı getir
export async function GET() {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('userId')?.value;

    if (!userId) {
      return NextResponse.json({ success: false, user: null });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        rumuz: true,
        avatar: true,
        createdAt: true,
        _count: {
          select: {
            watchlist: true,
            alerts: true,
          }
        }
      }
    });

    if (!user) {
      return NextResponse.json({ success: false, user: null });
    }

    return NextResponse.json({ 
      success: true, 
      user: {
        ...user,
        watchlistCount: user._count.watchlist,
        alertsCount: user._count.alerts,
      }
    });
  } catch (error) {
    console.error('Auth GET error:', error);
    return NextResponse.json({ success: false, error: 'Sunucu hatası' }, { status: 500 });
  }
}

// POST - Giriş veya Kayıt
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { rumuz, action } = body; // action: 'login' | 'register'

    if (!rumuz || rumuz.trim().length < 2 || rumuz.trim().length > 20) {
      return NextResponse.json({ 
        success: false, 
        error: 'Rumuz 2-20 karakter arasında olmalıdır' 
      }, { status: 400 });
    }

    // Rumuz formatı kontrolü (sadece harf, rakam ve alt çizgi)
    const rumuzRegex = /^[a-zA-Z0-9_ğüşıöçĞÜŞİÖÇ]+$/;
    if (!rumuzRegex.test(rumuz)) {
      return NextResponse.json({ 
        success: false, 
        error: 'Rumuz sadece harf, rakam ve alt çizgi içerebilir' 
      }, { status: 400 });
    }

    const normalizedRumuz = rumuz.trim().toLowerCase();
    
    // Kullanıcıyı ara
    let user = await prisma.user.findUnique({
      where: { rumuz: normalizedRumuz }
    });

    if (action === 'register') {
      if (user) {
        return NextResponse.json({ 
          success: false, 
          error: 'Bu rumuz zaten kullanılıyor' 
        }, { status: 400 });
      }

      // Yeni kullanıcı oluştur
      user = await prisma.user.create({
        data: {
          rumuz: normalizedRumuz,
          avatar: getRandomAvatarColor(),
        }
      });
    } else {
      // Login
      if (!user) {
        return NextResponse.json({ 
          success: false, 
          error: 'Bu rumuz ile kayıtlı kullanıcı bulunamadı' 
        }, { status: 404 });
      }
    }

    // Cookie ayarla (7 gün geçerli)
    const cookieStore = await cookies();
    cookieStore.set('userId', user.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 gün
      path: '/',
    });

    // Kullanıcı istatistikleri
    const stats = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        _count: {
          select: {
            watchlist: true,
            alerts: true,
          }
        }
      }
    });

    return NextResponse.json({ 
      success: true, 
      user: {
        id: user.id,
        rumuz: user.rumuz,
        avatar: user.avatar,
        createdAt: user.createdAt,
        watchlistCount: stats?._count.watchlist || 0,
        alertsCount: stats?._count.alerts || 0,
      },
      message: action === 'register' ? 'Hoş geldiniz! Hesabınız oluşturuldu.' : 'Tekrar hoş geldiniz!'
    });

  } catch (error) {
    console.error('Auth POST error:', error);
    return NextResponse.json({ success: false, error: 'Sunucu hatası' }, { status: 500 });
  }
}

// DELETE - Çıkış yap
export async function DELETE() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete('userId');
    
    return NextResponse.json({ 
      success: true, 
      message: 'Çıkış yapıldı' 
    });
  } catch (error) {
    console.error('Auth DELETE error:', error);
    return NextResponse.json({ success: false, error: 'Sunucu hatası' }, { status: 500 });
  }
}
