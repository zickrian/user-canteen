import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// Always redirect to qmeal production
const QMEAL_URL = 'https://qmeal.up.railway.app'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') || '/'

  if (code) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.redirect(new URL('/?error=auth_config_error', QMEAL_URL))
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
      return NextResponse.redirect(new URL(`/?error=${encodeURIComponent(error.message)}`, QMEAL_URL))
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

    // Always redirect to qmeal - use next path if provided, otherwise home
    const path = next.startsWith('/') ? next : `/${next}`
    const redirectUrl = new URL(path, QMEAL_URL)
    redirectUrl.searchParams.set('logged_in', 'true')
    
    console.log('[Auth Callback] Redirecting to qmeal:', redirectUrl.toString())
    
    return NextResponse.redirect(redirectUrl)
  }

  // If no code, redirect to qmeal home with error
  return NextResponse.redirect(new URL('/?error=no_code', QMEAL_URL))
}
