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

  // Reset loading state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setIsLoading(false)
      setError(null)
    }
  }, [isOpen])

  // Check if user just logged in and has checkout intent
  useEffect(() => {
    const checkLoginIntent = async () => {
      const loginIntent = sessionStorage.getItem('login-intent')
      if (loginIntent === 'checkout') {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          sessionStorage.removeItem('login-intent')
          sessionStorage.removeItem('login-origin')
          onLoginSuccess?.()
        }
      }
    }

    if (isOpen) {
      checkLoginIntent()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  const handleGoogleLogin = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Get current origin and pathname
      const currentOrigin = window.location.origin
      const currentPathname = window.location.pathname

      // Production URL
      const productionUrl = 'https://qmeal-one.vercel.app'

      // STRICT allowlist - exact match only
      const ALLOWED_ORIGINS = [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        productionUrl,
      ]

      // Also allow Vercel preview deployments
      const isVercelPreview = currentOrigin.includes('.vercel.app')
      const isAllowed = ALLOWED_ORIGINS.includes(currentOrigin) || isVercelPreview

      if (!isAllowed) {
        setError('Login hanya tersedia di aplikasi user, bukan admin')
        setIsLoading(false)
        return
      }

      // Save intent to proceed to checkout after login
      if (onLoginSuccess) {
        sessionStorage.setItem('login-intent', 'checkout')
        sessionStorage.setItem('login-origin', currentOrigin)
      }

      // Build redirectTo with next parameter
      // Use current origin for redirect
      const base = currentOrigin

      const redirectTo = `${base}/auth/callback?next=${encodeURIComponent(currentPathname || '/')}`

      console.log('[LoginModal] OAuth redirect to:', redirectTo)
      console.log('[LoginModal] Current origin:', currentOrigin)
      console.log('[LoginModal] Current pathname:', currentPathname)

      // Set a timeout to reset loading state if redirect doesn't happen
      const loadingTimeout = setTimeout(() => {
        setIsLoading(false)
        setError('Redirect timeout. Silakan coba lagi.')
        sessionStorage.removeItem('login-intent')
        sessionStorage.removeItem('login-origin')
      }, 10000) // 10 seconds timeout

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

      // Clear timeout if we get a response
      clearTimeout(loadingTimeout)

      if (signInError) {
        setError(signInError.message)
        setIsLoading(false)
        sessionStorage.removeItem('login-intent')
        sessionStorage.removeItem('login-origin')
      } else {
        // If successful, the redirect will happen automatically
        // Keep loading state true until redirect happens
        // onLoginSuccess will be called after redirect back via useEffect
      }
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
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        // Close modal when clicking backdrop
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div className="bg-white rounded-3xl max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Header with close button */}
        <div className="flex items-center justify-end p-4 sm:p-5">
          <button
            onClick={() => {
              setIsLoading(false)
              setError(null)
              sessionStorage.removeItem('login-intent')
              sessionStorage.removeItem('login-origin')
              onClose()
            }}
            className="p-2 hover:bg-zinc-100 rounded-full transition-colors disabled:opacity-50"
            aria-label="Tutup"
          >
            <X className="h-5 w-5 text-zinc-500" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 sm:px-8 pb-8 sm:pb-10">
          {/* Title */}
          <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 mb-2 text-center tracking-tight">
            Login
          </h2>

          {/* Subtitle */}
          <p className="text-sm text-zinc-500 text-center mb-8">
            {message || 'Untuk melanjutkan pemesanan'}
          </p>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm font-medium">
              {error}
            </div>
          )}

          {/* Google Login Button */}
          <button
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full relative flex items-center justify-center gap-3 px-4 py-3.5 bg-white border border-zinc-200 rounded-2xl hover:bg-zinc-50 hover:border-zinc-300 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 shadow-sm"
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin" />
                <span className="text-sm font-medium text-zinc-600">
                  Memproses...
                </span>
              </>
            ) : (
              <>
                <svg
                  className="w-5 h-5 shrink-0"
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
                <span className="text-sm font-semibold text-zinc-700">
                  Lanjutkan dengan Google
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
