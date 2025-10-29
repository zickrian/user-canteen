import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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

    const { error } = await supabase
      .from('pesanan')
      .update({ 
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', order_id)

    if (error) {
      console.error('Error updating order status:', error)
      return NextResponse.json(
        { error: 'Failed to update order status' },
        { status: 500 }
      )
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