'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Star, MessageSquare, User } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Kantin } from '@/lib/supabase'

interface Review {
  id: string
  rating: number
  komentar: string | null
  nama_pengirim: string
  created_at: string
  updated_at: string
}

export default function ReviewsPage() {
  const params = useParams()
  const router = useRouter()
  const kantinId = params['kantin-id'] as string

  const [kantin, setKantin] = useState<Kantin | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (kantinId) {
      fetchKantinData()
      fetchReviews()
    }
  }, [kantinId])

  const fetchKantinData = async () => {
    try {
      const { data, error } = await supabase
        .from('kantin')
        .select('*')
        .eq('id', kantinId)
        .single()

      if (error) throw error
      setKantin(data)
    } catch (err) {
      console.error('Error fetching kantin:', err)
    }
  }

  const fetchReviews = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/rating/kantin/reviews?kantin_id=${kantinId}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Gagal memuat reviews')
      }

      setReviews(data.reviews || [])
    } catch (err) {
      console.error('Error fetching reviews:', err)
      setError(err instanceof Error ? err.message : 'Gagal memuat reviews')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${
              star <= rating
                ? 'fill-orange-400 text-orange-400'
                : 'text-gray-300'
            }`}
          />
        ))}
        <span className="ml-1.5 text-sm font-bold text-zinc-700">{rating}/5</span>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-zinc-200 border-t-zinc-900 rounded-full animate-spin"></div>
          <p className="text-zinc-500 font-medium">Memuat reviews...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-zinc-200 sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              onClick={() => router.back()}
              className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-full hover:bg-zinc-100 transition-colors text-zinc-600 shrink-0"
            >
              <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg sm:text-xl font-bold text-zinc-900 truncate">
                {kantin?.nama_kantin || 'Reviews'}
              </h1>
              <p className="text-xs sm:text-sm text-zinc-500 font-medium">
                {reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        {/* Reviews List */}
        {reviews.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 sm:py-20 text-center">
            <div className="w-20 h-20 sm:w-24 sm:h-24 bg-zinc-100 rounded-full flex items-center justify-center mb-4 sm:mb-6">
              <MessageSquare className="h-10 w-10 sm:h-12 sm:w-12 text-zinc-300" />
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-zinc-900 mb-2">
              Belum ada review
            </h3>
            <p className="text-sm sm:text-base text-zinc-500 max-w-xs mx-auto">
              Jadilah yang pertama memberikan review untuk kantin ini!
            </p>
          </div>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {reviews.map((review) => (
              <div
                key={review.id}
                className="bg-white rounded-xl sm:rounded-2xl border border-zinc-100 shadow-sm p-4 sm:p-5 hover:shadow-md transition-shadow"
              >
                {/* Review Header */}
                <div className="flex items-start justify-between gap-3 sm:gap-4 mb-3 sm:mb-4">
                  <div className="flex items-start gap-3 sm:gap-4 flex-1 min-w-0">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-orange-100 rounded-full flex items-center justify-center shrink-0">
                      <User className="h-5 w-5 sm:h-6 sm:w-6 text-orange-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-sm sm:text-base text-zinc-900 truncate">
                        {review.nama_pengirim}
                      </h3>
                      <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">
                        {formatDate(review.created_at)}
                      </p>
                    </div>
                  </div>
                  {renderStars(review.rating)}
                </div>

                {/* Review Content */}
                {review.komentar && (
                  <div className="pt-3 sm:pt-4 border-t border-zinc-100">
                    <p className="text-sm sm:text-base text-zinc-700 leading-relaxed whitespace-pre-wrap break-words">
                      {review.komentar}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

