# 📋 SUMMARY: AI Assistant Context Understanding & Multi-Kantin Support

## 🎯 Tujuan Perbaikan

1. **AI Assistant bisa memahami konteks query dengan lebih baik** menggunakan LLM
2. **Mendukung multi-kantin queries** - bisa menyebutkan makanan dari berbagai kios/kantin
3. **Meningkatkan akurasi filtering** berdasarkan konteks yang dipahami

## 🏗️ Arsitektur Baru

### Flow Baru:
```
User Query 
  ↓
LLM Context Understanding API (/api/gemini/understand-context)
  ↓
Structured Context (JSON)
  ↓
Filter Menu berdasarkan Context
  ↓
Generate AI Response (/api/gemini/chat)
  ↓
Response dengan Menu Suggestions
```

### Flow Lama (Fallback):
```
User Query
  ↓
Local Context Extraction (regex patterns)
  ↓
Filter Menu
  ↓
Generate Response
```

## 📁 File yang Dibuat/Dimodifikasi

### 1. **File Baru: `src/app/api/gemini/understand-context/route.ts`**
**Fungsi:** API endpoint untuk memahami konteks query menggunakan LLM

**Input:**
```json
{
  "message": "Saya punya budget 10 ribu, cari makanan dari semua kantin"
}
```

**Output:**
```json
{
  "context": {
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
}
```

**Fitur:**
- Menggunakan Gemini API dengan temperature rendah (0.1) untuk JSON konsisten
- Mengembalikan structured context yang bisa digunakan untuk filtering
- Fallback ke context default jika parsing gagal

### 2. **File Dimodifikasi: `src/components/AIAssistant.tsx`**

**Perubahan Utama:**

#### a. **Step 1: Context Understanding dengan LLM**
```typescript
// Step 1: Use LLM to understand context first
const contextResponse = await fetch('/api/gemini/understand-context', {
  method: 'POST',
  body: JSON.stringify({ message: userMessage })
})
const understoodContext = contextData.context
```

#### b. **Step 2: Filtering Berdasarkan Context**
- Filter berdasarkan kantin spesifik jika disebutkan
- Filter berdasarkan budget
- Filter berdasarkan exclude keywords (alergi)
- Filter berdasarkan keywords inclusion
- Filter berdasarkan kategori
- Filter makanan vs minuman
- Sorting berdasarkan query type

#### c. **Step 3: Multi-Kantin Support**
```typescript
// Group by kantin if multi-kantin query
const menuSuggestions = context.multiKantin && filteredMenus.length > 0
  ? filteredMenus.slice(0, 6) // Show more menus if multi-kantin
  : filteredMenus.slice(0, 3)
```

### 3. **File Dimodifikasi: `src/app/api/gemini/chat/route.ts`**

**Perubahan:**
- Menerima `context` parameter tambahan
- System prompt diperbarui untuk mendukung multi-kantin
- Instruksi untuk selalu menyebutkan nama kantin saat merekomendasikan menu
- Instruksi untuk memberikan rekomendasi dari berbagai kantin jika tidak disebutkan kantin spesifik

## 🔧 Context Structure

```typescript
{
  budget?: number                    // Budget dalam rupiah
  keywords?: string[]                // Kata kunci untuk mencari (contoh: ["ayam", "goreng"])
  excludeKeywords?: string[]         // Kata kunci yang harus dihindari (alergi)
  category?: string                  // Kategori: "makan pagi", "makan siang", "snack", "minuman"
  foodType?: "makanan" | "minuman"   // Tipe: makanan atau minuman
  queryType?: "best_seller" | "cheapest" | "most_expensive" | "recommendation" | "search" | "top_kantin" | "general"
  sortBy?: "price_asc" | "price_desc" | "popularity" | "rating"
  specificKantins?: string[]         // Nama kantin spesifik yang disebutkan
  multiKantin?: boolean              // Apakah user ingin melihat menu dari berbagai kantin
}
```

## 📊 Contoh Query & Response

