import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

/**
 * Tandai pesanan selesai dari dashboard kios.
 * Saldo kantin hanya ditambahkan ketika pesanan diselesaikan.
 */
export async function POST(request: NextRequest) {
  try {
    const { pesananId } = await request.json()

    if (!pesananId) {
      return NextResponse.json(
        { error: 'pesananId diperlukan' },
        { status: 400 }
      )
    }

    // Ambil pesanan
    const { data: pesanan, error: pesananError } = await supabaseAdmin
      .from('pesanan')
      .select('id, kantin_id, total_harga, status')
      .eq('id', pesananId)
      .single()

    if (pesananError || !pesanan) {
      return NextResponse.json(
        { error: 'Pesanan tidak ditemukan' },
        { status: 404 }
      )
    }

    // Jangan dobel tambah saldo bila sudah selesai
    if (pesanan.status === 'selesai') {
      return NextResponse.json({
        success: true,
        message: 'Pesanan sudah selesai, tidak ada perubahan saldo'
      })
    }

    // Pastikan pembayaran sudah lunas
    const [{ data: qrisPayment }, { data: cashPayment }] = await Promise.all([
      supabaseAdmin
        .from('pembayaran')
        .select('status')
        .eq('pesanan_id', pesananId)
        .maybeSingle(),
      supabaseAdmin
        .from('pembayaran_cash')
        .select('status')
        .eq('pesanan_id', pesananId)
        .maybeSingle(),
    ])

    const qrisLunas = qrisPayment?.status === 'settlement'
    const cashLunas = cashPayment?.status === 'dikonfirmasi'

    if (!qrisLunas && !cashLunas) {
      return NextResponse.json(
        { error: 'Pembayaran belum lunas, tidak bisa diselesaikan' },
        { status: 400 }
      )
    }

    // Update status pesanan ke selesai
    const { error: updateError } = await supabaseAdmin
      .from('pesanan')
      .update({
        status: 'selesai',
        updated_at: new Date().toISOString()
      })
      .eq('id', pesananId)

    if (updateError) {
      console.error('Gagal update status pesanan:', updateError)
      return NextResponse.json(
        { error: 'Gagal menyelesaikan pesanan' },
        { status: 500 }
      )
    }

    // Tambah saldo kantin
    const { data: kantinData, error: kantinError } = await supabaseAdmin
      .from('kantin')
      .select('balance')
      .eq('id', pesanan.kantin_id)
      .single()

    if (kantinError) {
      console.error('Gagal mengambil data kantin:', kantinError)
      return NextResponse.json(
        { error: 'Gagal memperbarui saldo kantin' },
        { status: 500 }
      )
    }

    const currentBalance = kantinData?.balance || 0
    const newBalance = currentBalance + pesanan.total_harga

    const { error: balanceError } = await supabaseAdmin
      .from('kantin')
      .update({
        balance: newBalance,
        updated_at: new Date().toISOString()
      })
      .eq('id', pesanan.kantin_id)

    if (balanceError) {
      console.error('Error updating kantin balance:', balanceError)
      return NextResponse.json(
        { error: 'Gagal memperbarui saldo kantin' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Pesanan ditandai selesai dan saldo ditambahkan'
    })
  } catch (error) {
    console.error('Complete order error:', error)
    return NextResponse.json(
      { error: 'Terjadi kesalahan: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    )
  }
}

