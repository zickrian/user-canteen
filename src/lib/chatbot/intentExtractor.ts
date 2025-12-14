/**
 * Intent Extractor untuk Chatbot Kantin
 * Mengekstrak intent dan parameter dari pesan user
 */

export type IntentType =
  | 'ASK_MENU_INFO'      // Tanya harga/info menu spesifik
  | 'SEARCH_MENU'        // Cari menu dengan keyword
  | 'RECOMMEND_BUDGET'   // Rekomendasi dengan budget
  | 'BUNDLE_RECOMMEND'   // Paket makanan+minuman
  | 'ASK_CANTEEN_INFO'   // Jam buka/tutup
  | 'OUT_OF_SCOPE';      // Di luar topik

export interface ExtractedIntent {
  intent: IntentType;
  kantin_id: string;
  menu_name: string | null;
  budget: number | null;
  kategori: string[];
  keyword: string | null;
  limit: number;
}

// Budget extraction patterns
const BUDGET_PATTERNS = [
  /(\d+)\s*k\b/i,                           // 20k
  /(\d+)\s*rb\b/i,                          // 20rb
  /rp\.?\s*([\d.,]+)/i,                     // Rp 20.000 atau Rp20000
  /(\d{4,})/,                               // 20000 (minimal 4 digit)
];

// Kategori mapping - sesuaikan dengan nilai di database
// Database menggunakan: "Minuman", "Makan Pagi", "Makan Siang", "Snack", dll
const KATEGORI_MAP: Record<string, string> = {
  // Minuman
  'minuman': 'Minuman',
  'minum': 'Minuman',
  'es': 'Minuman',
  'jus': 'Minuman',
  'kopi': 'Minuman',
  'teh': 'Minuman',
  'dingin': 'Minuman',
  
  // Snack / Jajan
  'snack': 'Snack',
  'jajan': 'Snack',
  'cemilan': 'Snack',
  'camilan': 'Snack',
  'gorengan': 'Snack',
  'ringan': 'Snack',
  
  // Makanan - map ke Makan Pagi atau Makan Siang
  'makanan': 'Makan Pagi',  // default ke Makan Pagi
  'makan': 'Makan Pagi',
  'sarapan': 'Makan Pagi',
  'pagi': 'Makan Pagi',
  'siang': 'Makan Siang',
  'makan siang': 'Makan Siang',
  'lunch': 'Makan Siang',
  
  // Rasa (jika ada di database)
  'pedas': 'pedas',
  'pedes': 'pedas',
  'manis': 'manis',
  'gurih': 'gurih',
};

// Intent detection patterns
const INTENT_PATTERNS: { pattern: RegExp; intent: IntentType }[] = [
  // ASK_CANTEEN_INFO - jam buka/tutup
  { pattern: /jam\s*(buka|tutup|operasional)/i, intent: 'ASK_CANTEEN_INFO' },
  { pattern: /buka\s*(nggak|tidak|gak|ga)\??/i, intent: 'ASK_CANTEEN_INFO' },
  { pattern: /tutup\s*(nggak|tidak|gak|ga)\??/i, intent: 'ASK_CANTEEN_INFO' },
  { pattern: /kapan\s*(buka|tutup)/i, intent: 'ASK_CANTEEN_INFO' },
  
  // BUNDLE_RECOMMEND - paket makanan+minuman
  { pattern: /(makan|makanan)\s*(dan|&|\+|sama)\s*(minum|minuman)/i, intent: 'BUNDLE_RECOMMEND' },
  { pattern: /(minum|minuman)\s*(dan|&|\+|sama)\s*(makan|makanan)/i, intent: 'BUNDLE_RECOMMEND' },
  { pattern: /paket/i, intent: 'BUNDLE_RECOMMEND' },
  { pattern: /combo/i, intent: 'BUNDLE_RECOMMEND' },
  { pattern: /bundle/i, intent: 'BUNDLE_RECOMMEND' },
  
  // ASK_MENU_INFO - tanya harga/info spesifik
  { pattern: /harga\s+(.+)/i, intent: 'ASK_MENU_INFO' },
  { pattern: /berapa\s+(.+)/i, intent: 'ASK_MENU_INFO' },
  { pattern: /info\s+(.+)/i, intent: 'ASK_MENU_INFO' },
  
  // RECOMMEND_BUDGET - rekomendasi dengan budget
  { pattern: /rekomendasi/i, intent: 'RECOMMEND_BUDGET' },
  { pattern: /rekomen/i, intent: 'RECOMMEND_BUDGET' },
  { pattern: /saran/i, intent: 'RECOMMEND_BUDGET' },
  { pattern: /enak\s*(apa|yang)/i, intent: 'RECOMMEND_BUDGET' },
  { pattern: /yang\s*enak/i, intent: 'RECOMMEND_BUDGET' },
  { pattern: /populer/i, intent: 'RECOMMEND_BUDGET' },
  { pattern: /laris/i, intent: 'RECOMMEND_BUDGET' },
  { pattern: /favorit/i, intent: 'RECOMMEND_BUDGET' },
  
  // SEARCH_MENU - cari menu
  { pattern: /cari\s+(.+)/i, intent: 'SEARCH_MENU' },
  { pattern: /ada\s+(.+)/i, intent: 'SEARCH_MENU' },
  { pattern: /menu\s+(.+)/i, intent: 'SEARCH_MENU' },
  { pattern: /yang\s+(.+)/i, intent: 'SEARCH_MENU' },
];

