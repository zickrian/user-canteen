/**
 * Tool — get_popular_menu
 * Menu paling laris (by total_sold)
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

interface GetPopularMenuParams {
  kantin_id?: string
  kantin_name?: string
  kategori?: 'makan_pagi' | 'makan_siang' | 'snack' | 'minuman' | 'makanan'
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
    const params: GetPopularMenuParams = await req.json().catch(() => ({}))
    const { kantin_id, kantin_name, kategori, limit = 10 } = params

    let query = supabaseAdmin
      .from('v_menu_stats')
      .select('*')
      .eq('tersedia', true)
      .gt('total_sold', 0) // Only show items that have been sold

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

    // Sort by total_sold descending
    query = query
      .order('total_sold', { ascending: false })
      .limit(limit)

    const { data, error } = await query

    if (error) {
      console.error('[get_popular_menu] Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      items: data || [],
      count: data?.length || 0,
      type: 'popular',
    })
  } catch (error: any) {
    console.error('[get_popular_menu] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
