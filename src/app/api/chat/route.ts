/**
 * Chat API Route - Natural Language Chatbot
 * Menggunakan Gemini untuk memahami intent user secara natural
 */

import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// UUID validation regex
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ChatRequest {
  kantin_id?: string
  message: string
  history?: ChatMessage[] // Conversation history for context
}

// System prompt untuk AI yang natural
const SYSTEM_PROMPT = `Kamu adalah asisten kantin yang ramah dan helpful bernama "Ang". Tugasmu membantu pelanggan mencari menu makanan dan minuman.

KEPRIBADIAN:
- Ramah, santai, dan helpful seperti pelayan sungguhan
- Gunakan bahasa Indonesia casual tapi sopan
- Boleh pakai emoji secukupnya
- Jawab singkat dan to the point

KEMAMPUAN:
- Merekomendasikan menu berdasarkan budget
- Mencari menu makanan, minuman, atau snack
- Memberikan kombinasi paket (makanan + minuman) dalam budget
- Menjawab pertanyaan tentang menu yang tersedia

ATURAN PENTING:
1. HANYA gunakan data menu yang diberikan, JANGAN mengarang
2. Jika tidak ada data menu, bilang dengan sopan
3. Format harga dengan "Rp X.XXX"
4. Jika user tanya di luar topik kantin, arahkan kembali dengan sopan

PENTING - PEMBEDaan MAKANAN vs MINUMAN:
- MAKANAN: Menu dengan kategori "Makan Pagi" atau "Makan Siang" (BUKAN "Minuman")
- MINUMAN: Menu dengan kategori "Minuman"
- Ketika user tanya "makanan termurah" atau "makanan termahal", HANYA jawab dengan MAKANAN (bukan minuman)
- Ketika user tanya "makanan di [kios]", HANYA jawab dengan MAKANAN dari kios tersebut
- Ketika user tanya "makanan apa aja", HANYA jawab dengan MAKANAN (bukan minuman)
- JANGAN pernah mencampur makanan dan minuman ketika user spesifik tanya tentang "makanan"

UNTUK PERMINTAAN PAKET/COMBO DENGAN BUDGET:
- Jika user minta "makanan dan minuman dengan budget X", pilih 1 makanan + 1 minuman yang totalnya tidak melebihi budget
- Berikan 2-3 pilihan kombinasi yang berbeda
- Format: "1. [Makanan] + [Minuman] = Rp X.XXX"
- Prioritaskan kombinasi yang paling mendekati budget (value terbaik)

Saat merespons, berikan jawaban natural seperti pelayan sungguhan.`

/**
 * Get menus from database
 */
async function getMenus(kantinId?: string, limit: number = 20) {
  let query = supabaseAdmin
    .from('menu')
    .select(
      `
      id, kantin_id, nama_menu, harga, deskripsi, tersedia, kategori_menu, total_sold, foto_menu,
      kantin:kantin_id (id, nama_kantin)
    `
    )
    .eq('tersedia', true)
    .order('total_sold', { ascending: false })
    .limit(limit)

  if (kantinId && UUID_REGEX.test(kantinId)) {
    query = query.eq('kantin_id', kantinId)
  }

  const { data, error } = await query

  if (error) {
    console.error('[getMenus] Error:', error)
    return []
  }

  return data || []
}

/**
 * Get kantin info
 */
async function getKantinInfo(kantinId: string) {
  if (!kantinId || !UUID_REGEX.test(kantinId)) return null

  const { data, error } = await supabaseAdmin
    .from('kantin')
    .select('id, nama_kantin, jam_buka, jam_tutup, buka_tutup, status')
    .eq('id', kantinId)
    .single()

  if (error) {
    console.error('[getKantinInfo] Error:', error)
    return null
  }

  return data
}

/**
 * Format menu data for AI context
 */
function formatMenuContext(menus: any[]): string {
  if (!menus || menus.length === 0) {
    return 'Tidak ada menu yang tersedia saat ini.'
  }

  const menuList = menus.map((m) => {
    const kategori = m.kategori_menu?.join(', ') || 'Lainnya'
    const kantin = m.kantin?.nama_kantin || ''
    return `- ${m.nama_menu}: Rp ${m.harga.toLocaleString('id-ID')} (${kategori})${kantin ? ` [${kantin}]` : ''} ${m.total_sold > 0 ? `- Terjual ${m.total_sold}x` : ''}`
  })

  return menuList.join('\n')
}

/**
 * Detect query type from user message
 */
