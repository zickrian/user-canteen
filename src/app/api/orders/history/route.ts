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

    // Fetch orders for this user - hanya field yang diperlukan untuk history
    const { data: orders, error: ordersError } = await supabase
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
        created_at
      `)
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
      .select('id, nama_kantin, foto_profil')
      .in('id', kantinIds)

    const kantinMap = new Map((kantinList || []).map((k: any) => [k.id, k]))

    // Map orders dengan nama kantin dan payment method
    const ordersWithDetails = orders.map((order: any) => {
      // Get payment method dari payment_method field atau dari tabel pembayaran
      let paymentMethod = order.payment_method || 'unknown'
      
      // Jika payment_method null, cek dari tabel pembayaran (tapi kita skip untuk performa)
      // Karena sudah ada payment_method di tabel pesanan

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

