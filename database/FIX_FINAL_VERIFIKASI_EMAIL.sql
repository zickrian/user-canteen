-- =============================================================================
-- FIX FINAL: KANTIN OTOMATIS DIBUAT SETELAH USER DAFTAR & VERIFIKASI EMAIL
-- =============================================================================
-- FLOW YANG BENAR:
-- 1. User daftar via /register (WAJIB lewat sistem, bukan manual insert)
-- 2. User dapat email verifikasi
-- 3. User klik link verifikasi
-- 4. Kantin OTOMATIS dibuat dengan status 'pending'
-- 5. Admin login → /admin/approvals → TINGGAL APPROVE
-- 
-- Script ini akan:
-- ✅ Perbaiki function handle_new_user()
-- ✅ Tambahkan UNIQUE constraint jika belum ada
-- ✅ Repair data user yang sudah daftar tapi kantin belum dibuat
-- ✅ Pastikan admin bisa lihat pending kantin
-- =============================================================================

BEGIN;

-- =============================================================================
-- STEP 1: PASTIKAN UNIQUE CONSTRAINT ADA DI user_id
-- =============================================================================
-- Constraint ini penting untuk ON CONFLICT
DO $$
BEGIN
  -- Cek apakah constraint sudah ada
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'kantin_user_id_key' 
    AND conrelid = 'public.kantin'::regclass
  ) THEN
    -- Tambahkan UNIQUE constraint
    ALTER TABLE public.kantin 
    ADD CONSTRAINT kantin_user_id_key UNIQUE (user_id);
    
    RAISE NOTICE '✅ Added UNIQUE constraint on kantin.user_id';
  ELSE
    RAISE NOTICE '✅ UNIQUE constraint already exists on kantin.user_id';
  END IF;
END $$;

-- =============================================================================
-- STEP 2: UPDATE FUNCTION handle_new_user()
-- =============================================================================
-- Function ini dipanggil OTOMATIS saat user sign up via sistem
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_nama_kantin TEXT;
  v_jam_buka TEXT;
  v_jam_tutup TEXT;
BEGIN
  RAISE NOTICE '[handle_new_user] 🔔 New user registered: % (%)', NEW.email, NEW.id;
  
  -- Insert ke public.users
  INSERT INTO public.users (id, email, role)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'role', 'kios'))
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    updated_at = NOW();

  RAISE NOTICE '[handle_new_user] ✅ User created in public.users';

  -- Buat kantin pending HANYA untuk non-admin
  IF NOT EXISTS (SELECT 1 FROM public.admins WHERE user_id = NEW.id) THEN
    -- Ambil data dari form registrasi (metadata)
    v_nama_kantin := COALESCE(
      NEW.raw_user_meta_data->>'nama_kantin',
      CONCAT('Kios ', SPLIT_PART(NEW.email, '@', 1))
    );
    v_jam_buka := COALESCE(NEW.raw_user_meta_data->>'jam_buka', '08:00');
    v_jam_tutup := COALESCE(NEW.raw_user_meta_data->>'jam_tutup', '17:00');
    
    -- Insert kantin dengan status PENDING
    INSERT INTO public.kantin (
      user_id,
      nama_kantin,
      status,
      jam_buka,
      jam_tutup,
      buka_tutup
    )
    VALUES (
      NEW.id,
      v_nama_kantin,
      'pending',  -- STATUS PENDING = MENUNGGU APPROVE ADMIN
      v_jam_buka,
      v_jam_tutup,
      true
    )
    ON CONFLICT (user_id) DO NOTHING;

    RAISE NOTICE '[handle_new_user] ✅ Kantin created with status PENDING: %', v_nama_kantin;
    RAISE NOTICE '[handle_new_user] 👉 Admin can now approve at /admin/approvals';
  ELSE
    RAISE NOTICE '[handle_new_user] ⚠️ User is admin, skip kantin creation';
  END IF;

  RETURN NEW;
END $$;