function detectQueryType(msg: string): {
  isMakananQuery: boolean
  isMinumanQuery: boolean
  isTermurah: boolean
  isTermahal: boolean
  isStoreQuery: boolean
} {
  const lowerMsg = msg.toLowerCase()
  
  // Check for makanan query
  const isMakananQuery = /\bmakanan\b/.test(lowerMsg) || 
                        (/\bmakan\b/.test(lowerMsg) && !/\bminum\b/.test(lowerMsg))
  
  // Check for minuman query
  const isMinumanQuery = /\bminuman\b/.test(lowerMsg) || 
                         (/\bminum\b/.test(lowerMsg) && !/\bmakan\b/.test(lowerMsg))
  
  // Check for termurah
  const isTermurah = /\btermurah\b/.test(lowerMsg) || 
                     /\bmurah\b/.test(lowerMsg) ||
                     /\bcheapest\b/.test(lowerMsg)
  
  // Check for termahal
  const isTermahal = /\btermahal\b/.test(lowerMsg) || 
                     /\bmahal\b/.test(lowerMsg) ||
                     /\bmost\s+expensive\b/.test(lowerMsg) ||
                     /\bhighest\b/.test(lowerMsg)
  
  // Check for store/kios query
  const isStoreQuery = /\b(kios|toko|warung|kantin|kedai|stan|booth)\s+/.test(lowerMsg) ||
                       /\bdi\s+[a-z]+\s+(apa|menu|jual)/.test(lowerMsg) ||
                       /[a-z]+\s+(jual|ada)\s+(apa|menu)/.test(lowerMsg)
  
  return {
    isMakananQuery,
    isMinumanQuery,
    isTermurah,
    isTermahal,
    isStoreQuery,
  }
}

/**
 * Filter menus based on query type
 */
function filterMenusByQuery(menus: any[], queryType: ReturnType<typeof detectQueryType>): any[] {
  let filtered = menus
  
  // Filter by makanan/minuman
  if (queryType.isMakananQuery) {
    filtered = filtered.filter(isMakanan)
    console.log('[filterMenusByQuery] Filtered to makanan:', filtered.length)
  } else if (queryType.isMinumanQuery) {
    filtered = filtered.filter(isMinuman)
    console.log('[filterMenusByQuery] Filtered to minuman:', filtered.length)
  }
  
  // Sort by price
  if (queryType.isTermurah) {
    filtered = [...filtered].sort((a, b) => a.harga - b.harga)
    console.log('[filterMenusByQuery] Sorted by cheapest')
  } else if (queryType.isTermahal) {
    filtered = [...filtered].sort((a, b) => b.harga - a.harga)
    console.log('[filterMenusByQuery] Sorted by most expensive')
  }
  
  return filtered
}

/**
 * Generate response using Gemini
 */
