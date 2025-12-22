import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import MidtransClient from 'midtrans-client'

// Initialize Midtrans
const snap = new MidtransClient.Snap({
  isProduction: false,
  serverKey: process.env.MIDTRANS_SERVER_KEY!,
  clientKey: process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY!
})

type OrderItem = {
  menu: {
    id: string
    nama_menu: string
    harga: number
    kategori_menu?: string[]
  }
  quantity: number
}

type KiosOrder = {
  kantinId: string
  kantinName: string
  items: OrderItem[]
  subtotal: number
}

type CustomerDetails = {
  nama_pelanggan: string
  email: string
  nomor_meja: string
  tipe_pesanan: 'dine_in' | 'take_away'
  catatan_pesanan?: string
}

export async function POST(request: NextRequest) {
  try {
    const { kiosOrders, customerDetails, paymentMethod, grossAmount, userId } = await request.json() as {
      kiosOrders: KiosOrder[]
      customerDetails: CustomerDetails
      paymentMethod: 'cash' | 'qris'
      grossAmount: number
      userId?: string | null
    }

    // Validate required fields
    if (!kiosOrders || kiosOrders.length === 0 || !customerDetails) {
      return NextResponse.json(
        { error: 'Data pesanan tidak lengkap' },
        { status: 400 }
      )
    }

    // Validate userId - check if user exists in auth.users
    let validUserId: string | null = null
    if (userId) {
      try {
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId)
        if (!authError && authUser?.user) {
          validUserId = userId
        } else {
          console.warn(`Invalid userId provided: ${userId}, will set to null`)
        }
      } catch (error) {
        console.warn(`Error validating userId ${userId}:`, error)
        // If validation fails, set to null to avoid FK constraint violation
      }
    }

    const createdOrders: { pesananId: string; kantinId: string; kantinName: string; subtotal: number }[] = []
    const midtransOrderId = `MULTI-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    // Create separate orders for each kios
    for (const kiosOrder of kiosOrders) {
      const pesananId = crypto.randomUUID()

      // Get next sequential nomor antrian for this kantin
      const { data: nomorAntrianData, error: nomorAntrianError } = await supabaseAdmin
        .rpc('get_next_nomor_antrian', { p_kantin_id: kiosOrder.kantinId })

      if (nomorAntrianError) {
        console.error('Error getting nomor antrian:', nomorAntrianError)
        return NextResponse.json(
          { error: `Gagal mendapatkan nomor antrian untuk ${kiosOrder.kantinName}: ${nomorAntrianError.message}` },
          { status: 500 }
        )
      }

      const nomorAntrian = nomorAntrianData || 1

      // Save order to pesanan table
      const { error: orderError } = await supabaseAdmin
        .from('pesanan')
        .insert({
          id: pesananId,
          kantin_id: kiosOrder.kantinId,
          nomor_antrian: nomorAntrian,
          nama_pemesan: customerDetails.nama_pelanggan || 'Pelanggan',
          catatan: customerDetails.catatan_pesanan || null,
          email: customerDetails.email || null,
          nomor_meja: customerDetails.nomor_meja || null,
          tipe_pesanan: customerDetails.tipe_pesanan || null,
          total_harga: kiosOrder.subtotal,
          status: 'menunggu',
          user_id: validUserId,
          payment_method: paymentMethod
        })

      if (orderError) {
        console.error('Error saving order:', orderError)
        return NextResponse.json(
          { error: `Gagal menyimpan pesanan untuk ${kiosOrder.kantinName}: ${orderError.message}` },
          { status: 500 }
        )
      }

      // Save order details
      const detailPesanan = kiosOrder.items.map((item) => ({
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
          { error: `Gagal menyimpan detail pesanan untuk ${kiosOrder.kantinName}: ${detailError.message}` },
          { status: 500 }
        )
      }

      // Save payment record based on payment method
      if (paymentMethod === 'cash') {
        const { error: paymentError } = await supabaseAdmin
          .from('pembayaran_cash')
          .insert({
            pesanan_id: pesananId,
            kantin_id: kiosOrder.kantinId,
            gross_amount: kiosOrder.subtotal,
            status: 'menunggu_pembayaran',
            email_pelanggan: customerDetails.email,
            nomor_meja: customerDetails.nomor_meja,
            tipe_pesanan: customerDetails.tipe_pesanan
          })

        if (paymentError) {
          console.error('Error saving cash payment record:', paymentError)
          return NextResponse.json(
            { error: `Gagal menyimpan record pembayaran untuk ${kiosOrder.kantinName}: ${paymentError.message}` },
            { status: 500 }
          )
        }
      } else {
        // QRIS - save to pembayaran table with shared midtrans order id
        const { error: paymentError } = await supabaseAdmin
          .from('pembayaran')
          .insert({
            pesanan_id: pesananId,
            midtrans_order_id: midtransOrderId,
            gross_amount: kiosOrder.subtotal,
            payment_type: 'qris',
            status: 'pending',
            email_pelanggan: customerDetails.email,
            nomor_meja: customerDetails.nomor_meja,
            tipe_pesanan: customerDetails.tipe_pesanan,
            payer_id: validUserId
          })

        if (paymentError) {
          console.error('Error saving qris payment record:', paymentError)
          return NextResponse.json(
            { error: `Gagal menyimpan record pembayaran untuk ${kiosOrder.kantinName}: ${paymentError.message}` },
            { status: 500 }
          )
        }
      }

      createdOrders.push({
        pesananId,
        kantinId: kiosOrder.kantinId,
        kantinName: kiosOrder.kantinName,
        subtotal: kiosOrder.subtotal
      })
    }

    // For QRIS, create Midtrans transaction
    if (paymentMethod === 'qris') {
      // Flatten all items for Midtrans
      const allItems = kiosOrders.flatMap(kiosOrder => 
        kiosOrder.items.map(item => ({
          id: item.menu.id,
          price: item.menu.harga,
          quantity: item.quantity,
          name: `${item.menu.nama_menu} (${kiosOrder.kantinName})`,
          category: item.menu.kategori_menu?.[0] || 'Makanan'
        }))
      )

      const transaction = await (snap as any).createTransaction({
        transaction_details: {
          order_id: midtransOrderId,
          gross_amount: grossAmount
        },
        item_details: allItems,
        customer_details: {
          first_name: customerDetails.nama_pelanggan || 'Pelanggan',
          email: customerDetails.email || 'customer@example.com',
          phone: customerDetails.nomor_meja || '-'
        },
        // Menggunakan GoPay agar QR dari GoPay langsung muncul di Snap
        enabled_payments: ['gopay']
      })

      return NextResponse.json({
        success: true,
        orders: createdOrders,
        midtransOrderId,
        totalAmount: grossAmount,
        token: transaction.token,
        redirect_url: transaction.redirect_url,
        message: `${createdOrders.length} pesanan berhasil dibuat. Silakan scan QRIS untuk pembayaran.`
      })
    }

    // For cash payment
    return NextResponse.json({
      success: true,
      orders: createdOrders,
      totalAmount: grossAmount,
      message: `${createdOrders.length} pesanan berhasil dibuat. Silakan pembayaran di masing-masing kasir kios.`
    })

  } catch (error) {
    console.error('Create multi-kios order error:', error)
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat membuat pesanan: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    )
  }
}
