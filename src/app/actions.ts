'use server'; // Marks all functions in this file as server actions

import { GoogleGenAI, FunctionCallingConfigMode } from '@google/genai';
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
  // Kantin info functions
  rpcGetKantinInfo,
  rpcGetAllKantins,
  rpcSearchKantins,
  // Category functions
  rpcGetMakananByCategory,
  rpcGetMinumanByCategory,
  rpcGetBestMealCombo,
  rpcGetRecommendationsByTime,
  rpcGetFallbackMenus,
  rpcGetMenusUnder10k,
  rpcGetHealthyMenus,
  // New tools for database-only responses
  rpcFindMenuByName,
  rpcSearchMenu,
  rpcRecommendMenu,
  rpcRecommendBundle,
  rpcQueryMenuDirect,
} from '@/lib/aiTools';

export async function generateContent(prompt: string, kantinId: string) {
  try {
    // Validasi API key terlebih dahulu
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.trim() === '') {
      console.error('GEMINI_API_KEY not configured in environment variables');
      return {
        error: 'API key tidak dikonfigurasi. Pastikan GEMINI_API_KEY ada di file .env.local',
        details: 'Silakan tambahkan GEMINI_API_KEY di file .env.local'
      };
    }

    // Validasi format API key (Google Gemini API key biasanya dimulai dengan AIzaSy)
    if (!apiKey.startsWith('AIzaSy') && !apiKey.startsWith('gen-')) {
      console.warn('API key format mungkin tidak valid. Google Gemini API key biasanya dimulai dengan AIzaSy');
    }

    // Initialize the client dengan API key yang sudah divalidasi
    const ai = new GoogleGenAI({ apiKey });

    // Decide the model here: using gemini-2.5-flash as a good starting point
    const modelName = 'gemini-2.5-flash';

    // STEP 1: Kirim pesan ke Gemini untuk merencanakan tool usage
    console.log('Step 1: Planning with Gemini...');
    console.log('Message:', prompt)
    console.log('KantinId:', kantinId)
    
    const firstRequest = await ai.models.generateContent({
      model: modelName,
      contents: `${SYSTEM_PROMPT}\n\nUser: ${prompt}\n\nKantin ID: ${kantinId || 'global'}`,
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
    });

    const firstResponse = firstRequest;
    const toolCall = firstResponse.functionCalls?.[0];

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

          // New tools for database-only responses
          case 'queryMenuDirect':
            if (kantinId) {
              toolResult = await rpcQueryMenuDirect(
                kantinId,
                (args as any).jenis && ['makanan', 'minuman', 'semua'].includes((args as any).jenis)
                  ? (args as any).jenis as 'makanan' | 'minuman' | 'semua'
                  : 'semua',
                (args as any).sortBy && ['harga_asc', 'harga_desc', 'popularitas', 'terbaru'].includes((args as any).sortBy)
                  ? (args as any).sortBy as 'harga_asc' | 'harga_desc' | 'popularitas' | 'terbaru'
                  : 'harga_asc',
                (args as any).maxPrice,
                (args as any).minPrice,
                (args as any).tersedia !== false,
                (args as any).limit || 1
              )
            } else {
              toolResult = { error: 'queryMenuDirect memerlukan kantinId' }
            }
            break

          case 'findMenuByName':
            if (kantinId) {
              toolResult = await rpcFindMenuByName(
                kantinId,
                (args as any).menuName || '',
                (args as any).limit || 5
              )
            } else {
              toolResult = { error: 'findMenuByName memerlukan kantinId' }
            }
            break

          case 'searchMenu':
            if (kantinId) {
              toolResult = await rpcSearchMenu(
                kantinId,
                (args as any).q,
                (args as any).kategori,
                (args as any).maxPrice,
                (args as any).tersedia !== false,
                (args as any).limit || 10
              )
            } else {
              toolResult = { error: 'searchMenu memerlukan kantinId' }
            }
            break

          case 'recommendMenu':
            if (kantinId) {
              toolResult = await rpcRecommendMenu(
                kantinId,
                Number((args as any).maxPrice),
                (args as any).kategori,
                (args as any).tersedia !== false,
                (args as any).limit || 5
              )
            } else {
              toolResult = { error: 'recommendMenu memerlukan kantinId' }
            }
            break

          case 'recommendBundle':
            if (kantinId) {
              toolResult = await rpcRecommendBundle(
                kantinId,
                Number((args as any).budget),
                (args as any).kategori,
                (args as any).tersedia !== false,
                (args as any).limit || 3
              )
            } else {
              toolResult = { error: 'recommendBundle memerlukan kantinId' }
            }
            break

          // Kantin info functions
          case 'getKantinInfo':
            const targetKantinId = (args as any).kantinId || kantinId
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
            toolResult = await rpcSearchKantins((args as any).keywords || [])
            break

          // Category functions
          case 'getMakananByCategory':
            toolResult = await rpcGetMakananByCategory(
              (args as any).category,
              (args as any).limit
            )
            break

          case 'getMinumanByCategory':
            toolResult = await rpcGetMinumanByCategory((args as any).limit)
            break

          case 'getHealthyMenus':
            toolResult = await rpcGetHealthyMenus(
              (args as any).keywords || [],
              (args as any).limit
            )
            break

          case 'getBestMealCombo':
            toolResult = await rpcGetBestMealCombo(
              Number((args as any).budget),
              (args as any).timeOfDay,
              (args as any).limit ?? 3
            )
            break

          case 'getRecommendationsByTime':
            toolResult = await rpcGetRecommendationsByTime(
              (args as any).timeOfDay,
              (args as any).limit
            )
            break

          case 'getFallbackMenus':
            toolResult = await rpcGetFallbackMenus(
              kantinId,
              (args as any).limit
            )
            break

          case 'getMenusUnder10k':
            toolResult = await rpcGetMenusUnder10k(
              (args as any).limit
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
      
      // Wrap toolResult dalam object jika berupa array agar sesuai dengan format Gemini API
      const wrappedResult = Array.isArray(toolResult) 
        ? { data: toolResult } 
        : toolResult;
      
      // Cek apakah tool result ada data
      const hasData = Array.isArray(toolResult) ? toolResult.length > 0 : (toolResult && typeof toolResult === 'object' && !toolResult.error)
      const dataInstruction = hasData 
        ? '\n\nPENTING: Tool telah mengembalikan data. Data TIDAK kosong. LANGSUNG jawab dengan data tersebut sesuai pertanyaan user. JANGAN bilang "tidak ada jawaban" atau "maaf tidak ada jawaban" karena ada data. Gunakan data tersebut untuk menjawab pertanyaan user dengan tepat.'
        : '\n\nPENTING: Tool mengembalikan data kosong atau tidak ada data. Katakan "tidak ada" atau "belum ada menu yang sesuai" dengan sopan.'
      
      const secondRequest = await ai.models.generateContent({
        model: modelName,
        contents: [
          {
            role: 'user',
            parts: [
              { text: `${SYSTEM_PROMPT}\n\nUser: ${prompt}\n\nKantin ID: ${kantinId || 'global'}${dataInstruction}` }
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
      });

      const secondResponse = secondRequest;
      let text = secondResponse.text || 'Maaf, tidak ada jawaban.';

      // Bersihkan markdown formatting
      text = cleanMarkdown(text);

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

      return {
        response: text,
        toolUsed: toolCall.name,
        menuData: finalMenuData,
      };
    }

    // STEP 4: Jika tidak ada tool call, cek apakah ini pertanyaan tentang menu
    console.log('No tool call, checking if menu-related question...')
    
    // Deteksi pertanyaan tentang menu
    const menuKeywords = ['menu', 'makanan', 'minuman', 'makan', 'minum', 'sarapan', 'makan siang', 'makan malam', 'jajanan', 'snack', 'dessert', 'jus', 'teh', 'kopi', 'segari', 'enak', 'murah', 'mahal', 'budget', 'harga', 'rekomendasi', 'pilihan', 'ada apa', 'tersedia'];
    const isMenuRelated = menuKeywords.some(keyword => 
      prompt.toLowerCase().includes(keyword.toLowerCase())
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
        
        return {
          response: text + '\n\nBerikut beberapa menu yang mungkin kamu suka:',
          toolUsed: 'fallback-popular',
          menuData: fallbackData,
        };
      } catch (fallbackError) {
        console.error('Fallback failed:', fallbackError);
      }
    }

    // Jika bukan pertanyaan menu, kembalikan response langsung
    let text = firstResponse.text || 'Maaf, tidak ada jawaban.'
    text = cleanMarkdown(text)

    return {
      response: text,
      toolUsed: null,
    };

  } catch (error: any) {
    console.error("Error generating content:", error);
    
    // Handle API key errors specifically
    if (error?.message?.includes('API key') || error?.code === 400) {
      return {
        error: "API key tidak valid atau tidak dikonfigurasi.",
        details: "Pastikan GEMINI_API_KEY ada di file .env.local dan valid. Dapatkan API key di https://aistudio.google.com/apikey"
      };
    }
    
    return {
      error: "Failed to generate content.",
      details: error.message || 'Unknown error'
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