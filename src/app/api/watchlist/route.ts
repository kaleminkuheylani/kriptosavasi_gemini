import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { serverClient } from '@/lib/supabase';

async function getSupabaseClient() {
  const cs = await cookies();
  const token = cs.get('sb-access-token')?.value ?? null;
  return serverClient(token);
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

    if (error) throw error;

    return NextResponse.json({ success: true, data: data ?? [] });
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

    const body = await request.json();
    const { symbol, name, targetPrice } = body;

    if (!symbol || !name) {
      return NextResponse.json({ success: false, error: 'Hisse kodu ve adı gerekli' }, { status: 400 });
    }

    // Check duplicate
    const { data: existing } = await sb
      .from('watchlist_items')
      .select('id')
      .eq('user_id', user.id)
      .eq('symbol', symbol.toUpperCase())
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ success: false, error: 'Bu hisse zaten takip listesinde' }, { status: 400 });
    }

    const { data, error } = await sb
      .from('watchlist_items')
      .insert({
        user_id:      user.id,
        symbol:       symbol.toUpperCase(),
        name,
        target_price: targetPrice ? parseFloat(targetPrice) : null,
      })
      .select()
      .single();

    if (error) throw error;

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
    const id     = searchParams.get('id');
    const symbol = searchParams.get('symbol');

    if (!id && !symbol) {
      return NextResponse.json({ success: false, error: 'ID veya sembol gerekli' }, { status: 400 });
    }

    let query = sb.from('watchlist_items').delete().eq('user_id', user.id);
    if (id)     query = query.eq('id', id);
    else        query = query.eq('symbol', symbol!.toUpperCase());

    const { error } = await query;
    if (error) throw error;

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

    const body = await request.json();
    const { id, targetPrice } = body;

    if (!id) return NextResponse.json({ success: false, error: 'ID gerekli' }, { status: 400 });

    const { data, error } = await sb
      .from('watchlist_items')
      .update({ target_price: targetPrice ? parseFloat(targetPrice) : null })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) throw error;

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
