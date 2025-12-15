import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ pesananId: string }> }
) {
  try {
    // Await params (Next.js 15+ requirement)
    const resolvedParams = await params
    let pesananId: string | undefined = resolvedParams?.pesananId
    if (!pesananId) {
      const path = request.nextUrl?.pathname || ''
      const seg = path.split('/').filter(Boolean)
      pesananId = seg[seg.length - 1]
    }
    if (!pesananId) {
      return NextResponse.json({ error: 'pesananId diperlukan' }, { status: 400 })
    }

    // Fetch pesanan
    const { data: pesanan, error: pesananError } = await supabaseAdmin
      .from('pesanan')
      .select('*')
      .eq('id', pesananId)
      .single()

    if (pesananError || !pesanan) {
      return NextResponse.json({ error: 'Pesanan tidak ditemukan' }, { status: 404 })
    }

    // Fetch detail pesanan with menu info
    const { data: detailPesananRaw, error: detailError } = await supabaseAdmin
      .from('detail_pesanan')
      .select('*')
      .eq('pesanan_id', pesananId)

    if (detailError) {
      return NextResponse.json({ error: 'Gagal memuat detail pesanan' }, { status: 500 })
    }

    // Join menu manually (no FK defined)
    const menuIds = (detailPesananRaw || []).map((d: any) => d.menu_id)
    let detailPesanan = detailPesananRaw || []
    if (menuIds.length) {
      const { data: menus } = await supabaseAdmin
        .from('menu')
        .select('*')
        .in('id', menuIds)

      const menuMap = new Map((menus || []).map((m: any) => [m.id, m]))
      detailPesanan = detailPesanan.map((d: any) => ({
        ...d,
        menu: menuMap.get(d.menu_id) || null,
      }))
    }

    // Fetch kantin info
    const { data: kantin, error: kantinError } = await supabaseAdmin
      .from('kantin')
      .select('id, nama_kantin')
      .eq('id', pesanan.kantin_id)
      .single()

    if (kantinError) {
      return NextResponse.json({ error: 'Kantin tidak ditemukan' }, { status: 404 })
    }

    // Fetch payment info (pembayaran or pembayaran_cash)
    const { data: pembayaranMid, error: paymentError } = await supabaseAdmin
      .from('pembayaran')
      .select('*')
      .eq('pesanan_id', pesananId)
      .maybeSingle()

    const { data: pembayaranCash } = await supabaseAdmin
      .from('pembayaran_cash')
      .select('*')
      .eq('pesanan_id', pesananId)
      .maybeSingle()

    // Build UI-friendly payment object
    let paymentUi: { payment_type: string; status: string; created_at?: string } | null = null
    if (pembayaranMid) {
      paymentUi = {
        payment_type: pembayaranMid.payment_type || 'qris',
        status: pembayaranMid.status,
        created_at: pembayaranMid.created_at,
      }
    } else if (pembayaranCash) {
      paymentUi = {
        payment_type: 'cash',
        status: pembayaranCash.status === 'dikonfirmasi' ? 'settlement' : 'pending',
        created_at: pembayaranCash.created_at,
      }
    }

    return NextResponse.json({ pesanan, detailPesanan, kantin, payment: pembayaranMid || null, paymentCash: pembayaranCash || null, paymentUi })
  } catch (error) {
    console.error('Get receipt data error:', error)
    return NextResponse.json(
      { error: 'Terjadi kesalahan: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    )
  }
}
