-- =====================================================================
-- DEBUG: Admin Tidak Bisa Lihat Data Kantin Pending
-- =====================================================================
-- Masalah: Data sudah ada di public.users dan public.kantin
--          Tapi admin tidak bisa lihat di dashboard
-- =====================================================================
-- JALANKAN SCRIPT INI DI SUPABASE SQL EDITOR SATU PER SATU
-- =====================================================================

-- =====================================================================
-- STEP 1: CEK DATA YANG ADA
-- =====================================================================

-- 1.1 Cek semua users
SELECT 
    u.id,
    u.email,
    u.role,
    u.created_at,
    CASE 
      WHEN a.user_id IS NOT NULL THEN '✅ IS ADMIN'
      ELSE '❌ NOT ADMIN'
    END as admin_status
FROM public.users u
LEFT JOIN public.admins a ON a.user_id = u.id
ORDER BY u.created_at DESC
LIMIT 20;

-- Expected: Harus ada data users

-- 1.2 Cek semua kantin (termasuk pending)
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
ORDER BY k.created_at DESC
LIMIT 20;

-- Expected: Harus ada data kantin dengan berbagai status

-- 1.3 Cek HANYA kantin pending (query yang dipakai frontend)
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
INNER JOIN public.users u ON k.user_id = u.id
WHERE k.status = 'pending'
ORDER BY k.created_at DESC;

-- Expected: Harus ada kantin dengan status = 'pending'
-- Jika KOSONG → Tidak ada kantin pending, semua sudah approved/rejected
-- Jika ADA DATA → Lanjut ke STEP 2

-- =====================================================================
-- STEP 2: CEK RLS STATUS
-- =====================================================================

-- Cek apakah RLS aktif
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled,
    CASE 
      WHEN rowsecurity THEN '🔒 RLS ENABLED (dapat memblokir query)'
      ELSE '🔓 RLS DISABLED (query bebas)'
    END as status
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename IN ('users', 'kantin', 'admins')
ORDER BY tablename;

-- Expected: Semua harus FALSE (RLS disabled)
-- Jika TRUE (RLS enabled) → Ini masalahnya! Lanjut ke STEP 3

-- =====================================================================
-- STEP 3: DISABLE RLS (SOLUSI CEPAT)
-- =====================================================================

-- Disable RLS untuk testing
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.kantin DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.admins DISABLE ROW LEVEL SECURITY;

-- Verify RLS disabled
SELECT 
    tablename,
    CASE 
      WHEN rowsecurity THEN '❌ MASIH ENABLED'
      ELSE '✅ SUDAH DISABLED'
    END as rls_status
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename IN ('users', 'kantin', 'admins')
ORDER BY tablename;

-- Expected: Semua harus "✅ SUDAH DISABLED"

-- =====================================================================
-- STEP 4: GRANT PERMISSIONS (pastikan admin bisa query)
-- =====================================================================

-- Grant ALL permissions untuk semua roles
GRANT ALL ON public.users TO postgres, service_role, authenticated, anon;
GRANT ALL ON public.kantin TO postgres, service_role, authenticated, anon;
GRANT ALL ON public.admins TO postgres, service_role, authenticated, anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role, authenticated, anon;

-- Verify permissions
SELECT 
    grantee,
    table_schema,
    table_name,
    privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public' 
  AND table_name IN ('users', 'kantin', 'admins')
  AND grantee IN ('authenticated', 'anon', 'service_role')
ORDER BY table_name, grantee, privilege_type;

-- Expected: Harus ada banyak grants untuk authenticated, anon, service_role

-- =====================================================================
-- STEP 5: TEST QUERY ULANG (setelah disable RLS)
-- =====================================================================

-- Test query pending kios LAGI
SELECT 
    k.id as kantin_id,
    k.user_id,
    k.nama_kantin,
    k.status,
    k.created_at,
    u.email
FROM public.kantin k
INNER JOIN public.users u ON k.user_id = u.id
WHERE k.status = 'pending'
ORDER BY k.created_at DESC;

-- Expected: Harus muncul data jika RLS sudah disabled

-- =====================================================================
-- STEP 6: JIKA MASIH TIDAK ADA DATA PENDING
-- =====================================================================

-- Kemungkinan: Semua kantin sudah di-approve atau di-reject
-- Solusi: Set salah satu kantin ke pending untuk testing

-- UNCOMMENT script di bawah untuk set kantin ke pending:
/*
-- Pilih 1 kantin random dan set ke pending
UPDATE public.kantin
SET status = 'pending', updated_at = NOW()
WHERE id = (
  SELECT id FROM public.kantin 
  WHERE status != 'pending'
  LIMIT 1
)
RETURNING id, nama_kantin, status;
*/

-- Atau jika tahu ID kantin tertentu:
/*
UPDATE public.kantin
SET status = 'pending', updated_at = NOW()
WHERE id = 'KANTIN_ID_HERE'
RETURNING id, nama_kantin, status;
*/

