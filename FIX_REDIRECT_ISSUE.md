# Fix: Login Redirect ke Localhost Setelah Berhasil Login

## Masalah
Login berhasil tapi masih redirect ke localhost padahal sudah di production atau sebaliknya.

## Solusi

### 1. Cek dan Update Site URL di Supabase Dashboard

**Lokasi:** 
- Supabase Dashboard → Project Settings → Authentication → URL Configuration → Site URL

**Setting yang Benar:**
```
https://admin-kantin.vercel.app/
```

**JANGAN set ke:**
- ❌ `http://localhost:3000`
- ❌ `https://qmeal.up.railway.app`

**Alasan:**
- Site URL adalah **default fallback** untuk admin app
- User app menggunakan `redirectTo` eksplisit, jadi tidak terpengaruh Site URL
- Jika Site URL di-set ke localhost, bisa menyebabkan masalah redirect

---

### 2. Pastikan Redirect URLs Sudah Lengkap

**Lokasi:**
- Supabase Dashboard → Project Settings → Authentication → URL Configuration → Redirect URLs

**Harus ada SEMUA URL berikut:**

#### Untuk User App (QMeal):
```
http://localhost:3000/auth/callback
https://qmeal.up.railway.app/auth/callback
```

#### Untuk Admin App:
```
https://admin-kantin.vercel.app/
https://admin-kantin.vercel.app/auth/callback
```

**Total: 4 URL** harus ada di list Redirect URLs.

**Cara menambahkan:**
1. Klik "Add URL"
2. Masukkan URL satu per satu
3. Klik "Save"

---

### 3. Verifikasi di Google Cloud Console (untuk Google OAuth)

**Lokasi:**
- Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client ID → Authorized redirect URIs

**Harus ada 3 URL:**
```
http://localhost:3000/auth/callback
https://qmeal.up.railway.app/auth/callback
https://wqhhirxlxgxakvonneqq.supabase.co/auth/v1/callback
```

---

## Checklist Perbaikan

### Supabase Dashboard
- [ ] Site URL di-set ke: `https://admin-kantin.vercel.app/`
- [ ] Redirect URLs berisi 4 URL:
  - [ ] `http://localhost:3000/auth/callback`
  - [ ] `https://qmeal.up.railway.app/auth/callback`
  - [ ] `https://admin-kantin.vercel.app/`
  - [ ] `https://admin-kantin.vercel.app/auth/callback`

### Google Cloud Console (untuk Google OAuth)
- [ ] Authorized redirect URIs berisi 3 URL:
  - [ ] `http://localhost:3000/auth/callback`
  - [ ] `https://qmeal.up.railway.app/auth/callback`
  - [ ] `https://wqhhirxlxgxakvonneqq.supabase.co/auth/v1/callback`

---

## Testing

Setelah update konfigurasi:

1. **Development (localhost):**
   - Buka `http://localhost:3000`
   - Login dengan Google
   - Harus redirect kembali ke `http://localhost:3000/auth/callback` lalu ke halaman yang diminta

2. **Production:**
   - Buka `https://qmeal.up.railway.app`
   - Login dengan Google
   - Harus redirect kembali ke `https://qmeal.up.railway.app/auth/callback` lalu ke halaman yang diminta

---

## Catatan Penting

- **Site URL** hanya untuk admin app (fallback default)
- **User app** selalu menggunakan `redirectTo` eksplisit dari kode, jadi tidak terpengaruh Site URL
- Jika masih ada masalah, cek console browser untuk melihat URL redirect yang digunakan
- Pastikan tidak ada typo di URL (http vs https, trailing slash, dll)

---

## Jika Masih Bermasalah

1. **Clear browser cache dan cookies**
2. **Cek console browser** untuk melihat URL redirect
3. **Cek Network tab** untuk melihat request ke Supabase
4. **Pastikan environment variables** sudah benar:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

