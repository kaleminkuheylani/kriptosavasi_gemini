import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSupabaseConfigIssue, supabase, serverClient } from '@/lib/supabase';

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

function buildRumuzFromEmail(email: string): string {
  const prefix = email
    .split('@')[0]
    .replace(/[^a-zA-Z0-9_ğüşıöçĞÜŞİÖÇ]/g, '')
    .slice(0, 20);

  if (prefix) return prefix;
  return `kullanici_${Math.floor(Math.random() * 100000)}`;
}

function pickRandomAvatar(): string {
  const avatars = ['emerald', 'cyan', 'violet', 'amber', 'rose', 'blue', 'green', 'purple', 'orange', 'pink'];
  return avatars[Math.floor(Math.random() * avatars.length)];
}

function mapSupabaseErrorMessage(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('fetch failed') || lower.includes('failed to fetch') || lower.includes('network')) {
    return 'Supabase bağlantısı kurulamadı. Lütfen ortam değişkenlerini ve ağ bağlantısını kontrol edin.';
  }
  if (lower.includes('invalid api key') || lower.includes('apikey')) {
    return 'Supabase API anahtarı geçersiz görünüyor. Ortam değişkenlerini kontrol edin.';
  }
  return message;
}

async function resendSignupVerificationCode(email: string): Promise<void> {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
  });
  if (error) throw error;
}

const COOKIE_ACCESS  = 'sb-access-token';
const COOKIE_REFRESH = 'sb-refresh-token';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const authRateStore = new Map<string, number[]>();

function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return 'unknown';
}

function consumeRateLimit(key: string, limit: number, windowMs: number): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const existing = authRateStore.get(key) ?? [];
  const recent = existing.filter((ts) => now - ts < windowMs);

  if (recent.length >= limit) {
    const oldestTs = recent[0] ?? now;
    const retryAfterSeconds = Math.max(1, Math.ceil((windowMs - (now - oldestTs)) / 1000));
    authRateStore.set(key, recent);
    return { allowed: false, retryAfterSeconds };
  }

  recent.push(now);
  authRateStore.set(key, recent);
  return { allowed: true, retryAfterSeconds: 0 };
}

function rateLimitJsonResponse(message: string, retryAfterSeconds: number) {
  return NextResponse.json(
    {
      success: false,
      error: message,
      retryAfterSeconds,
    },
    {
      status: 429,
      headers: { 'Retry-After': String(retryAfterSeconds) },
    }
  );
}

