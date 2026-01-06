/**
 * Tool — get_personal_recommendation
 * Rekomendasi personal berdasarkan riwayat pesanan user
 * 
 * Contoh: "rekomendasiin menu buat aku dong"
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

interface GetPersonalRecommendationParams {
  user_id: string
  limit?: number
}

export async function POST(req: NextRequest) {
  try {
    const params: GetPersonalRecommendationParams = await req.json()
    const { user_id, limit = 5 } = params

    if (!user_id) {
      return NextResponse.json({ 
        error: 'user_id diperlukan',
        items: [],
        count: 0,
        has_history: false
      }, { status: 400 })
    }

    console.log('[get_personal_recommendation] Getting recommendations for user:', user_id)

    // Get user's order history
    const { data: orderHistory, error: historyError } = await supabaseAdmin
      .from('pesanan')
      .select(`
        id,
        created_at,
        detail_pesanan (
          menu_id,
          jumlah
        )
      `)
      .eq('user_id', user_id)
      .eq('status', 'selesai')
      .order('created_at', { ascending: false })
      .limit(50)

    if (historyError) {
      console.error('[get_personal_recommendation] History error:', historyError)
    }

    // Count orders
    const orderCount = orderHistory?.length || 0

    // If user has no history or less than 3 orders
    if (orderCount < 3) {
      return NextResponse.json({
        items: [],
        count: 0,
        has_history: false,
        order_count: orderCount,
        message: orderCount === 0 
          ? 'Kamu belum pernah pesan. Coba pesan beberapa kali dulu ya, nanti aku bisa kasih rekomendasi personal! 😊'
          : `Kamu baru pesan ${orderCount}x. Pesan ${3 - orderCount}x lagi ya, biar aku bisa kasih rekomendasi yang pas buat kamu! 🍽️`
      })
    }

    // Extract menu IDs from history
    const menuFrequency: Record<string, number> = {}
    
    for (const order of orderHistory || []) {
      for (const detail of (order.detail_pesanan || []) as { menu_id: string; jumlah?: number }[]) {
        const menuId = detail.menu_id
        const qty = detail.jumlah || 1
        menuFrequency[menuId] = (menuFrequency[menuId] || 0) + qty
      }
    }

    // Get frequently ordered menu IDs
    const frequentMenuIds = Object.entries(menuFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id]) => id)

    if (frequentMenuIds.length === 0) {
      return NextResponse.json({
        items: [],
        count: 0,
        has_history: true,
        order_count: orderCount,
        message: 'Belum ada data menu yang cukup untuk rekomendasi.'
      })
    }

    // Get details of frequently ordered menus
    const { data: frequentMenus, error: menuError } = await supabaseAdmin
      .from('v_menu_stats')
      .select('*')
      .in('id', frequentMenuIds)
      .eq('tersedia', true)

    if (menuError) {
      console.error('[get_personal_recommendation] Menu error:', menuError)
    }

    // Get kantin IDs from frequent menus
    const frequentKantinIds = [...new Set((frequentMenus || []).map(m => m.kantin_id))]

    // Get similar menus from same kantins (that user hasn't ordered)
    const { data: similarMenus } = await supabaseAdmin
      .from('v_menu_stats')
      .select('*')
      .in('kantin_id', frequentKantinIds)
      .not('id', 'in', `(${frequentMenuIds.join(',')})`)
      .eq('tersedia', true)
      .eq('kantin_status', 'aktif')
      .order('total_sold', { ascending: false })
      .limit(limit)

    // Combine: favorite menus + new recommendations
    const favoriteMenus = (frequentMenus || [])
      .sort((a, b) => (menuFrequency[b.id] || 0) - (menuFrequency[a.id] || 0))
      .slice(0, 3)
      .map(m => ({
        ...m,
        harga: Number(m.harga),
        avg_rating: Number(m.avg_rating) || 0,
        order_count: menuFrequency[m.id] || 0,
        type: 'favorite'
      }))

    const newRecommendations = (similarMenus || []).slice(0, limit - favoriteMenus.length).map(m => ({
      ...m,
      harga: Number(m.harga),
      avg_rating: Number(m.avg_rating) || 0,
      type: 'recommendation'
    }))

    const allRecommendations = [...favoriteMenus, ...newRecommendations]

    console.log('[get_personal_recommendation] Found', favoriteMenus.length, 'favorites,', newRecommendations.length, 'new recommendations')

    return NextResponse.json({
      items: allRecommendations,
      count: allRecommendations.length,
      has_history: true,
      order_count: orderCount,
      favorites: favoriteMenus,
      new_recommendations: newRecommendations,
      message: `Berdasarkan ${orderCount} pesanan kamu, ini rekomendasi menu yang cocok! 🎯`
    })
  } catch (error: any) {
    console.error('[get_personal_recommendation] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
