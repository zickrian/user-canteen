'use client'

import { Store, Star, Clock } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import type { KantinWithRating } from '@/lib/supabase'

interface KantinCardProps {
  kantin: KantinWithRating
}

export default function KantinCard({ kantin }: KantinCardProps) {
  const renderStars = (rating: number, totalRatings: number) => {
    return (
      <div className="flex items-center gap-1">
        <Star className="h-3.5 w-3.5 fill-orange-400 text-orange-400" />
        <span className="text-xs font-bold text-zinc-700">
          {rating.toFixed(1)}/5
        </span>
        {totalRatings > 0 && (
          <span className="text-[10px] text-zinc-400 font-normal">
            ({totalRatings})
          </span>
        )}
      </div>
    )
  }

  return (
    <Link
      href={`/kantin/${kantin.id}`}
      className="block group bg-white rounded-xl sm:rounded-2xl overflow-hidden border border-zinc-100 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_24px_-4px_rgba(0,0,0,0.1)] hover:-translate-y-1 transition-all duration-300"
    >
      <div className="relative w-full aspect-[4/3] bg-zinc-100 overflow-hidden">
        {kantin.foto_profil ? (
          <Image
            src={kantin.foto_profil}
            alt={kantin.nama_kantin}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-700"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            quality={90}
            priority={false}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <Store className="h-8 w-8 sm:h-10 sm:w-10 text-zinc-300" />
          </div>
        )}

        {/* Status Badge */}
        <div className="absolute top-2 right-2 sm:top-3 sm:right-3">
          <span className={`px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[9px] sm:text-[10px] font-bold uppercase tracking-wider shadow-sm backdrop-blur-md ${kantin.buka_tutup && kantin.status === 'aktif'
              ? 'bg-emerald-500/90 text-white'
              : 'bg-rose-500/90 text-white'
            }`}>
            {kantin.buka_tutup && kantin.status === 'aktif' ? 'Buka' : 'Tutup'}
          </span>
        </div>
      </div>

      <div className="p-3 sm:p-4 space-y-1.5 sm:space-y-2">
        <h3 className="text-base sm:text-lg font-bold text-zinc-900 group-hover:text-orange-600 transition-colors line-clamp-1">
          {kantin.nama_kantin}
        </h3>

        <div className="flex items-center justify-between gap-2">
          {/* Rating */}
          {(kantin.avg_rating && kantin.total_ratings && kantin.total_ratings > 0) ? (
            renderStars(kantin.avg_rating, kantin.total_ratings)
          ) : (
            <span className="text-[10px] sm:text-xs text-zinc-400">Belum ada rating</span>
          )}

          {/* Operating Hours */}
          {kantin.jam_buka && kantin.jam_tutup && (
            <div className="flex items-center gap-1 sm:gap-1.5 text-zinc-500 bg-zinc-50 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md shrink-0">
              <Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
              <span className="text-[9px] sm:text-[10px] font-medium">
                {kantin.jam_buka.slice(0, 5)} - {kantin.jam_tutup.slice(0, 5)}
              </span>
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}
