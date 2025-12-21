import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') || '/'

  // Priority order for determining origin:
  // 1. Check if callback is from localhost (development)
  // 2. Check referer header
  // 3. Check origin header
  // 4. Use request URL origin as fallback
  
  const referer = request.headers.get('referer')
  const origin = request.headers.get('origin')
  
  // Check if this callback is being called from localhost
  const isLocalhostCallback = requestUrl.hostname === 'localhost' || 
                               requestUrl.hostname === '127.0.0.1' ||
                               referer?.includes('localhost:3000') ||
                               referer?.includes('127.0.0.1:3000')
  
  // Determine safe origin - prioritize localhost for development
  let safeOrigin: string
  
  if (isLocalhostCallback) {
    // Force localhost for development
    safeOrigin = 'http://localhost:3000'
  } else if (referer) {
    // Extract origin from referer
    try {
      const refererUrl = new URL(referer)
      safeOrigin = refererUrl.origin
    } catch {
      safeOrigin = requestUrl.origin
    }
  } else if (origin) {
    safeOrigin = origin
  } else {
    safeOrigin = requestUrl.origin
  }

  // Validate origin - only allow user app origins (localhost or qmeal)
  const allowedUserAppOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://qmeal.up.railway.app',
    'https://qmeal.vercel.app'
  ]
  
  // Final validation - ensure we only redirect to user app
  if (!allowedUserAppOrigins.includes(safeOrigin)) {
    // Default to localhost for development, or qmeal for production
    safeOrigin = isLocalhostCallback ? 'http://localhost:3000' : 'https://qmeal.up.railway.app'
  }

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
