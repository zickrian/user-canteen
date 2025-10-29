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
  { params }: { params: { orderId: string } }
) {
  try {
    const { orderId } = params

    if (!orderId) {
      return NextResponse.json(
        { error: 'Order ID is required' },
        { status: 400 }
      )
    }

    // Get transaction status from Midtrans
    const transaction = await (snap as any).transaction.status(orderId)

    // Update order status in database if needed
    if (transaction.transaction_status === 'settlement') {
      const { error } = await supabase
        .from('pesanan')
        .update({ 
          status: 'diproses',
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId)

      if (error) {
        console.error('Error updating order status:', error)
      }
    }

    return NextResponse.json({
      status: transaction.transaction_status,
      orderId: transaction.order_id,
      grossAmount: transaction.gross_amount,
      paymentType: transaction.payment_type,
      transactionTime: transaction.transaction_time
    })

  } catch (error) {
    console.error('Error checking payment status:', error)
    return NextResponse.json(
      { error: 'Failed to check payment status' },
      { status: 500 }
    )
  }
}