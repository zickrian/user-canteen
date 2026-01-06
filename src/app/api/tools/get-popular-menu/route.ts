/**
 * Tool — get_popular_menu
 * Menu paling laris (by total_sold)
 * 
 * Fitur:
 * - Tanpa kantin_id/kantin_name: tampilkan menu terlaris dari SEMUA kios (global ranking)
 * - Dengan kantin_id/kantin_name: tampilkan menu terlaris dari kios tertentu
 * - Jika tidak ada penjualan, fallback ke rating tertinggi
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
    const { kantin_id, kantin_name, kategori, limit = 5 } = params

    console.log('[get_popular_menu] Params:', { kantin_id, kantin_name, kategori, limit })

    // Build base query
    let query = supabaseAdmin
      .from('v_menu_stats')
      .select('*')
      .eq('tersedia', true)
      .eq('kantin_status', 'aktif')

    // Filter by kantin (optional - if not provided, get global ranking)
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

    // Sort by total_sold descending, then by avg_rating as tiebreaker
    query = query
      .order('total_sold', { ascending: false })
      .order('avg_rating', { ascending: false })
      .limit(limit)

    const { data, error } = await query

    if (error) {
      console.error('[get_popular_menu] Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Add ranking number to each item
    const rankedItems = (data || []).map((item, index) => ({
      ...item,
      ranking: index + 1,
    }))

    // Determine if this is global or kantin-specific
    const isGlobal = !kantin_id && !kantin_name
    const kantinInfo = !isGlobal && rankedItems.length > 0 ? {
      kantin_id: rankedItems[0].kantin_id,
      nama_kantin: rankedItems[0].nama_kantin,
    } : null

    console.log('[get_popular_menu] Found:', rankedItems.length, 'items', isGlobal ? '(global)' : `(${kantinInfo?.nama_kantin})`)

    return NextResponse.json({
      items: rankedItems,
      count: rankedItems.length,
      type: 'popular',
      is_global: isGlobal,
      kantin: kantinInfo,
      note: rankedItems.length === 0 
        ? 'Belum ada data penjualan' 
        : rankedItems.every(i => i.total_sold === 0) 
          ? 'Diurutkan berdasarkan rating (belum ada penjualan)' 
          : 'Diurutkan berdasarkan jumlah terjual',
    })
  } catch (error: any) {
    console.error('[get_popular_menu] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