async function generateResponse(
  userMessage: string,
  menus: any[],
  kantinInfo: any,
  history?: ChatMessage[]
) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    console.error('[generateResponse] GEMINI_API_KEY not configured')
    throw new Error('GEMINI_API_KEY not configured')
  }

  console.log('[generateResponse] Initializing Gemini...')
  const ai = new GoogleGenAI({ apiKey })

  // Detect query type and filter menus accordingly
  const queryType = detectQueryType(userMessage)
  const filteredMenus = filterMenusByQuery(menus, queryType)
  
  const menuContext = formatMenuContext(filteredMenus.length > 0 ? filteredMenus : menus)
  const kantinContext = kantinInfo
    ? `Kantin: ${kantinInfo.nama_kantin}, Jam: ${kantinInfo.jam_buka || '?'} - ${kantinInfo.jam_tutup || '?'}, Status: ${kantinInfo.buka_tutup ? 'Buka' : 'Tutup'}`
    : 'Mode: Semua Kantin'

  // Format conversation history if available
  let historyContext = ''
  if (history && history.length > 0) {
    // Take last 6 messages for context (3 exchanges)
    const recentHistory = history.slice(-6)
    historyContext = '\nPERCAKAPAN SEBELUMNYA:\n' + recentHistory.map(msg => 
      msg.role === 'user' ? `Pelanggan: "${msg.content}"` : `Ang: "${msg.content}"`
    ).join('\n') + '\n'
  }

  // Check if this is a global query (all stores)
  const isGlobalQuery = /\b(semua\s+kios|semua\s+toko|semua\s+warung|semua\s+kantin|dari\s+semua)\b/i.test(userMessage)
  
  // Add specific instructions based on query type
  let queryInstructions = ''
  if (isGlobalQuery) {
    queryInstructions = '\nPENTING: User menanya tentang menu dari SEMUA KIOS. Berikan menu dari berbagai kios yang tersedia, bukan hanya dari satu kios.'
  }
  
  if (queryType.isMakananQuery && queryType.isTermurah) {
    queryInstructions += '\nPENTING: User menanya tentang MAKANAN TERMURAH. HANYA jawab dengan MAKANAN (bukan minuman) yang paling murah dari daftar menu di atas.'
  } else if (queryType.isMakananQuery && queryType.isTermahal) {
    queryInstructions += '\nPENTING: User menanya tentang MAKANAN TERMAHAL. HANYA jawab dengan MAKANAN (bukan minuman) yang paling mahal dari daftar menu di atas.'
  } else if (queryType.isMakananQuery) {
    queryInstructions += '\nPENTING: User menanya tentang MAKANAN. HANYA jawab dengan MAKANAN (bukan minuman) dari daftar menu di atas.'
  } else if (queryType.isTermurah) {
    queryInstructions += '\nPENTING: User menanya tentang menu TERMURAH. Berikan menu yang paling murah dari daftar menu di atas.'
  } else if (queryType.isTermahal) {
    queryInstructions += '\nPENTING: User menanya tentang menu TERMAHAL. Berikan menu yang paling mahal dari daftar menu di atas.'
  }

  const prompt = `${SYSTEM_PROMPT}

KONTEKS KANTIN:
${kantinContext}

DAFTAR MENU TERSEDIA:
${menuContext}
${historyContext}
${queryInstructions}
---
Pelanggan: "${userMessage}"

Berikan respons natural sebagai pelayan kantin. Jika pelanggan minta rekomendasi, pilih dari menu yang tersedia di atas. Perhatikan konteks percakapan sebelumnya jika ada.`

  console.log('[generateResponse] Calling Gemini API...')
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-05-20',
      contents: prompt,
      config: {
        temperature: 0.7,
        maxOutputTokens: 500,
      },
    })

    console.log('[generateResponse] Gemini response received')
    let text = response.text || 'Maaf, saya tidak bisa memproses permintaan kamu.'

    // Clean markdown
    text = text
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/_(.*?)_/g, '$1')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`(.*?)`/g, '$1')
      .replace(/^#{1,6}\s+/gm, '')
      .trim()

    return text
  } catch (geminiError: any) {
    console.error('[generateResponse] Gemini error:', geminiError.message)
    throw geminiError
  }
}

/**
 * Extract budget from message
 */
function extractBudget(msg: string): number | null {
  const matchK = msg.match(/(\d+)\s*k\b/i)
  const matchRb = msg.match(/(\d+)\s*rb\b/i)
  const matchRaw = msg.match(/\b(\d{4,})\b/)
  
  if (matchK) return parseInt(matchK[1]) * 1000
  if (matchRb) return parseInt(matchRb[1]) * 1000
  if (matchRaw) return parseInt(matchRaw[1])
  return null
}

/**
 * Check if menu is makanan (not minuman)
 */
function isMakanan(menu: any): boolean {
  const kategoriStr = menu.kategori_menu?.join(' ').toLowerCase() || ''
  return (kategoriStr.includes('makan') || kategoriStr.includes('makan pagi') || kategoriStr.includes('makan siang')) && 
         !kategoriStr.includes('minuman')
}

/**
 * Check if menu is minuman
 */
function isMinuman(menu: any): boolean {
  const kategoriStr = menu.kategori_menu?.join(' ').toLowerCase() || ''
  return kategoriStr.includes('minuman')
}

/**
 * Extract store/kantin name from message and filter menus
 */
