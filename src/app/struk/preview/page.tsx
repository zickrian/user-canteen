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
      <div className="min-h-screen bg-gray-100 py-4 px-4">
        {/* Header Actions */}
        <div className="max-w-md mx-auto mb-4 print:hidden">
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => router.push('/')}
              className="flex items-center gap-2 text-gray-600 hover:text-black transition"
            >
              <ArrowLeft className="h-5 w-5" />
              <span>Beranda</span>
            </button>
            <div className="flex gap-2">
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="flex items-center gap-1 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
              {customerEmail && (
                <button
                  onClick={handleSendEmail}
                  disabled={sendingEmail || emailSent}
                  className="flex items-center gap-1 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
                >
                  {sendingEmail ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : emailSent ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <Mail className="h-4 w-4" />
                  )}
                  {emailSent ? 'Terkirim' : 'Email'}
                </button>
              )}
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1 px-3 py-2 text-sm bg-black text-white rounded-lg hover:bg-gray-800 transition"
              >
                <Printer className="h-4 w-4" />
                Cetak
              </button>
            </div>
          </div>
        </div>

        {/* Success Notice */}
        <div className={`max-w-md mx-auto mb-4 ${allPaid ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'} border rounded-lg p-4 text-center`}>
          {allPaid ? (
            <>
              <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
              <p className="text-green-800 font-bold">Semua Pembayaran Lunas!</p>
            </>
          ) : (
            <>
              <Clock className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
              <p className="text-yellow-800 font-bold">Menunggu Pembayaran</p>
            </>
          )}
          <p className={`${allPaid ? 'text-green-700' : 'text-yellow-700'} text-sm mt-1`}>
            {ordersToShow.length} pesanan untuk kios berbeda
          </p>
        </div>

        {/* Multi-Kios Receipt */}
        <div className="max-w-md mx-auto">
          <div className="bg-white shadow-lg rounded-lg overflow-hidden font-mono text-sm">
            {/* Receipt Header */}
            <div className="text-center py-6 border-b-2 border-dashed border-gray-300">
              <h1 className="text-xl font-bold tracking-wide">E-KANTIN</h1>
              <p className="text-gray-600 text-xs mt-1">Struk Pesanan Multi-Kios</p>
              <p className="text-gray-500 text-xs mt-1">{formatDate(new Date().toISOString())}</p>
            </div>

            {/* Payment Method Info */}
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600">Metode Pembayaran</span>
                <span className="font-bold uppercase">{paymentMethod === 'qris' ? 'QRIS' : 'Cash'}</span>
              </div>
              <div className="flex items-center justify-between text-xs mt-1">
                <span className="text-gray-600">Status</span>
                {allPaid ? (
                  <span className="flex items-center gap-1 text-green-600">
                    <CheckCircle className="h-3 w-3" />
                    Semua Lunas
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-yellow-600">
                    <Clock className="h-3 w-3" />
                    Menunggu Pembayaran
                  </span>
                )}
              </div>
            </div>

            {/* Orders by Kios */}
            <div className="px-4 py-4">
              <div className="flex items-center gap-2 mb-4">
                <Store className="h-5 w-5 text-red-600" />
                <span className="font-bold text-sm">Rincian Pesanan per Kios</span>
              </div>
              
              {ordersToShow.map((order) => (
                <div key={order.pesananId} className="mb-4 pb-4 border-b border-dashed border-gray-200 last:border-0">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-bold text-sm">{order.kantinName}</p>
                      {order.nomorAntrian > 0 && (
                        <p className="text-xs text-gray-500">Antrian #{order.nomorAntrian}</p>
                      )}
                    </div>
                    <span className="font-bold text-sm">{formatPrice(order.subtotal)}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs">
                    {order.paymentStatus === 'lunas' ? (
                      <>
                        <CheckCircle className="h-3 w-3 text-green-600" />
                        <span className="text-green-600">Lunas</span>
                      </>
                    ) : (
                      <>
                        <Clock className="h-3 w-3 text-yellow-600" />
                        <span className="text-yellow-600">
                          {paymentMethod === 'cash' ? `Bayar di Kasir ${order.kantinName}` : 'Menunggu Pembayaran'}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="px-4 py-4 bg-gray-50 border-t-2 border-dashed border-gray-300">
              <div className="flex justify-between font-bold text-base">
                <span>TOTAL SEMUA KIOS</span>
                <span>{formatPrice(totalAmount)}</span>
              </div>
            </div>

            {/* Instructions */}
            {allPaid ? (
              <div className="px-4 py-4 bg-green-50 border-t border-green-200">
                <p className="text-xs text-green-800 font-bold mb-2">✅ Pembayaran Berhasil!</p>
                <ol className="text-xs text-green-700 space-y-1 list-decimal list-inside">
                  <li>Pesanan Anda sedang diproses oleh masing-masing kios</li>
                  <li>Tunjukkan struk ini sebagai bukti pesanan</li>
                  <li>Tunggu pesanan Anda disiapkan dan diantar ke meja</li>
                </ol>
              </div>
            ) : (
              <div className="px-4 py-4 bg-yellow-50 border-t border-yellow-200">
                <p className="text-xs text-yellow-800 font-bold mb-2">📋 Instruksi Pembayaran Cash:</p>
                <ol className="text-xs text-yellow-700 space-y-1 list-decimal list-inside">
                  <li>Kunjungi masing-masing kios untuk pembayaran</li>
                  <li>Tunjukkan struk ini sebagai bukti pesanan</li>
                  <li>Bayar sesuai subtotal di masing-masing kios</li>
                  <li>Halaman ini akan update otomatis setelah pembayaran dikonfirmasi</li>
                </ol>
              </div>
            )}

            {/* Footer */}
            <div className="text-center py-6 px-4">
              <p className="text-xs text-gray-600 mb-1">Terima kasih atas pesanan Anda!</p>
              <p className="text-xs text-gray-500">Simpan struk ini sebagai bukti pesanan</p>
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-xs text-gray-400">================================</p>
                <p className="text-xs text-gray-500 mt-2">E-Kantin © {new Date().getFullYear()}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="max-w-md mx-auto mt-6 print:hidden">
          <div className="flex gap-3">
            <button
              onClick={() => router.push('/')}
              className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
            >
              Beranda
            </button>
            <button
              onClick={() => router.push('/')}
              className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium"
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
    <div className="min-h-screen bg-gray-100 py-4 px-4">
      {/* Preview Notice */}
      <div className="max-w-md mx-auto mb-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-center">
        <p className="text-yellow-800 text-sm font-medium">🔍 Mode Preview - Data Dummy</p>
        <div className="mt-2 flex justify-center gap-2">
          <button
            onClick={() => setPaymentStatus('settlement')}
            className={`px-3 py-1 text-xs rounded ${paymentStatus === 'settlement' ? 'bg-green-500 text-white' : 'bg-gray-200'}`}
          >
            Lunas
          </button>
          <button
            onClick={() => setPaymentStatus('pending')}
            className={`px-3 py-1 text-xs rounded ${paymentStatus === 'pending' ? 'bg-yellow-500 text-white' : 'bg-gray-200'}`}
          >
            Pending
          </button>
        </div>
      </div>

      {/* Header Actions */}
      <div className="max-w-md mx-auto mb-4 print:hidden">
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-600 hover:text-black transition"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>Kembali</span>
          </button>
          <div className="flex gap-2">
            <button className="flex items-center gap-1 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition">
              <Mail className="h-4 w-4" />
              Email
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1 px-3 py-2 text-sm bg-black text-white rounded-lg hover:bg-gray-800 transition"
            >
              <Printer className="h-4 w-4" />
              Cetak
            </button>
          </div>
        </div>
      </div>

      {/* Receipt */}
      <div className="max-w-md mx-auto">
        <div className="bg-white shadow-lg rounded-lg overflow-hidden font-mono text-sm">
          {/* Receipt Header */}
          <div className="text-center py-6 border-b-2 border-dashed border-gray-300">
            <h1 className="text-xl font-bold tracking-wide">E-KANTIN</h1>
            <p className="text-gray-600 text-xs mt-1">{kantin.nama_kantin}</p>
            <p className="text-gray-500 text-xs mt-1">Struk Pemesanan</p>
          </div>

          {/* Order Info */}
          <div className="px-4 py-4 border-b border-dashed border-gray-300">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-600">No. Antrian</span>
              <span className="font-bold text-lg">#{pesanan.nomor_antrian.toString().padStart(3, '0')}</span>
            </div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-600">Tanggal</span>
              <span>{formatDate(pesanan.created_at)}</span>
            </div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-600">Nama</span>
              <span>{pesanan.nama_pemesan}</span>
            </div>
            {pesanan.nomor_meja && (
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-600">Meja</span>
                <span>{pesanan.nomor_meja}</span>
              </div>
            )}
            <div className="flex justify-between text-xs">
              <span className="text-gray-600">Tipe</span>
              <span>{pesanan.tipe_pesanan === 'dine_in' ? 'Makan di Tempat' : 'Bawa Pulang'}</span>
            </div>
          </div>

          {/* Payment Status */}
          <div className="px-4 py-3 border-b border-dashed border-gray-300">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-600">Pembayaran</span>
              <div className="flex items-center gap-2">
                <span className="text-xs capitalize">QRIS</span>
                {paymentStatus === 'settlement' ? (
                  <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded">
                    <CheckCircle className="h-3 w-3" />
                    Lunas
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded">
                    <Clock className="h-3 w-3" />
                    Pending
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Items Header */}
          <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
            <div className="flex text-xs text-gray-600 font-semibold">
              <span className="flex-1">Item</span>
              <span className="w-12 text-center">Qty</span>
              <span className="w-24 text-right">Harga</span>
            </div>
          </div>

          {/* Items List */}
          <div className="px-4 py-2 border-b border-dashed border-gray-300">
            {detailPesanan.map((item) => (
              <div key={item.id} className="flex py-2 text-xs border-b border-gray-100 last:border-0">
                <div className="flex-1">
                  <p className="font-medium">{item.menu?.nama_menu}</p>
                  <p className="text-gray-500">@ {formatPrice(item.harga_satuan)}</p>
                </div>
                <span className="w-12 text-center">{item.jumlah}</span>
                <span className="w-24 text-right font-medium">{formatPrice(item.subtotal)}</span>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="px-4 py-3 border-b border-dashed border-gray-300">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-600">Subtotal</span>
              <span>{formatPrice(pesanan.total_harga)}</span>
            </div>
            <div className="flex justify-between text-xs mb-2">
              <span className="text-gray-600">Biaya Layanan</span>
              <span>Rp 0</span>
            </div>
            <div className="flex justify-between font-bold text-base pt-2 border-t border-gray-200">
              <span>TOTAL</span>
              <span>{formatPrice(pesanan.total_harga)}</span>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center py-6 px-4">
            <p className="text-xs text-gray-600 mb-1">Terima kasih atas pesanan Anda!</p>
            <p className="text-xs text-gray-500">Simpan struk ini sebagai bukti pembayaran</p>
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-xs text-gray-400">================================</p>
              <p className="text-xs text-gray-500 mt-2">E-Kantin © {new Date().getFullYear()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="max-w-md mx-auto mt-6 print:hidden">
        <div className="flex gap-3">
          <button
            onClick={() => router.push('/')}
            className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
          >
            Beranda
          </button>
          <button
            onClick={() => router.push('/checkout')}
            className="flex-1 px-4 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition font-medium"
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

export default function StrukPreviewPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-gray-600">Memuat...</p>
      </div>
    }>
      <StrukPreviewContent />
    </Suspense>
  )
}
