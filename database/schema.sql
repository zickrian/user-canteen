-- =============================================================================
-- KANTIN APP — COMPLETE SCHEMA V2 (PRODUCTION READY)
-- =============================================================================
-- ✅ Complete schema dengan RLS policies
-- ✅ Auto-delete storage saat hapus menu/kantin
-- ✅ Triggers untuk consistency
-- ✅ Functions untuk business logic
-- =============================================================================
-- CARA PAKAI:
-- 1. Buka Supabase Dashboard → SQL Editor
-- 2. Copy-paste SEMUA script ini
-- 3. Klik Run
-- 4. Done! ✅
-- =============================================================================

BEGIN;

-- ---------- EXTENSIONS ----------
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =============================================================================
-- STORAGE BUCKETS
-- =============================================================================
-- Buat storage buckets untuk gambar (jika belum ada)
-- Run di SQL Editor atau via Supabase Dashboard → Storage

-- Bucket untuk foto menu
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'menu-images',
  'menu-images',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/jpg', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Bucket untuk foto profil kantin
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-images',
  'profile-images',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/jpg', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- STORAGE POLICIES
-- =============================================================================

-- Policy untuk menu-images: semua authenticated user bisa upload/read/delete
DROP POLICY IF EXISTS "Menu images are publicly accessible" ON storage.objects;
CREATE POLICY "Menu images are publicly accessible"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'menu-images');

DROP POLICY IF EXISTS "Authenticated users can upload menu images" ON storage.objects;
CREATE POLICY "Authenticated users can upload menu images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'menu-images');

DROP POLICY IF EXISTS "Users can delete their own menu images" ON storage.objects;
CREATE POLICY "Users can delete their own menu images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'menu-images');

-- Policy untuk profile-images: semua authenticated user bisa upload/read/delete
DROP POLICY IF EXISTS "Profile images are publicly accessible" ON storage.objects;
CREATE POLICY "Profile images are publicly accessible"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'profile-images');

DROP POLICY IF EXISTS "Authenticated users can upload profile images" ON storage.objects;
CREATE POLICY "Authenticated users can upload profile images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'profile-images');

DROP POLICY IF EXISTS "Users can delete their own profile images" ON storage.objects;
CREATE POLICY "Users can delete their own profile images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'profile-images');

-- =============================================================================
-- TABLES
-- =============================================================================

-- =============================================================================
-- TABLES
-- =============================================================================

-- ---------- PUBLIC.USERS TABLE ----------
CREATE TABLE IF NOT EXISTS public.users (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      TEXT NOT NULL UNIQUE,
  role       TEXT NOT NULL CHECK (role IN ('admin', 'kios')) DEFAULT 'kios',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

-- ---------- ADMINS TABLE ----------
CREATE TABLE IF NOT EXISTS public.admins (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admins_user_id ON public.admins(user_id);

-- ---------- KANTIN TABLE ----------
CREATE TABLE IF NOT EXISTS public.kantin (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  nama_kantin    TEXT,
  foto_profil    TEXT,
  jam_buka       TEXT,
  jam_tutup      TEXT,
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','aktif','ditolak')),
  buka_tutup     BOOLEAN DEFAULT true,
  -- Bank account details untuk cashout
  bank_name      TEXT,
  account_number TEXT,
  account_name   TEXT,
  -- Balance tracking
  balance        NUMERIC(10,2) DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Add missing columns if they don't exist (safe for existing tables)
DO $$ 
BEGIN
  -- Add balance column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema='public' AND table_name='kantin' AND column_name='balance') THEN
    ALTER TABLE public.kantin ADD COLUMN balance NUMERIC(10,2) DEFAULT 0;
  END IF;
  
  -- Add bank_name column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema='public' AND table_name='kantin' AND column_name='bank_name') THEN
    ALTER TABLE public.kantin ADD COLUMN bank_name TEXT;
  END IF;
  
  -- Add account_number column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema='public' AND table_name='kantin' AND column_name='account_number') THEN
    ALTER TABLE public.kantin ADD COLUMN account_number TEXT;
  END IF;
  
  -- Add account_name column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema='public' AND table_name='kantin' AND column_name='account_name') THEN
    ALTER TABLE public.kantin ADD COLUMN account_name TEXT;
  END IF;
  
  -- Add buka_tutup column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema='public' AND table_name='kantin' AND column_name='buka_tutup') THEN
    ALTER TABLE public.kantin ADD COLUMN buka_tutup BOOLEAN DEFAULT true;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_kantin_user_id ON public.kantin(user_id);
