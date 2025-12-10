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
    <div className="bg-white rounded-3xl overflow-hidden shadow-md shadow-black/5 border border-gray-200 hover:shadow-lg hover:shadow-red-100/50 hover:ring-1 hover:ring-red-100 transition-all duration-300 h-full flex flex-col">
      {/* Menu Image with inset padding and rounded container */}
      <div className="px-3 pt-3">
        <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-gray-100">
          {menu.foto_menu ? (
            <Image
              src={menu.foto_menu}
              alt={menu.nama_menu}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              quality={90}
              priority={false}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              <ImageOff className="h-10 w-10" />
            </div>
          )}

          {/* Category Badge */}
          {menu.kategori_menu && menu.kategori_menu.length > 0 && (
            <div className="absolute top-3 left-3">
              <span className="bg-black text-white text-[11px] sm:text-xs px-2 py-0.5 rounded-full font-medium">
                {menu.kategori_menu[0]}
              </span>
            </div>
          )}

          {/* Availability Status */}
          {!menu.tersedia && (
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
              <span className="bg-red-500 text-white px-3 py-1 rounded-lg text-sm font-bold shadow">
                Sudah Habis
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Menu Info */}
      <div className="p-4 space-y-3 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-2 min-h-[48px]">
          <h3 className="text-base sm:text-lg font-semibold text-black leading-tight line-clamp-2">
            {menu.nama_menu}
          </h3>
          <span className="text-sm sm:text-base font-bold text-gray-900 whitespace-nowrap">
            {formatPrice(menu.harga)}
          </span>
        </div>

        <p className="text-xs sm:text-sm text-gray-600 leading-snug line-clamp-2 min-h-[36px]">
          {menu.deskripsi || '\u00a0'}
        </p>

        <div className="text-[11px] sm:text-xs text-gray-500">
          {menu.total_sold && menu.total_sold > 0
            ? `Terjual ${menu.total_sold}`
            : 'Belum ada penjualan'}
        </div>

        {/* Action Bar */}
        <div className="mt-auto">
          {currentQuantity === 0 ? (
            <button
              onClick={handleIncrement}
              disabled={!menu.tersedia}
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-full text-sm font-semibold transition-all duration-150
                ${
                  menu.tersedia
                    ? 'bg-red-500 text-white hover:bg-red-600 active:scale-95'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }
              `}
            >
              <Plus className="h-4 w-4" />
              Tambah
            </button>
          ) : (
            <div className="flex items-center gap-3 pt-1">
              <div className="flex items-center gap-3 bg-white">
                <button
                  onClick={handleDecrement}
                  disabled={!menu.tersedia || currentQuantity === 0}
                  className={`h-10 w-10 rounded-full flex items-center justify-center text-white text-lg font-bold transition-all duration-150
                    ${
                      menu.tersedia && currentQuantity > 0
                        ? 'bg-black hover:bg-gray-800 active:scale-95'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }
                  `}
                  aria-label="Kurangi jumlah"
                >
                  <Minus className="h-5 w-5" />
                </button>

                <span className="text-sm sm:text-base font-semibold text-black min-w-[1.75rem] text-center">
                  {currentQuantity}
                </span>

                <button
                  onClick={handleIncrement}
                  disabled={!menu.tersedia}
                  className={`h-10 w-10 rounded-full flex items-center justify-center text-white text-lg font-bold transition-all duration-150
                    ${
                      menu.tersedia
                        ? 'bg-black hover:bg-gray-800 active:scale-95'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }
                  `}
                  aria-label="Tambah jumlah"
                >
                  <Plus className="h-5 w-5" />
                </button>
              </div>

              <button
                onClick={handleDelete}
                className="ml-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-150 bg-red-500 text-white hover:bg-red-600 active:scale-95"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}