function extractStoreFilter(msg: string, menus: any[]): { storeName: string | null; filteredMenus: any[] } {
  const lowerMsg = msg.toLowerCase()
  
  // Check if user explicitly asks for "semua kios" or "dari semua kios" - don't filter
  const globalQueryPatterns = [
    /\b(semua\s+kios|semua\s+toko|semua\s+warung|semua\s+kantin|dari\s+semua\s+kios|dari\s+semua\s+toko|dari\s+semua\s+warung|dari\s+semua\s+kantin)\b/i,
    /\bdari\s+semua\b/i,
  ]
  
  for (const pattern of globalQueryPatterns) {
    if (pattern.test(msg)) {
      console.log('[extractStoreFilter] Global query detected - no store filter applied')
      return { storeName: null, filteredMenus: menus }
    }
  }
  
  // Get unique store names from menus
  const storeNames = [...new Set(menus.map(m => m.kantin?.nama_kantin).filter(Boolean))] as string[]
  
  console.log('[extractStoreFilter] Available stores:', storeNames)
  console.log('[extractStoreFilter] Message:', lowerMsg)
  
  // Check for common patterns like "kios X", "toko X", "warung X", "kantin X", "di X"
  // But exclude if followed by "semua"
  const storePatterns = [
    /(?:kios|toko|warung|kantin|kedai|stan|booth)\s+([a-zA-Z0-9\s]+?)(?:\s+apa|\s+menu|\s+jual|\?|$)/i,
    /(?:di|dari)\s+([a-zA-Z0-9\s]+?)(?:\s+apa|\s+menu|\s+jual|\?|$)/i,
    /([a-zA-Z0-9\s]+?)\s+(?:jual|ada|menu)\s+(?:apa|apa\s+aja)/i,
  ]
  
  for (const pattern of storePatterns) {
    const match = msg.match(pattern)
    if (match && match[1]) {
      const searchTerm = match[1].trim().toLowerCase()
      
      // Skip if search term is "semua"
      if (searchTerm === 'semua' || searchTerm.includes('semua')) {
        continue
      }
      
      // Find store that matches the search term
      for (const storeName of storeNames) {
        const storeNameLower = storeName.toLowerCase()
        // Check if search term matches store name (partial or full)
        if (storeNameLower.includes(searchTerm) || 
            searchTerm.includes(storeNameLower) ||
            storeNameLower.split(/\s+/).some(word => word.length >= 3 && searchTerm.includes(word)) ||
            searchTerm.split(/\s+/).some(word => word.length >= 3 && storeNameLower.includes(word))) {
          const filtered = menus.filter(m => 
            m.kantin?.nama_kantin?.toLowerCase() === storeNameLower
          )
          console.log('[extractStoreFilter] Pattern match found:', storeName, 'via pattern, menus:', filtered.length)
          return { storeName, filteredMenus: filtered }
        }
      }
    }
  }
  
  // Check if any store name is mentioned in the message (partial match)
  // But only if not asking for "semua"
  if (!lowerMsg.includes('semua')) {
    for (const storeName of storeNames) {
      const storeNameLower = storeName.toLowerCase()
      // Split store name into words for partial matching
      const storeWords = storeNameLower.split(/\s+/)
      
      // Check if message contains the store name or significant part of it
      if (lowerMsg.includes(storeNameLower)) {
        const filtered = menus.filter(m => 
          m.kantin?.nama_kantin?.toLowerCase() === storeNameLower
        )
        console.log('[extractStoreFilter] Exact match found:', storeName, 'menus:', filtered.length)
        return { storeName, filteredMenus: filtered }
      }
      
      // Check partial match (at least 3 chars word)
      for (const word of storeWords) {
        if (word.length >= 3 && lowerMsg.includes(word)) {
          const filtered = menus.filter(m => 
            m.kantin?.nama_kantin?.toLowerCase() === storeNameLower
          )
          console.log('[extractStoreFilter] Partial match found:', storeName, 'via word:', word, 'menus:', filtered.length)
          return { storeName, filteredMenus: filtered }
        }
      }
    }
  }
  
  return { storeName: null, filteredMenus: menus }
}

/**
 * Generate simple response without AI (fallback)
 */
