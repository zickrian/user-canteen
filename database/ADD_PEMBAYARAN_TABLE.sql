-- ============================================================================
-- TAMBAHAN TABEL UNTUK SISTEM PEMBAYARAN MIDTRANS
-- ============================================================================

-- Tabel untuk tracking pembayaran (dari Midtrans)
CREATE TABLE IF NOT EXISTS public.pembayaran (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pesanan_id            UUID NOT NULL UNIQUE REFERENCES public.pesanan(id) ON DELETE CASCADE,
  midtrans_order_id     TEXT NOT NULL UNIQUE,
  midtrans_transaction_id TEXT,
  gross_amount          NUMERIC(10,2) NOT NULL,
  payment_type          TEXT, -- 'qris', 'credit_card', dll
  status                TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'settlement', 'expire', 'cancel', 'deny')),
  email_pelanggan       TEXT,
  nomor_meja            TEXT,
  tipe_pesanan          TEXT CHECK (tipe_pesanan IN ('dine_in', 'take_away')),
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pembayaran_pesanan_id ON public.pembayaran(pesanan_id);
CREATE INDEX IF NOT EXISTS idx_pembayaran_midtrans_order_id ON public.pembayaran(midtrans_order_id);
CREATE INDEX IF NOT EXISTS idx_pembayaran_status ON public.pembayaran(status);

-- Trigger untuk update timestamp
DROP TRIGGER IF EXISTS t_pembayaran_touch ON public.pembayaran;
CREATE TRIGGER t_pembayaran_touch BEFORE UPDATE ON public.pembayaran
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Update status pesanan saat pembayaran berhasil
DROP FUNCTION IF EXISTS public.handle_payment_settlement();
CREATE OR REPLACE FUNCTION public.handle_payment_settlement()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  -- Jika pembayaran settlement (berhasil), update pesanan menjadi 'diproses'
  IF NEW.status = 'settlement' AND (TG_OP = 'INSERT' OR OLD.status != 'settlement') THEN
    UPDATE public.pesanan
    SET status = 'diproses'
    WHERE id = NEW.pesanan_id;
  END IF;
  
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_pembayaran_settlement ON public.pembayaran;
CREATE TRIGGER trg_pembayaran_settlement
AFTER INSERT OR UPDATE ON public.pembayaran
FOR EACH ROW EXECUTE FUNCTION public.handle_payment_settlement();

-- RLS Policies untuk pembayaran table
ALTER TABLE public.pembayaran ENABLE ROW LEVEL SECURITY;

-- Admin bisa lihat semua pembayaran
DROP POLICY IF EXISTS pembayaran_admin_view ON public.pembayaran;
CREATE POLICY pembayaran_admin_view
ON public.pembayaran FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()));

-- Kios owner bisa lihat pembayaran untuk pesanannya
DROP POLICY IF EXISTS pembayaran_kios_view_own ON public.pembayaran;
CREATE POLICY pembayaran_kios_view_own
ON public.pembayaran FOR SELECT
TO authenticated
USING (
  pesanan_id IN (
    SELECT id FROM public.pesanan WHERE kantin_id IN (
      SELECT id FROM public.kantin WHERE user_id = auth.uid()
    )
  )
);

-- Tabel untuk rating makanan
CREATE TABLE IF NOT EXISTS public.rating (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pesanan_id      UUID NOT NULL REFERENCES public.pesanan(id) ON DELETE CASCADE,
  menu_id         UUID NOT NULL REFERENCES public.menu(id) ON DELETE CASCADE,
  rating          INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  komentar        TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rating_pesanan_id ON public.rating(pesanan_id);
CREATE INDEX IF NOT EXISTS idx_rating_menu_id ON public.rating(menu_id);

-- Trigger untuk rating
DROP TRIGGER IF EXISTS t_rating_touch ON public.rating;
CREATE TRIGGER t_rating_touch BEFORE UPDATE ON public.rating
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- RLS untuk rating
ALTER TABLE public.rating ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rating_select_public ON public.rating;
CREATE POLICY rating_select_public
ON public.rating FOR SELECT
TO public
USING (true);

DROP POLICY IF EXISTS rating_insert_authenticated ON public.rating;
CREATE POLICY rating_insert_authenticated
ON public.rating FOR INSERT
TO authenticated
WITH CHECK (true);

-- Function untuk get rating stats
CREATE OR REPLACE FUNCTION public.get_menu_rating_stats(p_menu_id UUID)
RETURNS TABLE (
  average_rating NUMERIC,
  total_ratings BIGINT,
  rating_distribution JSONB
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT
    ROUND(AVG(rating)::NUMERIC, 2) AS average_rating,
    COUNT(*) AS total_ratings,
    JSONB_OBJECT_AGG(rating::TEXT, count) AS rating_distribution
  FROM (
    SELECT rating, COUNT(*) as count
    FROM public.rating
    WHERE menu_id = p_menu_id
    GROUP BY rating
  ) sub;
$$;

-- Update status pesanan saat pembayaran expired/cancel/deny
CREATE OR REPLACE FUNCTION public.handle_payment_failed()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  -- Jika pembayaran expire/cancel/deny, update pesanan kembali ke 'menunggu'
  IF NEW.status IN ('expire', 'cancel', 'deny') AND OLD.status = 'pending' THEN
    UPDATE public.pesanan
    SET status = 'menunggu'
    WHERE id = NEW.pesanan_id;
  END IF;
  
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_pembayaran_failed ON public.pembayaran;
CREATE TRIGGER trg_pembayaran_failed
AFTER UPDATE ON public.pembayaran
FOR EACH ROW EXECUTE FUNCTION public.handle_payment_failed();

-- =============================================================================
-- SELESAI - Silakan jalankan script ini di Supabase SQL Editor
-- =============================================================================
