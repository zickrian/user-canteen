/**
 * Tool — get_kantin_info
 * Info kantin (jam buka/tutup, status buka)
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

interface GetKantinInfoParams {
  kantin_id?: string
  kantin_name?: string
}

export async function POST(req: NextRequest) {
  try {
    const params: GetKantinInfoParams = await req.json()
    const { kantin_id, kantin_name } = params

    if (!kantin_id && !kantin_name) {
      return NextResponse.json({ error: 'kantin_id or kantin_name is required' }, { status: 400 })
    }

    let query = supabaseAdmin
      .from('kantin')
      .select('id, nama_kantin, jam_buka, jam_tutup, buka_tutup, status, foto_profil')
      .eq('status', 'aktif')

    if (kantin_id) {
      query = query.eq('id', kantin_id)
    } else if (kantin_name) {
      query = query.ilike('nama_kantin', `%${kantin_name}%`)
    }

    const { data, error } = await query.limit(1).single()

    if (error || !data) {
      console.error('[get_kantin_info] Error:', error)
      return NextResponse.json({ 
        kantin: null,
        message: 'Kantin tidak ditemukan'
      })
    }

    // Format jam buka/tutup
    const now = new Date()
    const currentHour = now.getHours()
    const currentMinute = now.getMinutes()
    const currentTime = currentHour * 60 + currentMinute

    let isOpenNow = data.buka_tutup
    if (data.jam_buka && data.jam_tutup && data.buka_tutup) {
      const [bukaHour, bukaMin] = data.jam_buka.split(':').map(Number)
      const [tutupHour, tutupMin] = data.jam_tutup.split(':').map(Number)
      const bukaTime = bukaHour * 60 + bukaMin
      const tutupTime = tutupHour * 60 + tutupMin
      isOpenNow = currentTime >= bukaTime && currentTime <= tutupTime
    }

    return NextResponse.json({
      kantin: {
        ...data,
        is_open_now: isOpenNow,
      }
    })
  } catch (error: any) {
    console.error('[get_kantin_info] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
