-- =====================================================================
-- FIX: Admin Tidak Bisa Lihat Kantin Pending
-- =====================================================================
-- Masalah: Dashboard admin /admin/approvals tidak menampilkan kantin baru
-- Penyebab: RLS policy block query dari admin
-- =====================================================================

-- STEP 1: Cek data kantin pending di database
-- Jalankan query ini dulu untuk memastikan data ada
SELECT 
    k.id as kantin_id,
    k.user_id,
    k.nama_kantin,
    k.status,
    k.jam_buka,
    k.jam_tutup,
    k.created_at,
    u.email,
    u.role
FROM public.kantin k
LEFT JOIN public.users u ON k.user_id = u.id
WHERE k.status = 'pending'
ORDER BY k.created_at DESC;

-- Jika query di atas menampilkan data, berarti data ADA tapi RLS block
-- Jika TIDAK ada data, berarti registrasi gagal save ke database

-- =====================================================================
-- STEP 2: FIX RLS POLICIES - Buat policy khusus untuk admin
-- =====================================================================

-- Policy untuk admin bisa SELECT semua kantin (including pending)
DROP POLICY IF EXISTS "Admin can view all kantin" ON public.kantin;
CREATE POLICY "Admin can view all kantin"
ON public.kantin FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.admins 
    WHERE user_id = auth.uid()
  )
);

-- Policy untuk admin bisa UPDATE semua kantin
DROP POLICY IF EXISTS "Admin can update all kantin" ON public.kantin;
CREATE POLICY "Admin can update all kantin"
ON public.kantin FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.admins 
    WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.admins 
    WHERE user_id = auth.uid()
  )
);

-- Policy untuk admin bisa SELECT semua users
DROP POLICY IF EXISTS "Admin can view all users" ON public.users;
CREATE POLICY "Admin can view all users"
ON public.users FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.admins 
    WHERE user_id = auth.uid()
  )
);

-- =====================================================================
-- STEP 3: VERIFY - Cek policy yang aktif
-- =====================================================================

SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename IN ('kantin', 'users')
  AND policyname LIKE '%admin%'
ORDER BY tablename, policyname;

-- =====================================================================
-- ALTERNATIF: Jika masih tidak muncul, DISABLE RLS sementara
-- =====================================================================

-- HANYA untuk testing! Jangan di production!
-- ALTER TABLE public.kantin DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- Setelah testing berhasil, ENABLE kembali:
-- ALTER TABLE public.kantin ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- ✅ SELESAI!
-- =====================================================================
-- Setelah jalankan script ini:
-- 1. Refresh halaman /admin/approvals
-- 2. Harusnya kantin pending muncul
-- 3. Cek console browser (F12) untuk log detail
-- =====================================================================
