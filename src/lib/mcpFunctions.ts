/**
 * MCP Functions - Core functions for AI to access database via MCP
 * All functions execute SQL queries through MCP (read-only)
 * With fallback to direct Supabase queries if MCP fails
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { callSql } from "./mcp";
import { supabaseAdmin } from "./supabaseAdmin";

const DEFAULT_LIMIT = 10;

// Type for MCP result
interface McpResult {
  content?: Array<{ text?: string }>;
  data?: unknown[];
  rows?: unknown[];
  result?: unknown[];
}

/**
 * SQL escape helper for LIKE queries
 */
function sqlEscLike(s: string): string {
  return String(s).replace(/[%_\\]/g, (m) => "\\" + m);
}

/**
 * Build WHERE clause for kategori_menu JSONB array filter
 */
function buildKategoriWhere(kategori: string[] = []): string {
  const cats = (kategori || [])
    .map((x) => String(x).trim())
    .filter(Boolean);
  if (!cats.length) return "true";
  return cats
    .map((c) => `kategori_menu ? '${c.replace(/'/g, "''")}'`)
    .join(" AND ");
}

/**
 * Build ORDER BY clause based on sort type
 */
function buildSort(sort: string | undefined, budget?: number): string {
  const s = (sort || "").toLowerCase();
  if (s === "murah") return "harga asc, total_sold desc";
  if (s === "mahal") return "harga desc, total_sold desc";
  if (s === "populer") return "total_sold desc, harga desc";
  if (s === "mendekati_budget" && typeof budget === "number")
    return `harga desc, total_sold desc`;
  return "total_sold desc, harga desc";
}

/**
 * Parse MCP result to extract data
 */
function parseMcpResult(result: McpResult): unknown {
  const content = result?.content as Array<{ text?: string }> | undefined;
  if (content && content[0]?.text) {
    try {
      return JSON.parse(content[0].text);
    } catch {
      return content[0].text;
    }
  }
  return (result as Record<string, unknown>)?.data || 
         (result as Record<string, unknown>)?.rows || 
         (result as Record<string, unknown>)?.result || [];
}

/**
 * Get kantin information by ID
 */
export async function getKantinInfo(
  mcp: Client,
  sqlToolName: string,
  kantinId: string
) {
  const sql = `
    select id, nama_kantin, jam_buka, jam_tutup, buka_tutup, status, updated_at
    from public.kantin
    where id = '${kantinId.replace(/'/g, "''")}'
    limit 1;
  `.trim();
  
  const result = await callSql(mcp, sqlToolName, sql) as McpResult;
  const parsed = parseMcpResult(result);
  return Array.isArray(parsed) ? parsed[0] : parsed;
}

/**
 * Find menu by name (fuzzy search)
 */
export async function findMenuByName(
  mcp: Client,
  sqlToolName: string,
  kantinId: string,
  name: string,
  limit: number = DEFAULT_LIMIT
) {
  const q = name ?? "";
  const limitNum = Number.isFinite(limit) ? Math.max(1, Math.min(50, limit)) : DEFAULT_LIMIT;
  const like = sqlEscLike(q);

  const sql = `
    select id, kantin_id, nama_menu, harga, deskripsi, tersedia, kategori_menu, total_sold, foto_menu, updated_at
    from public.menu
    where kantin_id = '${kantinId.replace(/'/g, "''")}'
      and (nama_menu ilike '%${like}%' escape '\\' or coalesce(deskripsi,'') ilike '%${like}%' escape '\\')
    order by total_sold desc, harga desc
    limit ${limitNum};
  `.trim();

  const result = await callSql(mcp, sqlToolName, sql) as McpResult;
  const parsed = parseMcpResult(result);
  return Array.isArray(parsed) ? parsed : [];
}


/**
 * Search menu with filters: keyword, max_price, kategori, tersedia
 */