-- =============================================================================
-- STEP 3: REPAIR USER YANG SUDAH DAFTAR TAPI KANTIN BELUM DIBUAT
-- =============================================================================
-- Function untuk repair user existing (yang sudah daftar via sistem)
CREATE OR REPLACE FUNCTION public.repair_missing_kantin()
RETURNS TABLE (
  repaired_user_id UUID,
  repaired_email TEXT,
  repaired_nama_kantin TEXT,
  repaired_status TEXT
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_user RECORD;
  v_nama_kantin TEXT;
  v_count INTEGER := 0;
BEGIN
  RAISE NOTICE '🔧 Starting repair for users who registered via system...';
  
  -- Loop user yang SUDAH VERIFIED tapi belum ada kantin
  FOR v_user IN 
    SELECT 
      au.id,
      au.email,
      au.raw_user_meta_data,
      au.email_confirmed_at,
      au.created_at
    FROM auth.users au
    WHERE au.email_confirmed_at IS NOT NULL  -- Sudah verifikasi email
      AND NOT EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = au.id)  -- Bukan admin
      AND NOT EXISTS (SELECT 1 FROM public.kantin k WHERE k.user_id = au.id)  -- Belum ada kantin
    ORDER BY au.created_at DESC
  LOOP
    RAISE NOTICE '🔨 Repairing user: % (registered: %)', v_user.email, v_user.created_at;
    
    -- Pastikan user ada di public.users
    INSERT INTO public.users (id, email, role)
    VALUES (v_user.id, v_user.email, 'kios')
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      updated_at = NOW();
    
    -- Generate nama kantin dari metadata registrasi
    v_nama_kantin := COALESCE(
      v_user.raw_user_meta_data->>'nama_kantin',
      CONCAT('Kios ', SPLIT_PART(v_user.email, '@', 1))
    );
    
    -- Buat kantin dengan status PENDING
    INSERT INTO public.kantin (
      user_id,
      nama_kantin,
      status,
      jam_buka,
      jam_tutup,
      buka_tutup
    )
    VALUES (
      v_user.id,
      v_nama_kantin,
      'pending',  -- STATUS PENDING = ADMIN HARUS APPROVE
      COALESCE(v_user.raw_user_meta_data->>'jam_buka', '08:00'),
      COALESCE(v_user.raw_user_meta_data->>'jam_tutup', '17:00'),
      true
    )
    ON CONFLICT (user_id) DO NOTHING;
    
    v_count := v_count + 1;
    
    -- Return result (gunakan nama kolom dari RETURNS TABLE)
    repaired_user_id := v_user.id;
    repaired_email := v_user.email;
    repaired_nama_kantin := v_nama_kantin;
    repaired_status := 'pending';
    
    RETURN NEXT;
  END LOOP;
  
  RAISE NOTICE '🎉 Repair completed! Created % pending kantin(s) for admin to approve', v_count;
  
  RETURN;
END $$;

-- =============================================================================
-- STEP 4: JALANKAN REPAIR UNTUK USER EXISTING
-- =============================================================================
-- Repair semua user yang sudah daftar via sistem tapi kantin belum dibuat
DO $$
BEGIN
  RAISE NOTICE '📋 Repairing users who registered via system but kantin not created yet...';
END $$;

SELECT * FROM public.repair_missing_kantin();

COMMIT;

-- =============================================================================
-- VERIFICATION QUERIES - JALANKAN INI UNTUK CEK HASIL
-- =============================================================================

-- QUERY 1: Cek trigger status (HARUS ENABLED)
SELECT 
  t.tgname AS trigger_name,
  c.relname AS table_name,
  p.proname AS function_name,
  CASE t.tgenabled
    WHEN 'O' THEN '✅ ENABLED'
    WHEN 'D' THEN '❌ DISABLED'
    ELSE '⚠️ UNKNOWN'
  END AS status
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE t.tgname = 'on_auth_user_created'
  AND c.relname = 'users';

-- Expected: ✅ ENABLED

-- QUERY 2: Cek user yang SUDAH VERIFIED tapi BELUM ADA KANTIN (HARUS KOSONG!)
SELECT 
  au.id,
  au.email,
  au.email_confirmed_at,
  au.created_at AS registered_date,
  CASE 
    WHEN EXISTS (SELECT 1 FROM public.kantin k WHERE k.user_id = au.id) THEN '✅ Ada'
    ELSE '❌ TIDAK ADA (PERLU REPAIR!)'
  END AS kantin_status
