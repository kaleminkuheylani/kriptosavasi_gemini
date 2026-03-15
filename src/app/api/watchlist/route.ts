import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { serverClient } from '@/lib/supabase';

async function getSupabaseClient() {
  const cs = await cookies();
  const token = cs.get('sb-access-token')?.value ?? null;
  return serverClient(token);
}

const SYMBOL_RE = /^[A-Z0-9.-]{1,15}$/;

function normalizeSymbol(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase();
  return SYMBOL_RE.test(normalized) ? normalized : null;
}

function normalizeName(value: unknown, fallbackSymbol: string): string {
  if (typeof value !== 'string') return fallbackSymbol;
  const normalized = value.trim();
  if (!normalized) return fallbackSymbol;
  return normalized.slice(0, 120);
}

function parseOptionalPrice(value: unknown): { value: number | null; error?: string } {
  if (value === null || value === undefined || value === '') return { value: null };
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return { value: null, error: 'Hedef fiyat geçerli bir pozitif sayı olmalı' };
  }
  return { value: parsed };
}

function isMissingTableError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === '42P01';
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === '23505';
}

// GET – Fetch watchlist
export async function GET() {
  try {
    const sb = await getSupabaseClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ success: true, data: [] });

    const { data, error } = await sb
      .from('watchlist_items')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      if (isMissingTableError(error)) {
        return NextResponse.json(
          { success: false, error: 'Takip listesi tablosu bulunamadı. SQL migration çalıştırın.' },
          { status: 503 }
        );
      }
      throw error;
    }

    return NextResponse.json({ success: true, data: (data ?? []).map(mapWatchlistItem) });
  } catch (error) {
    console.error('Watchlist fetch error:', error);
    return NextResponse.json({ success: false, error: 'Takip listesi alınamadı', data: [] }, { status: 500 });
  }
}

// POST – Add to watchlist
export async function POST(request: NextRequest) {
  try {
    const sb = await getSupabaseClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: 'Giriş yapmanız gerekli' }, { status: 401 });

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Geçersiz istek gövdesi' }, { status: 400 });
    }

    const incoming = (body ?? {}) as { symbol?: unknown; name?: unknown; targetPrice?: unknown };
    const symbol = normalizeSymbol(incoming.symbol);
    if (!symbol) {
      return NextResponse.json({ success: false, error: 'Geçerli bir hisse kodu gerekli' }, { status: 400 });
    }
    const name = normalizeName(incoming.name, symbol);
    const parsedTarget = parseOptionalPrice(incoming.targetPrice);
    if (parsedTarget.error) {
      return NextResponse.json({ success: false, error: parsedTarget.error }, { status: 400 });
    }

    // Check duplicate
    const { data: existing, error: existingErr } = await sb
      .from('watchlist_items')
      .select('id')
      .eq('user_id', user.id)
      .eq('symbol', symbol)
      .maybeSingle();

    if (existingErr) {
      if (isMissingTableError(existingErr)) {
        return NextResponse.json(
          { success: false, error: 'Takip listesi tablosu bulunamadı. SQL migration çalıştırın.' },
          { status: 503 }
        );
      }
      throw existingErr;
    }

    if (existing) {
      return NextResponse.json({ success: false, error: 'Bu hisse zaten takip listesinde' }, { status: 400 });
    }

    const { data, error } = await sb
      .from('watchlist_items')
      .insert({
        user_id:      user.id,
        symbol,
        name,
        target_price: parsedTarget.value,
      })
      .select()
      .single();

    if (error) {
      if (isUniqueViolation(error)) {
        return NextResponse.json({ success: false, error: 'Bu hisse zaten takip listesinde' }, { status: 409 });
      }
      if (isMissingTableError(error)) {
        return NextResponse.json(
          { success: false, error: 'Takip listesi tablosu bulunamadı. SQL migration çalıştırın.' },
          { status: 503 }
        );
      }
      throw error;
    }

    // Map snake_case → camelCase for frontend compatibility
    return NextResponse.json({
      success: true,
      data: mapWatchlistItem(data),
      message: 'Takip listesine eklendi',
    });
  } catch (error) {
    console.error('Watchlist add error:', error);
    return NextResponse.json({ success: false, error: 'Takip listesine eklenemedi' }, { status: 500 });
  }
}

// DELETE – Remove from watchlist
export async function DELETE(request: NextRequest) {
  try {
    const sb = await getSupabaseClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: 'Giriş yapmanız gerekli' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id')?.trim();
    const symbol = searchParams.get('symbol');

    if (!id && !symbol) {
      return NextResponse.json({ success: false, error: 'ID veya sembol gerekli' }, { status: 400 });
    }

    let query = sb.from('watchlist_items').delete().eq('user_id', user.id);
    if (id) {
      query = query.eq('id', id);
    } else {
      const normalizedSymbol = normalizeSymbol(symbol);
      if (!normalizedSymbol) {
        return NextResponse.json({ success: false, error: 'Geçerli bir hisse kodu gerekli' }, { status: 400 });
      }
      query = query.eq('symbol', normalizedSymbol);
    }

    const { data: deletedRows, error } = await query.select('id');
    if (error) {
      if (isMissingTableError(error)) {
        return NextResponse.json(
          { success: false, error: 'Takip listesi tablosu bulunamadı. SQL migration çalıştırın.' },
          { status: 503 }
        );
      }
      throw error;
    }
    if (!deletedRows || deletedRows.length === 0) {
      return NextResponse.json({ success: false, error: 'Kayıt bulunamadı' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Takip listesinden kaldırıldı' });
  } catch (error) {
    console.error('Watchlist remove error:', error);
    return NextResponse.json({ success: false, error: 'Takip listesinden kaldırılamadı' }, { status: 500 });
  }
}

// PUT – Update target price
export async function PUT(request: NextRequest) {
  try {
    const sb = await getSupabaseClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: 'Giriş yapmanız gerekli' }, { status: 401 });

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Geçersiz istek gövdesi' }, { status: 400 });
    }
    const incoming = (body ?? {}) as { id?: unknown; targetPrice?: unknown };
    const id = typeof incoming.id === 'string' ? incoming.id.trim() : '';

    if (!id) return NextResponse.json({ success: false, error: 'ID gerekli' }, { status: 400 });
    const parsedTarget = parseOptionalPrice(incoming.targetPrice);
    if (parsedTarget.error) {
      return NextResponse.json({ success: false, error: parsedTarget.error }, { status: 400 });
    }

    const { data, error } = await sb
      .from('watchlist_items')
      .update({ target_price: parsedTarget.value })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      if ((error as { code?: string }).code === 'PGRST116') {
        return NextResponse.json({ success: false, error: 'Kayıt bulunamadı' }, { status: 404 });
      }
      if (isMissingTableError(error)) {
        return NextResponse.json(
          { success: false, error: 'Takip listesi tablosu bulunamadı. SQL migration çalıştırın.' },
          { status: 503 }
        );
      }
      throw error;
    }

    return NextResponse.json({ success: true, data: mapWatchlistItem(data), message: 'Güncellendi' });
  } catch (error) {
    console.error('Watchlist update error:', error);
    return NextResponse.json({ success: false, error: 'Güncellenemedi' }, { status: 500 });
  }
}

// snake_case DB row → camelCase frontend shape
function mapWatchlistItem(row: Record<string, unknown>) {
  return {
    id:          row.id,
    symbol:      row.symbol,
    name:        row.name,
    targetPrice: row.target_price,
    userId:      row.user_id,
    createdAt:   row.created_at,
    updatedAt:   row.updated_at,
  };
}
