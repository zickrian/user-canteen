'use client'

import { Store, Star, Clock } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import type { KantinWithRating } from '@/lib/supabase'

interface KantinCardProps {
  kantin: KantinWithRating
}

export default function KantinCard({ kantin }: KantinCardProps) {
  const renderStars = (rating: number) => {
    const stars = []
    const fullStars = Math.floor(rating)
    const hasHalfStar = rating % 1 !== 0

    for (let i = 0; i < fullStars; i++) {
      stars.push(<Star key={i} className="h-3 w-3 fill-yellow-400 text-yellow-400" />)
    }

    if (hasHalfStar) {
      stars.push(<Star key="half" className="h-3 w-3 fill-yellow-400/50 text-yellow-400" />)
    }

    const emptyStars = 5 - Math.ceil(rating)
    for (let i = 0; i < emptyStars; i++) {
      stars.push(<Star key={`empty-${i}`} className="h-3 w-3 text-gray-300" />)
    }

    return stars
  }

  return (
    <Link 
      href={`/kantin/${kantin.id}`}
      className="block border-2 border-black rounded-2xl overflow-hidden hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all duration-300 bg-white group"
    >
      <div className="relative w-full h-48 bg-gray-100">
        {kantin.foto_profil ? (
          <Image
            src={kantin.foto_profil}
            alt={kantin.nama_kantin}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <Store className="h-16 w-16 text-gray-300" />
          </div>
        )}
        
        {/* Status Badge */}
        <div className="absolute top-3 right-3">
          <span className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap ${
            kantin.buka_tutup && kantin.status === 'aktif'
              ? 'bg-green-500 text-white'
              : 'bg-red-500 text-white'
          }`}>
            {kantin.buka_tutup && kantin.status === 'aktif' ? 'BUKA' : 'TUTUP'}
          </span>
        </div>
      </div>
      
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <h3 className="text-lg font-bold text-black line-clamp-2 group-hover:text-gray-700 transition-colors">
            {kantin.nama_kantin}
          </h3>
        </div>

        {/* Rating */}
        {(kantin.avg_rating && kantin.total_ratings && kantin.total_ratings > 0) && (
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center">
              {renderStars(kantin.avg_rating)}
            </div>
            <span className="text-xs text-gray-600">
              {kantin.avg_rating.toFixed(1)} ({kantin.total_ratings})
            </span>
          </div>
        )}

        {/* Operating Hours */}
        {kantin.jam_buka && kantin.jam_tutup && (
          <div className="flex items-center gap-2 text-gray-600 mb-3">
            <Clock className="h-4 w-4" />
            <span className="text-sm">
              {kantin.jam_buka} - {kantin.jam_tutup}
            </span>
          </div>
        )}

        {/* Categories */}
        <div className="flex gap-2 flex-wrap">
          {/* You can add category badges here if you have category data for kantins */}
          <span className="text-xs px-2 py-1 border border-black rounded-md">
            {kantin.status === 'aktif' ? 'Tersedia' : 'Tidak Aktif'}
          </span>
        </div>
      </div>
    </Link>
  )
}
