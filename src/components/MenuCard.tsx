'use client'

import Image from 'next/image'
import { Plus, Star } from 'lucide-react'
import { Menu, Kantin } from '@/lib/supabase'
import { useCart } from '@/contexts/CartContext'

interface MenuCardProps {
  menu: Menu
  kantin: Kantin
}

export default function MenuCard({ menu, kantin }: MenuCardProps) {
  const { addItem } = useCart()

  const handleAddToCart = () => {
    addItem(menu, kantin)
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
    <div className="bg-white border-2 border-black rounded-2xl overflow-hidden hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all duration-300">
      {/* Menu Image */}
      <div className="relative w-full h-32 bg-gray-100">
        {menu.foto_menu ? (
          <Image
            src={menu.foto_menu}
            alt={menu.nama_menu}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-400 text-center">
              <div className="text-3xl mb-1">🍽️</div>
              <p className="text-xs">No Image</p>
            </div>
          </div>
        )}
        
        {/* Category Badge */}
        {menu.kategori_menu && menu.kategori_menu.length > 0 && (
          <div className="absolute top-2 left-2">
            <span className="bg-black text-white text-xs px-2 py-0.5 rounded-full font-medium">
              {menu.kategori_menu[0]}
            </span>
          </div>
        )}

        {/* Availability Status */}
        {!menu.tersedia && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <span className="bg-red-500 text-white px-3 py-1 rounded-lg text-sm font-bold">
              Tidak Tersedia
            </span>
          </div>
        )}
      </div>

      {/* Menu Info */}
      <div className="p-3">
        <div className="mb-2">
          <h3 className="text-base font-bold text-black line-clamp-1 mb-1">
            {menu.nama_menu}
          </h3>
          {menu.deskripsi && (
            <p className="text-xs text-gray-600 line-clamp-1">
              {menu.deskripsi}
            </p>
          )}
        </div>

        {/* Price and Rating */}
        <div className="flex items-center justify-between mb-2">
          <div className="text-lg font-bold text-black">
            {formatPrice(menu.harga)}
          </div>
          
          {menu.total_sold && menu.total_sold > 0 && (
            <div className="flex items-center gap-1 text-xs text-gray-600">
              <span>Terjual {menu.total_sold}</span>
            </div>
          )}
        </div>

        {/* Add to Cart Button */}
        <button
          onClick={handleAddToCart}
          disabled={!menu.tersedia}
          className={`
            w-full py-2 px-3 rounded-lg text-sm font-medium transition-all duration-200
            flex items-center justify-center gap-2
            ${
              menu.tersedia
                ? 'bg-black text-white hover:bg-gray-800 active:scale-95'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }
          `}
        >
          <Plus className="h-4 w-4" />
          <span>Tambah ke Keranjang</span>
        </button>
      </div>
    </div>
  )
}