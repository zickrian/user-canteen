-- =============================================================================
-- TRACKING PEMBELIAN PRODUK
-- =============================================================================
-- Menambahkan kolom total_sold untuk tracking produk yang paling banyak dibeli
-- =============================================================================

BEGIN;

-- Tambahkan kolom total_sold di tabel menu
ALTER TABLE public.menu 
ADD COLUMN IF NOT EXISTS total_sold INTEGER DEFAULT 0;

-- Tambahkan kolom email, nomor_meja, dan tipe_pesanan di tabel pesanan
ALTER TABLE public.pesanan
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS nomor_meja TEXT,
ADD COLUMN IF NOT EXISTS tipe_pesanan TEXT CHECK (tipe_pesanan IN ('dine-in', 'take-away'));

-- Create function untuk update total_sold saat pesanan selesai
CREATE OR REPLACE FUNCTION public.update_menu_total_sold()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  -- Saat order jadi 'selesai', update total_sold
  IF NEW.status = 'selesai' AND (TG_OP = 'INSERT' OR OLD.status != 'selesai') THEN
    -- Update total_sold untuk setiap menu yang dibeli
    UPDATE public.menu m
    SET total_sold = total_sold + dp.jumlah
    FROM public.detail_pesanan dp
    WHERE dp.pesanan_id = NEW.id
      AND dp.menu_id = m.id;
  END IF;

  -- Saat order di-update dari 'selesai' ke status lain, kurangi total_sold
  IF TG_OP = 'UPDATE' AND OLD.status = 'selesai' AND NEW.status != 'selesai' THEN
    UPDATE public.menu m
    SET total_sold = GREATEST(0, total_sold - dp.jumlah)
    FROM public.detail_pesanan dp
    WHERE dp.pesanan_id = OLD.id
      AND dp.menu_id = m.id;
  END IF;

  RETURN NEW;
END $$;

-- Create trigger
DROP TRIGGER IF EXISTS trg_update_menu_total_sold ON public.pesanan;
CREATE TRIGGER trg_update_menu_total_sold
AFTER INSERT OR UPDATE ON public.pesanan
FOR EACH ROW EXECUTE FUNCTION public.update_menu_total_sold();

-- Create function untuk melihat menu terlaris per kantin
CREATE OR REPLACE FUNCTION public.get_top_selling_menus(
  p_kantin_id UUID,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  menu_id UUID,
  nama_menu TEXT,
  foto_menu TEXT,
  harga NUMERIC,
  total_sold INTEGER,
  kategori_menu TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT
    m.id AS menu_id,
    m.nama_menu,
    m.foto_menu,
    m.harga,
    m.total_sold,
    m.kategori_menu
  FROM public.menu m
  WHERE m.kantin_id = p_kantin_id
  ORDER BY m.total_sold DESC, m.nama_menu ASC
  LIMIT p_limit;
$$;

-- Migrasi data existing: hitung total_sold dari data pesanan yang sudah ada
UPDATE public.menu m
SET total_sold = (
  SELECT COALESCE(SUM(dp.jumlah), 0)
  FROM public.detail_pesanan dp
  INNER JOIN public.pesanan p ON dp.pesanan_id = p.id
  WHERE dp.menu_id = m.id
    AND p.status = 'selesai'
);

COMMIT;

-- =============================================================================
-- ✅ TRACKING PEMBELIAN COMPLETE!
-- =============================================================================
-- Test query untuk melihat menu terlaris:
-- SELECT * FROM public.get_top_selling_menus('<kantin_id>', 10);
-- =============================================================================
