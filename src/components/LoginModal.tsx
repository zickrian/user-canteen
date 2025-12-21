'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface LoginModalProps {
  isOpen: boolean
  onClose: () => void
  onLoginSuccess?: () => void
  message?: string
}

export default function LoginModal({ 
  isOpen, 
  onClose,
  onLoginSuccess,
  message
}: LoginModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Check if user just logged in and has checkout intent
  useEffect(() => {
    const checkLoginIntent = async () => {
      const loginIntent = sessionStorage.getItem('login-intent')
      if (loginIntent === 'checkout') {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          sessionStorage.removeItem('login-intent')
          onLoginSuccess?.()
        }
      }
    }

    if (isOpen) {
      checkLoginIntent()
    }
  }, [isOpen, onLoginSuccess])

  const handleGoogleLogin = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Get current origin and pathname - ensure we're using the correct origin
      const currentOrigin = window.location.origin
      const currentPathname = window.location.pathname
      
      // Validate origin - must be user app, not admin
      const isUserApp = currentOrigin.includes('localhost') || 
                       currentOrigin.includes('qmeal') ||
                       currentOrigin.includes('127.0.0.1')
      
      if (!isUserApp) {
        setError('Login hanya tersedia di aplikasi user, bukan admin')
        setIsLoading(false)
        return
      }
      
      // Save intent to proceed to checkout after login
      if (onLoginSuccess) {
        sessionStorage.setItem('login-intent', 'checkout')
        // Also save the origin to ensure we redirect back to the same domain
        sessionStorage.setItem('login-origin', currentOrigin)
      }

      // Build redirect URL with current origin - explicitly use localhost for development
      let redirectOrigin = currentOrigin
      if (currentOrigin.includes('localhost') || currentOrigin.includes('127.0.0.1')) {
        redirectOrigin = 'http://localhost:3000'
      }
      
      const redirectTo = `${redirectOrigin}/auth/callback?next=${encodeURIComponent(currentPathname)}`
      
      console.log('OAuth redirect to:', redirectTo) // Debug log
      console.log('Current origin:', currentOrigin) // Debug log

      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectTo,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      })

      if (signInError) {
        setError(signInError.message)
        setIsLoading(false)
        sessionStorage.removeItem('login-intent')
        sessionStorage.removeItem('login-origin')
      }
      // If successful, the redirect will happen automatically
      // onLoginSuccess will be called after redirect back via useEffect
    } catch (err) {
      console.error('Login error:', err)
      setError('Terjadi kesalahan saat login. Silakan coba lagi.')
      setIsLoading(false)
      sessionStorage.removeItem('login-intent')
      sessionStorage.removeItem('login-origin')
    }
  }

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        // Close modal when clicking backdrop
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div className="bg-white rounded-2xl max-w-sm w-full shadow-xl">
        {/* Header with close button */}
        <div className="flex items-center justify-end p-4 sm:p-5">
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Tutup"
            disabled={isLoading}
          >
            <X className="h-5 w-5 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 sm:px-8 pb-6 sm:pb-8">
          {/* Title */}
          <h2 className="text-2xl sm:text-3xl font-bold text-black mb-2 text-center">
            Login diperlukan
          </h2>

          {/* Subtitle */}
          <p className="text-sm sm:text-base text-gray-600 text-center mb-6 sm:mb-8">
            {message || 'Untuk melanjutkan pemesanan'}
          </p>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Google Login Button */}
          <button
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 sm:py-4 bg-white border-2 border-gray-300 rounded-xl hover:bg-gray-50 hover:border-gray-400 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm sm:text-base font-medium text-gray-700">
                  Memproses...
                </span>
              </>
            ) : (
              <>
                <svg 
                  className="w-5 h-5" 
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span className="text-sm sm:text-base font-medium text-gray-700">
                  Continue with Google
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
