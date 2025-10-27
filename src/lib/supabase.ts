import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Kantin = {
  id: string
  nama: string
  foto_url: string
  status: 'buka' | 'tutup'
  makan_pagi: boolean
  makan_siang: boolean
  snack: boolean
  minuman: boolean
  created_at: string
}
