import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import crypto from 'crypto'

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

    // Find payment record(s) by midtrans order id (multi-kios friendly)
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