CREATE INDEX IF NOT EXISTS idx_kantin_status ON public.kantin(status);

-- ---------- MENU TABLE ----------
CREATE TABLE IF NOT EXISTS public.menu (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kantin_id     UUID NOT NULL REFERENCES public.kantin(id) ON DELETE CASCADE,
  nama_menu     TEXT NOT NULL,
  harga         NUMERIC(10,2) NOT NULL,
  foto_menu     TEXT,
  deskripsi     TEXT,
  tersedia      BOOLEAN DEFAULT true,
  kategori_menu TEXT CHECK (kategori_menu IN ('Makan Pagi', 'Makan Siang', 'Snack', 'Minuman')),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_menu_kantin_id ON public.menu(kantin_id);
CREATE INDEX IF NOT EXISTS idx_menu_tersedia ON public.menu(tersedia);
CREATE INDEX IF NOT EXISTS idx_menu_kategori ON public.menu(kategori_menu);

-- ---------- PESANAN TABLE ----------
CREATE TABLE IF NOT EXISTS public.pesanan (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kantin_id     UUID NOT NULL REFERENCES public.kantin(id) ON DELETE CASCADE,
  nomor_antrian INTEGER NOT NULL,
  nama_pemesan  TEXT NOT NULL,
  catatan       TEXT,
  total_harga   NUMERIC(10,2) NOT NULL,
  status        TEXT NOT NULL DEFAULT 'menunggu' CHECK (status IN ('menunggu','diproses','selesai')),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pesanan_kantin_id ON public.pesanan(kantin_id);
CREATE INDEX IF NOT EXISTS idx_pesanan_status ON public.pesanan(status);

-- ---------- DETAIL_PESANAN TABLE ----------
CREATE TABLE IF NOT EXISTS public.detail_pesanan (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pesanan_id   UUID NOT NULL REFERENCES public.pesanan(id) ON DELETE CASCADE,
  menu_id      UUID NOT NULL REFERENCES public.menu(id) ON DELETE CASCADE,
  jumlah       INTEGER NOT NULL,
  harga_satuan NUMERIC(10,2) NOT NULL,
  subtotal     NUMERIC(10,2) NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_detail_pesanan_pesanan_id ON public.detail_pesanan(pesanan_id);
CREATE INDEX IF NOT EXISTS idx_detail_pesanan_menu_id ON public.detail_pesanan(menu_id);

-- ---------- CASHOUT TABLE ----------
CREATE TABLE IF NOT EXISTS public.cashout (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kantin_id      UUID NOT NULL REFERENCES public.kantin(id) ON DELETE CASCADE,
  amount         NUMERIC(10,2) NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','transferred')),
  requested_at   TIMESTAMPTZ DEFAULT NOW(),
  transferred_at TIMESTAMPTZ,
  transferred_by UUID REFERENCES auth.users(id),
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cashout_kantin_id ON public.cashout(kantin_id);
CREATE INDEX IF NOT EXISTS idx_cashout_status ON public.cashout(status);

-- =============================================================================
-- FUNCTIONS & TRIGGERS
-- =============================================================================

-- ---------- FUNCTION: Update updated_at timestamp ----------
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END $$;

-- Apply triggers
DROP TRIGGER IF EXISTS t_users_touch ON public.users;
CREATE TRIGGER t_users_touch BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS t_kantin_touch ON public.kantin;
CREATE TRIGGER t_kantin_touch BEFORE UPDATE ON public.kantin
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS t_menu_touch ON public.menu;
CREATE TRIGGER t_menu_touch BEFORE UPDATE ON public.menu
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS t_pesanan_touch ON public.pesanan;
CREATE TRIGGER t_pesanan_touch BEFORE UPDATE ON public.pesanan
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS t_cashout_touch ON public.cashout;
CREATE TRIGGER t_cashout_touch BEFORE UPDATE ON public.cashout
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ---------- FUNCTION: Delete storage file ----------
CREATE OR REPLACE FUNCTION public.delete_storage_object(bucket TEXT, object_path TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM storage.objects
  WHERE bucket_id = bucket AND name = object_path;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error tapi jangan block transaction
    RAISE WARNING 'Failed to delete storage object: % in bucket %', object_path, bucket;
END $$;

-- ---------- TRIGGER: Auto-delete menu image saat menu dihapus ----------
CREATE OR REPLACE FUNCTION public.delete_menu_image()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  image_path TEXT;
BEGIN
  -- Extract path dari URL (ambil setelah /menu-images/)
  IF OLD.foto_menu IS NOT NULL AND OLD.foto_menu != '' THEN
    -- Format URL: https://.../storage/v1/object/public/menu-images/filename.jpg
    image_path := substring(OLD.foto_menu from '.*/menu-images/(.+)$');
    
    IF image_path IS NOT NULL THEN
      PERFORM public.delete_storage_object('menu-images', image_path);
    END IF;
  END IF;
  
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS trg_delete_menu_image ON public.menu;
CREATE TRIGGER trg_delete_menu_image
BEFORE DELETE ON public.menu
FOR EACH ROW EXECUTE FUNCTION public.delete_menu_image();

-- ---------- TRIGGER: Auto-delete profile image saat kantin dihapus ----------
CREATE OR REPLACE FUNCTION public.delete_kantin_image()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  image_path TEXT;
BEGIN
  -- Extract path dari URL
  IF OLD.foto_profil IS NOT NULL AND OLD.foto_profil != '' THEN
    -- Format URL: https://.../storage/v1/object/public/profile-images/filename.jpg
    image_path := substring(OLD.foto_profil from '.*/profile-images/(.+)$');
    
    IF image_path IS NOT NULL THEN
      PERFORM public.delete_storage_object('profile-images', image_path);
    END IF;
  END IF;
  
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS trg_delete_kantin_image ON public.kantin;
CREATE TRIGGER trg_delete_kantin_image
BEFORE DELETE ON public.kantin
FOR EACH ROW EXECUTE FUNCTION public.delete_kantin_image();

-- ---------- TRIGGER: Cleanup kantin saat user jadi admin ----------
CREATE OR REPLACE FUNCTION public.on_admin_added_cleanup()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  -- Hapus kantin milik admin (akan trigger delete image juga)
  DELETE FROM public.kantin WHERE user_id = NEW.user_id;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_admin_cleanup ON public.admins;
CREATE TRIGGER trg_admin_cleanup
AFTER INSERT ON public.admins
FOR EACH ROW EXECUTE FUNCTION public.on_admin_added_cleanup();

-- ---------- TRIGGER: Provision kantin untuk user baru ----------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_nama_kantin TEXT;
  v_jam_buka TEXT;
  v_jam_tutup TEXT;
BEGIN
  -- Insert ke public.users
  INSERT INTO public.users (id, email, role)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'role', 'kios'))
  ON CONFLICT (id) DO NOTHING;

  -- Buat kantin pending untuk non-admin
  IF NOT EXISTS (SELECT 1 FROM public.admins WHERE user_id = NEW.id) THEN
    -- Get data from metadata or use defaults
    v_nama_kantin := COALESCE(
      NEW.raw_user_meta_data->>'nama_kantin',
      CONCAT('Kios ', SPLIT_PART(NEW.email, '@', 1))
    );
    v_jam_buka := COALESCE(NEW.raw_user_meta_data->>'jam_buka', '08:00');
    v_jam_tutup := COALESCE(NEW.raw_user_meta_data->>'jam_tutup', '17:00');
    
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
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------- TRIGGER: Update kantin balance saat order selesai ----------
CREATE OR REPLACE FUNCTION public.update_kantin_balance_on_order_complete()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  -- Saat order jadi 'selesai', tambah balance
  IF NEW.status = 'selesai' AND (TG_OP = 'INSERT' OR OLD.status != 'selesai') THEN
    UPDATE public.kantin
    SET balance = balance + NEW.total_harga
    WHERE id = NEW.kantin_id;
  END IF;

  -- Saat order di-update dari 'selesai' ke status lain, kurangi balance
  IF TG_OP = 'UPDATE' AND OLD.status = 'selesai' AND NEW.status != 'selesai' THEN
    UPDATE public.kantin
    SET balance = balance - OLD.total_harga
    WHERE id = OLD.kantin_id;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_update_balance ON public.pesanan;
CREATE TRIGGER trg_update_balance
AFTER INSERT OR UPDATE ON public.pesanan
FOR EACH ROW EXECUTE FUNCTION public.update_kantin_balance_on_order_complete();

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kantin ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pesanan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.detail_pesanan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cashout ENABLE ROW LEVEL SECURITY;

-- ---------- USERS POLICIES ----------
DROP POLICY IF EXISTS users_select_authenticated ON public.users;
CREATE POLICY users_select_authenticated
ON public.users FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS users_update_own ON public.users;
CREATE POLICY users_update_own
ON public.users FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- ---------- ADMINS POLICIES ----------
DROP POLICY IF EXISTS admins_select_self ON public.admins;
CREATE POLICY admins_select_self
ON public.admins FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- ---------- KANTIN POLICIES ----------

-- Publik bisa lihat kantin aktif
DROP POLICY IF EXISTS kantin_select_public_aktif ON public.kantin;
CREATE POLICY kantin_select_public_aktif
ON public.kantin FOR SELECT
TO public
USING (status = 'aktif');

-- Pemilik lihat & update kantinnya
DROP POLICY IF EXISTS kantin_select_own ON public.kantin;
CREATE POLICY kantin_select_own
ON public.kantin FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS kantin_update_own ON public.kantin;
CREATE POLICY kantin_update_own
ON public.kantin FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Admin manage semua kantin
DROP POLICY IF EXISTS kantin_admin_all ON public.kantin;
CREATE POLICY kantin_admin_all
ON public.kantin FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()));

-- ---------- MENU POLICIES ----------

-- Publik lihat menu tersedia dari kantin aktif
DROP POLICY IF EXISTS menu_select_public_aktif ON public.menu;
CREATE POLICY menu_select_public_aktif
ON public.menu FOR SELECT
TO public
USING (
  tersedia = true
  AND EXISTS (SELECT 1 FROM public.kantin k WHERE k.id = menu.kantin_id AND k.status = 'aktif')
);

-- Pemilik kios lihat & kelola menunya
DROP POLICY IF EXISTS menu_kios_view_own ON public.menu;
CREATE POLICY menu_kios_view_own
ON public.menu FOR SELECT
TO authenticated
USING (kantin_id IN (SELECT id FROM public.kantin WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS menu_kios_manage_own ON public.menu;
CREATE POLICY menu_kios_manage_own
ON public.menu FOR ALL
TO authenticated
USING (kantin_id IN (SELECT id FROM public.kantin WHERE user_id = auth.uid()))
WITH CHECK (kantin_id IN (SELECT id FROM public.kantin WHERE user_id = auth.uid()));

-- Admin lihat semua menu
DROP POLICY IF EXISTS menu_admin_view ON public.menu;
CREATE POLICY menu_admin_view
ON public.menu FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()));

-- ---------- PESANAN POLICIES ----------

-- Admin lihat semua pesanan
DROP POLICY IF EXISTS pesanan_admin_view ON public.pesanan;
CREATE POLICY pesanan_admin_view
ON public.pesanan FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()));

