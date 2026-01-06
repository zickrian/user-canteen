/**
 * Tool — compare_menu
 * Bandingkan 2 atau lebih menu side-by-side
 * 
 * Contoh: "bandingkan nasi goreng biasa vs nasi goreng telur"
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

interface CompareMenuParams {
  menu_names: string[]  // Array nama menu yang mau dibandingkan
  kantin_name?: string  // Optional: filter by kantin
}

export async function POST(req: NextRequest) {
  try {
    const params: CompareMenuParams = await req.json()
    const { menu_names, kantin_name } = params

    if (!menu_names || menu_names.length < 2) {
      return NextResponse.json({ 
        error: 'Minimal 2 menu untuk dibandingkan',
        items: [],
        count: 0 
      }, { status: 400 })
    }

    console.log('[compare_menu] Comparing:', menu_names, kantin_name ? `in ${kantin_name}` : '')

    // Search for each menu
    const results: any[] = []
    
    for (const menuName of menu_names.slice(0, 5)) { // Max 5 menu
      let query = supabaseAdmin
        .from('v_menu_stats')
        .select('*')
        .ilike('nama_menu', `%${menuName.trim()}%`)
        .eq('tersedia', true)
        .eq('kantin_status', 'aktif')

      if (kantin_name) {
        query = query.ilike('nama_kantin', `%${kantin_name}%`)
      }

      const { data, error } = await query.limit(1)

      if (!error && data && data.length > 0) {
        results.push(data[0])
      }
    }

    if (results.length < 2) {
      return NextResponse.json({
        items: results,
        count: results.length,
        message: 'Tidak cukup menu ditemukan untuk dibandingkan. Pastikan nama menu benar.',
        comparison: null
      })
    }

    // Build comparison data
    const comparison = {
      menus: results.map(m => ({
        id: m.id,
        nama_menu: m.nama_menu,
        harga: Number(m.harga),
        avg_rating: Number(m.avg_rating) || 0,
        rating_count: m.rating_count || 0,
        total_sold: m.total_sold || 0,
        nama_kantin: m.nama_kantin,
        kategori_menu: m.kategori_menu,
        foto_menu: m.foto_menu,
        deskripsi: m.deskripsi,
      })),
      analysis: {
        cheapest: results.reduce((a, b) => Number(a.harga) < Number(b.harga) ? a : b).nama_menu,
        most_expensive: results.reduce((a, b) => Number(a.harga) > Number(b.harga) ? a : b).nama_menu,
        highest_rated: results.reduce((a, b) => Number(a.avg_rating) > Number(b.avg_rating) ? a : b).nama_menu,
        best_seller: results.reduce((a, b) => (a.total_sold || 0) > (b.total_sold || 0) ? a : b).nama_menu,
        price_diff: Math.abs(Number(results[0].harga) - Number(results[1].harga)),
      }
    }

    console.log('[compare_menu] Found', results.length, 'menus to compare')

    return NextResponse.json({
      items: results,
      count: results.length,
      comparison,
      message: `Berhasil membandingkan ${results.length} menu`
    })
  } catch (error: any) {
    console.error('[compare_menu] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
