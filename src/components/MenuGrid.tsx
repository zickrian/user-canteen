'use client'

import { useState, useEffect } from 'react'
import { Menu, Kantin } from '@/lib/supabase'
import { supabase } from '@/lib/supabase'
import MenuCard from './MenuCard'

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
          .eq('tersedia', true)
          .order('created_at', { ascending: false })

        if (menusError) {
          console.error('Error fetching menus:', menusError)
          setError('Gagal memuat data menu')
          return
        }

        setMenus(menusData || [])
      } catch (error) {
        console.error('Error:', error)
        setError('Terjadi kesalahan yang tidak terduga')
      } finally {
        setLoading(false)
      }
    }

    fetchMenus()
  }, [])

  // Filter menus based on search query and category
  const filteredMenus = menus.filter(menu => {
    const matchesSearch = searchQuery === '' || 
      menu.nama_menu.toLowerCase().includes(searchQuery.toLowerCase()) ||
      menu.deskripsi?.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesCategory = selectedCategory === '' || 
      menu.kategori_menu?.includes(selectedCategory)

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
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
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
        <div className="text-red-500 text-lg mb-4">❌ {error}</div>
        <button 
          onClick={() => window.location.reload()}
          className="bg-black text-white px-6 py-2 rounded-lg hover:bg-gray-800"
        >
          Coba Lagi
        </button>
      </div>
    )
  }

  if (filteredMenus.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-gray-400 text-lg mb-4">
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
          <div key={kantinId} className="space-y-4">
            {/* Kantin Header */}
            <div className="flex items-center gap-4 pb-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-black rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-lg">
                    {kantin.nama_kantin.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-black">{kantin.nama_kantin}</h3>
                  <p className="text-sm text-gray-600">
                    {kantin.jam_buka && kantin.jam_tutup 
                      ? `${kantin.jam_buka} - ${kantin.jam_tutup}`
                      : 'Jam operasional tidak tersedia'
                    }
                  </p>
                </div>
              </div>
              <div className="ml-auto">
                <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                  {menus.length} menu
                </span>
              </div>
            </div>

            {/* Menu Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
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
          .eq('tersedia', true)

        setKantins(kantinsData || [])
        setMenus(menusData || [])
      } catch (error) {
        console.error('Error fetching data:', error)
      }
    }

    fetchData()
  }, [])

  return { menus, kantins }
}