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

    // Fetch orders for this user - include both user_id match and email match (for orders with null user_id)
    // This handles cases where orders were created with user_id = null but email matches
    // We'll fetch orders by user_id first, then also fetch orders by email if user_id is null
    const { data: ordersByUserId, error: ordersByUserIdError } = await supabase
      .from('pesanan')
      .select(`
        id,
        kantin_id,
        nomor_antrian,
        nama_pemesan,
        email,
        nomor_meja,
        tipe_pesanan,
        catatan,
        total_harga,
        status,
        payment_method,
        user_id,
        created_at
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    // Also fetch orders by email if user_id is null (for guest checkout that matches user email)
    const { data: ordersByEmail, error: ordersByEmailError } = await supabase
      .from('pesanan')
      .select(`
        id,
        kantin_id,
        nomor_antrian,
        nama_pemesan,
        email,
        nomor_meja,
        tipe_pesanan,
        catatan,
        total_harga,
        status,
        payment_method,
        user_id,
        created_at
      `)
      .is('user_id', null)
      .eq('email', user.email || '')
      .order('created_at', { ascending: false })

    // Combine both results and remove duplicates
    const allOrders = [
      ...(ordersByUserId || []),
      ...(ordersByEmail || [])
    ]
    
    // Remove duplicates by id
    const uniqueOrders = Array.from(
      new Map(allOrders.map((order: any) => [order.id, order])).values()
    )

    // Sort by created_at descending
    uniqueOrders.sort((a: any, b: any) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )

    const orders = uniqueOrders
    const ordersError = ordersByUserIdError || ordersByEmailError

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
      .select('id, nama_kantin, foto_profil')
      .in('id', kantinIds)

    const kantinMap = new Map((kantinList || []).map((k: any) => [k.id, k]))

    // Get payment methods from payment tables for orders that don't have payment_method set
    const orderIdsWithoutPaymentMethod = orders
      .filter((o: any) => !o.payment_method)
      .map((o: any) => o.id)

    let paymentMethodMap = new Map<string, string>()

    if (orderIdsWithoutPaymentMethod.length > 0) {
      // Check pembayaran table (QRIS)
      const { data: qrisPayments } = await supabase
        .from('pembayaran')
        .select('pesanan_id, payment_type')
        .in('pesanan_id', orderIdsWithoutPaymentMethod)

      if (qrisPayments) {
        qrisPayments.forEach((p: any) => {
          paymentMethodMap.set(p.pesanan_id, 'qris')
        })
      }

      // Check pembayaran_cash table (Cash)
      const { data: cashPayments } = await supabase
        .from('pembayaran_cash')
        .select('pesanan_id')
        .in('pesanan_id', orderIdsWithoutPaymentMethod)

      if (cashPayments) {
        cashPayments.forEach((p: any) => {
          // Only set if not already set from qrisPayments
          if (!paymentMethodMap.has(p.pesanan_id)) {
            paymentMethodMap.set(p.pesanan_id, 'cash')
          }
        })
      }
    }

    // Fetch detail pesanan (menu items) for all orders
    const orderIds = orders.map((o: any) => o.id)
    const { data: detailPesananRaw } = await supabase
      .from('detail_pesanan')
      .select('*')
      .in('pesanan_id', orderIds)

    // Fetch menu info for all menu_ids
    const menuIds = [...new Set((detailPesananRaw || []).map((d: any) => d.menu_id))]
    const { data: menus } = menuIds.length > 0 ? await supabase
      .from('menu')
      .select('id, nama_menu, harga, foto_menu')
      .in('id', menuIds) : { data: [] }

    const menuMap = new Map((menus || []).map((m: any) => [m.id, m]))

    // Group detail pesanan by pesanan_id
    const detailPesananByOrderId = new Map<string, any[]>()
    if (detailPesananRaw) {
      detailPesananRaw.forEach((detail: any) => {
        const menu = menuMap.get(detail.menu_id) || null
        const detailWithMenu = {
          ...detail,
          menu: menu
        }
        if (!detailPesananByOrderId.has(detail.pesanan_id)) {
          detailPesananByOrderId.set(detail.pesanan_id, [])
        }
        detailPesananByOrderId.get(detail.pesanan_id)!.push(detailWithMenu)
      })
    }

    // Map orders dengan nama kantin, payment method, dan detail menu
    const ordersWithDetails = orders.map((order: any) => {
      // Get payment method dari payment_method field atau dari tabel pembayaran
      let paymentMethod = order.payment_method || paymentMethodMap.get(order.id) || null

      return {
        id: order.id,
        kantin: kantinMap.get(order.kantin_id) || null,
        nomor_antrian: order.nomor_antrian,
        nama_pemesan: order.nama_pemesan,
        email: order.email,
        nomor_meja: order.nomor_meja,
        tipe_pesanan: order.tipe_pesanan,
        catatan: order.catatan,
        total_harga: order.total_harga,
        status: order.status,
        payment_method: paymentMethod,
        created_at: order.created_at,
        items: detailPesananByOrderId.get(order.id) || [],
      }
    })

    return NextResponse.json({
      success: true,
      orders: ordersWithDetails,
    })
  } catch (error) {
    console.error('Order history error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

