/**
 * Chat API Route - Chatbot Kantin dengan Gemini Tool Calling
 * Implementasi baru sesuai planning chatbot.md
 * 
 * Flow: User → Chat API → Gemini (decide tool) → Tools API → Supabase → Gemini (summarize) → User
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
- Untuk list menu: "Nama Menu — RpX — Rating Y (N ulasan) — [Kantin: ...]"

ROUTER INTENT (pilih tool yang tepat):
- "menu di kios/kantin X" → list_menu_by_kantin
- "termurah/termahal" → get_cheapest/get_priciest  
- "di bawah harga X" → list_under_price
- "budget X makanan+minuman" → recommend_combo_under_budget
- "rekomendasi umum / cari menu" → search_menu
- "menu paling laris/populer" → get_popular_menu
- "menu rating tertinggi/terbaik" → get_top_rated
- "kantin apa aja / list kantin" → list_all_kantin
- "jam buka kantin X / kantin X buka?" → get_kantin_info
- "hai/halo" → TIDAK panggil tool, jawab langsung

PENTING - PEMBEDAAN MAKANAN vs MINUMAN:
- MAKANAN: kategori "Makan Pagi" atau "Makan Siang" (BUKAN "Minuman")
- MINUMAN: kategori "Minuman"
- Ketika user tanya "makanan termurah/termahal", gunakan kategori "makanan" di tool
- JANGAN mencampur makanan dan minuman ketika user spesifik tanya tentang "makanan"`

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
      description: 'Dapatkan menu PALING LARIS/POPULER berdasarkan jumlah terjual. Gunakan ketika user tanya "yang paling laris", "menu populer", "best seller".',
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
    /\b(kios|kantin|warung|toko)\s+\w+/i.test(lowerMsg)
  
  if (hasSpecificInfo) return false
  
  return ambiguousPatterns.some(p => p.test(lowerMsg))
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
    } else {
      console.log('[Chat] Development mode - skipping auth check')
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
    console.log(`[Chat] message="${trimmedMessage.substring(0, 50)}..." kantin_id=${kantin_id || 'global'}`)

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

    // ========== GEMINI WITH TOOL CALLING ==========
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

    const fullPrompt = `${SYSTEM_PROMPT}${kantinContext}${conversationContext}

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
        const args = JSON.parse((fc as any).function?.arguments || '{}')
        const result = await executeToolCall((fc as any).function?.name || '', args, baseUrl)
        toolResults.push({ name: (fc as any).function?.name, result })

        // Collect menu/combo data for UI
        if (result.items) {
          menuData = [...menuData, ...result.items]
        }
        if (result.combos) {
          comboData = [...comboData, ...result.combos]
        }
      }

      // Second call - let Cerebras summarize the results
      const toolResultsText = toolResults.map(tr => {
        if (tr.result.error) {
          return `Tool ${tr.name}: Error - ${tr.result.error}`
        }
        // Handle kantin info
        if (tr.result.kantin) {
          return `Tool ${tr.name}: ${formatKantinInfo(tr.result.kantin)}`
        }
        // Handle list kantin
        if (tr.name === 'list_all_kantin' && tr.result.items) {
          const kantinList = tr.result.items.map(formatKantinInfo).join('\n')
          return `Tool ${tr.name}: Ditemukan ${tr.result.count} kantin (${tr.result.open_count} buka):\n${kantinList}`
        }
        if (tr.result.items && tr.result.items.length === 0) {
          return `Tool ${tr.name}: Tidak ada menu yang ditemukan`
        }
        if (tr.result.combos && tr.result.combos.length === 0) {
          return `Tool ${tr.name}: Tidak ada paket yang sesuai budget`
        }
        if (tr.result.items) {
          const menuList = tr.result.items.slice(0, 10).map(formatMenuItem).join('\n')
          return `Tool ${tr.name}: Ditemukan ${tr.result.count} menu:\n${menuList}`
        }
        if (tr.result.combos) {
          const comboList = tr.result.combos.slice(0, 5).map(formatCombo).join('\n')
          return `Tool ${tr.name}: Ditemukan ${tr.result.count} paket:\n${comboList}`
        }
        return `Tool ${tr.name}: ${JSON.stringify(tr.result)}`
      }).join('\n\n')

      const summaryPrompt = `${SYSTEM_PROMPT}

User bertanya: "${trimmedMessage}"

Hasil dari database:
${toolResultsText}

Berikan jawaban natural dan ramah berdasarkan data di atas. Jika tidak ada hasil, katakan dengan jelas "Tidak ada menu yang sesuai" dan berikan saran alternatif. JANGAN mengarang menu yang tidak ada di data.`

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
