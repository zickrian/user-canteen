-- =============================================================================
-- FIX AI HELPER FUNCTIONS - Schema Consistency Update
-- =============================================================================
-- Memperbaiki return type kategori_menu dari TEXT menjadi JSONB
-- untuk konsistensi dengan tabel menu
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. FIX GET BEST VALUE MENUS - kategori_menu JSONB
-- =============================================================================
-- Drop existing function first to avoid signature conflict
DROP FUNCTION IF EXISTS public.get_best_value_menus(UUID, INTEGER);

CREATE OR REPLACE FUNCTION public.get_best_value_menus(
  p_kantin_id UUID,
  p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  nama_menu TEXT,
  harga NUMERIC,
  kategori_menu JSONB,  -- ✅ Fixed: Was TEXT, now JSONB
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
-- 2. FIX GET NEW MENUS - kategori_menu JSONB
-- =============================================================================
-- Drop existing function first to avoid signature conflict
DROP FUNCTION IF EXISTS public.get_new_menus(UUID, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION public.get_new_menus(
  p_kantin_id UUID,
  p_days_ago INTEGER DEFAULT 30,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  nama_menu TEXT,
  harga NUMERIC,
  kategori_menu JSONB,  -- ✅ Fixed: Was TEXT, now JSONB
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
-- 3. GRANT PERMISSIONS
-- =============================================================================
GRANT EXECUTE ON FUNCTION public.get_best_value_menus TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.get_new_menus TO authenticated, service_role, anon;

COMMIT;

-- =============================================================================
-- VERIFY CHANGES
-- =============================================================================
SELECT 
  'get_best_value_menus' AS function_name,
  proname AS name,
  pg_get_function_result(oid) AS return_type
FROM pg_proc
WHERE proname = 'get_best_value_menus'
  AND pronamespace = 'public'::regnamespace;

SELECT 
  'get_new_menus' AS function_name,
  proname AS name,
  pg_get_function_result(oid) AS return_type
FROM pg_proc
WHERE proname = 'get_new_menus'
  AND pronamespace = 'public'::regnamespace;

SELECT '✅ Functions updated successfully! kategori_menu is now JSONB' AS status;
