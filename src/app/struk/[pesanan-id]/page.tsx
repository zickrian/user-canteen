'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Printer, ArrowLeft, Mail, CheckCircle, Clock, User, MapPin, Star, CreditCard } from 'lucide-react'
import { Pesanan, DetailPesanan, Kantin } from '@/lib/supabase'
import RatingModal, { RatingDisplay } from '@/components/RatingModal'

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
  const [showRatingModal, setShowRatingModal] = useState(false)

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
      // Poll payment status until settled
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
          .catch(() => {})
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
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handlePrint = () => {
    window.print()
  }

  const handleSendEmail = async () => {
    if (!pesanan || !pesanan.email || !detailPesanan.length) return

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
      setTimeout(() => setEmailSent(false), 3000)
    } catch (error) {
      console.error('Error sending email:', error)
      setEmailError('Terjadi kesalahan saat mengirim email')
    } finally {
      setEmailLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'menunggu':
        return 'bg-yellow-100 text-yellow-800'
      case 'diproses':
        return 'bg-blue-100 text-blue-800'
      case 'selesai':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'menunggu':
        return <Clock className="h-4 w-4" />
      case 'diproses':
        return <Clock className="h-4 w-4" />
      case 'selesai':
        return <CheckCircle className="h-4 w-4" />
      default:
        return <Clock className="h-4 w-4" />
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-pulse text-center">
          <div className="w-16 h-16 bg-gray-200 rounded-full mx-auto mb-4" />
          <div className="h-4 bg-gray-200 rounded w-32 mx-auto" />
        </div>
      </div>
    )
  }

  if (error || !pesanan) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-2xl mx-auto px-4 py-16">
          <div className="text-center">
            <div className="text-6xl mb-4">😞</div>
            <h1 className="text-2xl font-bold text-black mb-4">
              {error || 'Struk tidak ditemukan'}
            </h1>
            <p className="text-gray-600 mb-8">
              Struk pesanan tidak tersedia atau telah kadaluarsa
            </p>
            <button
              onClick={() => router.push('/')}
              className="bg-black text-white px-6 py-3 rounded-lg hover:bg-gray-800"
            >
              Kembali ke Beranda
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-gray-100 rounded-lg print:hidden"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <h1 className="text-xl font-bold text-black">Struk Pesanan</h1>
            </div>
            <div className="flex gap-2 print:hidden w-full sm:w-auto justify-end">
              {emailError && (
                <div className="text-red-600 text-sm px-3 py-2 bg-red-50 rounded">
                  {emailError}
                </div>
              )}
              <button
                onClick={handleSendEmail}
                disabled={emailSent || emailLoading || !pesanan?.email}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Mail className="h-4 w-4" />
                {emailLoading ? 'Mengirim...' : emailSent ? 'Terkirim' : 'Kirim Email'}
              </button>
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800"
              >
                <Printer className="h-4 w-4" />
                Cetak
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Struk Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {/* Struk Header */}
          <div className="bg-linear-to-r from-black to-gray-800 text-white p-8 text-center">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-black font-bold text-2xl">E</span>
            </div>
            <h2 className="text-2xl font-bold mb-2">E-KANTIN</h2>
            <p className="text-gray-300 text-sm">Struk Pesanan Elektronik</p>
          </div>

          {/* Payment Status */}
          {paymentInfo && (
            <div className="bg-linear-to-r from-blue-50 to-blue-100 p-6 rounded-lg mb-6 border border-blue-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${
                    paymentInfo.status === 'settlement' 
                      ? 'bg-green-100' 
                      : 'bg-yellow-100'
                  }`}>
                    {paymentInfo.status === 'settlement' ? (
                      <CheckCircle className="h-6 w-6 text-green-600" />
                    ) : (
                      <Clock className="h-6 w-6 text-yellow-600" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Status Pembayaran</p>
                    <p className="text-lg font-bold text-black">
                      {paymentInfo.status === 'settlement' ? '✓ Sudah Dibayar' : '⏳ Menunggu Pembayaran'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">Metode</p>
                  <p className="text-lg font-bold text-black capitalize">
                    {paymentInfo.payment_type === 'cash' ? 'Cash' : 'QRIS'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Pesanan Info */}
          <div className="p-8 space-y-6">
            {/* Order Number and Status */}
            <div className="flex items-center justify-between pb-6 border-b border-gray-200">
              <div>
                <p className="text-sm text-gray-600">Nomor Pesanan</p>
                <p className="text-xl font-bold text-black">#{pesanan.nomor_antrian.toString().padStart(4, '0')}</p>
              </div>
              <div className="text-right">
                <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(pesanan.status)}`}>
                  {getStatusIcon(pesanan.status)}
                  <span className="capitalize">{pesanan.status.replace('_', ' ')}</span>
                </div>
              </div>
            </div>

            {/* Customer Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <User className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-600">Nama Pemesan</p>
                    <p className="font-semibold text-black">{pesanan.nama_pemesan}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-600">Waktu Pemesanan</p>
                    <p className="font-semibold text-black">{formatDate(pesanan.created_at)}</p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                {kantin && (
                  <div className="flex items-center gap-3">
                    <MapPin className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-600">Kantin</p>
                      <p className="font-semibold text-black">{kantin.nama_kantin}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 bg-gray-400 rounded" />
                  <div>
                    <p className="text-sm text-gray-600">Tipe Pesanan</p>
                    <p className="font-semibold text-black capitalize">
                      {pesanan.catatan?.includes('dine_in') ? 'Dine In' : 'Take Away'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Order Items */}
            <div className="space-y-4">
              <h3 className="font-semibold text-black text-lg">Detail Pesanan</h3>
              <div className="space-y-3">
                {detailPesanan.map((item) => (
                  <div key={item.id} className="flex items-center justify-between py-3 border-b border-gray-100">
                    <div className="flex-1">
                      <p className="font-medium text-black">{item.menu?.nama_menu}</p>
                      <p className="text-sm text-gray-600">
                        {formatPrice(item.harga_satuan)} × {item.jumlah}
                      </p>
                    </div>
                    <p className="font-semibold text-black">
                      {formatPrice(item.subtotal)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
            {pesanan.catatan && (
              <div className="space-y-2">
                <h3 className="font-semibold text-black">Catatan Pesanan</h3>
                <p className="text-gray-600 bg-gray-50 p-3 rounded-lg">
                  {pesanan.catatan}
                </p>
              </div>
            )}

            {/* Total */}
            <div className="space-y-3 pt-6 border-t border-gray-200">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-medium">{formatPrice(pesanan.total_harga)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Biaya Layanan</span>
                <span className="font-medium">Rp 0</span>
              </div>
              <div className="flex justify-between items-center text-lg font-bold pt-3 border-t border-gray-200">
                <span>Total Pembayaran</span>
                <span className="text-black">{formatPrice(pesanan.total_harga)}</span>
              </div>
            </div>

            {/* QR Code removed as requested */}

            {/* Footer */}
            <div className="text-center pt-6 border-t border-gray-200">
              <p className="text-sm text-gray-600 mb-2">
                Terima kasih telah berbelanja di E-Kantin
              </p>
              <p className="text-xs text-gray-500">
                Simpan struk ini sebagai bukti pembayaran
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 mt-8 print:hidden">
          <button
            onClick={() => router.push('/')}
            className="flex-1 px-6 py-3 border-2 border-black text-black rounded-lg hover:bg-gray-50"
          >
            Kembali ke Beranda
          </button>
          <button
            onClick={() => router.push('/checkout')}
            className="flex-1 bg-black text-white px-6 py-3 rounded-lg hover:bg-gray-800"
          >
            Pesan Lagi
          </button>
        </div>
      </div>
    </div>
  )
}