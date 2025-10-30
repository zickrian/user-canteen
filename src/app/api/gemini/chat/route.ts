import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { message, menus, kantins, context } = await request.json()

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

    // Prepare context data for AI
    const menuContext = menus ? menus.map((menu: any) => {
      const kantin = kantins?.find((k: any) => k.id === menu.kantin_id)
      return `• ${menu.nama_menu} - Rp${menu.harga} - ${menu.deskripsi || 'Tidak ada deskripsi'} - Kantin: ${kantin?.nama_kantin || 'Unknown'} - Kategori: ${menu.kategori_menu || 'Tidak ada kategori'} - Terjual: ${menu.total_sold || 0} - Status: ${menu.tersedia ? 'Tersedia' : 'Habis'}`
    }).join('\n') : 'Tidak ada menu tersedia'

    const kantinContext = kantins ? kantins.map((kantin: any) =>
      `• ${kantin.nama_kantin} - Status: ${kantin.buka_tutup ? 'Buka' : 'Tutup'} - Jam: ${kantin.jam_buka || '-'} - ${kantin.jam_tutup || '-'}`
    ).join('\n') : 'Tidak ada kantin tersedia'

    // Build enhanced system prompt with context understanding
    let contextInstruction = ''
    if (context) {
      contextInstruction = `\n\nINFORMASI KONTEKS QUERY:
- Budget: ${context.budget ? `Rp${context.budget.toLocaleString('id-ID')}` : 'Tidak disebutkan'}
- Keywords: ${context.keywords?.length ? context.keywords.join(', ') : 'Tidak ada'}
- Exclude (Alergi): ${context.excludeKeywords?.length ? context.excludeKeywords.join(', ') : 'Tidak ada'}
- Kategori: ${context.category || 'Semua'}
- Tipe: ${context.foodType || 'Semua'}
- Query Type: ${context.queryType || 'general'}
- Specific Kantins: ${context.specificKantins?.length ? context.specificKantins.join(', ') : 'Tidak disebutkan'}
- Multi-Kantin: ${context.multiKantin ? 'Ya, tampilkan dari berbagai kantin' : 'Tidak, hanya kantin tertentu'}

Gunakan informasi konteks ini untuk memberikan rekomendasi yang lebih tepat!`
    }

    const systemPrompt = `Kamu adalah AI Assistant untuk aplikasi E-Kantin. Kamu harus ramah, membantu, dan berbicara seperti pelayan yang profesional.

Context Data:
DAFTAR MENU:
${menuContext}

DAFTAR KANTIN:
${kantinContext}
${contextInstruction}

Aturan PENTING:
1. Jawab dengan bahasa Indonesia yang ramah dan natural
2. Jika user meminta menu dari BERBAGAI KANTIN (multi-kantin), SEBUTKAN menu dari berbagai kantin yang berbeda agar user punya pilihan
3. Jika user menyebutkan BUDGET tertentu, HANYA sebutkan menu yang harganya sesuai atau di bawah budget tersebut
4. Jika user menyebutkan KEYWORD tertentu, sebutkan menu dari berbagai kantin yang sesuai dengan keyword tersebut
5. Jika user menyebutkan "MAKANAN TERMAHAL", sebutkan menu termahal dari berbagai kantin (bisa berbeda kantin)
6. Jika user menyebutkan "MAKANAN PALING SERING DIBELI" atau "best seller", sebutkan menu dengan total_sold tertinggi dari berbagai kantin
7. Jika user menyebutkan "ALERGI" atau "tidak bisa makan" sesuatu, JANGAN PERNAH sebutkan menu yang mengandung bahan tersebut
8. Jika user menanyakan "MAKANAN", JANGAN sebutkan minuman
9. Jika user menanyakan "MINUMAN", JANGAN sebutkan makanan
10. Jika user menyebutkan kantin spesifik, fokuskan rekomendasi dari kantin tersebut
11. Jika user TIDAK menyebutkan kantin spesifik, berikan rekomendasi dari BERBAGAI KANTIN yang berbeda
12. Selalu SEBUTKAN NAMA KANTIN ketika merekomendasikan menu (contoh: "Nasi Goreng dari Kantin Sate Ayam")
13. Jika tidak ada menu yang cocok dengan kriteria, berikan alternatif atau saran
14. Selalu akhiri dengan tawaran bantuan tambahan
15. Gunakan bahasa sehari-hari yang sopan dan ramah

Contoh jawaban yang baik (multi-kantin):
- "Untuk budget 10 ribu, saya rekomendasikan Klepon dari Kantin Sate Ayam Betawi seharga 5 ribu, atau Jus Apel dari Kantin Aneka Jus Segar seharga 5 ribu. Keduanya dari kantin berbeda dan enak banget! Bagaimana, tertarik mencoba salah satunya?"
- "Menu termahal dari berbagai kantin: Ayam Bakar Premium dari Kantin Sate Ayam Betawi seharga Rp25.000, dan Rendang Spesial dari Kantin Nasi Padang seharga Rp30.000. Yang mana yang kamu mau?"
- "Menu paling sering dibeli dari berbagai kantin: Nasi Goreng Spesial dari Kantin A sudah terjual 250+ kali, dan Ayam Bakar Madu dari Kantin B sudah terjual 180+ kali!"

IMPORTANT: 
- Jika user TIDAK menyebutkan kantin spesifik, SELALU sebutkan menu dari BERBAGAI KANTIN yang berbeda!
- Jika user menyebutkan budget, JANGAN sebutkan menu yang harganya melebihi budget tersebut!
- Jika user menyebutkan alergi, JANGAN sebutkan menu yang mengandung bahan alergen tersebut!
- SELALU SEBUTKAN NAMA KANTIN ketika merekomendasikan menu!

User: ${message}
Assistant:`

    // Use Gemini API directly
    const requestBody = {
      contents: [{
        parts: [{
          text: systemPrompt
        }]
      }],
      generationConfig: {
        temperature: 0.7,
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

    const aiResponse = data.candidates[0].content.parts[0].text

    console.log('AI Response from Gemini:', aiResponse)

    return NextResponse.json({
      response: aiResponse.trim(),
      api: 'Gemini'
    })

  } catch (error) {
    console.error('AI API Error:', error)
    return NextResponse.json(
      { error: 'Maaf, saya sedang mengalami masalah koneksi ke AI. Silakan coba lagi nanti ya!' },
      { status: 500 }
    )
  }
}