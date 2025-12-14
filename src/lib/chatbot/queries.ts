/**
 * Supabase Query Functions untuk Chatbot Kantin
 * Semua fungsi menggunakan supabaseAdmin (server-only, bypass RLS)
 */

import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Types
export interface Menu {
  id: string;
  kantin_id: string;
  nama_menu: string;
  harga: number;
  deskripsi: string | null;
  tersedia: boolean;
  kategori_menu: string[];
  total_sold: number;
  foto_menu: string | null;
}

export interface KantinInfo {
  id: string;
  nama_kantin: string;
  jam_buka: string | null;
  jam_tutup: string | null;
  buka_tutup: boolean;
  status: 'pending' | 'aktif' | 'ditolak';
}

export interface Bundle {
  makanan: Menu;
  minuman: Menu;
  total: number;
  sisa: number;
}

export interface SearchParams {
  keyword?: string;
  max_price?: number;
  kategori?: string[];
  limit?: number;
}

/**
 * Get kantin info (jam buka/tutup)
 */
export async function getKantinInfo(kantinId: string): Promise<KantinInfo | null> {
  const { data, error } = await supabaseAdmin
    .from('kantin')
    .select('id, nama_kantin, jam_buka, jam_tutup, buka_tutup, status')
    .eq('id', kantinId)
    .single();

  if (error) {
    console.error('Error fetching kantin info:', error);
    return null;
  }

  return data as KantinInfo;
}

/**
 * Find menu by name (exact or partial match)
 */
export async function findMenuByName(
  kantinId: string,
  menuName: string,
  limit: number = 5
): Promise<Menu[]> {
  const { data, error } = await supabaseAdmin
    .from('menu')
    .select('id, kantin_id, nama_menu, harga, deskripsi, tersedia, kategori_menu, total_sold, foto_menu')
    .eq('kantin_id', kantinId)
    .eq('tersedia', true)
    .ilike('nama_menu', `%${menuName}%`)
    .order('total_sold', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error finding menu by name:', error);
    return [];
  }

  return (data || []) as Menu[];
}

/**
 * Search menu with filters (keyword, max_price, kategori)
 */
export async function searchMenu(
  kantinId: string,
  params: SearchParams
): Promise<Menu[]> {
  console.log('[searchMenu] params:', params);
  
  let query = supabaseAdmin
    .from('menu')
    .select('id, kantin_id, nama_menu, harga, deskripsi, tersedia, kategori_menu, total_sold, foto_menu')
    .eq('kantin_id', kantinId)
    .eq('tersedia', true);

  // Filter by keyword (search in nama_menu and deskripsi)
  if (params.keyword) {
    query = query.or(`nama_menu.ilike.%${params.keyword}%,deskripsi.ilike.%${params.keyword}%`);
  }

  // Filter by max price
  if (params.max_price) {
    query = query.lte('harga', params.max_price);
  }

  // Filter by kategori (using contains for JSONB array)
  // Hanya apply jika kategori valid (match dengan database)
  if (params.kategori && params.kategori.length > 0) {
    const validKategori = params.kategori.filter(k => 
      ['Minuman', 'Makan Pagi', 'Makan Siang', 'Snack'].includes(k)
    );
    
    if (validKategori.length > 0) {
      for (const kat of validKategori) {
        query = query.contains('kategori_menu', [kat]);
      }
    }
  }

  // Order by popularity then price
  query = query
    .order('total_sold', { ascending: false })
    .order('harga', { ascending: false })
    .limit(params.limit || 10);

  const { data, error } = await query;

  if (error) {
    console.error('[searchMenu] Error:', error);
    return [];
  }

  console.log('[searchMenu] Found', data?.length || 0, 'menus');
  return (data || []) as Menu[];
}

/**
 * Recommend menu based on budget and optional kategori
 * Sorted by total_sold desc, then harga desc
 */
export async function recommendMenu(
  kantinId: string,
  budget: number,
  kategori?: string[],
  limit: number = 5
): Promise<Menu[]> {
  console.log('[recommendMenu] kantinId:', kantinId, 'budget:', budget, 'kategori:', kategori);
  
  let query = supabaseAdmin
    .from('menu')
    .select('id, kantin_id, nama_menu, harga, deskripsi, tersedia, kategori_menu, total_sold, foto_menu')
    .eq('kantin_id', kantinId)
    .eq('tersedia', true)
    .lte('harga', budget);

  // Filter by kategori if provided (case-sensitive, harus match dengan database)
  if (kategori && kategori.length > 0) {
    // Hanya apply filter jika kategori valid (ada di database)
    const validKategori = kategori.filter(k => 
      ['Minuman', 'Makan Pagi', 'Makan Siang', 'Snack'].includes(k)
    );
    
    if (validKategori.length > 0) {
      for (const kat of validKategori) {
        query = query.contains('kategori_menu', [kat]);
      }
    }
  }

  // Order by popularity (total_sold desc), then by price (harga desc)
  query = query
    .order('total_sold', { ascending: false })
    .order('harga', { ascending: false })
    .limit(limit);

  const { data, error } = await query;

  if (error) {
    console.error('[recommendMenu] Error:', error);
    return [];
  }

  console.log('[recommendMenu] Found', data?.length || 0, 'menus');
  return (data || []) as Menu[];
}

