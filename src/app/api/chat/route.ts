/**
 * Chat API Route - Chatbot Kantin dengan Cerebras AI Tool Calling
 * Menggunakan model Llama-3.3-70b untuk AI chatbot
 * 
 * Flow: User → Chat API → Cerebras (decide tool) → Tools API → Supabase → Cerebras (summarize) → User
 */

import { NextRequest, NextResponse } from 'next/server'
import Cerebras from '@cerebras/cerebras_cloud_sdk'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ChatRequest {
  kantin_id?: string
  message: string
  history?: ChatMessage[]
}

// ============================================
// SYSTEM PROMPT - Aturan Perilaku Ketat
// ============================================
const SYSTEM_PROMPT = `Kamu adalah "Ang", Asisten Kantin yang ramah dan helpful. 

ATURAN KETAT:
1. HANYA boleh menjawab hal terkait kantin/menu/pemesanan
2. Jika user menyapa/obrol ringan: jawab ramah + tawarkan bantuan memilih menu
3. Jika pertanyaan TIDAK terkait kantin: tolak halus ("Maaf aku hanya bantu soal menu/pesanan di kantin. Mau cari menu apa?")
4. Jika butuh data (harga/menu/termurah/termahal/list/budget) WAJIB panggil tool. JANGAN mengarang
5. Jika hasil tool kosong: jawab "Tidak ada menu yang sesuai." (jangan mengarang)
6. Jika permintaan "rekomenin menu" masih ambigu: tanyakan preferensi (kategori + budget)

FORMAT JAWABAN:
- Singkat, padat, ramah
- Gunakan emoji secukupnya
- Format harga: Rp X.XXX
- Untuk list menu: sebutkan nama menu, harga, dan rating jika ada

ROUTER INTENT (pilih tool yang tepat):

PENTING - DETEKSI NAMA KANTIN:
- Jika user menyebut nama kantin/kios (contoh: "nasi goreng japan", "nasi pecel", "aneka juice", dll), SELALU gunakan list_menu_by_kantin dengan kantin_name
- Pattern: "dari [nama]", "di [nama]", "menu [nama]", "makanan [nama]", "sebutin [nama]" → list_menu_by_kantin(kantin_name: "[nama]")
- Contoh: "sebutin makanan dari nasi goreng japan" → list_menu_by_kantin(kantin_name: "nasi goreng japan")
- Contoh: "menu di nasi pecel" → list_menu_by_kantin(kantin_name: "nasi pecel")
- Contoh: "apa aja di aneka juice" → list_menu_by_kantin(kantin_name: "aneka juice")

ROUTER LAINNYA:
- "menu di kios/kantin X" → list_menu_by_kantin(kantin_name: "X")
- "termurah/termahal" → get_cheapest/get_priciest  
- "di bawah harga X" → list_under_price
- "budget X makanan+minuman" → recommend_combo_under_budget
- "rekomendasi umum / cari menu" → search_menu
- "menu paling laris/populer" → get_popular_menu
- "menu rating tertinggi/terbaik" → get_top_rated
- "kantin apa aja / list kantin" → list_all_kantin
- "jam buka kantin X / kantin X buka?" → get_kantin_info
- "hai/halo" → TIDAK panggil tool, jawab langsung

PENTING - MENU TERLARIS/POPULER:
- "menu terlaris" / "menu paling laris" / "best seller" (TANPA menyebut kios) → get_popular_menu() TANPA parameter kantin_name (ranking GLOBAL dari semua kios)
- "menu terlaris di kios X" / "best seller di X" → get_popular_menu(kantin_name: "X") (ranking per kios)
- Tampilkan dengan format ranking: "1. Nama Menu - RpX (Kios Y) - Terjual Z"
- Jika belum ada penjualan, tampilkan berdasarkan rating

PENTING - PERBANDINGAN MENU:
- "bandingkan A vs B" / "beda A sama B" / "mending mana A atau B" → compare_menu(menu_names: ["A", "B"])
- Tampilkan perbandingan: harga, rating, terjual
- Berikan analisis: mana yang lebih murah, lebih enak, lebih laris

PENTING - PAKET CUSTOM (USER PILIH SENDIRI):
- "mau A sama B" / "pesan A dan B" / "ambil A + B" → create_custom_combo(menu_names: ["A", "B"])
- User memilih sendiri menu yang mau dipaketkan
- Tampilkan total harga dan menu yang ditemukan
- Jika ada menu tidak ditemukan, beritahu user

PENTING - MENU BARU:
- "menu baru hari ini" → get_new_menu(period: "today")
- "menu baru minggu ini" / "ada menu baru ga?" → get_new_menu(period: "week")
- "menu baru bulan ini" → get_new_menu(period: "month")

PENTING - REKOMENDASI PERSONAL:
- "rekomendasiin buat aku" / "menu yang cocok buat aku" → get_personal_recommendation(user_id: dari session)
- Jika user belum pernah pesan atau kurang dari 3x, minta user pesan dulu
- Tampilkan menu favorit user + rekomendasi baru dari kantin yang sama

PENTING - PEMBEDAAN MAKANAN vs MINUMAN:
- MAKANAN: kategori "Makan Pagi" atau "Makan Siang" (BUKAN "Minuman")
- MINUMAN: kategori "Minuman"
- Ketika user tanya "makanan termurah/termahal", gunakan kategori "makanan" di tool
- JANGAN mencampur makanan dan minuman ketika user spesifik tanya tentang "makanan"

PENTING - JANGAN BILANG "TIDAK TERSEDIA" ATAU "TUTUP" JIKA ADA DATA:
- Jika tool mengembalikan data menu (count > 0), TAMPILKAN menu tersebut dengan ramah
- JANGAN bilang kantin "tutup" atau "tidak tersedia" jika ada menu yang ditemukan!
- Hanya bilang "tidak ada menu" jika hasil tool benar-benar kosong (count: 0)
- Status buka/tutup kantin TIDAK relevan untuk menampilkan daftar menu
- Jika ada menu ditemukan, jawab dengan ramah dan tampilkan daftar menu

CONTOH JAWABAN BENAR:
- User: "menu di nasi pecel apa aja"
- Tool returns: 1 menu (Nasi Pecel komplit)
- Jawaban: "Ini menu dari Nasi Pecel! 🍽️ Ada Nasi Pecel komplit - Rp10.000"

CONTOH JAWABAN SALAH (JANGAN LAKUKAN):
- "Maaf, kios tutup" (SALAH - jika ada menu, tampilkan!)
- "Tidak ada menu yang tersedia" (SALAH - jika count > 0, ada menu!)`

