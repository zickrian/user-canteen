import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') || '/'

  // STRICT allowlist - only user app origins, NEVER admin
  const ALLOWED_ORIGINS = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://qmeal.up.railway.app',
  ]
  
  // Determine safe origin based on request URL hostname
  // NEVER use admin URL - always default to user app production
  let safeOrigin: string
  
  if (requestUrl.hostname === 'qmeal.up.railway.app') {
    safeOrigin = 'https://qmeal.up.railway.app'
  } else if (requestUrl.hostname === 'localhost' || requestUrl.hostname === '127.0.0.1') {
    safeOrigin = 'http://localhost:3000'
  } else {
    // Fallback: check if request origin is in allowed list
    if (ALLOWED_ORIGINS.includes(requestUrl.origin)) {
      safeOrigin = requestUrl.origin
    } else {
      // CRITICAL: Always default to user app production, NEVER admin
      safeOrigin = 'https://qmeal.up.railway.app'
    }
  }
  
  // CRITICAL: Final validation - NEVER redirect to admin URL
  if (!ALLOWED_ORIGINS.includes(safeOrigin)) {
    safeOrigin = 'https://qmeal.up.railway.app'
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
      console.error('[Auth Callback] Exchange code error:', error)
      return NextResponse.redirect(new URL(`/?error=${encodeURIComponent(error.message)}`, safeOrigin))
    }

    // After successful login, ensure user profile exists
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
        console.error('[Auth Callback] Profile error:', profileError)
        // Don't fail the login, just log the error
      }
    }

    // After exchangeCodeForSession, redirect to next path
    // ALWAYS redirect to user app (qmeal), never admin
    // Build redirect URL using safe origin (guaranteed to be user app, never admin)
    let redirectUrl: URL
    
    // If next is '/', always redirect to home page of user app
    if (next === '/' || !next) {
      redirectUrl = new URL('/', safeOrigin)
    } else {
      try {
        // Try to parse next as full URL
        const nextUrl = new URL(next)
        // Only use it if it's from allowed user app origins
        if (ALLOWED_ORIGINS.includes(nextUrl.origin)) {
          redirectUrl = nextUrl
        } else {
          // Force to safe origin (user app only) - use path from next if valid
          const path = nextUrl.pathname || '/'
          redirectUrl = new URL(path, safeOrigin)
        }
      } catch {
        // next is not a full URL, treat as path and use safe origin
        // Ensure path starts with / and doesn't contain admin references
        let path = next.startsWith('/') ? next : `/${next}`
        // Safety: if path contains 'admin', redirect to home instead
        if (path.toLowerCase().includes('admin')) {
          path = '/'
        }
        redirectUrl = new URL(path, safeOrigin)
      }
    }
    
    // CRITICAL: Final safety check - ensure redirect is ONLY to user app origins
    // NEVER redirect to admin, always use safe origin (user app)
    if (!ALLOWED_ORIGINS.includes(redirectUrl.origin)) {
      // If somehow we got an invalid origin, force to home page of user app
      redirectUrl = new URL('/', safeOrigin)
    }
    
    // Add query parameter to indicate successful login
    redirectUrl.searchParams.set('logged_in', 'true')
    
    console.log('[Auth Callback] Redirecting to:', redirectUrl.toString())
    console.log('[Auth Callback] Safe origin:', safeOrigin)
    console.log('[Auth Callback] Next param:', next)
    
    return NextResponse.redirect(redirectUrl)
  }

  // If no code, redirect to home with error
  return NextResponse.redirect(new URL('/?error=no_code', safeOrigin))
}
