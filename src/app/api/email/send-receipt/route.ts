import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
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

    // Fetch pesanan details
    const { data: pesanan, error: pesananError } = await supabase
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

    // Fetch detail pesanan with menu info
    const { data: detailPesanan, error: detailError } = await supabase
      .from('detail_pesanan')
      .select(`
        *,
        menu (*)
      `)
      .eq('pesanan_id', pesananId)

    if (detailError || !detailPesanan) {
      return NextResponse.json(
        { error: 'Gagal memuat detail pesanan' },
        { status: 500 }
      )
    }

    // Fetch kantin info
    const { data: kantin, error: kantinError } = await supabase
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

    // Fetch payment info
    const { data: paymentInfo, error: paymentError } = await supabase
      .from('pembayaran')
      .select('*')
      .eq('pesanan_id', pesananId)
      .single()

    if (paymentError) {
      console.error('Error fetching payment info:', paymentError)
    }

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
      paymentMethod: paymentInfo?.payment_type || 'unknown',
      paymentStatus: paymentInfo?.status || 'pending',
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
