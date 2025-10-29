import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { message, menus, kantins } = await request.json()

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

    const systemPrompt = `Kamu adalah AI Assistant untuk aplikasi E-Kantin. Kamu harus ramah, membantu, dan berbicara seperti pelayan yang profesional.

Context Data:
DAFTAR MENU:
${menuContext}

DAFTAR KANTIN:
${kantinContext}

Aturan:
1. Jawab dengan bahasa Indonesia yang ramah dan natural
2. Jika ditanya tentang menu, berikan rekomendasi berdasarkan data yang ada
3. Jika ditanya budget, cari menu yang sesuai dengan budget tersebut
4. Jika ditanya "best seller" atau "populer", berdasarkan total_sold
5. Jika ditanya "termurah", berdasarkan harga terendah
6. Jika tidak ada menu yang cocok, berikan alternatif atau saran
7. Selalu akhiri dengan tawaran bantuan tambahan
8. Jangan terlalu formal, gunakan bahasa sehari-hari yang sopan
9. Hanya rekomendasikan menu yang tersedia (status: Tersedia)

Contoh jawaban yang baik:
- "Untuk budget 20k, saya rekomendasikan Nasi Goreng Spesial cuma Rp15.000! Enak banget dan laku keras. Mau coba?"
- "Menu best seller kita adalah Ayam Bakar Madu, sudah terjual 150+ kali! Dagingnya empuk banget."
- "Kalau cari yang termurah, ada Es Teh Manis cuma Rp3.000. Segar dan murah!"

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