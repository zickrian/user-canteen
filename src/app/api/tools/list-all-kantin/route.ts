/**
 * Tool — list_all_kantin
 * List semua kantin yang aktif
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

interface ListAllKantinParams {
  only_open?: boolean
}

export async function POST(req: NextRequest) {
  try {
    const params: ListAllKantinParams = await req.json().catch(() => ({}))
    const { only_open } = params

    let query = supabaseAdmin
      .from('kantin')
      .select('id, nama_kantin, jam_buka, jam_tutup, buka_tutup, status, foto_profil')
      .eq('status', 'aktif')
      .order('nama_kantin', { ascending: true })

    if (only_open) {
      query = query.eq('buka_tutup', true)
    }

    const { data, error } = await query

    if (error) {
      console.error('[list_all_kantin] Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Calculate is_open_now for each kantin
    const now = new Date()
    const currentHour = now.getHours()
    const currentMinute = now.getMinutes()
    const currentTime = currentHour * 60 + currentMinute

    const kantinWithStatus = (data || []).map(kantin => {
      let isOpenNow = kantin.buka_tutup
      if (kantin.jam_buka && kantin.jam_tutup && kantin.buka_tutup) {
        const [bukaHour, bukaMin] = kantin.jam_buka.split(':').map(Number)
        const [tutupHour, tutupMin] = kantin.jam_tutup.split(':').map(Number)
        const bukaTime = bukaHour * 60 + bukaMin
        const tutupTime = tutupHour * 60 + tutupMin
        isOpenNow = currentTime >= bukaTime && currentTime <= tutupTime
      }
      return {
        ...kantin,
        is_open_now: isOpenNow,
      }
    })

    return NextResponse.json({
      items: kantinWithStatus,
      count: kantinWithStatus.length,
      open_count: kantinWithStatus.filter(k => k.is_open_now).length,
    })
  } catch (error: any) {
    console.error('[list_all_kantin] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
