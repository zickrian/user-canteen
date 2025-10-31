'use client'

import { useState, useEffect } from 'react'
import KantinList from '@/components/KantinList'
import SearchBar from '@/components/SearchBar'
import MealFilter, { type MealTime } from '@/components/MealFilter'
import AIAssistant from '@/components/AIAssistant'
import { supabase } from '@/lib/supabase'
import type { KantinWithRating, Menu } from '@/lib/supabase'

export default function Home() {
  const [kantins, setKantins] = useState<KantinWithRating[]>([])
  const [filteredKantins, setFilteredKantins] = useState<KantinWithRating[]>([])
  const [menus, setMenus] = useState<Menu[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [mealFilter, setMealFilter] = useState<MealTime>('')

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    filterKantins()
  }, [kantins, searchQuery, mealFilter])

  const fetchData = async () => {
    try {
      setLoading(true)
      
      // Fetch kantins
      const { data: kantinsData, error: kantinsError } = await supabase
        .from('kantin')
        .select(`
          *,
          menu(id, kategori_menu)
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

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(kantin => 
        kantin.nama_kantin.toLowerCase().includes(searchQuery.toLowerCase())
      )
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Search Bar */}
        <div className="mb-6">
          <SearchBar value={searchQuery} onChange={setSearchQuery} showCart={true} />
        </div>

        {/* Meal Filter */}
        <div className="mb-8">
          <MealFilter selected={mealFilter} onSelect={setMealFilter} />
        </div>
        
        <KantinList kantins={filteredKantins} loading={loading} />
      </div>

      {/* AI Assistant - Fixed Position Bottom Right */}
      <AIAssistant />
    </div>
  )
}
