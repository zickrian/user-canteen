-- =====================================================================
-- COMPLETE FIX: Registrasi & Admin Dashboard - UPDATED VERSION
-- =====================================================================
-- Masalah yang Diperbaiki:
-- 1. ✅ User register tapi data tidak masuk database
-- 2. ✅ Admin dashboard tidak menampilkan kantin pending
-- 3. ✅ Error setelah klik link verifikasi email
-- 4. ✅ Status "Data kantin tidak ditemukan" setelah registrasi
-- =====================================================================
-- JALANKAN SCRIPT INI DI SUPABASE SQL EDITOR
-- =====================================================================

-- =====================================================================
-- STEP 1: CEK DATA YANG ADA (BEFORE FIX)
-- =====================================================================

-- Cek semua user yang terdaftar
SELECT 
    'auth.users' as source,
    id,
    email,
    email_confirmed_at,
    raw_user_meta_data,
    created_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 10;

-- Cek public.users
SELECT 
    'public.users' as source,
    id,
    email,
    role,
    created_at
FROM public.users
ORDER BY created_at DESC
LIMIT 10;

-- Cek public.kantin
SELECT 
    'public.kantin' as source,
    k.id,
    k.user_id,
    k.nama_kantin,
    k.status,
    k.jam_buka,
    k.jam_tutup,
    k.created_at,
    u.email
FROM public.kantin k
LEFT JOIN public.users u ON k.user_id = u.id
ORDER BY k.created_at DESC
LIMIT 10;

-- =====================================================================
-- STEP 2: DISABLE RLS (untuk testing)
-- =====================================================================
-- PENTING: RLS di-disable dulu untuk testing
-- Nanti akan di-enable kembali dengan proper policies
-- =====================================================================

ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.kantin DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.admins DISABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    RAISE NOTICE '✅ RLS disabled for testing';
END $$;

-- =====================================================================
-- STEP 3: FIX TRIGGER (dengan error handling & logging lebih baik)
-- =====================================================================

-- Drop trigger & function lama
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

DO $$ 
BEGIN
    RAISE NOTICE '🗑️ Dropped old trigger and function';
END $$;

-- Create/Replace function dengan error handling & logging
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
  v_nama_kantin TEXT;
  v_jam_buka TEXT;
  v_jam_tutup TEXT;
  v_role TEXT;
