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
      className="block bg-white rounded-3xl overflow-hidden transition-all duration-300 group shadow-md hover:shadow-xl hover:shadow-black/10 border border-gray-200"
    >
      <div className="relative w-full h-40 bg-gray-100">
        {kantin.foto_profil ? (
          <Image
            src={kantin.foto_profil}
            alt={kantin.nama_kantin}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <Store className="h-10 w-10 text-gray-300" />
          </div>
        )}
        
        {/* Status Badge */}
        <div className="absolute top-2 right-2">
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold whitespace-nowrap shadow-sm ${
            kantin.buka_tutup && kantin.status === 'aktif'
              ? 'bg-green-500 text-white shadow-green-500/25'
              : 'bg-red-500 text-white shadow-red-500/25'
          }`}>
            {kantin.buka_tutup && kantin.status === 'aktif' ? 'BUKA' : 'TUTUP'}
          </span>
        </div>
      </div>
      
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-lg font-semibold text-black line-clamp-1 group-hover:text-gray-700 transition-colors">
            {kantin.nama_kantin}
          </h3>
        </div>

        {/* Rating */}
        {(kantin.avg_rating && kantin.total_ratings && kantin.total_ratings > 0) ? (
          <div className="flex items-center gap-2">
            <div className="flex items-center">
              {renderStars(kantin.avg_rating)}
            </div>
            <span className="text-sm text-gray-600 font-medium">
              {kantin.avg_rating.toFixed(1)} ({kantin.total_ratings})
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Belum memiliki rating</span>
          </div>
        )}

        {/* Operating Hours */}
        {kantin.jam_buka && kantin.jam_tutup && (
          <div className="flex items-center gap-2 text-gray-600">
            <Clock className="h-4 w-4" />
            <span className="text-sm font-medium">
              {kantin.jam_buka} - {kantin.jam_tutup}
            </span>
          </div>
        )}
      </div>
    </Link>
  )
}
