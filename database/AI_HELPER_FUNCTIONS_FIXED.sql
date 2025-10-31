-- =============================================================================
-- AI HELPER FUNCTIONS (SESUAI DATABASE EXISTING)
-- =============================================================================
-- Compatible dengan struktur database yang sudah ada:
-- - kategori_menu: JSONB (array kategori)
-- - total_sold: INTEGER (sudah ada di tabel menu)
-- =============================================================================

BEGIN;

-- Drop existing functions
DROP FUNCTION IF EXISTS public.get_menu_by_budget(UUID, NUMERIC);
DROP FUNCTION IF EXISTS public.search_menu_by_keywords(UUID, TEXT[]);
DROP FUNCTION IF EXISTS public.get_menu_by_category(UUID, TEXT);
DROP FUNCTION IF EXISTS public.get_cheapest_menus(UUID, INTEGER);
DROP FUNCTION IF EXISTS public.get_popular_menu_recommendations(UUID, INTEGER);
DROP FUNCTION IF EXISTS public.get_best_value_menus(UUID, INTEGER);
DROP FUNCTION IF EXISTS public.get_new_menus(UUID, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS public.get_menu_combinations(UUID, NUMERIC, INTEGER);
DROP FUNCTION IF EXISTS public.get_kantin_menu_stats(UUID);
DROP FUNCTION IF EXISTS public.get_all_available_menus(UUID);

-- =============================================================================
-- 1. GET MENU BY BUDGET
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_menu_by_budget(
  p_kantin_id UUID,
  p_max_budget NUMERIC
)
RETURNS TABLE (
  id UUID,
  nama_menu TEXT,
  harga NUMERIC,
  kategori_menu JSONB,
  total_sold INTEGER,
  foto_menu TEXT,
  deskripsi TEXT,
  tersedia BOOLEAN,
  kantin_id UUID
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT
    m.id,
    m.nama_menu,
    m.harga,
    m.kategori_menu,
    COALESCE(m.total_sold, 0) AS total_sold,
    m.foto_menu,
    m.deskripsi,
    m.tersedia,
    m.kantin_id
  FROM menu m
  WHERE m.kantin_id = p_kantin_id
    AND m.tersedia = true
    AND m.harga <= p_max_budget
  ORDER BY m.total_sold DESC NULLS LAST, m.harga ASC
  LIMIT 20;
$$;

-- =============================================================================
-- 2. SEARCH MENU BY KEYWORDS
-- =============================================================================
CREATE OR REPLACE FUNCTION public.search_menu_by_keywords(
  p_kantin_id UUID,
  p_keywords TEXT[]
)
RETURNS TABLE (
  id UUID,
  nama_menu TEXT,
  harga NUMERIC,
  kategori_menu JSONB,
  total_sold INTEGER,
  foto_menu TEXT,
  deskripsi TEXT,
  tersedia BOOLEAN,
  kantin_id UUID
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT
    m.id,
    m.nama_menu,
    m.harga,
    m.kategori_menu,
    COALESCE(m.total_sold, 0) AS total_sold,
    m.foto_menu,
    m.deskripsi,
    m.tersedia,
    m.kantin_id
  FROM menu m
  WHERE m.kantin_id = p_kantin_id
    AND m.tersedia = true
    AND (
      EXISTS (
        SELECT 1 
        FROM unnest(p_keywords) AS keyword
        WHERE LOWER(m.nama_menu) LIKE '%' || LOWER(keyword) || '%'
           OR LOWER(COALESCE(m.deskripsi, '')) LIKE '%' || LOWER(keyword) || '%'
      )
    )
  ORDER BY COALESCE(m.total_sold, 0) DESC, m.harga ASC
  LIMIT 20;
$$;

-- =============================================================================
-- 3. GET MENU BY CATEGORY
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_menu_by_category(
  p_kantin_id UUID,
  p_category TEXT
)
RETURNS TABLE (
  id UUID,
  nama_menu TEXT,
  harga NUMERIC,
  kategori_menu JSONB,
  total_sold INTEGER,
  foto_menu TEXT,
  deskripsi TEXT,
  tersedia BOOLEAN,
  kantin_id UUID
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT
    m.id,
    m.nama_menu,
    m.harga,
    m.kategori_menu,
    COALESCE(m.total_sold, 0) AS total_sold,
    m.foto_menu,
    m.deskripsi,
    m.tersedia,
    m.kantin_id
  FROM menu m
  WHERE m.kantin_id = p_kantin_id
    AND m.tersedia = true
    AND (
      m.kategori_menu IS NULL 
      OR m.kategori_menu::text ILIKE '%' || p_category || '%'
    )
  ORDER BY COALESCE(m.total_sold, 0) DESC, m.harga ASC
  LIMIT 20;
$$;

-- =============================================================================
-- 4. GET CHEAPEST MENUS
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_cheapest_menus(
  p_kantin_id UUID,
  p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  nama_menu TEXT,
  harga NUMERIC,
  kategori_menu JSONB,
  total_sold INTEGER,
  foto_menu TEXT,
  deskripsi TEXT,
  tersedia BOOLEAN,
  kantin_id UUID
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT
    m.id,
    m.nama_menu,
    m.harga,
    m.kategori_menu,
    COALESCE(m.total_sold, 0) AS total_sold,
    m.foto_menu,
    m.deskripsi,
    m.tersedia,
    m.kantin_id
  FROM menu m
  WHERE m.kantin_id = p_kantin_id
    AND m.tersedia = true
  ORDER BY m.harga ASC, m.nama_menu ASC
  LIMIT p_limit;
$$;

-- =============================================================================
-- 5. GET POPULAR MENU RECOMMENDATIONS
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_popular_menu_recommendations(
  p_kantin_id UUID,
  p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  nama_menu TEXT,
  harga NUMERIC,
  kategori_menu JSONB,
  total_sold INTEGER,
  foto_menu TEXT,
  deskripsi TEXT,
  tersedia BOOLEAN,
  kantin_id UUID
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT
    m.id,
    m.nama_menu,
    m.harga,
    m.kategori_menu,
    COALESCE(m.total_sold, 0) AS total_sold,
    m.foto_menu,
    m.deskripsi,
    m.tersedia,
    m.kantin_id
  FROM menu m
  WHERE m.kantin_id = p_kantin_id
    AND m.tersedia = true
  ORDER BY m.total_sold DESC NULLS LAST, m.created_at DESC
  LIMIT p_limit;
$$;

-- =============================================================================
-- 6. GET BEST VALUE MENUS
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_best_value_menus(
  p_kantin_id UUID,
  p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  nama_menu TEXT,
  harga NUMERIC,
  kategori_menu JSONB,
  total_sold INTEGER,
  foto_menu TEXT,
  deskripsi TEXT,
  tersedia BOOLEAN,
  kantin_id UUID,
  value_score NUMERIC
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT
    m.id,
    m.nama_menu,
    m.harga,
    m.kategori_menu,
    COALESCE(m.total_sold, 0) AS total_sold,
    m.foto_menu,
    m.deskripsi,
    m.tersedia,
    m.kantin_id,
    CASE 
      WHEN m.harga > 0 THEN 
        COALESCE(m.total_sold, 0)::NUMERIC / m.harga
      ELSE 0
    END AS value_score
  FROM menu m
  WHERE m.kantin_id = p_kantin_id
    AND m.tersedia = true
  ORDER BY value_score DESC, m.total_sold DESC NULLS LAST
  LIMIT p_limit;
$$;

-- =============================================================================
-- 7. GET NEW MENUS
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_new_menus(
  p_kantin_id UUID,
  p_days_ago INTEGER DEFAULT 30,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  nama_menu TEXT,
  harga NUMERIC,
  kategori_menu JSONB,
  total_sold INTEGER,
  foto_menu TEXT,
  deskripsi TEXT,
  tersedia BOOLEAN,
  kantin_id UUID,
  created_at TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT
    m.id,
    m.nama_menu,
    m.harga,
    m.kategori_menu,
    COALESCE(m.total_sold, 0) AS total_sold,
    m.foto_menu,
    m.deskripsi,
    m.tersedia,
    m.kantin_id,
    m.created_at
  FROM menu m
  WHERE m.kantin_id = p_kantin_id
    AND m.tersedia = true
    AND m.created_at >= NOW() - (p_days_ago || ' days')::INTERVAL
  ORDER BY m.created_at DESC
  LIMIT p_limit;
$$;

-- =============================================================================
-- 8. GET MENU COMBINATIONS (dalam budget)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_menu_combinations(
  p_kantin_id UUID,
  p_budget NUMERIC,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  menu1_id UUID,
  menu1_nama TEXT,
  menu1_harga NUMERIC,
  menu2_id UUID,
  menu2_nama TEXT,
  menu2_harga NUMERIC,
  total_harga NUMERIC
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT
    m1.id AS menu1_id,
    m1.nama_menu AS menu1_nama,
    m1.harga AS menu1_harga,
    m2.id AS menu2_id,
    m2.nama_menu AS menu2_nama,
    m2.harga AS menu2_harga,
    (m1.harga + m2.harga) AS total_harga
  FROM menu m1
  CROSS JOIN menu m2
  WHERE m1.kantin_id = p_kantin_id
    AND m2.kantin_id = p_kantin_id
    AND m1.tersedia = true
    AND m2.tersedia = true
    AND m1.id < m2.id
    AND (m1.harga + m2.harga) <= p_budget
  ORDER BY total_harga DESC
  LIMIT p_limit;
$$;

-- =============================================================================
-- 9. GET KANTIN MENU STATS
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_kantin_menu_stats(
  p_kantin_id UUID
)
RETURNS TABLE (
  total_menu BIGINT,
  total_tersedia BIGINT,
  harga_rata NUMERIC,
  harga_termurah NUMERIC,
  harga_termahal NUMERIC
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT
    COUNT(*) AS total_menu,
    COUNT(*) FILTER (WHERE tersedia = true) AS total_tersedia,
    ROUND(AVG(harga), 0) AS harga_rata,
    MIN(harga) AS harga_termurah,
    MAX(harga) AS harga_termahal
  FROM menu
  WHERE kantin_id = p_kantin_id;
$$;

-- =============================================================================
-- 10. GET ALL AVAILABLE MENUS
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_all_available_menus(
  p_kantin_id UUID
)
RETURNS TABLE (
  id UUID,
  nama_menu TEXT,
  harga NUMERIC,
  kategori_menu JSONB,
  total_sold INTEGER,
  foto_menu TEXT,
  deskripsi TEXT,
  tersedia BOOLEAN,
  kantin_id UUID
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT
    m.id,
    m.nama_menu,
    m.harga,
    m.kategori_menu,
    COALESCE(m.total_sold, 0) AS total_sold,
    m.foto_menu,
    m.deskripsi,
    m.tersedia,
    m.kantin_id
  FROM menu m
  WHERE m.kantin_id = p_kantin_id
    AND m.tersedia = true
  ORDER BY m.created_at DESC
  LIMIT 50;
$$;

COMMIT;

-- =============================================================================
-- GRANT PERMISSIONS
-- =============================================================================
GRANT EXECUTE ON FUNCTION public.get_menu_by_budget TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.search_menu_by_keywords TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_menu_by_category TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_cheapest_menus TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_popular_menu_recommendations TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_best_value_menus TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_new_menus TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_menu_combinations TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_kantin_menu_stats TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_all_available_menus TO authenticated, service_role;

-- =============================================================================
-- VERIFIKASI
-- =============================================================================
SELECT 'Functions created successfully!' AS status;

