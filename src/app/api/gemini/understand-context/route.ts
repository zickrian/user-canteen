import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from "@google/genai"

/**
 * API endpoint untuk memahami konteks query user
 */
export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json()

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    const apiKey = process.env.GEMINI_API_KEY
    
    if (!apiKey) {
      console.error('GEMINI_API_KEY not configured in .env.local')
      return NextResponse.json(
        { error: 'API key not configured. Please add GEMINI_API_KEY to .env.local' },
        { status: 500 }
      )
    }

    const systemPrompt = `Anda adalah analis konteks untuk E-Kantin. Analisis query user dan kembalikan JSON sesuai format:

{
  "budget": number | null,
  "keywords": string[],
  "excludeKeywords": string[],
  "category": "sarapan" | "makan siang" | "snack" | "minuman" | null,
  "foodType": "makanan" | "minuman" | null,
  "queryType": "general" | "cheapest" | "search" | "recommendation",
  "sortBy": "popularity" | "price_asc" | "price_desc" | "rating",
  "specificKantins": string[] | null,
  "multiKantin": boolean,
  "requestedCount": number | null
}

ATURAN:
- Budget: "20k", "20rb", "20 ribu" → 20000
- "murah", "termurah" → queryType: "cheapest", sortBy: "price_asc"
- "rekomendasi", "enak" → queryType: "recommendation"
- "makanan" → foodType: "makanan", "minuman" → foodType: "minuman"
- "alergi X", "jangan X" → excludeKeywords: ["X"]
- "diabetes" → excludeKeywords: ["manis", "gula"]
- "kolesterol" → excludeKeywords: ["goreng", "santan"]
- "1 saja", "2 menu" → requestedCount: 1/2
- Default: multiKantin: true, sortBy: "popularity"

HANYA kembalikan JSON, tanpa penjelasan.

Query: ${message}
JSON:`

    // Use Gemini API with @google/genai library
    console.log('Initializing GoogleGenAI for context understanding...')
    const ai = new GoogleGenAI({ apiKey: apiKey })

    console.log('Calling Gemini API for context understanding...')
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: systemPrompt,
    })

    console.log('Gemini context response received:', response)

    if (!response.text) {
      console.error('Invalid Gemini response structure:', response)
      throw new Error('Invalid response from Gemini API')
    }

    let aiResponse = response.text.trim()
    console.log('Context AI Response extracted:', aiResponse)
    
    // Clean up response (remove markdown code blocks if present)
    aiResponse = aiResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    
    try {
      const context = JSON.parse(aiResponse)
      
      console.log('Understanding context:', context)
      
      return NextResponse.json({
        context,
        api: 'Gemini'
      })
    } catch (parseError) {
      console.error('Failed to parse JSON:', aiResponse)
      // Fallback: return basic context
      return NextResponse.json({
        context: {
          budget: null,
          keywords: [],
          excludeKeywords: [],
          category: null,
          foodType: null,
          queryType: 'general',
          sortBy: 'popularity',
          specificKantins: null,
          multiKantin: true,
          requestedCount: null
        },
        api: 'Gemini',
        error: 'Failed to parse structured response, using fallback'
      })
    }

  } catch (error) {
    console.error('Context Understanding API Error:', error)
    return NextResponse.json(
      { 
        context: {
          budget: null,
          keywords: [],
          excludeKeywords: [],
          category: null,
          foodType: null,
          queryType: 'general',
          sortBy: 'popularity',
          specificKantins: null,
          multiKantin: true,
          requestedCount: null
        },
        error: 'Failed to understand context, using fallback'
      },
      { status: 200 } // Return 200 with fallback context instead of error
    )
  }
}
