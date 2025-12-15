import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { sendEmail, generateReceiptHTML } from '@/lib/brevo'

export async function POST(request: NextRequest) {
  try {
    const { pesananId, email } = await request.json()

    if (!pesananId || !email) {
      return NextResponse.json(
        { error: 'pesananId dan email diperlukan' },
        { status: 400 }
      )
    }

    // Validate email config early to provide clear error
    const apiKey = process.env.BREVO_API_KEY
    const senderEmail = process.env.BREVO_SENDER_EMAIL
    if (!apiKey || !senderEmail) {
      const missing = [!apiKey ? 'BREVO_API_KEY' : null, !senderEmail ? 'BREVO_SENDER_EMAIL' : null]
        .filter(Boolean)
        .join(', ')
      return NextResponse.json(
        { error: `Konfigurasi email belum diset (${missing}). Mohon set env di server.` },
        { status: 400 }
      )
    }

    // Fetch pesanan details
    const { data: pesanan, error: pesananError } = await supabaseAdmin
      .from('pesanan')
      .select('*')
      .eq('id', pesananId)
      .single()

    if (pesananError || !pesanan) {
      return NextResponse.json(
        { error: 'Pesanan tidak ditemukan' },
        { status: 404 }
      )
    }

    // Fetch detail pesanan
    const { data: detailPesananRaw, error: detailError } = await supabaseAdmin
      .from('detail_pesanan')
      .select('*')
      .eq('pesanan_id', pesananId)

    if (detailError || !detailPesananRaw) {
      return NextResponse.json(
        { error: 'Gagal memuat detail pesanan' },
        { status: 500 }
      )
    }

    // Manual join to menu
    const menuIds = detailPesananRaw.map((d: any) => d.menu_id)
    const { data: menus } = await supabaseAdmin
      .from('menu')
      .select('id, nama_menu, harga')
      .in('id', menuIds)
    const menuMap = new Map((menus || []).map((m: any) => [m.id, m]))
    const detailPesanan = detailPesananRaw.map((d: any) => ({
      ...d,
      menu: menuMap.get(d.menu_id) || null,
    }))

    // Fetch kantin info
    const { data: kantin, error: kantinError } = await supabaseAdmin
      .from('kantin')
      .select('nama_kantin')
      .eq('id', pesanan.kantin_id)
      .single()

    if (kantinError) {
      return NextResponse.json(
        { error: 'Kantin tidak ditemukan' },
        { status: 404 }
      )
    }

    // Fetch payment info (qris or cash)
    const { data: paymentInfo } = await supabaseAdmin
      .from('pembayaran')
      .select('*')
      .eq('pesanan_id', pesananId)
      .maybeSingle()

    const { data: paymentCash } = await supabaseAdmin
      .from('pembayaran_cash')
      .select('*')
      .eq('pesanan_id', pesananId)
      .maybeSingle()

    // Prepare email data
    const emailData = {
      pesananId,
      nomorAntrian: pesanan.nomor_antrian,
      namaPemesan: pesanan.nama_pemesan,
      nomorMeja: pesanan.nomor_meja,
      tipePesanan: pesanan.tipe_pesanan,
      kantinName: kantin.nama_kantin,
      items: detailPesanan.map((item: any) => ({
        nama: item.menu?.nama_menu || 'Menu',
        jumlah: item.jumlah,
        hargaSatuan: item.harga_satuan,
        subtotal: item.subtotal
      })),
      totalHarga: pesanan.total_harga,
      paymentMethod: paymentInfo?.payment_type || (paymentCash ? 'cash' : 'unknown'),
      paymentStatus: paymentInfo?.status || (paymentCash ? (paymentCash.status === 'dikonfirmasi' ? 'settlement' : 'pending') : 'pending'),
      createdAt: pesanan.created_at
    }

    // Generate HTML receipt
    const htmlContent = generateReceiptHTML(emailData)

    // Send email via Brevo
    const emailSent = await sendEmail({
      to: email,
      subject: `Struk Pesanan #${pesanan.nomor_antrian} - ${kantin.nama_kantin}`,
      html: htmlContent
    })

    if (!emailSent) {
      return NextResponse.json(
        { error: 'Gagal mengirim email. Silakan coba lagi.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Email struk berhasil dikirim'
    })

  } catch (error) {
    console.error('Send receipt email error:', error)
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat mengirim email: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    )
  }
}
