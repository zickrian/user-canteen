import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

/**
 * API untuk mendapatkan jumlah penjualan sebenarnya dari detail_pesanan
 * Menghitung jumlah item yang terjual dari pesanan dengan status 'selesai'
 */
export async function POST(request: NextRequest) {
  try {
    const { menuIds } = await request.json()

    if (!menuIds || !Array.isArray(menuIds) || menuIds.length === 0) {
      return NextResponse.json(
        { error: 'menuIds array is required' },
        { status: 400 }
      )
    }

    const supabaseAdmin = getSupabaseAdmin()

    // Initialize semua menu dengan 0
    const salesCountMap: Record<string, number> = {}
    menuIds.forEach((id: string) => {
      salesCountMap[id] = 0
    })

    // Ambil semua detail_pesanan untuk menu yang diminta
    const { data: detailData, error: detailError } = await supabaseAdmin
      .from('detail_pesanan')
      .select('id, menu_id, jumlah, pesanan_id')
      .in('menu_id', menuIds)

    if (detailError) {
      console.error('[Sales Count API] Detail Error:', detailError)
      return NextResponse.json(
        { error: detailError.message },
        { status: 500 }
      )
    }

    if (!detailData || detailData.length === 0) {
      return NextResponse.json({ salesCounts: salesCountMap })
    }

    // Ambil pesanan_id yang unik
    const pesananIds = [...new Set(detailData.map((d: any) => d.pesanan_id))]

    // Ambil status pesanan untuk pesanan yang relevan
    const { data: pesananData, error: pesananError } = await supabaseAdmin
      .from('pesanan')
      .select('id, status')
      .in('id', pesananIds)
      .eq('status', 'selesai')

    if (pesananError) {
      console.error('[Sales Count API] Pesanan Error:', pesananError)
      return NextResponse.json(
        { error: pesananError.message },
        { status: 500 }
      )
    }

    // Buat set pesanan_id yang selesai untuk lookup cepat
    const selesaiPesananIds = new Set(
      (pesananData || []).map((p: any) => p.id)
    )

    // Hitung jumlah penjualan untuk setiap menu dari pesanan yang selesai
    detailData.forEach((item: any) => {
      if (selesaiPesananIds.has(item.pesanan_id)) {
        const menuId = item.menu_id
        if (salesCountMap.hasOwnProperty(menuId)) {
          salesCountMap[menuId] = (salesCountMap[menuId] || 0) + (item.jumlah || 0)
        }
      }
    })

    return NextResponse.json({ salesCounts: salesCountMap })
  } catch (error) {
    console.error('[Sales Count API] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

