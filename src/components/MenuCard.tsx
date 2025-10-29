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
      <div className="relative w-full h-48 bg-gray-100">
        {menu.foto_menu ? (
          <Image
            src={menu.foto_menu}
            alt={menu.nama_menu}
            fill
            className="object-cover"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-400 text-center">
              <div className="text-4xl mb-2">🍽️</div>
              <p className="text-sm">No Image</p>
            </div>
          </div>
        )}
        
        {/* Category Badge */}
        {menu.kategori_menu && menu.kategori_menu.length > 0 && (
          <div className="absolute top-3 left-3">
            <span className="bg-black text-white text-xs px-3 py-1 rounded-full font-medium">
              {menu.kategori_menu[0]}
            </span>
          </div>
        )}

        {/* Availability Status */}
        {!menu.tersedia && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <span className="bg-red-500 text-white px-4 py-2 rounded-lg font-bold">
              Tidak Tersedia
            </span>
          </div>
        )}
      </div>

      {/* Menu Info */}
      <div className="p-4">
        <div className="mb-3">
          <h3 className="text-lg font-bold text-black line-clamp-2 mb-1">
            {menu.nama_menu}
          </h3>
          {menu.deskripsi && (
            <p className="text-sm text-gray-600 line-clamp-2">
              {menu.deskripsi}
            </p>
          )}
        </div>

        {/* Price and Rating */}
        <div className="flex items-center justify-between mb-4">
          <div className="text-xl font-bold text-black">
            {formatPrice(menu.harga)}
          </div>
          
          {menu.total_sold && menu.total_sold > 0 && (
            <div className="flex items-center gap-1 text-sm text-gray-600">
              <span>Terjual {menu.total_sold}</span>
            </div>
          )}
        </div>

        {/* Add to Cart Button */}
        <button
          onClick={handleAddToCart}
          disabled={!menu.tersedia}
          className={`
            w-full py-3 px-4 rounded-lg font-medium transition-all duration-200
            flex items-center justify-center gap-2
            ${
              menu.tersedia
                ? 'bg-black text-white hover:bg-gray-800 active:scale-95'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }
          `}
        >
          <Plus className="h-5 w-5" />
          <span>Tambah ke Keranjang</span>
        </button>
      </div>
    </div>
  )
}