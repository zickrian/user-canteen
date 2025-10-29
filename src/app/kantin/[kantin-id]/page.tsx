'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { Star, Clock, ArrowLeft, Store, Plus } from 'lucide-react'
import { Kantin, Menu } from '@/lib/supabase'
import { supabase } from '@/lib/supabase'
import { useCart } from '@/contexts/CartContext'
import SearchBar from '@/components/SearchBar'
import MealFilter, { type MealTime } from '@/components/MealFilter'

export default function KantinDetailPage() {
  const params = useParams()
  const router = useRouter()
  const kantinId = params['kantin-id'] as string
  const { addItem } = useCart()

  const [kantin, setKantin] = useState<Kantin | null>(null)
  const [menus, setMenus] = useState<Menu[]>([])
  const [filteredMenus, setFilteredMenus] = useState<Menu[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [mealFilter, setMealFilter] = useState<MealTime>('')

  useEffect(() => {
    async function fetchKantinData() {
      try {
        setLoading(true)
        setError(null)

        // Fetch kantin details
        const { data: kantinData, error: kantinError } = await supabase
          .from('kantin')
          .select('*')
          .eq('id', kantinId)
          .eq('status', 'aktif')
          .single()

        if (kantinError) {
          console.error('Error fetching kantin:', kantinError)
          setError('Kantin tidak ditemukan atau tidak aktif')
          return
        }

        setKantin(kantinData)

        // Fetch kantin menus
        const { data: menusData, error: menusError } = await supabase
          .from('menu')
          .select('*')
          .eq('kantin_id', kantinId)
          .eq('tersedia', true)
          .order('created_at', { ascending: false })

        if (menusError) {
          console.error('Error fetching menus:', menusError)
          setError('Gagal memuat menu')
          return
        }

        setMenus(menusData || [])
        setFilteredMenus(menusData || [])

        // Note: Rating function might not exist, handle gracefully
        try {
          const { data: ratingData } = await supabase
            .rpc('get_kantin_rating', { p_kantin_id: kantinId })

          if (ratingData && ratingData.length > 0) {
            setKantin(prev => prev ? {
              ...prev,
              avg_rating: ratingData[0].avg_rating,
              total_ratings: ratingData[0].total_ratings
            } : null)
          }
        } catch (ratingError) {
          console.log('Rating function not available:', ratingError)
        }

      } catch (error) {
        console.error('Error:', error)
        setError('Terjadi kesalahan yang tidak terduga')
      } finally {
        setLoading(false)
      }
    }

    if (kantinId) {
      fetchKantinData()
    }
  }, [kantinId])

  useEffect(() => {
    filterMenus()
  }, [menus, searchQuery, mealFilter])

  const filterMenus = () => {
    let filtered = menus

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(menu => 
        menu.nama_menu.toLowerCase().includes(searchQuery.toLowerCase()) ||
        menu.deskripsi?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // Filter by meal type
    if (mealFilter) {
      filtered = filtered.filter(menu => 
        menu.kategori_menu && menu.kategori_menu.includes(mealFilter)
      )
    }

    setFilteredMenus(filtered)
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price)
  }

  const renderStars = (rating: number) => {
    const stars = []
    const fullStars = Math.floor(rating)
    const hasHalfStar = rating % 1 !== 0

    for (let i = 0; i < fullStars; i++) {
      stars.push(<Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />)
    }

    if (hasHalfStar) {
      stars.push(<Star key="half" className="h-4 w-4 fill-yellow-400/50 text-yellow-400" />)
    }

    const emptyStars = 5 - Math.ceil(rating)
    for (let i = 0; i < emptyStars; i++) {
      stars.push(<Star key={`empty-${i}`} className="h-4 w-4 text-gray-300" />)
    }

    return stars
  }

  const handleAddToCart = (menu: Menu) => {
    if (!kantin) return
    addItem(menu, kantin)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <div className="animate-pulse">
          {/* Header Full Width */}
          <div className="w-full h-80 bg-gray-200" />
          
          {/* Info Section */}
          <div className="max-w-4xl mx-auto px-4 py-8">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-4" />
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-4" />
            <div className="h-4 bg-gray-200 rounded w-1/4 mb-8" />
            
            {/* Search and Filter */}
            <div className="h-12 bg-gray-200 rounded mb-4" />
            <div className="flex gap-4 mb-8">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-16 w-20 bg-gray-200 rounded" />
              ))}
            </div>
            
            {/* Menu Cards */}
            <div className="space-y-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex gap-4 p-4 border border-gray-200 rounded-lg">
                  <div className="w-24 h-24 bg-gray-200 rounded" />
                  <div className="flex-1 space-y-2">
                    <div className="h-6 bg-gray-200 rounded w-3/4" />
                    <div className="h-4 bg-gray-200 rounded w-full" />
                    <div className="h-4 bg-gray-200 rounded w-1/2" />
                  </div>
                  <div className="w-10 h-10 bg-gray-200 rounded" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !kantin) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-4xl mx-auto px-4 py-16">
          <div className="text-center">
            <div className="text-6xl mb-4">😞</div>
            <h1 className="text-2xl font-bold text-black mb-4">
              {error || 'Kantin tidak ditemukan'}
            </h1>
            <p className="text-gray-600 mb-8">
              Kantin yang Anda cari tidak tersedia atau sudah tidak aktif
            </p>
            <button
              onClick={() => router.push('/')}
              className="bg-black text-white px-6 py-3 rounded-lg hover:bg-gray-800"
            >
              Kembali ke Beranda
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header Section - Full Width */}
      <div className="relative w-full h-80 bg-gray-100">
        {kantin.foto_profil ? (
          <Image
            src={kantin.foto_profil}
            alt={kantin.nama_kantin}
            fill
            className="object-cover"
            sizes="100vw"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <Store className="h-32 w-32 text-gray-300" />
          </div>
        )}
        
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="absolute top-4 left-4 p-2 bg-white/90 backdrop-blur-sm rounded-lg hover:bg-white"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        
        {/* Status Badge */}
        <div className="absolute top-4 right-4">
          <span className={`px-4 py-2 rounded-full font-bold ${
            kantin.buka_tutup 
              ? 'bg-green-500 text-white' 
              : 'bg-red-500 text-white'
          }`}>
            {kantin.buka_tutup ? 'BUKA' : 'TUTUP'}
          </span>
        </div>
      </div>

      {/* Info Kantin Section */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-black mb-4">{kantin.nama_kantin}</h1>
          
          {/* Rating */}
          {(kantin as any).avg_rating ? (
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center">
                {renderStars((kantin as any).avg_rating)}
              </div>
              <span className="text-sm text-gray-600">
                {(kantin as any).avg_rating.toFixed(1)} ({(kantin as any).total_ratings} rating)
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-3 mb-4">
              <span className="text-sm text-gray-500">Belum memiliki rating</span>
            </div>
          )}

          {/* Operating Hours */}
          {kantin.jam_buka && kantin.jam_tutup && (
            <div className="flex items-center gap-2 text-gray-600">
              <Clock className="h-5 w-5" />
              <span className="text-lg">
                {kantin.jam_buka} - {kantin.jam_tutup}
              </span>
            </div>
          )}
        </div>

        {/* Filter & Search Section */}
        <div className="mb-8 space-y-4">
          {/* Search Bar with Cart */}
          <SearchBar value={searchQuery} onChange={setSearchQuery} showCart={true} />
          
          {/* Meal Filter */}
          <MealFilter selected={mealFilter} onSelect={setMealFilter} />
        </div>

        {/* Menu List Section */}
        <div>
          <h2 className="text-2xl font-bold text-black mb-6">Menu</h2>
          
          {filteredMenus.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">🍽️</div>
              <p className="text-gray-600 text-lg">
                {searchQuery || mealFilter 
                  ? 'Tidak ada menu yang cocok dengan filter'
                  : 'Belum ada menu tersedia'
                }
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredMenus.map((menu) => (
                <div key={menu.id} className="flex gap-4 p-4 border-2 border-gray-200 rounded-xl hover:border-black transition-colors">
                  {/* Menu Image */}
                  <div className="relative w-24 h-24 flex-shrink-0">
                    {menu.foto_menu ? (
                      <Image
                        src={menu.foto_menu}
                        alt={menu.nama_menu}
                        fill
                        className="object-cover rounded-lg"
                        sizes="96px"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-200 rounded-lg flex items-center justify-center">
                        <span className="text-gray-400 text-2xl">🍽️</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Menu Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-black mb-1">{menu.nama_menu}</h3>
                    <p className="text-gray-600 text-sm mb-2 line-clamp-2">
                      {menu.deskripsi || 'Tidak ada deskripsi'}
                    </p>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-lg font-bold text-black">{formatPrice(menu.harga)}</p>
                        <p className="text-xs text-gray-500">
                          Dibeli: {menu.total_sold || 0} kali
                        </p>
                      </div>
                      <button
                        onClick={() => handleAddToCart(menu)}
                        className="p-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
                        disabled={!kantin.buka_tutup}
                      >
                        <Plus className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}