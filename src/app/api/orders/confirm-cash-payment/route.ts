import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { sendEmail, generateReceiptHTML } from '@/lib/brevo'

/**
 * API untuk update status pembayaran cash dari kasir
 * Digunakan oleh dashboard kios untuk mengkonfirmasi pembayaran cash
 * Setelah dikonfirmasi, akan mengirim struk email ke pelanggan
 */
export async function POST(request: NextRequest) {
  try {
    const { pesananId, paymentType } = await request.json()

    if (!pesananId) {
      return NextResponse.json(
        { error: 'pesananId diperlukan' },
        { status: 400 }
      )
    }

    // Fetch payment record from pembayaran_cash
    const { data: paymentData, error: paymentFetchError } = await supabaseAdmin
      .from('pembayaran_cash')
      .select('*')
      .eq('pesanan_id', pesananId)
      .single()

    if (paymentFetchError || !paymentData) {
      return NextResponse.json(
        { error: 'Pembayaran tidak ditemukan' },
        { status: 404 }
      )
    }

    // Update payment status to dikonfirmasi
    const { error: paymentUpdateError } = await supabaseAdmin
      .from('pembayaran_cash')
      .update({
        status: 'dikonfirmasi',
        confirmed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('pesanan_id', pesananId)

    if (paymentUpdateError) {
      console.error('Error updating payment status:', paymentUpdateError)
      return NextResponse.json(
        { error: 'Gagal update status pembayaran' },
        { status: 500 }
      )
    }

    // Update pesanan status to diproses
    const { error: pesananUpdateError } = await supabaseAdmin
      .from('pesanan')
      .update({
        status: 'diproses',
        updated_at: new Date().toISOString()
      })
      .eq('id', pesananId)

    if (pesananUpdateError) {
      console.error('Error updating pesanan status:', pesananUpdateError)
      return NextResponse.json(
        { error: 'Gagal update status pesanan' },
        { status: 500 }
      )
    }

    // Update kantin balance - tambahkan saldo sesuai total pesanan ini saja
    const { data: pesananForBalance } = await supabaseAdmin
      .from('pesanan')
      .select('kantin_id, total_harga')
      .eq('id', pesananId)
      .single()

    if (pesananForBalance) {
      // Get current balance
      const { data: kantinData } = await supabaseAdmin
        .from('kantin')
        .select('balance')
        .eq('id', pesananForBalance.kantin_id)
        .single()

      const currentBalance = kantinData?.balance || 0
      const newBalance = currentBalance + pesananForBalance.total_harga

      // Update balance
      const { error: balanceError } = await supabaseAdmin
        .from('kantin')
        .update({ 
          balance: newBalance,
          updated_at: new Date().toISOString()
        })
        .eq('id', pesananForBalance.kantin_id)

      if (balanceError) {
        console.error('Error updating kantin balance:', balanceError)
      }
    }

    // Fetch order details untuk kirim email struk
    const { data: pesananData, error: pesananFetchError } = await supabaseAdmin
      .from('pesanan')
      .select('*')
      .eq('id', pesananId)
      .single()

    if (pesananFetchError || !pesananData) {
      console.error('Error fetching pesanan for email:', pesananFetchError)
      // Continue despite email error - payment is already updated
    } else if (pesananData.email) {
      // Fetch order items
      const { data: detailItemsRaw, error: detailError } = await supabaseAdmin
        .from('detail_pesanan')
        .select('*')
        .eq('pesanan_id', pesananId)

      // Manual join to menu (no FK defined)
      let detailItems = detailItemsRaw || []
      if (!detailError && detailItems.length) {
        const menuIds = detailItems.map((d: any) => d.menu_id)
        const { data: menus } = await supabaseAdmin
          .from('menu')
          .select('id, nama_menu, harga')
          .in('id', menuIds)
        const menuMap = new Map((menus || []).map((m: any) => [m.id, m]))
        detailItems = detailItems.map((d: any) => ({
          ...d,
          menu: menuMap.get(d.menu_id) || null,
        }))
      }

      // Fetch kantin name
      const { data: kantinData, error: kantinError } = await supabaseAdmin
        .from('kantin')
        .select('nama_kantin')
        .eq('id', pesananData.kantin_id)
        .single()

      if (!detailError && !kantinError && detailItems && kantinData) {
        // Generate receipt HTML
        const receiptHTML = generateReceiptHTML({
          pesananId: pesananId,
          nomorAntrian: pesananData.nomor_antrian,
          namaPemesan: pesananData.nama_pemesan,
          nomorMeja: pesananData.nomor_meja,
          tipePesanan: pesananData.tipe_pesanan,
          kantinName: kantinData.nama_kantin,
          items: detailItems.map((item: any) => ({
            nama: item.menu?.nama_menu || 'Menu',
            jumlah: item.jumlah,
            hargaSatuan: item.harga_satuan,
            subtotal: item.subtotal
          })),
          totalHarga: pesananData.total_harga,
          paymentMethod: 'cash',
          paymentStatus: 'settlement',
          createdAt: pesananData.created_at
        })

        // Send email
        await sendEmail({
          to: pesananData.email,
          subject: `Struk Pesanan E-Kantin - ${pesananData.nomor_antrian}`,
          html: receiptHTML
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Pembayaran cash berhasil dikonfirmasi dan struk telah dikirim'
    })

  } catch (error) {
    console.error('Update cash payment status error:', error)
    return NextResponse.json(
      { error: 'Terjadi kesalahan: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    )
  }
}
