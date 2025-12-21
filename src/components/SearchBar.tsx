'use client'

import { useState } from 'react'
import { Search, ShoppingCart, X } from 'lucide-react'
import { useCart } from '@/contexts/CartContext'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import LoginModal from './LoginModal'
import ProfileButton from './ProfileButton'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  showCart?: boolean
}

export default function SearchBar({ value, onChange, showCart = false }: SearchBarProps) {
  const router = useRouter()
  const { getItemCount } = useCart()
  const { isAuthenticated } = useAuth()
  const [showLoginModal, setShowLoginModal] = useState(false)
  const itemCount = getItemCount()

  const proceedToCheckout = () => {
    const tableNumber = typeof window !== 'undefined'
      ? sessionStorage.getItem('table-number')
      : null

    if (!tableNumber) {
      alert('Masukkan nomor meja terlebih dahulu sebelum checkout')
      router.push('/?needTable=1')
      return
    }

    router.push('/checkout')
  }

  const handleCheckout = () => {
    // Check if user is authenticated
    if (!isAuthenticated) {
      setShowLoginModal(true)
      return
    }

    proceedToCheckout()
  }

  return (
    <div className="relative w-full">
      <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
        {/* Search Input */}
        <div className="relative flex-1 group min-w-0">
          <div className="absolute left-0 top-1/2 -translate-y-1/2 p-2 sm:p-3 pl-3 sm:pl-5 text-zinc-400 group-focus-within:text-orange-500 transition-colors pointer-events-none">
            <Search className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <input
            type="text"
            placeholder="Cari menu atau kantin..."
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full py-3 sm:py-4 pl-10 sm:pl-14 pr-10 sm:pr-12 text-sm sm:text-base bg-white border border-zinc-200 rounded-xl sm:rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-500 transition-all text-zinc-900 placeholder:text-zinc-400"
          />
          {value && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 p-1.5 sm:p-1 rounded-full hover:bg-zinc-100 transition-colors"
              aria-label="Hapus pencarian"
            >
              <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </button>
          )}
        </div>

        {/* Shopping Cart Icon - only show if showCart is true */}
        {showCart && (
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={handleCheckout}
              className="relative p-2.5 sm:p-3.5 bg-zinc-900 text-white rounded-xl sm:rounded-2xl hover:bg-zinc-800 transition-all active:scale-95 shadow-md shadow-zinc-200 min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              <ShoppingCart className="h-5 w-5 sm:h-6 sm:w-6" />
              {itemCount > 0 && (
                <span className="absolute -top-1 -right-1 sm:-top-1.5 sm:-right-1.5 bg-orange-500 text-white text-[9px] sm:text-[10px] font-bold rounded-full h-4 w-4 sm:h-5 sm:w-5 flex items-center justify-center border-2 border-white">
                  {itemCount > 99 ? '99+' : itemCount}
                </span>
              )}
            </button>
            {/* Profile Button - only show if authenticated */}
            <ProfileButton />
          </div>
        )}
      </div>

      {/* Login Modal */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onLoginSuccess={() => {
          setShowLoginModal(false)
          // Proceed to checkout after login
          setTimeout(() => {
            proceedToCheckout()
          }, 500)
        }}
        message="Sepertinya kamu belum login. Login terlebih dahulu untuk melanjutkan pemesanan."
      />
    </div>
  )
}