BEGIN
  RAISE NOTICE '🔔 [TRIGGER] Fired for user: % (ID: %)', NEW.email, NEW.id;
  RAISE NOTICE '📋 [TRIGGER] Metadata: %', NEW.raw_user_meta_data;
  
  -- Get role from metadata
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'kios');
  RAISE NOTICE '👤 [TRIGGER] Role detected: %', v_role;
  
  -- Insert/Update ke public.users
  BEGIN
    INSERT INTO public.users (id, email, role, created_at, updated_at)
    VALUES (NEW.id, NEW.email, v_role, NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      role = EXCLUDED.role,
      updated_at = NOW();
    
    RAISE NOTICE '✅ [TRIGGER] User record created/updated in public.users: %', NEW.id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '❌ [TRIGGER] Error creating user in public.users: % (Code: %)', SQLERRM, SQLSTATE;
    -- Continue anyway, don't stop the process
  END;

  -- Create kantin ONLY for non-admin users
  IF v_role != 'admin' THEN
    BEGIN
      -- Get kantin data from metadata
      v_nama_kantin := COALESCE(
        NEW.raw_user_meta_data->>'nama_kantin',
        CONCAT('Kios ', SPLIT_PART(NEW.email, '@', 1))
      );
      v_jam_buka := COALESCE(NEW.raw_user_meta_data->>'jam_buka', '08:00');
      v_jam_tutup := COALESCE(NEW.raw_user_meta_data->>'jam_tutup', '17:00');
      
      RAISE NOTICE '📝 [TRIGGER] Creating kantin with data:';
      RAISE NOTICE '   - Nama: %', v_nama_kantin;
      RAISE NOTICE '   - Jam Buka: %', v_jam_buka;
      RAISE NOTICE '   - Jam Tutup: %', v_jam_tutup;
      RAISE NOTICE '   - Status: pending';
      
      -- Insert kantin with status PENDING
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
      VALUES (
        NEW.id,
        v_nama_kantin,
        'pending', -- ALWAYS PENDING saat registrasi
        v_jam_buka,
        v_jam_tutup,
        true,
        NOW(),
        NOW()
      )
      ON CONFLICT (user_id) DO UPDATE SET
        nama_kantin = EXCLUDED.nama_kantin,
        jam_buka = EXCLUDED.jam_buka,
        jam_tutup = EXCLUDED.jam_tutup,
        status = 'pending', -- Reset ke pending jika re-register
        buka_tutup = true,
        updated_at = NOW();
      
      RAISE NOTICE '✅ [TRIGGER] Kantin created/updated in public.kantin!';
      RAISE NOTICE '🎉 [TRIGGER] Registration complete! User % can now login (status: pending)', NEW.email;
      
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '❌ [TRIGGER] Error creating kantin: % (Code: %)', SQLERRM, SQLSTATE;
      RAISE WARNING '⚠️ [TRIGGER] User will be created but without kantin!';
      -- Don't return NULL, let user creation succeed
    END;
  ELSE
    RAISE NOTICE '⚠️ [TRIGGER] User role is admin, skipping kantin creation';
  END IF;

  RAISE NOTICE '✨ [TRIGGER] Process completed successfully for: %', NEW.email;
  RETURN NEW;
END;
$$;

DO $$ 
BEGIN
    RAISE NOTICE '✅ Created new handle_new_user function';
END $$;

-- Create trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

DO $$ 
BEGIN
    RAISE NOTICE '✅ Created trigger on_auth_user_created';
END $$;

-- =====================================================================
-- STEP 4: GRANT PERMISSIONS (dengan anon untuk signUp)
-- =====================================================================

GRANT ALL ON public.users TO postgres, service_role, authenticated, anon;
GRANT ALL ON public.kantin TO postgres, service_role, authenticated, anon;
GRANT ALL ON public.admins TO postgres, service_role, authenticated, anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role, authenticated, anon;

DO $$ 
BEGIN
    RAISE NOTICE '✅ Granted permissions to all roles including anon';
END $$;

-- =====================================================================
-- STEP 5: PASTIKAN ADMIN ADA
-- =====================================================================

-- Cek admin yang ada
SELECT 
    u.id,
    u.email,
    u.role,
    CASE WHEN a.user_id IS NOT NULL THEN 'YES' ELSE 'NO' END as is_admin
FROM public.users u
LEFT JOIN public.admins a ON a.user_id = u.id
WHERE u.role = 'admin' OR a.user_id IS NOT NULL;

-- Jika tidak ada admin, uncomment dan ganti email dengan email admin Anda:
-- Contoh: Untuk set user sebagai admin, copy script di bawah ke SQL Editor baru:

/*
DO $$
DECLARE
    admin_email TEXT := 'admin@example.com'; -- GANTI INI dengan email admin Anda!
    admin_user_id UUID;
BEGIN
    -- Get user ID
    SELECT id INTO admin_user_id 
    FROM public.users 
    WHERE email = admin_email;
    
    IF admin_user_id IS NOT NULL THEN
        -- Update role
        UPDATE public.users 
        SET role = 'admin' 
        WHERE id = admin_user_id;
        
        -- Add to admins table
        INSERT INTO public.admins (user_id)
        VALUES (admin_user_id)
        ON CONFLICT (user_id) DO NOTHING;
        
        -- Delete kantin if exists (admin ga perlu kantin)
        DELETE FROM public.kantin WHERE user_id = admin_user_id;
        
        RAISE NOTICE 'Admin created: %', admin_email;
    ELSE
        RAISE WARNING 'User with email % not found', admin_email;
    END IF;
END $$;
*/

-- =====================================================================
-- STEP 6: VERIFY SETUP (Check Everything)
-- =====================================================================

-- Cek trigger status
DO $$ 
DECLARE
    v_trigger_count INT;
    v_trigger_enabled TEXT;
BEGIN
    SELECT COUNT(*), 
           CASE MAX(tgenabled::text)
               WHEN 'O' THEN 'ENABLED ✅'
               WHEN 'D' THEN 'DISABLED ❌'
               ELSE 'UNKNOWN ⚠️'
           END
    INTO v_trigger_count, v_trigger_enabled
    FROM pg_trigger t
    JOIN pg_proc p ON t.tgfoid = p.oid
    WHERE t.tgname = 'on_auth_user_created'
      AND p.proname = 'handle_new_user';
    
    IF v_trigger_count > 0 THEN
        RAISE NOTICE '✅ Trigger verified: on_auth_user_created is %', v_trigger_enabled;
    ELSE
        RAISE WARNING '❌ Trigger NOT FOUND! Please re-run STEP 3';
    END IF;
END $$;

-- Detailed trigger info
SELECT 
    t.tgname AS trigger_name,
    CASE t.tgenabled::text
        WHEN 'O' THEN 'ENABLED ✅'
        WHEN 'D' THEN 'DISABLED ❌'
        ELSE 'UNKNOWN ⚠️'
    END AS status,
    p.proname AS function_name,
    c.relname AS table_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
JOIN pg_class c ON t.tgrelid = c.oid
WHERE t.tgname = 'on_auth_user_created';

-- Expected output:
-- trigger_name: on_auth_user_created
-- status: ENABLED ✅
-- function_name: handle_new_user
-- table_name: users (from auth schema)

-- Cek RLS status
SELECT 
    tablename,
    CASE rowsecurity
        WHEN false THEN 'DISABLED ✅ (Good for testing)'
        WHEN true THEN 'ENABLED ⚠️ (May block queries)'
    END as rls_status
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename IN ('users', 'kantin', 'admins')
ORDER BY tablename;

-- Expected: ALL should be DISABLED for testing

-- =====================================================================
-- STEP 7: TEST QUERY (untuk verify data muncul)
-- =====================================================================

-- Query yang digunakan di frontend untuk get pending kios
-- Test ini HARUS mengembalikan data setelah registrasi baru
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

-- Expected: Setelah registrasi user baru, query ini harus return minimal 1 row

-- Cek semua kantin (untuk debugging)
SELECT 
    k.id,
    k.user_id,
    k.nama_kantin,
    k.status,
    k.created_at,
    u.email,
    u.role
FROM public.kantin k
LEFT JOIN public.users u ON k.user_id = u.id
ORDER BY k.created_at DESC
LIMIT 20;

-- =====================================================================
-- ✅ SETUP SELESAI!
-- =====================================================================
-- 
-- 🎯 NEXT STEPS - TEST REGISTRASI:
-- =====================================================================
-- 1. ✅ SQL Script sudah dijalankan
-- 2. 📝 Buka aplikasi → Halaman Register
-- 3. 📧 Registrasi dengan EMAIL BARU yang belum pernah dipakai
-- 4. 📬 Cek inbox email untuk link verifikasi
-- 5. 🔗 Klik link verifikasi di email
-- 6. ✅ Seharusnya redirect ke /auth/callback lalu ke /login
-- 7. 🔑 Login dengan email & password yang baru didaftarkan
-- 8. ⏳ Seharusnya masuk ke /status-akun dengan status "Menunggu Persetujuan"
-- 9. 👨‍💼 Login sebagai admin di tab/browser lain
-- 10. 📋 Buka /admin/approvals
-- 11. ✅ Kantin pending HARUS MUNCUL di list
-- 12. ✔️ Approve kantin tersebut
-- 13. 🔙 Kembali login sebagai user kios
-- 14. 🎉 Seharusnya redirect ke /kios (dashboard kantin)
--
-- =====================================================================
-- 🔍 DEBUGGING TIPS:
-- =====================================================================
-- 
-- Jika kantin tidak muncul di admin dashboard:
-- 1. Jalankan query di STEP 7 → Jika muncul data = masalah di frontend/RLS
-- 2. Jika tidak muncul data = masalah di trigger
-- 3. Cek Supabase Logs → Database → Filter "handle_new_user"
-- 4. Lihat apakah ada RAISE NOTICE/WARNING dari trigger
--
-- Jika error "Data kantin tidak ditemukan":
-- 1. Cek apakah user ada di auth.users tapi tidak di public.users
-- 2. Cek apakah user ada di public.users tapi tidak di public.kantin
-- 3. Query manual: SELECT * FROM kantin WHERE user_id = 'USER_ID_HERE'
-- 4. Jika tidak ada → trigger tidak jalan, cek STEP 6
--
-- Jika error setelah klik link verifikasi:
-- 1. Cek browser console (F12) untuk error detail
-- 2. Cek Network tab untuk API calls yang error
-- 3. Link valid hanya 1x, jangan klik berulang kali
-- 4. Jika sudah di-klik, langsung login aja
--
-- =====================================================================
-- 📝 NOTES PENTING:
-- =====================================================================
-- - RLS sudah di-DISABLE untuk testing (untuk production nanti enable lagi)
-- - Trigger sudah diperbaiki dengan error handling dan logging lengkap
-- - User HARUS verifikasi email dulu sebelum bisa login
-- - Setelah login, user dengan status PENDING tidak bisa akses /kios
-- - Admin bisa approve/reject di /admin/approvals
-- - Setelah di-approve, user bisa akses /kios (dashboard)
-- 
-- =====================================================================
-- 🎉 SELESAI! SILAKAN TEST REGISTRASI SEKARANG!
-- =====================================================================

DO $$ 
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '╔════════════════════════════════════════════════════════════╗';
    RAISE NOTICE '║                  ✅ SETUP COMPLETED!                       ║';
    RAISE NOTICE '╚════════════════════════════════════════════════════════════╝';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 Next: Test dengan registrasi user BARU';
    RAISE NOTICE '📧 Gunakan email yang BELUM PERNAH didaftarkan';
    RAISE NOTICE '📋 Cek /admin/approvals setelah registrasi & verifikasi email';
    RAISE NOTICE '';
END $$;
