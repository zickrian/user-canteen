'use client'

import { Store } from 'lucide-react'
import KantinCard from './KantinCard'
import type { Kantin } from '@/lib/supabase'

interface KantinListProps {
  kantins: Kantin[]
  loading: boolean
}

export default function KantinList({ kantins, loading }: KantinListProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="border border-gray-200 rounded-3xl overflow-hidden animate-pulse bg-white shadow-sm"
          >
            <div className="w-full h-40 bg-gray-200" />
            <div className="p-4 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-3/4" />
              <div className="h-3 bg-gray-200 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (kantins.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="flex justify-center mb-3">
          <Store className="h-10 w-10 text-gray-300" />
        </div>
        <p className="text-gray-500 text-lg font-medium">Tidak ada kantin ditemukan</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
      {kantins.map((kantin) => (
        <KantinCard key={kantin.id} kantin={kantin} />
      ))}
    </div>
  )
}