// ============================================
// TOOL DEFINITIONS untuk Cerebras (OpenAI format)
// ============================================
const TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'search_menu',
      description: 'Cari/rekomendasi menu berdasarkan query dan filter. Gunakan untuk pencarian umum, rekomendasi, atau filter kategori.',
      parameters: {
        type: 'object',
        properties: {
          kantin_id: { type: 'string', description: 'UUID kantin (opsional)' },
          query: { type: 'string', description: 'Kata kunci pencarian (opsional)' },
          kategori: {
            type: 'string',
            description: 'Kategori menu: makan_pagi, makan_siang, snack, minuman',
            enum: ['makan_pagi', 'makan_siang', 'snack', 'minuman'],
          },
          max_price: { type: 'number', description: 'Harga maksimal (opsional)' },
          sort: {
            type: 'string',
            description: 'Urutan: rating_desc, price_asc, price_desc, best_seller_desc',
            enum: ['rating_desc', 'price_asc', 'price_desc', 'best_seller_desc'],
          },
          limit: { type: 'number', description: 'Jumlah hasil (default 10)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_menu_by_kantin',
      description: 'List semua menu dari kantin/kios tertentu. Gunakan ketika user tanya "menu di kios X" atau "apa aja di kantin Y".',
      parameters: {
        type: 'object',
        properties: {
          kantin_id: { type: 'string', description: 'UUID kantin' },
          kantin_name: { type: 'string', description: 'Nama kantin untuk pencarian' },
          sort: {
            type: 'string',
            enum: ['rating_desc', 'price_asc', 'price_desc', 'best_seller_desc'],
          },
          limit: { type: 'number', description: 'Jumlah hasil (default 10)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_cheapest',
      description: 'Dapatkan menu TERMURAH. Gunakan ketika user tanya "yang termurah", "paling murah".',
      parameters: {
        type: 'object',
        properties: {
          kantin_id: { type: 'string', description: 'UUID kantin (opsional)' },
          kantin_name: { type: 'string', description: 'Nama kantin untuk filter' },
          kategori: {
            type: 'string',
            description: 'Kategori: makanan, minuman, snack',
            enum: ['makanan', 'makan_pagi', 'makan_siang', 'snack', 'minuman'],
          },
          limit: { type: 'number', description: 'Jumlah hasil (default 5)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_priciest',
      description: 'Dapatkan menu TERMAHAL. Gunakan ketika user tanya "yang termahal", "paling mahal".',
      parameters: {
        type: 'object',
        properties: {
          kantin_id: { type: 'string', description: 'UUID kantin (opsional)' },
          kantin_name: { type: 'string', description: 'Nama kantin untuk filter' },
          kategori: {
            type: 'string',
            enum: ['makanan', 'makan_pagi', 'makan_siang', 'snack', 'minuman'],
          },
          limit: { type: 'number', description: 'Jumlah hasil (default 5)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_under_price',
      description: 'List menu dengan harga di bawah/maksimal X. Gunakan ketika user tanya "di bawah 10rb", "maksimal 15k".',
      parameters: {
        type: 'object',
        properties: {
          max_price: { type: 'number', description: 'Harga maksimal (WAJIB)' },
          kantin_id: { type: 'string', description: 'UUID kantin (opsional)' },
          kantin_name: { type: 'string', description: 'Nama kantin (opsional)' },
          kategori: {
            type: 'string',
            enum: ['makanan', 'makan_pagi', 'makan_siang', 'snack', 'minuman'],
          },
          limit: { type: 'number', description: 'Jumlah hasil (default 10)' },
        },
        required: ['max_price'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'recommend_combo_under_budget',
      description: 'Rekomendasi PAKET makanan + minuman dalam budget. Gunakan ketika user minta "paket", "combo", "makanan dan minuman budget X".',
      parameters: {
        type: 'object',
        properties: {
          budget: { type: 'number', description: 'Budget total (WAJIB)' },
          kantin_id: { type: 'string', description: 'UUID kantin (opsional)' },
          kantin_name: { type: 'string', description: 'Nama kantin (opsional)' },
          limit: { type: 'number', description: 'Jumlah combo (default 5)' },
        },
        required: ['budget'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_popular_menu',
      description: `Dapatkan menu PALING LARIS/TERLARIS berdasarkan jumlah terjual.
      
PENGGUNAAN:
- "menu terlaris" / "menu paling laris" / "best seller" → panggil TANPA kantin_name (ranking global dari semua kios)
- "menu terlaris di kios X" / "best seller di X" → panggil DENGAN kantin_name: "X" (ranking per kios)

CONTOH:
- User: "menu terlaris apa?" → get_popular_menu() tanpa parameter
- User: "menu paling laris di nasi goreng japan" → get_popular_menu(kantin_name: "nasi goreng japan")`,
      parameters: {
        type: 'object',
        properties: {
          kantin_id: { type: 'string', description: 'UUID kantin (opsional - kosongkan untuk ranking global)' },
          kantin_name: { type: 'string', description: 'Nama kantin untuk filter (opsional - kosongkan untuk ranking global)' },
          kategori: {
            type: 'string',
            enum: ['makanan', 'makan_pagi', 'makan_siang', 'snack', 'minuman'],
          },
          limit: { type: 'number', description: 'Jumlah hasil (default 5, max 10)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_top_rated',
      description: 'Dapatkan menu dengan RATING TERTINGGI. Gunakan ketika user tanya "rating tertinggi", "menu terbaik", "paling enak".',
      parameters: {
        type: 'object',
        properties: {
          kantin_id: { type: 'string', description: 'UUID kantin (opsional)' },
          kantin_name: { type: 'string', description: 'Nama kantin untuk filter' },
          kategori: {
            type: 'string',
            enum: ['makanan', 'makan_pagi', 'makan_siang', 'snack', 'minuman'],
          },
          limit: { type: 'number', description: 'Jumlah hasil (default 10)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_all_kantin',
      description: 'List SEMUA KANTIN yang aktif. Gunakan ketika user tanya "kantin apa aja", "list kantin", "ada kantin apa".',
      parameters: {
        type: 'object',
        properties: {
          only_open: { type: 'boolean', description: 'Hanya tampilkan kantin yang sedang buka' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_kantin_info',
      description: 'Info detail KANTIN tertentu (jam buka/tutup, status). Gunakan ketika user tanya "jam buka kantin X", "kantin X buka ga", "info kantin X".',
      parameters: {
        type: 'object',
        properties: {
          kantin_id: { type: 'string', description: 'UUID kantin' },
          kantin_name: { type: 'string', description: 'Nama kantin untuk pencarian' },
        },
        required: [],
      },
    },
  },
  // ===== NEW TOOLS =====
  {
    type: 'function',
    function: {
      name: 'compare_menu',
      description: `Bandingkan 2 atau lebih menu side-by-side.
      
PENGGUNAAN:
- "bandingkan nasi goreng biasa vs nasi goreng telur"
- "beda nasi pecel sama miso ramen apa?"
- "mending mana jus mangga atau jus alpukat?"

Akan menampilkan perbandingan: harga, rating, terjual, dan analisis mana yang lebih murah/enak/laris.`,
      parameters: {
        type: 'object',
        properties: {
          menu_names: { 
            type: 'array', 
            items: { type: 'string' },
            description: 'Array nama menu yang mau dibandingkan (minimal 2)' 
          },
          kantin_name: { type: 'string', description: 'Filter by kantin (opsional)' },
        },
        required: ['menu_names'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_custom_combo',
      description: `Buat paket custom dari menu yang dipilih user sendiri.
      
PENGGUNAAN:
- "mau nasi goreng telur sama jus mangga"
- "pesan miso ramen dan oca tea"
- "ambil nasi pecel komplit + jus jambu"
- "makanan A dan minuman B aja"

User memilih sendiri menu yang mau dipaketkan, bukan random dari sistem.`,
      parameters: {
        type: 'object',
        properties: {
          menu_names: { 
            type: 'array', 
            items: { type: 'string' },
            description: 'Array nama menu yang dipilih user' 
          },
        },
        required: ['menu_names'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_new_menu',
      description: `Dapatkan menu TERBARU berdasarkan periode.
      
PENGGUNAAN:
- "menu baru hari ini" → period: "today"
- "menu baru minggu ini" → period: "week"
- "menu baru bulan ini" → period: "month"
- "ada menu baru ga?" → period: "week" (default)`,
      parameters: {
        type: 'object',
        properties: {
          period: { 
            type: 'string', 
            enum: ['today', 'week', 'month'],
            description: 'Periode: today (hari ini), week (minggu ini), month (bulan ini)' 
          },
          kantin_name: { type: 'string', description: 'Filter by kantin (opsional)' },
          limit: { type: 'number', description: 'Jumlah hasil (default 10)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_personal_recommendation',
      description: `Rekomendasi PERSONAL berdasarkan riwayat pesanan user.
      
PENGGUNAAN:
- "rekomendasiin menu buat aku"
- "menu yang cocok buat aku apa?"
- "aku biasa pesan apa ya?"

PENTING: Butuh user_id dari session. Jika user belum pernah pesan atau kurang dari 3x, akan diminta pesan dulu.`,
      parameters: {
        type: 'object',
        properties: {
          user_id: { type: 'string', description: 'UUID user (dari session)' },
          limit: { type: 'number', description: 'Jumlah hasil (default 5)' },
        },
        required: ['user_id'],
      },
    },
  },
]


// ============================================
// TOOL EXECUTION - Call internal APIs
// ============================================
async function executeToolCall(toolName: string, args: any, baseUrl: string): Promise<any> {
  console.log(`[executeToolCall] ${toolName}`, args)

  const toolEndpoints: Record<string, string> = {
    'search_menu': '/api/tools/search-menu',
    'list_menu_by_kantin': '/api/tools/list-menu-by-kantin',
    'get_cheapest': '/api/tools/get-cheapest',
    'get_priciest': '/api/tools/get-priciest',
    'list_under_price': '/api/tools/list-under-price',
    'recommend_combo_under_budget': '/api/tools/recommend-combo',
    'get_popular_menu': '/api/tools/get-popular-menu',
    'get_top_rated': '/api/tools/get-top-rated',
    'list_all_kantin': '/api/tools/list-all-kantin',
    'get_kantin_info': '/api/tools/get-kantin-info',
    // New tools
    'compare_menu': '/api/tools/compare-menu',
    'create_custom_combo': '/api/tools/create-custom-combo',
    'get_new_menu': '/api/tools/get-new-menu',
    'get_personal_recommendation': '/api/tools/get-personal-recommendation',
  }

  const endpoint = toolEndpoints[toolName]
  if (!endpoint) {
    return { error: `Unknown tool: ${toolName}` }
  }

  try {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    })

    const data = await response.json()
    console.log(`[executeToolCall] ${toolName} result:`, data?.count || data?.combos?.length || 0, 'items')
    return data
  } catch (error: any) {
    console.error(`[executeToolCall] ${toolName} error:`, error.message)
    return { error: error.message }
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Check if message is smalltalk/greeting
 */
function isSmallTalk(msg: string): boolean {
  const lowerMsg = msg.toLowerCase().trim()
  const greetings = [
    'hai', 'halo', 'hi', 'hello', 'hey', 'hei',
    'selamat pagi', 'selamat siang', 'selamat sore', 'selamat malam',
    'pagi', 'siang', 'sore', 'malam',
    'apa kabar', 'gimana kabar',
    'terima kasih', 'makasih', 'thanks', 'thank you',
    'ok', 'oke', 'okay', 'sip', 'siap', 'baik',
  ]

  return greetings.some(g => lowerMsg === g || lowerMsg.startsWith(g + ' ') || lowerMsg.endsWith(' ' + g))
}

/**
 * Check if message is out of scope
 */
function isOutOfScope(msg: string): boolean {
  const lowerMsg = msg.toLowerCase()
  const outOfScopeKeywords = [
    'cuaca', 'weather', 'berita', 'news',
    'politik', 'agama', 'religion',
    'matematika', 'fisika', 'kimia', 'biologi',
    'coding', 'programming', 'javascript', 'python',
    'game', 'film', 'movie', 'musik', 'music',
    'cerita', 'dongeng', 'puisi', 'sajak',
    'teori', 'relativitas', 'einstein',
    'siapa presiden', 'siapa gubernur',
  ]

  // Check if message contains food/menu related keywords
  const foodKeywords = [
    'makan', 'minum', 'menu', 'harga', 'pesan', 'order',
    'kantin', 'kios', 'warung', 'toko',
    'murah', 'mahal', 'budget', 'rekomendasi', 'rekomen',
    'snack', 'jajan', 'minuman', 'makanan',
  ]

  const hasFoodKeyword = foodKeywords.some(k => lowerMsg.includes(k))
  if (hasFoodKeyword) return false

  return outOfScopeKeywords.some(k => lowerMsg.includes(k))
}

/**
 * Check if message is ambiguous recommendation request
 */
function isAmbiguousRecommendation(msg: string): boolean {
  const lowerMsg = msg.toLowerCase().trim()
  const ambiguousPatterns = [
    /^rekomen(dasi)?(\s+menu)?(\s+dong)?[.!?]?$/i,
    /^saran(in)?(\s+menu)?(\s+dong)?[.!?]?$/i,
    /^ada\s+rekomendasi[.!?]?$/i,
    /^mau\s+pesan[.!?]?$/i,
    /^menu\s+apa\s+(ya|nih|dong)[.!?]?$/i,
    /^yang\s+enak\s+apa[.!?]?$/i,
  ]

  // Check if it has specific info (budget, category, kantin)
  const hasSpecificInfo =
    /\d+/.test(lowerMsg) || // has number (budget)
    /\b(makan|minum|snack|minuman|makanan|pagi|siang)\b/i.test(lowerMsg) ||
    /\b(kios|kantin|warung|toko)\s+\w+/i.test(lowerMsg) ||
    // Check for kantin name patterns
    /\b(dari|di|menu)\s+\w+/i.test(lowerMsg)

  if (hasSpecificInfo) return false

  return ambiguousPatterns.some(p => p.test(lowerMsg))
}

/**
 * Extract kantin name from user message
 * Returns kantin name if detected, null otherwise
 */
function extractKantinName(msg: string): string | null {
  const lowerMsg = msg.toLowerCase().trim()
  
  // Patterns to detect kantin name
  const patterns = [
    /(?:dari|di|menu|makanan|minuman|sebutin|apa\s+aja)\s+(?:kios|kantin|warung|toko)?\s*(.+?)(?:\s+(?:apa|dong|ya|nih|ada|yang))?$/i,
    /(?:kios|kantin|warung|toko)\s+(.+?)(?:\s+(?:apa|dong|ya|nih|ada|yang|menu))?$/i,
    /^(.+?)\s+(?:menu|makanan|minuman)(?:\s+apa)?$/i,
  ]
  
  for (const pattern of patterns) {
    const match = lowerMsg.match(pattern)
    if (match && match[1]) {
      const name = match[1].trim()
      // Filter out common words that are not kantin names
      const excludeWords = ['apa', 'yang', 'dong', 'ya', 'nih', 'ada', 'menu', 'makanan', 'minuman', 'termurah', 'termahal', 'populer', 'laris', 'enak', 'terbaik']
      if (!excludeWords.includes(name) && name.length > 2) {
        return name
      }
    }
  }
  
  return null
}

/**
 * Check if message is asking about specific kantin menu
 */
function isKantinMenuQuery(msg: string): boolean {
  const lowerMsg = msg.toLowerCase().trim()
  
  // Patterns that indicate user is asking about a specific kantin's menu
  const kantinPatterns = [
    /(?:sebutin|list|apa\s+aja|ada\s+apa)\s+(?:makanan|minuman|menu)?\s*(?:dari|di)\s+/i,
    /(?:menu|makanan|minuman)\s+(?:dari|di)\s+/i,
    /(?:dari|di)\s+(?:kios|kantin|warung|toko)?\s*\w+/i,
  ]
  
  return kantinPatterns.some(p => p.test(lowerMsg))
}

/**
 * Generate quick reply buttons based on context
 */
function generateQuickReplies(context: 'ambiguous' | 'menu_shown' | 'empty_result' | 'greeting'): string[] {
  switch (context) {
    case 'ambiguous':
      return ['🍳 Makan Pagi', '🍛 Makan Siang', '🍿 Snack', '🥤 Minuman', '💰 Budget 15k', '💰 Budget 20k']
    case 'menu_shown':
      return ['Ada yang lebih murah?', 'Minuman apa yang cocok?', 'Menu populer lainnya']
    case 'empty_result':
      return ['Menu populer', 'Semua menu', 'Budget 20k']
    case 'greeting':
      return ['Rekomendasi menu', 'Menu termurah', 'Paket hemat']
    default:
      return []
  }
}

/**
 * Format menu item for AI context
 */
function formatMenuItem(item: any): string {
  const rating = item.avg_rating > 0 ? `⭐${Number(item.avg_rating).toFixed(1)} (${item.rating_count})` : ''
  const kantin = item.nama_kantin ? `[${item.nama_kantin}]` : ''
  const sold = item.total_sold > 0 ? `🔥${item.total_sold}x terjual` : ''
  return `${item.nama_menu} — Rp${Number(item.harga).toLocaleString('id-ID')} ${rating} ${sold} ${kantin}`.trim()
}

/**
 * Format menu item with ranking for popular menu
 */
function formatPopularMenuItem(item: any, index: number): string {
  const rating = item.avg_rating > 0 ? `⭐${Number(item.avg_rating).toFixed(1)}` : ''
  const kantin = item.nama_kantin ? `[${item.nama_kantin}]` : ''
  const sold = item.total_sold > 0 ? `🔥${item.total_sold}x terjual` : ''
  const rank = item.ranking || (index + 1)
  return `${rank}. ${item.nama_menu} — Rp${Number(item.harga).toLocaleString('id-ID')} ${rating} ${sold} ${kantin}`.trim()
}

/**
 * Format kantin info for AI context
 */
function formatKantinInfo(kantin: any): string {
  const status = kantin.is_open_now ? '🟢 Buka' : '🔴 Tutup'
  const jam = kantin.jam_buka && kantin.jam_tutup ? `${kantin.jam_buka} - ${kantin.jam_tutup}` : 'Jam tidak tersedia'
  return `${kantin.nama_kantin} — ${status} — Jam: ${jam}`
}

/**
 * Format combo for AI context
 */
function formatCombo(combo: any, index: number): string {
  return `${index + 1}. ${combo.makanan.nama_menu} + ${combo.minuman.nama_menu} = Rp${combo.total.toLocaleString('id-ID')} (sisa Rp${combo.sisa.toLocaleString('id-ID')})`
}

/**
 * Clean markdown from AI response
 */
function cleanMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/_(.*?)_/g, '$1')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`(.*?)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .trim()
}


// ============================================
// MAIN CHAT HANDLER
// ============================================
export async function POST(req: NextRequest) {
  try {
    // ========== AUTHENTICATION ==========
    const isDevelopment = process.env.NODE_ENV === 'development'
    const authHeader = req.headers.get('authorization')
    let currentUserId: string | null = null

    // Skip auth check in development mode
    if (!isDevelopment) {
      if (!authHeader) {
        return NextResponse.json(
          { error: 'Lakukan login untuk bisa memulai bercakapan dengan chatbot', code: 'UNAUTHORIZED' },
          { status: 401 }
        )
      }

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

      if (!supabaseUrl || !supabaseAnonKey) {
        return NextResponse.json({ error: 'Supabase configuration missing', code: 'CONFIG_ERROR' }, { status: 500 })
      }

      const token = authHeader.replace('Bearer ', '')
      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      })

      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        return NextResponse.json(
          { error: 'Lakukan login untuk bisa memulai bercakapan dengan chatbot', code: 'UNAUTHORIZED' },
          { status: 401 }
        )
      }
      currentUserId = user.id
    } else {
      console.log('[Chat] Development mode - skipping auth check')
      // In development, try to get user from auth header if provided
      if (authHeader) {
        try {
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
          const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
          if (supabaseUrl && supabaseAnonKey) {
            const token = authHeader.replace('Bearer ', '')
            const supabase = createClient(supabaseUrl, supabaseAnonKey, {
              global: { headers: { Authorization: `Bearer ${token}` } },
            })
            const { data: { user } } = await supabase.auth.getUser()
            if (user) currentUserId = user.id
          }
        } catch (e) {
          // Ignore auth errors in development
        }
      }
    }

    // ========== PARSE REQUEST ==========
    let body: ChatRequest
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON', code: 'PARSE_ERROR' }, { status: 400 })
    }

    const { kantin_id, message, history } = body

    if (!message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json({ error: 'message wajib diisi', code: 'MISSING_MESSAGE' }, { status: 400 })
    }

    const trimmedMessage = message.trim()
    console.log(`[Chat] message="${trimmedMessage.substring(0, 50)}..." kantin_id=${kantin_id || 'global'} user_id=${currentUserId || 'anonymous'}`)

    // Get base URL for internal API calls
    // Support: NEXT_PUBLIC_APP_URL (manual), RAILWAY_PUBLIC_DOMAIN (Railway), VERCEL_URL (Vercel)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : null) ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

    // ========== HANDLE SPECIAL CASES (no tool call needed) ==========

    // Case 1: Smalltalk/Greeting
    if (isSmallTalk(trimmedMessage)) {
      console.log('[Chat] Detected smalltalk')
      return NextResponse.json({
        reply: 'Halo! 👋 Mau pesan apa hari ini? Aku bisa bantu rekomendasi menu, cari yang termurah, atau paket hemat! 😊',
        quickReplies: generateQuickReplies('greeting'),
      })
    }

    // Case 2: Out of scope
    if (isOutOfScope(trimmedMessage)) {
      console.log('[Chat] Detected out of scope')
      return NextResponse.json({
        reply: 'Maaf aku khusus bantu soal menu/pesanan kantin aja ya. Mau cari menu apa? 😊',
        quickReplies: generateQuickReplies('greeting'),
      })
    }

    // Case 3: Ambiguous recommendation
    if (isAmbiguousRecommendation(trimmedMessage)) {
      console.log('[Chat] Detected ambiguous recommendation')
      return NextResponse.json({
        reply: 'Mau cari menu apa nih? Pilih kategori atau kasih tau budget kamu ya! 😊',
        quickReplies: generateQuickReplies('ambiguous'),
      })
    }

    // ========== CEREBRAS WITH TOOL CALLING ==========
    const apiKey = process.env.CEREBRAS_API_KEY
    if (!apiKey) {
      console.error('[Chat] CEREBRAS_API_KEY not configured')
      return NextResponse.json({ error: 'AI service not configured', code: 'CONFIG_ERROR' }, { status: 500 })
    }

    const cerebras = new Cerebras({ apiKey })

    // Build conversation context
    let conversationContext = ''
    if (history && history.length > 0) {
      const recentHistory = history.slice(-4)
      conversationContext = '\nPERCAKAPAN SEBELUMNYA:\n' +
        recentHistory.map(msg => `${msg.role === 'user' ? 'User' : 'Ang'}: ${msg.content}`).join('\n') + '\n'
    }

    // Add kantin context if specified
    let kantinContext = ''
    if (kantin_id) {
      const { data: kantinData } = await supabaseAdmin
        .from('kantin')
        .select('nama_kantin')
        .eq('id', kantin_id)
        .single()

      if (kantinData) {
        kantinContext = `\nKONTEKS: User sedang di halaman kantin "${kantinData.nama_kantin}" (ID: ${kantin_id}). Prioritaskan menu dari kantin ini.`
      }
    }

    // Pre-process: detect kantin name from message
    const detectedKantinName = extractKantinName(trimmedMessage)
    let kantinHint = ''
    if (detectedKantinName) {
      kantinHint = `\n\nHINT PENTING: User menyebut nama kantin "${detectedKantinName}". 
WAJIB gunakan tool list_menu_by_kantin dengan parameter kantin_name: "${detectedKantinName}" untuk mendapatkan menu dari kantin tersebut.
JANGAN bilang "tidak tersedia" sebelum memanggil tool!`
      console.log(`[Chat] Detected kantin name: "${detectedKantinName}"`)
    }

    // Check if this is a kantin menu query
    const isKantinQuery = isKantinMenuQuery(trimmedMessage)
    if (isKantinQuery && !detectedKantinName) {
      kantinHint = `\n\nHINT: User sepertinya bertanya tentang menu dari kantin tertentu. Coba ekstrak nama kantin dari pesan dan gunakan list_menu_by_kantin.`
    }

    // Add user context for personal recommendation
    let userContext = ''
    if (currentUserId) {
      userContext = `\n\nUSER CONTEXT: User sudah login (user_id tersedia). Jika user minta rekomendasi personal, gunakan get_personal_recommendation.`
    } else {
      userContext = `\n\nUSER CONTEXT: User belum login atau anonymous. Jika user minta rekomendasi personal, beritahu untuk login dulu.`
    }

    const fullPrompt = `${SYSTEM_PROMPT}${kantinContext}${conversationContext}${kantinHint}${userContext}

User: "${trimmedMessage}"

Analisis pesan user dan tentukan apakah perlu memanggil tool untuk mendapatkan data menu. Jika perlu data, panggil tool yang sesuai. Jika tidak perlu data (misal: sapaan, terima kasih), jawab langsung.`

    console.log('[Chat] Calling Cerebras with tools...')

    // First call - let Cerebras decide if tool is needed
    const response = await cerebras.chat.completions.create({
      model: 'llama-3.3-70b',
      messages: [
        { role: 'system', content: fullPrompt },
        { role: 'user', content: trimmedMessage }
      ],
      tools: TOOL_DEFINITIONS,
      tool_choice: 'auto',
      temperature: 0.3,
      max_completion_tokens: 1000,
      stream: false
    });

    // Check if Cerebras wants to call a tool
    const functionCalls = (response as any).choices?.[0]?.message?.tool_calls

    if (functionCalls && functionCalls.length > 0) {
      console.log('[Chat] Cerebras requested tool calls:', functionCalls.map((fc: any) => fc.function?.name))

      // Execute all tool calls
      const toolResults: any[] = []
      let menuData: any[] = []
      let comboData: any[] = []

      for (const fc of functionCalls) {
        let args = JSON.parse((fc as any).function?.arguments || '{}')
        const toolName = (fc as any).function?.name || ''
        
        // Inject user_id for personal recommendation tool
        if (toolName === 'get_personal_recommendation' && currentUserId) {
          args.user_id = currentUserId
        }
        
        const result = await executeToolCall(toolName, args, baseUrl)
        toolResults.push({ name: toolName, result })

        // Collect menu/combo data for UI
        // For custom combo, use combo.items (not result.items to avoid duplicate)
        if (toolName === 'create_custom_combo' && result.combo?.items) {
          menuData = [...menuData, ...result.combo.items]
        } else if (result.items) {
          menuData = [...menuData, ...result.items]
        }
        
        if (result.combos) {
          comboData = [...comboData, ...result.combos]
        }
      }
      
      // Deduplicate menuData by id
      const seenIds = new Set<string>()
      menuData = menuData.filter(item => {
        if (seenIds.has(item.id)) {
          return false
        }
        seenIds.add(item.id)
        return true
      })

      // Second call - let Cerebras summarize the results
      const toolResultsText = toolResults.map(tr => {
        if (tr.result.error) {
          return `Tool ${tr.name}: Error - ${tr.result.error}`
        }
        // Handle kantin info
        if (tr.result.kantin && tr.name === 'get_kantin_info') {
          return `Tool ${tr.name}: ${formatKantinInfo(tr.result.kantin)}`
        }
        // Handle list kantin
        if (tr.name === 'list_all_kantin' && tr.result.items) {
          const kantinList = tr.result.items.map(formatKantinInfo).join('\n')
          return `Tool ${tr.name}: Ditemukan ${tr.result.count} kantin (${tr.result.open_count} buka):\n${kantinList}`
        }
        // Handle popular menu with ranking
        if (tr.name === 'get_popular_menu' && tr.result.items !== undefined) {
          if (tr.result.items.length === 0) {
            return `Tool ${tr.name}: HASIL KOSONG - Tidak ada menu terlaris yang ditemukan`
          }
          const menuList = tr.result.items.slice(0, 10).map((item: any, idx: number) => formatPopularMenuItem(item, idx)).join('\n')
          const isGlobal = tr.result.is_global
          const kantinName = tr.result.kantin?.nama_kantin || ''
          const note = tr.result.note || ''
          return `Tool ${tr.name}: RANKING MENU TERLARIS${isGlobal ? ' (SEMUA KIOS)' : ` dari ${kantinName}`}:\n${menuList}\n\nNote: ${note}\n(PENTING: Tampilkan dengan format ranking 1, 2, 3, dst)`
        }
        // Handle compare menu
        if (tr.name === 'compare_menu' && tr.result.comparison) {
          const comp = tr.result.comparison
          const menuComparison = comp.menus.map((m: any) => 
            `• ${m.nama_menu} [${m.nama_kantin}]\n  Harga: Rp${m.harga.toLocaleString('id-ID')}\n  Rating: ⭐${m.avg_rating.toFixed(1)} (${m.rating_count} ulasan)\n  Terjual: ${m.total_sold}x`
          ).join('\n\n')
          const analysis = `\nANALISIS:\n- Termurah: ${comp.analysis.cheapest}\n- Termahal: ${comp.analysis.most_expensive}\n- Rating tertinggi: ${comp.analysis.highest_rated}\n- Paling laris: ${comp.analysis.best_seller}\n- Selisih harga: Rp${comp.analysis.price_diff.toLocaleString('id-ID')}`
          return `Tool ${tr.name}: PERBANDINGAN MENU:\n\n${menuComparison}\n${analysis}`
        }
        // Handle custom combo
        if (tr.name === 'create_custom_combo') {
          if (tr.result.items && tr.result.items.length > 0) {
            const menuList = tr.result.items.map((m: any) => `• ${m.nama_menu} - Rp${Number(m.harga).toLocaleString('id-ID')} [${m.nama_kantin}]`).join('\n')
            const notFound = tr.result.not_found?.length > 0 ? `\n\n⚠️ Menu tidak ditemukan: ${tr.result.not_found.join(', ')}` : ''
            return `Tool ${tr.name}: PAKET CUSTOM BERHASIL DIBUAT!\n\n${menuList}\n\n💰 TOTAL: Rp${tr.result.total.toLocaleString('id-ID')}${notFound}`
          }
          return `Tool ${tr.name}: ${tr.result.message || 'Tidak ada menu yang ditemukan'}`
        }
        // Handle new menu
        if (tr.name === 'get_new_menu') {
          if (tr.result.items && tr.result.items.length > 0) {
            const menuList = tr.result.items.map((m: any) => {
              const daysAgo = m.days_ago === 0 ? 'Hari ini' : `${m.days_ago} hari lalu`
              return `🆕 ${m.nama_menu} - Rp${Number(m.harga).toLocaleString('id-ID')} [${m.nama_kantin}] (${daysAgo})`
            }).join('\n')
            return `Tool ${tr.name}: MENU BARU ${tr.result.period_label?.toUpperCase()}:\n\n${menuList}`
          }
          return `Tool ${tr.name}: ${tr.result.message || 'Belum ada menu baru'}`
        }
        // Handle personal recommendation
        if (tr.name === 'get_personal_recommendation') {
          if (!tr.result.has_history) {
            return `Tool ${tr.name}: ${tr.result.message}`
          }
          if (tr.result.items && tr.result.items.length > 0) {
            const favorites = (tr.result.favorites || []).map((m: any) => 
              `❤️ ${m.nama_menu} - Rp${Number(m.harga).toLocaleString('id-ID')} [${m.nama_kantin}] (Kamu sudah pesan ${m.order_count}x)`
            ).join('\n')
            const newRecs = (tr.result.new_recommendations || []).map((m: any) => 
              `✨ ${m.nama_menu} - Rp${Number(m.harga).toLocaleString('id-ID')} [${m.nama_kantin}]`
            ).join('\n')
            return `Tool ${tr.name}: REKOMENDASI PERSONAL (berdasarkan ${tr.result.order_count} pesanan kamu):\n\n📌 MENU FAVORIT KAMU:\n${favorites || 'Belum ada'}\n\n🆕 COBA JUGA:\n${newRecs || 'Belum ada rekomendasi baru'}`
          }
          return `Tool ${tr.name}: ${tr.result.message}`
        }
        // Handle menu results - be explicit about count
        if (tr.result.items !== undefined) {
          if (tr.result.items.length === 0) {
            return `Tool ${tr.name}: HASIL KOSONG - Tidak ada menu yang ditemukan (count: 0)`
          }
          const menuList = tr.result.items.slice(0, 10).map(formatMenuItem).join('\n')
          const kantinName = tr.result.kantin?.nama_kantin || ''
          return `Tool ${tr.name}: DITEMUKAN ${tr.result.count} MENU${kantinName ? ` dari ${kantinName}` : ''}:\n${menuList}\n\n(PENTING: Ada ${tr.result.count} menu, WAJIB tampilkan ke user!)`
        }
        if (tr.result.combos !== undefined) {
          if (tr.result.combos.length === 0) {
            return `Tool ${tr.name}: HASIL KOSONG - Tidak ada paket yang sesuai budget (count: 0)`
          }
          const comboList = tr.result.combos.slice(0, 5).map(formatCombo).join('\n')
          return `Tool ${tr.name}: DITEMUKAN ${tr.result.count} PAKET:\n${comboList}`
        }
        return `Tool ${tr.name}: ${JSON.stringify(tr.result)}`
      }).join('\n\n')

      const summaryPrompt = `${SYSTEM_PROMPT}

User bertanya: "${trimmedMessage}"

Hasil dari database:
${toolResultsText}

ATURAN JAWABAN KETAT:
1. Jika ada menu ditemukan (count > 0), WAJIB TAMPILKAN menu tersebut dengan ramah
2. DILARANG bilang "tutup", "tidak tersedia", atau "tidak ditemukan" jika ada menu!
3. Hanya bilang "Tidak ada menu yang sesuai" jika count = 0 atau hasil benar-benar kosong
4. Sebutkan nama kantin jika relevan
5. Format: sebutkan nama menu dan harga dengan jelas
6. Jika hanya ada sedikit menu (1-2), tetap tampilkan dengan ramah

Berikan jawaban natural dan ramah berdasarkan data di atas.`

      const summaryResponse = await cerebras.chat.completions.create({
        model: 'llama-3.3-70b',
        messages: [
          { role: 'system', content: summaryPrompt }
        ],
        temperature: 0.5,
        max_completion_tokens: 500,
        stream: false
      });

      let reply = cleanMarkdown((summaryResponse as any).choices?.[0]?.message?.content || 'Maaf, saya tidak bisa memproses permintaan kamu.')

      // SAFEGUARD: If we have menu data but AI says "tutup" or "tidak tersedia", override the response
      const hasMenuResults = menuData.length > 0
      const aiSaysClosed = reply.toLowerCase().includes('tutup') || 
                          reply.toLowerCase().includes('tidak tersedia') ||
                          reply.toLowerCase().includes('tidak ada menu') ||
                          reply.toLowerCase().includes('tidak ditemukan')
      
      if (hasMenuResults && aiSaysClosed) {
        console.log('[Chat] SAFEGUARD: AI incorrectly said closed/unavailable, overriding response')
        const kantinName = menuData[0]?.nama_kantin || 'kantin ini'
        reply = `Ini menu dari ${kantinName}! 🍽️👇`
      }

      // Determine quick replies based on result
      const hasResults = menuData.length > 0 || comboData.length > 0
      const quickReplies = hasResults
        ? generateQuickReplies('menu_shown')
        : generateQuickReplies('empty_result')

      // Format combo data for UI
      const formattedComboData = comboData.slice(0, 5).map((combo, index) => ({
        id: `combo-${index}`,
        type: 'combo',
        makanan: combo.makanan,
        minuman: combo.minuman,
        total: combo.total,
        sisa: combo.sisa,
      }))

      console.log(`[Chat] Returning ${menuData.length} menus, ${formattedComboData.length} combos`)

      return NextResponse.json({
        reply,
        menuData: menuData.length > 0 ? menuData.slice(0, 10) : undefined,
        comboData: formattedComboData.length > 0 ? formattedComboData : undefined,
        quickReplies,
        debug: {
          toolsCalled: functionCalls.map((fc: any) => fc.function?.name),
          menuCount: menuData.length,
          comboCount: formattedComboData.length,
        },
      })
    }

    // No tool call needed - return direct response
    let reply = cleanMarkdown((response as any).choices?.[0]?.message?.content || 'Maaf, saya tidak bisa memproses permintaan kamu.')

    // FALLBACK: If we detected a kantin name but AI didn't call tool, force call the tool
    if (detectedKantinName && !reply.toLowerCase().includes('menu') && !reply.toLowerCase().includes('tidak ada')) {
      console.log('[Chat] Fallback: AI didnt call tool for kantin query, forcing list_menu_by_kantin')
      
      const fallbackResult = await executeToolCall('list_menu_by_kantin', { kantin_name: detectedKantinName }, baseUrl)
      
      if (fallbackResult.items && fallbackResult.items.length > 0) {
        const menuList = fallbackResult.items.slice(0, 10).map(formatMenuItem).join('\n')
        const kantinName = fallbackResult.kantin?.nama_kantin || detectedKantinName
        
        return NextResponse.json({
          reply: `Ini menu dari ${kantinName}! 🍽️👇`,
          menuData: fallbackResult.items.slice(0, 10),
          quickReplies: generateQuickReplies('menu_shown'),
          debug: {
            toolsCalled: ['list_menu_by_kantin (fallback)'],
            menuCount: fallbackResult.items.length,
          },
        })
      } else {
        return NextResponse.json({
          reply: `Maaf, tidak ada menu yang ditemukan dari "${detectedKantinName}". Mungkin nama kantinnya berbeda? Coba cek daftar kantin ya! 🙏`,
          quickReplies: ['List semua kantin', 'Menu populer', 'Rekomendasi'],
        })
      }
    }

    console.log('[Chat] No tool call needed, returning direct response')

    return NextResponse.json({
      reply,
      quickReplies: generateQuickReplies('greeting'),
    })

  } catch (error: any) {
    console.error('[Chat] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Terjadi kesalahan, silakan coba lagi', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
