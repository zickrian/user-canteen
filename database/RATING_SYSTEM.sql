-- =============================================================================
-- RATING SYSTEM untuk Admin Kantin
-- =============================================================================
-- ✅ Pembeli bisa rating setelah checkout
-- ✅ Sistem rata-rata rating per kantin
-- ✅ Display rating dengan bintang
-- =============================================================================

BEGIN;

-- =============================================================================
-- TABLE: ratings
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kantin_id UUID NOT NULL REFERENCES public.kantin(id) ON DELETE CASCADE,
  pesanan_id UUID NOT NULL REFERENCES public.pesanan(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review TEXT,
  nama_penilai TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent duplicate rating untuk pesanan yang sama
  UNIQUE(pesanan_id)
);

CREATE INDEX IF NOT EXISTS idx_ratings_kantin_id ON public.ratings(kantin_id);
CREATE INDEX IF NOT EXISTS idx_ratings_pesanan_id ON public.ratings(pesanan_id);
CREATE INDEX IF NOT EXISTS idx_ratings_rating ON public.ratings(rating);

-- =============================================================================
-- TRIGGER: Update timestamp
-- =============================================================================
DROP TRIGGER IF EXISTS t_ratings_touch ON public.ratings;
CREATE TRIGGER t_ratings_touch BEFORE UPDATE ON public.ratings
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =============================================================================
-- RLS POLICIES
-- =============================================================================
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;

-- Semua orang bisa lihat rating (untuk display di card kantin)
DROP POLICY IF EXISTS ratings_select_public ON public.ratings;
CREATE POLICY ratings_select_public
ON public.ratings FOR SELECT
TO public
USING (true);

-- Pembeli bisa submit rating untuk pesanan mereka (via public access karena no auth)
DROP POLICY IF EXISTS ratings_insert_public ON public.ratings;
CREATE POLICY ratings_insert_public
ON public.ratings FOR INSERT
TO public
WITH CHECK (true);

-- Kios owner bisa lihat rating kantinnya
DROP POLICY IF EXISTS ratings_kios_view ON public.ratings;
CREATE POLICY ratings_kios_view
ON public.ratings FOR SELECT
TO authenticated
USING (kantin_id IN (SELECT id FROM public.kantin WHERE user_id = auth.uid()));

-- Admin bisa lihat semua rating
DROP POLICY IF EXISTS ratings_admin_view ON public.ratings;
CREATE POLICY ratings_admin_view
ON public.ratings FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()));

-- =============================================================================
-- RPC FUNCTION: Submit Rating
-- =============================================================================
DROP FUNCTION IF EXISTS public.submit_rating(UUID, UUID, INTEGER, TEXT, TEXT);
CREATE FUNCTION public.submit_rating(
  p_kantin_id UUID,
  p_pesanan_id UUID,
  p_rating INTEGER,
  p_review TEXT,
  p_nama_penilai TEXT
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_rating_id UUID;
BEGIN
  -- Validation
  IF p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'Rating harus antara 1-5 bintang';
  END IF;
  
  IF p_nama_penilai IS NULL OR TRIM(p_nama_penilai) = '' THEN
    RAISE EXCEPTION 'Nama penilai wajib diisi';
  END IF;
  
  -- Check if pesanan exists dan sudah selesai
  IF NOT EXISTS (
    SELECT 1 FROM public.pesanan 
    WHERE id = p_pesanan_id 
      AND kantin_id = p_kantin_id
      AND status = 'selesai'
  ) THEN
    RAISE EXCEPTION 'Pesanan tidak ditemukan atau belum selesai';
  END IF;
  
  -- Check if already rated
  IF EXISTS (SELECT 1 FROM public.ratings WHERE pesanan_id = p_pesanan_id) THEN
    RAISE EXCEPTION 'Pesanan ini sudah diberi rating';
  END IF;
  
  -- Insert rating
  INSERT INTO public.ratings (
    kantin_id,
    pesanan_id,
    rating,
    review,
    nama_penilai
  )
  VALUES (
    p_kantin_id,
    p_pesanan_id,
    p_rating,
    TRIM(p_review),
    TRIM(p_nama_penilai)
  )
  RETURNING id INTO v_rating_id;
  
  RETURN v_rating_id;
END $$;

-- =============================================================================
-- RPC FUNCTION: Get Kantin Rating Stats
-- =============================================================================
DROP FUNCTION IF EXISTS public.get_kantin_rating(UUID);
CREATE FUNCTION public.get_kantin_rating(p_kantin_id UUID)
RETURNS TABLE (
  avg_rating NUMERIC,
  total_ratings BIGINT,
  rating_5 BIGINT,
  rating_4 BIGINT,
  rating_3 BIGINT,
  rating_2 BIGINT,
  rating_1 BIGINT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT
    COALESCE(ROUND(AVG(rating)::NUMERIC, 1), 0) AS avg_rating,
    COUNT(*) AS total_ratings,
    COUNT(*) FILTER (WHERE rating = 5) AS rating_5,
    COUNT(*) FILTER (WHERE rating = 4) AS rating_4,
    COUNT(*) FILTER (WHERE rating = 3) AS rating_3,
    COUNT(*) FILTER (WHERE rating = 2) AS rating_2,
    COUNT(*) FILTER (WHERE rating = 1) AS rating_1
  FROM public.ratings
  WHERE kantin_id = p_kantin_id;
$$;

-- =============================================================================
-- RPC FUNCTION: Get All Kantin Ratings (untuk homepage)
-- =============================================================================
DROP FUNCTION IF EXISTS public.get_all_kantin_ratings();
CREATE FUNCTION public.get_all_kantin_ratings()
RETURNS TABLE (
  kantin_id UUID,
  avg_rating NUMERIC,
  total_ratings BIGINT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT
    r.kantin_id,
    COALESCE(ROUND(AVG(r.rating)::NUMERIC, 1), 0) AS avg_rating,
    COUNT(*) AS total_ratings
  FROM public.ratings r
  GROUP BY r.kantin_id;
$$;

-- =============================================================================
-- RPC FUNCTION: Get Kantin Reviews (dengan pagination)
-- =============================================================================
DROP FUNCTION IF EXISTS public.get_kantin_reviews(UUID, INTEGER, INTEGER);
CREATE FUNCTION public.get_kantin_reviews(
  p_kantin_id UUID,
  p_limit INTEGER DEFAULT 10,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  rating INTEGER,
  review TEXT,
  nama_penilai TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT
    r.id,
    r.rating,
    r.review,
    r.nama_penilai,
    r.created_at
  FROM public.ratings r
  WHERE r.kantin_id = p_kantin_id
  ORDER BY r.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
$$;

-- =============================================================================
-- RPC FUNCTION: Check if pesanan can be rated
-- =============================================================================
DROP FUNCTION IF EXISTS public.can_rate_pesanan(UUID);
CREATE FUNCTION public.can_rate_pesanan(p_pesanan_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT 
    EXISTS (
      SELECT 1 FROM public.pesanan p
      WHERE p.id = p_pesanan_id 
        AND p.status = 'selesai'
        AND NOT EXISTS (
          SELECT 1 FROM public.ratings r 
          WHERE r.pesanan_id = p_pesanan_id
        )
    );
$$;

COMMIT;

-- =============================================================================
-- ✅ RATING SYSTEM COMPLETE! 
-- =============================================================================
-- Test query untuk cek rating:
-- SELECT * FROM public.get_kantin_rating('your-kantin-id');
-- SELECT * FROM public.get_all_kantin_ratings();
-- =============================================================================
