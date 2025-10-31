-- =============================================================================
-- MIGRATION: Convert kategori_menu from TEXT to JSONB
-- =============================================================================
-- CRITICAL: Backup database sebelum menjalankan migration ini!
-- =============================================================================

BEGIN;

-- =============================================================================
-- STEP 1: Backup existing data
-- =============================================================================
-- Create temporary backup table
CREATE TABLE IF NOT EXISTS menu_backup_kategori AS
SELECT id, kantin_id, nama_menu, kategori_menu, created_at
FROM menu;

SELECT COUNT(*) AS "Total menu backed up" FROM menu_backup_kategori;

-- =============================================================================
-- STEP 2: Convert existing TEXT kategori to JSONB array
-- =============================================================================
-- Add temporary column
ALTER TABLE menu ADD COLUMN IF NOT EXISTS kategori_menu_new JSONB;

-- Convert TEXT to JSONB array
UPDATE menu
SET kategori_menu_new = 
  CASE 
    -- If kategori_menu is NULL or empty, set to NULL
    WHEN kategori_menu IS NULL OR kategori_menu = '' THEN NULL
    -- If already looks like JSON array, cast it
    WHEN kategori_menu LIKE '[%]' THEN kategori_menu::jsonb
    -- Otherwise, wrap single value in array
    ELSE jsonb_build_array(kategori_menu)
  END;

-- Verify conversion
SELECT 
  'Conversion Preview' AS status,
  kategori_menu AS old_value,
  kategori_menu_new AS new_value,
  COUNT(*) AS count
FROM menu
GROUP BY kategori_menu, kategori_menu_new
ORDER BY count DESC
LIMIT 10;

-- =============================================================================
-- STEP 3: Drop old column and rename new one
-- =============================================================================
ALTER TABLE menu DROP COLUMN kategori_menu;
ALTER TABLE menu RENAME COLUMN kategori_menu_new TO kategori_menu;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_menu_kategori_gin ON menu USING gin(kategori_menu);

SELECT '✅ Column converted from TEXT to JSONB' AS status;

-- =============================================================================
-- STEP 4: Update AI Helper Functions to use JSONB
-- =============================================================================

-- Function 1: get_best_value_menus
DROP FUNCTION IF EXISTS public.get_best_value_menus(UUID, INTEGER);
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

-- Function 2: get_new_menus
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

-- Function 3: get_menu_by_category (update to work with JSONB)
DROP FUNCTION IF EXISTS public.get_menu_by_category(UUID, TEXT);
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
      OR m.kategori_menu @> to_jsonb(ARRAY[p_category])
      OR m.kategori_menu::text ILIKE '%' || p_category || '%'
    )
  ORDER BY COALESCE(m.total_sold, 0) DESC, m.harga ASC
  LIMIT 20;
$$;

SELECT '✅ AI Helper Functions updated for JSONB' AS status;

-- =============================================================================
-- STEP 5: Grant permissions
-- =============================================================================
GRANT EXECUTE ON FUNCTION public.get_best_value_menus TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_new_menus TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_menu_by_category TO authenticated, service_role;

-- =============================================================================
-- STEP 6: Verify migration
-- =============================================================================
SELECT 
  'Migration Verification' AS check_type,
  COUNT(*) AS total_menus,
  COUNT(*) FILTER (WHERE kategori_menu IS NOT NULL) AS with_kategori,
  COUNT(*) FILTER (WHERE kategori_menu IS NULL) AS without_kategori,
  pg_typeof(kategori_menu) AS column_type
FROM menu
GROUP BY pg_typeof(kategori_menu);

-- Show sample data
SELECT 
  nama_menu,
  kategori_menu,
  jsonb_array_length(kategori_menu) AS kategori_count
FROM menu
WHERE kategori_menu IS NOT NULL
LIMIT 5;

-- =============================================================================
-- CLEANUP: Drop backup table (UNCOMMENT jika yakin migration sukses)
-- =============================================================================
-- DROP TABLE IF EXISTS menu_backup_kategori;

COMMIT;

-- =============================================================================
-- ✅ MIGRATION COMPLETE!
-- =============================================================================
SELECT '
╔═══════════════════════════════════════════════════════════════╗
║  ✅ Migration Complete!                                       ║
║                                                               ║
║  kategori_menu: TEXT → JSONB ✅                              ║
║  AI Helper Functions: Updated ✅                             ║
║                                                               ║
║  NEXT STEPS:                                                  ║
║  1. Verify data looks correct above                          ║
║  2. Restart your Next.js dev server                          ║
║  3. Test AI chat functionality                               ║
║  4. If all good, uncomment DROP TABLE to remove backup       ║
╚═══════════════════════════════════════════════════════════════╝
' AS status;

-- =============================================================================
-- ROLLBACK INSTRUCTIONS (in case of issues)
-- =============================================================================
-- If you need to rollback:
-- BEGIN;
-- ALTER TABLE menu ADD COLUMN kategori_menu_text TEXT;
-- UPDATE menu SET kategori_menu_text = 
--   CASE 
--     WHEN kategori_menu IS NULL THEN NULL
--     WHEN jsonb_array_length(kategori_menu) = 1 THEN kategori_menu->>0
--     ELSE kategori_menu::text
--   END;
-- ALTER TABLE menu DROP COLUMN kategori_menu;
-- ALTER TABLE menu RENAME COLUMN kategori_menu_text TO kategori_menu;
-- COMMIT;
