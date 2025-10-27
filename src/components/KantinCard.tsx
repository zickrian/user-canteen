'use client'

import { Store } from 'lucide-react'
import Image from 'next/image'
import type { Kantin } from '@/lib/supabase'

interface KantinCardProps {
  kantin: Kantin
}

export default function KantinCard({ kantin }: KantinCardProps) {
  return (
    <div className="border-2 border-black rounded-2xl overflow-hidden hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all duration-300 bg-white">
      <div className="relative w-full h-48 bg-gray-100">
        {kantin.foto_url ? (
          <Image
            src={kantin.foto_url}
            alt={kantin.nama}
            fill
            className="object-cover"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <Store className="h-16 w-16 text-gray-300" />
          </div>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-lg font-bold text-black line-clamp-2">
            {kantin.nama}
          </h3>
          <span
            className={`
              px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap
              ${
                kantin.status === 'buka'
                  ? 'bg-black text-white'
                  : 'bg-gray-200 text-gray-600'
              }
            `}
          >
            {kantin.status === 'buka' ? 'BUKA' : 'TUTUP'}
          </span>
        </div>
        <div className="flex gap-2 mt-3 flex-wrap">
          {kantin.makan_pagi && (
            <span className="text-xs px-2 py-1 border border-black rounded-md">
              Pagi
            </span>
          )}
          {kantin.makan_siang && (
            <span className="text-xs px-2 py-1 border border-black rounded-md">
              Siang
            </span>
          )}
          {kantin.snack && (
            <span className="text-xs px-2 py-1 border border-black rounded-md">
              Snack
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
