'use client'

import KantinCard from './KantinCard'
import type { Kantin } from '@/lib/supabase'

interface KantinListProps {
  kantins: Kantin[]
  loading: boolean
}

export default function KantinList({ kantins, loading }: KantinListProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="border-2 border-gray-200 rounded-2xl overflow-hidden animate-pulse"
          >
            <div className="w-full h-48 bg-gray-200" />
            <div className="p-4 space-y-3">
              <div className="h-6 bg-gray-200 rounded w-3/4" />
              <div className="flex gap-2">
                <div className="h-6 bg-gray-200 rounded w-16" />
                <div className="h-6 bg-gray-200 rounded w-16" />
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (kantins.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-400 text-lg">Tidak ada kantin ditemukan</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {kantins.map((kantin) => (
        <KantinCard key={kantin.id} kantin={kantin} />
      ))}
    </div>
  )
}
