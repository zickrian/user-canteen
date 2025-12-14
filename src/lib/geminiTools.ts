/**
 * Gemini Function Calling Tools
 * Simplified to 4 core functions that use MCP for direct database access
 */

export const tools = {
  functionDeclarations: [
    {
      name: "get_kantin_info",
      description:
        "Ambil info kantin (nama_kantin, jam_buka, jam_tutup, buka_tutup, status) berdasarkan kantin_id.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          kantin_id: {
            type: "string",
            description: "UUID kantin",
          },
        },
        required: ["kantin_id"],
      },
    },
    {
      name: "find_menu_by_name",
      description:
        "Cari menu berdasarkan nama_menu (fuzzy). Return beberapa kandidat dari kantin tertentu (read-only).",
      parametersJsonSchema: {
        type: "object",
        properties: {
          kantin_id: {
            type: "string",
            description: "UUID kantin",
          },
          name: {
            type: "string",
            description: "Nama menu / keyword",
          },
          limit: {
            type: "number",
            description: "Max hasil (default 10)",
          },
        },
        required: ["kantin_id", "name"],
      },
    },
    {
      name: "search_menu",
      description:
        "Cari menu di kantin dengan filter opsional: keyword, max_price, kategori (array string), tersedia (default true).",
      parametersJsonSchema: {
        type: "object",
        properties: {
          kantin_id: {
            type: "string",
            description: "UUID kantin",
          },
          keyword: {
            type: "string",
            description: "Keyword nama/deskripsi (opsional)",
          },
          max_price: {
            type: "number",
            description: "Budget maksimal (opsional)",
          },
          kategori: {
            type: "array",
            items: { type: "string" },
            description:
              "Filter kategori_menu (opsional), contoh: ['makanan','pedas']",
          },
          tersedia: {
            type: "boolean",
            description: "Default true",
          },
          limit: {
            type: "number",
            description: "Max hasil (default 10)",
          },
          sort: {
            type: "string",
            description: "populer|murah|mahal|mendekati_budget (opsional)",
          },
        },
        required: ["kantin_id"],
      },
    },
    {
      name: "recommend_bundle",
      description:
        "Rekomendasi 3 paket makanan+minuman <= budget dari kantin tertentu. Pakai kategori_menu berisi 'makanan' dan 'minuman'.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          kantin_id: {
            type: "string",
            description: "UUID kantin",
          },
          budget: {
            type: "number",
            description: "Budget maksimal (wajib)",
          },
          preferensi: {
            type: "array",
            items: { type: "string" },
            description:
              "Preferensi kategori_menu (opsional) contoh: ['pedas','dingin']",
          },
        },
        required: ["kantin_id", "budget"],
      },
    },
  ],
};