function generateSimpleResponse(userMessage: string, menus: any[]): string {
  const lowerMsg = userMessage.toLowerCase()
  
  if (menus.length === 0) {
    return 'Maaf, belum ada menu yang tersedia saat ini. Coba lagi nanti ya! 😅'
  }
  
  // Extract store filter first
  const { storeName, filteredMenus: storeFilteredMenus } = extractStoreFilter(userMessage, menus)
  
  // Use store-filtered menus if a store was mentioned
  const workingMenus = storeName ? storeFilteredMenus : menus
  
  if (storeName && workingMenus.length === 0) {
    return `Maaf, tidak ada menu dari ${storeName} yang tersedia saat ini. Coba toko lain ya! 😊`
  }
  
  // Extract budget if mentioned
  const budget = extractBudget(lowerMsg)
  
  // Check for combo/paket (makanan + minuman)
  const wantCombo = (lowerMsg.includes('makan') && lowerMsg.includes('minum')) ||
                    lowerMsg.includes('paket') || lowerMsg.includes('combo') ||
                    lowerMsg.includes('bundle') || lowerMsg.includes('pilihin') ||
                    (lowerMsg.includes('dan') && (lowerMsg.includes('makan') || lowerMsg.includes('minum')))
  
  if (wantCombo && budget) {
    console.log('[generateSimpleResponse] Combo request with budget:', budget)
    
    // Find makanan - kategori yang mengandung "Makan" tapi bukan "Minuman"
    const makananList = workingMenus.filter(isMakanan)
    
    // Find minuman - kategori yang mengandung "Minuman"
    const minumanList = workingMenus.filter(isMinuman)
    
    console.log('[generateSimpleResponse] Found makanan:', makananList.length, 'minuman:', minumanList.length)
    
    // Find combos within budget
    const combos: { makanan: any; minuman: any; total: number; sisa: number }[] = []
    for (const makanan of makananList) {
      for (const minuman of minumanList) {
        const total = makanan.harga + minuman.harga
        if (total <= budget) {
          combos.push({ makanan, minuman, total, sisa: budget - total })
        }
      }
    }
    
    console.log('[generateSimpleResponse] Found combos:', combos.length)
    
    if (combos.length === 0) {
      // Cek apakah ada makanan atau minuman yang affordable
      const cheapestMakanan = makananList.length > 0 ? Math.min(...makananList.map(m => m.harga)) : 0
      const cheapestMinuman = minumanList.length > 0 ? Math.min(...minumanList.map(m => m.harga)) : 0
      const minComboPrice = cheapestMakanan + cheapestMinuman
      
      if (minComboPrice > 0) {
        return `Maaf, budget Rp ${budget.toLocaleString('id-ID')} belum cukup untuk paket makanan + minuman. Paket termurah kami sekitar Rp ${minComboPrice.toLocaleString('id-ID')}. Coba naikkan budget ya! 😊`
      }
      return `Maaf, tidak ada paket yang tersedia saat ini. Coba tanya menu lain ya! 😊`
    }
    
    // Sort by best value (highest total within budget, then by popularity)
    combos.sort((a, b) => {
      // Prioritize combos that use more of the budget
      if (b.total !== a.total) return b.total - a.total
      // Then by popularity
      const popA = (a.makanan.total_sold || 0) + (a.minuman.total_sold || 0)
      const popB = (b.makanan.total_sold || 0) + (b.minuman.total_sold || 0)
      return popB - popA
    })
    
    const topCombos = combos.slice(0, 3)
    
    const comboList = topCombos.map((c, i) => 
      `${i + 1}. ${c.makanan.nama_menu} + ${c.minuman.nama_menu} = Rp ${c.total.toLocaleString('id-ID')} (sisa Rp ${c.sisa.toLocaleString('id-ID')})`
    ).join('\n')
    
    return `Oke! Berikut paket makanan + minuman dengan budget Rp ${budget.toLocaleString('id-ID')}:\n\n${comboList}\n\nMau pilih yang mana? 😊`
  }
  
  // Detect query type
  const queryType = detectQueryType(userMessage)
  
  // Filter menus based on user message
  let filteredMenus = workingMenus
  let responsePrefix = storeName ? `Berikut menu dari ${storeName}` : 'Berikut menu yang tersedia'
  
  // Filter by makanan/minuman first
  if (queryType.isMakananQuery) {
    filteredMenus = workingMenus.filter(isMakanan)
    responsePrefix = storeName ? `Berikut makanan dari ${storeName}` : 'Berikut makanan yang tersedia'
  } else if (queryType.isMinumanQuery) {
    filteredMenus = workingMenus.filter(isMinuman)
    responsePrefix = storeName ? `Berikut minuman dari ${storeName}` : 'Berikut minuman yang tersedia'
  }
  
  // Sort by price if termurah or termahal
  if (queryType.isTermurah) {
    filteredMenus = [...filteredMenus].sort((a, b) => a.harga - b.harga)
    if (queryType.isMakananQuery) {
      responsePrefix = storeName ? `Berikut makanan termurah dari ${storeName}` : 'Berikut makanan termurah'
    } else if (queryType.isMinumanQuery) {
      responsePrefix = storeName ? `Berikut minuman termurah dari ${storeName}` : 'Berikut minuman termurah'
    } else {
      responsePrefix = storeName ? `Berikut menu termurah dari ${storeName}` : 'Berikut menu termurah'
    }
  } else if (queryType.isTermahal) {
    filteredMenus = [...filteredMenus].sort((a, b) => b.harga - a.harga)
    if (queryType.isMakananQuery) {
      responsePrefix = storeName ? `Berikut makanan termahal dari ${storeName}` : 'Berikut makanan termahal'
    } else if (queryType.isMinumanQuery) {
      responsePrefix = storeName ? `Berikut minuman termahal dari ${storeName}` : 'Berikut minuman termahal'
    } else {
      responsePrefix = storeName ? `Berikut menu termahal dari ${storeName}` : 'Berikut menu termahal'
    }
  }
  
  // Apply budget filter if specified
  if (budget) {
    filteredMenus = filteredMenus.filter(m => m.harga <= budget)
    if (queryType.isMakananQuery) {
      responsePrefix = storeName
        ? `Berikut makanan dari ${storeName} dengan budget Rp ${budget.toLocaleString('id-ID')}`
        : `Berikut makanan dengan budget Rp ${budget.toLocaleString('id-ID')}`
    } else if (queryType.isMinumanQuery) {
      responsePrefix = storeName
        ? `Berikut minuman dari ${storeName} dengan budget Rp ${budget.toLocaleString('id-ID')}`
        : `Berikut minuman dengan budget Rp ${budget.toLocaleString('id-ID')}`
    } else {
      responsePrefix = storeName
        ? `Berikut menu dari ${storeName} dengan budget Rp ${budget.toLocaleString('id-ID')}`
        : `Berikut menu dengan budget Rp ${budget.toLocaleString('id-ID')}`
    }
  }
  
  // Fallback: Check for snack/jajan
  if (filteredMenus.length === 0 && (lowerMsg.includes('snack') || lowerMsg.includes('jajan') || lowerMsg.includes('cemilan'))) {
    filteredMenus = workingMenus.filter(m => 
      m.kategori_menu?.some((k: string) => k.toLowerCase().includes('snack'))
    )
    if (budget) {
      filteredMenus = filteredMenus.filter(m => m.harga <= budget)
      responsePrefix = storeName
        ? `Berikut pilihan snack dari ${storeName} dengan budget Rp ${budget.toLocaleString('id-ID')}`
        : `Berikut pilihan snack dengan budget Rp ${budget.toLocaleString('id-ID')}`
    } else {
      responsePrefix = storeName ? `Berikut pilihan snack dari ${storeName}` : 'Berikut pilihan snack'
    }
  }
  
  // Check for populer/laris/rekomendasi
  if (filteredMenus.length === 0 && (lowerMsg.includes('populer') || lowerMsg.includes('laris') || lowerMsg.includes('rekomendasi') || lowerMsg.includes('enak'))) {
    filteredMenus = [...workingMenus].sort((a, b) => (b.total_sold || 0) - (a.total_sold || 0))
    responsePrefix = storeName ? `Berikut menu populer dari ${storeName}` : 'Berikut menu populer'
  }
  
  // If no filtered results
  if (filteredMenus.length === 0) {
    if (budget) {
      const minPrice = workingMenus.length > 0 ? Math.min(...workingMenus.map(m => m.harga)) : 0
      const storeInfo = storeName ? ` dari ${storeName}` : ''
      return `Maaf, tidak ada menu${storeInfo} dengan budget Rp ${budget.toLocaleString('id-ID')}. Menu termurah${storeInfo} Rp ${minPrice.toLocaleString('id-ID')}. Coba naikkan budget ya! 😊`
    }
    filteredMenus = workingMenus
    responsePrefix = storeName ? `Berikut menu dari ${storeName}` : 'Berikut menu yang tersedia'
  }
  
  // Format response
  const menuList = filteredMenus.slice(0, 5).map(m => {
    const kategori = m.kategori_menu?.join(', ') || ''
    const kantin = m.kantin?.nama_kantin ? ` [${m.kantin.nama_kantin}]` : ''
    return `• ${m.nama_menu} - Rp ${m.harga.toLocaleString('id-ID')}${kantin}`
  }).join('\n')
  
  return `${responsePrefix}:\n\n${menuList}\n\nMau pesan yang mana? 😊`
}

