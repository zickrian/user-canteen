'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import KantinList from '@/components/KantinList'
import SearchBar from '@/components/SearchBar'
import MealFilter, { type MealTime } from '@/components/MealFilter'
import AIAssistant from '@/components/AIAssistant'
import MenuGrid from '@/components/MenuGrid'
import { supabase } from '@/lib/supabase'
import type { KantinWithRating, Menu } from '@/lib/supabase'
import { X } from 'lucide-react'

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
  const router = useRouter()
  const [kantins, setKantins] = useState<KantinWithRating[]>([])
  const [filteredKantins, setFilteredKantins] = useState<KantinWithRating[]>([])
  const [menus, setMenus] = useState<Menu[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [mealFilter, setMealFilter] = useState<MealTime>('')
  const [tableNumber, setTableNumber] = useState('')
  const [showTableModal, setShowTableModal] = useState(false)

  // Handle OAuth callback with hash fragment (if Supabase redirects directly to home)
  useEffect(() => {
    const hash = window.location.hash
    if (hash && (hash.includes('access_token') || hash.includes('error'))) {
      // Redirect to callback page to handle properly
      const currentPath = window.location.pathname
      router.replace(`/auth/callback?next=${encodeURIComponent(currentPath)}`)
      return
    }
  }, [router])

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

      // Fetch ratings for all kantins
      const kantinsWithRating = await Promise.all(
        kantinsData.map(async (kantin) => {
          try {
            // Fetch rating using RPC function
            const { data: ratingData, error: ratingError } = await supabase
              .rpc('get_kantin_rating', { p_kantin_id: kantin.id })

            let avg_rating = 0
            let total_ratings = 0

            if (!ratingError && ratingData && ratingData.length > 0) {
              // Ensure proper conversion from NUMERIC to number
              // NUMERIC(3,2) returns as string, convert to number
              const avgRatingValue = ratingData[0].avg_rating
              const totalRatingsValue = ratingData[0].total_ratings
              
              avg_rating = avgRatingValue != null ? Number(avgRatingValue) : 0
              total_ratings = totalRatingsValue != null ? Number(totalRatingsValue) : 0
              
              // Validate: rating should be between 0 and 5
              if (avg_rating < 0 || avg_rating > 5) {
                console.warn(`Invalid avg_rating for kantin ${kantin.id}: ${avg_rating}`)
                avg_rating = 0
              }
            }

            return {
              ...kantin,
              avg_rating,
              total_ratings,
              total_menus: kantin.menu?.length || 0,
              menus: kantin.menu
            }
          } catch (error) {
            console.error(`Error fetching rating for kantin ${kantin.id}:`, error)
            return {
              ...kantin,
              avg_rating: 0,
              total_ratings: 0,
              total_menus: kantin.menu?.length || 0,
              menus: kantin.menu
            }
          }
        })
      )

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
    <div className="min-h-screen bg-zinc-50 py-4 sm:py-8">
      <Suspense fallback={null}>
        <SearchParamsGate onNeedTable={() => setShowTableModal(true)} />
      </Suspense>
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
        {/* Search Bar */}
        <div className="mb-4 sm:mb-6 md:mb-8">
          <SearchBar value={searchQuery} onChange={setSearchQuery} showCart={true} />
        </div>

        {/* Meal Filter */}
        <div className="mb-4 sm:mb-6 md:mb-8">
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
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-zinc-900/60 p-3 sm:p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xl ring-1 ring-zinc-100 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="mb-4 sm:mb-6 flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h3 className="text-lg sm:text-xl font-bold text-zinc-900">Nomor Meja</h3>
                <p className="text-xs sm:text-sm text-zinc-500 mt-1">Di mana kamu duduk hari ini?</p>
              </div>
              <button
                type="button"
                onClick={() => setShowTableModal(false)}
                className="rounded-full p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors shrink-0"
                aria-label="Tutup"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 sm:space-y-4">
              <input
                type="number"
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                className="w-full bg-zinc-50 border-zinc-200 px-3 sm:px-4 py-3 sm:py-4 rounded-xl text-base sm:text-lg font-bold text-center focus:outline-none focus:ring-2 focus:ring-orange-500 placeholder:text-zinc-300 transition-all text-zinc-900"
                placeholder="00"
                autoFocus
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
                className="w-full bg-zinc-900 disabled:bg-zinc-200 disabled:text-zinc-400 text-white font-bold py-3 sm:py-4 rounded-xl hover:bg-zinc-800 transition-all active:scale-95 shadow-lg shadow-zinc-200 text-sm sm:text-base"
              >
                Simpan Nomor Meja
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
