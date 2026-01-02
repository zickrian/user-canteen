/**
 * Tool 6 — recommend_combo_under_budget
 * Kombinasi makanan + minuman dalam budget
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

interface RecommendComboParams {
  budget: number
  kantin_id?: string
  kantin_name?: string
  limit?: number
  prefer_sort?: 'total_asc' | 'rating_desc' | 'best_seller_desc'
}

interface MenuItem {
  id: string
  kantin_id: string
  nama_menu: string
  harga: number
  deskripsi: string | null
  tersedia: boolean
  kategori_menu: string[]
  total_sold: number
  foto_menu: string | null
  nama_kantin: string
  avg_rating: number
  rating_count: number
}

interface ComboResult {
  makanan: MenuItem
  minuman: MenuItem
  total: number
  sisa: number
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    console.log('[recommend_combo] Received params:', body)
    
    const params: RecommendComboParams = body
    
    const {
      budget,
      kantin_id,
      kantin_name,
      limit = 10,
      prefer_sort = 'best_seller_desc',
    } = params

    // Handle budget yang mungkin dikirim sebagai string
    const budgetNum = typeof budget === 'string' ? parseFloat(budget) : budget

    if (!budgetNum || budgetNum <= 0 || isNaN(budgetNum)) {
      console.error('[recommend_combo] Invalid budget:', budget)
      return NextResponse.json({ error: 'budget is required and must be positive' }, { status: 400 })
    }

    console.log('[recommend_combo] Using budget:', budgetNum)

    // Get all menu items within budget, then filter in JS
    // This avoids JSONB filter issues with Supabase client
    let baseQuery = supabaseAdmin
      .from('v_menu_stats')
      .select('*')
      .eq('tersedia', true)
      .lte('harga', budgetNum)
      .order('total_sold', { ascending: false })
      .limit(50)

    // Filter by kantin if specified
    if (kantin_id) {
      baseQuery = baseQuery.eq('kantin_id', kantin_id)
    } else if (kantin_name) {
      baseQuery = baseQuery.ilike('nama_kantin', `%${kantin_name}%`)
    }

    const { data: allMenus, error } = await baseQuery

    if (error) {
      console.error('[recommend_combo] Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Filter makanan dan minuman di JavaScript
    const makananList = (allMenus || []).filter((item: any) => {
      const kategori = item.kategori_menu || []
      return !kategori.includes('Minuman')
    }) as MenuItem[]

    const minumanList = (allMenus || []).filter((item: any) => {
      const kategori = item.kategori_menu || []
      return kategori.includes('Minuman')
    }) as MenuItem[]

    console.log('[recommend_combo] Found makanan:', makananList.length, 'minuman:', minumanList.length)

    // Generate valid combinations within budget
    const combos: ComboResult[] = []

    for (const makanan of makananList) {
      for (const minuman of minumanList) {
        const makananHarga = typeof makanan.harga === 'string' ? parseFloat(makanan.harga) : makanan.harga
        const minumanHarga = typeof minuman.harga === 'string' ? parseFloat(minuman.harga) : minuman.harga
        const total = makananHarga + minumanHarga
        if (total <= budgetNum) {
          combos.push({
            makanan: { ...makanan, harga: makananHarga },
            minuman: { ...minuman, harga: minumanHarga },
            total,
            sisa: budgetNum - total,
          })
        }
      }
    }

    console.log('[recommend_combo] Generated combos:', combos.length)

    // Sort based on preference
    combos.sort((a, b) => {
      switch (prefer_sort) {
        case 'total_asc':
          // Lowest total first (most savings)
          return a.total - b.total
        case 'rating_desc':
          // Highest combined rating first
          const ratingA = a.makanan.avg_rating + a.minuman.avg_rating
          const ratingB = b.makanan.avg_rating + b.minuman.avg_rating
          return ratingB - ratingA
        case 'best_seller_desc':
        default:
          // Highest combined sales first, then best budget usage
          const salesA = a.makanan.total_sold + a.minuman.total_sold
          const salesB = b.makanan.total_sold + b.minuman.total_sold
          if (salesB !== salesA) return salesB - salesA
          return a.sisa - b.sisa // Lower sisa = better budget usage
      }
    })

    // Return top combos
    const topCombos = combos.slice(0, limit)

    return NextResponse.json({
      combos: topCombos,
      count: topCombos.length,
      budget: budgetNum,
      makanan_available: makananList.length,
      minuman_available: minumanList.length,
    })
  } catch (error: any) {
    console.error('[recommend_combo] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
