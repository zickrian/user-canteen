/**
 * Tool 1 — search_menu
 * Cari/rekomendasi menu berdasarkan query + filter
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

interface SearchMenuParams {
  kantin_id?: string
  query?: string
  kategori?: 'makan_pagi' | 'makan_siang' | 'snack' | 'minuman'
  max_price?: number
  min_rating?: number
  only_available?: boolean
  sort?: 'rating_desc' | 'price_asc' | 'price_desc' | 'best_seller_desc'
  limit?: number
}

// Map kategori input ke database value
const KATEGORI_MAP: Record<string, string> = {
  'makan_pagi': 'Makan Pagi',
  'makan_siang': 'Makan Siang',
  'snack': 'Snack',
  'minuman': 'Minuman',
}

export async function POST(req: NextRequest) {
  try {
    const params: SearchMenuParams = await req.json()
    
    const {
      kantin_id,
      query,
      kategori,
      max_price,
      min_rating,
      only_available = true,
      sort = 'best_seller_desc',
      limit = 10,
    } = params

    let dbQuery = supabaseAdmin
      .from('v_menu_stats')
      .select('*')

    // Filter by kantin_id
    if (kantin_id) {
      dbQuery = dbQuery.eq('kantin_id', kantin_id)
    }

    // Filter by availability
    if (only_available) {
      dbQuery = dbQuery.eq('tersedia', true)
    }

    // Filter by query (search in nama_menu and deskripsi)
    if (query) {
      dbQuery = dbQuery.or(`nama_menu.ilike.%${query}%,deskripsi.ilike.%${query}%`)
    }

    // Filter by kategori
    if (kategori && KATEGORI_MAP[kategori]) {
      dbQuery = dbQuery.contains('kategori_menu', [KATEGORI_MAP[kategori]])
    }

    // Filter by max_price
    if (max_price) {
      dbQuery = dbQuery.lte('harga', max_price)
    }

    // Filter by min_rating
    if (min_rating) {
      dbQuery = dbQuery.gte('avg_rating', min_rating)
    }

    // Apply sorting
    switch (sort) {
      case 'rating_desc':
        dbQuery = dbQuery.order('avg_rating', { ascending: false })
        break
      case 'price_asc':
        dbQuery = dbQuery.order('harga', { ascending: true })
        break
      case 'price_desc':
        dbQuery = dbQuery.order('harga', { ascending: false })
        break
      case 'best_seller_desc':
      default:
        dbQuery = dbQuery.order('total_sold', { ascending: false })
        break
    }

    dbQuery = dbQuery.limit(limit)

    const { data, error } = await dbQuery

    if (error) {
      console.error('[search_menu] Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      items: data || [],
      count: data?.length || 0,
    })
  } catch (error: any) {
    console.error('[search_menu] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
