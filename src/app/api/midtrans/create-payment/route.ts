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

    // Generate unique order ID
    const orderId = `ORDER-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    // Create transaction details
    const transactionDetails = {
      order_id: orderId,
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

    // Save order to database
    const { data: order, error: orderError } = await supabase
      .from('pesanan')
      .insert({
        id: orderId,
        kantin_id: orderData.kantinId,
        nomor_antrian: Math.floor(Math.random() * 100) + 1,
        nama_pemesan: orderData.customerDetails.nama_pelanggan || 'Pelanggan',
        catatan: orderData.customerDetails.catatan_pesanan,
        total_harga: orderData.grossAmount,
        status: 'menunggu'
      })
      .select()
      .single()

    if (orderError) {
      console.error('Error saving order:', orderError)
      return NextResponse.json(
        { error: 'Gagal menyimpan pesanan' },
        { status: 500 }
      )
    }

    // Save order details
    const detailPesanan = orderData.items.map((item: any) => ({
      pesanan_id: orderId,
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
        { error: 'Gagal menyimpan detail pesanan' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      orderId,
      token: transaction.token,
      redirect_url: transaction.redirect_url
    })

  } catch (error) {
    console.error('Midtrans error:', error)
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat memproses pembayaran' },
      { status: 500 }
    )
  }
}