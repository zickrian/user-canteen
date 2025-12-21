import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

export async function GET(request: NextRequest) {
  try {
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: 'Supabase configuration missing' },
        { status: 500 }
      )
    }

    // Get auth token from request
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    })

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Fetch orders for this user
    const { data: orders, error: ordersError } = await supabase
      .from('pesanan')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (ordersError) {
      console.error('Error fetching orders:', ordersError)
      return NextResponse.json(
        { error: 'Failed to fetch orders' },
        { status: 500 }
      )
    }

    if (!orders || orders.length === 0) {
      return NextResponse.json({
        success: true,
        orders: [],
      })
    }

    // Fetch kantin info
    const kantinIds = [...new Set(orders.map((o: any) => o.kantin_id))]
    const { data: kantinList } = await supabase
      .from('kantin')
      .select('id, nama_kantin')
      .in('id', kantinIds)

    const kantinMap = new Map((kantinList || []).map((k: any) => [k.id, k]))

    // Fetch order details and payment status for each order
    const ordersWithPayment = await Promise.all(
      orders.map(async (order: any) => {
        // Fetch detail pesanan
        const { data: detailPesananRaw } = await supabase
          .from('detail_pesanan')
          .select('*')
          .eq('pesanan_id', order.id)

        // Join menu manually
        let detailPesanan = detailPesananRaw || []
        if (detailPesanan.length > 0) {
          const menuIds = detailPesanan.map((d: any) => d.menu_id)
          const { data: menus } = await supabase
            .from('menu')
            .select('id, nama_menu, foto_menu')
            .in('id', menuIds)

          const menuMap = new Map((menus || []).map((m: any) => [m.id, m]))
          detailPesanan = detailPesanan.map((d: any) => ({
            ...d,
            menu: menuMap.get(d.menu_id) || null,
          }))
        }

        // Check QRIS payment
        const { data: qrisPayment } = await supabase
          .from('pembayaran')
          .select('status, payment_type')
          .eq('pesanan_id', order.id)
          .maybeSingle()

        // Check Cash payment
        const { data: cashPayment } = await supabase
          .from('pembayaran_cash')
          .select('status')
          .eq('pesanan_id', order.id)
          .maybeSingle()

        let paymentStatus = 'pending'
        let paymentMethod = 'unknown'

        if (qrisPayment) {
          paymentMethod = qrisPayment.payment_type || 'qris'
          paymentStatus = qrisPayment.status === 'settlement' ? 'paid' : 'pending'
        } else if (cashPayment) {
          paymentMethod = 'cash'
          paymentStatus = cashPayment.status === 'dikonfirmasi' ? 'paid' : 'pending'
        }

        return {
          ...order,
          kantin: kantinMap.get(order.kantin_id) || null,
          detail_pesanan: detailPesanan,
          paymentStatus,
          paymentMethod,
        }
      })
    )

    return NextResponse.json({
      success: true,
      orders: ordersWithPayment,
    })
  } catch (error) {
    console.error('Order history error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

