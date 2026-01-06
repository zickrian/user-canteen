'use client'

import { useState, useEffect, Suspense, useCallback } from 'react'
import { Printer, Mail, CheckCircle, Clock, ArrowLeft, Store, Loader2, RefreshCw } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'

type MultiKiosOrder = {
  pesananId: string
  kantinId: string
  kantinName: string
  subtotal: number
  paymentStatus?: 'lunas' | 'pending'
  nomorAntrian?: number
}

type OrderWithStatus = MultiKiosOrder & {
  paymentStatus: 'lunas' | 'pending'
  paymentMethod: string
  status: string
  nomorAntrian: number
}

// Dummy data untuk preview biasa
const dummyData = {
  pesanan: {
    id: 'preview-123',
    nomor_antrian: 42,
    nama_pemesan: 'John Doe',
    email: 'john@example.com',
    nomor_meja: '5',
    tipe_pesanan: 'dine_in',
    total_harga: 75000,
    status: 'selesai',
    catatan: '',
    created_at: new Date().toISOString(),
  },
  detailPesanan: [
    { id: '1', menu: { nama_menu: 'Nasi Goreng Spesial' }, jumlah: 2, harga_satuan: 25000, subtotal: 50000 },
    { id: '2', menu: { nama_menu: 'Es Teh Manis' }, jumlah: 2, harga_satuan: 5000, subtotal: 10000 },
    { id: '3', menu: { nama_menu: 'Kerupuk' }, jumlah: 3, harga_satuan: 5000, subtotal: 15000 },
  ],
  kantin: { nama_kantin: 'Kantin Pak Budi' },
}

function StrukPreviewContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [paymentStatus, setPaymentStatus] = useState<'settlement' | 'pending'>('pending')
  const [paymentMethod, setPaymentMethod] = useState<'qris' | 'cash'>('cash')
  const [multiKiosOrders, setMultiKiosOrders] = useState<OrderWithStatus[]>([])
  const [isMultiKios, setIsMultiKios] = useState(false)
  const [customerEmail, setCustomerEmail] = useState('')
  const [sendingEmail, setSendingEmail] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [initialOrders, setInitialOrders] = useState<MultiKiosOrder[]>([])

  const { pesanan, detailPesanan, kantin } = dummyData

  // Fetch status from database
  const fetchOrderStatus = useCallback(async (orders: MultiKiosOrder[]) => {
    if (orders.length === 0) return

    setLoading(true)
    try {
      const response = await fetch('/api/orders/multi-kios-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pesananIds: orders.map(o => o.pesananId)
        })
      })

      if (response.ok) {
        const data = await response.json()
        setMultiKiosOrders(data.orders)

        // Update overall payment status
        if (data.allPaid) {
          setPaymentStatus('settlement')
        }
      }
    } catch (error) {
      console.error('Error fetching order status:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const ordersParam = searchParams.get('orders')
    const paidParam = searchParams.get('paid')
    const paymentMethodParam = searchParams.get('paymentMethod')
    const emailParam = searchParams.get('email')

    if (ordersParam) {
      try {
        const orders = JSON.parse(decodeURIComponent(ordersParam)) as MultiKiosOrder[]
        setInitialOrders(orders)
        setIsMultiKios(true)

        // Set payment method
        if (paymentMethodParam === 'qris') {
          setPaymentMethod('qris')
          setPaymentStatus('settlement')
        } else {
          setPaymentMethod('cash')
          if (paidParam === 'true') {
            setPaymentStatus('settlement')
          }
        }

        // Set customer email
        if (emailParam) {
          setCustomerEmail(decodeURIComponent(emailParam))
        }

        // Fetch real status from database
        fetchOrderStatus(orders)
      } catch (e) {
        console.error('Failed to parse orders:', e)
      }
    }
  }, [searchParams, fetchOrderStatus])

  // Auto-refresh status every 5 seconds for cash payments
  useEffect(() => {
    if (!isMultiKios || paymentMethod !== 'cash' || paymentStatus === 'settlement') return

    const interval = setInterval(() => {
      if (initialOrders.length > 0) {
        fetchOrderStatus(initialOrders)
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [isMultiKios, paymentMethod, paymentStatus, initialOrders, fetchOrderStatus])

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

  const totalAmount = multiKiosOrders.length > 0
    ? multiKiosOrders.reduce((sum, order) => sum + order.subtotal, 0)
    : initialOrders.reduce((sum, order) => sum + order.subtotal, 0)

  const handleRefresh = () => {
    if (initialOrders.length > 0) {
      fetchOrderStatus(initialOrders)
    }
  }

  const handleSendEmail = async () => {
    if (!customerEmail || multiKiosOrders.length === 0) {
      alert('Email tidak tersedia')
      return
    }

    setSendingEmail(true)
    try {
      const results = await Promise.all(
        multiKiosOrders.map(order =>
          fetch('/api/email/send-receipt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              pesananId: order.pesananId,
              email: customerEmail
            })
          })
        )
      )

      const allSuccess = results.every(r => r.ok)
      if (allSuccess) {
        setEmailSent(true)
        alert('Struk berhasil dikirim ke email!')
      } else {
        alert('Beberapa struk gagal dikirim. Silakan coba lagi.')
      }
    } catch (error) {
      console.error('Error sending email:', error)
      alert('Gagal mengirim email. Silakan coba lagi.')
    } finally {
      setSendingEmail(false)
    }
  }

  const allPaid = multiKiosOrders.length > 0
    ? multiKiosOrders.every(o => o.paymentStatus === 'lunas')
    : paymentStatus === 'settlement'


  // Multi-Kios Receipt View
  if (isMultiKios && (multiKiosOrders.length > 0 || initialOrders.length > 0)) {
    const ordersToShow = multiKiosOrders.length > 0 ? multiKiosOrders : initialOrders.map(o => ({
      ...o,
      paymentStatus: 'pending' as const,
      paymentMethod: paymentMethod,
      status: 'menunggu',
      nomorAntrian: 0
    }))

    return (
      <div className="min-h-screen bg-zinc-50 py-3 sm:py-4 px-3 sm:px-4 pb-16 sm:pb-20">
        {/* Header Actions */}
        <div className="max-w-md mx-auto mb-4 sm:mb-6 print:hidden">
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => router.push('/')}
              className="flex items-center gap-1.5 sm:gap-2 text-zinc-600 hover:text-zinc-900 transition bg-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl border border-zinc-100 shadow-sm"
            >
              <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="font-medium text-xs sm:text-sm">Beranda</span>
            </button>
            <div className="flex gap-1.5 sm:gap-2">
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm bg-white border border-zinc-100 rounded-xl hover:bg-zinc-50 disabled:opacity-50 transition shadow-sm text-zinc-700"
              >
                <RefreshCw className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
              {customerEmail && (
                <button
                  onClick={handleSendEmail}
                  disabled={sendingEmail || emailSent}
                  className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm bg-white border border-zinc-100 rounded-xl hover:bg-zinc-50 disabled:opacity-50 transition shadow-sm text-zinc-700 font-medium"
                >
                  {sendingEmail ? (
                    <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" />
                  ) : emailSent ? (
                    <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-600" />
                  ) : (
                    <Mail className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  )}
                  <span className="hidden sm:inline">{emailSent ? 'Terkirim' : 'Email'}</span>
                </button>
              )}
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm bg-black text-white rounded-xl hover:bg-zinc-800 transition font-medium shadow-sm"
              >
                <Printer className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Cetak</span>
              </button>
            </div>
          </div>
        </div>

        {/* Success Notice */}
        <div className={`max-w-md mx-auto mb-4 sm:mb-6 ${allPaid ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'} border rounded-xl sm:rounded-2xl p-4 sm:p-6 text-center shadow-sm`}>
          {allPaid ? (
            <>
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <CheckCircle className="h-6 w-6 sm:h-8 sm:w-8 text-emerald-600" />
              </div>
              <p className="text-emerald-800 font-bold text-base sm:text-lg">Semua Pembayaran Lunas!</p>
            </>
          ) : (
            <>
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <Clock className="h-6 w-6 sm:h-8 sm:w-8 text-amber-600" />
              </div>
              <p className="text-amber-800 font-bold text-base sm:text-lg">Menunggu Pembayaran</p>
            </>
          )}
          <p className={`${allPaid ? 'text-emerald-600' : 'text-amber-600'} text-xs sm:text-sm mt-1 font-medium`}>
            {ordersToShow.length} pesanan untuk kios berbeda
          </p>
        </div>

        {/* Multi-Kios Receipt */}
        <div className="max-w-md mx-auto">
          <div className="bg-white shadow-xl shadow-zinc-200/50 rounded-2xl sm:rounded-3xl overflow-hidden font-mono text-xs sm:text-sm border border-zinc-100">
            {/* Receipt Header */}
            <div className="text-center py-6 sm:py-8 px-4 sm:px-6 border-b-2 border-dashed border-zinc-200">
              <h1 className="text-xl sm:text-2xl font-black tracking-wider text-zinc-900">E-KANTIN</h1>
              <p className="text-zinc-500 text-[10px] sm:text-xs mt-1 uppercase tracking-widest font-bold">Struk Pesanan Multi-Kios</p>
              <p className="text-zinc-400 text-[9px] sm:text-[10px] mt-2 font-medium">{formatDate(new Date().toISOString())}</p>
            </div>

            {/* Payment Method Info */}
            <div className="px-6 py-4 bg-zinc-50 border-b border-zinc-200">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-500 font-medium">Metode Pembayaran</span>
                <span className="font-bold uppercase text-zinc-900">{paymentMethod === 'qris' ? 'QRIS' : 'Cash'}</span>
              </div>
              <div className="flex items-center justify-between text-xs mt-2">
                <span className="text-zinc-500 font-medium">Status</span>
                {allPaid ? (
                  <span className="flex items-center gap-1.5 text-[10px] text-emerald-700 bg-emerald-100 px-2 py-1 rounded-full font-bold uppercase tracking-wide">
                    <CheckCircle className="h-3 w-3" />
                    Semua Lunas
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-[10px] text-amber-700 bg-amber-100 px-2 py-1 rounded-full font-bold uppercase tracking-wide">
                    <Clock className="h-3 w-3" />
                    Menunggu Pembayaran
                  </span>
                )}
              </div>
            </div>

            {/* Orders by Kios */}
            <div className="px-6 py-4">
              <div className="flex items-center gap-2 mb-6">
                <Store className="h-4 w-4 text-orange-600" />
                <span className="font-bold text-xs uppercase tracking-wider text-zinc-500">Rincian per Kios</span>
              </div>

              {ordersToShow.map((order) => (
                <div key={order.pesananId} className="mb-4 pb-4 border-b border-dashed border-zinc-200 last:border-0 last:pb-0 last:mb-0">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-bold text-sm text-zinc-900">{order.kantinName}</p>
                      {order.nomorAntrian > 0 && (
                        <p className="text-xs text-zinc-500 font-medium mt-0.5">Antrian #<span className="text-zinc-900 font-bold">{order.nomorAntrian}</span></p>
                      )}
                    </div>
                    <span className="font-bold text-sm text-zinc-900">{formatPrice(order.subtotal)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    {order.paymentStatus === 'lunas' ? (
                      <>
                        <CheckCircle className="h-3 w-3 text-emerald-500" />
                        <span className="text-emerald-600 font-medium">Lunas</span>
                      </>
                    ) : (
                      <>
                        <Clock className="h-3 w-3 text-amber-500" />
                        <span className="text-amber-600 font-medium">
                          {paymentMethod === 'cash' ? `Bayar di Kasir ${order.kantinName}` : 'Menunggu Pembayaran'}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="px-6 py-6 bg-zinc-50 border-t-2 border-dashed border-zinc-200">
              <div className="flex justify-between font-bold text-base text-zinc-900">
                <span>TOTAL SEMUA KIOS</span>
                <span className="text-xl font-black">{formatPrice(totalAmount)}</span>
              </div>
            </div>

            {/* Instructions */}
            {allPaid ? (
              <div className="px-6 py-6 bg-emerald-50 border-t border-emerald-100">
                <p className="text-xs text-emerald-800 font-bold mb-3 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Pembayaran Berhasil!
                </p>
                <ol className="text-xs text-emerald-700 space-y-2 list-decimal list-inside font-medium leading-relaxed">
                  <li>Pesanan Anda sedang diproses oleh masing-masing kios</li>
                  <li>Tunjukkan struk ini sebagai bukti pesanan</li>
                  <li>Tunggu pesanan Anda disiapkan dan diantar ke meja</li>
                </ol>
              </div>
            ) : (
              <div className="px-6 py-6 bg-amber-50 border-t border-amber-100">
                <p className="text-xs text-amber-800 font-bold flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Silakan bayar ke kasir
                </p>
              </div>
            )}

            {/* Footer */}
            <div className="text-center py-8 px-6 bg-zinc-50 border-t border-zinc-100">
              <p className="text-xs text-zinc-600 font-medium mb-1">Terima kasih atas pesanan Anda!</p>
              <p className="text-[10px] text-zinc-400">Simpan struk ini sebagai bukti pesanan</p>
              <div className="mt-6">
                <div className="h-8 w-2/3 bg-zinc-200 mx-auto rounded mb-2 opacity-50"></div>
                <p className="text-[10px] text-zinc-300 font-mono tracking-widest">MULTIKIOS-{new Date().getTime().toString().slice(-6)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="max-w-md mx-auto mt-4 sm:mt-8 print:hidden">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <button
              onClick={() => router.push('/')}
              className="flex-1 px-4 py-3 sm:py-3.5 border border-zinc-200 text-zinc-700 rounded-xl hover:bg-white hover:shadow-sm transition font-bold text-xs sm:text-sm"
            >
              Beranda
            </button>
            <button
              onClick={() => router.push('/')}
              className="flex-1 px-4 py-3 sm:py-3.5 bg-orange-600 text-white rounded-xl hover:bg-orange-700 transition font-bold text-xs sm:text-sm shadow-lg shadow-orange-200"
            >
              Pesan Lagi
            </button>
          </div>
        </div>

        <style jsx global>{`
          @media print {
            body { background: white !important; }
            .print\\:hidden { display: none !important; }
          }
        `}</style>
      </div>
    )
  }


  // Regular Preview (dummy data)
  return (
    <div className="min-h-screen bg-zinc-50 py-3 sm:py-4 px-3 sm:px-4 pb-16 sm:pb-20">
      {/* Preview Notice */}
      <div className="max-w-md mx-auto mb-4 sm:mb-6 bg-amber-50 border border-amber-100 rounded-xl sm:rounded-2xl p-3 sm:p-4 text-center">
        <p className="text-amber-800 text-xs sm:text-sm font-bold flex items-center justify-center gap-2">
          <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          Mode Preview - Data Dummy
        </p>
        <div className="mt-2 sm:mt-3 flex justify-center gap-2">
          <button
            onClick={() => setPaymentStatus('settlement')}
            className={`px-2.5 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs rounded-lg font-bold transition-all ${paymentStatus === 'settlement' ? 'bg-emerald-500 text-white shadow-sm' : 'bg-white border border-zinc-200 text-zinc-500'}`}
          >
            Set Lunas
          </button>
          <button
            onClick={() => setPaymentStatus('pending')}
            className={`px-2.5 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs rounded-lg font-bold transition-all ${paymentStatus === 'pending' ? 'bg-amber-500 text-white shadow-sm' : 'bg-white border border-zinc-200 text-zinc-500'}`}
          >
            Set Pending
          </button>
        </div>
      </div>

      {/* Header Actions */}
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
            <button className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm bg-white border border-zinc-100 rounded-xl hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm text-zinc-700 font-medium">
              <Mail className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Email</span>
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm bg-black text-white rounded-xl hover:bg-zinc-800 transition font-medium shadow-sm"
            >
              <Printer className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Cetak</span>
            </button>
          </div>
        </div>
      </div>

      {/* Receipt */}
      <div className="max-w-md mx-auto">
        <div className="bg-white shadow-xl shadow-zinc-200/50 rounded-2xl sm:rounded-3xl overflow-hidden font-mono text-xs sm:text-sm border border-zinc-100 relative">

          {/* Top Jagged Edge */}
          <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-b from-zinc-50/50 to-transparent opacity-50"></div>

          {/* Receipt Header */}
          <div className="text-center py-8 px-6 border-b-2 border-dashed border-zinc-200">
            <h1 className="text-2xl font-black tracking-wider text-zinc-900">E-KANTIN</h1>
            <p className="text-zinc-500 text-xs mt-1 uppercase tracking-widest font-bold">{kantin.nama_kantin}</p>
            <p className="text-zinc-400 text-[10px] mt-2 font-medium">STRUK PEMESANAN DUMMY</p>
          </div>

          {/* Order Info */}
          <div className="px-6 py-6 border-b border-dashed border-zinc-200">
            <div className="flex justify-between items-end mb-4 bg-zinc-50 p-3 rounded-xl border border-zinc-100">
              <span className="text-zinc-500 text-xs font-medium uppercase tracking-wide">No. Antrian</span>
              <span className="font-bold text-2xl text-zinc-900">#{pesanan.nomor_antrian.toString().padStart(3, '0')}</span>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">Tanggal</span>
                <span className="text-zinc-900 font-medium">{formatDate(pesanan.created_at)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">Nama</span>
                <span className="text-zinc-900 font-medium">{pesanan.nama_pemesan}</span>
              </div>
              {pesanan.nomor_meja && (
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-500">Meja</span>
                  <span className="text-zinc-900 font-medium">{pesanan.nomor_meja}</span>
                </div>
              )}
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">Tipe Pesanan</span>
                <span className="text-zinc-900 font-medium bg-zinc-100 px-2 py-0.5 rounded text-[10px] uppercase tracking-wide">
                  {pesanan.tipe_pesanan === 'dine_in' ? 'Dine In' : 'Take Away'}
                </span>
              </div>
            </div>
          </div>

          {/* Payment Status */}
          <div className="px-6 py-4 border-b border-dashed border-zinc-200 bg-zinc-50/50">
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-500 font-medium">Status Pembayaran</span>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase font-bold text-zinc-700">QRIS</span>
                {paymentStatus === 'settlement' ? (
                  <span className="flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-100 px-2 py-1 rounded-full font-bold uppercase tracking-wide">
                    <CheckCircle className="h-3 w-3" />
                    Lunas
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[10px] text-amber-700 bg-amber-100 px-2 py-1 rounded-full font-bold uppercase tracking-wide">
                    <Clock className="h-3 w-3" />
                    Pending
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Items Header */}
          <div className="px-6 py-3 bg-zinc-50 border-b border-zinc-200">
            <div className="flex text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
              <span className="flex-1">Item</span>
              <span className="w-8 text-center">Qty</span>
              <span className="w-20 text-right">Harga</span>
            </div>
          </div>

          {/* Items List */}
          <div className="px-6 py-4 border-b border-dashed border-zinc-200">
            {detailPesanan.map((item) => (
              <div key={item.id} className="flex py-2 text-xs border-b border-zinc-50 last:border-0 items-start">
                <div className="flex-1 pr-2">
                  <p className="font-bold text-zinc-900">{item.menu?.nama_menu}</p>
                  <p className="text-zinc-400 text-[10px]">@ {formatPrice(item.harga_satuan)}</p>
                </div>
                <span className="w-8 text-center text-zinc-600 font-medium">{item.jumlah}</span>
                <span className="w-20 text-right font-medium text-zinc-900">{formatPrice(item.subtotal)}</span>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="px-6 py-6 border-b border-dashed border-zinc-200">
            <div className="flex justify-between text-xs mb-2">
              <span className="text-zinc-500">Subtotal</span>
              <span className="text-zinc-900 font-medium">{formatPrice(pesanan.total_harga)}</span>
            </div>
            <div className="flex justify-between text-xs mb-4">
              <span className="text-zinc-500">Biaya Layanan</span>
              <span className="text-zinc-900 font-medium">Rp 0</span>
            </div>
            <div className="flex justify-between items-center pt-4 border-t border-dashed border-zinc-200">
              <span className="font-bold text-sm text-zinc-900">TwOTAL BAYAR</span>
              <span className="font-black text-xl text-zinc-900">{formatPrice(pesanan.total_harga)}</span>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center py-8 px-6 bg-zinc-50">
            <p className="text-xs text-zinc-600 font-medium mb-1">Terima kasih atas kunjungan Anda!</p>
            <p className="text-[10px] text-zinc-400">Mohon simpan struk ini sebagai bukti pembayaran yang sah.</p>
            <div className="mt-6">
              <div className="h-8 w-2/3 bg-zinc-200 mx-auto rounded mb-2 opacity-50"></div>
              <p className="text-[10px] text-zinc-300 font-mono tracking-widest">{pesanan.id.toUpperCase()}</p>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  )
}

export default function StrukPreviewPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-zinc-200 border-t-zinc-900 rounded-full animate-spin"></div>
      </div>
    }>
      <StrukPreviewContent />
    </Suspense>
  )
}