function applyResendRateLimit(email: string, clientIp: string): { allowed: boolean; retryAfterSeconds: number } {
  const byEmail = consumeRateLimit(`auth:resend:email:${email}`, 3, RATE_LIMIT_WINDOW_MS);
  if (!byEmail.allowed) return byEmail;
  const byIp = consumeRateLimit(`auth:resend:ip:${clientIp}`, 8, RATE_LIMIT_WINDOW_MS);
  return byIp;
}

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
    const configIssue = getSupabaseConfigIssue();
    if (configIssue) {
      return NextResponse.json({ success: false, user: null, error: configIssue }, { status: 503 });
    }

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
    const configIssue = getSupabaseConfigIssue();
    if (configIssue) {
      return NextResponse.json({ success: false, error: configIssue }, { status: 503 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Geçersiz istek gövdesi' }, { status: 400 });
    }

    const { email, password, action } = (body ?? {}) as {
      email?: string;
      password?: string;
      action?: 'login' | 'register' | 'resend_verification';
    };

    if (action !== 'login' && action !== 'register' && action !== 'resend_verification') {
      return NextResponse.json({ success: false, error: 'Geçersiz işlem türü' }, { status: 400 });
    }

    const clientIp = getClientIp(request);
    const globalLimit = consumeRateLimit(`auth:global:${clientIp}`, 40, RATE_LIMIT_WINDOW_MS);
    if (!globalLimit.allowed) {
      return rateLimitJsonResponse(
        'Çok fazla doğrulama isteği gönderdiniz. Lütfen biraz bekleyin.',
        globalLimit.retryAfterSeconds
      );
    }

    // Validation
    const normalizedEmailInput = String(email ?? '').trim();
    const emailErr = validateEmail(normalizedEmailInput);
    if (emailErr) return NextResponse.json({ success: false, error: emailErr }, { status: 400 });

    const normalizedEmail = normalizedEmailInput.toLowerCase();

    if (action === 'resend_verification') {
      const resendLimit = applyResendRateLimit(normalizedEmail, clientIp);
      if (!resendLimit.allowed) {
        return rateLimitJsonResponse(
          'Doğrulama kodu çok sık istendi. Lütfen biraz bekleyip tekrar deneyin.',
          resendLimit.retryAfterSeconds
        );
      }
      try {
        await resendSignupVerificationCode(normalizedEmail);
        return NextResponse.json({
          success: true,
          requiresConfirmation: true,
          message: 'Doğrulama kodu e-posta adresinize gönderildi.',
        });
      } catch (resendError) {
        const msg = resendError instanceof Error
          ? mapSupabaseErrorMessage(resendError.message)
          : 'Doğrulama kodu gönderilemedi';
        return NextResponse.json({ success: false, error: msg }, { status: 400 });
      }
    }

    if (typeof password !== 'string' || password.length === 0) {
      return NextResponse.json({ success: false, error: 'Şifre gerekli' }, { status: 400 });
    }
    if (password.length > 256) {
      return NextResponse.json({ success: false, error: 'Şifre çok uzun' }, { status: 400 });
    }

    if (action === 'register') {
      const passErr = validatePassword(password);
      if (passErr) return NextResponse.json({ success: false, error: passErr }, { status: 400 });
    }

    if (action === 'register') {
      const registerLimit = consumeRateLimit(`auth:register:email:${normalizedEmail}`, 5, RATE_LIMIT_WINDOW_MS);
      if (!registerLimit.allowed) {
        return rateLimitJsonResponse(
          'Bu e-posta için çok fazla kayıt denemesi yapıldı. Lütfen biraz bekleyin.',
          registerLimit.retryAfterSeconds
        );
      }

      const rumuz = buildRumuzFromEmail(normalizedEmail);
      const avatar = pickRandomAvatar();

      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: { data: { rumuz, avatar } },
      });

      if (error) {
        const msg = error.message.toLowerCase().includes('already registered')
          ? 'Bu e-posta zaten kayıtlı. Giriş yapmayı deneyin.'
          : mapSupabaseErrorMessage(error.message);
        return NextResponse.json({ success: false, error: msg }, { status: 400 });
      }

      const signUpUser = data.user;
      const hasEmptyIdentity =
        signUpUser &&
        Array.isArray(signUpUser.identities) &&
        signUpUser.identities.length === 0;
      if (hasEmptyIdentity) {
        return NextResponse.json(
          { success: false, error: 'Bu e-posta zaten kayıtlı. Giriş yapmayı deneyin.' },
          { status: 409 }
        );
      }

      if (!signUpUser) {
        return NextResponse.json({ success: false, error: 'Kayıt tamamlanamadı' }, { status: 500 });
      }

      // When email confirmation is ON in Supabase, session is null
      if (!data.session) {
        return NextResponse.json({
          success: true,
          requiresConfirmation: true,
          message: 'Kayıt başarılı! E-posta adresinize doğrulama kodu gönderildi.',
        });
      }

      await setSessionCookies(data.session.access_token, data.session.refresh_token);

      return NextResponse.json({
        success: true,
        user: {
          id: signUpUser.id,
          email: signUpUser.email,
          rumuz,
          avatar,
          createdAt: signUpUser.created_at,
          watchlistCount: 0,
          alertsCount: 0,
          usage: { todayRequests: 0, todayTokens: 0 },
        },
        message: 'Hoş geldiniz! Hesabınız oluşturuldu.',
      });
    }

    // LOGIN
    const loginLimit = consumeRateLimit(`auth:login:email:${normalizedEmail}`, 12, RATE_LIMIT_WINDOW_MS);
    if (!loginLimit.allowed) {
      return rateLimitJsonResponse(
        'Çok fazla giriş denemesi yaptınız. Lütfen biraz bekleyip tekrar deneyin.',
        loginLimit.retryAfterSeconds
      );
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error) {
      if (error.message.toLowerCase().includes('email not confirmed')) {
        const resendLimit = applyResendRateLimit(normalizedEmail, clientIp);
        if (!resendLimit.allowed) {
          return rateLimitJsonResponse(
            'Doğrulama kodu gönderim limiti doldu. Lütfen daha sonra tekrar deneyin.',
            resendLimit.retryAfterSeconds
          );
        }

        try {
          await resendSignupVerificationCode(normalizedEmail);
        } catch (resendErr) {
          console.error('Auth resend verification error:', resendErr);
        }
        return NextResponse.json(
          {
            success: false,
            requiresConfirmation: true,
            error: 'E-posta adresiniz henüz doğrulanmamış. Doğrulama kodu e-posta adresinize tekrar gönderildi.',
          },
          { status: 403 }
        );
      }

      const msg = error.message.includes('Invalid login')
        ? 'E-posta veya şifre hatalı.'
        : mapSupabaseErrorMessage(error.message);
      return NextResponse.json({ success: false, error: msg }, { status: 401 });
    }

    if (!data.session || !data.user) {
      return NextResponse.json({ success: false, error: 'Oturum açılamadı' }, { status: 401 });
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
    const configIssue = getSupabaseConfigIssue();
    if (configIssue) {
      return NextResponse.json({ success: true, message: 'Çıkış yapıldı' });
    }

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
