# Setup Google OAuth untuk QMeal

## Informasi Project
- **Supabase Project ID:** `wqhhirxlxgxakvonneqq`
- **Production Domain:** `https://qmeal.up.railway.app/`
- **Google Client ID:** `1086735234448-en1tkjtp9nbt0623idelfr7q70kpdk6p.apps.googleusercontent.com`
- **Google Client Secret:** `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`

---

## Step 1: Setup di Supabase Dashboard

### 1.1 Buka Authentication Settings
1. Login ke [Supabase Dashboard](https://supabase.com/dashboard/project/wqhhirxlxgxakvonneqq)
2. Klik menu **Authentication** di sidebar kiri
3. Klik tab **Providers**

### 1.2 Enable Google Provider
1. Scroll ke bagian **Google**
2. Toggle **"Enable Google provider"** menjadi **ON**

### 1.3 Masukkan Credentials
Isi field berikut:

**Client ID (for OAuth):**
```
1086735234448-en1tkjtp9nbt0623idelfr7q70kpdk6p.apps.googleusercontent.com
```

**Client Secret (for OAuth):**
```
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
```

### 1.4 Tambahkan Redirect URLs
Di bagian **Redirect URLs**, klik **"Add URL"** dan tambahkan satu per satu:

**PENTING:** Semua URL berikut WAJIB ditambahkan!

1. **Development (aplikasi Anda):**
   ```
   http://localhost:3000/auth/callback
   ```

2. **Production (aplikasi Anda):**
   ```
   https://qmeal.up.railway.app/auth/callback
   ```

3. **Supabase Callback (WAJIB - ini yang dipanggil Google setelah login):**
   ```
   https://wqhhirxlxgxakvonneqq.supabase.co/auth/v1/callback
   ```
   
   **Catatan:** URL ini adalah callback Supabase yang akan menerima response dari Google OAuth, kemudian Supabase akan redirect ke aplikasi Anda.

### 1.5 Save Settings
- Klik tombol **Save** di bagian bawah
- Tunggu beberapa detik hingga tersimpan

---

## Step 2: Setup di Google Cloud Console

### 2.1 Buka Google Cloud Console
1. Buka [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Pilih project yang sesuai dengan Client ID di atas

### 2.2 Edit OAuth 2.0 Client ID
1. Klik pada OAuth 2.0 Client ID yang sesuai
2. Scroll ke bagian **"Authorized redirect URIs"**

### 2.3 Tambahkan Redirect URIs
Klik **"+ ADD URI"** dan tambahkan semua URL berikut:

**PENTING:** Semua URL berikut WAJIB ditambahkan di Google Cloud Console!

1. **Development (aplikasi Anda):**
   ```
   http://localhost:3000/auth/callback
   ```

2. **Production (aplikasi Anda):**
   ```
   https://qmeal.up.railway.app/auth/callback
   ```

3. **Supabase Callback (WAJIB - ini yang dipanggil Google setelah login):**
   ```
   https://wqhhirxlxgxakvonneqq.supabase.co/auth/v1/callback
   ```
   
   **Catatan:** Google akan redirect ke URL ini setelah user berhasil login. Tanpa URL ini, OAuth akan gagal dengan error "redirect_uri_mismatch".

### 2.4 Save Changes
- Klik **Save** di bagian bawah halaman
- Tunggu beberapa detik hingga tersimpan

---

## Step 3: Setup Environment Variables

Tambahkan ke file `.env.local` di root project:

```env
# Google OAuth Configuration
NEXT_PUBLIC_GOOGLE_CLIENT_ID=1086735234448-en1tkjtp9nbt0623idelfr7q70kpdk6p.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
```

**Untuk Production (Railway):**
Tambahkan environment variables di Railway Dashboard:
1. Buka project di Railway
2. Klik **Variables** tab
3. Tambahkan:
   - `NEXT_PUBLIC_GOOGLE_CLIENT_ID` = `1086735234448-en1tkjtp9nbt0623idelfr7q70kpdk6p.apps.googleusercontent.com`
   - `GOOGLE_CLIENT_SECRET` = `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`

---

## Checklist Setup

### Supabase Dashboard
- [ ] Google Provider enabled
- [ ] Client ID sudah diisi
- [ ] Client Secret sudah diisi
- [ ] Redirect URL development ditambahkan
- [ ] Redirect URL production ditambahkan
- [ ] Redirect URL Supabase callback ditambahkan
- [ ] Settings sudah di-save

### Google Cloud Console
- [ ] Authorized redirect URI development ditambahkan
- [ ] Authorized redirect URI production ditambahkan
- [ ] Authorized redirect URI Supabase callback ditambahkan
- [ ] Changes sudah di-save

### Environment Variables
- [ ] `.env.local` sudah diisi (untuk development)
- [ ] Railway environment variables sudah diisi (untuk production)

---

## Testing

### Test di Development
1. Jalankan `npm run dev`
2. Buka `http://localhost:3000`
3. Klik tombol cart atau coba checkout
4. Klik "Continue with Google"
5. Pastikan redirect ke Google login dan kembali ke aplikasi

### Test di Production
1. Buka `https://qmeal.up.railway.app/`
2. Klik tombol cart atau coba checkout
3. Klik "Continue with Google"
4. Pastikan redirect ke Google login dan kembali ke aplikasi

---

## Troubleshooting

### Error: "redirect_uri_mismatch"
- Pastikan semua redirect URIs sudah ditambahkan di Google Cloud Console
- Pastikan URL Supabase callback sudah ditambahkan (ini yang paling penting)

### Error: "invalid_client"
- Pastikan Client ID dan Client Secret sudah benar di Supabase Dashboard
- Pastikan environment variables sudah diisi dengan benar

### Login berhasil tapi redirect ke domain yang salah (misal: admin-kantin.vercel.app)
**Masalah:** Setelah login Google, di-redirect ke domain lain bukan localhost/production domain Anda.

**Solusi:**
1. **Cek Redirect URLs di Supabase Dashboard:**
   - Pastikan hanya URL aplikasi Anda yang ada di list
   - Hapus URL domain lain yang tidak perlu (misal: admin-kantin.vercel.app)
   - Pastikan URL yang ada:
     - `http://localhost:3000/auth/callback` (development)
     - `https://qmeal.up.railway.app/auth/callback` (production)
     - `https://wqhhirxlxgxakvonneqq.supabase.co/auth/v1/callback` (Supabase callback)

2. **Cek Authorized redirect URIs di Google Cloud Console:**
   - Pastikan hanya URL aplikasi Anda yang ada
   - Hapus URL domain lain yang tidak perlu

3. **Clear browser cache dan cookies:**
   - Clear cache untuk localhost
   - Clear cookies untuk Supabase domain

4. **Restart development server:**
   ```bash
   npm run dev
   ```

### Login berhasil tapi tidak redirect kembali
- Pastikan redirect URL di Supabase Dashboard sudah benar
- Pastikan callback route `/auth/callback` sudah ada di aplikasi
- Cek browser console untuk error messages

---

## Catatan Penting

1. **Supabase Callback URL adalah WAJIB** - tanpa ini, Google OAuth tidak akan bekerja
2. URL harus exact match (termasuk trailing slash atau tidak)
3. Setelah perubahan di Google Cloud Console, bisa butuh beberapa menit untuk propagate
4. Untuk production, pastikan environment variables sudah di-set di Railway
