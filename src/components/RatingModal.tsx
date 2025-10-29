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
  const [review, setReview] = useState('')
  const [namaPenilai, setNamaPenilai] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (rating === 0) {
      setError('Silakan pilih rating bintang')
      return
    }
    
    if (!namaPenilai.trim()) {
      setError('Nama penilai wajib diisi')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const { error: submitError } = await supabase.rpc('submit_rating', {
        p_kantin_id: kantin.id,
        p_pesanan_id: pesananId,
        p_rating: rating,
        p_review: review.trim() || null,
        p_nama_penilai: namaPenilai.trim()
      })

      if (submitError) {
        console.error('Error submitting rating:', submitError)
        setError(submitError.message)
        return
      }

      // Success
      onRatingSubmitted?.()
      onClose()
      
      // Reset form
      setRating(0)
      setHoveredRating(0)
      setReview('')
      setNamaPenilai('')
      
    } catch (error) {
      console.error('Error:', error)
      setError('Terjadi kesalahan saat mengirim rating')
    } finally {
      setIsSubmitting(false)
    }
  }

  const renderStars = () => {
    return (
      <div className="flex gap-2 justify-center my-6">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => setRating(star)}
            onMouseEnter={() => setHoveredRating(star)}
            onMouseLeave={() => setHoveredRating(0)}
            className="transition-transform hover:scale-110"
          >
            <Star
              className={`h-8 w-8 ${
                star <= (hoveredRating || rating)
                  ? 'fill-yellow-400 text-yellow-400'
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-black">Beri Rating</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Kantin Info */}
          <div className="text-center">
            <div className="w-16 h-16 bg-black rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-white font-bold text-xl">
                {kantin.nama_kantin.charAt(0).toUpperCase()}
              </span>
            </div>
            <h3 className="font-semibold text-black">{kantin.nama_kantin}</h3>
            <p className="text-sm text-gray-600">Bagaimana pengalaman Anda?</p>
          </div>

          {/* Star Rating */}
          <div>
            <label className="block text-sm font-medium text-black mb-2 text-center">
              Rating Bintang *
            </label>
            {renderStars()}
            {rating > 0 && (
              <p className="text-center text-sm font-medium text-gray-700 mt-2">
                {getRatingText()}
              </p>
            )}
          </div>

          {/* Nama Penilai */}
          <div>
            <label className="block text-sm font-medium text-black mb-2">
              Nama Anda *
            </label>
            <input
              type="text"
              value={namaPenilai}
              onChange={(e) => setNamaPenilai(e.target.value)}
              placeholder="Masukkan nama Anda"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
              required
            />
          </div>

          {/* Review */}
          <div>
            <label className="block text-sm font-medium text-black mb-2">
              Ulasan (Opsional)
            </label>
            <textarea
              value={review}
              onChange={(e) => setReview(e.target.value)}
              placeholder="Bagikan pengalaman Anda..."
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black resize-none"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting || rating === 0}
              className="flex-1 bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Mengirim...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
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