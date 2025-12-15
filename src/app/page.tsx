'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import KantinList from '@/components/KantinList'
import SearchBar from '@/components/SearchBar'
import MealFilter, { type MealTime } from '@/components/MealFilter'
import AIAssistant from '@/components/AIAssistant'
import MenuGrid from '@/components/MenuGrid'
import { supabase } from '@/lib/supabase'
import type { KantinWithRating, Menu } from '@/lib/supabase'

function SearchParamsGate({ onNeedTable }: { onNeedTable: () => void }) {
  const searchParams = useSearchParams()
  useEffect(() => {
    const needsTable = searchParams.get('needTable')
    if (needsTable === '1') {
      onNeedTable()
    }
  }, [searchParams, onNeedTable])
  return null
}

export default function Home() {
  const [kantins, setKantins] = useState<KantinWithRating[]>([])
  const [filteredKantins, setFilteredKantins] = useState<KantinWithRating[]>([])
  const [menus, setMenus] = useState<Menu[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [mealFilter, setMealFilter] = useState<MealTime>('')
  const [tableNumber, setTableNumber] = useState('')
  const [showTableModal, setShowTableModal] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    filterKantins()
  }, [kantins, searchQuery, mealFilter, menus])

  useEffect(() => {
    const existing = typeof window !== 'undefined'
      ? sessionStorage.getItem('table-number')
      : null

    if (existing) {
      setTableNumber(existing)
      setShowTableModal(false)
    } else {
      setShowTableModal(true)
    }
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      
      // Fetch kantins
      const { data: kantinsData, error: kantinsError } = await supabase
        .from('kantin')
        .select(`
          *,
          menu(id, kategori_menu, nama_menu)
        `)
        .eq('status', 'aktif')
        .order('nama_kantin', { ascending: true })

      if (kantinsError) throw kantinsError

      // Fetch all menus
      const { data: menusData, error: menusError } = await supabase
        .from('menu')
        .select('*')
        .eq('tersedia', true)

      if (menusError) throw menusError

      // Format kantins data
      const kantinsWithRating = kantinsData.map(kantin => {
        return {
          ...kantin,
          avg_rating: 0,
          total_ratings: 0,
          total_menus: kantin.menu?.length || 0,
          menus: kantin.menu
        }
      })

      setKantins(kantinsWithRating)
      setMenus(menusData || [])
      setFilteredKantins(kantinsWithRating)
      
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const filterKantins = () => {
    let filtered = kantins

    // Filter by search query (kantin name or menu name)
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(kantin => {
        const matchKantin = kantin.nama_kantin.toLowerCase().includes(q)
        const matchMenu = menus.some(menu =>
          menu.kantin_id === kantin.id &&
          menu.nama_menu?.toLowerCase().includes(q)
        )
        return matchKantin || matchMenu
      })
    }

    // Filter by meal type
    if (mealFilter) {
      filtered = filtered.filter((kantin: any) => {
        if (!kantin.menu) return false
        return kantin.menu.some((menu: any) =>
          menu.kategori_menu && menu.kategori_menu.includes(mealFilter)
        )
      })
    }

    setFilteredKantins(filtered)
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <Suspense fallback={null}>
        <SearchParamsGate onNeedTable={() => setShowTableModal(true)} />
      </Suspense>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Search Bar */}
        <div className="mb-6">
          <SearchBar value={searchQuery} onChange={setSearchQuery} showCart={true} />
        </div>

        {/* Meal Filter */}
        <div className="mb-8">
          <MealFilter selected={mealFilter} onSelect={setMealFilter} />
        </div>

        {mealFilter || searchQuery ? (
          <MenuGrid searchQuery={searchQuery} selectedCategory={mealFilter} />
        ) : (
          <KantinList kantins={filteredKantins} loading={loading} />
        )}
      </div>

      {/* AI Assistant - Fixed Position Bottom Right */}
      <AIAssistant />

      {showTableModal && (
        <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/40 px-4 pb-6 md:items-center md:pb-0">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-black">Nomor Meja</h3>
                <p className="text-sm text-gray-600">Masukkan nomor meja Anda sebelum memesan.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowTableModal(false)}
                className="rounded-full p-2 text-gray-500 hover:bg-gray-100"
                aria-label="Tutup"
              >
                <span className="block text-lg leading-none">X</span>
              </button>
            </div>

            <input
              type="text"
              value={tableNumber}
              onChange={(e) => setTableNumber(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-black"
              placeholder="Contoh: 28"
            />

            <button
              type="button"
              onClick={() => {
                const trimmed = tableNumber.trim()
                if (!trimmed) return
                sessionStorage.setItem('table-number', trimmed)
                setShowTableModal(false)
              }}
              disabled={!tableNumber.trim()}
              className={`mt-4 w-full rounded-xl px-4 py-3 text-sm font-semibold transition-all ${
                tableNumber.trim()
                  ? 'bg-black text-white hover:bg-gray-900 active:scale-95'
                  : 'cursor-not-allowed bg-gray-200 text-gray-400'
              }`}
            >
              Simpan Nomor Meja
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
