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

    // Prepare context data for Gemini
    const menuContext = menus ? menus.map((menu: any) => {
      const kantin = kantins?.find((k: any) => k.id === menu.kantin_id)
      return `• ${menu.nama_menu} - Rp${menu.harga} - ${menu.deskripsi || 'Tidak ada deskripsi'} - Kantin: ${kantin?.nama_kantin || 'Unknown'} - Kategori: ${menu.kategori_menu || 'Tidak ada kategori'} - Terjual: ${menu.total_sold || 0}`
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

Contoh jawaban yang baik:
- "Untuk budget 20k, saya rekomendasikan Nasi Goreng Spesial cuma Rp15.000! Enak banget dan laku keras. Mau coba?"
- "Menu best seller kita adalah Ayam Bakar Madu, sudah terjual 150+ kali! Dagingnya empuk banget.
- "Kalau cari yang termurah, ada Es Teh Manis cuma Rp3.000. Segar dan murah!"`

    const requestBody = {
      contents: [{
        parts: [{
          text: `${systemPrompt}\n\nUser: ${message}\n\nAssistant:`
        }]
      }],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024,
      }
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${process.env.NEXT_PUBLIC_GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      }
    )

    if (!response.ok) {
      const errorData = await response.text()
      console.error('Gemini API Error:', errorData)
      throw new Error('Failed to get response from Gemini')
    }

    const data = await response.json()
    const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text

    if (!aiResponse) {
      throw new Error('No response from Gemini')
    }

    return NextResponse.json({
      response: aiResponse.trim()
    })

  } catch (error) {
    console.error('Gemini API Error:', error)
    return NextResponse.json(
      { error: 'Maaf, saya sedang mengalami masalah. Silakan coba lagi nanti ya!' },
      { status: 500 }
    )
  }
}