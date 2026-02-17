/**
 * AI Assistant API Route dengan Function Calling
 * Route ini menggunakan Cerebras AI (GPT-OSS-120b) dengan function calling untuk
 * berinteraksi langsung dengan database melalui MCP (Model Context Protocol)
 */

import { NextRequest, NextResponse } from 'next/server'
import Cerebras from '@cerebras/cerebras_cloud_sdk'
import { tools } from '@/lib/geminiTools'
import { SYSTEM_PROMPT } from '@/lib/systemPrompt'
import { connectSupabaseMcp, pickSqlTool } from '@/lib/mcp'
import { runFunctionByName, runFunctionWithFallback } from '@/lib/mcpFunctions'

export const dynamic = 'force-dynamic'

/**
 * POST handler untuk AI chat dengan function calling
 */
export async function POST(req: NextRequest) {
  let mcp: any = null
  let sqlToolName: string | null = null
  let useFallback = false

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

    // kantinId bisa kosong untuk global search, tapi akan di-inject ke args jika ada
    if (kantinId && typeof kantinId !== 'string') {
      return NextResponse.json(
        { error: 'kantinId harus string jika ada' },
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const apiKey = process.env.CEREBRAS_API_KEY
    if (!apiKey) {
      console.error('CEREBRAS_API_KEY not configured')
      return NextResponse.json(
        { error: 'API key tidak dikonfigurasi' },
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Cerebras client
    const cerebras = new Cerebras({ apiKey })

    // Try to connect to MCP server, fallback to direct DB if fails
    console.log('Connecting to MCP server...')
    try {
      mcp = await connectSupabaseMcp()
      sqlToolName = await pickSqlTool(mcp)
      console.log('MCP connected, SQL tool:', sqlToolName)
    } catch (mcpError: any) {
      console.warn('MCP connection failed, using direct database fallback:', mcpError.message)
      useFallback = true
    }

    // STEP 1: Kirim pesan ke Cerebras untuk merencanakan tool usage
    console.log('Step 1: Planning with Cerebras...')
    console.log('Message:', message)
    console.log('KantinId:', kantinId)

    // Convert tools to OpenAI format (required by Cerebras API)
    const openaiTools = tools.functionDeclarations.map((tool: any) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parametersJsonSchema,
      }
    }));

    const firstRequest = await cerebras.chat.completions.create({
      model: 'gpt-oss-120b',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `User: ${message}\n\nKantin ID: ${kantinId || 'global'}` }
      ],
      tools: openaiTools,
      tool_choice: 'auto',
      temperature: 0.4,
      max_completion_tokens: 800,
      stream: false
    });

    const firstResponse = firstRequest as any
    console.log('First response:', JSON.stringify(firstResponse, null, 2))

    const toolCall = firstResponse.choices?.[0]?.message?.tool_calls?.[0];

    // STEP 2: Jika ada tool call, eksekusi dan kirim hasil ke Cerebras
    if (toolCall?.function?.name) {
      console.log('Step 2: Executing tool:', toolCall.function.name)
      console.log('Tool args:', toolCall.function.arguments)

      const args = JSON.parse(toolCall.function.arguments || '{}') as Record<string, any>

      // Inject kantinId dari context jika tidak ada di args tapi ada di request
      if (kantinId && !args.kantin_id) {
        args.kantin_id = kantinId
      }

      let toolResult: any = null

      try {
        console.log('Executing tool with kantinId:', args.kantin_id || kantinId)

        if (useFallback || !mcp || !sqlToolName) {
          // Use direct database fallback
          console.log('Using direct database fallback...')
          toolResult = await runFunctionWithFallback({
            name: toolCall.function.name,
            args,
          })
        } else {
          // Eksekusi tool menggunakan MCP
          toolResult = await runFunctionByName({
            mcp,
            sqlToolName: sqlToolName!,
            name: toolCall.function.name,
            args,
          })
        }

        console.log('Tool result:', JSON.stringify(toolResult, null, 2))
      } catch (toolError: any) {
        console.error('Tool execution error:', toolError)
        console.error('Error details:', toolError.message)
        console.error('Error stack:', toolError.stack)

        // Try fallback if MCP failed
        if (!useFallback) {
          console.log('Retrying with direct database fallback...')
          try {
            toolResult = await runFunctionWithFallback({
              name: toolCall.function.name,
              args,
            })
            console.log('Fallback result:', JSON.stringify(toolResult, null, 2))
          } catch (fallbackError: any) {
            console.error('Fallback also failed:', fallbackError.message)
            toolResult = []
          }
        } else {
          toolResult = []
        }
      }

      // STEP 3: Kirim hasil tool ke Cerebras untuk generate jawaban final
      console.log('Step 3: Generating final response...')

      // Normalize tool result untuk response
      let normalizedResult = toolResult
      if (toolResult?.bundles) {
        // Untuk recommend_bundle, extract menu data
        normalizedResult = toolResult.bundles.map((b: any) => ({
          makanan: b.makanan,
          minuman: b.minuman,
          total: b.total,
        }))
      } else if (!Array.isArray(toolResult)) {
        // Jika bukan array, wrap dalam array
        normalizedResult = [toolResult]
      }

      // Cek apakah tool result ada data
      const hasData = Array.isArray(normalizedResult)
        ? normalizedResult.length > 0
        : (normalizedResult && typeof normalizedResult === 'object' && !normalizedResult.error)

      const dataInstruction = hasData
        ? '\n\nPENTING: Tool telah mengembalikan data. Data TIDAK kosong. LANGSUNG jawab dengan data tersebut sesuai pertanyaan user. JANGAN bilang "tidak ada jawaban" atau "maaf tidak ada jawaban" karena ada data. Gunakan data tersebut untuk menjawab pertanyaan user dengan tepat.'
        : '\n\nPENTING: Tool mengembalikan data kosong atau tidak ada data. Katakan "tidak ada" atau "belum ada menu yang sesuai" dengan sopan.'

      const secondRequest = await cerebras.chat.completions.create({
        model: 'gpt-oss-120b',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `User: ${message}\n\nKantin ID: ${kantinId || 'global'}${dataInstruction}` },
          {
            role: 'assistant',
            content: '',
            tool_calls: [{
              id: toolCall.id,
              type: 'function',
              function: {
                name: toolCall.function.name,
                arguments: toolCall.function.arguments
              }
            }]
          },
          {
            role: 'tool',
            content: JSON.stringify(toolResult),
            tool_call_id: toolCall.id
          }
        ],
        temperature: 0.4,
        max_completion_tokens: 900,
        stream: false
      });

      const secondResponse = secondRequest as any
      console.log('Second response:', JSON.stringify(secondResponse, null, 2))

      let text = secondResponse.choices?.[0]?.message?.content || 'Maaf, tidak ada jawaban.'

      // Bersihkan markdown formatting
      text = cleanMarkdown(text)

      // Return response dengan menuData
      return NextResponse.json(
        {
          response: text,
          toolUsed: toolCall.function.name,
          menuData: normalizedResult,
        },
        { headers: { 'Content-Type': 'application/json' } }
      )
    }

    // STEP 4: Jika tidak ada tool call, kembalikan response langsung
    console.log('No tool call, returning direct response')
    let text = (firstResponse as any).choices?.[0]?.message?.content || 'Maaf, tidak ada jawaban.'
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
  } finally {
    // Cleanup MCP connection
    if (mcp) {
      try {
        await mcp.close()
        console.log('MCP connection closed')
      } catch (closeError) {
        console.error('Error closing MCP connection:', closeError)
      }
    }
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
