'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Package, Clock, CheckCircle, Receipt, Store } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'

interface OrderWithDetails {
  id: string
  kantin?: {
    id: string
    nama_kantin: string
  }
  nomor_antrian: number
  nama_pemesan: string
  email: string | null
  nomor_meja: string | null
  tipe_pesanan: string | null
  catatan: string | null
  total_harga: number
  status: string
  payment_method: string | null
  created_at: string
}

export default function OrderHistoryPage() {
  const router = useRouter()
  const { user, isAuthenticated, loading: authLoading } = useAuth()
  const [orders, setOrders] = useState<OrderWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) {
        router.push('/')
        return
      }
      fetchOrders()
    }
  }, [isAuthenticated, authLoading, router])

  const fetchOrders = async () => {
    if (!user) return

    try {
      setLoading(true)
      setError(null)

      // Get session token
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setError('Session tidak ditemukan')
        return
      }

      const response = await fetch('/api/orders/history', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      if (!response.ok) {
        throw new Error('Gagal memuat history pesanan')
      }

      const data = await response.json()
      setOrders(data.orders || [])
    } catch (err) {
      console.error('Error fetching orders:', err)
      setError('Gagal memuat history pesanan')
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'selesai':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-xs font-bold border border-emerald-100">
            <CheckCircle className="h-3.5 w-3.5" />
            Selesai
          </span>
        )
      case 'diproses':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 bg-sky-50 text-sky-600 rounded-full text-xs font-bold border border-sky-100">
            <Clock className="h-3.5 w-3.5" />
            Diproses
          </span>
        )
      case 'menunggu':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 bg-orange-50 text-orange-600 rounded-full text-xs font-bold border border-orange-100">
            <Clock className="h-3.5 w-3.5" />
            Menunggu
          </span>
        )
      default:
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 bg-zinc-100 text-zinc-500 rounded-full text-xs font-bold border border-zinc-200">
            <Package className="h-3.5 w-3.5" />
            {status}
          </span>
        )
    }
  }

  const getPaymentMethodText = (paymentMethod?: string | null) => {
    switch (paymentMethod) {
      case 'midtrans':
      case 'qris':
        return 'QRIS'
      case 'cash':
        return 'Cash'
      default:
        return '-'
    }
  }

  const getTipePesananText = (tipePesanan?: string | null) => {
    switch (tipePesanan) {
      case 'dine_in':
        return 'Makan di Tempat'
      case 'take_away':
        return 'Bawa Pulang'
      default:
        return '-'
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-zinc-200 border-t-zinc-900 rounded-full animate-spin"></div>
          <p className="text-zinc-500 font-medium animate-pulse">Memuat riwayat...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-zinc-200 sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-zinc-100 transition-colors text-zinc-600"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-zinc-900">Riwayat Pesanan</h1>
            <p className="text-xs text-zinc-500 font-medium">Semua pesanan kamu ada di sini</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        {/* Orders List */}
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-24 h-24 bg-zinc-100 rounded-full flex items-center justify-center mb-6">
              <Receipt className="h-10 w-10 text-zinc-300" />
            </div>
            <h3 className="text-lg font-bold text-zinc-900 mb-2">
              Belum ada pesanan
            </h3>
            <p className="text-zinc-500 max-w-xs mx-auto text-sm leading-relaxed">
              Kamu belum pernah memesan apapun. Yuk, cari makanan enak sekarang!
            </p>
            <button
              onClick={() => router.push('/')}
              className="mt-8 px-6 py-3 bg-zinc-900 text-white rounded-xl font-bold text-sm shadow-lg shadow-zinc-200 hover:bg-zinc-800 transition-all active:scale-95"
            >
              Mulai Pesan
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div
                key={order.id}
                className="bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow group"
              >
                {/* Order Header */}
                <div className="p-5 border-b border-zinc-50 bg-zinc-50/50">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white border border-zinc-200 rounded-xl flex items-center justify-center shrink-0">
                        <Store className="h-5 w-5 text-zinc-400" />
                      </div>
                      <div>
                        <h3 className="font-bold text-zinc-900 line-clamp-1">
                          {order.kantin?.nama_kantin || 'Kantin'}
                        </h3>
                        <p className="text-xs text-zinc-500 mt-0.5 font-medium">
                          {formatDate(order.created_at)}
                        </p>
                      </div>
                    </div>
                    {getStatusBadge(order.status)}
                  </div>
                </div>

                {/* Order Details */}
                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-2 gap-y-4 gap-x-8">
                    <div>
                      <span className="text-xs text-zinc-400 uppercase tracking-wider font-semibold block mb-1">No. Antrian</span>
                      <p className="text-2xl font-black text-zinc-900">#{order.nomor_antrian}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-zinc-400 uppercase tracking-wider font-semibold block mb-1">Total Bayar</span>
                      <p className="text-lg font-bold text-orange-600">{formatCurrency(order.total_harga)}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-dashed border-zinc-200">
                    <div>
                      <span className="text-xs text-zinc-400 font-medium block mb-1">Metode Bayar</span>
                      <p className="text-sm font-semibold text-zinc-700">{getPaymentMethodText(order.payment_method)}</p>
                    </div>
                    <div>
                      <span className="text-xs text-zinc-400 font-medium block mb-1">Tipe Pesanan</span>
                      <p className="text-sm font-semibold text-zinc-700">{getTipePesananText(order.tipe_pesanan)}</p>
                    </div>
                    <div>
                      <span className="text-xs text-zinc-400 font-medium block mb-1">Meja</span>
                      <p className="text-sm font-semibold text-zinc-700">{order.nomor_meja || '-'}</p>
                    </div>
                    <div>
                      <span className="text-xs text-zinc-400 font-medium block mb-1">Catatan</span>
                      <p className="text-sm font-medium text-zinc-600 line-clamp-1 italic">
                        {order.catatan || 'Tidak ada catatan'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

