'use client'

import { useState } from 'react'
import { Star, X, Send } from 'lucide-react'
import { Kantin, Rating } from '@/lib/supabase'
import { supabase } from '@/lib/supabase'

interface RatingModalProps {
  isOpen: boolean
  onClose: () => void
  kantin: Kantin
  pesananId: string
  onRatingSubmitted?: () => void
}

export default function RatingModal({ 
  isOpen, 
  onClose, 
  kantin, 
  pesananId, 
  onRatingSubmitted 
}: RatingModalProps) {
  const [rating, setRating] = useState(0)
  const [hoveredRating, setHoveredRating] = useState(0)
  const [komentar, setKomentar] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (rating === 0) {
      setError('Silakan pilih rating bintang')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      // Get session token
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setError('Anda harus login untuk memberikan rating')
        return
      }

      const response = await fetch('/api/rating/kantin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          pesanan_id: pesananId,
          kantin_id: kantin.id,
          rating: rating,
          komentar: komentar.trim() || null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Gagal mengirim rating')
        return
      }

      // Success
      onRatingSubmitted?.()
      onClose()
      
      // Reset form
      setRating(0)
      setHoveredRating(0)
      setKomentar('')
      
    } catch (error) {
      console.error('Error:', error)
      setError('Terjadi kesalahan saat mengirim rating')
    } finally {
      setIsSubmitting(false)
    }
  }

  const renderStars = () => {
    return (
      <div className="flex gap-1.5 sm:gap-2 justify-center my-4 sm:my-6">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => setRating(star)}
            onMouseEnter={() => setHoveredRating(star)}
            onMouseLeave={() => setHoveredRating(0)}
            className="transition-transform hover:scale-110 active:scale-95"
          >
            <Star
              className={`h-7 w-7 sm:h-8 sm:w-8 ${
                star <= (hoveredRating || rating)
                  ? 'fill-orange-400 text-orange-400'
                  : 'text-gray-300'
              }`}
            />
          </button>
        ))}
      </div>
    )
  }

  const getRatingText = () => {
    if (rating === 0) return ''
    if (rating === 1) return 'Sangat Buruk'
    if (rating === 2) return 'Buruk'
    if (rating === 3) return 'Cukup'
    if (rating === 4) return 'Baik'
    if (rating === 5) return 'Sangat Baik'
    return ''
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl sm:rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200">
          <h2 className="text-lg sm:text-xl font-bold text-black">Beri Rating</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors shrink-0"
          >
            <X className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 sm:space-y-6">
          {/* Kantin Info */}
          <div className="text-center">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-black rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-3">
              <span className="text-white font-bold text-lg sm:text-xl">
                {kantin.nama_kantin.charAt(0).toUpperCase()}
              </span>
            </div>
            <h3 className="font-semibold text-sm sm:text-base text-black truncate px-2">{kantin.nama_kantin}</h3>
            <p className="text-xs sm:text-sm text-gray-600 mt-1">Bagaimana pengalaman Anda?</p>
          </div>

          {/* Star Rating */}
          <div>
            <label className="block text-xs sm:text-sm font-medium text-black mb-2 sm:mb-3 text-center">
              Rating Bintang *
            </label>
            {renderStars()}
            {rating > 0 && (
              <p className="text-center text-xs sm:text-sm font-medium text-gray-700 mt-2">
                {getRatingText()}
              </p>
            )}
          </div>

          {/* Komentar */}
          <div>
            <label className="block text-xs sm:text-sm font-medium text-black mb-2">
              Komentar (Opsional)
            </label>
            <textarea
              value={komentar}
              onChange={(e) => setKomentar(e.target.value)}
              placeholder="Bagikan pengalaman Anda..."
              rows={3}
              className="w-full px-3 sm:px-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black resize-none"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 sm:px-4 py-2 sm:py-3 rounded-lg text-xs sm:text-sm">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-3 sm:pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2.5 sm:py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors text-sm sm:text-base font-medium"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting || rating === 0}
              className="flex-1 bg-black text-white px-4 py-2.5 sm:py-2 rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm sm:text-base font-medium transition-colors active:scale-95"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Mengirim...
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  Kirim Rating
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Rating Display Component
export function RatingDisplay({ 
  rating, 
  totalRatings, 
  showCount = true,
  size = 'sm' 
}: { 
  rating: number
  totalRatings?: number
  showCount?: boolean
  size?: 'sm' | 'md' | 'lg'
}) {
  const starSize = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6'
  }[size]

  const renderStars = () => {
    const stars = []
    const fullStars = Math.floor(rating)
    const hasHalfStar = rating % 1 !== 0

    for (let i = 0; i < fullStars; i++) {
      stars.push(<Star key={i} className={`${starSize} fill-yellow-400 text-yellow-400`} />)
    }

    if (hasHalfStar) {
      stars.push(<Star key="half" className={`${starSize} fill-yellow-400/50 text-yellow-400`} />)
    }

    const emptyStars = 5 - Math.ceil(rating)
    for (let i = 0; i < emptyStars; i++) {
      stars.push(<Star key={`empty-${i}`} className={`${starSize} text-gray-300`} />)
    }

    return stars
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center">
        {renderStars()}
      </div>
      {showCount && totalRatings && (
        <span className="text-sm text-gray-600">
          {rating.toFixed(1)} {totalRatings > 0 && `(${totalRatings})`}
        </span>
      )}
    </div>
  )
}