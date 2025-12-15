import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get('x-callback-signature')
    
    if (!signature) {
      return NextResponse.json(
        { error: 'Signature not found' },
        { status: 400 }
      )
    }

    // Verify signature
    const serverKey = process.env.MIDTRANS_SERVER_KEY!
    const hash = crypto.createHash('sha512').update(body + serverKey).digest('hex')
    
    if (hash !== signature) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      )
    }

    const notification = JSON.parse(body)
    const { order_id, transaction_status, fraud_status } = notification

    // Find payment record by midtrans order id
    const { data: paymentData, error: paymentFetchError } = await supabaseAdmin
      .from('pembayaran')
      .select('pesanan_id')
      .eq('midtrans_order_id', order_id)
      .single()

    if (paymentFetchError || !paymentData) {
      console.error('Payment record not found:', paymentFetchError)
      return NextResponse.json(
        { error: 'Payment record not found' },
        { status: 404 }
      )
    }

    const pesananId = paymentData.pesanan_id

    // Update payment status
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

    // Update order status in database
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
      newStatus = 'menunggu' // Or you could add a 'dibatalkan' status
    } else if (transaction_status === 'pending') {
      newStatus = 'menunggu'
    }

    const { error: pesananUpdateError } = await supabaseAdmin
      .from('pesanan')
      .update({ 
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', pesananId)

    if (pesananUpdateError) {
      console.error('Error updating pesanan status:', pesananUpdateError)
    }

    // Update kantin balance jika pembayaran settlement
    if (transaction_status === 'settlement') {
      // Get pesanan details untuk mendapatkan kantin_id dan total_harga
      const { data: pesananData } = await supabaseAdmin
        .from('pesanan')
        .select('kantin_id, total_harga')
        .eq('id', pesananId)
        .single()

      if (pesananData) {
        // Get current balance
        const { data: kantinData } = await supabaseAdmin
          .from('kantin')
          .select('balance')
          .eq('id', pesananData.kantin_id)
          .single()

        const currentBalance = kantinData?.balance || 0
        // Tambahkan hanya total_harga pesanan ini, bukan total keseluruhan
        const newBalance = currentBalance + pesananData.total_harga

        // Update balance
        const { error: balanceError } = await supabaseAdmin
          .from('kantin')
          .update({ 
            balance: newBalance,
            updated_at: new Date().toISOString()
          })
          .eq('id', pesananData.kantin_id)

        if (balanceError) {
          console.error('Error updating kantin balance:', balanceError)
        }
      }
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