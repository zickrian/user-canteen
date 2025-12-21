'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Package, Clock, CheckCircle } from 'lucide-react'
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'selesai':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'diproses':
        return <Clock className="h-5 w-5 text-blue-500" />
      case 'menunggu':
        return <Clock className="h-5 w-5 text-yellow-500" />
      default:
        return <Package className="h-5 w-5 text-gray-500" />
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'selesai':
        return 'Selesai'
      case 'diproses':
        return 'Diproses'
      case 'menunggu':
        return 'Menunggu'
      default:
        return status
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
        return 'Belum dipilih'
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto"></div>
          <p className="mt-4 text-gray-600">Memuat history pesanan...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>Kembali</span>
          </button>
          <h1 className="text-3xl font-bold text-gray-900">History Pemesanan</h1>
          <p className="text-gray-600 mt-2">Riwayat semua pesanan Anda</p>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Orders List */}
        {orders.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Belum ada pesanan
            </h3>
            <p className="text-gray-600">
              Pesanan Anda akan muncul di sini setelah Anda melakukan pemesanan.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div
                key={order.id}
                className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
              >
                {/* Order Header */}
                <div className="p-4 border-b border-gray-200">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">
                        {order.kantin?.nama_kantin || 'Kantin'}
                      </h3>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span>Antrian #{order.nomor_antrian}</span>
                        <span>•</span>
                        <span>{formatDate(order.created_at)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(order.status)}
                      <span className="text-sm font-medium text-gray-700">
                        {getStatusText(order.status)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Order Details */}
                <div className="p-4 space-y-2 border-b border-gray-200">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Nama Pemesan:</span>
                      <p className="font-medium text-gray-900">{order.nama_pemesan}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Email:</span>
                      <p className="font-medium text-gray-900">{order.email || '-'}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Nomor Meja:</span>
                      <p className="font-medium text-gray-900">{order.nomor_meja || '-'}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Tipe Pesanan:</span>
                      <p className="font-medium text-gray-900">{getTipePesananText(order.tipe_pesanan)}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Metode Pembayaran:</span>
                      <p className="font-medium text-gray-900">{getPaymentMethodText(order.payment_method)}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Status:</span>
                      <p className="font-medium text-gray-900">{getStatusText(order.status)}</p>
                    </div>
                  </div>
                  {order.catatan && (
                    <div className="pt-2 border-t border-gray-200">
                      <span className="text-sm text-gray-500">Catatan:</span>
                      <p className="text-sm font-medium text-gray-900 mt-1">{order.catatan}</p>
                    </div>
                  )}
                </div>

                {/* Order Footer */}
                <div className="p-4 bg-gray-50">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Total Harga</span>
                    <p className="text-lg font-bold text-gray-900">
                      {formatCurrency(order.total_harga)}
                    </p>
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

