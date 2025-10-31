/**
 * AI Tools - RPC Helper Functions
 * Fungsi-fungsi untuk memanggil stored procedures Supabase
 * dari AI Assistant dengan supabaseAdmin client
 */

import { supabaseAdmin } from './supabaseAdmin'

/**
 * Ambil menu dengan harga <= budget (Global - tanpa kantinId)
 */
export async function rpcGetMenuByBudgetGlobal(
  maxBudget: number, 
  limit?: number
) {
  const { data, error } = await supabaseAdmin
    .from('menu')
    .select(`
      *,
      kantin:kantin_id (
        id,
        nama_kantin,
        status
      )
    `)
    .eq('tersedia', true)
    .lte('harga', maxBudget)
    .order('total_sold', { ascending: false })
    .order('harga', { ascending: true })
    .limit(limit || 10)
  
  if (error) {
    console.error('Error getting menu by budget (global):', error)
    throw error
  }
  
  return data
}

/**
 * Cari menu berdasarkan keywords (Global - tanpa kantinId)
 */
export async function rpcSearchMenusGlobal(
  keywords: string[], 
  limit?: number
) {
  const { data, error } = await supabaseAdmin
    .from('menu')
    .select(`
      *,
      kantin:kantin_id (
        id,
        nama_kantin,
        status
      )
    `)
    .eq('tersedia', true)
    .or(
      keywords.map(keyword => 
        `nama_menu.ilike.%${keyword}%,deskripsi.ilike.%${keyword}%`
      ).join(',')
    )
    .order('total_sold', { ascending: false })
    .limit(limit || 10)
  
  if (error) {
    console.error('Error searching menus (global):', error)
    throw error
  }
  
  return data
}

/**
 * Ambil menu berdasarkan kategori (Global - tanpa kantinId)
 */
export async function rpcGetMenusByCategoryGlobal(
  category: string, 
  limit?: number
) {
  const { data, error } = await supabaseAdmin
    .from('menu')
    .select(`
      *,
      kantin:kantin_id (
        id,
        nama_kantin,
        status
      )
    `)
    .eq('tersedia', true)
    .contains('kategori_menu', [category])
    .order('total_sold', { ascending: false })
    .limit(limit || 10)
  
  if (error) {
    console.error('Error getting menus by category (global):', error)
    throw error
  }
  
  return data
}

/**
 * Ambil menu termurah (Global - tanpa kantinId)
 */
export async function rpcGetCheapestMenusGlobal(
  limit: number = 5
) {
  const { data, error } = await supabaseAdmin
    .from('menu')
    .select(`
      *,
      kantin:kantin_id (
        id,
        nama_kantin,
        status
      )
    `)
    .eq('tersedia', true)
    .order('harga', { ascending: true })
    .order('total_sold', { ascending: false })
    .limit(limit)
  
  if (error) {
    console.error('Error getting cheapest menus (global):', error)
    throw error
  }
  
  return data
}

/**
 * Ambil menu dengan value terbaik (Global - tanpa kantinId)
 */
export async function rpcGetBestValueMenusGlobal(
  limit: number = 5
) {
  const { data, error } = await supabaseAdmin
    .from('menu')
    .select(`
      *,
      kantin:kantin_id (
        id,
        nama_kantin,
        status
      )
    `)
    .eq('tersedia', true)
    .gt('total_sold', 0)
    .order('total_sold', { ascending: false })
    .order('harga', { ascending: true })
    .limit(limit)
  
  if (error) {
    console.error('Error getting best value menus (global):', error)
    throw error
  }
  
  return data
}

/**
 * Ambil menu populer (Global - tanpa kantinId)
 */
export async function rpcGetPopularMenusGlobal(
  limit: number = 5
) {
  const { data, error } = await supabaseAdmin
    .from('menu')
    .select(`
      *,
      kantin:kantin_id (
        id,
        nama_kantin,
        status
      )
    `)
    .eq('tersedia', true)
    .order('total_sold', { ascending: false })
    .limit(limit)
  
  if (error) {
    console.error('Error getting popular menus (global):', error)
    throw error
  }
  
  return data
}

/**
 * Ambil menu baru dalam X hari terakhir (Global - tanpa kantinId)
 */
export async function rpcGetNewMenusGlobal(
  daysAgo: number = 30, 
  limit: number = 10
) {
  const { data, error } = await supabaseAdmin
    .from('menu')
    .select(`
      *,
      kantin:kantin_id (
        id,
        nama_kantin,
        status
      )
    `)
    .eq('tersedia', true)
    .gte('created_at', new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false })
    .limit(limit)
  
  if (error) {
    console.error('Error getting new menus (global):', error)
    throw error
  }
  
  return data
}

/**
 * Ambil semua menu yang tersedia (Global - tanpa kantinId)
 */
