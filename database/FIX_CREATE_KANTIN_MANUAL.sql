-- =====================================================================
-- FIX: Buat Kantin Manual untuk User yang Sudah Ada
-- =====================================================================
-- Masalah: User firdauskhotibulzickrian@gmail.com sudah terdaftar
--          tapi tidak punya data kantin (trigger tidak jalan)
-- =====================================================================
-- JALANKAN SCRIPT INI DI SUPABASE SQL EDITOR
-- =====================================================================

-- STEP 1: Cek user yang tidak punya kantin
SELECT 
    u.id as user_id,
    u.email,
    u.role,
    u.created_at,
    CASE 
        WHEN k.id IS NULL THEN '❌ TIDAK PUNYA KANTIN'
        ELSE '✅ PUNYA KANTIN'
    END as kantin_status
FROM public.users u
LEFT JOIN public.kantin k ON k.user_id = u.id
WHERE u.role = 'kios'
ORDER BY u.created_at DESC;

-- Expected: User 'firdauskhotibulzickrian@gmail.com' harus muncul dengan status "❌ TIDAK PUNYA KANTIN"

-- =====================================================================
-- STEP 2: Buat Kantin untuk User firdauskhotibulzickrian@gmail.com
-- =====================================================================

-- Insert kantin untuk user firdauskhotibul
INSERT INTO public.kantin (
    user_id,
    nama_kantin,
    status,
    jam_buka,
    jam_tutup,
    buka_tutup,
    created_at,
    updated_at
)
SELECT 
    u.id as user_id,
    CONCAT('Kantin ', SPLIT_PART(u.email, '@', 1)) as nama_kantin,
    'pending' as status,
    '08:00' as jam_buka,
    '17:00' as jam_tutup,
    true as buka_tutup,
    u.created_at,
    NOW() as updated_at
FROM public.users u
WHERE u.email = 'firdauskhotibulzickrian@gmail.com'
  AND u.role = 'kios'
  AND NOT EXISTS (
    SELECT 1 FROM public.kantin k WHERE k.user_id = u.id
  )
RETURNING 
    id as kantin_id,
    user_id,
    nama_kantin,
    status,
    jam_buka,
    jam_tutup,
    created_at;

-- Expected Output:
-- kantin_id: [UUID]
-- user_id: [UUID dari firdauskhotibul]
-- nama_kantin: Kantin firdauskhotibulzickrian
-- status: pending
-- jam_buka: 08:00
-- jam_tutup: 17:00

-- =====================================================================
-- STEP 3: Verify Kantin Berhasil Dibuat
-- =====================================================================

-- Cek semua kantin sekarang
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
ORDER BY k.created_at DESC;

-- Expected: Harus ada 1 row dengan data kantin firdauskhotibul

-- =====================================================================
-- STEP 4: Cek Kantin Pending (Query yang dipakai frontend)
-- =====================================================================

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

-- Expected: Harus muncul kantin firdauskhotibul dengan status 'pending'

-- =====================================================================
-- STEP 5: Summary Check
-- =====================================================================

SELECT 
    '✅ SUMMARY' as info,
    COUNT(*) as total_kantin,
    COUNT(*) FILTER (WHERE k.status = 'pending') as pending_count,
    COUNT(*) FILTER (WHERE k.status = 'aktif') as aktif_count,
    COUNT(*) FILTER (WHERE k.status = 'ditolak') as ditolak_count
FROM public.kantin k;

-- Expected: 
-- total_kantin: 1
-- pending_count: 1
-- aktif_count: 0
-- ditolak_count: 0

-- =====================================================================
-- STEP 6: JIKA INGIN BUAT KANTIN UNTUK SEMUA USER KIOS YANG BELUM PUNYA
-- =====================================================================

-- Uncomment script di bawah jika ada banyak user kios yang belum punya kantin:
/*
INSERT INTO public.kantin (
    user_id,
    nama_kantin,
    status,
    jam_buka,
    jam_tutup,
    buka_tutup,
    created_at,
    updated_at
)
SELECT 
    u.id as user_id,
    CONCAT('Kantin ', SPLIT_PART(u.email, '@', 1)) as nama_kantin,
    'pending' as status,
    '08:00' as jam_buka,
    '17:00' as jam_tutup,
    true as buka_tutup,
    u.created_at,
    NOW() as updated_at
FROM public.users u
WHERE u.role = 'kios'
  AND NOT EXISTS (
    SELECT 1 FROM public.kantin k WHERE k.user_id = u.id
  )
RETURNING 
    id as kantin_id,
    user_id,
    nama_kantin,
    status;
*/

-- =====================================================================
-- ✅ SELESAI!
-- =====================================================================

DO $$ 
DECLARE
    v_total_kantin INT;
    v_pending_count INT;
BEGIN
    -- Count kantins
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE status = 'pending')
    INTO v_total_kantin, v_pending_count
    FROM public.kantin;
    
    RAISE NOTICE '';
    RAISE NOTICE '╔════════════════════════════════════════════════════════════╗';
    RAISE NOTICE '║          ✅ KANTIN BERHASIL DIBUAT!                        ║';
    RAISE NOTICE '╚════════════════════════════════════════════════════════════╝';
    RAISE NOTICE '';
    RAISE NOTICE '📊 Total Kantin: %', v_total_kantin;
    RAISE NOTICE '⏳ Pending: %', v_pending_count;
    RAISE NOTICE '';
    RAISE NOTICE '🎯 NEXT STEPS:';
    RAISE NOTICE '   1. Refresh browser (Ctrl+F5)';
    RAISE NOTICE '   2. Login sebagai admin';
    RAISE NOTICE '   3. Buka /admin/approvals';
    RAISE NOTICE '   4. Kantin pending HARUS muncul ✅';
    RAISE NOTICE '';
END $$;

-- =====================================================================
-- 📝 PENJELASAN KENAPA KANTIN TIDAK DIBUAT OTOMATIS
-- =====================================================================
--
-- Kemungkinan penyebab trigger tidak jalan saat registrasi:
-- 1. User dibuat SEBELUM trigger di-install
-- 2. Trigger error tapi user tetap dibuat
-- 3. Registrasi via metode lain (bukan signUp biasa)
-- 4. Trigger disabled saat user dibuat
--
-- SOLUSI PERMANEN:
-- 1. Jalankan COMPLETE_FIX.sql untuk install trigger yang benar
-- 2. Test dengan registrasi user BARU
-- 3. Untuk user lama yang sudah terdaftar, buat kantin manual (script ini)
--
-- =====================================================================
