import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

let cachedClient: SupabaseClient | null = null

const createSupabaseClient = () => {
  const url = supabaseUrl
  const anonKey = supabaseAnonKey
  const missing: string[] = []
  if (!url) missing.push('SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL')
  if (!anonKey)
    missing.push('SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY')

  if (!url || !anonKey) {
    throw new Error(`Missing Supabase env vars: ${missing.join(', ')}`)
  }

  // Type assertions - validated above
  return createClient(url as string, anonKey as string, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
    global: {
      headers: {
        'X-Client-Info': 'ekantin-ai',
      },
    },
  })
}

export const getSupabaseClient = (): SupabaseClient => {
  if (!cachedClient) {
    cachedClient = createSupabaseClient()
  }
  return cachedClient
}

// Proxy to delay client creation until first usage, avoiding build-time env errors
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabaseClient()
    // @ts-ignore - dynamic property access
    return client[prop]
  },
})

// Database types based on schema
export type Kantin = {
  id: string
  user_id: string
  nama_kantin: string
  status: 'pending' | 'aktif' | 'ditolak'
  created_at: string
  updated_at: string
  foto_profil: string | null
  jam_buka: string | null
  jam_tutup: string | null
  buka_tutup: boolean
  balance: number
  bank_name: string | null
  account_number: string | null
  account_name: string | null
}

export type Menu = {
  id: string
  kantin_id: string
  nama_menu: string
  harga: number
  foto_menu: string | null
  deskripsi: string | null
  tersedia: boolean
  kategori_menu: string[] | null  // JSONB di database
  created_at: string
  updated_at: string
  total_sold: number
}

export type Pesanan = {
  id: string
  kantin_id: string
  nomor_antrian: number
  nama_pemesan: string
  catatan: string | null
  total_harga: number
  status: 'menunggu' | 'diproses' | 'selesai'
  created_at: string
  updated_at: string
  email: string | null
  nomor_meja: string | null
  tipe_pesanan: string | null
  user_id: string | null
}

export type UserProfile = {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  phone: string | null
  created_at: string
  updated_at: string
}

export type DetailPesanan = {
  id: string
  pesanan_id: string
  menu_id: string
  jumlah: number
  harga_satuan: number
  subtotal: number
  created_at: string
  // Optional relation when detail_pesanan is fetched with `menu (*)`
  menu?: Menu | null
}

export type Pembayaran = {
  id: string
  pesanan_id: string
  midtrans_order_id: string | null
  midtrans_transaction_id: string | null
  gross_amount: number
  payer_id: string | null  // auth.users.id
  status: string
  email_pelanggan: string | null
  nomor_meja: string | null
  tipe_pesanan: string | null
  created_at: string
  updated_at: string
}

export type Rating = {
  id: string
  pesanan_id: string
  menu_id: string | null
  rating: number
  komentar: string | null
  created_at: string
  updated_at: string
}

export type Admin = {
  user_id: string
  created_at: string
}

export type Cashout = {
  id: string
  kantin_id: string
  amount: number
  status: string
  requested_at: string
  transferred_at: string | null
  transferred_by: string | null
  created_at: string
  updated_at: string
}

export type KantinWithRating = Kantin & {
  avg_rating?: number
  total_ratings?: number
}

export type MenuWithKantin = Menu & {
  kantin: Pick<Kantin, 'id' | 'nama_kantin'>
}

// Cart types
export type CartItem = {
  menu: Menu
  quantity: number
  kantin: Kantin
}

export type Cart = {
  items: CartItem[]
  totalItems: number
  totalPrice: number
}

// Checkout form types
export type CheckoutForm = {
  nama_pelanggan: string
  catatan_pesanan: string
  email: string
  nomor_meja: string
  tipe_pesanan: 'dine_in' | 'take_away'
}

// AI Assistant types
export type AIMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  menuSuggestions?: Menu[]
}

export type AIResponse = {
  message: string
  menuSuggestions?: Menu[]
  actionType?: 'recommendation' | 'search' | 'budget' | 'general'
}