export async function searchMenu(
  mcp: Client,
  sqlToolName: string,
  kantinId: string,
  args: {
    keyword?: string;
    max_price?: number;
    kategori?: string[];
    tersedia?: boolean;
    limit?: number;
    sort?: string;
  }
) {
  const keyword = (args.keyword ?? "").trim();
  const maxPrice = Number.isFinite(args.max_price) ? args.max_price : null;
  const tersedia = typeof args.tersedia === "boolean" ? args.tersedia : true;
  const kategoriWhere = buildKategoriWhere(args.kategori || []);
  const limitNum = Number.isFinite(args.limit)
    ? Math.max(1, Math.min(50, args.limit as number))
    : DEFAULT_LIMIT;

  const whereParts = [
    `kantin_id = '${kantinId.replace(/'/g, "''")}'`,
    tersedia ? "tersedia = true" : "true",
    maxPrice != null ? `harga <= ${maxPrice}` : "true",
    kategoriWhere,
  ];

  if (keyword) {
    const like = sqlEscLike(keyword);
    whereParts.push(
      `(nama_menu ilike '%${like}%' escape '\\' or coalesce(deskripsi,'') ilike '%${like}%' escape '\\')`
    );
  }

  const orderBy = buildSort(args.sort, maxPrice ?? undefined);

  const sql = `
    select id, kantin_id, nama_menu, harga, deskripsi, tersedia, kategori_menu, total_sold, foto_menu, updated_at
    from public.menu
    where ${whereParts.join(" AND ")}
    order by ${orderBy}
    limit ${limitNum};
  `.trim();

  const result = await callSql(mcp, sqlToolName, sql) as McpResult;
  const parsed = parseMcpResult(result);
  return Array.isArray(parsed) ? parsed : [];
}

/**
 * Recommend bundle: 3 paket makanan+minuman <= budget
 */
export async function recommendBundle(
  mcp: Client,
  sqlToolName: string,
  kantinId: string,
  budget: number,
  preferensi: string[] = []
) {
  const preferensiWhere = buildKategoriWhere(preferensi);

  const sqlMakanan = `
    select id, nama_menu, harga, total_sold, kategori_menu
    from public.menu
    where kantin_id = '${kantinId.replace(/'/g, "''")}'
      and tersedia = true
      and harga <= ${budget}
      and (kategori_menu ? 'makanan')
      and ${preferensiWhere}
    order by total_sold desc, harga desc
    limit 50;
  `.trim();

  const sqlMinuman = `
    select id, nama_menu, harga, total_sold, kategori_menu
    from public.menu
    where kantin_id = '${kantinId.replace(/'/g, "''")}'
      and tersedia = true
      and harga <= ${budget}
      and (kategori_menu ? 'minuman')
      and ${preferensiWhere}
    order by total_sold desc, harga desc
    limit 50;
  `.trim();

  const [makananRes, minumanRes] = await Promise.all([
    callSql(mcp, sqlToolName, sqlMakanan),
    callSql(mcp, sqlToolName, sqlMinuman),
  ]);

  const makananParsed = parseMcpResult(makananRes as McpResult);
  const minumanParsed = parseMcpResult(minumanRes as McpResult);
  
  const makanan: Record<string, unknown>[] = Array.isArray(makananParsed) ? makananParsed : [];
  const minuman: Record<string, unknown>[] = Array.isArray(minumanParsed) ? minumanParsed : [];

  // Pairing makanan + minuman
  const bundles: { makanan: unknown; minuman: unknown; total: number; score: number }[] = [];
  for (const m of makanan) {
    for (const d of minuman) {
      const total = Number(m.harga) + Number(d.harga);
      if (total <= budget) {
        const score =
          (Number(m.total_sold) || 0) +
          (Number(d.total_sold) || 0) +
          (total / Math.max(1, budget)) * 10;
        bundles.push({ makanan: m, minuman: d, total, score });
      }
    }
  }

  bundles.sort((a, b) => b.score - a.score);
  return { bundles: bundles.slice(0, 3), budget, preferensi };
}


/**
 * Run function by name - dispatcher for all MCP functions
 */