-- Kios lihat & update pesanannya
DROP POLICY IF EXISTS pesanan_kios_view_own ON public.pesanan;
CREATE POLICY pesanan_kios_view_own
ON public.pesanan FOR SELECT
TO authenticated
USING (kantin_id IN (SELECT id FROM public.kantin WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS pesanan_kios_update_own ON public.pesanan;
CREATE POLICY pesanan_kios_update_own
ON public.pesanan FOR UPDATE
TO authenticated
USING (kantin_id IN (SELECT id FROM public.kantin WHERE user_id = auth.uid()))
WITH CHECK (kantin_id IN (SELECT id FROM public.kantin WHERE user_id = auth.uid()));

-- ---------- DETAIL_PESANAN POLICIES ----------

DROP POLICY IF EXISTS dp_admin_view ON public.detail_pesanan;
CREATE POLICY dp_admin_view
ON public.detail_pesanan FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS dp_kios_view_own ON public.detail_pesanan;
CREATE POLICY dp_kios_view_own
ON public.detail_pesanan FOR SELECT
TO authenticated
USING (
  pesanan_id IN (
    SELECT id FROM public.pesanan WHERE kantin_id IN (
      SELECT id FROM public.kantin WHERE user_id = auth.uid()
    )
  )
);

-- ---------- CASHOUT POLICIES ----------

-- Kios manage cashout sendiri
DROP POLICY IF EXISTS cashout_kios_view ON public.cashout;
CREATE POLICY cashout_kios_view
ON public.cashout FOR SELECT
TO authenticated
USING (kantin_id IN (SELECT id FROM public.kantin WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS cashout_kios_insert ON public.cashout;
CREATE POLICY cashout_kios_insert
ON public.cashout FOR INSERT
TO authenticated
WITH CHECK (kantin_id IN (SELECT id FROM public.kantin WHERE user_id = auth.uid()));

-- Admin manage semua cashout
DROP POLICY IF EXISTS cashout_admin_all ON public.cashout;
CREATE POLICY cashout_admin_all
ON public.cashout FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()));

-- =============================================================================
-- RPC FUNCTIONS (Business Logic)
-- =============================================================================

-- Drop existing functions to avoid signature conflicts
DROP FUNCTION IF EXISTS public.is_admin();
DROP FUNCTION IF EXISTS public.can_access_kios();
DROP FUNCTION IF EXISTS public.bootstrap_after_login();
DROP FUNCTION IF EXISTS public.get_public_kantin();
DROP FUNCTION IF EXISTS public.approve_kios(UUID);
DROP FUNCTION IF EXISTS public.reject_kios(UUID);
DROP FUNCTION IF EXISTS public.reject_kios(UUID, TEXT);
DROP FUNCTION IF EXISTS public.get_admin_users();
DROP FUNCTION IF EXISTS public.get_admin_kantins();
DROP FUNCTION IF EXISTS public.get_admin_pesanan();
DROP FUNCTION IF EXISTS public.request_cashout(UUID, NUMERIC);
DROP FUNCTION IF EXISTS public.confirm_cashout_transfer(UUID);
DROP FUNCTION IF EXISTS public.get_kantin_cashout_history(UUID);
DROP FUNCTION IF EXISTS public.get_pending_cashouts();
DROP FUNCTION IF EXISTS public.get_kantin_balance_and_bank(UUID);
DROP FUNCTION IF EXISTS public.get_daily_sales_chart(UUID, DATE);
DROP FUNCTION IF EXISTS public.get_sales_trend(UUID, INTEGER);
DROP FUNCTION IF EXISTS public.check_email_status(TEXT);

-- ---------- UTIL FUNCTIONS ----------

-- Check if user is admin
CREATE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid());
$$;

-- Check if user can access kios dashboard
CREATE FUNCTION public.can_access_kios()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.kantin k
    WHERE k.user_id = auth.uid() AND k.status = 'aktif'
  );
