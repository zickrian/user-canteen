-- =============================================================================
-- FIX CONSTRAINT TIPE_PESANAN - Perbaiki constraint violation
-- =============================================================================
-- Jalankan script ini di Supabase SQL Editor untuk memperbaiki constraint tipe_pesanan
-- =============================================================================

BEGIN;

-- Drop semua constraint yang terkait dengan tipe_pesanan (jika ada)
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

-- Tambahkan kolom tipe_pesanan jika belum ada
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema='public' AND table_name='pesanan' AND column_name='tipe_pesanan') THEN
    ALTER TABLE public.pesanan ADD COLUMN tipe_pesanan TEXT;
  END IF;
END $$;

-- Tambahkan constraint yang benar dengan format 'dine_in' dan 'take_away'
ALTER TABLE public.pesanan 
ADD CONSTRAINT pesanan_tipe_pesanan_check 
CHECK (tipe_pesanan IS NULL OR tipe_pesanan IN ('dine_in', 'take_away'));

COMMIT;

-- =============================================================================
-- ✅ SELESAI!
-- =============================================================================
-- Sekarang constraint sudah diperbaiki dan akan menerima nilai:
-- - 'dine_in' (dengan underscore)
-- - 'take_away' (dengan underscore)
-- - NULL (untuk nilai kosong)
-- =============================================================================

