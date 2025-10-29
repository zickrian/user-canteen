-- =============================================================================
-- DEBUG & FIX: Database Error Saving New User
-- =============================================================================
-- Error ini biasanya disebabkan oleh:
-- 1. Trigger handle_new_user() error saat insert ke public.users atau public.kantin
-- 2. RLS policies yang terlalu ketat
-- 3. Permissions issue
-- =============================================================================
-- CARA DEBUG:
-- 1. Jalankan script ini di Supabase SQL Editor
-- 2. Coba registrasi lagi
-- 3. Lihat hasil query di bagian "CHECK AFTER REGISTRATION"
-- =============================================================================

-- =============================================================================
-- STEP 1: CEK TRIGGER HANDLE_NEW_USER
-- =============================================================================
-- Cek apakah trigger sudah ada dan benar
SELECT 
    t.tgname AS trigger_name,
    t.tgenabled AS enabled,
    p.proname AS function_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE t.tgname = 'on_auth_user_created';

-- Expected result: 
-- trigger_name: on_auth_user_created
-- enabled: O (enabled)
-- function_name: handle_new_user

-- =============================================================================
-- STEP 2: UPDATE TRIGGER (DENGAN ERROR HANDLING)
-- =============================================================================
-- Trigger baru dengan better error handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_nama_kantin TEXT;
  v_jam_buka TEXT;
  v_jam_tutup TEXT;
BEGIN
  -- Log untuk debugging
  RAISE NOTICE 'Trigger handle_new_user fired for user: %', NEW.id;
  
  -- Insert ke public.users
  BEGIN
    INSERT INTO public.users (id, email, role)
    VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'role', 'kios'))
    ON CONFLICT (id) DO NOTHING;
    
    RAISE NOTICE 'User inserted successfully: %', NEW.id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to insert user: % - %', SQLERRM, SQLSTATE;
    -- Jangan block trigger, lanjutkan
  END;

  -- Buat kantin pending untuk non-admin
  IF NOT EXISTS (SELECT 1 FROM public.admins WHERE user_id = NEW.id) THEN
    BEGIN
      -- Ambil data dari metadata registrasi
      v_nama_kantin := COALESCE(
        NEW.raw_user_meta_data->>'nama_kantin',
        CONCAT('Kios ', SPLIT_PART(NEW.email, '@', 1))
      );
      v_jam_buka := COALESCE(NEW.raw_user_meta_data->>'jam_buka', '08:00');
      v_jam_tutup := COALESCE(NEW.raw_user_meta_data->>'jam_tutup', '17:00');
      
      RAISE NOTICE 'Creating kantin with name: %, buka: %, tutup: %', v_nama_kantin, v_jam_buka, v_jam_tutup;
      
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
        'pending',
        v_jam_buka,
        v_jam_tutup,
        true
      )
      ON CONFLICT (user_id) DO NOTHING;
      
      RAISE NOTICE 'Kantin created successfully for user: %', NEW.id;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to create kantin: % - %', SQLERRM, SQLSTATE;
      -- Jangan block trigger
    END;
  END IF;

  RETURN NEW;
END $$;

-- =============================================================================
-- STEP 3: CEK & FIX RLS POLICIES
-- =============================================================================

-- A. CEK RLS STATUS
SELECT 
    schemaname,
    tablename,
    rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename IN ('users', 'kantin');

-- B. TEMPORARY: DISABLE RLS untuk public.users dan public.kantin
-- Ini untuk testing saja, nanti enable lagi setelah registrasi berhasil
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.kantin DISABLE ROW LEVEL SECURITY;

-- ATAU jika ingin tetap enable RLS, tambahkan policy bypass untuk trigger:

-- Policy untuk trigger/system bisa insert
DROP POLICY IF EXISTS "Enable insert for authenticated users during signup" ON public.users;
CREATE POLICY "Enable insert for authenticated users during signup"
ON public.users FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Enable insert for authenticated users during signup" ON public.kantin;
CREATE POLICY "Enable insert for authenticated users during signup"
ON public.kantin FOR INSERT
WITH CHECK (true);

-- =============================================================================
-- STEP 4: CEK PERMISSIONS
-- =============================================================================

-- Grant permissions ke authenticated users
GRANT INSERT ON public.users TO authenticated;
GRANT INSERT ON public.kantin TO authenticated;
GRANT SELECT ON public.users TO authenticated;
GRANT SELECT ON public.kantin TO authenticated;

-- Grant untuk service_role (trigger uses this)
GRANT ALL ON public.users TO service_role;
GRANT ALL ON public.kantin TO service_role;

-- =============================================================================
-- STEP 5: VERIFY SETUP
-- =============================================================================

-- Cek policies yang aktif
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename IN ('users', 'kantin')
ORDER BY tablename, policyname;

-- =============================================================================
-- STEP 6: TEST TRIGGER MANUALLY (OPTIONAL)
-- =============================================================================

-- Insert test user ke auth.users untuk trigger test
-- JANGAN JALANKAN INI kalau sudah ada user dengan email ini!
/*
INSERT INTO auth.users (
    id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_user_meta_data,
    created_at,
    updated_at
)
VALUES (
    gen_random_uuid(),
    'test-trigger@example.com',
    crypt('testpassword', gen_salt('bf')),
    NOW(),
    '{"role": "kios", "nama_kantin": "Test Kantin", "jam_buka": "08:00", "jam_tutup": "16:00"}'::jsonb,
    NOW(),
    NOW()
);
*/

-- =============================================================================
-- STEP 7: CHECK AFTER REGISTRATION
-- =============================================================================

-- Setelah coba registrasi, cek apakah data masuk:

-- Cek auth.users
SELECT 
    id,
    email,
    email_confirmed_at,
    raw_user_meta_data,
    created_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 5;

-- Cek public.users
SELECT * FROM public.users
ORDER BY created_at DESC
LIMIT 5;

-- Cek public.kantin
SELECT 
    k.*,
    u.email
FROM public.kantin k
LEFT JOIN public.users u ON k.user_id = u.id
ORDER BY k.created_at DESC
LIMIT 5;

-- =============================================================================
-- NOTES PENTING
-- =============================================================================

-- 1. Jika RLS di-disable, ENABLE kembali setelah registrasi berhasil:
--    ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
--    ALTER TABLE public.kantin ENABLE ROW LEVEL SECURITY;

-- 2. Cek Supabase logs di Dashboard > Database > Logs untuk error detail

-- 3. Pastikan Email Settings di Supabase sudah benar:
--    Dashboard > Authentication > Email Templates

-- 4. Jika masih error, cek Supabase service_role key di .env.local

-- =============================================================================
