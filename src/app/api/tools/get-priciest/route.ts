/**
 * Tool 4 — get_priciest
 * Daftar menu termahal (kios tertentu atau global)
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

interface GetPriciestParams {
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
    const params: GetPriciestParams = await req.json()
    
    const {
      kantin_id,
      kantin_name,
      kategori,
      limit = 5,
    } = params

    let dbQuery = supabaseAdmin
      .from('v_menu_stats')
      .select('*')
      .eq('tersedia', true)

    // Filter by kantin
    if (kantin_id) {
      dbQuery = dbQuery.eq('kantin_id', kantin_id)
    } else if (kantin_name) {
      dbQuery = dbQuery.ilike('nama_kantin', `%${kantin_name}%`)
    }

    // Filter by kategori
    if (kategori === 'makanan') {
      dbQuery = dbQuery.not('kategori_menu', 'cs', '["Minuman"]')
    } else if (kategori && KATEGORI_MAP[kategori]) {
      for (const kat of KATEGORI_MAP[kategori]) {
        dbQuery = dbQuery.contains('kategori_menu', [kat])
      }
    }

    // Sort by price descending (most expensive first)
    dbQuery = dbQuery
      .order('harga', { ascending: false })
      .limit(limit)

    const { data, error } = await dbQuery

    if (error) {
      console.error('[get_priciest] Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      items: data || [],
      count: data?.length || 0,
      type: 'priciest',
    })
  } catch (error: any) {
    console.error('[get_priciest] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
