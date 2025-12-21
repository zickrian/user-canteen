# Penjelasan Callback URL untuk Google OAuth

## URL yang Perlu Ditambahkan

Ada **3 URL callback** yang perlu ditambahkan di **2 tempat berbeda**:

### 1. Callback Aplikasi Development
```
http://localhost:3000/auth/callback
```
- Ini adalah route di aplikasi Next.js Anda (`src/app/auth/callback/route.ts`)
- Setelah Supabase selesai memproses OAuth, akan redirect ke sini
- User akan kembali ke aplikasi Anda di localhost

### 2. Callback Aplikasi Production
```
https://qmeal.up.railway.app/auth/callback
```
- Ini adalah route di aplikasi Next.js Anda untuk production
- Setelah Supabase selesai memproses OAuth, akan redirect ke sini
- User akan kembali ke aplikasi Anda di production

### 3. Callback Supabase (WAJIB)
```
https://wqhhirxlxgxakvonneqq.supabase.co/auth/v1/callback
```
- Ini adalah endpoint Supabase yang menangani OAuth dari Google
- **Google akan redirect ke URL ini** setelah user berhasil login
- Supabase akan memproses token, lalu redirect ke aplikasi Anda

---

## Flow OAuth (Urutan Proses)

```
1. User klik "Login with Google"
   ↓
2. Redirect ke Google Login Page
   ↓
3. User pilih akun Google & authorize
   ↓
4. Google redirect ke Supabase Callback:
   → https://wqhhirxlxgxakvonneqq.supabase.co/auth/v1/callback
   ↓
5. Supabase memproses OAuth token
   ↓
6. Supabase redirect ke Aplikasi Callback:
   → http://localhost:3000/auth/callback (development)
   → https://qmeal.up.railway.app/auth/callback (production)
   ↓
7. Aplikasi callback route memproses session
   ↓
8. Redirect ke halaman yang diminta user
```

---

## Di Mana Harus Ditambahkan?

### ✅ Supabase Dashboard
**Lokasi:** Authentication → Providers → Google → Redirect URLs

Tambahkan **SEMUA 3 URL**:
- `http://localhost:3000/auth/callback`
- `https://qmeal.up.railway.app/auth/callback`
- `https://wqhhirxlxgxakvonneqq.supabase.co/auth/v1/callback`

### ✅ Google Cloud Console
**Lokasi:** APIs & Services → Credentials → OAuth 2.0 Client ID → Authorized redirect URIs

Tambahkan **SEMUA 3 URL**:
- `http://localhost:3000/auth/callback`
- `https://qmeal.up.railway.app/auth/callback`
- `https://wqhhirxlxgxakvonneqq.supabase.co/auth/v1/callback`

---

## Mengapa Perlu 3 URL?

1. **URL Development & Production:** 
   - Supabase perlu tahu kemana harus redirect setelah OAuth selesai
   - Berbeda untuk development dan production

2. **URL Supabase Callback:**
   - Google perlu tahu kemana harus mengirim OAuth response
   - Ini adalah endpoint Supabase yang menangani OAuth flow
   - **WAJIB** ada di Google Cloud Console, jika tidak akan error "redirect_uri_mismatch"

---

## Troubleshooting

### Error: "redirect_uri_mismatch"
**Penyebab:** URL Supabase callback tidak ada di Google Cloud Console

**Solusi:** 
- Pastikan `https://wqhhirxlxgxakvonneqq.supabase.co/auth/v1/callback` sudah ditambahkan di Google Cloud Console → Authorized redirect URIs

### Redirect ke domain yang salah
**Penyebab:** Ada URL yang salah di Supabase Dashboard atau Google Cloud Console

**Solusi:**
- Hapus URL yang tidak perlu (misal: admin-kantin.vercel.app)
- Pastikan hanya 3 URL di atas yang ada

### Login berhasil tapi tidak kembali ke aplikasi
**Penyebab:** URL aplikasi callback tidak ada di Supabase Dashboard

**Solusi:**
- Pastikan `http://localhost:3000/auth/callback` (development) dan `https://qmeal.up.railway.app/auth/callback` (production) sudah ditambahkan di Supabase Dashboard
