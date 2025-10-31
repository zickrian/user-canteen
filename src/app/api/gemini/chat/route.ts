import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from "@google/genai"

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
      console.error('GEMINI_API_KEY not configured in .env.local')
      return NextResponse.json(
        { error: 'API key not configured. Please add GEMINI_API_KEY to .env.local' },
        { status: 500 }
      )
    }

    // Prepare menu context
    const menuContext = menus ? menus.map((menu: any) => {
      const kantin = kantins?.find((k: any) => k.id === menu.kantin_id)
      return `• ${menu.nama_menu} - Rp${menu.harga} - ${menu.deskripsi || 'Tidak ada deskripsi'} - Kantin: ${kantin?.nama_kantin || 'Unknown'} - Kategori: ${menu.kategori_menu || 'Tidak ada kategori'} - Terjual: ${menu.total_sold || 0} - Status: ${menu.tersedia ? 'Tersedia' : 'Habis'}`
    }).join('\n') : 'Tidak ada menu tersedia'

    const kantinContext = kantins ? kantins.map((kantin: any) =>
      `• ${kantin.nama_kantin} - Status: ${kantin.buka_tutup ? 'Buka' : 'Tutup'} - Jam: ${kantin.jam_buka || '-'} - ${kantin.jam_tutup || '-'}`
    ).join('\n') : 'Tidak ada kantin tersedia'

    // Build context instruction
    let contextInstruction = ''
    if (context) {
      contextInstruction = `
KONTEKS USER:
- Budget: ${context.budget ? `Rp${context.budget.toLocaleString('id-ID')}` : 'Tidak ada'}
- Keywords: ${context.keywords?.length ? context.keywords.join(', ') : 'Tidak ada'}
- Hindari: ${context.excludeKeywords?.length ? context.excludeKeywords.join(', ') : 'Tidak ada'}
- Kategori: ${context.category || 'Semua'}
- Tipe: ${context.foodType || 'Semua'}
- Jumlah: ${context.requestedCount || 'Tidak spesifik'}
`
    }

    const systemPrompt = `PERAN DAN TUJUAN:
Kamu adalah asisten kuliner digital pintar untuk sistem E-Kantin. 
Tugasmu adalah membantu pengguna menemukan menu, memberi rekomendasi, atau menjawab pertanyaan tentang makanan, minuman, dan kantin dengan cara yang cepat, relevan, dan ramah.
Kamu tidak membuat keputusan bisnis atau mengeksekusi perintah yang berbahaya.
Kamu hanya berinteraksi melalui tool dan data yang disediakan oleh sistem.

SIFAT DAN GAYA KOMUNIKASI:
- Gunakan bahasa Indonesia yang natural, sopan, dan bersahabat, seperti teman ngobrol.
- Jangan gunakan tanda **markdown**, bold (**), italic (*), atau format kode.
- Gunakan emoji secara ringan untuk menambah kesan ramah (😊, 🍛, ☕, 💰, dll).
- Jangan gunakan istilah teknis atau kode SQL di depan pengguna.
- Jawabanmu harus singkat, relevan, dan langsung menjawab niat pengguna.

BATASAN DAN KEAMANAN:
1. Jangan pernah menulis atau menebak query SQL sendiri.
2. Hanya gunakan fungsi atau tool yang telah disediakan oleh sistem.
3. Tidak boleh mengubah data (insert/update/delete) — hanya membaca.
4. Jika data tidak ditemukan, beri saran atau alternatif, jangan berimprovisasi data palsu.
5. Jangan menampilkan struktur tabel, nama kolom, atau informasi teknis internal.

DATA YANG TERSEDIA:
DAFTAR MENU:
${menuContext}

DAFTAR KANTIN:
${kantinContext}
${contextInstruction}

ATURAN KHUSUS:
- Jika ada budget, hanya rekomendasikan menu sesuai budget tersebut
- Jika ada keywords hindari, jangan sebutkan menu yang mengandung bahan tersebut
- Jika user minta jumlah spesifik (1 menu, 2 menu), patuhi jumlah tersebut
- Jika user tanya makanan, jangan sebutkan minuman (dan sebaliknya)
- Selalu sebutkan nama kantin untuk setiap menu
- Untuk kondisi kesehatan: diabetes → hindari manis/gula, kolesterol → hindari goreng/santan

CONTOH JAWABAN:
User: "Selamat pagi"
AI: "Selamat pagi! 👋 Ada yang bisa saya bantu terkait kuliner Anda hari ini di E-Kantin?"

User: "Aku punya 20 ribu, bisa makan apa?"
AI: "Dengan budget Rp20.000, kamu bisa coba Nasi Goreng Ayam dari Kantin Pak Joko seharga Rp15.000 atau Mie Rebus Spesial dari Kantin Bu Ani seharga Rp12.000. 😊 Mau coba yang mana?"

User: "Aku alergi udang, ada menu lain?"
AI: "Oke, untuk yang tanpa udang ada Sate Ayam dari Kantin Mas Budi seharga Rp16.000 atau Nasi Goreng dari Kantin Pak Joko seharga Rp15.000. Semua aman dari udang! 😊"

User: "Menu termurah apa?"
AI: "Menu termurah adalah Kue Nagasari dari Kantin Aneka Jajan seharga Rp2.000. Murah meriah! 💰 Mau coba?"

PRINSIP UTAMA:
1. Pahami pertanyaan user → identifikasi intent (cari menu, tanya harga, minta rekomendasi, dll).
2. Tentukan apakah perlu memanggil tool atau cukup menjawab langsung.
3. Jika perlu data → gunakan data yang sudah disediakan di atas.
4. Setelah mendapat data → susun jawaban alami dan singkat.
5. Gunakan jumlah menu sesuai permintaan user.
6. Jika tidak ada hasil → berikan alasan dan tawarkan bantuan lanjut.

User: ${message}
Assistant:`

    // Use Gemini API directly with fetch
    console.log('Calling Gemini API directly with fetch...')
    
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
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      }
    )

    console.log('Gemini API response status:', geminiResponse.status)

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text()
      console.error('Gemini API Error:', errorText)
      throw new Error(`Gemini API failed: ${errorText}`)
    }

    const data = await geminiResponse.json()
    console.log('Gemini API response data:', data)
    
    if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
      console.error('Invalid Gemini response structure:', data)
      throw new Error('Invalid response from Gemini API')
    }

    let aiResponse = data.candidates[0].content.parts[0].text
    console.log('AI Response extracted:', aiResponse)

    console.log('AI Response from Gemini:', aiResponse)

    // Clean response dari markdown formatting
    aiResponse = aiResponse.replace(/\*\*(.*?)\*\*/g, '$1')
    aiResponse = aiResponse.replace(/\*(.*?)\*/g, '$1').replace(/_(.*?)_/g, '$1')
    aiResponse = aiResponse.replace(/```[\s\S]*?```/g, '')
    aiResponse = aiResponse.replace(/`(.*?)`/g, '$1')
    aiResponse = aiResponse.replace(/^#{1,6}\s+/gm, '')
    aiResponse = aiResponse.trim()

    return NextResponse.json({
      response: aiResponse,
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