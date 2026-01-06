/**
 * Tool — create_custom_combo
 * Buat paket custom dari menu yang dipilih user
 * 
 * Contoh: "mau nasi goreng telur sama jus mangga"
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

interface CreateCustomComboParams {
  menu_names: string[]  // Array nama menu yang dipilih user
}

export async function POST(req: NextRequest) {
  try {
    const params: CreateCustomComboParams = await req.json()
    const { menu_names } = params

    if (!menu_names || menu_names.length === 0) {
      return NextResponse.json({ 
        error: 'Minimal 1 menu harus dipilih',
        items: [],
        count: 0 
      }, { status: 400 })
    }

    console.log('[create_custom_combo] Creating combo from:', menu_names)

    // Search for each menu
    const foundMenus: any[] = []
    const notFoundMenus: string[] = []
    
    for (const menuName of menu_names.slice(0, 10)) { // Max 10 menu
      const { data, error } = await supabaseAdmin
        .from('v_menu_stats')
        .select('*')
        .ilike('nama_menu', `%${menuName.trim()}%`)
        .eq('tersedia', true)
        .eq('kantin_status', 'aktif')
        .limit(1)

      if (!error && data && data.length > 0) {
        foundMenus.push({
          ...data[0],
          harga: Number(data[0].harga),
          avg_rating: Number(data[0].avg_rating) || 0,
        })
      } else {
        notFoundMenus.push(menuName)
      }
    }

    if (foundMenus.length === 0) {
      return NextResponse.json({
        items: [],
        count: 0,
        total: 0,
        not_found: notFoundMenus,
        message: 'Tidak ada menu yang ditemukan. Coba cek nama menu-nya ya!'
      })
    }

    // Calculate total
    const total = foundMenus.reduce((sum, m) => sum + m.harga, 0)

    // Categorize items
    const makanan = foundMenus.filter(m => {
      const cats = (m.kategori_menu || []).map((c: string) => c.toLowerCase())
      return cats.includes('makan pagi') || cats.includes('makan siang') || cats.includes('snack')
    })
    const minuman = foundMenus.filter(m => {
      const cats = (m.kategori_menu || []).map((c: string) => c.toLowerCase())
      return cats.includes('minuman')
    })

    // Build combo response
    const combo = {
      items: foundMenus,
      makanan,
      minuman,
      total,
      item_count: foundMenus.length,
      not_found: notFoundMenus,
    }

    console.log('[create_custom_combo] Created combo:', foundMenus.length, 'items, total:', total)

    return NextResponse.json({
      // Don't include items at top level to avoid duplicate in UI
      count: foundMenus.length,
      combo,
      total,
      not_found: notFoundMenus,
      message: notFoundMenus.length > 0 
        ? `Ditemukan ${foundMenus.length} menu. Menu tidak ditemukan: ${notFoundMenus.join(', ')}`
        : `Paket custom berhasil dibuat! Total: Rp${total.toLocaleString('id-ID')}`
    })
  } catch (error: any) {
    console.error('[create_custom_combo] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
