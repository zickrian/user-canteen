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

    // Update order status in database for all related pesanan
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

    const pesananIds = payments.map(p => p.pesanan_id)
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

    // Update kantin balance jika pembayaran settlement
    if (transaction_status === 'settlement') {
      // Get pesanan details untuk mendapatkan kantin_id dan total_harga (multi-kios)
      const { data: pesananDataList } = await supabaseAdmin
        .from('pesanan')
        .select('id, kantin_id, total_harga')
        .in('id', pesananIds)

      if (pesananDataList && pesananDataList.length > 0) {
        for (const pesananData of pesananDataList) {
          // Get current balance per kantin
          const { data: kantinData } = await supabaseAdmin
            .from('kantin')
            .select('balance')
            .eq('id', pesananData.kantin_id)
            .single()

          const currentBalance = kantinData?.balance || 0
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