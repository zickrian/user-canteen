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

    // Validate payment method - must be 'cash' or 'qris'
    if (!paymentMethod || (paymentMethod !== 'cash' && paymentMethod !== 'qris')) {
      return NextResponse.json(
        { error: 'Metode pembayaran tidak valid. Harus cash atau qris' },
        { status: 400 }
      )
    }

    // Normalize payment method to match database constraint
    // Database constraint allows: 'cash', 'qris', or 'midtrans'
    // We map 'qris' to 'qris' (not 'midtrans') to match the constraint
    const normalizedPaymentMethod: 'cash' | 'qris' = paymentMethod === 'cash' ? 'cash' : 'qris'

    // Validate userId - check if user exists in auth.users
    let validUserId: string | null = null
    if (userId) {
      try {
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId)
        if (!authError && authUser?.user) {
          validUserId = userId
          console.log(`Valid userId: ${userId}`)
        } else {
          console.warn(`Invalid userId provided: ${userId}, error: ${authError?.message || 'User not found'}, will set to null`)
        }
      } catch (error) {
        console.warn(`Error validating userId ${userId}:`, error)
        // If validation fails, set to null to avoid FK constraint violation
      }
    } else {
      console.log('No userId provided, will set user_id to null')
    }

    const createdOrders: { pesananId: string; kantinId: string; kantinName: string; subtotal: number }[] = []
    const midtransOrderId = `MULTI-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`

    // For QRIS: Don't create order yet, just create Midtrans transaction
    // Order will be created by webhook after payment success
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

      // Save pending order data to a temporary table for webhook to process
      const { error: pendingError } = await supabaseAdmin
        .from('pending_qris_orders')
        .insert({
          midtrans_order_id: midtransOrderId,
          order_data: JSON.stringify({
            kiosOrders,
            customerDetails,
            grossAmount,
            userId: validUserId
          }),
          status: 'pending',
          created_at: new Date().toISOString()
        })

      if (pendingError) {
        console.error('Error saving pending order:', pendingError)
        // Fallback: create order immediately if pending table doesn't exist
        // This maintains backward compatibility
        if (pendingError.code === '42P01') { // Table doesn't exist
          console.log('pending_qris_orders table not found, creating orders immediately')
          // Continue with old flow below
        } else {
          return NextResponse.json(
            { error: `Gagal menyimpan data pesanan: ${pendingError.message}` },
            { status: 500 }
          )
        }
      } else {
        // Successfully saved to pending table, create Midtrans transaction
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
          // Biarkan Midtrans tampilkan semua payment channel yang aktif
          // enabled_payments tidak di-set agar semua channel muncul
        })

        // Return without creating actual orders - webhook will handle it
        return NextResponse.json({
          success: true,
          orders: [], // Empty for now, will be created after payment
          midtransOrderId,
          totalAmount: grossAmount,
          token: transaction.token,
          redirect_url: transaction.redirect_url,
          isPending: true, // Flag to indicate orders not yet created
          message: `Silakan scan QRIS untuk pembayaran. Pesanan akan dibuat setelah pembayaran berhasil.`
        })
      }
    }

    // For CASH or fallback QRIS (if pending table doesn't exist): Create orders immediately
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
          payment_method: normalizedPaymentMethod
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

      // Save payment record for cash
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
      }

      createdOrders.push({
        pesananId,
        kantinId: kiosOrder.kantinId,
        kantinName: kiosOrder.kantinName,
        subtotal: kiosOrder.subtotal
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
