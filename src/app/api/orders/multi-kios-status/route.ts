import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function POST(request: NextRequest) {
  try {
    const { pesananIds } = await request.json()

    if (!pesananIds || !Array.isArray(pesananIds) || pesananIds.length === 0) {
      return NextResponse.json(
        { error: 'pesananIds diperlukan' },
        { status: 400 }
      )
    }

    // Fetch all orders
    const { data: pesananList, error: pesananError } = await supabaseAdmin
      .from('pesanan')
      .select(`
        id,
        kantin_id,
        nomor_antrian,
        nama_pemesan,
        email,
        nomor_meja,
        tipe_pesanan,
        total_harga,
        status,
        created_at
      `)
      .in('id', pesananIds)

    if (pesananError) {
      return NextResponse.json(
        { error: 'Gagal memuat pesanan' },
        { status: 500 }
      )
    }

    // Fetch kantin info for each order
    const kantinIds = [...new Set(pesananList.map(p => p.kantin_id))]
    const { data: kantinList } = await supabaseAdmin
      .from('kantin')
      .select('id, nama_kantin')
      .in('id', kantinIds)

    const kantinMap = new Map(kantinList?.map(k => [k.id, k.nama_kantin]) || [])

    // Fetch payment status for each order (check both pembayaran and pembayaran_cash)
    const ordersWithStatus = await Promise.all(
      pesananList.map(async (pesanan) => {
        // Check QRIS payment
        const { data: qrisPayment } = await supabaseAdmin
          .from('pembayaran')
          .select('status, payment_type')
          .eq('pesanan_id', pesanan.id)
          .maybeSingle()

        // Check Cash payment
        const { data: cashPayment } = await supabaseAdmin
          .from('pembayaran_cash')
          .select('status')
          .eq('pesanan_id', pesanan.id)
          .maybeSingle()

        let paymentStatus = 'pending'
        let paymentMethod = 'unknown'

        if (qrisPayment) {
          paymentMethod = qrisPayment.payment_type || 'qris'
          paymentStatus = qrisPayment.status === 'settlement' ? 'lunas' : 'pending'
        } else if (cashPayment) {
          paymentMethod = 'cash'
          paymentStatus = cashPayment.status === 'dikonfirmasi' ? 'lunas' : 'pending'
        }

        return {
          pesananId: pesanan.id,
          kantinId: pesanan.kantin_id,
          kantinName: kantinMap.get(pesanan.kantin_id) || 'Unknown',
          nomorAntrian: pesanan.nomor_antrian,
          subtotal: pesanan.total_harga,
          status: pesanan.status,
          paymentStatus,
          paymentMethod,
          namaPemesan: pesanan.nama_pemesan,
          nomorMeja: pesanan.nomor_meja,
          createdAt: pesanan.created_at
        }
      })
    )

    // Check if all orders are paid
    const allPaid = ordersWithStatus.every(o => o.paymentStatus === 'lunas')

    return NextResponse.json({
      success: true,
      orders: ordersWithStatus,
      allPaid,
      totalAmount: ordersWithStatus.reduce((sum, o) => sum + o.subtotal, 0)
    })

  } catch (error) {
    console.error('Multi-kios status error:', error)
    return NextResponse.json(
      { error: 'Terjadi kesalahan' },
      { status: 500 }
    )
  }
}