export async function runFunctionByName({
  mcp,
  sqlToolName,
  name,
  args,
}: {
  mcp: Client;
  sqlToolName: string;
  name: string;
  args: Record<string, unknown>;
}) {
  if (name === "get_kantin_info") {
    const kantinId = args.kantin_id as string;
    if (!kantinId) {
      throw new Error("kantin_id is required for get_kantin_info");
    }
    return await getKantinInfo(mcp, sqlToolName, kantinId);
  }

  if (name === "find_menu_by_name") {
    const kantinId = args.kantin_id as string;
    const menuName = (args.name as string) ?? "";
    const limit = args.limit as number | undefined;
    if (!kantinId) {
      throw new Error("kantin_id is required for find_menu_by_name");
    }
    return await findMenuByName(mcp, sqlToolName, kantinId, menuName, limit || DEFAULT_LIMIT);
  }

  if (name === "search_menu") {
    const kantinId = args.kantin_id as string;
    if (!kantinId) {
      throw new Error("kantin_id is required for search_menu");
    }
    return await searchMenu(mcp, sqlToolName, kantinId, {
      keyword: args.keyword as string | undefined,
      max_price: args.max_price as number | undefined,
      kategori: args.kategori as string[] | undefined,
      tersedia: args.tersedia as boolean | undefined,
      limit: args.limit as number | undefined,
      sort: args.sort as string | undefined,
    });
  }

  if (name === "recommend_bundle") {
    const kantinId = args.kantin_id as string;
    const budget = Number(args.budget);
    const preferensi = ((args.preferensi as string[]) || []).map((x: string) => String(x).trim()).filter(Boolean);
    if (!kantinId) {
      throw new Error("kantin_id is required for recommend_bundle");
    }
    if (!budget || !Number.isFinite(budget)) {
      throw new Error("budget is required and must be a number for recommend_bundle");
    }
    return await recommendBundle(mcp, sqlToolName, kantinId, budget, preferensi);
  }

  throw new Error(`Unknown function: ${name}`);
}

/**
 * Fallback functions using direct Supabase queries (when MCP fails)
 */

async function getKantinInfoFallback(kantinId: string) {
  const { data, error } = await supabaseAdmin
    .from('kantin')
    .select('id, nama_kantin, jam_buka, jam_tutup, buka_tutup, status, updated_at')
    .eq('id', kantinId)
    .single();
  
  if (error) {
    console.error('Fallback getKantinInfo error:', error);
    throw error;
  }
  return data;
}

async function findMenuByNameFallback(kantinId: string, name: string, limit: number = 10) {
  const { data, error } = await supabaseAdmin
    .from('menu')
    .select('id, kantin_id, nama_menu, harga, deskripsi, tersedia, kategori_menu, total_sold, foto_menu, updated_at')
    .eq('kantin_id', kantinId)
    .or(`nama_menu.ilike.%${name}%,deskripsi.ilike.%${name}%`)
    .order('total_sold', { ascending: false })
    .limit(limit);
  
  if (error) {
    console.error('Fallback findMenuByName error:', error);
    throw error;
  }
  return data || [];
}

async function searchMenuFallback(
  kantinId: string,
  args: {
    keyword?: string;
    max_price?: number;
    kategori?: string[];
    tersedia?: boolean;
    limit?: number;
    sort?: string;
  }
) {
  let query = supabaseAdmin
    .from('menu')
    .select('id, kantin_id, nama_menu, harga, deskripsi, tersedia, kategori_menu, total_sold, foto_menu, updated_at')
    .eq('kantin_id', kantinId);
  
  if (args.tersedia !== false) {
    query = query.eq('tersedia', true);
  }
  
  if (args.max_price) {
    query = query.lte('harga', args.max_price);
  }
  
  if (args.keyword) {
    query = query.or(`nama_menu.ilike.%${args.keyword}%,deskripsi.ilike.%${args.keyword}%`);
  }
  
  // Sort
  const sort = (args.sort || '').toLowerCase();
  if (sort === 'murah') {
    query = query.order('harga', { ascending: true }).order('total_sold', { ascending: false });
  } else if (sort === 'mahal') {
    query = query.order('harga', { ascending: false }).order('total_sold', { ascending: false });
  } else {
    query = query.order('total_sold', { ascending: false }).order('harga', { ascending: false });
  }
  
  query = query.limit(args.limit || 10);
  
  const { data, error } = await query;
  
  if (error) {
    console.error('Fallback searchMenu error:', error);
    throw error;
  }
  
  // Filter kategori manually if provided
  let result = data || [];
  if (args.kategori && args.kategori.length > 0) {
    result = result.filter(menu => {
      const menuCats = (menu.kategori_menu || []).map((c: string) => c.toLowerCase());
      return args.kategori!.some(cat => menuCats.includes(cat.toLowerCase()));
    });
  }
  
  return result;
}

