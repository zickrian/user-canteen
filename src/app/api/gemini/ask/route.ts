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

    if (!kantinId || typeof kantinId !== 'string') {
      return NextResponse.json(
        { error: 'kantinId (string) wajib diisi' },
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
                { text: `${SYSTEM_PROMPT}\n\nUser: ${message}\n\nKantin ID: ${kantinId}` }
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
            toolResult = await rpcGetMenuByBudget(
              kantinId,
              Number(args.maxBudget),
              args.limit
            )
            break

          case 'searchMenus':
            toolResult = await rpcSearchMenus(
              kantinId,
              args.keywords || [],
              args.limit
            )
            break

          case 'getMenusByCategory':
            toolResult = await rpcGetMenusByCategory(
              kantinId,
              args.category,
              args.limit
            )
            break

          case 'getCheapestMenus':
            toolResult = await rpcGetCheapestMenus(kantinId, args.limit ?? 5)
            break

          case 'getBestValueMenus':
            toolResult = await rpcGetBestValueMenus(kantinId, args.limit ?? 5)
            break

          case 'getPopularMenus':
            toolResult = await rpcGetPopularMenus(kantinId, args.limit ?? 5)
            break

          case 'getNewMenus':
            toolResult = await rpcGetNewMenus(
              kantinId,
              args.daysAgo ?? 30,
              args.limit ?? 10
            )
            break

          case 'getMenuCombos':
            toolResult = await rpcGetMenuCombos(
              kantinId,
              Number(args.budget),
              args.limit ?? 10
            )
            break

          case 'getKantinStats':
            toolResult = await rpcGetKantinStats(kantinId)
            break

          case 'getAllMenus':
            toolResult = await rpcGetAllMenus(kantinId, args.limit)
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
                  { text: `${SYSTEM_PROMPT}\n\nUser: ${message}\n\nKantin ID: ${kantinId}` }
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

      return NextResponse.json(
        {
          response: text,
          toolUsed: toolCall.name,
          menuData: toolResult,
        },
        { headers: { 'Content-Type': 'application/json' } }
      )
    }

    // STEP 4: Jika tidak ada tool call, ambil text response langsung
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

