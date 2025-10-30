import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import MidtransClient from 'midtrans-client'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Initialize Midtrans
const snap = new MidtransClient.Snap({
  isProduction: false,
  serverKey: process.env.MIDTRANS_SERVER_KEY!,
  clientKey: process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY!
})

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

    // Generate unique order IDs
    const pesananId = crypto.randomUUID() // For database pesanan table
    const midtransOrderId = `ORDER-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` // For Midtrans

    // Get next sequential nomor antrian for this kantin
    const { data: nomorAntrianData, error: nomorAntrianError } = await supabase
      .rpc('get_next_nomor_antrian', { p_kantin_id: orderData.kantinId })

    if (nomorAntrianError) {
      console.error('Error getting nomor antrian:', nomorAntrianError)
      return NextResponse.json(
        { error: 'Gagal mendapatkan nomor antrian: ' + nomorAntrianError.message },
        { status: 500 }
      )
    }

    const nomorAntrian = nomorAntrianData || 1

    // Create transaction details for Midtrans
    const transactionDetails = {
      order_id: midtransOrderId,
      gross_amount: orderData.grossAmount
    }

    // Create item details
    const itemDetails = orderData.items.map((item: any) => ({
      id: item.menu.id,
      price: item.menu.harga,
      quantity: item.quantity,
      name: item.menu.nama_menu,
      category: item.menu.kategori_menu?.[0] || 'Makanan'
    }))

    // Create customer details
    const customerDetails = {
      first_name: orderData.customerDetails.nama_pelanggan || 'Pelanggan',
      email: orderData.customerDetails.email || 'customer@example.com',
      phone: orderData.customerDetails.nomor_meja || '-'
    }

    // Create Midtrans transaction
    const transaction = await (snap as any).createTransaction({
      transaction_details: transactionDetails,
      item_details: itemDetails,
      customer_details: customerDetails,
      enabled_payments: ['qris']
    })

    // Save order to database (pesanan table) dengan semua data yang diperlukan
    const { data: order, error: orderError } = await supabase
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

    const { error: detailError } = await supabase
      .from('detail_pesanan')
      .insert(detailPesanan)

    if (detailError) {
      console.error('Error saving order details:', detailError)
      return NextResponse.json(
        { error: 'Gagal menyimpan detail pesanan: ' + detailError.message },
        { status: 500 }
      )
    }

    // Save payment record (pembayaran table)
    const { error: paymentError } = await supabase
      .from('pembayaran')
      .insert({
        pesanan_id: pesananId,
        midtrans_order_id: midtransOrderId,
        gross_amount: orderData.grossAmount,
        payment_type: 'qris',
        status: 'pending',
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
      midtransOrderId,
      token: transaction.token,
      redirect_url: transaction.redirect_url
    })

  } catch (error) {
    console.error('Midtrans error:', error)
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat memproses pembayaran: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    )
  }
}