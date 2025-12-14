/**
 * AI Assistant API Route dengan Function Calling
 * Route ini menggunakan Gemini AI dengan function calling untuk
 * berinteraksi langsung dengan database melalui RPC functions
 */

import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI, FunctionCallingConfigMode } from '@google/genai'
import { tools } from '@/lib/geminiTools'
import { SYSTEM_PROMPT } from '@/lib/systemPrompt'
import {
  rpcGetMenuByBudget,
  rpcSearchMenus,
  rpcGetMenusByCategory,
  rpcGetCheapestMenus,
  rpcGetBestValueMenus,
  rpcGetPopularMenus,
  rpcGetNewMenus,
  rpcGetMenuCombos,
  rpcGetKantinStats,
  rpcGetAllMenus,
  rpcGetKantinInfo,
  rpcGetAllKantins,
  rpcSearchKantins,
  rpcGetMakananByCategory,
  rpcGetNewMenusGlobal,
  rpcGetMinumanByCategory,
  rpcGetHealthyMenus,
  rpcGetMenuByBudgetGlobal,
  rpcSearchMenusGlobal,
  rpcGetMenusByCategoryGlobal,
  rpcGetCheapestMenusGlobal,
  rpcGetBestValueMenusGlobal,
  rpcGetPopularMenusGlobal,
  rpcGetBestMealCombo,
  rpcGetRecommendationsByTime,
  rpcGetFallbackMenus,
  rpcGetMenusUnder10k,
  rpcGetAllMenusGlobal,
  rpcFindMenuByName,
  rpcSearchMenu,
  rpcRecommendMenu,
  rpcRecommendBundle,
  rpcQueryMenuDirect,
} from '@/lib/aiTools'

export const dynamic = 'force-dynamic'

/**
 * POST handler untuk AI chat dengan function calling
 */
