'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthCallbackPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') || '/'

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Check if there's a hash fragment with tokens (Supabase OAuth redirect)
        const hash = window.location.hash
        if (hash) {
          // Supabase client will automatically parse hash fragment tokens
          // Wait a bit for Supabase to process the hash
          await new Promise(resolve => setTimeout(resolve, 100))
        }

        // Get the current session after OAuth redirect
        // Supabase automatically handles hash fragment tokens
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()

        if (sessionError) {
          console.error('[Auth Callback] Session error:', sessionError)
          router.push(`/?error=${encodeURIComponent(sessionError.message)}`)
          return
        }

        if (session?.user) {
          // Create/update user profile via API
          try {
            await fetch('/api/user/profile', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: session.user.id,
                email: session.user.email || '',
                full_name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || '',
                avatar_url: session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture || '',
              })
            })
          } catch (profileError) {
            console.error('[Auth Callback] Profile error:', profileError)
            // Don't fail the login, just log the error
          }

          // Clear hash fragment from URL
          window.history.replaceState(null, '', window.location.pathname + window.location.search)

          // Redirect to next path or home
          const path = next.startsWith('/') ? next : `/${next}`
          router.push(`${path}?logged_in=true`)
        } else {
          // No session, check if there's an error in hash
          if (hash && hash.includes('error')) {
            const errorMatch = hash.match(/error=([^&]+)/)
            const error = errorMatch ? decodeURIComponent(errorMatch[1]) : 'unknown_error'
            router.push(`/?error=${encodeURIComponent(error)}`)
          } else {
            router.push('/?error=no_session')
          }
        }
      } catch (error) {
        console.error('[Auth Callback] Error:', error)
        router.push(`/?error=${encodeURIComponent(error instanceof Error ? error.message : 'unknown_error')}`)
      }
    }

    handleAuthCallback()
  }, [router, next])

  // Show loading state while processing
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-gray-300 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-600">Memproses login...</p>
      </div>
    </div>
  )
}

