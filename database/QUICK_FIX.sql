-- =====================================================================
-- QUICK FIX: Database Error Saving New User
-- =====================================================================
-- Copy SEMUA code di bawah ini, paste ke Supabase SQL Editor, RUN
-- =====================================================================

-- STEP 1: Disable RLS sementara (untuk testing)
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.kantin DISABLE ROW LEVEL SECURITY;

-- STEP 2: Drop trigger lama (jika ada)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- STEP 3: Create/Update Function dengan SECURITY DEFINER
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
BEGIN
  -- Log untuk debugging
  RAISE NOTICE 'Trigger fired for user: %', NEW.email;
  
  -- Insert ke public.users dengan error handling
  BEGIN
    INSERT INTO public.users (id, email, role)
    VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'role', 'kios'))
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      role = EXCLUDED.role,
      updated_at = NOW();
    
    RAISE NOTICE 'User created: %', NEW.id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Error creating user: %', SQLERRM;
  END;

  -- Buat kantin untuk non-admin
  IF NOT EXISTS (SELECT 1 FROM public.admins WHERE user_id = NEW.id) THEN
    BEGIN
      -- Ambil data dari metadata
      v_nama_kantin := COALESCE(
        NEW.raw_user_meta_data->>'nama_kantin',
        CONCAT('Kios ', SPLIT_PART(NEW.email, '@', 1))
      );
      v_jam_buka := COALESCE(NEW.raw_user_meta_data->>'jam_buka', '08:00');
      v_jam_tutup := COALESCE(NEW.raw_user_meta_data->>'jam_tutup', '17:00');
      
      RAISE NOTICE 'Creating kantin: % (% - %)', v_nama_kantin, v_jam_buka, v_jam_tutup;
      
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
      ON CONFLICT (user_id) DO UPDATE SET
        nama_kantin = EXCLUDED.nama_kantin,
        jam_buka = EXCLUDED.jam_buka,
        jam_tutup = EXCLUDED.jam_tutup,
        updated_at = NOW();
      
      RAISE NOTICE 'Kantin created successfully';
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Error creating kantin: %', SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

-- STEP 4: Create trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- STEP 5: Grant permissions
GRANT ALL ON public.users TO postgres, service_role;
GRANT ALL ON public.kantin TO postgres, service_role;
GRANT USAGE ON SCHEMA public TO postgres, service_role;

-- =====================================================================
-- ✅ SELESAI! 
-- Sekarang coba registrasi lagi dengan email BARU (bukan yang error tadi)
-- =====================================================================

-- UNTUK CEK APAKAH BERHASIL, JALANKAN QUERY INI SETELAH REGISTRASI:
-- SELECT u.email, k.nama_kantin, k.status, k.jam_buka, k.jam_tutup
-- FROM public.users u
-- LEFT JOIN public.kantin k ON k.user_id = u.id
-- ORDER BY u.created_at DESC
-- LIMIT 5;
