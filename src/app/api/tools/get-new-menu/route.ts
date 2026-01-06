/**
 * Tool — get_new_menu
 * Dapatkan menu terbaru berdasarkan periode
 * 
 * Contoh: "menu baru minggu ini", "ada menu baru ga?"
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

interface GetNewMenuParams {
  period: 'today' | 'week' | 'month'  // Periode: hari ini, minggu ini, bulan ini
  kantin_name?: string
  limit?: number
}

export async function POST(req: NextRequest) {
  try {
    const params: GetNewMenuParams = await req.json()
    const { period = 'week', kantin_name, limit = 10 } = params

    console.log('[get_new_menu] Getting new menus for period:', period, kantin_name ? `in ${kantin_name}` : '')

    // Calculate date range based on period
    const now = new Date()
    let startDate: Date

    switch (period) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        break
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    }

    const startDateStr = startDate.toISOString()

    // Build query
    let query = supabaseAdmin
      .from('v_menu_stats')
      .select('*')
      .gte('created_at', startDateStr)
      .eq('tersedia', true)
      .eq('kantin_status', 'aktif')
      .order('created_at', { ascending: false })

    if (kantin_name) {
      query = query.ilike('nama_kantin', `%${kantin_name}%`)
    }

    query = query.limit(limit)

    const { data, error } = await query

    if (error) {
      console.error('[get_new_menu] Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Format items with "new" badge info
    const items = (data || []).map(m => ({
      ...m,
      harga: Number(m.harga),
      avg_rating: Number(m.avg_rating) || 0,
      is_new: true,
      days_ago: Math.floor((now.getTime() - new Date(m.created_at).getTime()) / (24 * 60 * 60 * 1000))
    }))

    // Generate period label
    const periodLabel = {
      'today': 'hari ini',
      'week': 'minggu ini',
      'month': 'bulan ini'
    }[period]

    console.log('[get_new_menu] Found', items.length, 'new menus')

    return NextResponse.json({
      items,
      count: items.length,
      period,
      period_label: periodLabel,
      start_date: startDateStr,
      message: items.length > 0 
        ? `Ada ${items.length} menu baru ${periodLabel}! 🆕`
        : `Belum ada menu baru ${periodLabel}. Coba cek lagi nanti ya! 😊`
    })
  } catch (error: any) {
    console.error('[get_new_menu] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
