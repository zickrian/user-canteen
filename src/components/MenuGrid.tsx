'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Menu, Kantin } from '@/lib/supabase'
import { supabase } from '@/lib/supabase'
import MenuCard from './MenuCard'
import { UtensilsCrossed, XCircle, Store } from 'lucide-react'

interface MenuGridProps {
  searchQuery: string
  selectedCategory: string
}

export default function MenuGrid({ searchQuery, selectedCategory }: MenuGridProps) {
  const [menus, setMenus] = useState<Menu[]>([])
  const [kantins, setKantins] = useState<Kantin[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchMenus() {
      try {
        setLoading(true)
        setError(null)

        // Fetch all active kantins first
        const { data: kantinsData, error: kantinsError } = await supabase
          .from('kantin')
          .select('*')
          .eq('status', 'aktif')
          .eq('buka_tutup', true)

        if (kantinsError) {
          console.error('Error fetching kantins:', kantinsError)
          setError('Gagal memuat data kantin')
          return
        }

        setKantins(kantinsData || [])

        // Fetch all available menus from active kantins
        const { data: menusData, error: menusError } = await supabase
          .from('menu')
          .select('*')
          .in('kantin_id', kantinsData?.map(k => k.id) || [])
          .order('created_at', { ascending: false })

        if (menusError) {
          console.error('Error fetching menus:', menusError)
          setError('Gagal memuat data menu')
          return
        }

        // Fetch jumlah penjualan sebenarnya dari API
        if (menusData && menusData.length > 0) {
          try {
            const menuIds = menusData.map((m: Menu) => m.id)
            const salesResponse = await fetch('/api/menu/sales-count', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ menuIds })
            })

            if (salesResponse.ok) {
              const { salesCounts } = await salesResponse.json()
              // Update menu dengan jumlah penjualan sebenarnya
              const updatedMenus = menusData.map((menu: Menu) => ({
                ...menu,
                total_sold: salesCounts[menu.id] || 0
              }))
              setMenus(updatedMenus)
            } else {
              // Jika API error, gunakan data dari database
              setMenus(menusData || [])
            }
          } catch (salesError) {
            console.error('Error fetching sales count:', salesError)
            // Jika error, gunakan data dari database
            setMenus(menusData || [])
          }
        } else {
          setMenus(menusData || [])
        }
      } catch (error) {
        console.error('Error:', error)
        setError('Terjadi kesalahan yang tidak terduga')
      } finally {
        setLoading(false)
      }
    }

    fetchMenus()
  }, [])

  const kantinMap = kantins.reduce<Record<string, Kantin>>((acc, k) => {
    acc[k.id] = k
    return acc
  }, {})

  // Filter menus based on search query and category (menu or kantin name)
  const filteredMenus = menus.filter(menu => {
    const q = searchQuery.toLowerCase()
    const matchesSearch = searchQuery === '' || 
      menu.nama_menu.toLowerCase().includes(q) ||
      menu.deskripsi?.toLowerCase().includes(q) ||
      kantinMap[menu.kantin_id]?.nama_kantin?.toLowerCase().includes(q)

    const matchesCategory = selectedCategory === '' || 
      menu.kategori_menu?.some(cat => cat.toLowerCase().includes(selectedCategory.toLowerCase()))

    return matchesSearch && matchesCategory
  })

  // Group menus by kantin for better organization
  const menusByKantin = filteredMenus.reduce((acc, menu) => {
    if (!acc[menu.kantin_id]) {
      acc[menu.kantin_id] = {
        kantin: kantins.find(k => k.id === menu.kantin_id),
        menus: []
      }
    }
    acc[menu.kantin_id].menus.push(menu)
    return acc
  }, {} as Record<string, { kantin: Kantin | undefined; menus: Menu[] }>)

  if (loading) {
    return (
      <div className="space-y-8">
        {/* Loading skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="border-2 border-gray-200 rounded-2xl overflow-hidden">
                <div className="w-full h-32 bg-gray-200" />
                <div className="p-3 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-200 rounded w-full" />
                  <div className="h-5 bg-gray-200 rounded w-1/2" />
                  <div className="h-8 bg-gray-200 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <div className="flex justify-center mb-3">
          <XCircle className="h-10 w-10 text-red-500" />
        </div>
        <div className="text-red-600 text-lg mb-4 font-semibold">{error}</div>
        <button 
          onClick={() => window.location.reload()}
          className="bg-black text-white px-6 py-2 rounded-lg hover:bg-gray-800 transition-colors"
        >
          Coba Lagi
        </button>
      </div>
    )
  }

  if (filteredMenus.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="flex justify-center mb-3">
          <UtensilsCrossed className="h-10 w-10 text-gray-400" />
        </div>
        <div className="text-gray-600 text-lg mb-2 font-medium">
          {searchQuery || selectedCategory 
            ? 'Tidak ada menu yang cocok dengan filter Anda' 
            : 'Belum ada menu tersedia'}
        </div>
        {(searchQuery || selectedCategory) && (
          <p className="text-gray-400 text-sm">
            Coba ubah kata kunci pencarian atau kategori filter
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {Object.entries(menusByKantin).map(([kantinId, { kantin, menus }]) => {
        if (!kantin) return null

        return (
          <div
            key={kantinId}
            className="space-y-3 sm:space-y-4 rounded-xl sm:rounded-2xl border border-gray-200 bg-white p-3 sm:p-4 shadow-sm transition hover:shadow-md hover:-translate-y-0.5"
          >
            {/* Kantin Header */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 pb-3 sm:pb-4 border-b border-gray-200">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-full overflow-hidden bg-gray-100 border border-gray-200 shrink-0">
                  {kantin.foto_profil ? (
                    <Image
                      src={kantin.foto_profil}
                      alt={kantin.nama_kantin}
                      fill
                      className="object-cover"
                      sizes="56px"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      <Store className="h-5 w-5 sm:h-6 sm:w-6" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base sm:text-lg font-bold text-black truncate">{kantin.nama_kantin}</h3>
                  <p className="text-xs sm:text-sm text-gray-600 truncate">
                    {kantin.jam_buka && kantin.jam_tutup 
                      ? `${kantin.jam_buka} - ${kantin.jam_tutup}`
                      : 'Jam operasional tidak tersedia'
                    }
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3 sm:ml-auto">
                <span className="bg-green-100 text-green-800 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium shrink-0">
                  {menus.length} menu
                </span>
                <Link
                  href={`/kantin/${kantin.id}`}
                  className="inline-flex items-center rounded-lg bg-red-600 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 shrink-0"
                >
                  Kunjungi Kios
                </Link>
              </div>
            </div>

            {/* Menu List */}
            <div className="space-y-3">
              {menus.map((menu) => (
                <MenuCard 
                  key={menu.id} 
                  menu={menu} 
                  kantin={kantin}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// Hook to get menu data for AI Assistant
export function useMenuData() {
  const [menus, setMenus] = useState<Menu[]>([])
  const [kantins, setKantins] = useState<Kantin[]>([])

  useEffect(() => {
    async function fetchData() {
      try {
        const { data: kantinsData } = await supabase
          .from('kantin')
          .select('*')
          .eq('status', 'aktif')
          .eq('buka_tutup', true)

        const { data: menusData } = await supabase
          .from('menu')
          .select('*')
          .in('kantin_id', kantinsData?.map(k => k.id) || [])

        setKantins(kantinsData || [])

        // Fetch jumlah penjualan sebenarnya dari API
        if (menusData && menusData.length > 0) {
          try {
            const menuIds = menusData.map((m: Menu) => m.id)
            const salesResponse = await fetch('/api/menu/sales-count', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ menuIds })
            })

            if (salesResponse.ok) {
              const { salesCounts } = await salesResponse.json()
              // Update menu dengan jumlah penjualan sebenarnya
              const updatedMenus = menusData.map((menu: Menu) => ({
                ...menu,
                total_sold: salesCounts[menu.id] || 0
              }))
              setMenus(updatedMenus)
            } else {
              setMenus(menusData || [])
            }
          } catch (salesError) {
            console.error('Error fetching sales count:', salesError)
            setMenus(menusData || [])
          }
        } else {
          setMenus(menusData || [])
        }
      } catch (error) {
        console.error('Error fetching data:', error)
      }
    }

    fetchData()
  }, [])

  return { menus, kantins }
}