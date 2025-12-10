'use client'

import { Search, ShoppingCart, X } from 'lucide-react'
import { useCart } from '@/contexts/CartContext'
import Link from 'next/link'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  showCart?: boolean
}

export default function SearchBar({ value, onChange, showCart = false }: SearchBarProps) {
  const { getItemCount } = useCart()
  const itemCount = getItemCount()

  return (
    <div className="relative w-full">
      <div className="flex items-center gap-4">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Cari menu atau kantin..."
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full py-3 pl-12 pr-12 text-base border border-gray-400 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 transition-all"
          />
          {value && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 rounded-full focus:outline-none focus:ring-2 focus:ring-gray-300"
              aria-label="Hapus pencarian"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Shopping Cart Icon - only show if showCart is true */}
        {showCart && (
          <Link
            href="/checkout"
            className="relative p-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            <ShoppingCart className="h-6 w-6" />
            {itemCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center">
                {itemCount > 99 ? '99+' : itemCount}
              </span>
            )}
          </Link>
        )}
      </div>
    </div>
  )
}
