'use client'

import { useState, useEffect } from 'react'
import SearchBar from '@/components/SearchBar'
import MealFilter, { type MealTime } from '@/components/MealFilter'
import KantinList from '@/components/KantinList'
import { supabase, type Kantin } from '@/lib/supabase'

export default function Home() {
  const [searchQuery, setSearchQuery] = useState('')
  const [mealFilter, setMealFilter] = useState<MealTime>('none')
  const [kantins, setKantins] = useState<Kantin[]>([])
  const [filteredKantins, setFilteredKantins] = useState<Kantin[]>([])
  const [loading, setLoading] = useState(true)

  // Fetch kantins from Supabase
  useEffect(() => {
    async function fetchKantins() {
      try {
        const { data, error } = await supabase
          .from('kantins')
          .select('*')
          .order('nama', { ascending: true })

        if (error) {
          console.error('Error fetching kantins:', error)
          return
        }

        setKantins(data || [])
      } catch (error) {
        console.error('Error:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchKantins()
  }, [])

  // Filter kantins based on search and meal time
  useEffect(() => {
    let filtered = kantins

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter((kantin) =>
        kantin.nama.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // Filter by meal time
    if (mealFilter !== 'none') {
      filtered = filtered.filter((kantin) => kantin[mealFilter] === true)
    }

    setFilteredKantins(filtered)
  }, [searchQuery, mealFilter, kantins])

  // Handle filter click - toggle between active and none
  const handleFilterClick = (filter: MealTime) => {
    if (mealFilter === filter) {
      // If clicking the same filter, deactivate it (back to none)
      setMealFilter('none')
    } else {
      // If clicking different filter, activate it
      setMealFilter(filter)
    }
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search Bar */}
        <div className="mb-6">
          <SearchBar value={searchQuery} onChange={setSearchQuery} />
        </div>

        {/* Meal Filter */}
        <div className="mb-8">
          <MealFilter selected={mealFilter} onSelect={handleFilterClick} />
        </div>

        {/* Kantin List */}
        <KantinList kantins={filteredKantins} loading={loading} />
      </main>
    </div>
  )
}
