'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { Star, Clock, ArrowLeft, Store, UtensilsCrossed, XCircle, CheckCircle2, X, Pencil } from 'lucide-react'
import { Kantin, Menu } from '@/lib/supabase'
import { supabase } from '@/lib/supabase'
import AIAssistant from '@/components/AIAssistant'
import MenuCard from '@/components/MenuCard'

export default function KantinDetailPage() {
  const params = useParams()
  const router = useRouter()
  const kantinId = params['kantin-id'] as string
  const [kantin, setKantin] = useState<Kantin | null>(null)
  const [menus, setMenus] = useState<Menu[]>([])
  const [filteredMenus, setFilteredMenus] = useState<Menu[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tableNumber, setTableNumber] = useState<string>('')
  const [showTableModal, setShowTableModal] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string>('semua')

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

        setMenus(menusData || [])
        setFilteredMenus(menusData || [])

        // Optional: rating RPC can be disabled to avoid 404 in environments without the function
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
  }, [menus, selectedCategory])

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
      // keep both keys populated so nomor meja terbagi ke semua kios
      sessionStorage.setItem(globalKey, initialTable)
      sessionStorage.setItem(kantinKey, initialTable)
      setShowTableModal(false)
    } else {
      setShowTableModal(true)
    }
  }, [kantinId])

  const filterMenus = () => {
    let filtered = menus

    filtered = filtered.filter(menu =>
      selectedCategory === 'semua'
        ? true
        : menu.kategori_menu?.some(cat => cat?.toLowerCase() === selectedCategory.toLowerCase())
    )

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
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <XCircle className="h-12 w-12 text-red-500" />
            </div>
            <h1 className="text-2xl font-bold text-black">
              {error || 'Kantin tidak ditemukan'}
            </h1>
            <p className="text-gray-600">
              Kantin yang Anda cari tidak tersedia atau sudah tidak aktif
            </p>
            <button
              onClick={() => router.push('/')}
              className="bg-black text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition-colors"
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
        <div className="relative w-full h-72 bg-gray-100">
        {kantin.foto_profil ? (
          <Image
            src={kantin.foto_profil}
            alt={kantin.nama_kantin}
            fill
              className="object-cover"
              sizes="100vw"
              quality={95}
              priority
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
        <div className="mb-6 space-y-3">
          <h1 className="text-3xl font-bold text-black">{kantin.nama_kantin}</h1>
          
          {/* Rating */}
          {(kantin as any).avg_rating ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center">
                {renderStars((kantin as any).avg_rating)}
              </div>
              <span className="text-sm text-gray-600">
                {(kantin as any).avg_rating.toFixed(1)} ({(kantin as any).total_ratings} rating)
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500">Belum memiliki rating</span>
            </div>
          )}

          {/* Operating Hours */}
          {kantin.jam_buka && kantin.jam_tutup && (
            <div className="flex items-center gap-2 text-gray-700">
              <Clock className="h-5 w-5" />
              <span className="text-lg">
                {kantin.jam_buka} - {kantin.jam_tutup}
              </span>
            </div>
          )}
        </div>

        {/* Table Number Banner */}
        <div className="mb-6 bg-amber-50 border border-amber-100 text-amber-900 rounded-2xl px-4 py-3 font-semibold shadow-sm flex items-center justify-between gap-3">
          <span className="flex-1 text-center">
            {tableNumber ? `Nomor Meja: ${tableNumber}` : 'Masukkan nomor meja untuk mulai pesan'}
          </span>
          <button
            onClick={() => setShowTableModal(true)}
            className="p-2 rounded-full hover:bg-amber-100 text-amber-900 transition"
            aria-label="Edit nomor meja"
          >
            <Pencil className="h-5 w-5" />
          </button>
        </div>

        {/* Category Nav */}
        <CategoryNav
          menus={menus}
          selectedCategory={selectedCategory}
          onSelect={setSelectedCategory}
          onOpenModal={() => setShowTableModal(true)}
        />

        {/* Menu List Section */}
        <div className="mt-6">
          {filteredMenus.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <div className="flex justify-center">
                <UtensilsCrossed className="h-12 w-12 text-gray-400" />
              </div>
              <p className="text-gray-700 text-lg font-medium">
            {selectedCategory !== 'semua'
              ? 'Tidak ada menu di kategori ini'
              : 'Belum ada menu tersedia'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
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

      {/* AI Assistant */}
      <AIAssistant kantinId={kantinId} kantin={kantin} />

      {/* Table Number Bottom Sheet */}
      {showTableModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center px-4">
          <div className="w-full max-w-md bg-white rounded-t-3xl md:rounded-3xl shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-black">Nomor Meja</h3>
              <button
                onClick={() => setShowTableModal(false)}
                className="p-2 rounded-full hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600">
              Masukkan nomor meja Anda untuk mempermudah pesanan.
            </p>
            <input
              type="number"
              min="1"
              value={tableNumber}
              onChange={(e) => setTableNumber(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-black"
              placeholder="Contoh: 28"
            />
            <button
              onClick={() => {
                if (!tableNumber) return
                sessionStorage.setItem('table-number', tableNumber)
                sessionStorage.setItem(`table-number-${kantinId}`, tableNumber)
                setShowTableModal(false)
              }}
              disabled={!tableNumber}
            className={`w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-150 ${
                tableNumber
                  ? 'bg-black text-white hover:bg-gray-900 active:scale-95'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              <CheckCircle2 className="h-5 w-5" />
              Simpan Nomor Meja
            </button>
          </div>
        </div>
      )}
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
  onOpenModal?: () => void
}) {
  const items = ['semua', 'makanan', 'minuman']

  return (
    <div className="overflow-x-auto">
      <div className="inline-flex items-center gap-3 border-b border-gray-200 pb-3 min-w-full">
        {items.map(cat => {
          const isActive = selectedCategory === cat
          const label = cat === 'semua' ? 'Semua' : cat.charAt(0).toUpperCase() + cat.slice(1)
          return (
            <button
              key={cat}
              onClick={() => onSelect(cat)}
              className={`px-3 pb-1 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
                isActive
                  ? 'border-red-600 text-red-600'
                  : 'border-transparent text-gray-600 hover:text-red-600'
              }`}
            >
              {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}