/**
 * Tool 5 — list_under_price
 * Semua menu dengan harga <= max_price
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

interface ListUnderPriceParams {
  max_price: number
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
    const params: ListUnderPriceParams = await req.json()
    
    const {
      max_price,
      kantin_id,
      kantin_name,
      kategori,
      limit = 10,
    } = params

    if (!max_price || max_price <= 0) {
      return NextResponse.json({ error: 'max_price is required and must be positive' }, { status: 400 })
    }

    let dbQuery = supabaseAdmin
      .from('v_menu_stats')
      .select('*')
      .eq('tersedia', true)
      .lte('harga', max_price)

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

    // Sort by price ascending, then by popularity
    dbQuery = dbQuery
      .order('harga', { ascending: true })
      .order('total_sold', { ascending: false })
      .limit(limit)

    const { data, error } = await dbQuery

    if (error) {
      console.error('[list_under_price] Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      items: data || [],
      count: data?.length || 0,
      max_price,
    })
  } catch (error: any) {
    console.error('[list_under_price] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
