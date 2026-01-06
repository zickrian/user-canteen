import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import MidtransClient from 'midtrans-client'

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

    // Only handle QRIS in this route
    if (orderData.paymentMethod === 'cash') {
      return NextResponse.json(
        { error: 'Gunakan endpoint /api/orders/create-cash-order untuk pembayaran cash' },
        { status: 400 }
      )
    }

    // Validate userId - check if user exists in auth.users
    let validUserId: string | null = null
    if (orderData.userId) {
      try {
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(orderData.userId)
        if (!authError && authUser?.user) {
          validUserId = orderData.userId
        } else {
          console.warn(`Invalid userId provided: ${orderData.userId}, will set to null`)
        }
      } catch (error) {
        console.warn(`Error validating userId ${orderData.userId}:`, error)
      }
    }

    // Generate unique Midtrans order ID
    const midtransOrderId = `ORDER-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`

    // Create item details for Midtrans
    const itemDetails = orderData.items.map((item: any) => ({
      id: item.menu.id,
      price: item.menu.harga,
      quantity: item.quantity,
      name: item.menu.nama_menu,
      category: item.menu.kategori_menu?.[0] || 'Makanan'
    }))

    // Create customer details for Midtrans
    const customerDetails = {
      first_name: orderData.customerDetails.nama_pelanggan || 'Pelanggan',
      email: orderData.customerDetails.email || 'customer@example.com',
      phone: orderData.customerDetails.nomor_meja || '-'
    }

    // Prepare order data for pending storage (single kios format converted to kiosOrders format)
    const kiosOrders = [{
      kantinId: orderData.kantinId,
      kantinName: orderData.kantinName || 'Kantin',
      items: orderData.items,
      subtotal: orderData.grossAmount
    }]

    // Save to pending_qris_orders - pesanan TIDAK dibuat sampai pembayaran berhasil
    const { error: pendingError } = await supabaseAdmin
      .from('pending_qris_orders')
      .insert({
        midtrans_order_id: midtransOrderId,
        order_data: JSON.stringify({
          kiosOrders,
          customerDetails: orderData.customerDetails,
          grossAmount: orderData.grossAmount,
          userId: validUserId
        }),
        status: 'pending',
        created_at: new Date().toISOString()
      })

    if (pendingError) {
      console.error('Error saving pending order:', pendingError)
      return NextResponse.json(
        { error: `Gagal menyimpan data pesanan: ${pendingError.message}` },
        { status: 500 }
      )
    }

    // Create Midtrans transaction
    const transaction = await (snap as any).createTransaction({
      transaction_details: {
        order_id: midtransOrderId,
        gross_amount: orderData.grossAmount
      },
      item_details: itemDetails,
      customer_details: customerDetails,
      // Menggunakan QRIS - bisa di-scan pakai e-wallet apapun (GoPay, OVO, Dana, dll)
      enabled_payments: ['qris']
    })

    // Return tanpa membuat pesanan - webhook akan handle setelah pembayaran berhasil
    return NextResponse.json({
      success: true,
      midtransOrderId,
      token: transaction.token,
      redirect_url: transaction.redirect_url,
      isPending: true,
      message: 'Silakan scan QRIS untuk pembayaran. Pesanan akan dibuat setelah pembayaran berhasil.'
    })

  } catch (error) {
    console.error('Midtrans error:', error)
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat memproses pembayaran: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    )
  }
}