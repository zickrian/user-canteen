# ⚠️ FIX: Login Redirect ke Admin App (admin-kantin.vercel.app)

## Masalah
Setelah login di user app (`qmeal.up.railway.app`), malah redirect ke admin app (`admin-kantin.vercel.app`).

## Penyebab
**Masalahnya di Supabase Dashboard, bukan di kode!**

Ketika Supabase menerima `redirectTo` dari aplikasi:
1. Supabase cek: Apakah `redirectTo` terdaftar di **Redirect URLs**?
2. ✅ **YA** → Redirect ke URL yang diminta
3. ❌ **TIDAK** → Gunakan **Site URL** sebagai fallback
4. Jika Site URL = `https://admin-kantin.vercel.app/` → Redirect ke admin app ❌

## Solusi (WAJIB DILAKUKAN)

### 1. ✅ Pastikan Redirect URLs Lengkap di Supabase Dashboard

**Lokasi:**
- Supabase Dashboard → Project Settings → Authentication → URL Configuration → **Redirect URLs**

**HARUS ada SEMUA URL berikut (4 URL):**

1. ✅ `http://localhost:3000/auth/callback` (untuk development)
2. ✅ `https://qmeal.up.railway.app/auth/callback` ⭐ **WAJIB ADA - INI YANG PENTING!**
3. ✅ `https://admin-kantin.vercel.app/` (untuk admin app)
4. ✅ `https://admin-kantin.vercel.app/auth/callback` (untuk admin app callback)

**Cara menambahkan:**
1. Buka Supabase Dashboard
2. Project Settings → Authentication → URL Configuration
3. Scroll ke **Redirect URLs**
4. Klik "Add URL"
5. Masukkan: `https://qmeal.up.railway.app/auth/callback`
6. Klik "Save"

**PENTING:** 
- URL harus **EXACT MATCH** dengan yang dikirim dari kode
- Tidak boleh ada trailing slash yang berbeda
- Tidak boleh ada typo

---

### 2. ✅ Verifikasi Site URL

**Lokasi:**
- Supabase Dashboard → Project Settings → Authentication → URL Configuration → **Site URL**

**Harus di-set ke:**
```
https://admin-kantin.vercel.app/
```

**JANGAN di-set ke:**
- ❌ `http://localhost:3000`
- ❌ `https://qmeal.up.railway.app`

**Alasan:**
- Site URL adalah fallback untuk admin app
- User app menggunakan `redirectTo` eksplisit
- TAPI jika `redirectTo` tidak terdaftar, akan pakai Site URL

---

### 3. ✅ Verifikasi di Google Cloud Console

**Lokasi:**
- Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client ID → **Authorized redirect URIs**

**HARUS ada 3 URL:**

1. ✅ `http://localhost:3000/auth/callback`
2. ✅ `https://qmeal.up.railway.app/auth/callback` ⭐ **WAJIB ADA**
3. ✅ `https://wqhhirxlxgxakvonneqq.supabase.co/auth/v1/callback` (Supabase callback)

---

## Mengapa Masalah Ini Terjadi?

### Flow OAuth yang Benar:
```
1. User di https://qmeal.up.railway.app klik login
   ↓
2. LoginModal mengirim redirectTo: https://qmeal.up.railway.app/auth/callback
   ↓
3. Supabase cek: Apakah redirectTo terdaftar di Redirect URLs?
   ✅ YA → Redirect ke https://qmeal.up.railway.app/auth/callback
   ↓
4. Callback route redirect ke https://qmeal.up.railway.app ✅
```

### Flow OAuth yang Salah (Masalah Anda):
```
1. User di https://qmeal.up.railway.app klik login
   ↓
2. LoginModal mengirim redirectTo: https://qmeal.up.railway.app/auth/callback
   ↓
3. Supabase cek: Apakah redirectTo terdaftar di Redirect URLs?
   ❌ TIDAK (karena tidak ada di list) → Gunakan Site URL
   ↓
4. Site URL = https://admin-kantin.vercel.app/ → Redirect ke admin app ❌
```

---

## Checklist Perbaikan

### ✅ Supabase Dashboard
- [ ] Site URL: `https://admin-kantin.vercel.app/` (untuk admin app)
- [ ] Redirect URLs berisi 4 URL:
  - [ ] `http://localhost:3000/auth/callback`
  - [ ] `https://qmeal.up.railway.app/auth/callback` ⭐ **WAJIB ADA - INI YANG PENTING!**
  - [ ] `https://admin-kantin.vercel.app/`
  - [ ] `https://admin-kantin.vercel.app/auth/callback`

### ✅ Google Cloud Console
- [ ] Authorized redirect URIs berisi 3 URL:
  - [ ] `http://localhost:3000/auth/callback`
  - [ ] `https://qmeal.up.railway.app/auth/callback` ⭐ **WAJIB ADA**
  - [ ] `https://wqhhirxlxgxakvonneqq.supabase.co/auth/v1/callback`

---

## Testing Setelah Perbaikan

1. **Clear browser cache dan cookies**
2. **Buka** `https://qmeal.up.railway.app`
3. **Login dengan Google**
4. **Pastikan redirect ke** `https://qmeal.up.railway.app` (BUKAN admin app!)

---

## Jika Masih Bermasalah

1. **Cek console log** di browser (F12 → Console)
   - Cari log: `[LoginModal] OAuth redirect to:`
   - Pastikan URL-nya benar: `https://qmeal.up.railway.app/auth/callback?...`

2. **Cek Network tab** di browser
   - Lihat request ke Supabase
   - Cek apakah `redirectTo` parameter sudah benar

3. **Cek server logs** di Railway
   - Lihat log dari callback route
   - Cek apakah `safeOrigin` sudah benar

4. **Double-check Supabase Dashboard**
   - Pastikan `https://qmeal.up.railway.app/auth/callback` **PERSIS** sama dengan yang dikirim dari kode
   - Tidak boleh ada perbedaan (trailing slash, typo, dll)

---

## Catatan Penting

- **Kode sudah benar** - tidak ada yang redirect ke admin URL
- **Masalahnya di konfigurasi Supabase Dashboard**
- **Pastikan** `https://qmeal.up.railway.app/auth/callback` ada di Redirect URLs
- **URL harus EXACT MATCH** - tidak boleh ada perbedaan sedikitpun

