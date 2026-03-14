import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { serverClient } from '@/lib/supabase';

type DbCommentRow = {
  id: string;
  symbol: string;
  user_id: string;
  author_name: string;
  content: string;
  created_at: string;
};

function mapComment(row: DbCommentRow) {
  return {
    id: row.id,
    symbol: row.symbol,
    userId: row.user_id,
    authorName: row.author_name,
    content: row.content,
    createdAt: row.created_at,
  };
}

async function getSupabaseClient() {
  const cs = await cookies();
  const token = cs.get('sb-access-token')?.value ?? null;
  return serverClient(token);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const { symbol } = await params;
    const code = symbol.toUpperCase();
    const limitParam = Number(request.nextUrl.searchParams.get('limit') || 50);
    const limit = Math.max(1, Math.min(200, Number.isNaN(limitParam) ? 50 : limitParam));

    const sb = await getSupabaseClient();
    const { data, error } = await sb
      .from('stock_comments')
      .select('id, symbol, user_id, author_name, content, created_at')
      .eq('symbol', code)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      if ((error as { code?: string }).code === '42P01') {
        return NextResponse.json({
          success: true,
          data: [],
          count: 0,
          setupRequired: true,
          message: 'Yorum tablosu henuez olusturulmamis',
        });
      }
      throw error;
    }

    const rows = (data ?? []) as DbCommentRow[];
    return NextResponse.json({
      success: true,
      data: rows.map(mapComment),
      count: rows.length,
    });
  } catch (error) {
    console.error('Stock comments GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Yorumlar alinamadi', data: [] },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const { symbol } = await params;
    const code = symbol.toUpperCase();
    const body = await request.json();
    const content = String(body?.content ?? '').trim();

    if (!content || content.length < 2) {
      return NextResponse.json(
        { success: false, error: 'Yorum en az 2 karakter olmali' },
        { status: 400 }
      );
    }
    if (content.length > 1000) {
      return NextResponse.json(
        { success: false, error: 'Yorum en fazla 1000 karakter olmali' },
        { status: 400 }
      );
    }

    const sb = await getSupabaseClient();
    const { data: userData } = await sb.auth.getUser();
    const user = userData.user;
    if (!user) {
      return NextResponse.json({ success: false, error: 'Giris yapmaniz gerekli' }, { status: 401 });
    }

    const authorName = user.user_metadata?.rumuz ?? user.email?.split('@')[0] ?? 'Kullanici';
    const { data, error } = await sb
      .from('stock_comments')
      .insert({
        user_id: user.id,
        symbol: code,
        author_name: authorName,
        content,
      })
      .select('id, symbol, user_id, author_name, content, created_at')
      .single();

    if (error) {
      if ((error as { code?: string }).code === '42P01') {
        return NextResponse.json(
          { success: false, error: 'Yorum ozelligi icin veritabani kurulumu gerekli' },
          { status: 503 }
        );
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      data: mapComment(data as DbCommentRow),
      message: 'Yorum eklendi',
    });
  } catch (error) {
    console.error('Stock comments POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Yorum eklenemedi' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const { symbol } = await params;
    const code = symbol.toUpperCase();
    const id = request.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'Yorum ID gerekli' }, { status: 400 });
    }

    const sb = await getSupabaseClient();
    const { data: userData } = await sb.auth.getUser();
    const user = userData.user;
    if (!user) {
      return NextResponse.json({ success: false, error: 'Giris yapmaniz gerekli' }, { status: 401 });
    }

    const { error } = await sb
      .from('stock_comments')
      .delete()
      .eq('id', id)
      .eq('symbol', code)
      .eq('user_id', user.id);

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Yorum silindi' });
  } catch (error) {
    console.error('Stock comments DELETE error:', error);
    return NextResponse.json(
      { success: false, error: 'Yorum silinemedi' },
      { status: 500 }
    );
  }
}