export async function POST(req: NextRequest) {
  try {
    // Parse request body dengan error handling
    let body
    try {
      body = await req.json()
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError)
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const { message, kantinId } = body

    // Validasi input
    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'message (string) wajib diisi' },
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // kantinId bisa kosong untuk global search
    if (kantinId && typeof kantinId !== 'string') {
      return NextResponse.json(
        { error: 'kantinId harus string jika ada' },
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      console.error('GEMINI_API_KEY not configured')
      return NextResponse.json(
        { error: 'API key tidak dikonfigurasi' },
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Initialize GoogleGenAI client
    const ai = new GoogleGenAI({ apiKey })

    // STEP 1: Kirim pesan ke Gemini untuk merencanakan tool usage
    console.log('Step 1: Planning with Gemini...')
    console.log('Message:', message)
    console.log('KantinId:', kantinId)
    
    const firstRequest = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `${SYSTEM_PROMPT}\n\nUser: ${message}\n\nKantin ID: ${kantinId || 'global'}`,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        toolConfig: {
          functionCallingConfig: {
            mode: FunctionCallingConfigMode.AUTO,
          },
        },
        tools: [{ functionDeclarations: tools.functionDeclarations }],
        temperature: 0.4,
        maxOutputTokens: 800,
      },
    })

    const firstResponse = firstRequest
    console.log('First response:', JSON.stringify(firstResponse, null, 2))

    const toolCall = firstResponse.functionCalls?.[0]

    // STEP 2: Jika ada tool call, eksekusi dan kirim hasil ke Gemini
    if (toolCall?.name) {
      console.log('Step 2: Executing tool:', toolCall.name)
      console.log('Tool args:', toolCall.args)

      const args = (toolCall.args || {}) as Record<string, any>
      let toolResult: any = null

      try {
        console.log('Executing tool with kantinId:', kantinId)
        
        // Eksekusi tool berdasarkan nama
        switch (toolCall.name) {
          case 'getMenusByBudget':
            if (kantinId) {
              toolResult = await rpcGetMenuByBudget(
                kantinId,
                Number(args.maxBudget),
                typeof args.limit === 'number' ? args.limit : undefined
              )
            } else {
              toolResult = await rpcGetMenuByBudgetGlobal(
                Number(args.maxBudget),
                typeof args.limit === 'number' ? args.limit : undefined
              )
            }
            break

          case 'searchMenus':
            if (kantinId) {
              toolResult = await rpcSearchMenus(
                kantinId,
                Array.isArray(args.keywords) ? args.keywords : [],
                typeof args.limit === 'number' ? args.limit : undefined
              )
            } else {
              toolResult = await rpcSearchMenusGlobal(
                Array.isArray(args.keywords) ? args.keywords : [],
                typeof args.limit === 'number' ? args.limit : undefined
              )
            }
            break

          case 'getMenusByCategory':
            if (kantinId) {
              toolResult = await rpcGetMenusByCategory(
                kantinId,
                typeof args.category === 'string' ? args.category : '',
                typeof args.limit === 'number' ? args.limit : undefined
              )
            } else {
              toolResult = await rpcGetMenusByCategoryGlobal(
                typeof args.category === 'string' ? args.category : '',
                typeof args.limit === 'number' ? args.limit : undefined
              )
            }
            break

          case 'getCheapestMenus':
            if (kantinId) {
              toolResult = await rpcGetCheapestMenus(
                kantinId, 
                typeof args.limit === 'number' ? args.limit : 5
              )
            } else {
              toolResult = await rpcGetCheapestMenusGlobal(
                typeof args.limit === 'number' ? args.limit : 5
              )
            }
            break

          case 'getBestValueMenus':
            if (kantinId) {
              toolResult = await rpcGetBestValueMenus(
                kantinId, 
                typeof args.limit === 'number' ? args.limit : 5
              )
            } else {
              toolResult = await rpcGetBestValueMenusGlobal(
                typeof args.limit === 'number' ? args.limit : 5
              )
            }
            break

          case 'getPopularMenus':
            if (kantinId) {
              toolResult = await rpcGetPopularMenus(
                kantinId, 
                typeof args.limit === 'number' ? args.limit : 5
              )
            } else {
              toolResult = await rpcGetPopularMenusGlobal(
                typeof args.limit === 'number' ? args.limit : 5
              )
            }
            break

          case 'getNewMenus':
            if (kantinId) {
              toolResult = await rpcGetNewMenus(
                kantinId,
                typeof args.daysAgo === 'number' ? args.daysAgo : 30,
                typeof args.limit === 'number' ? args.limit : 10
              )
            } else {
              toolResult = await rpcGetNewMenusGlobal(
                typeof args.daysAgo === 'number' ? args.daysAgo : 30,
                typeof args.limit === 'number' ? args.limit : 10
              )
            }
            break

          case 'getMenuCombos':
            if (kantinId) {
              toolResult = await rpcGetMenuCombos(
                kantinId,
                Number(args.budget),
                typeof args.limit === 'number' ? args.limit : 10
              )
            } else {
              toolResult = { error: 'Menu combos hanya tersedia untuk kantin spesifik' }
            }
            break

          case 'getKantinStats':
            if (kantinId) {
              toolResult = await rpcGetKantinStats(kantinId)
            } else {
              toolResult = { error: 'Kantin stats hanya tersedia untuk kantin spesifik' }
            }
            break

          case 'getAllMenus':
            if (kantinId) {
              toolResult = await rpcGetAllMenus(
                kantinId, 
                typeof args.limit === 'number' ? args.limit : undefined
              )
            } else {
              toolResult = await rpcGetAllMenusGlobal(
                typeof args.limit === 'number' ? args.limit : undefined
              )
            }
            break

          // Global functions (tanpa kantinId)
          case 'getMenusByBudgetGlobal':
            toolResult = await rpcGetMenuByBudgetGlobal(
              Number(args.maxBudget),
              typeof args.limit === 'number' ? args.limit : undefined
            )
            break

          case 'searchMenusGlobal':
            toolResult = await rpcSearchMenusGlobal(
              Array.isArray(args.keywords) ? args.keywords : [],
              typeof args.limit === 'number' ? args.limit : undefined
            )
            break

          case 'getMenusByCategoryGlobal':
            toolResult = await rpcGetMenusByCategoryGlobal(
              typeof args.category === 'string' ? args.category : '',
              typeof args.limit === 'number' ? args.limit : undefined
            )
            break

          case 'getCheapestMenusGlobal':
            toolResult = await rpcGetCheapestMenusGlobal(
              typeof args.limit === 'number' ? args.limit : 5
            )
            break

          case 'getBestValueMenusGlobal':
            toolResult = await rpcGetBestValueMenusGlobal(
              typeof args.limit === 'number' ? args.limit : 5
            )
            break

          case 'getPopularMenusGlobal':
            toolResult = await rpcGetPopularMenusGlobal(
              typeof args.limit === 'number' ? args.limit : 5
            )
            break

          case 'getAllMenusGlobal':
            toolResult = await rpcGetAllMenusGlobal(
              typeof args.limit === 'number' ? args.limit : undefined
            )
            break

          // New tools for database-only responses
          case 'queryMenuDirect':
            if (kantinId) {
              toolResult = await rpcQueryMenuDirect(
                kantinId,
                typeof args.jenis === 'string' && ['makanan', 'minuman', 'semua'].includes(args.jenis)
                  ? args.jenis as 'makanan' | 'minuman' | 'semua'
                  : 'semua',
                typeof args.sortBy === 'string' && ['harga_asc', 'harga_desc', 'popularitas', 'terbaru'].includes(args.sortBy)
                  ? args.sortBy as 'harga_asc' | 'harga_desc' | 'popularitas' | 'terbaru'
                  : 'harga_asc',
                typeof args.maxPrice === 'number' ? args.maxPrice : undefined,
                typeof args.minPrice === 'number' ? args.minPrice : undefined,
                typeof args.tersedia === 'boolean' ? args.tersedia : true,
                typeof args.limit === 'number' ? args.limit : 1
              )
            } else {
              toolResult = { error: 'queryMenuDirect memerlukan kantinId' }
            }
            break

          case 'findMenuByName':
            if (kantinId) {
              toolResult = await rpcFindMenuByName(
                kantinId,
                typeof args.menuName === 'string' ? args.menuName : '',
                typeof args.limit === 'number' ? args.limit : 5
              )
            } else {
              toolResult = { error: 'findMenuByName memerlukan kantinId' }
            }
            break

          case 'searchMenu':
            if (kantinId) {
              toolResult = await rpcSearchMenu(
                kantinId,
                typeof args.q === 'string' ? args.q : undefined,
                Array.isArray(args.kategori) ? args.kategori : undefined,
                typeof args.maxPrice === 'number' ? args.maxPrice : undefined,
                typeof args.tersedia === 'boolean' ? args.tersedia : true,
                typeof args.limit === 'number' ? args.limit : 10
              )
            } else {
              toolResult = { error: 'searchMenu memerlukan kantinId' }
            }
            break

          case 'recommendMenu':
            if (kantinId) {
              toolResult = await rpcRecommendMenu(
                kantinId,
                Number(args.maxPrice),
                Array.isArray(args.kategori) ? args.kategori : undefined,
                typeof args.tersedia === 'boolean' ? args.tersedia : true,
                typeof args.limit === 'number' ? args.limit : 5
              )
            } else {
              toolResult = { error: 'recommendMenu memerlukan kantinId' }
            }
            break

          case 'recommendBundle':
            if (kantinId) {
              toolResult = await rpcRecommendBundle(
                kantinId,
                Number(args.budget),
                Array.isArray(args.kategori) ? args.kategori : undefined,
                typeof args.tersedia === 'boolean' ? args.tersedia : true,
                typeof args.limit === 'number' ? args.limit : 3
              )
            } else {
              toolResult = { error: 'recommendBundle memerlukan kantinId' }
            }
            break

          // Kantin info functions
          case 'getKantinInfo':
            const targetKantinId = typeof args.kantinId === 'string' && args.kantinId 
              ? args.kantinId 
              : kantinId || ''
            if (targetKantinId) {
              toolResult = await rpcGetKantinInfo(targetKantinId)
            } else {
              toolResult = { error: 'getKantinInfo memerlukan kantinId' }
            }
            break

          case 'getAllKantins':
            toolResult = await rpcGetAllKantins()
            break

          case 'searchKantins':
            toolResult = await rpcSearchKantins(
              Array.isArray(args.keywords) ? args.keywords : []
            )
            break

          // Category functions
          case 'getMakananByCategory':
            toolResult = await rpcGetMakananByCategory(
              typeof args.category === 'string' ? args.category : '',
              typeof args.limit === 'number' ? args.limit : undefined
            )
            break

          case 'getMinumanByCategory':
            toolResult = await rpcGetMinumanByCategory(
              typeof args.limit === 'number' ? args.limit : undefined
            )
            break

          case 'getHealthyMenus':
            toolResult = await rpcGetHealthyMenus(
              Array.isArray(args.keywords) ? args.keywords : [],
              typeof args.limit === 'number' ? args.limit : undefined
            )
            break

          case 'getBestMealCombo':
            toolResult = await rpcGetBestMealCombo(
              Number(args.budget),
              typeof args.timeOfDay === 'string' && ['pagi', 'siang', 'malam'].includes(args.timeOfDay) 
                ? args.timeOfDay as 'pagi' | 'siang' | 'malam'
                : undefined,
              typeof args.limit === 'number' ? args.limit : 3
            )
            break

          case 'getRecommendationsByTime':
            toolResult = await rpcGetRecommendationsByTime(
              typeof args.timeOfDay === 'string' && ['pagi', 'siang', 'malam'].includes(args.timeOfDay)
                ? args.timeOfDay as 'pagi' | 'siang' | 'malam'
                : 'pagi',
              typeof args.limit === 'number' ? args.limit : undefined
            )
            break

          case 'getFallbackMenus':
            toolResult = await rpcGetFallbackMenus(
              kantinId || undefined,
              typeof args.limit === 'number' ? args.limit : undefined
            )
            break

          case 'getMenusUnder10k':
            toolResult = await rpcGetMenusUnder10k(
              typeof args.limit === 'number' ? args.limit : undefined
            )
            break

          default:
            console.warn('Unknown tool:', toolCall.name)
            toolResult = { error: 'Tool tidak dikenal' }
        }

        console.log('Tool result:', JSON.stringify(toolResult, null, 2))
      } catch (toolError: any) {
        console.error('Tool execution error:', toolError)
        console.error('Error details:', toolError.message)
        console.error('Error stack:', toolError.stack)
        
        // Return array kosong jika error agar AI tetap bisa respond
        toolResult = []
      }

      // STEP 3: Kirim hasil tool ke Gemini untuk generate jawaban final
      console.log('Step 3: Generating final response...')
      
      // Cek apakah tool result ada data
      const hasData = Array.isArray(toolResult) ? toolResult.length > 0 : (toolResult && typeof toolResult === 'object' && !toolResult.error)
      const dataInstruction = hasData 
        ? '\n\nPENTING: Tool telah mengembalikan data. Data TIDAK kosong. LANGSUNG jawab dengan data tersebut sesuai pertanyaan user. JANGAN bilang "tidak ada jawaban" atau "maaf tidak ada jawaban" karena ada data. Gunakan data tersebut untuk menjawab pertanyaan user dengan tepat.'
        : '\n\nPENTING: Tool mengembalikan data kosong atau tidak ada data. Katakan "tidak ada" atau "belum ada menu yang sesuai" dengan sopan.'
      
      const secondRequest = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: [
              { text: `${SYSTEM_PROMPT}\n\nUser: ${message}\n\nKantin ID: ${kantinId || 'global'}${dataInstruction}` }
            ],
          },
          {
            role: 'model',
            parts: [{ functionCall: toolCall }],
          },
          {
            role: 'function',
            parts: [
              {
                functionResponse: {
                  name: toolCall.name,
                  response: toolResult,
                },
              },
            ],
          },
        ],
        config: {
          systemInstruction: SYSTEM_PROMPT,
          toolConfig: {
            functionCallingConfig: {
              mode: FunctionCallingConfigMode.AUTO,
            },
          },
          tools: [{ functionDeclarations: tools.functionDeclarations }],
          temperature: 0.4,
          maxOutputTokens: 900,
        },
      })

      const secondResponse = secondRequest
      console.log('Second response:', JSON.stringify(secondResponse, null, 2))

      let text = secondResponse.text || 'Maaf, tidak ada jawaban.'

      // Bersihkan markdown formatting
      text = cleanMarkdown(text)

      // Validasi: Pastikan menuData selalu dikembalikan jika tool berhasil
      let finalMenuData = toolResult;
      if (Array.isArray(toolResult) && toolResult.length === 0) {
        // Jika array kosong, coba fallback ke getAllMenus
        console.log('Tool returned empty array, trying fallback...');
        try {
          if (kantinId) {
            finalMenuData = await rpcGetAllMenus(kantinId, 5);
          } else {
            finalMenuData = await rpcGetAllMenusGlobal(5);
          }
          console.log('Fallback successful, got', finalMenuData?.length || 0, 'menus');
        } catch (fallbackError) {
          console.error('Fallback failed:', fallbackError);
          finalMenuData = toolResult; // Kembali ke hasil asli
        }
      }

      return NextResponse.json(
        {
          response: text,
          toolUsed: toolCall.name,
          menuData: finalMenuData,
        },
        { headers: { 'Content-Type': 'application/json' } }
      )
    }

    // STEP 4: Jika tidak ada tool call, cek apakah ini pertanyaan tentang menu
    console.log('No tool call, checking if menu-related question...')
    
    // Deteksi pertanyaan tentang menu
    const menuKeywords = ['menu', 'makanan', 'minuman', 'makan', 'minum', 'sarapan', 'makan siang', 'makan malam', 'jajanan', 'snack', 'dessert', 'jus', 'teh', 'kopi', 'segari', 'enak', 'murah', 'mahal', 'budget', 'harga', 'rekomendasi', 'pilihan', 'ada apa', 'tersedia'];
    const isMenuRelated = menuKeywords.some(keyword => 
      message.toLowerCase().includes(keyword.toLowerCase())
    );

    if (isMenuRelated) {
      console.log('Menu-related question detected, using fallback...')
      // Fallback: tampilkan beberapa menu populer
      try {
        let fallbackData;
        if (kantinId) {
          fallbackData = await rpcGetPopularMenus(kantinId, 5);
        } else {
          fallbackData = await rpcGetPopularMenusGlobal(5);
        }
        
        let text = firstResponse.text || 'Maaf, tidak ada jawaban.';
        text = cleanMarkdown(text);
        
        return NextResponse.json(
          {
            response: text + '\n\nBerikut beberapa menu yang mungkin kamu suka:',
            toolUsed: 'fallback-popular',
            menuData: fallbackData,
          },
          { headers: { 'Content-Type': 'application/json' } }
        )
      } catch (fallbackError) {
        console.error('Fallback failed:', fallbackError);
      }
    }

    // Jika bukan pertanyaan menu, kembalikan response langsung
    console.log('No tool call, returning direct response')
    let text = firstResponse.text || 'Maaf, tidak ada jawaban.'
    text = cleanMarkdown(text)

    return NextResponse.json(
      {
        response: text,
        toolUsed: null,
      },
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('AI API Error:', error)
    console.error('Error message:', error.message)
    console.error('Error stack:', error.stack)
    
    return NextResponse.json(
      { 
        error: 'Gagal memproses AI, silakan coba lagi',
        details: error.message 
      },
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

/**
 * Helper function untuk membersihkan markdown dari response AI
 */
function cleanMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1') // bold
    .replace(/\*(.*?)\*/g, '$1') // italic
    .replace(/_(.*?)_/g, '$1') // underscore italic
    .replace(/```[\s\S]*?```/g, '') // code blocks
    .replace(/`(.*?)`/g, '$1') // inline code
    .replace(/^#{1,6}\s+/gm, '') // headers
    .trim()
}
