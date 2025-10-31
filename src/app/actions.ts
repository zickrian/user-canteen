'use server'; // Marks all functions in this file as server actions

import { GoogleGenerativeAI } from '@google/generative-ai';
import { tools } from '@/lib/geminiTools';
import { SYSTEM_PROMPT } from '@/lib/systemPrompt';
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
  // Global functions
  rpcGetMenuByBudgetGlobal,
  rpcSearchMenusGlobal,
  rpcGetMenusByCategoryGlobal,
  rpcGetCheapestMenusGlobal,
  rpcGetBestValueMenusGlobal,
  rpcGetPopularMenusGlobal,
  rpcGetNewMenusGlobal,
  rpcGetAllMenusGlobal,
} from '@/lib/aiTools';

// Initialize the client. The SDK automatically picks up the GEMINI_API_KEY from .env.local
const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function generateContent(prompt: string, kantinId: string) {
  try {
    // Decide the model here: using gemini-2.5-flash as a good starting point
    const modelName = 'gemini-2.5-flash';

    // STEP 1: Kirim pesan ke Gemini untuk merencanakan tool usage
    console.log('Step 1: Planning with Gemini...');
    console.log('Message:', prompt)
    console.log('KantinId:', kantinId)
    
    const model = ai.getGenerativeModel({ 
      model: modelName,
      systemInstruction: SYSTEM_PROMPT
    });

    const firstRequest = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            { text: `${SYSTEM_PROMPT}\n\nUser: ${prompt}\n\nKantin ID: ${kantinId}` }
          ],
        },
      ],
      tools: [tools as any],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 800,
      },
    });

    const firstResponse = firstRequest.response;
    const parts = firstResponse.candidates?.[0]?.content?.parts || [];
    const toolCall = parts.find((p: any) => p.functionCall)?.functionCall;

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
                Number((args as any).maxBudget),
                (args as any).limit
              )
            } else {
              toolResult = await rpcGetMenuByBudgetGlobal(
                Number((args as any).maxBudget),
                (args as any).limit
              )
            }
            break

          case 'searchMenus':
            if (kantinId) {
              toolResult = await rpcSearchMenus(
                kantinId,
                (args as any).keywords || [],
                (args as any).limit
              )
            } else {
              toolResult = await rpcSearchMenusGlobal(
                (args as any).keywords || [],
                (args as any).limit
              )
            }
            break

          case 'getMenusByCategory':
            if (kantinId) {
              toolResult = await rpcGetMenusByCategory(
                kantinId,
                (args as any).category,
                (args as any).limit
              )
            } else {
              toolResult = await rpcGetMenusByCategoryGlobal(
                (args as any).category,
                (args as any).limit
              )
            }
            break

          case 'getCheapestMenus':
            if (kantinId) {
              toolResult = await rpcGetCheapestMenus(kantinId, (args as any).limit ?? 5)
            } else {
              toolResult = await rpcGetCheapestMenusGlobal((args as any).limit ?? 5)
            }
            break

          case 'getBestValueMenus':
            if (kantinId) {
              toolResult = await rpcGetBestValueMenus(kantinId, (args as any).limit ?? 5)
            } else {
              toolResult = await rpcGetBestValueMenusGlobal((args as any).limit ?? 5)
            }
            break

          case 'getPopularMenus':
            if (kantinId) {
              toolResult = await rpcGetPopularMenus(kantinId, (args as any).limit ?? 5)
            } else {
              toolResult = await rpcGetPopularMenusGlobal((args as any).limit ?? 5)
            }
            break

          case 'getNewMenus':
            if (kantinId) {
              toolResult = await rpcGetNewMenus(
                kantinId,
                (args as any).daysAgo ?? 30,
                (args as any).limit ?? 10
              )
            } else {
              toolResult = await rpcGetNewMenusGlobal(
                (args as any).daysAgo ?? 30,
                (args as any).limit ?? 10
              )
            }
            break

          case 'getMenuCombos':
            if (kantinId) {
              toolResult = await rpcGetMenuCombos(
                kantinId,
                Number((args as any).budget),
                (args as any).limit ?? 10
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
              toolResult = await rpcGetAllMenus(kantinId, (args as any).limit)
            } else {
              toolResult = await rpcGetAllMenusGlobal((args as any).limit)
            }
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
      
      // Wrap toolResult dalam object jika berupa array agar sesuai dengan format Gemini API
      const wrappedResult = Array.isArray(toolResult) 
        ? { data: toolResult } 
        : toolResult;
      
      const secondRequest = await model.generateContent({
        contents: [
          {
            role: 'user',
            parts: [
              { text: `${SYSTEM_PROMPT}\n\nUser: ${prompt}\n\nKantin ID: ${kantinId}` }
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
                  response: wrappedResult,
                }
              }
            ],
          },
        ],
        tools: [tools as any],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 900,
        },
      });

      const secondResponse = secondRequest.response;
      let text = secondResponse.text() || 'Maaf, tidak ada jawaban.';

      // Bersihkan markdown formatting
      text = cleanMarkdown(text);

      return {
        response: text,
        toolUsed: toolCall.name,
        menuData: toolResult,
      };
    }

    // STEP 4: Jika tidak ada tool call, ambil text response langsung
    console.log('No tool call, returning direct response')
    let text = firstResponse.text() || 'Maaf, tidak ada jawaban.'
    text = cleanMarkdown(text)

    return {
      response: text,
      toolUsed: null,
    };

  } catch (error: any) {
    console.error("Error generating content:", error);
    return {
      error: "Failed to generate content.",
      details: error.message
    };
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