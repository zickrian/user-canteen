/**
 * Gemini Summarizer untuk Chatbot Kantin
 * Merangkum data query menjadi jawaban natural
 */

import { GoogleGenAI } from '@google/genai';
import { IntentType } from './intentExtractor';
import { Menu, KantinInfo, Bundle } from './queries';
import {
  formatMenuList,
  formatMenuDetails,
  formatBundleDetails,
  formatKantinInfo,
} from './formatters';

export interface SummarizerInput {
  userMessage: string;
  intent: IntentType;
  queryResult: Menu[] | Bundle[] | KantinInfo | null;
  kantinInfo?: KantinInfo;
  budget?: number | null;
  kategori?: string[];
}

// System prompt untuk Gemini
const SUMMARIZER_PROMPT = `Kamu adalah asisten kantin yang ramah dan helpful. Tugasmu adalah merangkum data menu/kantin menjadi jawaban natural dalam Bahasa Indonesia.

ATURAN:
1. Jawab dengan singkat, padat, dan ramah
2. Gunakan emoji secukupnya untuk membuat jawaban lebih friendly
3. JANGAN mengarang data - hanya gunakan data yang diberikan
4. Jika data kosong, berikan saran alternatif
5. Format harga dengan "Rp X.XXX"
6. Maksimal 3-4 kalimat untuk jawaban umum
7. Untuk list menu, tampilkan dalam format yang mudah dibaca

TOPIK YANG BOLEH DIJAWAB:
- Menu (nama, harga, deskripsi, kategori)
- Rekomendasi menu berdasarkan budget
- Paket/bundle makanan + minuman
- Jam buka/tutup kantin
- Ketersediaan menu

JANGAN JAWAB topik di luar kantin. Jika ditanya di luar topik, arahkan kembali ke menu kantin.`;

/**
 * Clean markdown formatting from text
 */
export function cleanMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1') // bold
    .replace(/\*(.*?)\*/g, '$1') // italic
    .replace(/_(.*?)_/g, '$1') // underscore italic
    .replace(/```[\s\S]*?```/g, '') // code blocks
    .replace(/`(.*?)`/g, '$1') // inline code
    .replace(/^#{1,6}\s+/gm, '') // headers
    .trim();
}

/**
 * Generate fallback response when query returns empty
 */
export function generateFallbackResponse(
  intent: IntentType,
  budget?: number | null,
  kategori?: string[]
): string {
  switch (intent) {
    case 'ASK_MENU_INFO':
      return 'Hmm, menu yang kamu cari belum ada nih. Coba cari dengan kata kunci lain atau tanya menu populer aja! 😊';

    case 'SEARCH_MENU':
      const searchSuggestion = kategori?.length
        ? `Coba cari dengan kategori lain atau kata kunci yang berbeda ya!`
        : `Coba gunakan kata kunci yang lebih spesifik atau tanya rekomendasi menu populer!`;
      return `Belum ada menu yang cocok dengan pencarianmu. ${searchSuggestion} 😊`;

    case 'RECOMMEND_BUDGET':
      if (budget) {
        return `Belum ada menu di bawah Rp ${budget.toLocaleString('id-ID')} nih. Coba naikkan budget sedikit atau tanya menu termurah yang tersedia! 💰`;
      }
      return 'Kasih tau budget kamu dong, biar aku bisa kasih rekomendasi yang pas! 😊';

    case 'BUNDLE_RECOMMEND':
      if (budget) {
        return `Belum ada paket makanan + minuman yang pas di budget Rp ${budget.toLocaleString('id-ID')}. Coba naikkan budget sedikit ya! 🍱`;
      }
      return 'Mau paket dengan budget berapa? Kasih tau ya biar aku carikan yang pas! 🍱';

    case 'ASK_CANTEEN_INFO':
      return 'Info kantin belum tersedia. Coba tanya langsung ke penjual ya! 🏪';

    default:
      return 'Aku khusus bantu soal menu kantin (makanan/minuman, harga, rekomendasi, jam buka). Mau cari menu apa atau budget berapa?';
  }
}

/**
 * Format query result for Gemini context
 */
function formatQueryResultForContext(
  intent: IntentType,
  queryResult: Menu[] | Bundle[] | KantinInfo | null
): string {
  if (!queryResult) {
    return 'Data tidak tersedia.';
  }

  switch (intent) {
    case 'ASK_MENU_INFO':
    case 'SEARCH_MENU':
    case 'RECOMMEND_BUDGET':
      const menus = queryResult as Menu[];
      if (menus.length === 0) return 'Tidak ada menu yang ditemukan.';
      return formatMenuDetails(menus);

    case 'BUNDLE_RECOMMEND':
      const bundles = queryResult as Bundle[];
      if (bundles.length === 0) return 'Tidak ada paket yang sesuai.';
      return formatBundleDetails(bundles);

    case 'ASK_CANTEEN_INFO':
      const kantin = queryResult as KantinInfo;
      return formatKantinInfo(kantin);

    default:
      return 'Data tidak tersedia.';
  }
}

/**
 * Check if query result is empty
 */
function isEmptyResult(queryResult: Menu[] | Bundle[] | KantinInfo | null): boolean {
  if (!queryResult) return true;
  if (Array.isArray(queryResult)) return queryResult.length === 0;
  return false;
}

/**
 * Summarize query result with Gemini
 */
export async function summarizeWithGemini(input: SummarizerInput): Promise<string> {
  const { userMessage, intent, queryResult, budget, kategori } = input;

  // Check for empty result - return fallback
  if (isEmptyResult(queryResult)) {
    return generateFallbackResponse(intent, budget, kategori);
  }

  // Get API key
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY not configured');
    // Return formatted data without AI summarization
    return formatQueryResultForContext(intent, queryResult);
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const formattedData = formatQueryResultForContext(intent, queryResult);

    const prompt = `${SUMMARIZER_PROMPT}

Pertanyaan user: "${userMessage}"
Intent: ${intent}
${budget ? `Budget: Rp ${budget.toLocaleString('id-ID')}` : ''}
${kategori?.length ? `Kategori: ${kategori.join(', ')}` : ''}

Data dari database:
${formattedData}

Berikan jawaban natural dan ramah berdasarkan data di atas. Jangan mengarang data yang tidak ada.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        temperature: 0.4,
        maxOutputTokens: 500,
      },
    });

    let text = response.text || formatQueryResultForContext(intent, queryResult);
    return cleanMarkdown(text);
  } catch (error) {
    console.error('Gemini summarization error:', error);
    // Fallback to formatted data
    return formatQueryResultForContext(intent, queryResult);
  }
}

/**
 * Out of scope rejection template
 */
export const OUT_OF_SCOPE_TEMPLATE =
  'Aku khusus bantu soal menu kantin (makanan/minuman, harga, rekomendasi, jam buka). Mau cari menu apa atau budget berapa?';
