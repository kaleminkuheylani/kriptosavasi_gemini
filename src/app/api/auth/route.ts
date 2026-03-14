import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabase, serverClient } from '@/lib/supabase';

// ── Validation helpers ──────────────────────────────────────────────────────

function validateEmail(email: string): string | null {
  if (!email || email.length > 254) return 'Geçerli bir e-posta adresi girin';
  const re = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  return re.test(email) ? null : 'Geçerli bir e-posta adresi girin';
}

function validatePassword(password: string): string | null {
  if (!password || password.length < 8) return 'Şifre en az 8 karakter olmalı';
  if (!/[A-Za-z]/.test(password)) return 'Şifre en az bir harf içermeli';
  if (!/[0-9]/.test(password)) return 'Şifre en az bir rakam içermeli';
  return null;
}

const COOKIE_ACCESS  = 'sb-access-token';
const COOKIE_REFRESH = 'sb-refresh-token';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

async function setSessionCookies(accessToken: string, refreshToken: string) {
  const cs = await cookies();
  const opts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  };
  cs.set(COOKIE_ACCESS,  accessToken,  opts);
  cs.set(COOKIE_REFRESH, refreshToken, opts);
}

async function clearSessionCookies() {
  const cs = await cookies();
  cs.delete(COOKIE_ACCESS);
  cs.delete(COOKIE_REFRESH);
}

export async function getAccessToken(): Promise<string | null> {
  const cs = await cookies();
  return cs.get(COOKIE_ACCESS)?.value ?? null;
}

// ── GET  – return current user ──────────────────────────────────────────────

export async function GET() {
  try {
    const token = await getAccessToken();
    if (!token) return NextResponse.json({ success: false, user: null });

    const sb = serverClient(token);
    const { data: { user }, error } = await sb.auth.getUser();

    if (error || !user) {
      await clearSessionCookies();
      return NextResponse.json({ success: false, user: null });
    }

    const today = new Date().toISOString().slice(0, 10);

    const [wl, al, usageRow] = await Promise.all([
      sb.from('watchlist_items').select('id', { count: 'exact', head: true }),
      sb.from('price_alerts').select('id', { count: 'exact', head: true }).eq('active', true),
      sb.from('user_usage')
        .select('request_count, token_count')
        .eq('user_id', user.id)
        .eq('date', today)
        .maybeSingle(),
    ]);

    const rumuz = user.user_metadata?.rumuz ?? user.email!.split('@')[0];
    const avatar = user.user_metadata?.avatar ?? 'emerald';

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        rumuz,
        avatar,
        createdAt: user.created_at,
        watchlistCount: wl.count ?? 0,
        alertsCount:    al.count ?? 0,
        usage: {
          todayRequests: usageRow.data?.request_count ?? 0,
          todayTokens:   usageRow.data?.token_count   ?? 0,
        },
      },
    });
  } catch (err) {
    console.error('Auth GET error:', err);
    return NextResponse.json({ success: false, error: 'Sunucu hatası' }, { status: 500 });
  }
}

// ── POST – login / register ─────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, action } = body as {
      email: string;
      password: string;
      action: 'login' | 'register';
    };

    // Validation
    const emailErr = validateEmail(email?.trim());
    if (emailErr) return NextResponse.json({ success: false, error: emailErr }, { status: 400 });

    const passErr = validatePassword(password);
    if (passErr)  return NextResponse.json({ success: false, error: passErr  }, { status: 400 });

    const normalizedEmail = email.trim().toLowerCase();

    if (action === 'register') {
      const rumuz = normalizedEmail.split('@')[0].replace(/[^a-zA-Z0-9_ğüşıöçĞÜŞİÖÇ]/g, '').slice(0, 20);
      const avatars = ['emerald','cyan','violet','amber','rose','blue','green','purple','orange','pink'];
      const avatar  = avatars[Math.floor(Math.random() * avatars.length)];

      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: { data: { rumuz, avatar } },
      });

      if (error) {
        const msg = error.message.includes('already registered')
          ? 'Bu e-posta zaten kayıtlı. Giriş yapmayı deneyin.'
          : error.message;
        return NextResponse.json({ success: false, error: msg }, { status: 400 });
      }

      // When email confirmation is ON in Supabase, session is null
      if (!data.session) {
        return NextResponse.json({
          success: true,
          requiresConfirmation: true,
          message: 'Kayıt başarılı! E-posta adresinize doğrulama linki gönderildi.',
        });
      }

      await setSessionCookies(data.session.access_token, data.session.refresh_token);

      return NextResponse.json({
        success: true,
        user: {
          id: data.user!.id,
          email: data.user!.email,
          rumuz,
          avatar,
          createdAt: data.user!.created_at,
          watchlistCount: 0,
          alertsCount: 0,
          usage: { todayRequests: 0, todayTokens: 0 },
        },
        message: 'Hoş geldiniz! Hesabınız oluşturuldu.',
      });
    }

    // LOGIN
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error) {
      const msg = error.message.includes('Invalid login')
        ? 'E-posta veya şifre hatalı.'
        : error.message;
      return NextResponse.json({ success: false, error: msg }, { status: 401 });
    }

    await setSessionCookies(data.session.access_token, data.session.refresh_token);

    const sb = serverClient(data.session.access_token);
    const today = new Date().toISOString().slice(0, 10);
    const [wl, al, usageRow] = await Promise.all([
      sb.from('watchlist_items').select('id', { count: 'exact', head: true }),
      sb.from('price_alerts').select('id', { count: 'exact', head: true }).eq('active', true),
      sb.from('user_usage')
        .select('request_count, token_count')
        .eq('user_id', data.user.id)
        .eq('date', today)
        .maybeSingle(),
    ]);

    const rumuz = data.user.user_metadata?.rumuz ?? data.user.email!.split('@')[0];
    const avatar = data.user.user_metadata?.avatar ?? 'emerald';

    return NextResponse.json({
      success: true,
      user: {
        id:    data.user.id,
        email: data.user.email,
        rumuz,
        avatar,
        createdAt: data.user.created_at,
        watchlistCount: wl.count ?? 0,
        alertsCount:    al.count ?? 0,
        usage: {
          todayRequests: usageRow.data?.request_count ?? 0,
          todayTokens:   usageRow.data?.token_count   ?? 0,
        },
      },
      message: 'Tekrar hoş geldiniz!',
    });
  } catch (err) {
    console.error('Auth POST error:', err);
    return NextResponse.json({ success: false, error: 'Sunucu hatası' }, { status: 500 });
  }
}

// ── DELETE – logout ─────────────────────────────────────────────────────────

export async function DELETE() {
  try {
    const token = await getAccessToken();
    if (token) {
      const sb = serverClient(token);
      await sb.auth.signOut();
    }
    await clearSessionCookies();
    return NextResponse.json({ success: true, message: 'Çıkış yapıldı' });
  } catch (err) {
    console.error('Auth DELETE error:', err);
    return NextResponse.json({ success: false, error: 'Sunucu hatası' }, { status: 500 });
  }
}
