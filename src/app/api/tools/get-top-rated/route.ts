/**
 * Tool — get_top_rated
 * Menu dengan rating tertinggi
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

interface GetTopRatedParams {
  kantin_id?: string
  kantin_name?: string
  kategori?: 'makan_pagi' | 'makan_siang' | 'snack' | 'minuman' | 'makanan'
  min_reviews?: number // Minimum number of reviews to be considered
  limit?: number
}

const KATEGORI_MAP: Record<string, string[]> = {
  'makan_pagi': ['Makan Pagi'],
  'makan_siang': ['Makan Siang'],
  'snack': ['Snack'],
  'minuman': ['Minuman'],
  'makanan': ['Makan Pagi', 'Makan Siang'],
}

export async function POST(req: NextRequest) {
  try {
    const params: GetTopRatedParams = await req.json().catch(() => ({}))
    const { kantin_id, kantin_name, kategori, min_reviews = 1, limit = 10 } = params

    let query = supabaseAdmin
      .from('v_menu_stats')
      .select('*')
      .eq('tersedia', true)
      .gt('avg_rating', 0) // Only show items with ratings
      .gte('rating_count', min_reviews) // Minimum reviews

    // Filter by kantin
    if (kantin_id) {
      query = query.eq('kantin_id', kantin_id)
    } else if (kantin_name) {
      query = query.ilike('nama_kantin', `%${kantin_name}%`)
    }

    // Filter by kategori
    if (kategori === 'makanan') {
      query = query.not('kategori_menu', 'cs', '["Minuman"]')
    } else if (kategori && KATEGORI_MAP[kategori]) {
      for (const kat of KATEGORI_MAP[kategori]) {
        query = query.contains('kategori_menu', [kat])
      }
    }

    // Sort by avg_rating descending, then by rating_count
    query = query
      .order('avg_rating', { ascending: false })
      .order('rating_count', { ascending: false })
      .limit(limit)

    const { data, error } = await query

    if (error) {
      console.error('[get_top_rated] Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      items: data || [],
      count: data?.length || 0,
      type: 'top_rated',
    })
  } catch (error: any) {
    console.error('[get_top_rated] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
