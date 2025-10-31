# QUICK FIX - Error 500

## Masalah:
- Model `gemini-2.5-flash` belum tersedia / API key tidak support
- Format request ke Gemini API mungkin salah

## Solusi yang Sudah Diterapkan:

### 1. Ganti Model
- ❌ `gemini-2.5-flash` 
- ✅ `gemini-1.5-flash` (stable, pasti ada)

### 2. Fix Request Format
- Gabung SYSTEM_PROMPT jadi 1 text part
- Struktur `contents` lebih simple

## Test Sekarang:

1. **Restart dev server:**
```bash
npm run dev
```

2. **Test API langsung** (opsional):
```bash
curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=AIzaSyDMF19OwYBe_nuzRB5qr8I3S1YHhTiybdA" \
  -H "Content-Type: application/json" \
  -d '{"contents":[{"parts":[{"text":"Say hello"}]}]}'
```

3. **Coba chat AI** di browser

## Jika Masih Error:

Cek console terminal untuk error detail, lalu share ke saya.

Kemungkinan lain:
- API key quota habis
- API key restricted
- Network issue

## Test API Key Valid:

Buka: https://aistudio.google.com/apikey
- Login
- Cek apakah key masih aktif
- Buat key baru jika perlu