async function recommendBundleFallback(kantinId: string, budget: number, preferensi: string[] = []) {
  // Get makanan
  const { data: makanan, error: makananError } = await supabaseAdmin
    .from('menu')
    .select('id, nama_menu, harga, total_sold, kategori_menu')
    .eq('kantin_id', kantinId)
    .eq('tersedia', true)
    .lte('harga', budget)
    .contains('kategori_menu', ['makanan'])
    .order('total_sold', { ascending: false })
    .limit(50);
  
  if (makananError) {
    console.error('Fallback recommendBundle makanan error:', makananError);
  }
  
  // Get minuman
  const { data: minuman, error: minumanError } = await supabaseAdmin
    .from('menu')
    .select('id, nama_menu, harga, total_sold, kategori_menu')
    .eq('kantin_id', kantinId)
    .eq('tersedia', true)
    .lte('harga', budget)
    .contains('kategori_menu', ['minuman'])
    .order('total_sold', { ascending: false })
    .limit(50);
  
  if (minumanError) {
    console.error('Fallback recommendBundle minuman error:', minumanError);
  }
  
  const makananList = makanan || [];
  const minumanList = minuman || [];
  
  // Pairing
  const bundles: { makanan: unknown; minuman: unknown; total: number; score: number }[] = [];
  for (const m of makananList) {
    for (const d of minumanList) {
      const total = Number(m.harga) + Number(d.harga);
      if (total <= budget) {
        const score = (Number(m.total_sold) || 0) + (Number(d.total_sold) || 0) + (total / Math.max(1, budget)) * 10;
        bundles.push({ makanan: m, minuman: d, total, score });
      }
    }
  }
  
  bundles.sort((a, b) => b.score - a.score);
  return { bundles: bundles.slice(0, 3), budget, preferensi };
}

/**
 * Run function with direct database fallback (when MCP is not available)
 */
export async function runFunctionWithFallback({
  name,
  args,
}: {
  name: string;
  args: Record<string, unknown>;
}) {
  console.log('Running function with fallback:', name, args);
  
  if (name === "get_kantin_info") {
    const kantinId = args.kantin_id as string;
    if (!kantinId) {
      throw new Error("kantin_id is required for get_kantin_info");
    }
    return await getKantinInfoFallback(kantinId);
  }

  if (name === "find_menu_by_name") {
    const kantinId = args.kantin_id as string;
    const menuName = (args.name as string) ?? "";
    const limit = args.limit as number | undefined;
    if (!kantinId) {
      throw new Error("kantin_id is required for find_menu_by_name");
    }
    return await findMenuByNameFallback(kantinId, menuName, limit || 10);
  }

  if (name === "search_menu") {
    const kantinId = args.kantin_id as string;
    if (!kantinId) {
      throw new Error("kantin_id is required for search_menu");
    }
    return await searchMenuFallback(kantinId, {
      keyword: args.keyword as string | undefined,
      max_price: args.max_price as number | undefined,
      kategori: args.kategori as string[] | undefined,
      tersedia: args.tersedia as boolean | undefined,
      limit: args.limit as number | undefined,
      sort: args.sort as string | undefined,
    });
  }

  if (name === "recommend_bundle") {
    const kantinId = args.kantin_id as string;
    const budget = Number(args.budget);
    const preferensi = ((args.preferensi as string[]) || []).map((x: string) => String(x).trim()).filter(Boolean);
    if (!kantinId) {
      throw new Error("kantin_id is required for recommend_bundle");
    }
    if (!budget || !Number.isFinite(budget)) {
      throw new Error("budget is required and must be a number for recommend_bundle");
    }
    return await recommendBundleFallback(kantinId, budget, preferensi);
  }

  throw new Error(`Unknown function: ${name}`);
}
