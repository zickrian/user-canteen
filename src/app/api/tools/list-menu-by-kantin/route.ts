/**
 * Tool 2 — list_menu_by_kantin
 * List menu untuk kios/kantin tertentu
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

interface ListMenuParams {
  kantin_id?: string
  kantin_name?: string
  only_available?: boolean
  sort?: 'rating_desc' | 'price_asc' | 'price_desc' | 'best_seller_desc'
  limit?: number
}

export async function POST(req: NextRequest) {
  try {
    const params: ListMenuParams = await req.json()
    
    const {
      kantin_id,
      kantin_name,
      only_available = true,
      sort = 'best_seller_desc',
      limit = 10,
    } = params

    console.log('[list_menu_by_kantin] Params:', { kantin_id, kantin_name, only_available, sort, limit })

    let dbQuery = supabaseAdmin
      .from('v_menu_stats')
      .select('*')

    // Filter by kantin_id or kantin_name
    if (kantin_id) {
      dbQuery = dbQuery.eq('kantin_id', kantin_id)
    } else if (kantin_name) {
      // Use more flexible search - try exact match first, then fuzzy
      // Clean up the kantin name for better matching
      const cleanName = kantin_name.trim().toLowerCase()
      console.log('[list_menu_by_kantin] Searching for kantin:', cleanName)
      
      // Use ilike for case-insensitive partial match
      dbQuery = dbQuery.ilike('nama_kantin', `%${kantin_name}%`)
    }

    // Filter by availability
    if (only_available) {
      dbQuery = dbQuery.eq('tersedia', true)
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
      console.error('[list_menu_by_kantin] Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('[list_menu_by_kantin] Found:', data?.length || 0, 'items')

    // Get kantin name from first result if available
    const kantinInfo = data && data.length > 0 ? {
      kantin_id: data[0].kantin_id,
      nama_kantin: data[0].nama_kantin,
    } : null

    return NextResponse.json({
      kantin: kantinInfo,
      items: data || [],
      count: data?.length || 0,
      search_term: kantin_name || kantin_id || null,
    })
  } catch (error: any) {
    console.error('[list_menu_by_kantin] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