### Query 1: "Saya punya budget 10 ribu, cari makanan dari semua kantin"
**Context Extracted:**
```json
{
  "budget": 10000,
  "foodType": "makanan",
  "multiKantin": true,
  "queryType": "search"
}
```
**Result:** Menampilkan makanan dari berbagai kantin yang harganya ≤ 10 ribu

### Query 2: "Saya alergi udang, rekomendasi makanan dari kantin sate ayam"
**Context Extracted:**
```json
{
  "excludeKeywords": ["udang"],
  "foodType": "makanan",
  "specificKantins": ["sate ayam"],
  "multiKantin": false
}
```
**Result:** Menampilkan makanan dari Kantin Sate Ayam yang tidak mengandung udang

### Query 3: "Menu termahal apa saja?"
**Context Extracted:**
```json
{
  "queryType": "most_expensive",
  "sortBy": "price_desc",
  "multiKantin": true
}
```
**Result:** Menampilkan menu termahal dari berbagai kantin (bisa berbeda kantin)

### Query 4: "Menu paling sering dibeli"
**Context Extracted:**
```json
{
  "queryType": "best_seller",
  "sortBy": "popularity",
  "multiKantin": true
}
```
**Result:** Menampilkan menu dengan total_sold tertinggi dari berbagai kantin

## ✅ Keuntungan Arsitektur Baru

1. **Pemahaman Konteks Lebih Baik**: LLM memahami nuance query yang tidak bisa ditangkap regex
2. **Multi-Kantin Support**: Bisa menyebutkan makanan dari berbagai kios
3. **Structured Data**: Context dalam format JSON yang mudah digunakan untuk filtering
4. **Fallback Robust**: Jika LLM gagal, masih menggunakan local extraction
5. **Akurasi Tinggi**: Filtering berdasarkan context yang tepat
6. **Scalable**: Mudah ditambahkan context baru tanpa merubah struktur besar

## 🔄 Fallback Mechanism

1. **Level 1**: LLM Context Understanding (prioritas utama)
2. **Level 2**: Local Context Extraction (jika LLM gagal)
3. **Level 3**: Default context dengan multiKantin = true

## 🎨 UI/UX Improvements

- Menu suggestions menampilkan lebih banyak item (6) jika multi-kantin query
- Response selalu menyebutkan nama kantin
- Support untuk queries kompleks seperti "makanan termahal dari berbagai kantin"

## 📝 Catatan Penting

1. **Database Helper Functions** (`AI_HELPER_FUNCTIONS.sql`): 
   - Sudah ada di database tapi saat ini belum digunakan
   - Bisa diintegrasikan untuk query yang lebih kompleks di masa depan
   - Berguna untuk single-kantin queries

2. **Performance**: 
   - Context understanding API dipanggil sekali per query
   - Response di-cache di client-side untuk query yang sama

3. **Error Handling**:
   - Jika LLM API gagal, fallback ke local extraction
   - Jika parsing JSON gagal, menggunakan default context
   - Selalu menghasilkan response yang valid

## 🚀 Next Steps (Opsional)

1. **Caching**: Cache context understanding untuk query yang sama
2. **Database Integration**: Gunakan SQL helper functions untuk query kompleks
3. **Rating Integration**: Tambahkan rating data ke kantin untuk top_kantin queries
4. **Analytics**: Track jenis query yang paling sering digunakan
5. **A/B Testing**: Bandingkan akurasi LLM vs local extraction

## ✨ Kesimpulan

Dengan arsitektur baru ini, AI Assistant sekarang:
- ✅ Menggunakan LLM untuk memahami konteks query
- ✅ Mendukung multi-kantin queries
- ✅ Lebih akurat dalam filtering menu
- ✅ Bisa menyebutkan makanan dari berbagai kios
- ✅ Memahami alergi, budget, kategori, dll dengan lebih baik
- ✅ Memiliki fallback yang robust jika LLM gagal

**Ready for production!** 🎉

