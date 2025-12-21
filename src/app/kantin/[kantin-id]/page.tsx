'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { Star, Clock, ArrowLeft, Store, UtensilsCrossed, XCircle, CheckCircle2, X, Pencil, ShoppingCart, Search } from 'lucide-react'
import { Kantin, Menu } from '@/lib/supabase'
import { supabase } from '@/lib/supabase'
import AIAssistant from '@/components/AIAssistant'
import MenuCard from '@/components/MenuCard'
import LoginModal from '@/components/LoginModal'
import { useCart } from '@/contexts/CartContext'
import { useAuth } from '@/hooks/useAuth'

export default function KantinDetailPage() {
  const params = useParams()
  const router = useRouter()
  const kantinId = params['kantin-id'] as string
  const { getItemCount } = useCart()
  const { isAuthenticated } = useAuth()
  const itemCount = getItemCount()
  const [kantin, setKantin] = useState<Kantin | null>(null)
  const [menus, setMenus] = useState<Menu[]>([])
  const [filteredMenus, setFilteredMenus] = useState<Menu[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tableNumber, setTableNumber] = useState<string>('')
  const [showTableModal, setShowTableModal] = useState(false)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string>('semua')
  const [searchQuery, setSearchQuery] = useState('')

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
          .order('created_at', { ascending: false })

        if (menusError) {
          console.error('Error fetching menus:', menusError)
          setError('Gagal memuat menu')
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
              setFilteredMenus(updatedMenus)
            } else {
              // Jika API error, gunakan data dari database
              setMenus(menusData || [])
              setFilteredMenus(menusData || [])
            }
          } catch (salesError) {
            console.error('Error fetching sales count:', salesError)
            // Jika error, gunakan data dari database
            setMenus(menusData || [])
            setFilteredMenus(menusData || [])
          }
        } else {
          setMenus(menusData || [])
          setFilteredMenus(menusData || [])
        }

        if (process.env.NEXT_PUBLIC_ENABLE_RATING === 'true') {
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
  }, [menus, selectedCategory, searchQuery])

  useEffect(() => {
    if (!kantinId) return

    const globalKey = 'table-number'
    const kantinKey = `table-number-${kantinId}`

    const savedGlobal = typeof window !== 'undefined'
      ? sessionStorage.getItem(globalKey)
      : null
    const savedKantin = typeof window !== 'undefined'
      ? sessionStorage.getItem(kantinKey)
      : null

    const initialTable = savedGlobal || savedKantin

    if (initialTable) {
      setTableNumber(initialTable)
      sessionStorage.setItem(globalKey, initialTable)
      sessionStorage.setItem(kantinKey, initialTable)
    }
  }, [kantinId])

  const filterMenus = () => {
    let filtered = menus

    // Filter by Category
    if (selectedCategory !== 'semua') {
      filtered = filtered.filter(menu =>
        menu.kategori_menu?.some(cat => cat?.toLowerCase() === selectedCategory.toLowerCase())
      )
    }

    // Filter by Search Query
    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase()
      filtered = filtered.filter(menu =>
        menu.nama_menu.toLowerCase().includes(lowerQuery) ||
        menu.deskripsi?.toLowerCase().includes(lowerQuery)
      )
    }

    setFilteredMenus(filtered)
  }

  const handleCheckoutClick = () => {
    if (!isAuthenticated) {
      setShowLoginModal(true)
      return
    }

    const savedGlobal = typeof window !== 'undefined'
      ? sessionStorage.getItem('table-number')
      : null
    const activeTableNumber = tableNumber || savedGlobal

    if (!activeTableNumber) {
      setShowTableModal(true)
      return
    }

    router.push('/checkout')
  }

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-0.5">
        <Star className="h-4 w-4 fill-orange-400 text-orange-400" />
        <span className="font-semibold text-sm ml-1 text-zinc-900">{rating.toFixed(1)}</span>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50">
        <div className="animate-pulse">
          <div className="w-full h-64 bg-zinc-200" />
          <div className="max-w-3xl mx-auto -mt-12 px-4 relative z-10">
            <div className="bg-white rounded-3xl p-6 h-40 shadow-sm" />
            <div className="h-12 w-full bg-zinc-200 rounded-xl mt-6" />
            <div className="grid gap-4 mt-6">
              {[1, 2, 3].map(i => <div key={i} className="h-28 bg-white rounded-2xl" />)}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !kantin) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-md">
          <div className="flex justify-center">
            <div className="bg-red-50 p-4 rounded-full">
              <Store className="h-10 w-10 text-red-500" />
            </div>
          </div>
          <h1 className="text-xl font-bold text-zinc-900">
            {error || 'Kantin tidak ditemukan'}
          </h1>
          <p className="text-zinc-500 text-sm">
            Maaf, kantin yang Anda cari sedang tidak tersedia saat ini.
          </p>
          <button
            onClick={() => router.push('/')}
            className="w-full bg-zinc-900 text-white px-6 py-3 rounded-xl hover:bg-zinc-800 transition-colors font-medium"
          >
            Kembali ke Beranda
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-50 pb-20 sm:pb-24">
      {/* Hero Section */}
      <div className="relative w-full h-64 sm:h-72 md:h-80 bg-zinc-900">
        {kantin.foto_profil ? (
          <Image
            src={kantin.foto_profil}
            alt={kantin.nama_kantin}
            fill
            className="object-cover opacity-90"
            sizes="100vw"
            quality={95}
            priority
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-800">
            <Store className="h-24 w-24 text-zinc-700" />
          </div>
        )}

        {/* Gradient Overlay for Text Readability - SUBTLE only at top */}
        <div className="absolute inset-0 bg-black/20" />

        {/* Navigation Bar */}
        <div className="absolute top-0 left-0 right-0 p-3 sm:p-4 flex justify-between items-center z-20">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 sm:w-10 sm:h-10 bg-white/90 backdrop-blur-md rounded-full flex items-center justify-center hover:bg-white shadow-sm transition-all"
          >
            <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5 text-zinc-900" />
          </button>

          <span className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-bold tracking-wide shadow-sm backdrop-blur-md ${kantin.buka_tutup
              ? 'bg-emerald-500/90 text-white'
              : 'bg-red-500/90 text-white'
            }`}>
            {kantin.buka_tutup ? 'OPEN' : 'CLOSED'}
          </span>
        </div>
      </div>

      {/* Content Container with Overlap */}
      <div className="max-w-3xl mx-auto px-3 sm:px-4 -mt-12 sm:-mt-16 md:-mt-20 relative z-10">

        {/* Info Card */}
        <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 md:p-6 shadow-xl shadow-zinc-200/50 ring-1 ring-zinc-100">
          <div className="flex justify-between items-start gap-3 sm:gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-zinc-900 tracking-tight truncate">
                {kantin.nama_kantin}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm text-zinc-500">
                {kantin.jam_buka && kantin.jam_tutup && (
                  <div className="flex items-center gap-1.5 bg-zinc-50 px-2 py-1 rounded-lg">
                    <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                    <span className="text-[10px] sm:text-xs">{kantin.jam_buka} - {kantin.jam_tutup}</span>
                  </div>
                )}
                {(kantin as any).avg_rating > 0 && (
                  <div className="flex items-center bg-orange-50 px-2 py-1 rounded-lg">
                    {renderStars((kantin as any).avg_rating)}
                    <span className="text-zinc-400 ml-1 text-[10px] sm:text-xs">({(kantin as any).total_ratings})</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Table & Cart Action Bar */}
          <div className="mt-4 sm:mt-6 flex items-center gap-2 sm:gap-3 border-t border-zinc-100 pt-4 sm:pt-5">
            <button
              onClick={() => setShowTableModal(true)}
              className="flex-1 flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 bg-zinc-50 hover:bg-zinc-100 rounded-xl transition-colors text-left group min-w-0"
            >
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white border border-zinc-200 flex items-center justify-center shrink-0 group-hover:border-orange-200 group-hover:bg-orange-50 transition-colors">
                <span className="font-bold text-base sm:text-lg text-zinc-900 group-hover:text-orange-600">
                  {tableNumber || '?'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] sm:text-xs text-zinc-500 font-medium uppercase tracking-wider">No. Meja</p>
                <p className="text-xs sm:text-sm font-semibold text-zinc-900 truncate">
                  {tableNumber ? 'Edit Meja' : 'Pilih Meja'}
                </p>
              </div>
              <Pencil className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-zinc-400 shrink-0" />
            </button>

            <button
              onClick={handleCheckoutClick}
              className="relative px-4 sm:px-5 py-2.5 sm:py-3 h-[60px] sm:h-[68px] bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 transition-all active:scale-95 flex flex-col items-center justify-center min-w-[70px] sm:min-w-[80px] shrink-0"
            >
              <ShoppingCart className="h-5 w-5 sm:h-6 sm:w-6" />
              {itemCount > 0 && (
                <span className="absolute top-1.5 sm:top-2 right-2 sm:right-3 h-2.5 w-2.5 sm:h-3 sm:w-3 bg-orange-500 rounded-full border-2 border-zinc-900" />
              )}
              <span className="text-[9px] sm:text-[10px] font-medium mt-0.5 sm:mt-1">Order</span>
            </button>
          </div>
        </div>

        {/* Search & Categories */}
        <div className="mt-6 sm:mt-8 space-y-3 sm:space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-zinc-400" />
            <input
              type="text"
              placeholder="Cari menu favoritmu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border-none py-3 sm:py-3.5 pl-10 sm:pl-12 pr-3 sm:pr-4 rounded-xl shadow-sm ring-1 ring-zinc-200 focus:ring-2 focus:ring-orange-500 focus:outline-none transition-all placeholder:text-zinc-400 text-zinc-900 text-sm sm:text-base"
            />
          </div>

          {/* Category Pills */}
          <CategoryNav
            menus={menus}
            selectedCategory={selectedCategory}
            onSelect={setSelectedCategory}
          />
        </div>

        {/* Menu Grid */}
        <div className="mt-4 sm:mt-6 space-y-3 sm:space-y-4 pb-8 sm:pb-12">
          <h2 className="text-base sm:text-lg font-bold text-zinc-900 px-1">
            {selectedCategory === 'semua' ? 'Semua Menu' : selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1)}
          </h2>

          {filteredMenus.length === 0 ? (
            <div className="text-center py-12 sm:py-20 bg-white rounded-xl sm:rounded-2xl border border-dashed border-zinc-200">
              <div className="flex justify-center mb-3">
                <UtensilsCrossed className="h-8 w-8 sm:h-10 sm:w-10 text-zinc-300" />
              </div>
              <p className="text-sm sm:text-base text-zinc-500 font-medium">
                {searchQuery ? 'Menu tidak ditemukan' : 'Belum ada menu di kategori ini'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:gap-4">
              {filteredMenus.map((menu) => (
                <MenuCard
                  key={menu.id}
                  menu={menu}
                  kantin={kantin}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* AI Assistant Floating Button */}
      <AIAssistant kantinId={kantinId} kantin={kantin} />

      {/* Modals */}
      {showTableModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4 sm:mb-6 gap-2">
              <h3 className="text-lg sm:text-xl font-bold text-zinc-900">Nomor Meja</h3>
              <button onClick={() => setShowTableModal(false)} className="p-2 hover:bg-zinc-100 rounded-full transition-colors shrink-0">
                <X className="h-4 w-4 sm:h-5 sm:w-5 text-zinc-500" />
              </button>
            </div>

            <div className="space-y-3 sm:space-y-4">
              <div className="relative">
                <div className="absolute inset-y-0 left-3 sm:left-4 flex items-center pointer-events-none">
                  <span className="text-zinc-400 font-bold">#</span>
                </div>
                <input
                  type="number"
                  min="1"
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                  className="w-full pl-8 sm:pl-10 pr-3 sm:pr-4 py-3 sm:py-4 bg-zinc-50 border-2 border-transparent focus:border-orange-500 focus:bg-white rounded-xl sm:rounded-2xl text-xl sm:text-2xl font-bold text-center outline-none transition-all placeholder:text-zinc-300"
                  placeholder="00"
                  autoFocus
                />
              </div>
              <p className="text-center text-xs sm:text-sm text-zinc-500">
                Masukkan nomor meja yang tertera di meja Anda
              </p>
            </div>

            <button
              onClick={() => {
                if (!tableNumber) return
                sessionStorage.setItem('table-number', tableNumber)
                sessionStorage.setItem(`table-number-${kantinId}`, tableNumber)
                setShowTableModal(false)
              }}
              disabled={!tableNumber}
              className="w-full mt-6 sm:mt-8 bg-orange-600 hover:bg-orange-700 disabled:bg-zinc-200 disabled:text-zinc-400 text-white font-bold py-3 sm:py-4 rounded-xl transition-all active:scale-95 shadow-lg shadow-orange-200 text-sm sm:text-base"
            >
              Simpan Nomor Meja
            </button>
          </div>
        </div>
      )}

      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onLoginSuccess={() => {
          setShowLoginModal(false)
          setTimeout(() => handleCheckoutClick(), 500)
        }}
        message="Silakan login untuk memesan"
      />
    </div>
  )
}

function CategoryNav({
  menus,
  selectedCategory,
  onSelect,
}: {
  menus: Menu[]
  selectedCategory: string
  onSelect: (cat: string) => void
}) {
  const categories = ['semua', 'makanan', 'minuman']

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-3 sm:-mx-4 px-3 sm:px-4 md:mx-0 md:px-0">
      {categories.map(cat => {
        const isActive = selectedCategory === cat
        const label = cat === 'semua' ? 'Semua' : cat.charAt(0).toUpperCase() + cat.slice(1)
        return (
          <button
            key={cat}
            onClick={() => onSelect(cat)}
            className={`px-4 sm:px-5 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap transition-all duration-200 border shrink-0 ${isActive
              ? 'bg-zinc-900 border-zinc-900 text-white shadow-md'
              : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50'
              }`}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}