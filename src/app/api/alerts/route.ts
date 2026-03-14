import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { serverClient } from '@/lib/supabase';

async function getSupabaseClient() {
  const cs = await cookies();
  const token = cs.get('sb-access-token')?.value ?? null;
  return serverClient(token);
}

function mapAlert(row: Record<string, unknown>) {
  return {
    id:          row.id,
    symbol:      row.symbol,
    targetPrice: row.target_price,
    condition:   row.condition,
    active:      row.active,
    triggered:   row.triggered,
    userId:      row.user_id,
    createdAt:   row.created_at,
  };
}

// GET – Fetch all alerts
export async function GET() {
  try {
    const sb = await getSupabaseClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ success: true, data: [] });

    const { data, error } = await sb
      .from('price_alerts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, data: (data ?? []).map(mapAlert) });
  } catch (error) {
    console.error('Alerts fetch error:', error);
    return NextResponse.json({ success: false, error: 'Bildirimler alınamadı', data: [] }, { status: 500 });
  }
}

// POST – Create alert
export async function POST(request: NextRequest) {
  try {
    const sb = await getSupabaseClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: 'Giriş yapmanız gerekli' }, { status: 401 });

    const body = await request.json();
    const { symbol, targetPrice, condition } = body;

    if (!symbol || !targetPrice || !condition) {
      return NextResponse.json({ success: false, error: 'Hisse kodu, hedef fiyat ve koşul gerekli' }, { status: 400 });
    }
    if (condition !== 'above' && condition !== 'below') {
      return NextResponse.json({ success: false, error: 'Koşul "above" veya "below" olmalı' }, { status: 400 });
    }

    const { data, error } = await sb
      .from('price_alerts')
      .insert({
        user_id:      user.id,
        symbol:       symbol.toUpperCase(),
        target_price: parseFloat(targetPrice),
        condition,
        active:       true,
        triggered:    false,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data: mapAlert(data), message: 'Bildirim oluşturuldu' });
  } catch (error) {
    console.error('Alert create error:', error);
    return NextResponse.json({ success: false, error: 'Bildirim oluşturulamadı' }, { status: 500 });
  }
}

// PUT – Update alert (active / triggered)
export async function PUT(request: NextRequest) {
  try {
    const sb = await getSupabaseClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: 'Giriş yapmanız gerekli' }, { status: 401 });

    const body = await request.json();
    const { id, active, triggered } = body;

    if (!id) return NextResponse.json({ success: false, error: 'ID gerekli' }, { status: 400 });

    const updateData: Record<string, boolean> = {};
    if (typeof active    === 'boolean') updateData.active    = active;
    if (typeof triggered === 'boolean') updateData.triggered = triggered;

    const { data, error } = await sb
      .from('price_alerts')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data: mapAlert(data), message: 'Bildirim güncellendi' });
  } catch (error) {
    console.error('Alert update error:', error);
    return NextResponse.json({ success: false, error: 'Bildirim güncellenemedi' }, { status: 500 });
  }
}

// DELETE – Remove alert
export async function DELETE(request: NextRequest) {
  try {
    const sb = await getSupabaseClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: 'Giriş yapmanız gerekli' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ success: false, error: 'ID gerekli' }, { status: 400 });

    const { error } = await sb
      .from('price_alerts')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Bildirim silindi' });
  } catch (error) {
    console.error('Alert delete error:', error);
    return NextResponse.json({ success: false, error: 'Bildirim silinemedi' }, { status: 500 });
  }
}
