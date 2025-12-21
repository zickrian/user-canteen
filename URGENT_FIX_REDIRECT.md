# ⚠️ URGENT: Fix Redirect ke Localhost Setelah Login

## Masalah
Setelah login berhasil, masih redirect ke `localhost:3000` padahal seharusnya ke `https://qmeal.up.railway.app`.

## Penyebab Utama
**Masalahnya ada di Supabase Dashboard, bukan di kode!**

Ketika Supabase redirect setelah OAuth, dia menggunakan **Site URL** sebagai fallback jika `redirectTo` tidak valid atau tidak terdaftar di **Redirect URLs**.

## Solusi (WAJIB DILAKUKAN)

### 1. ✅ Update Site URL di Supabase Dashboard

**Lokasi:**
- Supabase Dashboard → Project Settings → Authentication → URL Configuration → **Site URL**

**Ubah dari:**
```
❌ http://localhost:3000
```

**Ubah ke:**
```
✅ https://admin-kantin.vercel.app/
```

**PENTING:** 
- JANGAN set ke `https://qmeal.up.railway.app` (ini untuk user app, bukan admin)
- Site URL adalah untuk admin app
- User app menggunakan `redirectTo` eksplisit, jadi tidak terpengaruh Site URL

---

### 2. ✅ Pastikan Redirect URLs Lengkap

**Lokasi:**
- Supabase Dashboard → Project Settings → Authentication → URL Configuration → **Redirect URLs**

**HARUS ada SEMUA URL berikut (4 URL):**

1. `http://localhost:3000/auth/callback` (untuk development)
2. `https://qmeal.up.railway.app/auth/callback` (untuk production) ⭐ **PENTING**
3. `https://admin-kantin.vercel.app/` (untuk admin app)
4. `https://admin-kantin.vercel.app/auth/callback` (untuk admin app callback)

**Cara menambahkan:**
1. Klik "Add URL"
2. Masukkan URL satu per satu
3. Klik "Save" setelah semua URL ditambahkan

**Jika URL `https://qmeal.up.railway.app/auth/callback` TIDAK ADA:**
- Supabase akan menggunakan Site URL sebagai fallback
- Jika Site URL adalah localhost, maka akan redirect ke localhost
- **Ini adalah penyebab utama masalah Anda!**

---

### 3. ✅ Verifikasi di Google Cloud Console

**Lokasi:**
- Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client ID → **Authorized redirect URIs**

**HARUS ada 3 URL:**

1. `http://localhost:3000/auth/callback`
2. `https://qmeal.up.railway.app/auth/callback` ⭐ **PENTING**
3. `https://wqhhirxlxgxakvonneqq.supabase.co/auth/v1/callback` (Supabase callback - WAJIB)

---

## Checklist Perbaikan

### ✅ Supabase Dashboard
- [ ] Site URL: `https://admin-kantin.vercel.app/` (BUKAN localhost!)
- [ ] Redirect URLs berisi 4 URL:
  - [ ] `http://localhost:3000/auth/callback`
  - [ ] `https://qmeal.up.railway.app/auth/callback` ⭐ **WAJIB ADA**
  - [ ] `https://admin-kantin.vercel.app/`
  - [ ] `https://admin-kantin.vercel.app/auth/callback`

### ✅ Google Cloud Console
- [ ] Authorized redirect URIs berisi 3 URL:
  - [ ] `http://localhost:3000/auth/callback`
  - [ ] `https://qmeal.up.railway.app/auth/callback` ⭐ **WAJIB ADA**
  - [ ] `https://wqhhirxlxgxakvonneqq.supabase.co/auth/v1/callback`

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
   ❌ TIDAK → Gunakan Site URL sebagai fallback
   ↓
4. Jika Site URL = localhost → Redirect ke localhost ❌
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
4. Site URL = localhost → Redirect ke localhost ❌
```

---

## Testing Setelah Perbaikan

1. **Clear browser cache dan cookies**
2. **Buka** `https://qmeal.up.railway.app`
3. **Login dengan Google**
4. **Pastikan redirect ke** `https://qmeal.up.railway.app` (BUKAN localhost!)

---

## Jika Masih Bermasalah

1. **Cek console log** di browser (F12 → Console)
2. **Cek Network tab** untuk melihat request ke Supabase
3. **Cek server logs** di Railway untuk melihat log dari callback route
4. **Pastikan environment variables** sudah benar:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## Catatan Penting

- **Site URL** hanya untuk admin app (fallback default)
- **User app** selalu menggunakan `redirectTo` eksplisit dari kode
- **TAPI** jika `redirectTo` tidak terdaftar di Redirect URLs, Supabase akan menggunakan Site URL
- **Jadi** pastikan `https://qmeal.up.railway.app/auth/callback` ada di Redirect URLs!

