-- =============================================================================
-- AI AGENT HELPER FUNCTIONS
-- =============================================================================
-- Functions untuk mendukung AI Agent dalam menjawab pertanyaan user
-- seperti rekomendasi menu, pencarian berdasarkan budget, dll
-- =============================================================================

BEGIN;

-- =============================================================================
-- FUNCTION 1: Get Menu by Budget
-- =============================================================================
-- Untuk query: "Saya punya uang 20k, pilihkan makanan"
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_menu_by_budget(
  p_kantin_id UUID,
  p_max_budget NUMERIC
)
RETURNS TABLE (
  menu_id UUID,
  nama_menu TEXT,
  harga NUMERIC,
  kategori_menu JSONB,
  total_sold INTEGER,
  foto_menu TEXT,
  deskripsi TEXT,
  tersedia BOOLEAN
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT
    m.id AS menu_id,
    m.nama_menu,
    m.harga,
    m.kategori_menu,
    COALESCE(m.total_sold, 0) AS total_sold,
    m.foto_menu,
    m.deskripsi,
    m.tersedia
  FROM public.menu m
  WHERE m.kantin_id = p_kantin_id
    AND m.tersedia = true
    AND m.harga <= p_max_budget
  ORDER BY m.total_sold DESC NULLS LAST, m.harga ASC;
$$;

COMMENT ON FUNCTION public.get_menu_by_budget IS 
'Mendapatkan menu yang sesuai dengan budget maksimal user. Diurutkan berdasarkan popularitas (total_sold) dan harga.';

-- =============================================================================
-- FUNCTION 2: Get Menu Combinations within Budget
-- =============================================================================
-- Untuk memberikan rekomendasi paket menu (combo)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_menu_combinations(
  p_kantin_id UUID,
  p_budget NUMERIC,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  combo_items JSONB,
  total_price NUMERIC,
  items_count INTEGER,
  savings NUMERIC
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
  RETURN QUERY
  WITH available_menus AS (
    SELECT 
      id, 
      nama_menu, 
      harga,
      total_sold
    FROM public.menu
    WHERE kantin_id = p_kantin_id
      AND tersedia = true
      AND harga <= p_budget
  )
  -- Single item
  SELECT 
    jsonb_build_array(
      jsonb_build_object(
        'id', id,
        'nama', nama_menu, 
        'harga', harga,
        'total_sold', total_sold
      )
    ) AS combo_items,
    harga AS total_price,
    1 AS items_count,
    (p_budget - harga) AS savings
  FROM available_menus
  WHERE harga <= p_budget
  
  UNION ALL
  
  -- Two items combo
  SELECT
    jsonb_build_array(
      jsonb_build_object('id', m1.id, 'nama', m1.nama_menu, 'harga', m1.harga, 'total_sold', m1.total_sold),
      jsonb_build_object('id', m2.id, 'nama', m2.nama_menu, 'harga', m2.harga, 'total_sold', m2.total_sold)
    ) AS combo_items,
    (m1.harga + m2.harga) AS total_price,
    2 AS items_count,
    (p_budget - (m1.harga + m2.harga)) AS savings
  FROM available_menus m1
  CROSS JOIN available_menus m2
  WHERE m1.id < m2.id
    AND (m1.harga + m2.harga) <= p_budget
  
  UNION ALL
  
  -- Three items combo
  SELECT
    jsonb_build_array(
      jsonb_build_object('id', m1.id, 'nama', m1.nama_menu, 'harga', m1.harga, 'total_sold', m1.total_sold),
      jsonb_build_object('id', m2.id, 'nama', m2.nama_menu, 'harga', m2.harga, 'total_sold', m2.total_sold),
      jsonb_build_object('id', m3.id, 'nama', m3.nama_menu, 'harga', m3.harga, 'total_sold', m3.total_sold)
    ) AS combo_items,
    (m1.harga + m2.harga + m3.harga) AS total_price,
    3 AS items_count,
    (p_budget - (m1.harga + m2.harga + m3.harga)) AS savings
  FROM available_menus m1
  CROSS JOIN available_menus m2
  CROSS JOIN available_menus m3
  WHERE m1.id < m2.id 
    AND m2.id < m3.id
    AND (m1.harga + m2.harga + m3.harga) <= p_budget
  
  ORDER BY total_price DESC, items_count DESC
  LIMIT p_limit;
END $$;

COMMENT ON FUNCTION public.get_menu_combinations IS 
'Mendapatkan kombinasi menu (paket) yang sesuai dengan budget. Menghasilkan single item, 2-item combo, dan 3-item combo.';

-- =============================================================================
-- FUNCTION 3: Get Kantin Menu Statistics
-- =============================================================================
-- Untuk query: "Berapa total menu di toko ini?"
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_kantin_menu_stats(p_kantin_id UUID)
RETURNS TABLE (
  total_menus INTEGER,
  available_menus INTEGER,
  avg_price NUMERIC,
  cheapest_price NUMERIC,
  most_expensive_price NUMERIC,
  total_sold_all_time INTEGER,
  total_orders_today INTEGER,
  total_orders_this_week INTEGER,
  total_orders_this_month INTEGER,
  most_popular_category TEXT,
  top_selling_menu TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT
    COUNT(*)::INTEGER AS total_menus,
    COUNT(*) FILTER (WHERE tersedia = true)::INTEGER AS available_menus,
    ROUND(AVG(harga), 0) AS avg_price,
    MIN(harga) AS cheapest_price,
    MAX(harga) AS most_expensive_price,
    COALESCE(SUM(total_sold), 0)::INTEGER AS total_sold_all_time,
    (
      SELECT COUNT(*)::INTEGER
      FROM public.pesanan
      WHERE kantin_id = p_kantin_id
        AND DATE(created_at) = CURRENT_DATE
    ) AS total_orders_today,
    (
      SELECT COUNT(*)::INTEGER
      FROM public.pesanan
      WHERE kantin_id = p_kantin_id
        AND created_at >= CURRENT_DATE - INTERVAL '7 days'
    ) AS total_orders_this_week,
    (
      SELECT COUNT(*)::INTEGER
      FROM public.pesanan
      WHERE kantin_id = p_kantin_id
        AND created_at >= CURRENT_DATE - INTERVAL '30 days'
    ) AS total_orders_this_month,
    (
      SELECT kategori_menu->>0
      FROM public.menu
      WHERE kantin_id = p_kantin_id
        AND total_sold > 0
      ORDER BY total_sold DESC
      LIMIT 1
    ) AS most_popular_category,
    (
      SELECT nama_menu
      FROM public.menu
      WHERE kantin_id = p_kantin_id
      ORDER BY total_sold DESC NULLS LAST
      LIMIT 1
    ) AS top_selling_menu
  FROM public.menu
  WHERE kantin_id = p_kantin_id;
$$;

COMMENT ON FUNCTION public.get_kantin_menu_stats IS 
'Mendapatkan statistik lengkap kantin: total menu, harga rata-rata, pesanan, dan menu terpopuler.';

-- =============================================================================
-- FUNCTION 4: Search Menu by Keywords (NLP Support)
-- =============================================================================
-- Untuk query: "Ada menu ayam gak?", "Cari nasi goreng"
-- =============================================================================

CREATE OR REPLACE FUNCTION public.search_menu_by_keywords(
  p_kantin_id UUID,
  p_keywords TEXT[]
)
RETURNS TABLE (
  menu_id UUID,
  nama_menu TEXT,
  harga NUMERIC,
  deskripsi TEXT,
  kategori_menu JSONB,
  total_sold INTEGER,
  foto_menu TEXT,
  relevance_score INTEGER
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id AS menu_id,
    m.nama_menu,
    m.harga,
    m.deskripsi,
    m.kategori_menu,
    COALESCE(m.total_sold, 0) AS total_sold,
    m.foto_menu,
    (
      SELECT COUNT(*)::INTEGER
      FROM unnest(p_keywords) AS keyword
      WHERE LOWER(m.nama_menu) LIKE '%' || LOWER(keyword) || '%'
         OR LOWER(COALESCE(m.deskripsi, '')) LIKE '%' || LOWER(keyword) || '%'
         OR EXISTS (
           SELECT 1 FROM jsonb_array_elements_text(m.kategori_menu) AS cat
           WHERE LOWER(cat) LIKE '%' || LOWER(keyword) || '%'
         )
    ) AS relevance_score
  FROM public.menu m
  WHERE m.kantin_id = p_kantin_id
    AND m.tersedia = true
  HAVING (
    SELECT COUNT(*)
    FROM unnest(p_keywords) AS keyword
    WHERE LOWER(m.nama_menu) LIKE '%' || LOWER(keyword) || '%'
       OR LOWER(COALESCE(m.deskripsi, '')) LIKE '%' || LOWER(keyword) || '%'
       OR EXISTS (
         SELECT 1 FROM jsonb_array_elements_text(m.kategori_menu) AS cat
         WHERE LOWER(cat) LIKE '%' || LOWER(keyword) || '%'
       )
  ) > 0
  ORDER BY relevance_score DESC, m.total_sold DESC NULLS LAST;
END $$;

COMMENT ON FUNCTION public.search_menu_by_keywords IS 
'Mencari menu berdasarkan keywords dengan scoring relevansi. Mencari di nama, deskripsi, dan kategori menu.';

-- =============================================================================
-- FUNCTION 5: Get Menu by Category
-- =============================================================================
-- Untuk query: "Menu makan siang apa aja?", "Ada minuman apa?"
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_menu_by_category(
  p_kantin_id UUID,
  p_category TEXT
)
RETURNS TABLE (
  menu_id UUID,
  nama_menu TEXT,
  harga NUMERIC,
  deskripsi TEXT,
  kategori_menu JSONB,
  total_sold INTEGER,
  foto_menu TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT
    m.id AS menu_id,
    m.nama_menu,
    m.harga,
    m.deskripsi,
    m.kategori_menu,
    COALESCE(m.total_sold, 0) AS total_sold,
    m.foto_menu
  FROM public.menu m
  WHERE m.kantin_id = p_kantin_id
    AND m.tersedia = true
    AND EXISTS (
      SELECT 1 
      FROM jsonb_array_elements_text(m.kategori_menu) AS cat
      WHERE LOWER(cat) LIKE '%' || LOWER(p_category) || '%'
    )
  ORDER BY m.total_sold DESC NULLS LAST, m.nama_menu ASC;
$$;

COMMENT ON FUNCTION public.get_menu_by_category IS 
'Mendapatkan menu berdasarkan kategori (Makan Pagi, Makan Siang, Snack, Minuman).';

-- =============================================================================
-- FUNCTION 6: Get Menu by Price Range
-- =============================================================================
-- Untuk query: "Menu yang harganya antara 10k sampai 20k"
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_menu_by_price_range(
  p_kantin_id UUID,
  p_min_price NUMERIC,
  p_max_price NUMERIC
)
RETURNS TABLE (
  menu_id UUID,
  nama_menu TEXT,
  harga NUMERIC,
  deskripsi TEXT,
  kategori_menu JSONB,
  total_sold INTEGER,
  foto_menu TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT
    m.id AS menu_id,
    m.nama_menu,
    m.harga,
    m.deskripsi,
    m.kategori_menu,
    COALESCE(m.total_sold, 0) AS total_sold,
    m.foto_menu
  FROM public.menu m
  WHERE m.kantin_id = p_kantin_id
    AND m.tersedia = true
    AND m.harga BETWEEN p_min_price AND p_max_price
  ORDER BY m.total_sold DESC NULLS LAST, m.harga ASC;
$$;

COMMENT ON FUNCTION public.get_menu_by_price_range IS 
'Mendapatkan menu dalam rentang harga tertentu.';

-- =============================================================================
-- FUNCTION 7: Get Popular Menu Recommendations
-- =============================================================================
-- Untuk query: "Rekomendasiin menu dong", "Menu apa yang enak?"
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_popular_menu_recommendations(
  p_kantin_id UUID,
  p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
  menu_id UUID,
  nama_menu TEXT,
  harga NUMERIC,
  deskripsi TEXT,
  kategori_menu JSONB,
  total_sold INTEGER,
  foto_menu TEXT,
  popularity_score NUMERIC
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT
    m.id AS menu_id,
    m.nama_menu,
    m.harga,
    m.deskripsi,
    m.kategori_menu,
    COALESCE(m.total_sold, 0) AS total_sold,
    m.foto_menu,
    -- Popularity score: 70% dari total_sold, 30% dari recency (menu baru dapat boost)
    (COALESCE(m.total_sold, 0) * 0.7 + 
     EXTRACT(EPOCH FROM (NOW() - m.created_at)) / 86400 * 0.3
    ) AS popularity_score
  FROM public.menu m
  WHERE m.kantin_id = p_kantin_id
    AND m.tersedia = true
  ORDER BY popularity_score DESC
  LIMIT p_limit;
$$;

COMMENT ON FUNCTION public.get_popular_menu_recommendations IS 
'Mendapatkan rekomendasi menu populer dengan scoring berdasarkan total penjualan dan recency.';

-- =============================================================================
-- FUNCTION 8: Get Cheapest Menu Options
-- =============================================================================
-- Untuk query: "Menu termurah apa?", "Yang paling murah dong"
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_cheapest_menus(
  p_kantin_id UUID,
  p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
  menu_id UUID,
  nama_menu TEXT,
  harga NUMERIC,
  deskripsi TEXT,
  kategori_menu JSONB,
  total_sold INTEGER,
  foto_menu TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT
    m.id AS menu_id,
    m.nama_menu,
    m.harga,
    m.deskripsi,
    m.kategori_menu,
    COALESCE(m.total_sold, 0) AS total_sold,
    m.foto_menu
  FROM public.menu m
  WHERE m.kantin_id = p_kantin_id
    AND m.tersedia = true
  ORDER BY m.harga ASC, m.total_sold DESC NULLS LAST
  LIMIT p_limit;
$$;

COMMENT ON FUNCTION public.get_cheapest_menus IS 
'Mendapatkan menu termurah yang tersedia.';

-- =============================================================================
-- FUNCTION 9: Get New Menu Items
-- =============================================================================
-- Untuk query: "Menu baru apa aja?", "Ada menu baru gak?"
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_new_menus(
  p_kantin_id UUID,
  p_days_ago INTEGER DEFAULT 30,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  menu_id UUID,
  nama_menu TEXT,
  harga NUMERIC,
  deskripsi TEXT,
  kategori_menu JSONB,
  total_sold INTEGER,
  foto_menu TEXT,
  created_at TIMESTAMPTZ,
  days_old INTEGER
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT
    m.id AS menu_id,
    m.nama_menu,
    m.harga,
    m.deskripsi,
    m.kategori_menu,
    COALESCE(m.total_sold, 0) AS total_sold,
    m.foto_menu,
    m.created_at,
    EXTRACT(DAY FROM (NOW() - m.created_at))::INTEGER AS days_old
  FROM public.menu m
  WHERE m.kantin_id = p_kantin_id
    AND m.tersedia = true
    AND m.created_at >= NOW() - (p_days_ago || ' days')::INTERVAL
  ORDER BY m.created_at DESC
  LIMIT p_limit;
$$;

COMMENT ON FUNCTION public.get_new_menus IS 
'Mendapatkan menu baru yang ditambahkan dalam X hari terakhir.';

-- =============================================================================
-- FUNCTION 10: Get Menu with Best Value (Price per Popularity)
-- =============================================================================
-- Untuk query: "Menu worth it apa?", "Yang paling value for money"
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_best_value_menus(
  p_kantin_id UUID,
  p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
  menu_id UUID,
  nama_menu TEXT,
  harga NUMERIC,
  deskripsi TEXT,
  kategori_menu JSONB,
  total_sold INTEGER,
  foto_menu TEXT,
  value_score NUMERIC
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT
    m.id AS menu_id,
    m.nama_menu,
    m.harga,
    m.deskripsi,
    m.kategori_menu,
    COALESCE(m.total_sold, 0) AS total_sold,
    m.foto_menu,
    -- Value score: popularity / price (higher is better)
    CASE 
      WHEN m.harga > 0 THEN ROUND(COALESCE(m.total_sold, 0)::NUMERIC / m.harga, 2)
      ELSE 0
    END AS value_score
  FROM public.menu m
  WHERE m.kantin_id = p_kantin_id
    AND m.tersedia = true
    AND m.total_sold > 0
  ORDER BY value_score DESC, m.total_sold DESC
  LIMIT p_limit;
$$;

COMMENT ON FUNCTION public.get_best_value_menus IS 
'Mendapatkan menu dengan value terbaik (popularitas dibanding harga).';

-- =============================================================================
-- FUNCTION 11: Get All Available Menus (Fallback)
-- =============================================================================
-- Untuk query general atau fallback
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_all_available_menus(
  p_kantin_id UUID
)
RETURNS TABLE (
  menu_id UUID,
  nama_menu TEXT,
  harga NUMERIC,
  deskripsi TEXT,
  kategori_menu JSONB,
  total_sold INTEGER,
  foto_menu TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT
    m.id AS menu_id,
    m.nama_menu,
    m.harga,
    m.deskripsi,
    m.kategori_menu,
    COALESCE(m.total_sold, 0) AS total_sold,
    m.foto_menu
  FROM public.menu m
  WHERE m.kantin_id = p_kantin_id
    AND m.tersedia = true
  ORDER BY m.total_sold DESC NULLS LAST, m.nama_menu ASC;
$$;

COMMENT ON FUNCTION public.get_all_available_menus IS 
'Mendapatkan semua menu yang tersedia, diurutkan berdasarkan popularitas.';

COMMIT;

-- =============================================================================
-- ✅ AI HELPER FUNCTIONS COMPLETE!
-- =============================================================================
-- Test queries:
-- 
-- 1. Menu dengan budget 20k:
--    SELECT * FROM public.get_menu_by_budget('<kantin_id>', 20000);
--
-- 2. Kombinasi menu dengan budget 25k:
--    SELECT * FROM public.get_menu_combinations('<kantin_id>', 25000, 5);
--
-- 3. Statistik kantin:
--    SELECT * FROM public.get_kantin_menu_stats('<kantin_id>');
--
-- 4. Cari menu dengan keyword:
--    SELECT * FROM public.search_menu_by_keywords('<kantin_id>', ARRAY['ayam', 'goreng']);
--
-- 5. Menu berdasarkan kategori:
--    SELECT * FROM public.get_menu_by_category('<kantin_id>', 'Makan Siang');
--
-- 6. Menu dalam rentang harga:
--    SELECT * FROM public.get_menu_by_price_range('<kantin_id>', 10000, 20000);
--
-- 7. Rekomendasi menu populer:
--    SELECT * FROM public.get_popular_menu_recommendations('<kantin_id>', 5);
--
-- 8. Menu termurah:
--    SELECT * FROM public.get_cheapest_menus('<kantin_id>', 5);
--
-- 9. Menu baru (30 hari terakhir):
--    SELECT * FROM public.get_new_menus('<kantin_id>', 30, 10);
--
-- 10. Menu dengan value terbaik:
--     SELECT * FROM public.get_best_value_menus('<kantin_id>', 5);
--
-- 11. Semua menu tersedia:
--     SELECT * FROM public.get_all_available_menus('<kantin_id>');
-- =============================================================================
