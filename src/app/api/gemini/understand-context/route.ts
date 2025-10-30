import { NextRequest, NextResponse } from 'next/server'

/**
 * API endpoint untuk memahami konteks query user menggunakan LLM
 * Mengembalikan structured data yang bisa digunakan untuk filtering menu
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
      console.error('GEMINI_API_KEY not configured')
      return NextResponse.json(
        { error: 'API key not configured' },
        { status: 500 }
      )
    }

    const systemPrompt = `Kamu adalah AI yang membantu memahami konteks query user untuk aplikasi E-Kantin.
Tugas kamu adalah menganalisis query user dan mengembalikan JSON dengan struktur berikut:

{
  "budget": number | null,  // Budget dalam rupiah (jika disebutkan)
  "keywords": string[],      // Kata kunci untuk mencari menu (contoh: ["ayam", "goreng"])
  "excludeKeywords": string[], // Kata kunci yang harus dihindari (contoh: ["udang"] untuk alergi)
  "category": string | null,  // Kategori: "makan pagi", "makan siang", "snack", "minuman"
  "foodType": "makanan" | "minuman" | null, // Tipe: makanan atau minuman
  "queryType": "best_seller" | "cheapest" | "most_expensive" | "recommendation" | "search" | "top_kantin" | "general",
  "sortBy": "price_asc" | "price_desc" | "popularity" | "rating",
  "specificKantins": string[] | null, // Nama kantin spesifik yang disebutkan (jika ada)
  "multiKantin": boolean  // Apakah user ingin melihat menu dari berbagai kantin
}

Aturan penting:
1. Jika user menyebutkan budget (misal: "10k", "10 ribu", "budget 10 ribu"), extract sebagai number
2. Jika user menyebutkan alergi atau tidak bisa makan sesuatu, masukkan ke excludeKeywords
3. Jika user menanyakan "makanan", set foodType ke "makanan"
4. Jika user menanyakan "minuman", set foodType ke "minuman"
5. Jika user menyebutkan nama kantin spesifik, masukkan ke specificKantins
6. Jika query tidak menyebutkan kantin spesifik, set multiKantin ke true (untuk mencari dari semua kantin)
7. Query type:
   - "best_seller" atau "paling sering dibeli" → best_seller, sortBy: popularity
   - "termurah" atau "murah" → cheapest, sortBy: price_asc
   - "termahal" atau "paling mahal" → most_expensive, sortBy: price_desc
   - "rating tertinggi" atau "kantin terbaik" → top_kantin, sortBy: rating
   - "rekomendasi" atau "enak" → recommendation, sortBy: popularity
   - Lainnya → search, sortBy: popularity

Contoh query dan response:

Query: "Saya punya budget 10 ribu, cari makanan dari semua kantin"
Response: {
  "budget": 10000,
  "keywords": [],
  "excludeKeywords": [],
  "category": null,
  "foodType": "makanan",
  "queryType": "search",
  "sortBy": "popularity",
  "specificKantins": null,
  "multiKantin": true
}

Query: "Saya alergi udang, rekomendasi makanan dari kantin sate ayam"
Response: {
  "budget": null,
  "keywords": [],
  "excludeKeywords": ["udang"],
  "category": null,
  "foodType": "makanan",
  "queryType": "recommendation",
  "sortBy": "popularity",
  "specificKantins": ["sate ayam"],
  "multiKantin": false
}

Query: "Menu termahal apa saja?"
Response: {
  "budget": null,
  "keywords": [],
  "excludeKeywords": [],
  "category": null,
  "foodType": null,
  "queryType": "most_expensive",
  "sortBy": "price_desc",
  "specificKantins": null,
  "multiKantin": true
}

Query: "Minuman dari kantin aneka jus"
Response: {
  "budget": null,
  "keywords": [],
  "excludeKeywords": [],
  "category": null,
  "foodType": "minuman",
  "queryType": "search",
  "sortBy": "popularity",
  "specificKantins": ["aneka jus"],
  "multiKantin": false
}

HANYA kembalikan JSON, tanpa teks tambahan apapun. Tidak perlu penjelasan, cukup JSON saja.

User query: ${message}
JSON:`

    const requestBody = {
      contents: [{
        parts: [{
          text: systemPrompt
        }]
      }],
      generationConfig: {
        temperature: 0.1, // Lower temperature for more consistent JSON output
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024,
      }
    }

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      }
    )

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text()
      console.error('Gemini API Error:', errorText)
      throw new Error(`Gemini API failed: ${errorText}`)
    }

    const data = await geminiResponse.json()
    
    if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
      console.error('Invalid Gemini response structure:', data)
      throw new Error('Invalid response from Gemini API')
    }

    let aiResponse = data.candidates[0].content.parts[0].text.trim()
    
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
          multiKantin: true
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
          multiKantin: true
        },
        error: 'Failed to understand context, using fallback'
      },
      { status: 200 } // Return 200 with fallback context instead of error
    )
  }
}

