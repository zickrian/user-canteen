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

/**
 * Ambil informasi detail kantin
 */
export async function rpcGetKantinInfo(kantinId: string) {
  const { data, error } = await supabaseAdmin
    .from('kantin')
    .select(`
      *,
      menu:menu (
        id,
        nama_menu,
        harga,
        kategori_menu,
        total_sold,
        tersedia
      )
    `)
    .eq('id', kantinId)
    .single()
  
  if (error) {
    console.error('Error getting kantin info:', error)
    throw error
  }
  
  return data
}

/**
 * Ambil semua kantin yang aktif
 */
export async function rpcGetAllKantins() {
  const { data, error } = await supabaseAdmin
    .from('kantin')
    .select(`
      *,
      menu:menu (
        id,
        nama_menu,
        harga,
        kategori_menu,
        total_sold,
        tersedia
      )
    `)
    .eq('status', 'aktif')
    .order('nama_kantin')
  
  if (error) {
    console.error('Error getting all kantins:', error)
    throw error
  }
  
  return data
}

/**
 * Cari kantin berdasarkan nama atau keywords
 */
export async function rpcSearchKantins(keywords: string[]) {
  const { data, error } = await supabaseAdmin
    .from('kantin')
    .select(`
      *,
      menu:menu (
        id,
        nama_menu,
        harga,
        kategori_menu,
        total_sold,
        tersedia
      )
    `)
    .eq('status', 'aktif')
    .or(
      keywords.map(keyword => 
        `nama_kantin.ilike.%${keyword}%,deskripsi.ilike.%${keyword}%`
      ).join(',')
    )
    .order('nama_kantin')
  
  if (error) {
    console.error('Error searching kantins:', error)
    throw error
  }
  
  return data
}

/**
 * Ambil menu berdasarkan kategori makanan (sarapan, makan siang, snack)
 */
export async function rpcGetMakananByCategory(
  category: string, 
  limit?: number
) {
  // Ambil semua menu yang tersedia
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
    .limit(50) // Ambil banyak untuk di-filter
  
  if (error) {
    console.error('Error getting makanan by category:', error)
    throw error
  }
  
  // Filter: HANYA makanan, BUKAN minuman/snack/jajanan/dessert
  const filtered = data?.filter(menu => {
    const categories = (menu.kategori_menu || []).map((cat: string) => cat.toLowerCase())
    
    // EXCLUDE minuman, snack, jajanan, dessert
    const excludeCategories = ['minuman', 'snack', 'jajanan', 'dessert','jajan']
    const hasExcluded = categories.some((cat: string) => excludeCategories.includes(cat))
    
    // Jika ada kategori excluded, skip
    if (hasExcluded) return false
    
    // Jika kategori kosong atau hanya punya kategori makanan, ambil
    return true
  })
  
  // Limit hasil sesuai parameter
  return filtered?.slice(0, limit || 10)
}

/**
 * Ambil menu berdasarkan kategori minuman
 */
export async function rpcGetMinumanByCategory(
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
    .contains('kategori_menu', ['minuman'])
    .order('total_sold', { ascending: false })
    .limit(limit || 10)
  
  if (error) {
    console.error('Error getting minuman by category:', error)
    throw error
  }
  
  return data
}

/**
 * Ambil menu makanan sehat (untuk kondisi kesehatan tertentu)
 */
export async function rpcGetHealthyMenus(
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
    console.error('Error getting healthy menus:', error)
    throw error
  }
  
  return data
}


/**
 * Ambil kombinasi makanan + minuman terbaik dalam budget
 */
