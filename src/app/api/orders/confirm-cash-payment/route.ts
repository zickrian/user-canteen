import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

/**
 * API untuk update status pembayaran cash dari kasir
 * Digunakan oleh dashboard kios untuk mengkonfirmasi pembayaran cash
 */
export async function POST(request: NextRequest) {
  try {
    const { pesananId, paymentType } = await request.json()

    if (!pesananId) {
      return NextResponse.json(
        { error: 'pesananId diperlukan' },
        { status: 400 }
      )
    }

    // Fetch payment record
    const { data: paymentData, error: paymentFetchError } = await supabaseAdmin
      .from('pembayaran')
      .select('*')
      .eq('pesanan_id', pesananId)
      .single()

    if (paymentFetchError || !paymentData) {
      return NextResponse.json(
        { error: 'Pembayaran tidak ditemukan' },
        { status: 404 }
      )
    }

    // Only update cash payments
    if (paymentData.payment_type !== 'cash') {
      return NextResponse.json(
        { error: 'Endpoint ini hanya untuk pembayaran cash' },
        { status: 400 }
      )
    }

    // Update payment status to settlement
    const { error: paymentUpdateError } = await supabaseAdmin
      .from('pembayaran')
      .update({
        status: 'settlement',
        updated_at: new Date().toISOString()
      })
      .eq('pesanan_id', pesananId)

    if (paymentUpdateError) {
      console.error('Error updating payment status:', paymentUpdateError)
      return NextResponse.json(
        { error: 'Gagal update status pembayaran' },
        { status: 500 }
      )
    }

    // Update pesanan status to diproses
    const { error: pesananUpdateError } = await supabaseAdmin
      .from('pesanan')
      .update({
        status: 'diproses',
        updated_at: new Date().toISOString()
      })
      .eq('id', pesananId)

    if (pesananUpdateError) {
      console.error('Error updating pesanan status:', pesananUpdateError)
      return NextResponse.json(
        { error: 'Gagal update status pesanan' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Pembayaran cash berhasil dikonfirmasi'
    })

  } catch (error) {
    console.error('Update cash payment status error:', error)
    return NextResponse.json(
      { error: 'Terjadi kesalahan: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    )
  }
}