-- =====================================================================
-- STEP 7: VERIFY SEMUANYA OK
-- =====================================================================

-- Final check - Harus ada data muncul
SELECT 
    '✅ Check Complete' as status,
    COUNT(*) as total_kantin,
    COUNT(*) FILTER (WHERE k.status = 'pending') as pending_count,
    COUNT(*) FILTER (WHERE k.status = 'aktif') as aktif_count,
    COUNT(*) FILTER (WHERE k.status = 'ditolak') as ditolak_count
FROM public.kantin k;

-- Tampilkan detail kantin pending untuk admin
SELECT 
    '📋 KANTIN PENDING (Yang harus muncul di admin dashboard):' as info,
    k.id as kantin_id,
    k.user_id,
    k.nama_kantin,
    k.status,
    k.jam_buka,
    k.jam_tutup,
    k.created_at,
    u.email as user_email,
    u.role as user_role
FROM public.kantin k
INNER JOIN public.users u ON k.user_id = u.id
WHERE k.status = 'pending'
ORDER BY k.created_at DESC;

-- =====================================================================
-- 🎯 KESIMPULAN & NEXT STEPS
-- =====================================================================

DO $$ 
DECLARE
    v_pending_count INT;
    v_rls_users BOOLEAN;
    v_rls_kantin BOOLEAN;
BEGIN
    -- Count pending
    SELECT COUNT(*) INTO v_pending_count
    FROM public.kantin
    WHERE status = 'pending';
    
    -- Check RLS
    SELECT rowsecurity INTO v_rls_users
    FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'users';
    
    SELECT rowsecurity INTO v_rls_kantin
    FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'kantin';
    
    RAISE NOTICE '';
    RAISE NOTICE '╔════════════════════════════════════════════════════════════╗';
    RAISE NOTICE '║              🔍 DIAGNOSTIC SUMMARY                         ║';
    RAISE NOTICE '╚════════════════════════════════════════════════════════════╝';
    RAISE NOTICE '';
    RAISE NOTICE '📊 Pending Kantin Count: %', v_pending_count;
    RAISE NOTICE '🔒 RLS Status (users): %', CASE WHEN v_rls_users THEN '❌ ENABLED (MASALAH!)' ELSE '✅ DISABLED (OK)' END;
    RAISE NOTICE '🔒 RLS Status (kantin): %', CASE WHEN v_rls_kantin THEN '❌ ENABLED (MASALAH!)' ELSE '✅ DISABLED (OK)' END;
    RAISE NOTICE '';
    
    IF v_pending_count = 0 THEN
        RAISE NOTICE '⚠️ MASALAH: Tidak ada kantin dengan status pending!';
        RAISE NOTICE '   Solusi: Set salah satu kantin ke pending (uncomment STEP 6)';
        RAISE NOTICE '   Atau: Registrasi user baru untuk buat kantin pending';
    ELSE
        RAISE NOTICE '✅ Ada % kantin pending', v_pending_count;
    END IF;
    
    IF v_rls_users OR v_rls_kantin THEN
        RAISE NOTICE '';
        RAISE NOTICE '❌ MASALAH: RLS masih enabled!';
        RAISE NOTICE '   Solusi: RLS sudah di-disable di STEP 3';
        RAISE NOTICE '   Action: Refresh browser dan login ulang sebagai admin';
    ELSE
        RAISE NOTICE '';
        RAISE NOTICE '✅ RLS sudah disabled - Admin harus bisa lihat data';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '🎯 NEXT STEPS:';
    RAISE NOTICE '   1. Refresh browser (Ctrl+F5 atau Cmd+Shift+R)';
    RAISE NOTICE '   2. Login ulang sebagai admin';
    RAISE NOTICE '   3. Buka /admin/approvals';
    RAISE NOTICE '   4. Kantin pending HARUS muncul';
    RAISE NOTICE '   5. Jika tidak muncul, cek browser console (F12)';
    RAISE NOTICE '';
END $$;

-- =====================================================================
-- 📝 NOTES PENTING
-- =====================================================================
-- 
-- PENYEBAB MASALAH UMUM:
-- 1. ❌ RLS enabled → Admin tidak bisa query data
-- 2. ❌ Tidak ada data pending → Semua kantin sudah di-approve
-- 3. ❌ Session cache → Browser masih pakai session lama
-- 4. ❌ API endpoint error → Check browser console
--
-- SOLUSI:
-- 1. ✅ Disable RLS (STEP 3)
-- 2. ✅ Grant permissions (STEP 4)
-- 3. ✅ Set kantin ke pending jika perlu (STEP 6)
-- 4. ✅ Refresh browser & login ulang
--
-- JIKA MASIH TIDAK MUNCUL:
-- - Cek browser console (F12) untuk error
-- - Cek Network tab untuk API calls
-- - Pastikan login sebagai admin (bukan kios)
-- - Coba clear cookies & localStorage
-- - Coba browser incognito/private
-- 
-- =====================================================================
