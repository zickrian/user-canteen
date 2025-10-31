# Perbaikan AI Assistant - Mematuhi Jumlah Rekomendasi

## Masalah
User meminta rekomendasi **1 menu saja** tetapi AI memberikan rekomendasi dari **semua toko/kantin**, tidak mematuhi jumlah yang diminta.

## Perubahan yang Dilakukan

### 1. **understand-context/route.ts**
- ✅ Menambahkan field `requestedCount` untuk menangkap jumlah yang diminta user
- ✅ Menambahkan logika deteksi jumlah (1 saja, 2 menu, 3 rekomendasi, dll)
- ✅ Menambahkan konversi teks ke angka (satu → 1, dua → 2, tiga → 3)
- ✅ Menambahkan contoh untuk query "tolong rekomendasikan aku makanan dengan budget termurah cukup sebutkan 1 saja"
- ✅ Update semua fallback context untuk include `requestedCount`

### 2. **chat/route.ts**
- ✅ Menambahkan informasi `requestedCount` di INFORMASI KONTEKS QUERY
- ✅ Menambahkan emphasis: "WAJIB PATUHI JUMLAH INI!" 
- ✅ Menambahkan aturan baru (#4 dan #5) tentang pentingnya mematuhi jumlah yang diminta
- ✅ Update contoh dialog dengan menunjukkan cara yang benar (HANYA 1 menu untuk "1 saja")
- ✅ Menambahkan catatan di PENTING section tentang pentingnya memperhatikan "Jumlah Diminta"
- ✅ Filter menu yang dikirim ke Gemini berdasarkan `requestedCount` jika ada

### 3. **AIAssistant.tsx**
- ✅ Update logika `menuSuggestions` untuk menggunakan `requestedCount` jika tersedia
- ✅ Update fallback responses untuk menyesuaikan message berdasarkan `requestedCount`
- ✅ Menambahkan conditional message:
  - Jika `requestedCount === 1`: "Baik! Berdasarkan daftar menu yang ada, pilihan..."
  - Jika lebih dari 1: "Baik! Berikut X rekomendasi..."

## Alur Kerja Baru

```
User Input: "tolong rekomendasikan aku makanan dengan budget termurah cukup sebutkan 1 saja"
    ↓
1. understand-context API
   - Deteksi: requestedCount = 1
   - Deteksi: queryType = "cheapest"
   - Deteksi: foodType = "makanan"
    ↓
2. AIAssistant.tsx - generateAIResponse()
   - Filter menu berdasarkan context
   - Sort by price_asc
   - Slice(0, 1) ← HANYA AMBIL 1 MENU
   - menuSuggestions = [1 menu]
    ↓
3. chat API
   - Menerima context dengan requestedCount: 1
   - Prompt menekankan "WAJIB PATUHI JUMLAH INI!"
   - Hanya menerima 1 menu dari filtered list
   - Generate response yang menyebutkan HANYA 1 menu
    ↓
4. Render UI
   - Tampilkan response dari AI
   - Render 1 card menu saja
```

## Testing

### Test Case 1: Minta 1 menu saja
**Input:** "tolong rekomendasikan aku makanan dengan budget termurah cukup sebutkan 1 saja"

**Expected Output:**
- Context: `requestedCount: 1`
- Menu Suggestions: Array dengan 1 item saja
- AI Response: Menyebutkan HANYA 1 menu
- UI: Menampilkan 1 card menu

### Test Case 2: Minta 3 menu
**Input:** "rekomendasikan 3 menu best seller"

**Expected Output:**
- Context: `requestedCount: 3`
- Menu Suggestions: Array dengan 3 items
- AI Response: Menyebutkan 3 menu
- UI: Menampilkan 3 cards menu

### Test Case 3: Tidak menyebutkan jumlah
**Input:** "rekomendasi makanan enak dong"

**Expected Output:**
- Context: `requestedCount: null`
- Menu Suggestions: Array dengan default count (3-6 items)
- AI Response: Menyebutkan beberapa menu
- UI: Menampilkan beberapa cards menu

## Kata Kunci yang Dideteksi untuk Jumlah

- "1 saja", "satu saja", "cukup 1", "sebutkan 1"
- "2 menu", "dua menu", "2 rekomendasi"
- "3 menu", "tiga menu", "3 rekomendasi"
- Dan seterusnya...

## Perhatian Khusus

1. **Kata "saja"** menandakan user sangat spesifik, AI harus benar-benar mematuhi
2. **Context dikirim ke Gemini** untuk membantu AI memahami dengan lebih baik
3. **Filter dilakukan di frontend** untuk memastikan jumlah tepat
4. **Fallback response** juga mematuhi jumlah yang diminta

## Status
✅ **Siap untuk Testing**

Silakan test dengan berbagai variasi pertanyaan untuk memastikan AI mematuhi jumlah yang diminta.
