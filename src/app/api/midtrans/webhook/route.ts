import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import crypto from 'crypto'

type KiosOrder = {
  kantinId: string
  kantinName: string
  items: {
    menu: {
      id: string
      nama_menu: string
      harga: number
    }
    quantity: number
  }[]
  subtotal: number
}

type CustomerDetails = {
  nama_pelanggan: string
  email: string
  nomor_meja: string
  tipe_pesanan: 'dine_in' | 'take_away'
  catatan_pesanan?: string
}

type PendingOrderData = {
  kiosOrders: KiosOrder[]
  customerDetails: CustomerDetails
  grossAmount: number
  userId: string | null
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const notification = JSON.parse(body)
    const { order_id, transaction_status, fraud_status, status_code, gross_amount, signature_key } = notification

    // Verify signature per Midtrans docs: sha512(order_id + status_code + gross_amount + serverKey)
    const serverKey = process.env.MIDTRANS_SERVER_KEY!
    const expectedSignature = crypto
      .createHash('sha512')
      .update(`${order_id}${status_code}${gross_amount}${serverKey}`)
      .digest('hex')

    if (!signature_key || expectedSignature !== signature_key) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      )
    }

    console.log(`[Webhook] Received notification for order ${order_id}: ${transaction_status}`)

    // Check if this is a pending QRIS order (new flow)
    const { data: pendingOrder, error: pendingError } = await supabaseAdmin
      .from('pending_qris_orders')
      .select('*')
      .eq('midtrans_order_id', order_id)
      .eq('status', 'pending')
      .single()

    if (pendingOrder && !pendingError) {
      // New flow: Order was not created yet, handle based on payment status
      console.log(`[Webhook] Found pending order for ${order_id}`)

      if (transaction_status === 'settlement') {
        // Payment successful - create the actual orders now
        const orderData: PendingOrderData = JSON.parse(pendingOrder.order_data)
        const { kiosOrders, customerDetails, userId } = orderData

        const createdOrders: { pesananId: string; kantinId: string; kantinName: string; subtotal: number }[] = []

        for (const kiosOrder of kiosOrders) {
          const pesananId = crypto.randomUUID()

          // Get next sequential nomor antrian for this kantin
          const { data: nomorAntrianData, error: nomorAntrianError } = await supabaseAdmin
            .rpc('get_next_nomor_antrian', { p_kantin_id: kiosOrder.kantinId })

          if (nomorAntrianError) {
            console.error('Error getting nomor antrian:', nomorAntrianError)
            continue
          }

          const nomorAntrian = nomorAntrianData || 1

          // Create order in pesanan table
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
              status: 'diproses', // Already paid, so set to diproses
              user_id: userId,
              payment_method: 'qris'
            })

          if (orderError) {
            console.error('Error creating order:', orderError)
            continue
          }

          // Create order details
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
            console.error('Error creating order details:', detailError)
          }

          // Create payment record
          const { error: paymentError } = await supabaseAdmin
            .from('pembayaran')
            .insert({
              pesanan_id: pesananId,
              midtrans_order_id: order_id,
              midtrans_transaction_id: notification.transaction_id,
              gross_amount: kiosOrder.subtotal,
              payment_type: 'qris',
              status: 'settlement',
              email_pelanggan: customerDetails.email,
              nomor_meja: customerDetails.nomor_meja,
              tipe_pesanan: customerDetails.tipe_pesanan,
              payer_id: userId
            })

          if (paymentError) {
            console.error('Error creating payment record:', paymentError)
          }

          createdOrders.push({
            pesananId,
            kantinId: kiosOrder.kantinId,
            kantinName: kiosOrder.kantinName,
            subtotal: kiosOrder.subtotal
          })
        }

        // Mark pending order as processed
        await supabaseAdmin
          .from('pending_qris_orders')
          .update({ 
            status: 'processed',
            processed_at: new Date().toISOString()
          })
          .eq('id', pendingOrder.id)

        console.log(`[Webhook] Created ${createdOrders.length} orders for ${order_id}`)
        return NextResponse.json({ success: true, orders: createdOrders })

      } else if (['cancel', 'expire', 'deny'].includes(transaction_status)) {
        // Payment failed/cancelled - just mark pending order as cancelled
        await supabaseAdmin
          .from('pending_qris_orders')
          .update({ 
            status: transaction_status === 'expire' ? 'expired' : 'cancelled',
            processed_at: new Date().toISOString()
          })
          .eq('id', pendingOrder.id)

        console.log(`[Webhook] Marked pending order ${order_id} as ${transaction_status}`)
        return NextResponse.json({ success: true })
      }

      // For pending status, just acknowledge
      return NextResponse.json({ success: true })
    }

    // Old flow: Orders were already created, find them by midtrans_order_id
    const { data: payments, error: paymentFetchError } = await supabaseAdmin
      .from('pembayaran')
      .select('pesanan_id')
      .eq('midtrans_order_id', order_id)

    if (paymentFetchError || !payments || payments.length === 0) {
      console.error('Payment record not found:', paymentFetchError)
      return NextResponse.json(
        { error: 'Payment record not found' },
        { status: 404 }
      )
    }

    const pesananIds = payments.map(p => p.pesanan_id)

    // Kalau transaksi dibatalkan / expire / ditolak:
    // - hapus pembayaran
    // - hapus detail_pesanan
    // - hapus pesanan
    // Sehingga tidak muncul di history maupun pemesanan kios.
    if (
      transaction_status === 'cancel' ||
      transaction_status === 'expire' ||
      transaction_status === 'deny'
    ) {
      // Hapus detail_pesanan terlebih dahulu (FK ke pesanan)
      const { error: detailDeleteError } = await supabaseAdmin
        .from('detail_pesanan')
        .delete()
        .in('pesanan_id', pesananIds)

      if (detailDeleteError) {
        console.error('Error deleting detail_pesanan for canceled transaction:', detailDeleteError)
      }

      const { error: pesananDeleteError } = await supabaseAdmin
        .from('pesanan')
        .delete()
        .in('id', pesananIds)

      if (pesananDeleteError) {
        console.error('Error deleting pesanan for canceled transaction:', pesananDeleteError)
      }

      const { error: pembayaranDeleteError } = await supabaseAdmin
        .from('pembayaran')
        .delete()
        .eq('midtrans_order_id', order_id)

      if (pembayaranDeleteError) {
        console.error('Error deleting pembayaran for canceled transaction:', pembayaranDeleteError)
      }

      return NextResponse.json({ success: true })
    }

    // Selain dibatalkan (settlement / capture / pending), update status pembayaran & pesanan
    let paymentStatus = 'pending'
    if (transaction_status === 'settlement') {
      paymentStatus = 'settlement'
    } else if (transaction_status === 'expire') {
      paymentStatus = 'expire'
    } else if (transaction_status === 'cancel') {
      paymentStatus = 'cancel'
    } else if (transaction_status === 'deny') {
      paymentStatus = 'deny'
    }

    const { error: paymentUpdateError } = await supabaseAdmin
      .from('pembayaran')
      .update({
        status: paymentStatus,
        midtrans_transaction_id: notification.transaction_id,
        updated_at: new Date().toISOString()
      })
      .eq('midtrans_order_id', order_id)

    if (paymentUpdateError) {
      console.error('Error updating payment record:', paymentUpdateError)
    }

    // Update order status di tabel pesanan
    let newStatus = 'menunggu'
    
    if (transaction_status === 'capture') {
      if (fraud_status === 'challenge') {
        newStatus = 'menunggu'
      } else if (fraud_status === 'accept') {
        newStatus = 'diproses'
      }
    } else if (transaction_status === 'settlement') {
      newStatus = 'diproses'
    } else if (transaction_status === 'cancel' || transaction_status === 'deny' || transaction_status === 'expire') {
      newStatus = 'menunggu'
    } else if (transaction_status === 'pending') {
      newStatus = 'menunggu'
    }

    const { error: pesananUpdateError } = await supabaseAdmin
      .from('pesanan')
      .update({ 
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .in('id', pesananIds)

    if (pesananUpdateError) {
      console.error('Error updating pesanan status:', pesananUpdateError)
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}