export async function rpcGetAllMenusGlobal(
  limit?: number
) {
  const { data, error } = await supabaseAdmin
    .from('menu')
    .select(`
      *,
      kantin:kantin_id (
        id,
        nama_kantin,
        status
      )
    `)
    .eq('tersedia', true)
    .order('total_sold', { ascending: false })
    .limit(limit || 20)
  
  if (error) {
    console.error('Error getting all menus (global):', error)
    throw error
  }
  
  return data
}

/**
 * Ambil menu dengan harga <= budget
 */
export async function rpcGetMenuByBudget(
  kantinId: string, 
  maxBudget: number, 
  limit?: number
) {
  const { data, error } = await supabaseAdmin.rpc('get_menu_by_budget', {
    p_kantin_id: kantinId,
    p_max_budget: maxBudget,
  })
  
  if (error) {
    console.error('Error getting menu by budget:', error)
    throw error
  }
  
  return limit ? data?.slice(0, limit) : data
}

/**
 * Cari menu berdasarkan keywords
 */
export async function rpcSearchMenus(
  kantinId: string, 
  keywords: string[], 
  limit?: number
) {
  const { data, error } = await supabaseAdmin.rpc('search_menu_by_keywords', {
    p_kantin_id: kantinId,
    p_keywords: keywords,
  })
  
  if (error) {
    console.error('Error searching menus:', error)
    throw error
  }
  
  return limit ? data?.slice(0, limit) : data
}

/**
 * Ambil menu berdasarkan kategori
 */
export async function rpcGetMenusByCategory(
  kantinId: string, 
  category: string, 
  limit?: number
) {
  const { data, error } = await supabaseAdmin.rpc('get_menu_by_category', {
    p_kantin_id: kantinId,
    p_category: category,
  })
  
  if (error) {
    console.error('Error getting menus by category:', error)
    throw error
  }
  
  return limit ? data?.slice(0, limit) : data
}

/**
 * Ambil menu termurah
 */
export async function rpcGetCheapestMenus(
  kantinId: string, 
  limit: number = 5
) {
  const { data, error } = await supabaseAdmin.rpc('get_cheapest_menus', {
    p_kantin_id: kantinId,
    p_limit: limit,
  })
  
  if (error) {
    console.error('Error getting cheapest menus:', error)
    throw error
  }
  
  return data
}

/**
 * Ambil menu dengan value terbaik (sold/price ratio)
 */
export async function rpcGetBestValueMenus(
  kantinId: string, 
  limit: number = 5
) {
  const { data, error } = await supabaseAdmin.rpc('get_best_value_menus', {
    p_kantin_id: kantinId,
    p_limit: limit,
  })
  
  if (error) {
    console.error('Error getting best value menus:', error)
    throw error
  }
  
  return data
}

/**
 * Ambil menu populer
 */
export async function rpcGetPopularMenus(
  kantinId: string, 
  limit: number = 5
) {
  const { data, error } = await supabaseAdmin.rpc('get_popular_menu_recommendations', {
    p_kantin_id: kantinId,
    p_limit: limit,
  })
  
  if (error) {
    console.error('Error getting popular menus:', error)
    throw error
  }
  
  return data
}

/**
 * Ambil menu baru dalam X hari terakhir
 */
export async function rpcGetNewMenus(
  kantinId: string, 
  daysAgo: number = 30, 
  limit: number = 10
) {
  const { data, error } = await supabaseAdmin.rpc('get_new_menus', {
    p_kantin_id: kantinId,
    p_days_ago: daysAgo,
    p_limit: limit,
  })
  
  if (error) {
    console.error('Error getting new menus:', error)
    throw error
  }
  
  return data
}

/**
 * Ambil kombinasi menu dalam budget
 */
export async function rpcGetMenuCombos(
  kantinId: string, 
  budget: number, 
  limit: number = 10
) {
  const { data, error } = await supabaseAdmin.rpc('get_menu_combinations', {
    p_kantin_id: kantinId,
    p_budget: budget,
    p_limit: limit,
  })
  
  if (error) {
    console.error('Error getting menu combos:', error)
    throw error
  }
  
  return data
}

/**
 * Ambil statistik kantin
 */
export async function rpcGetKantinStats(kantinId: string) {
  const { data, error } = await supabaseAdmin.rpc('get_kantin_menu_stats', {
    p_kantin_id: kantinId,
  })
  
  if (error) {
    console.error('Error getting kantin stats:', error)
    throw error
  }
  
  return data?.[0] ?? null
}

/**
 * Ambil semua menu yang tersedia
 */
export async function rpcGetAllMenus(
  kantinId: string, 
  limit?: number
) {
  const { data, error } = await supabaseAdmin.rpc('get_all_available_menus', {
    p_kantin_id: kantinId,
  })
  
  if (error) {
    console.error('Error getting all menus:', error)
    throw error
  }
  
  return limit ? data?.slice(0, limit) : data
}