export async function rpcGetBestMealCombo(
  budget: number, 
  timeOfDay?: 'pagi' | 'siang' | 'malam',
  limit?: number
) {
  try {
    // Ambil semua menu yang tersedia
    const { data: allMenus, error } = await supabaseAdmin
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
      .lte('harga', budget)
      .order('total_sold', { ascending: false })
      .limit(50) // Ambil banyak untuk kombinasi
    
    if (error) {
      console.error('Error getting menus for combo:', error)
      throw error
    }
    
    // Filter makanan dan minuman
    const makananList = allMenus?.filter(menu => {
      const categories = (menu.kategori_menu || []).map((cat: string) => cat.toLowerCase())
      const excludeCategories = ['minuman', 'snack', 'jajanan', 'dessert', 'jajan']
      return !categories.some((cat: string) => excludeCategories.includes(cat))
    }) || []
    
    const minumanList = allMenus?.filter(menu => {
      const categories = (menu.kategori_menu || []).map((cat: string) => cat.toLowerCase())
      return categories.includes('minuman')
    }) || []
    
    // Filter berdasarkan waktu jika ditentukan
    let filteredMakanan = makananList
    if (timeOfDay) {
      filteredMakanan = makananList.filter(menu => {
        const categories = (menu.kategori_menu || []).map((cat: string) => cat.toLowerCase())
        switch (timeOfDay) {
          case 'pagi':
            return categories.includes('sarapan') || categories.includes('makanan berat')
          case 'siang':
            return categories.includes('makan siang') || categories.includes('makanan berat')
          case 'malam':
            return categories.includes('makan malam') || categories.includes('makanan berat')
          default:
            return true
        }
      })
    }
    
    // Jika tidak ada makanan sesuai waktu, gunakan semua makanan
    if (filteredMakanan.length === 0) {
      filteredMakanan = makananList
    }
    
    // Cari kombinasi terbaik
    const bestCombos: any[] = []
    
    for (const makanan of filteredMakanan.slice(0, 10)) {
      for (const minuman of minumanList.slice(0, 10)) {
        const total = makanan.harga + minuman.harga
        if (total <= budget) {
          // Hitung score berdasarkan popularitas dan harga
          const score = (makanan.total_sold || 0) + (minuman.total_sold || 0) - (total / 1000)
          bestCombos.push({
            makanan,
            minuman,
            total,
            score,
            sisa: budget - total
          })
        }
      }
    }
    
    // Sort by score tertinggi dan sisa budget terkecil (optimal)
    bestCombos.sort((a, b) => {
      if (Math.abs(a.score - b.score) < 10) {
        return a.sisa - b.sisa // Prioritaskan yang lebih hemat
      }
      return b.score - a.score
    })
    
    return bestCombos.slice(0, limit || 5)
  } catch (error) {
    console.error('Error in rpcGetBestMealCombo:', error)
    throw error
  }
}

/**
 * Ambil rekomendasi berdasarkan waktu (pagi/siang/malam)
 */
export async function rpcGetRecommendationsByTime(
  timeOfDay: 'pagi' | 'siang' | 'malam',
  limit?: number
) {
  try {
    let targetCategories: string[] = []
    
    switch (timeOfDay) {
      case 'pagi':
        targetCategories = ['sarapan', 'makanan berat']
        break
      case 'siang':
        targetCategories = ['makan siang', 'makanan berat']
        break
      case 'malam':
        targetCategories = ['makan malam', 'makanan berat']
        break
    }
    
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
        targetCategories.map(cat => `kategori_menu.cs.{${cat}}`).join(',')
      )
      .order('total_sold', { ascending: false })
      .limit(limit || 10)
    
    if (error) {
      console.error('Error getting time-based recommendations:', error)
      throw error
    }
    
    return data
  } catch (error) {
    console.error('Error in rpcGetRecommendationsByTime:', error)
    throw error
  }
}

/**
 * Fallback function - ambil menu terpopuler jika pencarian gagal
 */
export async function rpcGetFallbackMenus(
  kantinId?: string,
  limit?: number
) {
  try {
    let query = supabaseAdmin
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
      .limit(limit || 8)
    
    if (kantinId) {
      query = query.eq('kantin_id', kantinId)
    }
    
    const { data, error } = await query
    
    if (error) {
      console.error('Error getting fallback menus:', error)
      throw error
    }
    
    return data
  } catch (error) {
    console.error('Error in rpcGetFallbackMenus:', error)
    throw error
  }
}

/**
 * Cari menu dengan harga di bawah 10000
 */
export async function rpcGetMenusUnder10k(
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
    .lte('harga', 10000)
    .order('harga', { ascending: true })
    .order('total_sold', { ascending: false })
    .limit(limit || 15)
  
  if (error) {
    console.error('Error getting menus under 10k:', error)
    throw error
  }
  
  return data
}