/**
 * Extract budget dari pesan user
 * @param message Pesan user
 * @returns Budget dalam integer atau null
 */
export function extractBudget(message: string): number | null {
  for (const pattern of BUDGET_PATTERNS) {
    const match = message.match(pattern);
    if (match) {
      let value = match[1].replace(/[.,]/g, '');
      const num = parseInt(value, 10);
      
      // Jika pattern adalah k atau rb, kalikan 1000
      if (pattern.source.includes('k\\b') || pattern.source.includes('rb\\b')) {
        return num * 1000;
      }
      
      // Untuk Rp dan angka langsung, return as is
      return num;
    }
  }
  return null;
}

/**
 * Extract kategori dari pesan user
 * @param message Pesan user
 * @returns Array of standard kategori
 */
export function extractKategori(message: string): string[] {
  const found: Set<string> = new Set();
  const lowerMessage = message.toLowerCase();
  
  for (const [keyword, standard] of Object.entries(KATEGORI_MAP)) {
    // Use word boundary check
    const regex = new RegExp(`\\b${keyword}\\b`, 'i');
    if (regex.test(lowerMessage)) {
      found.add(standard);
    }
  }
  
  return Array.from(found);
}

/**
 * Extract menu name dari pesan user
 * @param message Pesan user
 * @returns Menu name atau null
 */
export function extractMenuName(message: string): string | null {
  // Pattern untuk extract nama menu setelah kata kunci
  const patterns = [
    /harga\s+(.+?)(?:\s*\?|$)/i,
    /berapa\s+(.+?)(?:\s*\?|$)/i,
    /info\s+(.+?)(?:\s*\?|$)/i,
  ];
  
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      // Clean up the menu name
      return match[1].trim().replace(/\s+/g, ' ');
    }
  }
  
  return null;
}

/**
 * Extract keyword untuk search
 * @param message Pesan user
 * @returns Keyword atau null
 */
export function extractKeyword(message: string): string | null {
  const patterns = [
    /cari\s+(.+?)(?:\s*\?|$)/i,
    /ada\s+(.+?)(?:\s*\?|$)/i,
  ];
  
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      return match[1].trim().replace(/\s+/g, ' ');
    }
  }
  
  return null;
}

/**
 * Detect intent dari pesan user
 * @param message Pesan user
 * @returns IntentType
 */
export function detectIntent(message: string): IntentType {
  const lowerMessage = message.toLowerCase();
  
  // Check each pattern in order (order matters!)
  for (const { pattern, intent } of INTENT_PATTERNS) {
    if (pattern.test(lowerMessage)) {
      return intent;
    }
  }
  
  // Check if message contains budget - likely a recommendation request
  if (extractBudget(message) !== null) {
    return 'RECOMMEND_BUDGET';
  }
  
  // Check if message contains kategori - likely a search
  if (extractKategori(message).length > 0) {
    return 'SEARCH_MENU';
  }
  
  return 'OUT_OF_SCOPE';
}

/**
 * Main function: Extract intent dan semua parameter dari pesan user
 * @param message Pesan user
 * @param kantinId ID kantin
 * @returns ExtractedIntent object
 */
export function extractIntent(message: string, kantinId: string): ExtractedIntent {
  const intent = detectIntent(message);
  const budget = extractBudget(message);
  const kategori = extractKategori(message);
  const menuName = extractMenuName(message);
  const keyword = extractKeyword(message);
  
  return {
    intent,
    kantin_id: kantinId,
    menu_name: menuName,
    budget,
    kategori,
    keyword,
    limit: 10, // Default limit
  };
}
