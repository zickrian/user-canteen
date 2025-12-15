import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function POST(request: NextRequest) {
  try {
    const { orderData } = await request.json()

    // Validate required fields
    if (!orderData || !orderData.items || !orderData.customerDetails) {
      return NextResponse.json(
        { error: 'Data pesanan tidak lengkap' },
        { status: 400 }
      )
    }

    // Only handle CASH in this route
    if (orderData.paymentMethod !== 'cash') {
      return NextResponse.json(
        { error: 'Endpoint ini hanya untuk pembayaran cash' },
        { status: 400 }
      )
    }

    // Generate unique order ID
    const pesananId = crypto.randomUUID()

    // Get next sequential nomor antrian for this kantin
    const { data: nomorAntrianData, error: nomorAntrianError } = await supabaseAdmin
      .rpc('get_next_nomor_antrian', { p_kantin_id: orderData.kantinId })

    if (nomorAntrianError) {
      console.error('Error getting nomor antrian:', nomorAntrianError)
      return NextResponse.json(
        { error: 'Gagal mendapatkan nomor antrian: ' + nomorAntrianError.message },
        { status: 500 }
      )
    }

    const nomorAntrian = nomorAntrianData || 1

    // Save order to database (pesanan table)
    const { data: order, error: orderError } = await supabaseAdmin
      .from('pesanan')
      .insert({
        id: pesananId,
        kantin_id: orderData.kantinId,
        nomor_antrian: nomorAntrian,
        nama_pemesan: orderData.customerDetails.nama_pelanggan || 'Pelanggan',
        catatan: orderData.customerDetails.catatan_pesanan || null,
        email: orderData.customerDetails.email || null,
        nomor_meja: orderData.customerDetails.nomor_meja || null,
        tipe_pesanan: orderData.customerDetails.tipe_pesanan || null,
        total_harga: orderData.grossAmount,
        status: 'menunggu'
      })
      .select()
      .single()

    if (orderError) {
      console.error('Error saving order to pesanan:', orderError)
      return NextResponse.json(
        { error: 'Gagal menyimpan pesanan: ' + orderError.message },
        { status: 500 }
      )
    }

    // Save order details (detail_pesanan table)
    const detailPesanan = orderData.items.map((item: any) => ({
      pesanan_id: pesananId,
      menu_id: item.menu.id,
      jumlah: item.quantity,
      harga_satuan: item.menu.harga,
      subtotal: item.menu.harga * item.quantity
    }))

    const { error: detailError } = await supabaseAdmin
      .from('detail_pesanan')
      .insert(detailPesanan)

    if (detailError) {
      console.error('Error saving order details:', detailError)
      return NextResponse.json(
        { error: 'Gagal menyimpan detail pesanan: ' + detailError.message },
        { status: 500 }
      )
    }

    // Save payment record (pembayaran table) with cash status
    const { error: paymentError } = await supabaseAdmin
      .from('pembayaran')
      .insert({
        pesanan_id: pesananId,
        midtrans_order_id: `CASH-${pesananId}`, // Placeholder for cash orders
        gross_amount: orderData.grossAmount,
        payment_type: 'cash',
        status: 'pending', // Waiting for cashier confirmation
        email_pelanggan: orderData.customerDetails.email,
        nomor_meja: orderData.customerDetails.nomor_meja,
        tipe_pesanan: orderData.customerDetails.tipe_pesanan
      })

    if (paymentError) {
      console.error('Error saving payment record:', paymentError)
      return NextResponse.json(
        { error: 'Gagal menyimpan record pembayaran: ' + paymentError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      orderId: pesananId,
      message: 'Pesanan cash berhasil dibuat. Silakan pembayaran di kasir.'
    })

  } catch (error) {
    console.error('Create cash order error:', error)
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat membuat pesanan: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    )
  }
}
