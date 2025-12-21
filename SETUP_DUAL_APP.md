# Setup Supabase untuk 2 Aplikasi (Admin + User)

## Konfigurasi Aplikasi

Anda memiliki **1 database Supabase** untuk **2 aplikasi**:

1. **Admin App** (`admin-kantin.vercel.app`)
   - Menggunakan **Supabase Auth** (email/password)
   - Site URL: `https://admin-kantin.vercel.app/`

2. **User App** (`qmeal.up.railway.app` / `localhost:3000`)
   - Menggunakan **Google OAuth**
   - Redirect URLs: `http://localhost:3000/auth/callback` dan `https://qmeal.up.railway.app/auth/callback`

---

## Konfigurasi di Supabase Dashboard

### 1. Site URL
**Lokasi:** Authentication → URL Configuration → Site URL

**Setting:**
```
https://admin-kantin.vercel.app/
```

**Penjelasan:**
- Site URL adalah **default fallback** jika tidak ada `redirectTo` yang spesifik
- Karena admin app menggunakan Supabase Auth langsung, set ini ke admin URL
- User app akan selalu menggunakan `redirectTo` yang eksplisit, jadi tidak terpengaruh

### 2. Redirect URLs
**Lokasi:** Authentication → URL Configuration → Redirect URLs

**Tambahkan SEMUA URL berikut:**

#### Untuk Admin App:
```
https://admin-kantin.vercel.app/
https://admin-kantin.vercel.app/auth/callback
```

#### Untuk User App (QMeal):
```
http://localhost:3000/auth/callback
https://qmeal.up.railway.app/auth/callback
```

**Total: 4 URL** yang harus ada di Redirect URLs

---

## Konfigurasi di Google Cloud Console

**Lokasi:** APIs & Services → Credentials → OAuth 2.0 Client ID → Authorized redirect URIs

**Tambahkan URL berikut:**

1. **User App Development:**
   ```
   http://localhost:3000/auth/callback
   ```

2. **User App Production:**
   ```
   https://qmeal.up.railway.app/auth/callback
   ```

3. **Supabase Callback (WAJIB):**
   ```
   https://wqhhirxlxgxakvonneqq.supabase.co/auth/v1/callback
   ```

**PENTING:** 
- Jangan tambahkan URL admin di sini (admin tidak pakai Google OAuth)
- URL Supabase callback **WAJIB** ada, tanpa ini Google OAuth akan gagal

---

## Perbedaan Authentication Flow

### Admin App Flow:
```
1. User input email/password di admin app
2. Supabase Auth langsung proses
3. Redirect ke: https://admin-kantin.vercel.app/ (Site URL)
```

### User App Flow (Google OAuth):
```
1. User klik "Login with Google"
2. Redirect ke Google
3. Google redirect ke: https://wqhhirxlxgxakvonneqq.supabase.co/auth/v1/callback
4. Supabase proses OAuth
5. Supabase redirect ke: http://localhost:3000/auth/callback (atau production)
6. App callback route proses session
7. Redirect ke halaman yang diminta
```

---

## Checklist Konfigurasi

### Supabase Dashboard
- [ ] Site URL: `https://admin-kantin.vercel.app/`
- [ ] Redirect URLs ada 4 URL:
  - [ ] `https://admin-kantin.vercel.app/`
  - [ ] `https://admin-kantin.vercel.app/auth/callback`
  - [ ] `http://localhost:3000/auth/callback`
  - [ ] `https://qmeal.up.railway.app/auth/callback`

### Google Cloud Console
- [ ] Authorized redirect URIs ada 3 URL:
  - [ ] `http://localhost:3000/auth/callback`
  - [ ] `https://qmeal.up.railway.app/auth/callback`
  - [ ] `https://wqhhirxlxgxakvonneqq.supabase.co/auth/v1/callback`

### Code User App
- [ ] LoginModal menggunakan `window.location.origin` untuk redirectTo
- [ ] Callback route memvalidasi origin sebelum redirect
- [ ] Environment variables sudah di-set dengan benar

---

## Troubleshooting

### User app redirect ke admin app setelah login Google
**Penyebab:** Site URL di-set ke admin, dan redirectTo tidak eksplisit

**Solusi:**
- Pastikan LoginModal menggunakan `window.location.origin` untuk redirectTo
- Pastikan callback route menggunakan origin dari request, bukan Site URL

### Error "redirect_uri_mismatch" di Google OAuth
**Penyebab:** URL Supabase callback tidak ada di Google Cloud Console

**Solusi:**
- Pastikan `https://wqhhirxlxgxakvonneqq.supabase.co/auth/v1/callback` ada di Google Cloud Console

### Admin app tidak bisa login
**Penyebab:** Site URL atau Redirect URLs tidak sesuai

**Solusi:**
- Pastikan `https://admin-kantin.vercel.app/` ada di Redirect URLs
- Pastikan Site URL di-set ke admin URL
