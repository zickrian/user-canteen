'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useCart } from '@/contexts/CartContext'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { CheckoutForm, CartItem, Kantin } from '@/lib/supabase'
import { ArrowLeft, Plus, Minus, Trash2, Clock, User, Mail, Table, QrCode, Store, Wallet, AlertCircle, ShoppingBag } from 'lucide-react'

type KiosGroup = {
  kantin: Kantin
  items: CartItem[]
  subtotal: number
}

export default function CheckoutPage() {
  const router = useRouter()
  const { cart, updateQuantity, removeItem, clearCart } = useCart()
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const [qrCode, setQrCode] = useState<string>('')
  const [midtransOrderId, setMidtransOrderId] = useState<string>('')
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'success' | 'failed'>('pending')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'qris'>('cash')
  const [formData, setFormData] = useState<CheckoutForm>({
    nama_pelanggan: '',
    catatan_pesanan: '',
    email: '',
    nomor_meja: '',
    tipe_pesanan: 'dine_in'
  })
  const [isTableNumberLocked, setIsTableNumberLocked] = useState(false)
  const [isCheckingTableNumber, setIsCheckingTableNumber] = useState(true)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [multiKiosOrders, setMultiKiosOrders] = useState<{ pesananId: string; kantinId: string; kantinName: string; subtotal: number }[]>([])
  const hasCheckedTableNumber = useRef(false)

  // Group cart items by kios
  const kiosGroups = useMemo((): KiosGroup[] => {
    const groups: Map<string, KiosGroup> = new Map()

    cart.items.forEach(item => {
      const kantinId = item.kantin.id
      if (!groups.has(kantinId)) {
        groups.set(kantinId, {
          kantin: item.kantin,
          items: [],
          subtotal: 0
        })
      }
      const group = groups.get(kantinId)!
      group.items.push(item)
      group.subtotal += item.menu.harga * item.quantity
    })

    return Array.from(groups.values())
  }, [cart.items])

  const isMultiKios = kiosGroups.length > 1

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price)
  }


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleQuantityChange = (menuId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeItem(menuId)
    } else {
      updateQuantity(menuId, newQuantity)
    }
  }

  const checkPaymentStatus = async (orderIdToCheck: string) => {
    try {
      const response = await fetch(`/api/midtrans/status/${orderIdToCheck}`)
      const data = await response.json() as {
        status?: string
        paymentStatus?: string
        orderId?: string
        pesananId?: string
        pesananIds?: string[]
      }

      const status = data.status || ''

      if (status === 'settlement') {
        setPaymentStatus('success')
        setTimeout(() => {
          clearCart()
          // For multi-kios, redirect to preview with orders
          if (isMultiKios && multiKiosOrders.length > 0) {
            router.push(`/struk/preview?orders=${encodeURIComponent(JSON.stringify(multiKiosOrders))}&paymentMethod=qris&paid=true&email=${encodeURIComponent(formData.email)}`)
          } else {
            // Untuk single kios, ambil pesananId dari response Midtrans status API
            const pesananId =
              (Array.isArray(data.pesananIds) && data.pesananIds[0]) ||
              data.pesananId

            if (pesananId) {
              router.push(`/struk/${pesananId}`)
            } else {
              console.error('Pesanan ID tidak ditemukan di response Midtrans status', data)
            }
          }
        }, 2000)
      } else if (['expire', 'cancel', 'deny'].includes(status)) {
        setPaymentStatus('failed')
      }
    } catch (error) {
      console.error('Error checking payment status:', error)
    }
  }

  useEffect(() => {
    let interval: NodeJS.Timeout

    if (showQR && paymentStatus === 'pending' && midtransOrderId) {
      interval = setInterval(() => {
        checkPaymentStatus(midtransOrderId)
      }, 3000)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [showQR, paymentStatus, midtransOrderId])

  // Auto-fill email and name from user profile when user is logged in
  useEffect(() => {
    const loadUserData = async () => {
      if (!user) return

      try {
        // Fetch user profile from database
        const { data: profile, error } = await supabase
          .from('user_profiles')
          .select('full_name, email')
          .eq('id', user.id)
          .single()

        if (error && error.code !== 'PGRST116') {
          // PGRST116 = no rows returned, which is okay
          console.error('Error fetching user profile:', error)
        }

        // Set form data with user information
        setFormData(prev => ({
          ...prev,
          email: profile?.email || user.email || prev.email,
          nama_pelanggan: profile?.full_name ||
            user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            prev.nama_pelanggan
        }))
      } catch (err) {
        console.error('Error loading user data:', err)
        // Fallback to user metadata if profile fetch fails
        if (user.email) {
          setFormData(prev => ({
            ...prev,
            email: user.email || prev.email,
            nama_pelanggan: user.user_metadata?.full_name ||
              user.user_metadata?.name ||
              prev.nama_pelanggan
          }))
        }
      }
    }

    loadUserData()
  }, [user])

  useEffect(() => {
    const globalKey = 'table-number'
    const kantinKey = cart.items[0]?.kantin?.id ? `table-number-${cart.items[0].kantin.id}` : null

    const savedGlobal = typeof window !== 'undefined'
      ? sessionStorage.getItem(globalKey)
      : null
    const savedKantin = typeof window !== 'undefined' && kantinKey
      ? sessionStorage.getItem(kantinKey)
      : null

    const nomorMeja = savedGlobal || savedKantin

    if (nomorMeja) {
      setFormData(prev => ({
        ...prev,
        nomor_meja: nomorMeja
      }))
      setIsTableNumberLocked(true)
      setIsCheckingTableNumber(false)
      return
    }

    if (!hasCheckedTableNumber.current) {
      hasCheckedTableNumber.current = true
      alert('Masukkan nomor meja terlebih dahulu sebelum checkout')
      setIsCheckingTableNumber(false)
      router.replace('/?needTable=1')
    }
  }, [cart.items, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (cart.items.length === 0) {
      alert('Keranjang belanja kosong')
      return
    }

    if (!formData.nama_pelanggan.trim() || !formData.email.trim()) {
      alert('Nama dan email wajib diisi')
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(formData.email.trim())) {
      alert('Format email tidak valid')
      return
    }

    if (!formData.nomor_meja.trim()) {
      alert('Nomor meja wajib diisi untuk pengiriman pesanan')
      return
    }

    setShowConfirmation(true)
  }


  const handleConfirmPayment = async () => {
    setShowConfirmation(false)
    setLoading(true)

    try {
      if (isMultiKios) {
        // Multi-kios checkout
        const kiosOrders = kiosGroups.map(group => ({
          kantinId: group.kantin.id,
          kantinName: group.kantin.nama_kantin,
          items: group.items.map(item => ({
            menu: item.menu,
            quantity: item.quantity
          })),
          subtotal: group.subtotal
        }))

        const response = await fetch('/api/orders/create-multi-kios-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kiosOrders,
            customerDetails: formData,
            paymentMethod: paymentMethod,
            grossAmount: cart.totalPrice,
            userId: user?.id || null
          }),
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Gagal membuat pesanan')
        }

        setMultiKiosOrders(data.orders)

        // For QRIS, show QR code
        if (paymentMethod === 'qris' && data.redirect_url) {
          setMidtransOrderId(data.midtransOrderId)
          setQrCode(data.redirect_url)
          setShowQR(true)
          return
        }

        // For cash, redirect to receipt preview
        clearCart()
        router.push(`/struk/preview?orders=${encodeURIComponent(JSON.stringify(data.orders))}&paymentMethod=cash&email=${encodeURIComponent(formData.email)}`)
        return
      }

      // Single kios checkout (existing logic)
      const firstKantinId = cart.items[0].kantin.id
      const itemsForKantin = cart.items.filter(item => item.kantin.id === firstKantinId)

      const orderData = {
        kantinId: firstKantinId,
        grossAmount: cart.totalPrice,
        customerDetails: formData,
        items: itemsForKantin.map(item => ({
          menu: item.menu,
          quantity: item.quantity
        })),
        paymentMethod: paymentMethod,
        userId: user?.id || null
      }

      const endpoint = paymentMethod === 'cash'
        ? '/api/orders/create-cash-order'
        : '/api/midtrans/create-payment'

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderData }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Gagal membuat pembayaran')
      }

      if (paymentMethod === 'cash') {
        clearCart()
        router.push(`/struk/${data.orderId}`)
        return
      }

      setMidtransOrderId(data.midtransOrderId)
      setQrCode(data.redirect_url)
      setShowQR(true)

    } catch (error) {
      console.error('Error creating payment:', error)
      alert(error instanceof Error ? error.message : 'Terjadi kesalahan saat membuat pesanan.')
    } finally {
      setLoading(false)
    }
  }

  const handleBackToCart = () => {
    setShowQR(false)
    setPaymentStatus('pending')
    setQrCode('')
    setMidtransOrderId('')
  }

  if (isCheckingTableNumber) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-zinc-200 border-t-zinc-900 rounded-full animate-spin"></div>
          <p className="text-zinc-500 font-medium">Memeriksa akses...</p>
        </div>
      </div>
    )
  }

  if (cart.items.length === 0 && !showQR) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border border-zinc-100">
            <ShoppingBag className="h-10 w-10 text-zinc-300" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 mb-2">Keranjang Kosong</h1>
          <p className="text-zinc-500 mb-8 max-w-xs mx-auto">Sepertinya kamu belum memilih menu apapun. Yuk cari makanaan enak!</p>
          <button
            onClick={() => router.push('/')}
            className="bg-zinc-900 text-white px-8 py-3.5 rounded-xl hover:bg-zinc-800 font-semibold shadow-lg shadow-zinc-200 transition-all active:scale-95"
          >
            Mulai Pesan
          </button>
        </div>
      </div>
    )
  }


  if (showQR) {
    return (
      <div className="min-h-screen bg-zinc-50">
        <header className="bg-white border-b border-zinc-200 sticky top-0 z-40">
          <div className="max-w-4xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
            <div className="flex items-center gap-2 sm:gap-4">
              <button onClick={handleBackToCart} className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-600 shrink-0">
                <ArrowLeft className="h-5 w-5" />
              </button>
              <h1 className="text-lg sm:text-xl font-bold text-zinc-900 truncate">Pembayaran QRIS</h1>
            </div>
          </div>
        </header>

        <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
          <div className="bg-white border border-zinc-100 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 shadow-sm">
            <div className="text-center">
              {paymentStatus === 'pending' && <QrCode className="h-12 w-12 sm:h-16 sm:w-16 mx-auto mb-3 sm:mb-4 text-zinc-900" />}
              {paymentStatus === 'success' && <div className="text-4xl sm:text-6xl mb-3 sm:mb-4">✅</div>}
              {paymentStatus === 'failed' && <div className="text-4xl sm:text-6xl mb-3 sm:mb-4">❌</div>}

              <h2 className="text-xl sm:text-2xl font-bold text-zinc-900 mb-2">
                {paymentStatus === 'pending' && 'Scan QR Code'}
                {paymentStatus === 'success' && 'Pembayaran Berhasil!'}
                {paymentStatus === 'failed' && 'Pembayaran Gagal'}
              </h2>

              <p className="text-sm sm:text-base text-zinc-500 mb-4 sm:mb-8">
                {paymentStatus === 'pending' && `Total: ${formatPrice(cart.totalPrice)}`}
                {paymentStatus === 'success' && 'Mengalihkan ke struk...'}
                {paymentStatus === 'failed' && 'Silakan coba lagi'}
              </p>

              {paymentStatus === 'pending' && qrCode && (
                <div className="mb-6 sm:mb-8 p-3 sm:p-4 bg-zinc-50 rounded-xl sm:rounded-2xl border-2 border-dashed border-zinc-200 inline-block w-full max-w-xs">
                  <iframe
                    src={qrCode}
                    className="w-full mx-auto h-[300px] sm:h-[350px] md:h-[400px] rounded-lg bg-white"
                    title="QRIS Payment"
                  />
                  <p className="text-[10px] sm:text-xs text-zinc-400 mt-3 sm:mt-4 font-medium uppercase tracking-wide">
                    Scan menggunakan E-Wallet
                  </p>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
                {paymentStatus === 'pending' && (
                  <button onClick={handleBackToCart} className="w-full sm:w-auto px-6 py-3 border border-zinc-200 text-zinc-700 rounded-xl hover:bg-zinc-50 font-medium text-sm sm:text-base">
                    Batalkan
                  </button>
                )}

                {paymentStatus === 'failed' && (
                  <>
                    <button onClick={handleBackToCart} className="w-full sm:w-auto px-6 py-3 border border-zinc-200 text-zinc-700 rounded-xl hover:bg-zinc-50 font-medium text-sm sm:text-base">
                      Kembali
                    </button>
                    <button onClick={() => window.location.reload()} className="w-full sm:w-auto px-6 py-3 bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 font-bold text-sm sm:text-base">
                      Coba Lagi
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }


  return (
    <div className="min-h-screen bg-zinc-50 pb-20">
      {/* Confirmation Modal */}
      {showConfirmation && (
        <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl sm:rounded-3xl max-w-sm w-full p-4 sm:p-6 shadow-2xl ring-1 ring-zinc-100 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="text-center">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-zinc-50 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4 border border-zinc-100">
                {paymentMethod === 'cash' ? (
                  <div className="text-2xl sm:text-3xl">💵</div>
                ) : (
                  <QrCode className="h-6 w-6 sm:h-8 sm:w-8 text-zinc-900" />
                )}
              </div>

              <h2 className="text-lg sm:text-xl font-bold text-zinc-900 mb-2">Konfirmasi Order</h2>

              {isMultiKios && (
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-2 sm:p-3 mb-3 sm:mb-4 mx-1 sm:mx-2">
                  <p className="text-[10px] sm:text-xs text-blue-700 flex items-center justify-center gap-1.5 font-medium">
                    <Store className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                    Pesanan dipisah untuk {kiosGroups.length} kios
                  </p>
                </div>
              )}

              <p className="text-zinc-500 text-xs sm:text-sm mb-4 sm:mb-6 px-2 sm:px-4">
                Lanjutkan pembayaran menggunakan <span className="font-bold text-zinc-900">{paymentMethod === 'cash' ? 'Cash' : 'QRIS'}</span>?
              </p>

              <div className="bg-zinc-50 border border-zinc-100 rounded-xl sm:rounded-2xl p-3 sm:p-4 mb-4 sm:mb-6">
                <div className="flex justify-between items-center">
                  <span className="text-xs sm:text-sm text-zinc-500 font-medium">Total Bayar</span>
                  <span className="text-lg sm:text-xl font-bold text-orange-600">{formatPrice(cart.totalPrice)}</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <button
                  onClick={() => setShowConfirmation(false)}
                  className="flex-1 px-4 py-3 sm:py-3.5 border border-zinc-200 text-zinc-700 rounded-xl hover:bg-zinc-50 font-bold transition-all text-sm sm:text-base"
                >
                  Batal
                </button>
                <button
                  onClick={handleConfirmPayment}
                  disabled={loading}
                  className="flex-1 px-4 py-3 sm:py-3.5 bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed font-bold transition-all shadow-lg shadow-zinc-200 active:scale-95 text-sm sm:text-base"
                >
                  {loading ? 'Proses...' : 'Ya, Bayar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center gap-2 sm:gap-4">
            <button onClick={() => router.back()} className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-full hover:bg-zinc-100 text-zinc-600 transition-colors shrink-0">
              <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="text-lg sm:text-xl font-bold text-zinc-900 truncate">Checkout</h1>
              {isMultiKios && (
                <span className="bg-orange-100 text-orange-700 text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border border-orange-200 shrink-0">
                  Multi-Kios
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6 md:py-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Multi-Kios Notice */}
          {isMultiKios && (
            <div className="bg-sky-50 border border-sky-100 rounded-xl sm:rounded-2xl p-3 sm:p-4">
              <div className="flex items-start gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 bg-sky-100 rounded-lg shrink-0">
                  <Store className="h-4 w-4 sm:h-5 sm:w-5 text-sky-600" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-sky-900 text-xs sm:text-sm">Checkout Multi-Kios</h3>
                  <p className="text-[10px] sm:text-xs text-sky-700 mt-0.5 sm:mt-1 leading-relaxed">
                    Kamu memesan dari {kiosGroups.length} kantin berbeda. Transaksi akan diproses secara otomatis untuk masing-masing kantin.
                  </p>
                </div>
              </div>
            </div>
          )}


          {/* Cart Items - Grouped by Kios */}
          <div className="space-y-4 sm:space-y-6">
            <h2 className="text-xs sm:text-sm font-bold text-zinc-500 uppercase tracking-wider ml-1">Rincian Pesanan</h2>

            {kiosGroups.map((group) => (
              <div key={group.kantin.id} className="bg-white rounded-2xl sm:rounded-3xl border border-zinc-100 shadow-sm overflow-hidden">
                <div className="bg-zinc-50/50 p-3 sm:p-4 border-b border-zinc-50 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white border border-zinc-200 flex items-center justify-center shadow-sm shrink-0">
                      <Store className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-zinc-400" />
                    </div>
                    <span className="font-bold text-zinc-900 text-xs sm:text-sm truncate">{group.kantin.nama_kantin}</span>
                  </div>
                  {isMultiKios && (
                    <span className="text-[10px] sm:text-xs font-bold text-zinc-500 bg-zinc-100 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg shrink-0">
                      {formatPrice(group.subtotal)}
                    </span>
                  )}
                </div>

                <div className="p-2 sm:p-2">
                  {group.items.map((item) => (
                    <div key={item.menu.id} className="flex gap-3 sm:gap-4 p-2 sm:p-3 hover:bg-zinc-50 rounded-xl sm:rounded-2xl transition-colors">
                      <div className="w-16 h-16 sm:w-20 sm:h-20 bg-zinc-100 rounded-lg sm:rounded-xl flex items-center justify-center overflow-hidden shrink-0 border border-zinc-100">
                        {item.menu.foto_menu ? (
                          <img
                            src={item.menu.foto_menu}
                            alt={item.menu.nama_menu}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-2xl">🍽️</span>
                        )}
                      </div>

                      <div className="flex-1 flex flex-col justify-between py-0.5 min-w-0">
                        <div className="min-w-0">
                          <h3 className="font-bold text-zinc-900 text-xs sm:text-sm line-clamp-1">{item.menu.nama_menu}</h3>
                          <p className="text-[10px] sm:text-xs font-bold text-orange-600 mt-0.5 sm:mt-1">{formatPrice(item.menu.harga)}</p>
                        </div>

                        <div className="flex items-center gap-2 sm:gap-3 mt-1.5 sm:mt-2">
                          <div className="flex items-center bg-zinc-50 rounded-lg border border-zinc-200 h-7 sm:h-8">
                            <button
                              type="button"
                              onClick={() => handleQuantityChange(item.menu.id, item.quantity - 1)}
                              className="w-7 h-full sm:w-8 flex items-center justify-center hover:bg-zinc-100 rounded-l-lg text-zinc-500"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="w-7 text-center sm:w-8 text-[10px] sm:text-xs font-bold text-zinc-900">{item.quantity}</span>
                            <button
                              type="button"
                              onClick={() => handleQuantityChange(item.menu.id, item.quantity + 1)}
                              className="w-7 h-full sm:w-8 flex items-center justify-center hover:bg-zinc-100 rounded-r-lg text-zinc-500"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeItem(item.menu.id)}
                            className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center text-zinc-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all shrink-0"
                          >
                            <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-zinc-100 shadow-sm flex items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="text-[10px] sm:text-xs text-zinc-500 uppercase tracking-wider font-semibold">Total Pembayaran</span>
                <p className="text-xs sm:text-sm text-zinc-400 mt-0.5 sm:mt-1">{cart.items.reduce((acc, item) => acc + item.quantity, 0)} item menu</p>
              </div>
              <span className="text-lg sm:text-xl md:text-2xl font-bold text-zinc-900 shrink-0">{formatPrice(cart.totalPrice)}</span>
            </div>
          </div>


          {/* Customer Information */}
          <div className="space-y-3 sm:space-y-4">
            <h2 className="text-xs sm:text-sm font-bold text-zinc-500 uppercase tracking-wider ml-1">Detail Pelanggan</h2>
            <div className="bg-white border border-zinc-100 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-sm space-y-4 sm:space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                <div>
                  <label className="text-[10px] sm:text-xs font-bold text-zinc-700 mb-1.5 sm:mb-2 block uppercase tracking-wide">
                    Nama Lengkap
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 text-zinc-400" />
                    <input
                      type="text"
                      name="nama_pelanggan"
                      value={formData.nama_pelanggan}
                      onChange={handleInputChange}
                      required
                      className="w-full pl-9 sm:pl-11 pr-3 sm:pr-4 py-2.5 sm:py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all text-xs sm:text-sm font-medium text-zinc-900 placeholder:text-zinc-400"
                      placeholder="Masukkan nama"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] sm:text-xs font-bold text-zinc-700 mb-1.5 sm:mb-2 block uppercase tracking-wide">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 text-zinc-400" />
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                      className="w-full pl-9 sm:pl-11 pr-3 sm:pr-4 py-2.5 sm:py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all text-xs sm:text-sm font-medium text-zinc-900 placeholder:text-zinc-400"
                      placeholder="Email untuk struk"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] sm:text-xs font-bold text-zinc-700 mb-1.5 sm:mb-2 block uppercase tracking-wide">
                    Nomor Meja
                  </label>
                  <div className="relative">
                    <Table className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 text-zinc-400" />
                    <input
                      type="text"
                      name="nomor_meja"
                      value={formData.nomor_meja}
                      onChange={handleInputChange}
                      required
                      readOnly={isTableNumberLocked}
                      className={`w-full pl-9 sm:pl-11 pr-3 sm:pr-4 py-2.5 sm:py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all text-xs sm:text-sm font-medium ${isTableNumberLocked ? 'bg-zinc-100 border-zinc-200 text-zinc-500 cursor-not-allowed' : 'bg-zinc-50 border-zinc-200 text-zinc-900'}`}
                      placeholder="Nomor meja"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] sm:text-xs font-bold text-zinc-700 mb-1.5 sm:mb-2 block uppercase tracking-wide">
                    Tipe Pesanan
                  </label>
                  <div className="relative">
                    <Clock className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 text-zinc-400" />
                    <select
                      name="tipe_pesanan"
                      value={formData.tipe_pesanan}
                      onChange={handleInputChange}
                      className="w-full pl-9 sm:pl-11 pr-3 sm:pr-4 py-2.5 sm:py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all text-xs sm:text-sm font-medium text-zinc-900 appearance-none"
                    >
                      <option value="dine_in">Makan di Tempat</option>
                      <option value="take_away">Bawa Pulang</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[10px] sm:text-xs font-bold text-zinc-700 mb-1.5 sm:mb-2 block uppercase tracking-wide">
                  Catatan (Opsional)
                </label>
                <textarea
                  name="catatan_pesanan"
                  value={formData.catatan_pesanan}
                  onChange={handleInputChange}
                  rows={2}
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all text-xs sm:text-sm font-medium text-zinc-900 placeholder:text-zinc-400"
                  placeholder="Contoh: Jangan terlalu pedas, es dipisah..."
                />
              </div>
            </div>
          </div>

          {/* Payment Method Selection */}
          <div className="space-y-3 sm:space-y-4">
            <h2 className="text-xs sm:text-sm font-bold text-zinc-500 uppercase tracking-wider ml-1">Metode Pembayaran</h2>

            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <button
                type="button"
                onClick={() => setPaymentMethod('cash')}
                className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl border transition-all relative overflow-hidden group ${paymentMethod === 'cash'
                    ? 'border-zinc-900 bg-zinc-900 text-white shadow-md ring-2 ring-zinc-200 ring-offset-1 sm:ring-offset-2'
                    : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50'
                  }`}
              >
                <div className="relative z-10 text-left">
                  <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center mb-2 sm:mb-3 ${paymentMethod === 'cash' ? 'bg-white/10' : 'bg-zinc-100'}`}>
                    <Wallet className="h-4 w-4 sm:h-5 sm:w-5" />
                  </div>
                  <div className="font-bold text-xs sm:text-sm">Cash / Tunai</div>
                  <div className={`text-[10px] sm:text-xs mt-0.5 sm:mt-1 ${paymentMethod === 'cash' ? 'text-zinc-400' : 'text-zinc-400'}`}>Bayar di kasir</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('qris')}
                className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl border transition-all relative overflow-hidden group ${paymentMethod === 'qris'
                    ? 'border-orange-600 bg-orange-600 text-white shadow-md shadow-orange-200 ring-2 ring-orange-200 ring-offset-1 sm:ring-offset-2'
                    : 'border-zinc-200 bg-white text-zinc-600 hover:border-orange-200 hover:bg-orange-50/50'
                  }`}
              >
                <div className="relative z-10 text-left">
                  <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center mb-2 sm:mb-3 ${paymentMethod === 'qris' ? 'bg-white/10' : 'bg-zinc-100'}`}>
                    <QrCode className="h-4 w-4 sm:h-5 sm:w-5" />
                  </div>
                  <div className="font-bold text-xs sm:text-sm">QRIS</div>
                  <div className={`text-[10px] sm:text-xs mt-0.5 sm:mt-1 ${paymentMethod === 'qris' ? 'text-white/80' : 'text-zinc-400'}`}>E-Wallet / Banking</div>
                </div>
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-4 sm:pt-6">
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3.5 sm:py-4 rounded-xl sm:rounded-2xl font-bold text-base sm:text-lg shadow-xl shadow-zinc-200 active:scale-[0.98] transition-all flex items-center justify-center gap-2 sm:gap-3 disabled:opacity-50 disabled:cursor-not-allowed ${paymentMethod === 'cash'
                  ? 'bg-zinc-900 text-white hover:bg-zinc-800'
                  : 'bg-orange-600 text-white hover:bg-orange-700 shadow-orange-200'
                }`}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span className="text-sm sm:text-base">Memproses...</span>
                </span>
              ) : (
                <>
                  <span className="text-sm sm:text-base">Bayar Sekarang</span>
                  <span className="bg-white/20 px-1.5 sm:px-2 py-0.5 rounded text-xs sm:text-sm">
                    {formatPrice(cart.totalPrice)}
                  </span>
                </>
              )}
            </button>
            <p className="text-center text-[10px] sm:text-xs text-zinc-400 mt-3 sm:mt-4 flex items-center justify-center gap-1.5">
              <AlertCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              Pastikan data pemesanan sudah benar
            </p>
          </div>
        </form>
      </div>
    </div>
  )
}
