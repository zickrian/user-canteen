/**
 * Gemini Function Calling Tools
 * Deklarasi tools untuk Gemini AI agar bisa memanggil fungsi database
 * Menggunakan @google/genai package terbaru
 */

export const tools = {
  functionDeclarations: [
    {
      name: "queryMenuDirect",
      description: "Query langsung ke database menu dengan filter fleksibel. Gunakan untuk pertanyaan spesifik seperti 'makanan termurah', 'minuman termahal', 'makanan terpopuler', dll. Tool ini bisa filter berdasarkan: jenis (makanan/minuman), sort by (harga, popularitas), budget, dan filter lainnya. WAJIB gunakan untuk pertanyaan yang memerlukan kombinasi filter kompleks seperti 'makanan termurah', 'minuman budget 10000', dll. Tool ini memberikan akses langsung ke nama_menu dan harga tanpa perlu kata kunci.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          kantinId: {
            type: "string",
            description: "ID kantin (wajib, dari konteks aplikasi)"
          },
          jenis: {
            type: "string",
            enum: ["makanan", "minuman", "semua"],
            description: "Filter jenis: 'makanan' = hanya makanan (bukan minuman/snack), 'minuman' = hanya minuman, 'semua' = semua menu"
          },
          sortBy: {
            type: "string",
            enum: ["harga_asc", "harga_desc", "popularitas", "terbaru"],
            description: "Urutkan berdasarkan: harga_asc = termurah, harga_desc = termahal, popularitas = terlaris, terbaru = baru ditambahkan"
          },
          maxPrice: {
            type: "number",
            description: "Harga maksimal (opsional, jika user sebut budget)"
          },
          minPrice: {
            type: "number",
            description: "Harga minimal (opsional)"
          },
          tersedia: {
            type: "boolean",
            description: "Filter hanya menu tersedia (default: true)"
          },
          limit: {
            type: "integer",
            description: "Jumlah hasil (default: 1 untuk pertanyaan spesifik seperti 'termurah', 5 untuk umum)"
          }
        },
        required: ["kantinId", "jenis", "sortBy"]
      }
    },
    {
      name: "findMenuByName",
      description: "Cari menu berdasarkan nama menu (exact atau partial match). Gunakan ketika user menyebutkan nama menu spesifik seperti 'nasi goreng', 'mie ayam', dll. WAJIB gunakan untuk intent ASK_MENU_INFO.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          kantinId: {
            type: "string",
            description: "ID kantin (wajib, dari konteks aplikasi)"
          },
          menuName: {
            type: "string",
            description: "Nama menu yang dicari (bisa partial, contoh: 'nasi goreng', 'goreng', 'ayam')"
          },
          limit: {
            type: "integer",
            description: "Jumlah maksimal hasil (default: 5)"
          }
        },
        required: ["kantinId", "menuName"]
      }
    },
    {
      name: "searchMenu",
      description: "Cari menu dengan filter lengkap: kata kunci, kategori, budget maksimal, dan status tersedia. Gunakan untuk intent SEARCH_MENU ketika user mencari menu dengan berbagai kriteria.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          kantinId: {
            type: "string",
            description: "ID kantin (wajib, dari konteks aplikasi)"
          },
          q: {
            type: "string",
            description: "Kata kunci pencarian (opsional, bisa kosong jika hanya filter kategori)"
          },
          kategori: {
            type: "array",
            items: { type: "string" },
            description: "Array kategori menu (contoh: ['pedas', 'makanan', 'minuman', 'kopi', 'teh'])"
          },
          maxPrice: {
            type: "number",
            description: "Harga maksimal (opsional, jika user sebut budget)"
          },
          tersedia: {
            type: "boolean",
            description: "Filter hanya menu tersedia (default: true)"
          },
          limit: {
            type: "integer",
            description: "Jumlah maksimal hasil (default: 10)"
          }
        },
        required: ["kantinId"]
      }
    },
    {
      name: "recommendMenu",
      description: "Rekomendasi menu dengan budget dan kategori. Gunakan untuk intent RECOMMEND_BUDGET ketika user minta rekomendasi makanan atau minuman dengan budget tertentu.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          kantinId: {
            type: "string",
            description: "ID kantin (wajib, dari konteks aplikasi)"
          },
          maxPrice: {
            type: "number",
            description: "Budget maksimal dalam Rupiah (wajib jika user sebut budget)"
          },
          kategori: {
            type: "array",
            items: { type: "string" },
            description: "Array kategori preferensi (contoh: ['pedas', 'makanan'], atau ['minuman', 'dingin'])"
          },
          tersedia: {
            type: "boolean",
            description: "Filter hanya menu tersedia (default: true)"
          },
          limit: {
            type: "integer",
            description: "Jumlah rekomendasi (default: 5)"
          }
        },
        required: ["kantinId", "maxPrice"]
      }
    },
    {
      name: "recommendBundle",
      description: "Rekomendasi paket makanan + minuman dengan budget. Gunakan untuk intent BUNDLE_RECOMMEND ketika user minta '1 makanan 1 minuman' atau 'paket' dengan budget.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          kantinId: {
            type: "string",
            description: "ID kantin (wajib, dari konteks aplikasi)"
          },
          budget: {
            type: "number",
            description: "Budget total untuk paket makanan+minuman dalam Rupiah"
          },
          kategori: {
            type: "array",
            items: { type: "string" },
            description: "Array kategori preferensi (opsional, contoh: ['pedas', 'dingin'])"
          },
          tersedia: {
            type: "boolean",
            description: "Filter hanya menu tersedia (default: true)"
          },
          limit: {
            type: "integer",
            description: "Jumlah paket rekomendasi (default: 3)"
          }
        },
        required: ["kantinId", "budget"]
      }
    },
    {
      name: "getKantinInfo",
      description: "Ambil informasi detail kantin: nama, jam buka, jam tutup, status buka/tutup. Gunakan untuk intent ASK_CANTEEN_INFO ketika user bertanya tentang jam buka/tutup atau status kantin.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          kantinId: {
            type: "string",
            description: "ID kantin (wajib, dari konteks aplikasi)"
          }
        },
        required: ["kantinId"]
      }
    },
    {
      name: "getMenusByBudget",
      description: "Ambil menu dengan budget tertentu dari kantin spesifik. PENTING: Untuk rekomendasi '1 makanan + 1 minuman', ambil banyak menu (limit: 20) lalu PILIH MANUAL 1 makanan (bukan snack/minuman) + 1 minuman dengan total ≤ budget.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          maxBudget: { 
            type: "number",
            description: "Budget maksimal dalam Rupiah"
          },
          limit: { 
            type: "integer",
            description: "Jumlah menu (set 20 untuk rekomendasi kombinasi, 5-10 untuk list biasa)"
          }
        },
        required: ["maxBudget"]
      }
    },
    {
      name: "searchMenus",
      description: "Cari menu berdasarkan kata kunci tertentu. Gunakan ketika user menyebutkan nama makanan, bahan, atau kata kunci spesifik seperti 'ayam', 'nasi', 'pedas', dll.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          keywords: { 
            type: "array",
            items: { type: "string" },
            description: "Array kata kunci untuk pencarian (contoh: ['ayam', 'goreng'])"
          },
          limit: { 
            type: "integer",
            description: "Jumlah maksimal menu yang dikembalikan (opsional)"
          }
        },
        required: ["keywords"]
      }
    },
    {
      name: "getMenusByCategory",
      description: "Ambil menu berdasarkan kategori SPESIFIK. PENTING: Gunakan kategori yang TEPAT sesuai permintaan user. Kategori MAKANAN: 'sarapan', 'makan siang', 'makan malam'. Kategori MINUMAN: 'minuman'. Kategori SNACK: 'snack'.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          category: { 
            type: "string",
            description: "Kategori SPESIFIK: 'sarapan', 'makan siang', 'makan malam' untuk makanan | 'minuman' untuk minuman | 'snack' untuk jajanan"
          },
          limit: { 
            type: "integer",
            description: "Jumlah menu (default 5, maksimal 10)"
          }
        },
        required: ["category"]
      }
    },
    {
      name: "getCheapestMenus",
      description: "Ambil menu termurah yang tersedia. Gunakan ketika user ingin menu murah atau hemat. PENTING: Jika user tanya spesifik 'termurah' atau 'yang termurah', tampilkan HANYA 1 yang termurah dalam response (meskipun tool mengembalikan beberapa). Jika user tanya 'menu murah' (umum), tampilkan 3-5 menu termurah.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          limit: { 
            type: "integer",
            description: "Jumlah menu yang dikembalikan (default: 5, untuk pertanyaan spesifik 'termurah' gunakan limit: 1)"
          }
        },
        required: []
      }
    },
    {
      name: "getBestValueMenus",
      description: "Ambil menu dengan value terbaik (rasio popularitas vs harga). Cocok untuk rekomendasi menu worth it atau best deal.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          limit: { 
            type: "integer",
            description: "Jumlah menu yang dikembalikan (default: 5)"
          }
        },
        required: []
      }
    },
    {
      name: "getPopularMenus",
      description: "Ambil menu paling populer berdasarkan total penjualan dan recency. Gunakan untuk rekomendasi menu favorit atau best seller.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          limit: { 
            type: "integer",
            description: "Jumlah menu yang dikembalikan (default: 5)"
          }
        },
        required: []
      }
    },
    {
      name: "getNewMenus",
      description: "Ambil menu baru dalam X hari terakhir. Gunakan ketika user ingin tahu menu terbaru.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          daysAgo: { 
            type: "integer",
            description: "Jumlah hari ke belakang untuk mencari menu baru (default: 30)"
          },
          limit: { 
            type: "integer",
            description: "Jumlah menu yang dikembalikan (default: 10)"
          }
        },
        required: []
      }
    },
    {
      name: "getMenuCombos",
      description: "JANGAN GUNAKAN tool ini! Untuk rekomendasi kombinasi menu, gunakan getMenusByBudget dengan limit banyak (20), lalu pilih manual 1 makanan + 1 minuman dari hasil tersebut.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          budget: { 
            type: "number",
            description: "Budget total untuk kombinasi menu dalam Rupiah"
          },
          limit: { 
            type: "integer",
            description: "Jumlah kombinasi yang dikembalikan (default: 10)"
          }
        },
        required: ["budget"]
      }
    },
    {
      name: "getKantinStats",
      description: "Ambil statistik kantin seperti jumlah menu, rata-rata harga, menu termurah, termahal, dll. Gunakan untuk memberikan overview kantin.",
      parametersJsonSchema: {
        type: "object",
        properties: {},
        required: []
      }
    },
    {
      name: "getAllMenus",
      description: "Ambil semua menu yang tersedia di kantin. Gunakan ketika user ingin melihat daftar lengkap menu atau tidak ada filter spesifik.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          limit: { 
            type: "integer",
            description: "Jumlah maksimal menu yang dikembalikan (opsional)"
          }
        },
        required: []
      }
    },
    {
      name: "getMenusByBudgetGlobal",
      description: "Ambil daftar menu dari SEMUA kantin yang harganya kurang dari atau sama dengan budget yang ditentukan. Gunakan tool ini ketika user tidak menyebutkan kantin tertentu dan ingin pilihan terbanyak.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          maxBudget: { 
            type: "number",
            description: "Budget maksimal dalam Rupiah"
          },
          limit: { 
            type: "integer",
            description: "Jumlah maksimal menu yang dikembalikan (opsional)"
          }
        },
        required: ["maxBudget"]
      }
    },
    {
      name: "searchMenusGlobal",
      description: "Cari menu dari SEMUA kantin berdasarkan kata kunci tertentu. Gunakan ketika user tidak menyebutkan kantin tertentu dan ingin mencari menu spesifik.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          keywords: { 
            type: "array",
            items: { type: "string" },
            description: "Array kata kunci untuk pencarian (contoh: ['ayam', 'goreng'])"
          },
          limit: { 
            type: "integer",
            description: "Jumlah maksimal menu yang dikembalikan (opsional)"
          }
        },
        required: ["keywords"]
      }
    },
    {
      name: "getMenusByCategoryGlobal",
      description: "Ambil menu dari SEMUA kantin berdasarkan kategori tertentu. Gunakan ketika user tidak menyebutkan kantin tertentu dan ingin melihat kategori spesifik.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          category: { 
            type: "string",
            description: "Kategori menu (contoh: 'minuman', 'makanan berat', 'snack', 'sarapan', 'makan siang')"
          },
          limit: { 
            type: "integer",
            description: "Jumlah maksimal menu yang dikembalikan (opsional)"
          }
        },
        required: ["category"]
      }
    },
    {
      name: "getCheapestMenusGlobal",
      description: "Ambil menu termurah dari SEMUA kantin. Gunakan ketika user ingin menu murah atau hemat dari berbagai pilihan kantin.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          limit: { 
            type: "integer",
            description: "Jumlah menu yang dikembalikan (default: 5)"
          }
        },
        required: []
      }
    },
    {
      name: "getPopularMenusGlobal",
      description: "Ambil menu paling populer dari SEMUA kantin. Gunakan untuk rekomendasi menu favorit terbaik dari semua kantin.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          limit: { 
            type: "integer",
            description: "Jumlah menu yang dikembalikan (default: 5)"
          }
        },
        required: []
      }
    },
    {
      name: "getBestValueMenusGlobal",
      description: "Ambil menu dengan value terbaik dari SEMUA kantin. Cocok untuk rekomendasi menu worth it atau best deal dari berbagai kantin.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          limit: { 
            type: "integer",
            description: "Jumlah menu yang dikembalikan (default: 5)"
          }
        },
        required: []
      }
    },
    {
      name: "getAllMenusGlobal",
      description: "Ambil semua menu yang tersedia dari SEMUA kantin. Gunakan ketika user ingin melihat semua pilihan yang ada tanpa filter kantin.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          limit: { 
            type: "integer",
            description: "Jumlah maksimal menu yang dikembalikan (opsional)"
          }
        },
        required: []
      }
    },
    {
      name: "getAllKantins",
      description: "Ambil semua kantin yang aktif beserta menu mereka. Gunakan ketika user ingin melihat semua pilihan kantin yang tersedia.",
      parametersJsonSchema: {
        type: "object",
        properties: {},
        required: []
      }
    },
    {
      name: "searchKantins",
      description: "Cari kantin berdasarkan nama atau keywords. Gunakan ketika user menyebutkan nama kantin atau ingin mencari kantin tertentu.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          keywords: { 
            type: "array",
            items: { type: "string" },
            description: "Array kata kunci untuk pencarian kantin (contoh: ['mas', 'budi'])"
          }
        },
        required: ["keywords"]
      }
    },
    {
      name: "getMakananByCategory",
      description: "Ambil HANYA MAKANAN UTAMA, BUKAN minuman/snack/jajanan. Gunakan WAJIB saat user minta 'makanan', 'rekomendasi makanan', 'menu makanan', 'makan siang', 'sarapan'. Tool ini otomatis filter keluar minuman dan snack.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          category: { 
            type: "string",
            description: "Kategori (opsional, bisa kosong)"
          },
          limit: { 
            type: "integer",
            description: "Jumlah menu yang dikembalikan (default 5, maksimal 10)"
          }
        },
        required: []
      }
    },
    {
      name: "getMinumanByCategory",
      description: "Ambil HANYA MINUMAN, BUKAN makanan atau snack. Gunakan saat user minta 'minuman' atau 'minum' atau 'jus'. Hasil HANYA menu kategori minuman. PENTING: Untuk pertanyaan 'minuman termurah', gunakan tool ini lalu pilih yang termurah dari hasilnya (tampilkan HANYA 1 yang termurah). Untuk pertanyaan umum 'minuman apa saja', tampilkan 3-5 minuman.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          limit: { 
            type: "integer",
            description: "Jumlah menu (default 5, untuk 'termurah' ambil lebih banyak lalu pilih 1 yang termurah)"
          }
        },
        required: []
      }
    },
    {
      name: "getHealthyMenus",
      description: "Cari menu sehat berdasarkan keywords kesehatan. Gunakan ketika user menyebutkan kondisi kesehatan seperti kolestrol, diabetes, diet, dll.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          keywords: { 
            type: "array",
            items: { type: "string" },
            description: "Array kata kunci kesehatan (contoh: ['rendah lemak', 'tanpa gula', 'sayur'])"
          },
          limit: { 
            type: "integer",
            description: "Jumlah maksimal menu yang dikembalikan (opsional)"
          }
        },
        required: ["keywords"]
      }
    },
    {
      name: "getBestMealCombo",
      description: "Ambil kombinasi 1 makanan + 1 minuman terbaik dalam budget. WAJIB gunakan untuk permintaan seperti 'rekomendasikan 1 makanan 1 minuman budget 20000'. Fungsi ini otomatis menghitung total dan mencari kombinasi optimal.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          budget: { 
            type: "number",
            description: "Budget total dalam Rupiah"
          },
          timeOfDay: { 
            type: "string",
            description: "Waktu makan: 'pagi', 'siang', atau 'malam' (opsional, akan dideteksi otomatis)"
          },
          limit: { 
            type: "integer",
            description: "Jumlah kombinasi yang dikembalikan (default: 3)"
          }
        },
        required: ["budget"]
      }
    },
    {
      name: "getRecommendationsByTime",
      description: "Ambil rekomendasi menu berdasarkan waktu makan (pagi/siang/malam). Gunakan ketika user menyebutkan 'sarapan', 'makan siang', 'makan malam', atau waktu tertentu.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          timeOfDay: { 
            type: "string",
            description: "Waktu makan: 'pagi' untuk sarapan, 'siang' untuk makan siang, 'malam' untuk makan malam"
          },
          limit: { 
            type: "integer",
            description: "Jumlah menu yang dikembalikan (default: 5)"
          }
        },
        required: ["timeOfDay"]
      }
    },
    {
      name: "getFallbackMenus",
      description: "Fallback function - ambil menu terpopuler jika pencarian lain gagal. Gunakan sebagai pilihan terakhir untuk memberikan rekomendasi.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          limit: { 
            type: "integer",
            description: "Jumlah menu yang dikembalikan (default: 8)"
          }
        },
        required: []
      }
    },
    {
      name: "getMenusUnder10k",
      description: "Ambil menu dengan harga di bawah 10000. Gunakan ketika user minta menu murah, hemat, atau budget < 10000.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          limit: { 
            type: "integer",
            description: "Jumlah menu yang dikembalikan (default: 15)"
          }
        },
        required: []
      }
    }
  ]
}
