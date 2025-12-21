import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') || '/'

  // Validate origin - only allow user app origins (localhost or qmeal)
  const allowedUserAppOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://qmeal.up.railway.app',
    'https://qmeal.vercel.app'
  ]
  
  // SIMPLIFIED: Determine safe origin based on request URL hostname
  // If callback is called from qmeal domain, use qmeal
  // If callback is called from localhost, use localhost
  // NEVER use admin URL
  let safeOrigin: string
  
  // Check request URL hostname - this is the most reliable indicator
  if (requestUrl.hostname === 'qmeal.up.railway.app' || requestUrl.hostname === 'qmeal.vercel.app') {
    // Production: always use production URL
    safeOrigin = 'https://qmeal.up.railway.app'
  } else if (requestUrl.hostname === 'localhost' || requestUrl.hostname === '127.0.0.1') {
    // Development: use localhost
    safeOrigin = 'http://localhost:3000'
  } else {
    // Fallback: use request URL origin if it's in allowed list
    if (allowedUserAppOrigins.includes(requestUrl.origin)) {
      safeOrigin = requestUrl.origin
    } else {
      // Default to production (never admin!)
      safeOrigin = 'https://qmeal.up.railway.app'
    }
  }
  
  // CRITICAL: Final validation - NEVER redirect to admin URL
  if (!allowedUserAppOrigins.includes(safeOrigin)) {
    safeOrigin = 'https://qmeal.up.railway.app' // Always default to production, never admin
  }
  
  // Debug logging
  console.log('[Auth Callback] Request URL:', requestUrl.toString())
  console.log('[Auth Callback] Request hostname:', requestUrl.hostname)
  console.log('[Auth Callback] Request origin:', requestUrl.origin)
  console.log('[Auth Callback] Safe origin:', safeOrigin)
  console.log('[Auth Callback] Next param:', next)

  if (code) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.redirect(new URL('/?error=auth_config_error', safeOrigin))
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })

    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      console.error('Auth callback error:', error)
      return NextResponse.redirect(new URL(`/?error=${encodeURIComponent(error.message)}`, safeOrigin))
    }

    // After successful login, ensure user profile exists
    // The trigger should handle this automatically, but we ensure it here as well
    if (data.user) {
      const { error: profileError } = await supabaseAdmin
        .from('user_profiles')
        .upsert({
          id: data.user.id,
          email: data.user.email || '',
          full_name: data.user.user_metadata?.full_name || data.user.user_metadata?.name || '',
          avatar_url: data.user.user_metadata?.avatar_url || data.user.user_metadata?.picture || '',
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'id'
        })

      if (profileError) {
        console.error('Error creating/updating user profile:', profileError)
        // Don't fail the login, just log the error
      }
    }
  }

  // Build redirect URL using safe origin (guaranteed to be localhost or qmeal)
  let redirectUrl: URL
  
  try {
    // Try to parse next as URL
    const nextUrl = new URL(next)
    // Only use it if it's from allowed user app origins
    if (allowedUserAppOrigins.includes(nextUrl.origin)) {
      redirectUrl = nextUrl
    } else {
      // Force to safe origin (user app - localhost or qmeal)
      redirectUrl = new URL(next.startsWith('/') ? next : `/${next}`, safeOrigin)
    }
  } catch {
    // next is not a full URL, use safe origin (user app - localhost or qmeal)
    redirectUrl = new URL(next.startsWith('/') ? next : `/${next}`, safeOrigin)
  }
  
  // Final safety check - ensure redirect is only to user app origins
  if (!allowedUserAppOrigins.includes(redirectUrl.origin)) {
    redirectUrl = new URL(next.startsWith('/') ? next : `/${next}`, safeOrigin)
  }
  
  // Add a query parameter to indicate successful login
  redirectUrl.searchParams.set('logged_in', 'true')
  
  console.log('Callback redirecting to:', redirectUrl.toString()) // Debug log
  console.log('Safe origin:', safeOrigin) // Debug log
  console.log('Next param:', next) // Debug log
  
  return NextResponse.redirect(redirectUrl)
}