/**
 * Extract menu suggestions from AI response
 * HANYA berdasarkan nama menu yang disebutkan, BUKAN harga
 */
function extractMenuSuggestions(response: string, menus: any[]): any[] {
  const suggestions: any[] = []
  const responseLower = response.toLowerCase()

  for (const menu of menus) {
    // HANYA check nama menu, JANGAN check harga (karena harga bisa sama)
    const menuNameLower = menu.nama_menu.toLowerCase()
    if (responseLower.includes(menuNameLower)) {
      suggestions.push(menu)
    }
  }

  // Limit to 5 suggestions
  return suggestions.slice(0, 5)
}

/**
 * POST handler
 */
export async function POST(req: NextRequest) {
  try {
    // Authentication check - hanya user yang sudah login bisa menggunakan fitur AI
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Lakukan login untuk bisa memulai bercakapan dengan chatbot', code: 'UNAUTHORIZED' },
        { status: 401 }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: 'Supabase configuration missing', code: 'CONFIG_ERROR' },
        { status: 500 }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    })

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Lakukan login untuk bisa memulai bercakapan dengan chatbot', code: 'UNAUTHORIZED' },
        { status: 401 }
      )
    }

    let body: any
    try {
      body = await req.json()
    } catch (parseErr) {
      console.error('[Chat] JSON parse error:', parseErr)
      return NextResponse.json(
        { error: 'Invalid JSON', code: 'PARSE_ERROR' },
        { status: 400 }
      )
    }

    const { kantin_id, message, history } = body as ChatRequest

    // Validate message
    if (!message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json(
        { error: 'message wajib diisi', code: 'MISSING_MESSAGE' },
        { status: 400 }
      )
    }

    const trimmedMessage = message.trim()
    console.log(
      `[Chat] kantin_id=${kantin_id || 'global'} message="${trimmedMessage.substring(0, 50)}..."`
    )

    // Get menus and kantin info
    let menus: any[] = []
    let kantinInfo: any = null
    
    try {
      console.log('[Chat] Fetching menus from database...')
      // Check if query is global (asking for all stores)
      const isGlobalQuery = /\b(semua\s+kios|semua\s+toko|semua\s+warung|semua\s+kantin|dari\s+semua)\b/i.test(trimmedMessage)
      // Increase limit for global queries to get more menus from all stores
      const menuLimit = isGlobalQuery ? 100 : 30
      menus = await getMenus(kantin_id, menuLimit)
      console.log(`[Chat] Found ${menus.length} menus (limit: ${menuLimit}, global: ${isGlobalQuery})`)
      
      if (kantin_id) {
        kantinInfo = await getKantinInfo(kantin_id)
        console.log('[Chat] Kantin info:', kantinInfo?.nama_kantin || 'not found')
      }
    } catch (dbError: any) {
      console.error('[Chat] Database error:', dbError.message)
      // Continue with empty menus
    }

    // Extract store filter if user mentions a specific store
    const { storeName, filteredMenus: storeFilteredMenus } = extractStoreFilter(trimmedMessage, menus)
    const workingMenus = storeName ? storeFilteredMenus : menus
    
    console.log(`[Chat] Store filter: ${storeName || 'none'}, working menus: ${workingMenus.length}`)

    // Generate response - try AI first, fallback to simple response
    console.log('[Chat] Generating response...')
    let reply: string
    
    try {
      // Pass only relevant menus to AI if store is specified, include history for context
      reply = await generateResponse(trimmedMessage, workingMenus, kantinInfo, history)
      console.log('[Chat] AI response generated successfully')
    } catch (aiError: any) {
      console.error('[Chat] AI error:', aiError.message)
      // Fallback to simple response without AI
      reply = generateSimpleResponse(trimmedMessage, menus)
    }

    // Only show menu cards when user is asking about specific menu types
    const lowerMsg = trimmedMessage.toLowerCase()
    let menuData: any[] = []
    const budget = extractBudget(lowerMsg)
    
    // Detect query type
    const queryType = detectQueryType(trimmedMessage)
    
    // Check for combo request
    const wantCombo = (lowerMsg.includes('makan') && lowerMsg.includes('minum')) ||
                      lowerMsg.includes('paket') || lowerMsg.includes('combo') ||
                      lowerMsg.includes('bundle') || lowerMsg.includes('pilihin')
    
    // Variable untuk combo data
    let comboData: any[] | undefined = undefined
    
    if (wantCombo && budget) {
      // For combo, find the best combos and return as combo packages
      const makananList = workingMenus.filter(isMakanan)
      
      const minumanList = workingMenus.filter(isMinuman)
      
      // Find valid combos within budget
      const combos: { makanan: any; minuman: any; total: number; sisa: number }[] = []
      for (const makanan of makananList) {
        for (const minuman of minumanList) {
          const total = makanan.harga + minuman.harga
          if (total <= budget) {
            combos.push({ makanan, minuman, total, sisa: budget - total })
          }
        }
      }
      
      // Sort by best value (highest total within budget, then popularity)
      combos.sort((a, b) => {
        if (b.total !== a.total) return b.total - a.total
        const popA = (a.makanan.total_sold || 0) + (a.minuman.total_sold || 0)
        const popB = (b.makanan.total_sold || 0) + (b.minuman.total_sold || 0)
        return popB - popA
      })
      
      // Return top 3 combos as combo packages
      comboData = combos.slice(0, 3).map((combo, index) => ({
        id: `combo-${index}`,
        type: 'combo',
        makanan: combo.makanan,
        minuman: combo.minuman,
        total: combo.total,
        sisa: combo.sisa,
      }))
      
      console.log(`[Chat] Returning ${comboData.length} combo packages`)
    } else if (!wantCombo) {
      // Filter menus based on query type
      let filteredMenus = workingMenus
      
      // Filter by makanan/minuman first
      if (queryType.isMakananQuery) {
        filteredMenus = filteredMenus.filter(isMakanan)
        console.log('[Chat] Filtered to makanan:', filteredMenus.length)
      } else if (queryType.isMinumanQuery) {
        filteredMenus = filteredMenus.filter(isMinuman)
        console.log('[Chat] Filtered to minuman:', filteredMenus.length)
      }
      
      // Sort by price if termurah or termahal
      if (queryType.isTermurah) {
        filteredMenus = [...filteredMenus].sort((a, b) => a.harga - b.harga)
        console.log('[Chat] Sorted by cheapest')
      } else if (queryType.isTermahal) {
        filteredMenus = [...filteredMenus].sort((a, b) => b.harga - a.harga)
        console.log('[Chat] Sorted by most expensive')
      }
      
      // Apply budget filter if specified
      if (budget) {
        filteredMenus = filteredMenus.filter(m => m.harga <= budget)
      }
      
      // Extract menu yang disebutkan di response AI
      const mentionedMenus = extractMenuSuggestions(reply, filteredMenus)
      
      if (mentionedMenus.length > 0) {
        // Gunakan menu yang disebutkan di response
        menuData = mentionedMenus
      } else if (filteredMenus.length > 0) {
        // Use filtered menus (already filtered by query type)
        menuData = filteredMenus.slice(0, 5)
      } else {
        // Fallback: filter berdasarkan kategori yang diminta user
        if (lowerMsg.includes('minum') || lowerMsg.includes('minuman') || lowerMsg.includes('es') || lowerMsg.includes('jus')) {
          menuData = workingMenus.filter(isMinuman)
          if (budget) menuData = menuData.filter(m => m.harga <= budget)
          menuData = menuData.slice(0, 5)
        } else if (lowerMsg.includes('makan') || lowerMsg.includes('makanan') || lowerMsg.includes('nasi') || lowerMsg.includes('goreng')) {
          menuData = workingMenus.filter(isMakanan)
          if (budget) menuData = menuData.filter(m => m.harga <= budget)
          menuData = menuData.slice(0, 5)
        } else if (lowerMsg.includes('snack') || lowerMsg.includes('jajan') || lowerMsg.includes('cemilan')) {
          menuData = workingMenus.filter(m => 
            m.kategori_menu?.some((k: string) => k.toLowerCase().includes('snack'))
          )
          if (budget) menuData = menuData.filter(m => m.harga <= budget)
          menuData = menuData.slice(0, 5)
        } else if (lowerMsg.includes('populer') || lowerMsg.includes('laris') || lowerMsg.includes('rekomendasi')) {
          menuData = [...workingMenus].sort((a, b) => (b.total_sold || 0) - (a.total_sold || 0)).slice(0, 5)
        } else if (budget) {
          menuData = workingMenus.filter(m => m.harga <= budget).slice(0, 5)
        } else if (lowerMsg.includes('menu') || lowerMsg.includes('toko') || storeName) {
          // Jika user tanya tentang toko tertentu, tampilkan menu dari toko tersebut
          menuData = workingMenus.slice(0, 5)
        }
      }
    }
    
    console.log(`[Chat] Returning ${menuData.length} menu cards`)

    return NextResponse.json({
      reply,
      menuData: menuData.length > 0 ? menuData : undefined,
      comboData: comboData, // Combo packages for "makanan + minuman" requests
      debug: {
        menuCount: menus.length,
        kantinId: kantin_id || 'global',
      },
    })
  } catch (error: any) {
    console.error('[Chat] Unexpected error:', error)
    console.error('[Chat] Error stack:', error.stack)

    return NextResponse.json(
      { error: 'Terjadi kesalahan, silakan coba lagi', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