/**
 * Recommend bundle (makanan + minuman) within budget
 * Returns top 3 combinations sorted by popularity and budget optimization
 */
export async function recommendBundle(
  kantinId: string,
  budget: number,
  preferensi?: string[]
): Promise<Bundle[]> {
  // Get all available makanan (kategori: "Makan Pagi" atau "Makan Siang")
  // Kita ambil semua menu yang BUKAN minuman
  const makananQuery = supabaseAdmin
    .from('menu')
    .select('id, kantin_id, nama_menu, harga, deskripsi, tersedia, kategori_menu, total_sold, foto_menu')
    .eq('kantin_id', kantinId)
    .eq('tersedia', true)
    .not('kategori_menu', 'cs', '["Minuman"]')
    .lte('harga', budget)
    .order('total_sold', { ascending: false })
    .limit(20);

  // Get all available minuman (kategori: "Minuman")
  const minumanQuery = supabaseAdmin
    .from('menu')
    .select('id, kantin_id, nama_menu, harga, deskripsi, tersedia, kategori_menu, total_sold, foto_menu')
    .eq('kantin_id', kantinId)
    .eq('tersedia', true)
    .contains('kategori_menu', ['Minuman'])
    .lte('harga', budget)
    .order('total_sold', { ascending: false })
    .limit(20);

  const [makananResult, minumanResult] = await Promise.all([
    makananQuery,
    minumanQuery,
  ]);
  
  console.log('[recommendBundle] makanan count:', makananResult.data?.length || 0);
  console.log('[recommendBundle] minuman count:', minumanResult.data?.length || 0);

  if (makananResult.error || minumanResult.error) {
    console.error('Error fetching bundle data:', makananResult.error || minumanResult.error);
    return [];
  }

  const makananList = (makananResult.data || []) as Menu[];
  const minumanList = (minumanResult.data || []) as Menu[];

  // Generate all valid combinations within budget
  const bundles: Bundle[] = [];

  for (const makanan of makananList) {
    for (const minuman of minumanList) {
      const total = makanan.harga + minuman.harga;
      if (total <= budget) {
        bundles.push({
          makanan,
          minuman,
          total,
          sisa: budget - total,
        });
      }
    }
  }

  // Sort by combined popularity (total_sold), then by budget optimization (sisa ascending)
  bundles.sort((a, b) => {
    const popularityA = a.makanan.total_sold + a.minuman.total_sold;
    const popularityB = b.makanan.total_sold + b.minuman.total_sold;
    
    if (popularityB !== popularityA) {
      return popularityB - popularityA; // Higher popularity first
    }
    
    return a.sisa - b.sisa; // Lower sisa (better budget usage) first
  });

  // Return top 3
  return bundles.slice(0, 3);
}

/**
 * Get popular menus (for fallback suggestions)
 */
export async function getPopularMenus(
  kantinId: string,
  limit: number = 5
): Promise<Menu[]> {
  const { data, error } = await supabaseAdmin
    .from('menu')
    .select('id, kantin_id, nama_menu, harga, deskripsi, tersedia, kategori_menu, total_sold, foto_menu')
    .eq('kantin_id', kantinId)
    .eq('tersedia', true)
    .order('total_sold', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching popular menus:', error);
    return [];
  }

  return (data || []) as Menu[];
}

/**
 * Get all menus for a kantin (no filters except tersedia)
 * Useful for debugging and fallback
 */
export async function getAllMenus(
  kantinId: string,
  limit: number = 10
): Promise<Menu[]> {
  console.log('[getAllMenus] Fetching menus for kantin:', kantinId);
  
  const { data, error } = await supabaseAdmin
    .from('menu')
    .select('id, kantin_id, nama_menu, harga, deskripsi, tersedia, kategori_menu, total_sold, foto_menu')
    .eq('kantin_id', kantinId)
    .eq('tersedia', true)
    .order('total_sold', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[getAllMenus] Error:', error);
    return [];
  }

  console.log('[getAllMenus] Found', data?.length || 0, 'menus');
  return (data || []) as Menu[];
}

/**
 * Get menus with kantin info (for global search without specific kantin_id)
 */
export async function getGlobalPopularMenus(limit: number = 10): Promise<(Menu & { kantin: KantinInfo | null })[]> {
  const { data, error } = await supabaseAdmin
    .from('menu')
    .select(`
      id, kantin_id, nama_menu, harga, deskripsi, tersedia, kategori_menu, total_sold, foto_menu,
      kantin:kantin_id (id, nama_kantin, jam_buka, jam_tutup, buka_tutup, status)
    `)
    .eq('tersedia', true)
    .order('total_sold', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching global popular menus:', error);
    return [];
  }

  // Transform data - kantin comes as array from Supabase, take first element
  const transformed = (data || []).map((item: any) => ({
    ...item,
    kantin: Array.isArray(item.kantin) ? item.kantin[0] || null : item.kantin,
  }));

  return transformed as (Menu & { kantin: KantinInfo | null })[];
}
