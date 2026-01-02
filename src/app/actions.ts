'use server'; // Marks all functions in this file as server actions

import { GoogleGenAI, FunctionCallingConfigMode } from '@google/genai';
import { tools } from '@/lib/geminiTools';
import { SYSTEM_PROMPT } from '@/lib/systemPrompt';
import { connectSupabaseMcp, pickSqlTool } from '@/lib/mcp';
import { runFunctionByName, runFunctionWithFallback } from '@/lib/mcpFunctions';

export async function generateContent(prompt: string, kantinId: string) {
  let mcp: any = null;
  let sqlToolName: string | null = null;
  let useFallback = false;

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

    // Decide the model here: using gemini-2.5-flash-lite as a good starting point
    const modelName = 'gemini-2.5-flash-lite';

    // Try to connect to MCP server, fallback to direct DB if fails
    console.log('Connecting to MCP server...');
    try {
      mcp = await connectSupabaseMcp();
      sqlToolName = await pickSqlTool(mcp);
      console.log('MCP connected, SQL tool:', sqlToolName);
    } catch (mcpError: any) {
      console.warn('MCP connection failed, using direct database fallback:', mcpError.message);
      useFallback = true;
    }

    // STEP 1: Kirim pesan ke Gemini untuk merencanakan tool usage
    console.log('Step 1: Planning with Gemini...');
    console.log('Message:', prompt);
    console.log('KantinId:', kantinId);
    
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
      console.log('Step 2: Executing tool:', toolCall.name);
      console.log('Tool args:', toolCall.args);

      const args = toolCall.args || {};
      
      // Inject kantinId dari context jika tidak ada di args tapi ada di parameter
      if (kantinId && !args.kantin_id) {
        args.kantin_id = kantinId;
      }

      let toolResult: any = null;

      try {
        console.log('Executing tool with kantinId:', args.kantin_id || kantinId);
        
        if (useFallback || !mcp || !sqlToolName) {
          // Use direct database fallback
          console.log('Using direct database fallback...');
          toolResult = await runFunctionWithFallback({
            name: toolCall.name,
            args,
          });
        } else {
          // Eksekusi tool menggunakan MCP
          toolResult = await runFunctionByName({
            mcp,
            sqlToolName: sqlToolName!,
            name: toolCall.name,
            args,
          });
        }

        console.log('Tool result:', JSON.stringify(toolResult, null, 2));
      } catch (toolError: any) {
        console.error('Tool execution error:', toolError);
        console.error('Error details:', toolError.message);
        console.error('Error stack:', toolError.stack);
        
        // Try fallback if MCP failed
        if (!useFallback) {
          console.log('Retrying with direct database fallback...');
          try {
            toolResult = await runFunctionWithFallback({
              name: toolCall.name,
              args,
            });
            console.log('Fallback result:', JSON.stringify(toolResult, null, 2));
          } catch (fallbackError: any) {
            console.error('Fallback also failed:', fallbackError.message);
            toolResult = [];
          }
        } else {
          toolResult = [];
        }
      }

      // STEP 3: Kirim hasil tool ke Gemini untuk generate jawaban final
      console.log('Step 3: Generating final response...');
      
      // Normalize tool result untuk response
      let normalizedResult = toolResult;
      if (toolResult?.bundles) {
        // Untuk recommend_bundle, extract menu data
        normalizedResult = toolResult.bundles.map((b: any) => ({
          makanan: b.makanan,
          minuman: b.minuman,
          total: b.total,
        }));
      } else if (!Array.isArray(toolResult)) {
        // Jika bukan array, wrap dalam array
        normalizedResult = [toolResult];
      }
      
      // Cek apakah tool result ada data
      const hasData = Array.isArray(normalizedResult) 
        ? normalizedResult.length > 0 
        : (normalizedResult && typeof normalizedResult === 'object' && !normalizedResult.error);
      
      const dataInstruction = hasData 
        ? '\n\nPENTING: Tool telah mengembalikan data. Data TIDAK kosong. LANGSUNG jawab dengan data tersebut sesuai pertanyaan user. JANGAN bilang "tidak ada jawaban" atau "maaf tidak ada jawaban" karena ada data. Gunakan data tersebut untuk menjawab pertanyaan user dengan tepat.'
        : '\n\nPENTING: Tool mengembalikan data kosong atau tidak ada data. Katakan "tidak ada" atau "belum ada menu yang sesuai" dengan sopan.';
      
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
            role: 'user',
            parts: [
              {
                functionResponse: {
                  name: toolCall.name,
                  response: { result: toolResult },
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

      return {
        response: text,
        toolUsed: toolCall.name,
        menuData: normalizedResult,
      };
    }

    // STEP 4: Jika tidak ada tool call, kembalikan response langsung
    console.log('No tool call, returning direct response');
    let text = firstResponse.text || 'Maaf, tidak ada jawaban.';
    text = cleanMarkdown(text);

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
  } finally {
    // Cleanup MCP connection
    if (mcp) {
      try {
        await mcp.close();
        console.log('MCP connection closed');
      } catch (closeError) {
        console.error('Error closing MCP connection:', closeError);
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
