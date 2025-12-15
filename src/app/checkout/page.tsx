'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useCart } from '@/contexts/CartContext'
import { CheckoutForm } from '@/lib/supabase'
import { ArrowLeft, Plus, Minus, Trash2, Clock, User, Mail, Table, QrCode } from 'lucide-react'

export default function CheckoutPage() {
  const router = useRouter()
  const { cart, updateQuantity, removeItem, clearCart } = useCart()
  const [loading, setLoading] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const [qrCode, setQrCode] = useState<string>('')
  const [orderId, setOrderId] = useState<string>('')
  const [midtransOrderId, setMidtransOrderId] = useState<string>('')
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'success' | 'failed'>('pending')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'qris'>('qris')
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
  const hasCheckedTableNumber = useRef(false)

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
      const data = await response.json()
      
      if (data.status === 'settlement') {
        setPaymentStatus('success')
        setTimeout(() => {
          clearCart()
          router.push(`/struk/${data.pesananId}`)
        }, 2000)
      } else if (['expire', 'cancel', 'deny'].includes(data.status)) {
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
      }, 3000) // Check every 3 seconds
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [showQR, paymentStatus, midtransOrderId])

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

    // Validasi email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(formData.email.trim())) {
      alert('Format email tidak valid')
      return
    }

    // Validasi nomor meja wajib untuk kedua tipe pesanan
    if (!formData.nomor_meja.trim()) {
      alert('Nomor meja wajib diisi untuk pengiriman pesanan')
      return
    }

    // Show confirmation modal instead of processing directly
    setShowConfirmation(true)
  }

  const handleConfirmPayment = async () => {
    setShowConfirmation(false)
    setLoading(true)

    try {
      // Group items by kantin (for now, we'll process one kantin at a time)
      const firstKantinId = cart.items[0].kantin.id
      const itemsForKantin = cart.items.filter(item => item.kantin.id === firstKantinId)
      
      if (cart.items.some(item => item.kantin.id !== firstKantinId)) {
        alert('Saat ini hanya bisa memesan dari satu kantin saja')
        return
      }

      const orderData = {
        kantinId: firstKantinId,
        grossAmount: cart.totalPrice,
        customerDetails: formData,
        items: itemsForKantin.map(item => ({
          menu: item.menu,
          quantity: item.quantity
        })),
        paymentMethod: paymentMethod
      }

      // Create payment order
      const endpoint = paymentMethod === 'cash' 
        ? '/api/orders/create-cash-order' 
        : '/api/midtrans/create-payment'
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ orderData }),
      })

      const data = await response.json()

      if (!response.ok) {
        const errorMsg = data.error || 'Gagal membuat pembayaran'
        console.error('API Error:', errorMsg)
        throw new Error(errorMsg)
      }

      // For cash payment, go directly to struk
      if (paymentMethod === 'cash') {
        clearCart()
        router.push(`/struk/${data.orderId}`)
        return
      }

      // Show QR code for QRIS
      setOrderId(data.orderId)
      setMidtransOrderId(data.midtransOrderId)
      setQrCode(data.redirect_url)
      setShowQR(true)

    } catch (error) {
      console.error('Error creating payment:', error)
      const errorMsg = error instanceof Error ? error.message : 'Terjadi kesalahan saat membuat pesanan. Silakan coba lagi.'
      alert(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  const handleBackToCart = () => {
    setShowQR(false)
    setPaymentStatus('pending')
    setQrCode('')
    setOrderId('')
  }

  if (isCheckingTableNumber) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-4xl mx-auto px-4 py-16 text-center text-gray-700">
          Memeriksa akses checkout...
        </div>
      </div>
    )
  }

  if (cart.items.length === 0 && !showQR) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-4xl mx-auto px-4 py-16">
          <div className="text-center">
            <div className="text-6xl mb-4">🛒</div>
            <h1 className="text-2xl font-bold text-black mb-4">Keranjang Belanja Kosong</h1>
            <p className="text-gray-600 mb-8">Tambahkan menu ke keranjang untuk memesan</p>
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

  if (showQR) {
    return (
      <div className="min-h-screen bg-white">
        {/* Header */}
        <header className="bg-white border-b-2 border-red-600 sticky top-0 z-40">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="flex items-center gap-4">
              <button
                onClick={handleBackToCart}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <h1 className="text-xl font-bold text-red-600">
                {paymentMethod === 'qris' ? 'Pembayaran QRIS' : 'Pembayaran Cash'}
              </h1>
            </div>
          </div>
        </header>

        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-white border-2 border-red-600 rounded-2xl p-8">
            <div className="text-center">
              <QrCode className="h-16 w-16 mx-auto mb-4 text-red-600" />
              
              <h2 className="text-2xl font-bold text-red-600 mb-2">
                {paymentStatus === 'pending' && 'Scan QR Code untuk Pembayaran'}
                {paymentStatus === 'success' && 'Pembayaran Berhasil!'}
                {paymentStatus === 'failed' && 'Pembayaran Gagal'}
              </h2>
              
              <p className="text-gray-600 mb-6">
                {paymentStatus === 'pending' && `Total Pembayaran: ${formatPrice(cart.totalPrice)}`}
                {paymentStatus === 'success' && 'Mengalihkan ke halaman struk...'}
                {paymentStatus === 'failed' && 'Silakan coba lagi atau hubungi admin'}
              </p>

              {paymentStatus === 'pending' && qrCode && (
                <div className="mb-6">
                  <iframe
                    src={qrCode}
                    className="w-full max-w-md mx-auto h-96 border-2 border-gray-200 rounded-lg"
                    title="QRIS Payment"
                  />
                  <p className="text-sm text-gray-500 mt-4">
                    Scan QR code di atas menggunakan aplikasi e-wallet Anda
                  </p>
                </div>
              )}

              {paymentStatus === 'success' && (
                <div className="text-6xl mb-4">✅</div>
              )}

              {paymentStatus === 'failed' && (
                <div className="text-6xl mb-4">❌</div>
              )}

              <div className="flex gap-4 justify-center">
                {paymentStatus === 'pending' && (
                  <button
                    onClick={handleBackToCart}
                    className="px-6 py-3 border-2 border-black text-black rounded-lg hover:bg-gray-50"
                  >
                    Kembali ke Keranjang
                  </button>
                )}
                
                {paymentStatus === 'failed' && (
                  <>
                    <button
                      onClick={handleBackToCart}
                      className="px-6 py-3 border-2 border-red-600 text-red-600 rounded-lg hover:bg-red-50"
                    >
                      Kembali ke Keranjang
                    </button>
                    <button
                      onClick={() => window.location.reload()}
                      className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700"
                    >
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
    <div className="min-h-screen bg-white">
      {/* Confirmation Modal */}
      {showConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-20 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border-2 border-black max-w-sm w-full p-8 shadow-2xl">
            <div className="text-center">
              <div className="text-4xl mb-4">
                {paymentMethod === 'cash' ? '💵' : '📱'}
              </div>
              <h2 className="text-2xl font-bold text-black mb-2">Konfirmasi Pembayaran</h2>
              <p className="text-gray-600 mb-6">
                Apakah kamu yakin akan melakukan pembayaran menggunakan metode <span className="font-bold text-red-600">{paymentMethod === 'cash' ? 'Cash di Kasir' : 'QRIS'}</span>?
              </p>
              
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Total Pembayaran:</span>
                  <span className="text-2xl font-bold text-red-600">{formatPrice(cart.totalPrice)}</span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirmation(false)}
                  className="flex-1 px-4 py-3 border-2 border-black text-black rounded-lg hover:bg-gray-50 font-semibold transition-all"
                >
                  Batal
                </button>
                <button
                  onClick={handleConfirmPayment}
                  disabled={loading}
                  className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-all"
                >
                  {loading ? 'Memproses...' : 'Ya, Lanjutkan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-xl font-bold text-black">Checkout</h1>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Cart Items */}
          <div className="bg-white border-2 border-black rounded-2xl p-6">
            <h2 className="text-lg font-bold text-red-600 mb-4">Keranjang Belanja</h2>
            
            <div className="space-y-4">
              {cart.items.map((item) => (
                <div key={item.menu.id} className="flex items-center gap-4 pb-4 border-b border-gray-200 last:border-0">
                  <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center">
                    {item.menu.foto_menu ? (
                      <img 
                        src={item.menu.foto_menu} 
                        alt={item.menu.nama_menu}
                        className="w-full h-full object-cover rounded-lg"
                      />
                    ) : (
                      <span className="text-2xl">🍽️</span>
                    )}
                  </div>
                  
                  <div className="flex-1">
                    <h3 className="font-semibold text-black">{item.menu.nama_menu}</h3>
                    <p className="text-sm text-gray-600">{item.kantin.nama_kantin}</p>
                    <p className="text-sm font-bold text-black">{formatPrice(item.menu.harga)}</p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleQuantityChange(item.menu.id, item.quantity - 1)}
                      className="p-1 hover:bg-gray-100 rounded"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-8 text-center font-medium">{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => handleQuantityChange(item.menu.id, item.quantity + 1)}
                      className="p-1 hover:bg-gray-100 rounded"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeItem(item.menu.id)}
                      className="p-1 hover:bg-gray-100 rounded text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-6 pt-4 border-t-2 border-black">
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold text-black">Total:</span>
                <span className="text-xl font-bold text-black">{formatPrice(cart.totalPrice)}</span>
              </div>
            </div>
          </div>

          {/* Customer Information */}
          <div className="bg-white border-2 border-black rounded-2xl p-6">
            <h2 className="text-lg font-bold text-red-600 mb-4">Informasi Pelanggan</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-black mb-2">
                  <User className="h-4 w-4" />
                  Nama Lengkap *
                </label>
                <input
                  type="text"
                  name="nama_pelanggan"
                  value={formData.nama_pelanggan}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                  placeholder="Masukkan nama lengkap"
                />
              </div>
              
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-black mb-2">
                  <Mail className="h-4 w-4" />
                  Email *
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                  placeholder="email@example.com"
                />
              </div>
              
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-black mb-2">
                  <Table className="h-4 w-4" />
                  Nomor Meja *
                </label>
                <input
                  type="text"
                  name="nomor_meja"
                  value={formData.nomor_meja}
                  onChange={handleInputChange}
                  required
                  readOnly={isTableNumberLocked}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black ${isTableNumberLocked ? 'bg-gray-50 border-gray-200 cursor-not-allowed' : 'border-gray-300'}`}
                  placeholder="Contoh: A1, B2, etc. (untuk pengiriman pesanan)"
                />
                {isTableNumberLocked && (
                  <p className="mt-1 text-xs text-gray-500">
                    Nomor meja mengikuti pilihan Anda sebelumnya. Ubah dari kartu nomor meja di kios.
                  </p>
                )}
              </div>
              
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-black mb-2">
                  <Clock className="h-4 w-4" />
                  Tipe Pesanan
                </label>
                <select
                  name="tipe_pesanan"
                  value={formData.tipe_pesanan}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                >
                  <option value="dine_in">Dine In</option>
                  <option value="take_away">Take Away</option>
                </select>
              </div>
            </div>
            
            <div className="mt-4">
              <label className="text-sm font-medium text-black mb-2 block">
                Catatan Pesanan (Opsional)
              </label>
              <textarea
                name="catatan_pesanan"
                value={formData.catatan_pesanan}
                onChange={handleInputChange}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                placeholder="Tambahkan catatan khusus untuk pesanan Anda..."
              />
            </div>
          </div>

          {/* Payment Method Selection */}
          <div className="bg-white border-2 border-black rounded-2xl p-6">
            <h2 className="text-lg font-bold text-red-600 mb-4">Metode Pembayaran</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setPaymentMethod('cash')}
                className={`p-4 border-2 rounded-lg transition-all ${
                  paymentMethod === 'cash'
                    ? 'border-red-600 bg-red-600 text-white'
                    : 'border-gray-300 bg-white text-black hover:border-red-600'
                }`}
              >
                <div className="text-2xl mb-2">💵</div>
                <div className="font-bold">Cash di Kasir</div>
                <div className="text-sm mt-1 opacity-75">Pembayaran langsung di kasir</div>
              </button>
              
              <button
                type="button"
                onClick={() => setPaymentMethod('qris')}
                className={`p-4 border-2 rounded-lg transition-all ${
                  paymentMethod === 'qris'
                    ? 'border-red-600 bg-red-600 text-white'
                    : 'border-gray-300 bg-white text-black hover:border-red-600'
                }`}
              >
                <div className="text-2xl mb-2">📱</div>
                <div className="font-bold">QRIS</div>
                <div className="text-sm mt-1 opacity-75">Scan QR code e-wallet</div>
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex-1 px-6 py-3 border-2 border-black text-black rounded-lg hover:bg-gray-50"
            >
              Kembali
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-semibold"
            >
              {paymentMethod === 'cash' ? (
                <>
                  💵
                  {loading ? 'Memproses...' : `Bayar Cash ${formatPrice(cart.totalPrice)}`}
                </>
              ) : (
                <>
                  <QrCode className="h-5 w-5" />
                  {loading ? 'Memproses...' : `Bayar dengan QRIS ${formatPrice(cart.totalPrice)}`}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}