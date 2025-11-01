/**
 * Gemini Function Calling Tools
 * Deklarasi tools untuk Gemini AI agar bisa memanggil fungsi database
 */

import { SchemaType } from '@google/generative-ai';

export const tools = {
  functionDeclarations: [
    {
      name: "getMenusByBudget",
      description: "Ambil menu dengan budget tertentu dari kantin spesifik. PENTING: Untuk rekomendasi '1 makanan + 1 minuman', ambil banyak menu (limit: 20) lalu PILIH MANUAL 1 makanan (bukan snack/minuman) + 1 minuman dengan total ≤ budget.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          maxBudget: { 
            type: SchemaType.NUMBER,
            description: "Budget maksimal dalam Rupiah"
          },
          limit: { 
            type: SchemaType.INTEGER,
            description: "Jumlah menu (set 20 untuk rekomendasi kombinasi, 5-10 untuk list biasa)"
          }
        },
        required: ["maxBudget"]
      }
    },
    {
      name: "searchMenus",
      description: "Cari menu berdasarkan kata kunci tertentu. Gunakan ketika user menyebutkan nama makanan, bahan, atau kata kunci spesifik seperti 'ayam', 'nasi', 'pedas', dll.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          keywords: { 
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
            description: "Array kata kunci untuk pencarian (contoh: ['ayam', 'goreng'])"
          },
          limit: { 
            type: SchemaType.INTEGER,
            description: "Jumlah maksimal menu yang dikembalikan (opsional)"
          }
        },
        required: ["keywords"]
      }
    },
    {
      name: "getMenusByCategory",
      description: "Ambil menu berdasarkan kategori SPESIFIK. PENTING: Gunakan kategori yang TEPAT sesuai permintaan user. Kategori MAKANAN: 'sarapan', 'makan siang', 'makan malam'. Kategori MINUMAN: 'minuman'. Kategori SNACK: 'snack'.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          category: { 
            type: SchemaType.STRING,
            description: "Kategori SPESIFIK: 'sarapan', 'makan siang', 'makan malam' untuk makanan | 'minuman' untuk minuman | 'snack' untuk jajanan"
          },
          limit: { 
            type: SchemaType.INTEGER,
            description: "Jumlah menu (default 5, maksimal 10)"
          }
        },
        required: ["category"]
      }
    },
    {
      name: "getCheapestMenus",
      description: "Ambil menu termurah yang tersedia. Gunakan ketika user ingin menu murah atau hemat.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          limit: { 
            type: SchemaType.INTEGER,
            description: "Jumlah menu yang dikembalikan (default: 5)"
          }
        },
        required: []
      }
    },
    {
      name: "getBestValueMenus",
      description: "Ambil menu dengan value terbaik (rasio popularitas vs harga). Cocok untuk rekomendasi menu worth it atau best deal.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          limit: { 
            type: SchemaType.INTEGER,
            description: "Jumlah menu yang dikembalikan (default: 5)"
          }
        },
        required: []
      }
    },
    {
      name: "getPopularMenus",
      description: "Ambil menu paling populer berdasarkan total penjualan dan recency. Gunakan untuk rekomendasi menu favorit atau best seller.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          limit: { 
            type: SchemaType.INTEGER,
            description: "Jumlah menu yang dikembalikan (default: 5)"
          }
        },
        required: []
      }
    },
    {
      name: "getNewMenus",
      description: "Ambil menu baru dalam X hari terakhir. Gunakan ketika user ingin tahu menu terbaru.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          daysAgo: { 
            type: SchemaType.INTEGER,
            description: "Jumlah hari ke belakang untuk mencari menu baru (default: 30)"
          },
          limit: { 
            type: SchemaType.INTEGER,
            description: "Jumlah menu yang dikembalikan (default: 10)"
          }
        },
        required: []
      }
    },
    {
      name: "getMenuCombos",
      description: "JANGAN GUNAKAN tool ini! Untuk rekomendasi kombinasi menu, gunakan getMenusByBudget dengan limit banyak (20), lalu pilih manual 1 makanan + 1 minuman dari hasil tersebut.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          budget: { 
            type: SchemaType.NUMBER,
            description: "Budget total untuk kombinasi menu dalam Rupiah"
          },
          limit: { 
            type: SchemaType.INTEGER,
            description: "Jumlah kombinasi yang dikembalikan (default: 10)"
          }
        },
        required: ["budget"]
      }
    },
    {
      name: "getKantinStats",
      description: "Ambil statistik kantin seperti jumlah menu, rata-rata harga, menu termurah, termahal, dll. Gunakan untuk memberikan overview kantin.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {},
        required: []
      }
    },
    {
      name: "getAllMenus",
      description: "Ambil semua menu yang tersedia di kantin. Gunakan ketika user ingin melihat daftar lengkap menu atau tidak ada filter spesifik.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          limit: { 
            type: SchemaType.INTEGER,
            description: "Jumlah maksimal menu yang dikembalikan (opsional)"
          }
        },
        required: []
      }
    },
    {
      name: "getMenusByBudgetGlobal",
      description: "Ambil daftar menu dari SEMUA kantin yang harganya kurang dari atau sama dengan budget yang ditentukan. Gunakan tool ini ketika user tidak menyebutkan kantin tertentu dan ingin pilihan terbanyak.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          maxBudget: { 
            type: SchemaType.NUMBER,
            description: "Budget maksimal dalam Rupiah"
          },
          limit: { 
            type: SchemaType.INTEGER,
            description: "Jumlah maksimal menu yang dikembalikan (opsional)"
          }
        },
        required: ["maxBudget"]
      }
    },
    {
      name: "searchMenusGlobal",
      description: "Cari menu dari SEMUA kantin berdasarkan kata kunci tertentu. Gunakan ketika user tidak menyebutkan kantin tertentu dan ingin mencari menu spesifik.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          keywords: { 
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
            description: "Array kata kunci untuk pencarian (contoh: ['ayam', 'goreng'])"
          },
          limit: { 
            type: SchemaType.INTEGER,
            description: "Jumlah maksimal menu yang dikembalikan (opsional)"
          }
        },
        required: ["keywords"]
      }
    },
    {
      name: "getMenusByCategoryGlobal",
      description: "Ambil menu dari SEMUA kantin berdasarkan kategori tertentu. Gunakan ketika user tidak menyebutkan kantin tertentu dan ingin melihat kategori spesifik.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          category: { 
            type: SchemaType.STRING,
            description: "Kategori menu (contoh: 'minuman', 'makanan berat', 'snack', 'sarapan', 'makan siang')"
          },
          limit: { 
            type: SchemaType.INTEGER,
            description: "Jumlah maksimal menu yang dikembalikan (opsional)"
          }
        },
        required: ["category"]
      }
    },
    {
      name: "getCheapestMenusGlobal",
      description: "Ambil menu termurah dari SEMUA kantin. Gunakan ketika user ingin menu murah atau hemat dari berbagai pilihan kantin.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          limit: { 
            type: SchemaType.INTEGER,
            description: "Jumlah menu yang dikembalikan (default: 5)"
          }
        },
        required: []
      }
    },
    {
      name: "getPopularMenusGlobal",
      description: "Ambil menu paling populer dari SEMUA kantin. Gunakan untuk rekomendasi menu favorit terbaik dari semua kantin.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          limit: { 
            type: SchemaType.INTEGER,
            description: "Jumlah menu yang dikembalikan (default: 5)"
          }
        },
        required: []
      }
    },
    {
      name: "getBestValueMenusGlobal",
      description: "Ambil menu dengan value terbaik dari SEMUA kantin. Cocok untuk rekomendasi menu worth it atau best deal dari berbagai kantin.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          limit: { 
            type: SchemaType.INTEGER,
            description: "Jumlah menu yang dikembalikan (default: 5)"
          }
        },
        required: []
      }
    },
    {
      name: "getAllMenusGlobal",
      description: "Ambil semua menu yang tersedia dari SEMUA kantin. Gunakan ketika user ingin melihat semua pilihan yang ada tanpa filter kantin.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          limit: { 
            type: SchemaType.INTEGER,
            description: "Jumlah maksimal menu yang dikembalikan (opsional)"
          }
        },
        required: []
      }
    },
    {
      name: "getKantinInfo",
      description: "Ambil informasi detail tentang kantin tertentu termasuk semua menu yang tersedia. Gunakan ketika user bertanya tentang kantin spesifik.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          kantinId: { 
            type: SchemaType.STRING,
            description: "ID kantin yang ingin ditampilkan informasinya"
          }
        },
        required: ["kantinId"]
      }
    },
    {
      name: "getAllKantins",
      description: "Ambil semua kantin yang aktif beserta menu mereka. Gunakan ketika user ingin melihat semua pilihan kantin yang tersedia.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {},
        required: []
      }
    },
    {
      name: "searchKantins",
      description: "Cari kantin berdasarkan nama atau keywords. Gunakan ketika user menyebutkan nama kantin atau ingin mencari kantin tertentu.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          keywords: { 
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
            description: "Array kata kunci untuk pencarian kantin (contoh: ['mas', 'budi'])"
          }
        },
        required: ["keywords"]
      }
    },
    {
      name: "getMakananByCategory",
      description: "Ambil HANYA MAKANAN UTAMA, BUKAN minuman/snack/jajanan. Gunakan WAJIB saat user minta 'makanan', 'rekomendasi makanan', 'menu makanan', 'makan siang', 'sarapan'. Tool ini otomatis filter keluar minuman dan snack.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          category: { 
            type: SchemaType.STRING,
            description: "Kategori (opsional, bisa kosong)"
          },
          limit: { 
            type: SchemaType.INTEGER,
            description: "Jumlah menu yang dikembalikan (default 5, maksimal 10)"
          }
        },
        required: []
      }
    },
    {
      name: "getMinumanByCategory",
      description: "Ambil HANYA MINUMAN, BUKAN makanan atau snack. Gunakan saat user minta 'minuman' atau 'minum' atau 'jus'. Hasil HANYA menu kategori minuman.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          limit: { 
            type: SchemaType.INTEGER,
            description: "Jumlah menu (default 5)"
          }
        },
        required: []
      }
    },
    {
      name: "getHealthyMenus",
      description: "Cari menu sehat berdasarkan keywords kesehatan. Gunakan ketika user menyebutkan kondisi kesehatan seperti kolestrol, diabetes, diet, dll.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          keywords: { 
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
            description: "Array kata kunci kesehatan (contoh: ['rendah lemak', 'tanpa gula', 'sayur'])"
          },
          limit: { 
            type: SchemaType.INTEGER,
            description: "Jumlah maksimal menu yang dikembalikan (opsional)"
          }
        },
        required: ["keywords"]
      }
    },
    {
      name: "getBestMealCombo",
      description: "Ambil kombinasi 1 makanan + 1 minuman terbaik dalam budget. WAJIB gunakan untuk permintaan seperti 'rekomendasikan 1 makanan 1 minuman budget 20000'. Fungsi ini otomatis menghitung total dan mencari kombinasi optimal.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          budget: { 
            type: SchemaType.NUMBER,
            description: "Budget total dalam Rupiah"
          },
          timeOfDay: { 
            type: SchemaType.STRING,
            description: "Waktu makan: 'pagi', 'siang', atau 'malam' (opsional, akan dideteksi otomatis)"
          },
          limit: { 
            type: SchemaType.INTEGER,
            description: "Jumlah kombinasi yang dikembalikan (default: 3)"
          }
        },
        required: ["budget"]
      }
    },
    {
      name: "getRecommendationsByTime",
      description: "Ambil rekomendasi menu berdasarkan waktu makan (pagi/siang/malam). Gunakan ketika user menyebutkan 'sarapan', 'makan siang', 'makan malam', atau waktu tertentu.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          timeOfDay: { 
            type: SchemaType.STRING,
            description: "Waktu makan: 'pagi' untuk sarapan, 'siang' untuk makan siang, 'malam' untuk makan malam"
          },
          limit: { 
            type: SchemaType.INTEGER,
            description: "Jumlah menu yang dikembalikan (default: 5)"
          }
        },
        required: ["timeOfDay"]
      }
    },
    {
      name: "getFallbackMenus",
      description: "Fallback function - ambil menu terpopuler jika pencarian lain gagal. Gunakan sebagai pilihan terakhir untuk memberikan rekomendasi.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          limit: { 
            type: SchemaType.INTEGER,
            description: "Jumlah menu yang dikembalikan (default: 8)"
          }
        },
        required: []
      }
    },
    {
      name: "getMenusUnder10k",
      description: "Ambil menu dengan harga di bawah 10000. Gunakan ketika user minta menu murah, hemat, atau budget < 10000.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          limit: { 
            type: SchemaType.INTEGER,
            description: "Jumlah menu yang dikembalikan (default: 15)"
          }
        },
        required: []
      }
    }
  ]
}