$$;

-- Bootstrap user data after login
CREATE FUNCTION public.bootstrap_after_login()
RETURNS TABLE (role TEXT, kantin_status TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT
    u.role,
    (SELECT k.status FROM public.kantin k WHERE k.user_id = u.id LIMIT 1) AS kantin_status
  FROM public.users u
  WHERE u.id = auth.uid();
$$;

-- Get public kantin list (homepage)
CREATE FUNCTION public.get_public_kantin()
RETURNS TABLE (kantin_id UUID, nama_kantin TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT id, nama_kantin
  FROM public.kantin
  WHERE status = 'aktif'
  ORDER BY nama_kantin;
$$;

-- Check email registration status (untuk halaman /status-akun-cek)
CREATE FUNCTION public.check_email_status(p_email TEXT)
RETURNS TABLE (
  found BOOLEAN,
  status TEXT,
  nama_kantin TEXT,
  registered_at TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT
    TRUE AS found,
    k.status,
    k.nama_kantin,
    k.created_at AS registered_at
  FROM public.users u
  LEFT JOIN public.kantin k ON k.user_id = u.id
  WHERE LOWER(u.email) = LOWER(p_email)
  LIMIT 1;
$$;

-- ---------- ADMIN: APPROVE/REJECT KIOS ----------

CREATE FUNCTION public.approve_kios(p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_email TEXT;
  v_kantin_nama TEXT;
BEGIN
  -- Check if caller is admin
  IF NOT EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Only admin can approve kios';
  END IF;

  -- Get user email and kantin name for notification
  SELECT u.email, k.nama_kantin INTO v_email, v_kantin_nama
  FROM public.users u
  INNER JOIN public.kantin k ON k.user_id = u.id
  WHERE u.id = p_user_id;

  IF v_email IS NULL THEN
    RAISE EXCEPTION 'User or kantin not found';
  END IF;

  -- Update kantin status
  UPDATE public.kantin
  SET status = 'aktif', updated_at = NOW()
  WHERE user_id = p_user_id AND status = 'pending';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Kantin not found or already processed';
  END IF;

  -- Note: Email notification akan dikirim via Supabase Edge Function atau aplikasi
  -- karena PostgreSQL tidak bisa langsung kirim email
  RAISE NOTICE 'Kantin % (%) has been approved', v_kantin_nama, v_email;
END $$;

CREATE FUNCTION public.reject_kios(p_user_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_email TEXT;
  v_kantin_nama TEXT;
BEGIN
  -- Check if caller is admin
  IF NOT EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Only admin can reject kios';
  END IF;

  -- Get user email and kantin name for notification
  SELECT u.email, k.nama_kantin INTO v_email, v_kantin_nama
  FROM public.users u
  INNER JOIN public.kantin k ON k.user_id = u.id
  WHERE u.id = p_user_id;

  IF v_email IS NULL THEN
    RAISE EXCEPTION 'User or kantin not found';
  END IF;

  -- Update kantin status
  UPDATE public.kantin
  SET status = 'ditolak', updated_at = NOW()
  WHERE user_id = p_user_id AND status = 'pending';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Kantin not found or already processed';
  END IF;

  -- Note: Email notification dengan alasan penolakan akan dikirim via aplikasi
  RAISE NOTICE 'Kantin % (%) has been rejected. Reason: %', v_kantin_nama, v_email, COALESCE(p_reason, 'No reason provided');
END $$;

-- ---------- ADMIN: GET DATA ----------

CREATE FUNCTION public.get_admin_users()
RETURNS TABLE (
  id UUID,
  email TEXT,
  role TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT id, email, role, created_at, updated_at
  FROM public.users
  ORDER BY created_at DESC;
$$;

CREATE FUNCTION public.get_admin_kantins()
RETURNS TABLE (
  id UUID,
  user_id UUID,
  nama_kantin TEXT,
  foto_profil TEXT,
  jam_buka TEXT,
  jam_tutup TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  user_email TEXT,
  user_role TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT
    k.id,
    k.user_id,
    k.nama_kantin,
    k.foto_profil,
    k.jam_buka,
    k.jam_tutup,
    k.status,
    k.created_at,
    k.updated_at,
    u.email AS user_email,
    u.role AS user_role
  FROM public.kantin k
  INNER JOIN public.users u ON k.user_id = u.id
  ORDER BY k.created_at DESC;
$$;

CREATE FUNCTION public.get_admin_pesanan()
RETURNS TABLE (
  id UUID,
  kantin_id UUID,
  nomor_antrian INTEGER,
  nama_pemesan TEXT,
  catatan TEXT,
  total_harga NUMERIC,
  status TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  kantin_nama TEXT,
  detail_items JSONB
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT
    p.id,
    p.kantin_id,
    p.nomor_antrian,
    p.nama_pemesan,
    p.catatan,
    p.total_harga,
    p.status,
    p.created_at,
    p.updated_at,
    k.nama_kantin AS kantin_nama,
    (
      SELECT JSONB_AGG(
        JSONB_BUILD_OBJECT(
          'id', dp.id,
          'jumlah', dp.jumlah,
          'harga_satuan', dp.harga_satuan,
          'subtotal', dp.subtotal,
          'menu', JSONB_BUILD_OBJECT(
            'nama_menu', m.nama_menu,
            'harga', m.harga
          )
        )
      )
      FROM public.detail_pesanan dp
      INNER JOIN public.menu m ON dp.menu_id = m.id
      WHERE dp.pesanan_id = p.id
    ) AS detail_items
  FROM public.pesanan p
  INNER JOIN public.kantin k ON p.kantin_id = k.id
  ORDER BY p.created_at DESC;
$$;

-- ---------- CASHOUT OPERATIONS ----------

CREATE FUNCTION public.request_cashout(p_kantin_id UUID, p_amount NUMERIC)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_cashout_id UUID;
  v_current_balance NUMERIC;
  v_minimum_balance NUMERIC := 100000;
BEGIN
  -- Check if caller is kios owner
  IF NOT EXISTS (
    SELECT 1 FROM public.kantin k
    WHERE k.id = p_kantin_id AND k.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only kios owner can request cashout';
  END IF;

  -- Get current balance
  SELECT COALESCE(balance, 0) INTO v_current_balance
  FROM public.kantin
  WHERE id = p_kantin_id;

  -- Validations
  IF v_current_balance < v_minimum_balance THEN
    RAISE EXCEPTION 'Minimum balance of Rp % required. Current: Rp %',
      v_minimum_balance, v_current_balance;
  END IF;

  IF p_amount > v_current_balance THEN
    RAISE EXCEPTION 'Requested amount exceeds balance of Rp %', v_current_balance;
  END IF;

  IF p_amount < v_minimum_balance THEN
    RAISE EXCEPTION 'Minimum cashout amount is Rp %', v_minimum_balance;
  END IF;

  -- Insert cashout request
  INSERT INTO public.cashout (kantin_id, amount, status)
  VALUES (p_kantin_id, p_amount, 'pending')
  RETURNING id INTO v_cashout_id;

  RETURN v_cashout_id;
END $$;

CREATE FUNCTION public.confirm_cashout_transfer(p_cashout_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_kantin_id UUID;
  v_amount NUMERIC;
BEGIN
  -- Check if caller is admin
  IF NOT EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Only admin can confirm cashout transfer';
  END IF;

  -- Get cashout details
  SELECT kantin_id, amount INTO v_kantin_id, v_amount
  FROM public.cashout
  WHERE id = p_cashout_id AND status = 'pending';

  IF v_kantin_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or already processed cashout request';
  END IF;

  -- Update cashout status
  UPDATE public.cashout
  SET
    status = 'transferred',
    transferred_at = NOW(),
    transferred_by = auth.uid()
  WHERE id = p_cashout_id AND status = 'pending';

  -- Deduct balance from kantin
  UPDATE public.kantin
  SET balance = balance - v_amount
  WHERE id = v_kantin_id;
END $$;

CREATE FUNCTION public.get_kantin_cashout_history(p_kantin_id UUID)
RETURNS TABLE (
  id UUID,
  kantin_id UUID,
  amount NUMERIC,
  status TEXT,
  requested_at TIMESTAMPTZ,
  transferred_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT
    c.id,
    c.kantin_id,
    c.amount,
    c.status,
    c.requested_at,
    c.transferred_at,
    c.created_at
  FROM public.cashout c
  WHERE c.kantin_id = p_kantin_id
  ORDER BY c.requested_at DESC;
$$;

CREATE FUNCTION public.get_pending_cashouts()
RETURNS TABLE (
  id UUID,
  kantin_id UUID,
  kantin_nama TEXT,
  amount NUMERIC,
  status TEXT,
  requested_at TIMESTAMPTZ,
  user_email TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT
    c.id,
    c.kantin_id,
    k.nama_kantin AS kantin_nama,
    c.amount,
    c.status,
    c.requested_at,
    u.email AS user_email
  FROM public.cashout c
  INNER JOIN public.kantin k ON c.kantin_id = k.id
  INNER JOIN public.users u ON k.user_id = u.id
  WHERE c.status = 'pending'
  ORDER BY c.requested_at ASC;
$$;

CREATE FUNCTION public.get_kantin_balance_and_bank(p_kantin_id UUID)
RETURNS TABLE (
  kantin_id UUID,
  nama_kantin TEXT,
  balance NUMERIC,
  bank_name TEXT,
  account_number TEXT,
  account_name TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT
    k.id,
    k.nama_kantin,
    k.balance,
    k.bank_name,
    k.account_number,
    k.account_name
  FROM public.kantin k
  WHERE k.id = p_kantin_id;
$$;

-- ---------- SALES & STATS ----------

CREATE FUNCTION public.get_daily_sales_chart(p_kantin_id UUID, p_date DATE)
RETURNS TABLE (
  hour INTEGER,
  total_sales NUMERIC
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT
    EXTRACT(HOUR FROM created_at)::INTEGER AS hour,
    COALESCE(SUM(total_harga), 0) AS total_sales
  FROM public.pesanan
  WHERE kantin_id = p_kantin_id
    AND DATE(created_at) = p_date
    AND status = 'selesai'
  GROUP BY EXTRACT(HOUR FROM created_at)
  ORDER BY hour;
$$;

CREATE FUNCTION public.get_sales_trend(p_kantin_id UUID, p_days INTEGER DEFAULT 7)
RETURNS TABLE (
  date DATE,
  total_sales NUMERIC,
  order_count BIGINT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT
    DATE(created_at) AS date,
    COALESCE(SUM(total_harga), 0) AS total_sales,
    COUNT(*) AS order_count
  FROM public.pesanan
  WHERE kantin_id = p_kantin_id
    AND created_at >= CURRENT_DATE - (p_days || ' days')::INTERVAL
    AND status = 'selesai'
  GROUP BY DATE(created_at)
  ORDER BY date;
$$;

-- ---------- MIGRATE EXISTING USERS (Safe) ----------

-- Auto-insert existing auth.users into public.users if not exists
insert into public.users (id, email, role)
select 
  au.id,
  au.email,
  case 
    when exists (select 1 from public.admins a where a.user_id = au.id) then 'admin'
    else 'kios'
  end as role
from auth.users au
where not exists (select 1 from public.users u where u.id = au.id)
on conflict (id) do nothing;

commit;

-- =============================================================================
-- ✅ SCHEMA COMPLETE! 
-- =============================================================================
-- Check with this query:
-- SELECT 
--   (SELECT COUNT(*) FROM auth.users) as auth_users,
--   (SELECT COUNT(*) FROM public.users) as public_users,
--   (SELECT COUNT(*) FROM public.kantin) as kantins;
-- =============================================================================
