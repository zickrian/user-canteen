/**
 * Supabase Admin Client (Server-Side Only)
 * Menggunakan service_role key untuk bypass RLS
 * HANYA untuk digunakan di API routes dan server components
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const getAdminEnv = (): { supabaseUrl: string; serviceRoleKey: string } => {
  const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_DB_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  const missing: string[] = []
  if (!supabaseUrl) missing.push('SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)')
  if (!serviceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY')

  if (missing.length) {
    throw new Error(`Missing Supabase admin env vars: ${missing.join(', ')}`)
  }

  return {
    supabaseUrl,
    serviceRoleKey
  }
}

let cachedAdmin: SupabaseClient | null = null

export const getSupabaseAdmin = (): SupabaseClient => {
  if (!cachedAdmin) {
    const { supabaseUrl, serviceRoleKey } = getAdminEnv()
    cachedAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      global: {
        headers: {
          'X-Client-Info': 'ekantin-ai-admin'
        }
      }
    })
  }

  return cachedAdmin
}

// Proxy ensures we only instantiate when actually used (avoid build-time crash)
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabaseAdmin()
    // @ts-ignore - dynamic property access
    return client[prop]
  }
})

