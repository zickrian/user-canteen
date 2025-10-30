-- =============================================================================
-- FIX PESANAN TABLE - Lengkap dengan fungsi nomor antrian dan balance fix
-- =============================================================================
-- Jalankan script ini di Supabase SQL Editor untuk memperbaiki:
-- 1. Fungsi get_next_nomor_antrian tidak ditemukan
-- 2. Balance tidak berkurang saat pesanan dihapus
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. Tambahkan kolom yang hilang ke tabel pesanan jika belum ada
-- =============================================================================
DO $$ 
BEGIN
  -- Add email column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema='public' AND table_name='pesanan' AND column_name='email') THEN
    ALTER TABLE public.pesanan ADD COLUMN email TEXT;
  END IF;
  
  -- Add nomor_meja column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema='public' AND table_name='pesanan' AND column_name='nomor_meja') THEN
    ALTER TABLE public.pesanan ADD COLUMN nomor_meja TEXT;
  END IF;
  
  -- Add tipe_pesanan column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema='public' AND table_name='pesanan' AND column_name='tipe_pesanan') THEN
    ALTER TABLE public.pesanan ADD COLUMN tipe_pesanan TEXT CHECK (tipe_pesanan IN ('dine_in', 'take_away'));
  END IF;
END $$;

-- Drop semua constraint lama yang terkait dengan tipe_pesanan
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  FOR constraint_name IN
    SELECT conname 
    FROM pg_constraint 
    WHERE conrelid = 'public.pesanan'::regclass
    AND conname LIKE '%tipe_pesanan%'
  LOOP
    EXECUTE 'ALTER TABLE public.pesanan DROP CONSTRAINT IF EXISTS ' || constraint_name;
  END LOOP;
END $$;

-- Tambahkan constraint yang benar dengan format 'dine_in' dan 'take_away'
ALTER TABLE public.pesanan DROP CONSTRAINT IF EXISTS pesanan_tipe_pesanan_check;
ALTER TABLE public.pesanan ADD CONSTRAINT pesanan_tipe_pesanan_check 
CHECK (tipe_pesanan IS NULL OR tipe_pesanan IN ('dine_in', 'take_away'));

-- =============================================================================
-- 2. Buat fungsi untuk mendapatkan nomor antrian berikutnya secara sequential
-- =============================================================================
DROP FUNCTION IF EXISTS public.get_next_nomor_antrian(UUID);

CREATE FUNCTION public.get_next_nomor_antrian(p_kantin_id UUID)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_next_number INTEGER;
BEGIN
  -- Get the maximum nomor_antrian for this kantin and add 1, or start from 1 if no orders exist
  SELECT COALESCE(MAX(nomor_antrian), 0) + 1 INTO v_next_number
  FROM public.pesanan
  WHERE kantin_id = p_kantin_id;
  
  RETURN v_next_number;
END $$;

-- =============================================================================
-- 3. Perbaiki fungsi update balance untuk handle DELETE juga
-- =============================================================================
CREATE OR REPLACE FUNCTION public.update_kantin_balance_on_order_complete()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  -- Handle INSERT: Saat order jadi 'selesai', tambah balance
  IF TG_OP = 'INSERT' AND NEW.status = 'selesai' THEN
    UPDATE public.kantin
    SET balance = balance + NEW.total_harga
    WHERE id = NEW.kantin_id;
  END IF;

  -- Handle UPDATE: Saat order di-update dari 'selesai' ke status lain, kurangi balance
  IF TG_OP = 'UPDATE' AND OLD.status = 'selesai' AND NEW.status != 'selesai' THEN
    UPDATE public.kantin
    SET balance = balance - OLD.total_harga
    WHERE id = OLD.kantin_id;
  END IF;

  -- Handle UPDATE: Saat order di-update dari status lain ke 'selesai', tambah balance
  IF TG_OP = 'UPDATE' AND OLD.status != 'selesai' AND NEW.status = 'selesai' THEN
    UPDATE public.kantin
    SET balance = balance + NEW.total_harga
    WHERE id = NEW.kantin_id;
  END IF;

  -- Handle DELETE: Saat pesanan dihapus dan statusnya 'selesai', kurangi balance
  IF TG_OP = 'DELETE' AND OLD.status = 'selesai' THEN
    UPDATE public.kantin
    SET balance = balance - OLD.total_harga
    WHERE id = OLD.kantin_id;
  END IF;

  -- Return appropriate value based on operation
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END $$;

-- Recreate trigger untuk INSERT, UPDATE, dan DELETE
DROP TRIGGER IF EXISTS trg_update_balance ON public.pesanan;
CREATE TRIGGER trg_update_balance
AFTER INSERT OR UPDATE OR DELETE ON public.pesanan
FOR EACH ROW EXECUTE FUNCTION public.update_kantin_balance_on_order_complete();

COMMIT;

-- =============================================================================
-- ✅ SELESAI!
-- =============================================================================
-- Verifikasi dengan query:
-- 
-- 1. Cek fungsi sudah ada:
-- SELECT routine_name FROM information_schema.routines 
-- WHERE routine_schema = 'public' AND routine_name = 'get_next_nomor_antrian';
--
-- 2. Cek kolom pesanan:
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_schema='public' AND table_name='pesanan';
--
-- 3. Test fungsi nomor antrian (ganti dengan kantin_id yang valid):
-- SELECT public.get_next_nomor_antrian('your-kantin-id-here');
-- =============================================================================
