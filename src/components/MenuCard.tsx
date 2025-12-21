'use client'

import Image from 'next/image'
import { Plus, Minus, ImageOff } from 'lucide-react'
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

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price)
  }

  return (
    <div className="group bg-white rounded-xl sm:rounded-2xl p-2.5 sm:p-3 border border-zinc-100 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] hover:shadow-[0_4px_16px_-4px_rgba(0,0,0,0.1)] transition-all duration-300 flex gap-3 sm:gap-4">
      {/* Menu Image */}
      <div className="relative w-20 h-20 sm:w-24 sm:h-24 shrink-0 rounded-lg sm:rounded-xl overflow-hidden bg-zinc-50">
        {menu.foto_menu ? (
          <Image
            src={menu.foto_menu}
            alt={menu.nama_menu}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            sizes="96px"
            quality={90}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-zinc-300">
            <ImageOff className="h-8 w-8" />
          </div>
        )}

        {/* Category Badge */}
        {menu.kategori_menu && menu.kategori_menu.length > 0 && (
          <div className="absolute top-1 left-1 sm:top-1.5 sm:left-1.5 z-10">
            <span className="bg-white/95 backdrop-blur-sm text-zinc-900 text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full font-medium shadow-sm border border-zinc-100">
              {menu.kategori_menu[0]}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col justify-between py-0.5 min-w-0">
        <div className="min-w-0">
          <div className="flex justify-between items-start gap-2">
            <h3 className="font-semibold text-zinc-900 leading-tight text-xs sm:text-sm truncate">
              {menu.nama_menu}
            </h3>
          </div>

          {menu.deskripsi && (
            <p className="mt-0.5 sm:mt-1 text-[10px] sm:text-xs text-zinc-500 line-clamp-2 leading-relaxed">
              {menu.deskripsi}
            </p>
          )}
        </div>

        <div className="flex items-end justify-between mt-1.5 sm:mt-2 gap-2">
          <div className="flex flex-col min-w-0">
            <span className="text-xs sm:text-sm font-bold text-orange-600">
              {formatPrice(menu.harga)}
            </span>
            <span className="text-[9px] sm:text-[10px] text-zinc-400 font-medium">
              {menu.total_sold && menu.total_sold > 0 
                ? `${menu.total_sold} terjual` 
                : 'belum terjual'}
            </span>
          </div>

          <div className="flex items-center shrink-0">
            {!menu.tersedia ? (
              <span className="px-2 sm:px-3 py-0.5 sm:py-1 bg-zinc-100 text-zinc-400 text-[10px] sm:text-xs font-medium rounded-lg">
                Habis
              </span>
            ) : currentQuantity === 0 ? (
              <button
                onClick={handleIncrement}
                className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-full bg-orange-50 text-orange-600 hover:bg-orange-600 hover:text-white transition-all duration-300"
                aria-label="Tambah"
              >
                <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
            ) : (
              <div className="flex items-center bg-zinc-50 rounded-full p-0.5 border border-zinc-100">
                <button
                  onClick={handleDecrement}
                  className="w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-full bg-white text-zinc-600 shadow-sm hover:text-orange-600 transition-colors"
                >
                  <Minus className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                </button>
                <span className="w-6 sm:w-8 text-center text-xs sm:text-sm font-bold text-zinc-900">
                  {currentQuantity}
                </span>
                <button
                  onClick={handleIncrement}
                  className="w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-full bg-orange-600 text-white shadow-sm hover:bg-orange-700 transition-colors"
                >
                  <Plus className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}