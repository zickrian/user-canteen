'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Printer, ArrowLeft, Mail, CheckCircle, Clock } from 'lucide-react'
import { Pesanan, DetailPesanan, Kantin } from '@/lib/supabase'

interface PaymentInfo {
  payment_type?: string
  status?: string
  created_at?: string
}

export default function StrukPage() {
  const params = useParams()
  const router = useRouter()
  const pesananId = params['pesanan-id'] as string

  const [pesanan, setPesanan] = useState<Pesanan | null>(null)
  const [detailPesanan, setDetailPesanan] = useState<DetailPesanan[]>([])
  const [kantin, setKantin] = useState<Kantin | null>(null)
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [emailSent, setEmailSent] = useState(false)
  const [emailLoading, setEmailLoading] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchPesananData() {
      try {
        setLoading(true)
        setError(null)

        const res = await fetch(`/api/orders/receipt/${pesananId}`)
        const payload = await res.json()

        if (!res.ok) {
          console.error('Error fetching receipt:', payload)
          setError(payload.error || 'Pesanan tidak ditemukan')
          return
        }

        setPesanan(payload.pesanan as Pesanan)
        setDetailPesanan((payload.detailPesanan || []) as DetailPesanan[])
        setKantin(payload.kantin as Kantin)
        setPaymentInfo((payload.paymentUi || null) as PaymentInfo | null)

      } catch (error) {
        console.error('Error:', error)
        setError('Terjadi kesalahan yang tidak terduga')
      } finally {
        setLoading(false)
      }
    }

    if (pesananId) {
      fetchPesananData()
      const interval = setInterval(() => {
        fetch(`/api/orders/receipt/${pesananId}`)
          .then((r) => r.json())
          .then((payload) => {
            const ui: PaymentInfo | null = payload.paymentUi || null
            if (ui) setPaymentInfo(ui)
            if (ui?.status === 'settlement') {
              clearInterval(interval)
            }
          })
          .catch(() => { })
      }, 3000)
      return () => clearInterval(interval)
    }
  }, [pesananId])

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handlePrint = () => {
    window.print()
  }

  const handleSendEmail = async () => {
    if (!pesanan || !pesanan.email || !detailPesanan.length) {
      setEmailError('Email tidak tersedia')
      return
    }

    setEmailLoading(true)
    setEmailError(null)

    try {
      const response = await fetch('/api/email/send-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pesananId,
          email: pesanan.email
        })
      })

      const data = await response.json()

      if (!response.ok) {
        setEmailError(data.error || 'Gagal mengirim email')
        return
      }

      setEmailSent(true)
      setTimeout(() => setEmailSent(false), 5000)
    } catch (error) {
      console.error('Error sending email:', error)
      setEmailError('Terjadi kesalahan saat mengirim email')
    } finally {
      setEmailLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-zinc-200 border-t-zinc-900 rounded-full animate-spin"></div>
          <p className="text-zinc-500 font-medium animate-pulse">Memuat struk...</p>
        </div>
      </div>
    )
  }

  if (error || !pesanan) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl border border-zinc-100 shadow-xl p-8 text-center max-w-md w-full">
          <div className="text-5xl mb-4">😞</div>
          <h1 className="text-xl font-bold text-zinc-900 mb-2">
            {error || 'Struk tidak ditemukan'}
          </h1>
          <p className="text-zinc-500 mb-8">
            Struk pesanan tidak tersedia atau telah kadaluarsa
          </p>
          <button
            onClick={() => router.push('/')}
            className="w-full bg-zinc-900 text-white px-6 py-3 rounded-xl hover:bg-zinc-800 transition font-bold"
          >
            Kembali ke Beranda
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-50 py-3 sm:py-4 px-3 sm:px-4 pb-16 sm:pb-20">
      {/* Header Actions - Hidden on Print */}
      <div className="max-w-md mx-auto mb-4 sm:mb-6 print:hidden">
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 sm:gap-2 text-zinc-600 hover:text-zinc-900 transition bg-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl border border-zinc-100 shadow-sm"
          >
            <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="font-medium text-xs sm:text-sm">Kembali</span>
          </button>
          <div className="flex gap-1.5 sm:gap-2">
            <button
              onClick={handleSendEmail}
              disabled={emailSent || emailLoading || !pesanan?.email}
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm bg-white border border-zinc-100 rounded-xl hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm text-zinc-700 font-medium"
            >
              <Mail className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">{emailLoading ? 'Mengirim...' : emailSent ? 'Terkirim ✓' : 'Email'}</span>
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm bg-black text-white rounded-xl hover:bg-zinc-800 transition font-medium shadow-sm"
            >
              <Printer className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Cetak</span>
            </button>
          </div>
        </div>
        {emailError && (
          <div className="mt-3 sm:mt-4 text-rose-600 text-xs sm:text-sm bg-rose-50 px-3 sm:px-4 py-2 sm:py-3 rounded-xl border border-rose-100 font-medium">
            {emailError}
          </div>
        )}
        {emailSent && (
          <div className="mt-3 sm:mt-4 text-emerald-600 text-xs sm:text-sm bg-emerald-50 px-3 sm:px-4 py-2 sm:py-3 rounded-xl border border-emerald-100 font-medium">
            Email struk berhasil dikirim ke {pesanan.email}
          </div>
        )}
      </div>

      {/* Receipt */}
      <div className="max-w-md mx-auto">
        <div className="bg-white shadow-xl shadow-zinc-200/50 rounded-2xl sm:rounded-3xl overflow-hidden font-mono text-xs sm:text-sm border border-zinc-100 relative">

          {/* Top Jagged Edge (CSS trick or just simple border) */}
          <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-b from-zinc-50/50 to-transparent opacity-50"></div>

          {/* Receipt Header */}
          <div className="text-center py-6 sm:py-8 px-4 sm:px-6 border-b-2 border-dashed border-zinc-200">
            <h1 className="text-xl sm:text-2xl font-black tracking-wider text-zinc-900">E-KANTIN</h1>
            <p className="text-zinc-500 text-[10px] sm:text-xs mt-1 uppercase tracking-widest font-bold">{kantin?.nama_kantin || 'Kantin'}</p>
            <p className="text-zinc-400 text-[9px] sm:text-[10px] mt-2 font-medium">STRUK PEMESANAN RESMI</p>
          </div>

          {/* Order Info */}
          <div className="px-4 sm:px-6 py-4 sm:py-6 border-b border-dashed border-zinc-200">
            <div className="flex justify-between items-end mb-3 sm:mb-4 bg-zinc-50 p-2.5 sm:p-3 rounded-xl border border-zinc-100">
              <span className="text-zinc-500 text-[10px] sm:text-xs font-medium uppercase tracking-wide">No. Antrian</span>
              <span className="font-bold text-xl sm:text-2xl text-zinc-900">#{pesanan.nomor_antrian.toString().padStart(3, '0')}</span>
            </div>

            <div className="space-y-1.5 sm:space-y-2">
              <div className="flex justify-between text-[10px] sm:text-xs">
                <span className="text-zinc-500">Tanggal</span>
                <span className="text-zinc-900 font-medium text-right">{formatDate(pesanan.created_at)}</span>
              </div>
              <div className="flex justify-between text-[10px] sm:text-xs">
                <span className="text-zinc-500">Nama</span>
                <span className="text-zinc-900 font-medium text-right truncate ml-2">{pesanan.nama_pemesan}</span>
              </div>
              {pesanan.nomor_meja && (
                <div className="flex justify-between text-[10px] sm:text-xs">
                  <span className="text-zinc-500">Meja</span>
                  <span className="text-zinc-900 font-medium">{pesanan.nomor_meja}</span>
                </div>
              )}
              <div className="flex justify-between text-[10px] sm:text-xs">
                <span className="text-zinc-500">Tipe Pesanan</span>
                <span className="text-zinc-900 font-medium bg-zinc-100 px-1.5 sm:px-2 py-0.5 rounded text-[9px] sm:text-[10px] uppercase tracking-wide">
                  {pesanan.tipe_pesanan === 'dine_in' ? 'Dine In' : 'Take Away'}
                </span>
              </div>
            </div>
          </div>

          {/* Payment Status */}
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-dashed border-zinc-200 bg-zinc-50/50">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] sm:text-xs text-zinc-500 font-medium">Status Pembayaran</span>
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <span className="text-[10px] sm:text-xs uppercase font-bold text-zinc-700">
                  {paymentInfo?.payment_type === 'cash' ? 'Cash' : 'QRIS'}
                </span>
                {paymentInfo?.status === 'settlement' ? (
                  <span className="flex items-center gap-1 text-[9px] sm:text-[10px] text-emerald-700 bg-emerald-100 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full font-bold uppercase tracking-wide">
                    <CheckCircle className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                    Lunas
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[9px] sm:text-[10px] text-amber-700 bg-amber-100 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full font-bold uppercase tracking-wide">
                    <Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                    Pending
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Items Header */}
          <div className="px-4 sm:px-6 py-2.5 sm:py-3 bg-zinc-50 border-b border-zinc-200">
            <div className="flex text-[9px] sm:text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
              <span className="flex-1 min-w-0">Item</span>
              <span className="w-6 sm:w-8 text-center">Qty</span>
              <span className="w-16 sm:w-20 text-right">Harga</span>
            </div>
          </div>

          {/* Items List */}
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-dashed border-zinc-200">
            {detailPesanan.map((item, index) => (
              <div key={item.id} className="flex py-1.5 sm:py-2 text-[10px] sm:text-xs border-b border-zinc-50 last:border-0 items-start gap-1 sm:gap-2">
                <div className="flex-1 min-w-0 pr-1 sm:pr-2">
                  <p className="font-bold text-zinc-900 truncate">{item.menu?.nama_menu}</p>
                  <p className="text-zinc-400 text-[9px] sm:text-[10px]">@ {formatPrice(item.harga_satuan)}</p>
                </div>
                <span className="w-6 sm:w-8 text-center text-zinc-600 font-medium shrink-0">{item.jumlah}</span>
                <span className="w-16 sm:w-20 text-right font-medium text-zinc-900 shrink-0">{formatPrice(item.subtotal)}</span>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="px-4 sm:px-6 py-4 sm:py-6 border-b border-dashed border-zinc-200">
            <div className="flex justify-between text-[10px] sm:text-xs mb-1.5 sm:mb-2">
              <span className="text-zinc-500">Subtotal</span>
              <span className="text-zinc-900 font-medium">{formatPrice(pesanan.total_harga)}</span>
            </div>
            <div className="flex justify-between text-[10px] sm:text-xs mb-3 sm:mb-4">
              <span className="text-zinc-500">Biaya Layanan</span>
              <span className="text-zinc-900 font-medium">Rp 0</span>
            </div>
            <div className="flex justify-between items-center pt-3 sm:pt-4 border-t border-dashed border-zinc-200">
              <span className="font-bold text-xs sm:text-sm text-zinc-900">TOTAL BAYAR</span>
              <span className="font-black text-lg sm:text-xl text-zinc-900">{formatPrice(pesanan.total_harga)}</span>
            </div>
          </div>

          {/* Notes */}
          {pesanan.catatan && !pesanan.catatan.includes('dine_in') && !pesanan.catatan.includes('take_away') && (
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-dashed border-zinc-200 bg-amber-50/50">
              <p className="text-[9px] sm:text-[10px] text-amber-500 uppercase tracking-wider font-bold mb-1">Catatan Pesanan:</p>
              <p className="text-[10px] sm:text-xs text-zinc-700 italic break-words">{pesanan.catatan}</p>
            </div>
          )}

          {/* Footer */}
          <div className="text-center py-6 sm:py-8 px-4 sm:px-6 bg-zinc-50">
            <p className="text-[10px] sm:text-xs text-zinc-600 font-medium mb-1">Terima kasih atas kunjungan Anda!</p>
            <p className="text-[9px] sm:text-[10px] text-zinc-400">Mohon simpan struk ini sebagai bukti pembayaran yang sah.</p>
            <div className="mt-4 sm:mt-6">
              <div className="h-6 sm:h-8 w-2/3 bg-zinc-200 mx-auto rounded mb-1.5 sm:mb-2 opacity-50"></div> {/* Fake Barcode */}
              <p className="text-[9px] sm:text-[10px] text-zinc-300 font-mono tracking-widest break-all">{pesananId.substring(0, 18).toUpperCase()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Actions - Hidden on Print */}
      <div className="max-w-md mx-auto mt-4 sm:mt-8 print:hidden">
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <button
            onClick={() => router.push('/')}
            className="flex-1 px-4 py-3 sm:py-3.5 border border-zinc-200 text-zinc-700 rounded-xl hover:bg-white hover:shadow-sm transition font-bold text-xs sm:text-sm"
          >
            Kembali ke Menu
          </button>
          <button
            onClick={() => router.push('/')}
            className="flex-1 px-4 py-3 sm:py-3.5 bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 transition font-bold text-xs sm:text-sm shadow-lg shadow-zinc-200"
          >
            Pesan Lagi
          </button>
        </div>
      </div>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body {
            background: white !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  )
}
