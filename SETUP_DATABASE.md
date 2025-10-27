# 📋 Panduan Setup Database Supabase

## Langkah 1: Akses Supabase Dashboard

1. Buka browser dan kunjungi: https://supabase.com/dashboard/project/krvehrwfaokhscsxjlsm
2. Login dengan akun Supabase Anda

## Langkah 2: Buka SQL Editor

1. Di sidebar kiri, klik menu **SQL Editor**
2. Klik tombol **New Query** untuk membuat query baru

## Langkah 3: Jalankan Schema

Copy paste script SQL berikut ke SQL Editor:

```sql
-- Tabel untuk menyimpan data kantin
CREATE TABLE IF NOT EXISTS kantins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nama TEXT NOT NULL,
  foto_url TEXT,
  status TEXT CHECK (status IN ('buka', 'tutup')) DEFAULT 'tutup',
  makan_pagi BOOLEAN DEFAULT false,
  makan_siang BOOLEAN DEFAULT false,
  snack BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE kantins ENABLE ROW LEVEL SECURITY;

-- Policy untuk membaca data (public access)
CREATE POLICY "Enable read access for all users" 
ON kantins FOR SELECT 
USING (true);

-- Policy untuk insert (jika diperlukan nanti)
CREATE POLICY "Enable insert for authenticated users only" 
ON kantins FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');
```

Klik tombol **Run** atau tekan `Ctrl + Enter`

## Langkah 4: Insert Data Dummy (Opsional)

Untuk testing, Anda bisa insert data dummy:

```sql
INSERT INTO kantins (nama, foto_url, status, makan_pagi, makan_siang, snack) VALUES
  ('Kantin Sederhana', 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400', 'buka', true, true, false),
  ('Warung Bu Tini', 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400', 'buka', true, true, true),
  ('Kantin Jaya', 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=400', 'tutup', false, true, false),
  ('Depot Merdeka', 'https://images.unsplash.com/photo-1547573854-74d2a71d0826?w=400', 'buka', true, false, true),
  ('Kantin Sehat', 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400', 'buka', true, true, false),
  ('Warung Pojok', 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400', 'buka', false, true, true);
```

## Langkah 5: Verifikasi

1. Klik menu **Table Editor** di sidebar
2. Pilih tabel `kantins`
3. Anda akan melihat data yang sudah diinsert (jika menggunakan data dummy)

## Langkah 6: Test Aplikasi

1. Pastikan server development sudah berjalan: `npm run dev`
2. Buka browser di http://localhost:3000
3. Anda akan melihat daftar kantin yang sudah diinsert

## 🔒 Security Notes

- **RLS (Row Level Security)** sudah diaktifkan
- Public dapat **membaca** data kantin
- Hanya authenticated users yang bisa **insert** data baru
- Untuk production, Anda bisa tambah policy untuk update dan delete

## 🎯 Tips

- Gunakan **Table Editor** di Supabase untuk mengelola data secara visual
- Gunakan **Database** > **Tables** untuk melihat struktur tabel
- Gunakan **Authentication** jika ingin menambahkan fitur login admin

## ⚠️ Troubleshooting

**Jika data tidak muncul di aplikasi:**
1. Check apakah tabel `kantins` sudah dibuat
2. Check apakah RLS policy sudah di-set dengan benar
3. Check console browser untuk error messages
4. Verify environment variables di `.env.local`

**Jika ada error "permission denied":**
- Pastikan RLS policy untuk SELECT sudah di-set: `USING (true)`
- Ini akan allow public read access

## 📱 Next Steps

Setelah database setup:
1. ✅ Test fitur pencarian
2. ✅ Test filter waktu makan
3. ✅ Test responsive design (resize browser)
4. 📝 Tambahkan kantin baru via Table Editor
5. 🎨 Customize styling sesuai preferensi
