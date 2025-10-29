-- =============================================================================
-- MIGRATION: Support Multiple Categories per Menu
-- =============================================================================
-- Tujuan: Memungkinkan setiap menu untuk memiliki lebih dari 1 kategori
-- Format: kategori_menu akan disimpan sebagai JSON array
-- Contoh: '["Makan Pagi", "Snack"]'
-- =============================================================================
-- PERHATIAN: Jalankan script ini di Supabase SQL Editor SEBELUM deploy perubahan frontend
-- =============================================================================

BEGIN;

-- Step 1: Backup data lama (optional tapi disarankan)
-- Tidak perlu jika data menu kosong

-- Step 2: Drop constraint lama pada kategori_menu
ALTER TABLE public.menu DROP CONSTRAINT IF EXISTS menu_kategori_menu_check;

-- Step 3: Ubah tipe data kategori_menu dari TEXT ke JSONB
-- JSONB lebih efisien untuk query daripada TEXT
ALTER TABLE public.menu 
  ALTER COLUMN kategori_menu SET DATA TYPE JSONB 
  USING CASE 
    WHEN kategori_menu IS NULL THEN NULL
    WHEN kategori_menu = '' THEN '[]'::jsonb
    ELSE jsonb_build_array(kategori_menu)
  END;

-- Step 4: Set default value jika kategori_menu NULL atau kosong
UPDATE public.menu 
SET kategori_menu = '["Makan Pagi"]'::jsonb 
WHERE kategori_menu IS NULL OR kategori_menu = 'null'::jsonb OR kategori_menu = '[]'::jsonb;

-- Step 5: Set NOT NULL constraint
ALTER TABLE public.menu 
  ALTER COLUMN kategori_menu SET NOT NULL,
  ALTER COLUMN kategori_menu SET DEFAULT '[]'::jsonb;

-- Step 6: Buat index untuk JSONB field
DROP INDEX IF EXISTS idx_menu_kategori;
CREATE INDEX idx_menu_kategori ON public.menu USING GIN(kategori_menu);

-- Step 7: Buat constraint untuk validasi kategori yang diizinkan
-- Gunakan CHECK constraint dengan function untuk validasi
CREATE OR REPLACE FUNCTION validate_menu_categories(categories JSONB)
RETURNS BOOLEAN AS $$
DECLARE
  category_item TEXT;
  valid_categories TEXT[] := ARRAY['Makan Pagi', 'Makan Siang', 'Snack', 'Minuman'];
BEGIN
  -- Jika array kosong, valid
  IF jsonb_array_length(categories) = 0 THEN
    RETURN true;
  END IF;
  
  -- Periksa setiap item di array apakah valid
  FOR category_item IN
    SELECT jsonb_array_elements_text(categories)
  LOOP
    IF NOT (category_item = ANY(valid_categories)) THEN
      RETURN false;
    END IF;
  END LOOP;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

ALTER TABLE public.menu 
  ADD CONSTRAINT menu_kategori_menu_valid 
  CHECK (validate_menu_categories(kategori_menu));

-- Step 8: Update modified_at trigger jika ada
-- (Supabase automatically menangani updated_at)

COMMIT;

-- Verifikasi perubahan
-- Jalankan query ini untuk cek format data baru:
-- SELECT id, nama_menu, kategori_menu FROM public.menu LIMIT 5;

-- Jika ada error atau ingin rollback, jalankan:
-- ALTER TABLE public.menu ALTER COLUMN kategori_menu SET DATA TYPE TEXT 
-- USING jsonb_build_array(kategori_menu)::text;