FROM auth.users au
WHERE au.email_confirmed_at IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.admins WHERE user_id = au.id)
ORDER BY au.created_at DESC;

-- Expected: Semua harus "✅ Ada" (tidak ada yang TIDAK ADA)

-- QUERY 3: CEK PENDING KANTIN YANG SIAP DI-APPROVE ADMIN
SELECT 
  k.id AS kantin_id,
  k.nama_kantin,
  k.status,
  k.jam_buka,
  k.jam_tutup,
  u.email AS pemilik_email,
  au.email_confirmed_at AS email_verified_at,
  k.created_at AS kantin_created_at
FROM public.kantin k
JOIN public.users u ON k.user_id = u.id
JOIN auth.users au ON u.id = au.id
WHERE k.status = 'pending'
ORDER BY k.created_at DESC;

-- Expected: Muncul list kantin dengan status 'pending'
-- Admin bisa approve di /admin/approvals

-- QUERY 4: SUMMARY - OVERVIEW KESELURUHAN
SELECT 
  (SELECT COUNT(*) FROM auth.users WHERE email_confirmed_at IS NOT NULL) AS total_verified_users,
  (SELECT COUNT(*) FROM public.users WHERE role = 'kios') AS total_kios_users,
  (SELECT COUNT(*) FROM public.kantin) AS total_kantin,
  (SELECT COUNT(*) FROM public.kantin WHERE status = 'pending') AS pending_approval,
  (SELECT COUNT(*) FROM public.kantin WHERE status = 'aktif') AS active_kantin,
  (SELECT COUNT(*) FROM public.kantin WHERE status = 'ditolak') AS rejected_kantin,
  (SELECT COUNT(*) 
   FROM auth.users au 
   WHERE au.email_confirmed_at IS NOT NULL 
   AND NOT EXISTS (SELECT 1 FROM public.admins WHERE user_id = au.id)
   AND NOT EXISTS (SELECT 1 FROM public.kantin WHERE user_id = au.id)
  ) AS missing_kantin;

-- Expected:
-- - total_verified_users = total_kios_users + admins
-- - total_kantin = total_kios_users
-- - missing_kantin = 0 (tidak ada yang missing!)

-- =============================================================================
-- ✅ SELESAI! CARA KERJA SISTEM SETELAH FIX INI:
-- =============================================================================
-- 
-- FLOW REGISTRASI USER (VIA SISTEM):
-- =====================================
-- 1. User buka /register
-- 2. User isi form:
--    - Email
--    - Password
--    - Nama Kantin ✅
--    - Jam Buka ✅
--    - Jam Tutup ✅
-- 3. User klik "Daftar"
--    → Trigger handle_new_user() otomatis jalan
--    → Buat record di public.users
--    → Buat kantin dengan status 'pending' ✅
-- 4. User cek email → klik link verifikasi
-- 5. Email verified ✅
-- 6. Kantin sudah ada dengan status 'pending'
-- 
-- FLOW ADMIN APPROVE:
-- ===================
-- 1. Admin login → /admin/approvals
-- 2. Admin lihat list kantin pending ✅
--    - Nama Kantin
--    - Email pemilik
--    - Tanggal daftar
-- 3. Admin klik "Setujui" atau "Tolak"
-- 4. Status kantin berubah:
--    - Setujui → status = 'aktif' ✅
--    - Tolak → status = 'ditolak'
-- 
-- PENTING:
-- ========
-- ❌ JANGAN INSERT USER MANUAL VIA DATABASE!
-- ❌ User WAJIB daftar via form /register
-- ✅ System akan otomatis buat kantin dengan status pending
-- ✅ Admin tinggal approve di dashboard
-- 
-- JIKA ADA USER YANG DAFTAR TAPI KANTIN BELUM DIBUAT:
-- =====================================================
-- Jalankan repair manual:
-- 
--   SELECT * FROM public.repair_missing_kantin();
-- 
-- Function ini akan:
-- - Scan user yang sudah verified
-- - Tapi belum ada kantin
-- - Buat kantin otomatis dengan status 'pending'
-- - Admin tinggal approve
-- 
-- =============================================================================
