# Environment Variables Setup

## Google OAuth Configuration

Tambahkan credentials berikut ke file `.env.local` (file ini tidak di-commit ke git untuk keamanan):

```env
# Google OAuth Configuration
NEXT_PUBLIC_GOOGLE_CLIENT_ID=1086735234448-en1tkjtp9nbt0623idelfr7q70kpdk6p.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
```

**PENTING:** 
- Jangan commit file `.env.local` ke git (sudah ada di `.gitignore`)
- Credentials ini hanya digunakan di server-side untuk OAuth flow
- Client ID digunakan di Supabase Dashboard, bukan di code

## Setup di Supabase Dashboard

**Project ID:** `wqhhirxlxgxakvonneqq`

1. Buka Supabase Dashboard → Authentication → Providers
2. Enable Google Provider
3. Masukkan:
   - **Client ID (for OAuth)**: `1086735234448-en1tkjtp9nbt0623idelfr7q70kpdk6p.apps.googleusercontent.com`
   - **Client Secret (for OAuth)**: `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`
4. Tambahkan Redirect URL (di bagian Redirect URLs):
   - Development: `http://localhost:3000/auth/callback`
   - Production: `https://qmeal.up.railway.app/auth/callback`
   - **Supabase Callback (WAJIB)**: `https://wqhhirxlxgxakvonneqq.supabase.co/auth/v1/callback`

## Setup di Google Cloud Console

1. Buka [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Pilih project Anda
3. Buka OAuth 2.0 Client ID yang sesuai
4. Di bagian **"Authorized redirect URIs"**, tambahkan semua URL berikut:
   - `http://localhost:3000/auth/callback` (untuk development)
   - `https://qmeal.up.railway.app/auth/callback` (untuk production)
   - `https://wqhhirxlxgxakvonneqq.supabase.co/auth/v1/callback` (untuk Supabase - **WAJIB**)
5. Klik **Save**

## Database Migration

Jalankan migration SQL di Supabase SQL Editor untuk membuat table `user_profiles` dan menambahkan `user_id` ke `pesanan`:

File: `migrations/001_add_user_profiles_and_pesanan_user_id.sql`
