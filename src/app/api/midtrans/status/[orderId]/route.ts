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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params

    if (!orderId) {
      return NextResponse.json(
        { error: 'Order ID is required' },
        { status: 400 }
      )
    }

    // Get transaction status from Midtrans using the midtrans order ID
    const transaction = await (snap as any).transaction.status(orderId)

    // Find the pesanan by midtrans order ID first
    const { data: paymentData, error: paymentFetchError } = await supabase
      .from('pembayaran')
      .select('pesanan_id, status')
      .eq('midtrans_order_id', orderId)
      .single()

    if (paymentFetchError || !paymentData) {
      console.error('Payment record not found:', paymentFetchError)
      return NextResponse.json(
        { error: 'Payment record not found' },
        { status: 404 }
      )
    }

    const pesananId = paymentData.pesanan_id
    const midtransStatus = transaction.transaction_status

    // Map Midtrans status to our payment status
    let paymentStatus = 'pending'
    if (midtransStatus === 'settlement') {
      paymentStatus = 'settlement'
    } else if (['expire', 'cancel', 'deny'].includes(midtransStatus)) {
      paymentStatus = midtransStatus
    }

    // Update payment record
    const { error: paymentUpdateError } = await supabase
      .from('pembayaran')
      .update({
        status: paymentStatus,
        midtrans_transaction_id: transaction.transaction_id,
        updated_at: new Date().toISOString()
      })
      .eq('midtrans_order_id', orderId)

    if (paymentUpdateError) {
      console.error('Error updating payment record:', paymentUpdateError)
    }

    // The pesanan status will be updated automatically via trigger
    // when pembayaran status changes to settlement

    return NextResponse.json({
      status: midtransStatus,
      paymentStatus: paymentStatus,
      orderId: transaction.order_id,
      pesananId: pesananId,
      grossAmount: transaction.gross_amount,
      paymentType: transaction.payment_type,
      transactionTime: transaction.transaction_time
    })

  } catch (error) {
    console.error('Error checking payment status:', error)
    return NextResponse.json(
      { error: 'Failed to check payment status: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    )
  }
}