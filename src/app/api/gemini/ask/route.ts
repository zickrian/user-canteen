/**
 * AI Assistant API Route dengan Function Calling
 * Route ini menggunakan Gemini AI dengan function calling untuk
 * berinteraksi langsung dengan database melalui RPC functions
 */

import { NextRequest, NextResponse } from 'next/server'
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

    // STEP 1: Kirim pesan ke Gemini untuk merencanakan tool usage
    console.log('Step 1: Planning with Gemini...')
    console.log('Message:', message)
    console.log('KantinId:', kantinId)
    
    const firstRequest = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                { text: `${SYSTEM_PROMPT}\n\nUser: ${message}\n\nKantin ID: ${kantinId || 'global'}` }
              ],
            },
          ],
          tools: [tools],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 800,
          },
        }),
      }
    )

    if (!firstRequest.ok) {
      const errorText = await firstRequest.text()
      console.error('Gemini API Error (Step 1):', errorText)
      console.error('Status:', firstRequest.status)
      return NextResponse.json(
        { 
          error: `Gemini API error: ${firstRequest.status}`,
          details: errorText.substring(0, 200)
        },
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const firstData = await firstRequest.json()
    console.log('First response:', JSON.stringify(firstData, null, 2))

    const parts = firstData?.candidates?.[0]?.content?.parts || []
    const toolCall = parts.find((p: any) => p.functionCall)?.functionCall

    // STEP 2: Jika ada tool call, eksekusi dan kirim hasil ke Gemini
    if (toolCall?.name) {
      console.log('Step 2: Executing tool:', toolCall.name)
      console.log('Tool args:', toolCall.args)

      const args = toolCall.args || {}
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
                args.limit
              )
            } else {
              toolResult = await rpcGetMenuByBudgetGlobal(
                Number(args.maxBudget),
                args.limit
              )
            }
            break

          case 'searchMenus':
            if (kantinId) {
              toolResult = await rpcSearchMenus(
                kantinId,
                args.keywords || [],
                args.limit
              )
            } else {
              toolResult = await rpcSearchMenusGlobal(
                args.keywords || [],
                args.limit
              )
            }
            break

          case 'getMenusByCategory':
            if (kantinId) {
              toolResult = await rpcGetMenusByCategory(
                kantinId,
                args.category,
                args.limit
              )
            } else {
              toolResult = await rpcGetMenusByCategoryGlobal(
                args.category,
                args.limit
              )
            }
            break

          case 'getCheapestMenus':
            if (kantinId) {
              toolResult = await rpcGetCheapestMenus(kantinId, args.limit ?? 5)
            } else {
              toolResult = await rpcGetCheapestMenusGlobal(args.limit ?? 5)
            }
            break

          case 'getBestValueMenus':
            if (kantinId) {
              toolResult = await rpcGetBestValueMenus(kantinId, args.limit ?? 5)
            } else {
              toolResult = await rpcGetBestValueMenusGlobal(args.limit ?? 5)
            }
            break

          case 'getPopularMenus':
            if (kantinId) {
              toolResult = await rpcGetPopularMenus(kantinId, args.limit ?? 5)
            } else {
              toolResult = await rpcGetPopularMenusGlobal(args.limit ?? 5)
            }
            break

          case 'getNewMenus':
            if (kantinId) {
              toolResult = await rpcGetNewMenus(
                kantinId,
                args.daysAgo ?? 30,
                args.limit ?? 10
              )
            } else {
              toolResult = await rpcGetNewMenusGlobal(
                args.daysAgo ?? 30,
                args.limit ?? 10
              )
            }
            break

          case 'getMenuCombos':
            if (kantinId) {
              toolResult = await rpcGetMenuCombos(
                kantinId,
                Number(args.budget),
                args.limit ?? 10
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
              toolResult = await rpcGetAllMenus(kantinId, args.limit)
            } else {
              toolResult = await rpcGetAllMenusGlobal(args.limit)
            }
            break

          // Global functions (tanpa kantinId)
          case 'getMenusByBudgetGlobal':
            toolResult = await rpcGetMenuByBudgetGlobal(
              Number(args.maxBudget),
              args.limit
            )
            break

          case 'searchMenusGlobal':
            toolResult = await rpcSearchMenusGlobal(
              args.keywords || [],
              args.limit
            )
            break

          case 'getMenusByCategoryGlobal':
            toolResult = await rpcGetMenusByCategoryGlobal(
              args.category,
              args.limit
            )
            break

          case 'getCheapestMenusGlobal':
            toolResult = await rpcGetCheapestMenusGlobal(args.limit ?? 5)
            break

          case 'getBestValueMenusGlobal':
            toolResult = await rpcGetBestValueMenusGlobal(args.limit ?? 5)
            break

          case 'getPopularMenusGlobal':
            toolResult = await rpcGetPopularMenusGlobal(args.limit ?? 5)
            break

          case 'getAllMenusGlobal':
            toolResult = await rpcGetAllMenusGlobal(args.limit)
            break

          // Kantin info functions
          case 'getKantinInfo':
            toolResult = await rpcGetKantinInfo(args.kantinId)
            break

          case 'getAllKantins':
            toolResult = await rpcGetAllKantins()
            break

          case 'searchKantins':
            toolResult = await rpcSearchKantins(args.keywords || [])
            break

          // Category functions
          case 'getMakananByCategory':
            toolResult = await rpcGetMakananByCategory(
              args.category,
              args.limit
            )
            break

          case 'getMinumanByCategory':
            toolResult = await rpcGetMinumanByCategory(args.limit)
            break

          case 'getHealthyMenus':
            toolResult = await rpcGetHealthyMenus(
              args.keywords || [],
              args.limit
            )
            break

          case 'getBestMealCombo':
            toolResult = await rpcGetBestMealCombo(
              Number(args.budget),
              args.timeOfDay,
              args.limit ?? 3
            )
            break

          case 'getRecommendationsByTime':
            toolResult = await rpcGetRecommendationsByTime(
              args.timeOfDay,
              args.limit
            )
            break

          case 'getFallbackMenus':
            toolResult = await rpcGetFallbackMenus(
              kantinId,
              args.limit
            )
            break

          case 'getMenusUnder10k':
            toolResult = await rpcGetMenusUnder10k(
              args.limit
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
      const secondRequest = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [
                  { text: `${SYSTEM_PROMPT}\n\nUser: ${message}\n\nKantin ID: ${kantinId || 'global'}` }
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
            tools: [tools],
            generationConfig: {
              temperature: 0.4,
              maxOutputTokens: 900,
            },
          }),
        }
      )

      if (!secondRequest.ok) {
        const errorText = await secondRequest.text()
        console.error('Gemini API Error (Step 3):', errorText)
        console.error('Status:', secondRequest.status)
        return NextResponse.json(
          { 
            error: `Gemini API error step 3: ${secondRequest.status}`,
            details: errorText.substring(0, 200)
          },
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        )
      }

      const secondData = await secondRequest.json()
      console.log('Second response:', JSON.stringify(secondData, null, 2))

      let text =
        secondData?.candidates?.[0]?.content?.parts?.[0]?.text ||
        'Maaf, tidak ada jawaban.'

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
        
        let text = parts?.[0]?.text || 'Maaf, tidak ada jawaban.';
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
    let text = parts?.[0]?.text || 'Maaf, tidak ada jawaban.'
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
