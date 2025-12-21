'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Package, Clock, CheckCircle, XCircle, Receipt } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import type { Pesanan } from '@/lib/supabase'

interface OrderWithDetails extends Pesanan {
  kantin?: {
    id: string
    nama_kantin: string
  }
  detail_pesanan?: Array<{
    id: string
    menu_id: string
    jumlah: number
    harga_satuan: number
    subtotal: number
    menu?: {
      id: string
      nama_menu: string
      foto_menu: string | null
    }
  }>
  paymentStatus?: string
  paymentMethod?: string
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

  const getPaymentStatusBadge = (paymentStatus?: string) => {
    if (paymentStatus === 'paid') {
      return (
        <span className="px-2 py-1 text-xs font-semibold text-green-700 bg-green-100 rounded-full">
          Lunas
        </span>
      )
    }
    return (
      <span className="px-2 py-1 text-xs font-semibold text-yellow-700 bg-yellow-100 rounded-full">
        Pending
      </span>
    )
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
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {order.kantin?.nama_kantin || 'Kantin'}
                        </h3>
                        {getPaymentStatusBadge(order.paymentStatus)}
                      </div>
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

                {/* Order Items */}
                {order.detail_pesanan && order.detail_pesanan.length > 0 && (
                  <div className="p-4 border-b border-gray-200">
                    <div className="space-y-2">
                      {order.detail_pesanan.map((detail) => (
                        <div
                          key={detail.id}
                          className="flex items-center gap-3"
                        >
                          {detail.menu?.foto_menu && (
                            <img
                              src={detail.menu.foto_menu}
                              alt={detail.menu.nama_menu}
                              className="h-12 w-12 rounded-lg object-cover"
                            />
                          )}
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">
                              {detail.menu?.nama_menu || 'Menu'}
                            </p>
                            <p className="text-xs text-gray-500">
                              {detail.jumlah}x {formatCurrency(detail.harga_satuan)}
                            </p>
                          </div>
                          <p className="text-sm font-semibold text-gray-900">
                            {formatCurrency(detail.subtotal)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Order Footer */}
                <div className="p-4 bg-gray-50 flex items-center justify-between">
                  <div>
                    {order.catatan && (
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Catatan:</span> {order.catatan}
                      </p>
                    )}
                    {order.nomor_meja && (
                      <p className="text-sm text-gray-600 mt-1">
                        <span className="font-medium">Meja:</span> {order.nomor_meja}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">Total</p>
                    <p className="text-lg font-bold text-gray-900">
                      {formatCurrency(order.total_harga)}
                    </p>
                  </div>
                </div>

                {/* Receipt Button */}
                <div className="p-4 border-t border-gray-200">
                  <button
                    onClick={() => router.push(`/struk/${order.id}`)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <Receipt className="h-4 w-4" />
                    Lihat Struk
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

