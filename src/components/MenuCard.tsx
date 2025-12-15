'use client'

import Image from 'next/image'
import { Plus, Minus, Trash2, ImageOff } from 'lucide-react'
import { Menu, Kantin } from '@/lib/supabase'
import { useCart } from '@/contexts/CartContext'

interface MenuCardProps {
  menu: Menu
  kantin: Kantin
}

export default function MenuCard({ menu, kantin }: MenuCardProps) {
  const { addItem, updateQuantity, removeItem, cart } = useCart()

  const currentQuantity =
    cart.items.find((item) => item.menu.id === menu.id)?.quantity ?? 0

  const handleIncrement = () => {
    addItem(menu, kantin)
  }

  const handleDecrement = () => {
    if (currentQuantity > 1) {
      updateQuantity(menu.id, currentQuantity - 1)
    } else if (currentQuantity === 1) {
      removeItem(menu.id)
    }
  }

  const handleDelete = () => {
    removeItem(menu.id)
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price)
  }

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-md shadow-black/5 border border-gray-200 hover:shadow-lg hover:shadow-red-100/50 hover:ring-1 hover:ring-red-100 transition-all duration-300 flex items-center gap-3 sm:gap-4 p-3 sm:p-4">
      {/* Menu Image - Left Side */}
      <div className="relative w-20 h-20 sm:w-24 sm:h-24 shrink-0 rounded-xl overflow-hidden bg-gray-100">
        {menu.foto_menu ? (
          <Image
            src={menu.foto_menu}
            alt={menu.nama_menu}
            fill
            className="object-cover"
            sizes="96px"
            quality={90}
            priority={false}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            <ImageOff className="h-6 w-6 sm:h-8 sm:w-8" />
          </div>
        )}

        {/* Category Badge */}
        {menu.kategori_menu && menu.kategori_menu.length > 0 && (
          <div className="absolute top-1 left-1">
            <span className="bg-black text-white text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded-full font-medium">
              {menu.kategori_menu[0]}
            </span>
          </div>
        )}

        {/* Availability Status */}
        {!menu.tersedia && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <span className="bg-red-500 text-white px-1.5 py-0.5 rounded text-[10px] sm:text-xs font-bold shadow">
              Habis
            </span>
          </div>
        )}
      </div>

      {/* Menu Info + Action */}
      <div className="flex-1 min-w-0 flex items-stretch justify-between gap-3 sm:gap-4">
        {/* Text Info */}
        <div className="flex-1 min-w-0 space-y-1.5 sm:space-y-2">
          <h3 className="text-sm sm:text-base font-semibold text-black leading-tight line-clamp-1">
            {menu.nama_menu}
          </h3>

          <span className="block text-sm sm:text-base font-bold text-red-500">
            {formatPrice(menu.harga)}
          </span>

          {menu.deskripsi && (
            <p className="text-[11px] sm:text-xs text-gray-600 leading-snug line-clamp-2">
              {menu.deskripsi}
            </p>
          )}

          <div className="text-[10px] sm:text-[11px] text-gray-500">
            {menu.total_sold && menu.total_sold > 0
              ? `Terjual ${menu.total_sold}`
              : 'Belum ada penjualan'}
          </div>
        </div>

        {/* Action Column */}
        <div className="flex items-center">
          {currentQuantity === 0 ? (
            <button
              onClick={handleIncrement}
              disabled={!menu.tersedia}
              className={`h-9 w-9 sm:h-10 sm:w-10 flex items-center justify-center rounded-xl text-white text-sm font-semibold transition-all duration-150
                ${
                  menu.tersedia
                    ? 'bg-red-500 hover:bg-red-600 active:scale-95'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }
              `}
              aria-label="Tambah ke keranjang"
            >
              <Plus className="h-4 w-4" />
            </button>
          ) : (
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                onClick={handleDecrement}
                disabled={!menu.tersedia || currentQuantity === 0}
                className={`h-8 w-8 sm:h-9 sm:w-9 rounded-full flex items-center justify-center text-white transition-all duration-150
                  ${
                    menu.tersedia && currentQuantity > 0
                      ? 'bg-red-500 hover:bg-red-600 active:scale-95'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }
                `}
                aria-label="Kurangi jumlah"
              >
                <Minus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </button>

              <span className="text-xs sm:text-sm font-semibold text-black min-w-5 sm:min-w-6 text-center">
                {currentQuantity}
              </span>

              <button
                onClick={handleIncrement}
                disabled={!menu.tersedia}
                className={`h-8 w-8 sm:h-9 sm:w-9 rounded-full flex items-center justify-center text-white transition-all duration-150
                  ${
                    menu.tersedia
                      ? 'bg-red-500 hover:bg-red-600 active:scale-95'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }
                `}
                aria-label="Tambah jumlah"
              >
                <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}