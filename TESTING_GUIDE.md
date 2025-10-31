# 🧪 AI Chat Testing Guide

## 📋 Langkah Testing

### 1. Update Database Functions
Jalankan SQL berikut di **Supabase SQL Editor**:

```sql
-- Copy dari file: database/FIX_AI_FUNCTIONS_SCHEMA.sql
-- atau langsung jalankan seluruh isi file tersebut
```

### 2. Restart Development Server
```powershell
# Di terminal, stop server (Ctrl+C)
npm run dev
```

### 3. Test Cases

#### Test 1: Menu Termurah ✅
**Input:**
```
carikan aku resep makanan termurah
```

**Expected:**
- Tool: `getCheapestMenus`
- Response: List 5 menu termurah dengan harga dan detail
- Format: Natural language dengan card menu

#### Test 2: Budget Spesifik ✅
**Input:**
```
aku punya budget 20000 enaknya makan apa
```

**Expected:**
- Tool: `getMenusByBudget`
- Response: Menu dengan harga ≤ Rp 20.000
- Format: Rekomendasi menu dalam budget

#### Test 3: Menu Populer ✅
**Input:**
```
menu populer apa aja?
```

**Expected:**
- Tool: `getPopularMenus`
- Response: Menu dengan total_sold tertinggi
- Format: List menu best seller

#### Test 4: Pencarian Keyword ✅
**Input:**
```
ada ayam goreng gak?
```

**Expected:**
- Tool: `searchMenus`
- Response: Menu yang mengandung kata "ayam" dan "goreng"
- Format: Hasil pencarian dengan relevance

#### Test 5: Kategori Minuman ✅
**Input:**
```
minuman apa aja yang tersedia?
```

**Expected:**
- Tool: `getMenusByCategory`
- Response: Semua menu kategori minuman
- Format: List minuman

#### Test 6: Menu Baru ✅
**Input:**
```
ada menu baru gak minggu ini?
```

**Expected:**
- Tool: `getNewMenus`
- Response: Menu yang dibuat dalam 7 hari terakhir
- Format: List menu terbaru

#### Test 7: Kombinasi Menu ✅
**Input:**
```
buatin paket makan dengan budget 30000
```

**Expected:**
- Tool: `getMenuCombos`
- Response: Kombinasi 2 menu yang total ≤ Rp 30.000
- Format: Paket menu (menu1 + menu2)

#### Test 8: Statistik Kantin ✅
**Input:**
```
berapa rata-rata harga menu di sini?
```

**Expected:**
- Tool: `getKantinStats`
- Response: Total menu, harga rata-rata, termurah, termahal
- Format: Summary statistik

## 🔍 Debugging

### Console Logs yang Harus Muncul:
```
Step 1: Planning with Gemini...
Message: carikan aku resep makanan termurah
KantinId: <uuid>

Step 2: Executing tool: getCheapestMenus
Tool args: { limit: 5 }

Executing tool with kantinId: <uuid>
Tool result: { data: [...] }

Step 3: Generating final response...
```

### Error Indicators:
❌ **Jika masih muncul:**
```
Invalid JSON payload received. Unknown name "response"
```
- Artinya: `actions.ts` belum di-update atau server belum restart

❌ **Jika muncul:**
```
Tool execution error
```
- Check: Supabase functions sudah di-update?
- Check: RLS policies allow access?

✅ **Success Indicator:**
```
Tool result: { data: [array of menus] }
```

## 📊 Expected Response Format

### Direct Response (No Tool)
```
Halo! 👋 Saya asisten kuliner E-Kantin. 
Ada yang bisa saya bantu hari ini? 😊
```

### Tool Response
```
Nih saya carikan menu termurah buat kamu! 🍽️

[Menu Cards dengan detail:]
- Nama menu
- Harga
- Kategori
- Deskripsi
- Button "Tambah"
```

## ✅ Verification Checklist

- [ ] SQL functions updated (kategori_menu JSONB)
- [ ] Server restarted
- [ ] AI Assistant opens without error
- [ ] Welcome message appears
- [ ] Test 1 (cheapest) works
- [ ] Test 2 (budget) works
- [ ] Test 3 (popular) works
- [ ] Menu cards display correctly
- [ ] "Tambah" button works
- [ ] No 400 errors in console

## 🎯 Success Criteria

1. **No Error 400** - Function response format benar
2. **Tools Execute** - Console log shows tool execution
3. **Menu Cards Display** - UI shows menu suggestions
4. **Natural Response** - AI responds in Indonesian naturally
5. **Add to Cart Works** - Can add suggested menu to cart

## 📝 Notes

- Jika kantinId kosong (homepage), AI akan menggunakan **global functions**
- Global functions return menu dari **semua kantin**
- Specific kantin page menggunakan **kantin-specific functions**
- Response always wrapped: `{ data: [...] }` untuk array results

## 🆘 Troubleshooting

### Error Persists After Fix
1. Hard refresh browser (Ctrl+Shift+R)
2. Clear browser cache
3. Check `.env.local` has GEMINI_API_KEY
4. Verify Supabase connection
5. Check network tab for API errors

### Menu Cards Not Showing
1. Check console for errors
2. Verify `toolResult` has data
3. Check `menuSuggestions` prop passing
4. Inspect `renderMenuSuggestions` function

### Add to Cart Not Working
1. Verify `kantin` prop is passed
2. Check `CartContext` is available
3. Look for cart state errors

## 📧 Debug Command

```powershell
# Full debug mode
$env:DEBUG="*"; npm run dev
```

This will show all internal logs including:
- Gemini API requests/responses
- Database queries
- Tool execution details
