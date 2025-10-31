/**
 * Gemini Function Calling Tools
 * Deklarasi tools untuk Gemini AI agar bisa memanggil fungsi database
 */

import { SchemaType } from '@google/generative-ai';

export const tools = {
  functionDeclarations: [
    {
      name: "getMenusByBudget",
      description: "Ambil daftar menu yang harganya kurang dari atau sama dengan budget yang ditentukan. Gunakan tool ini ketika user menyebutkan budget atau jumlah uang tertentu.",
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
      description: "Ambil menu berdasarkan kategori tertentu seperti 'minuman', 'makanan berat', 'snack', 'sarapan', 'makan siang', dll.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          category: { 
            type: SchemaType.STRING,
            description: "Kategori menu (contoh: 'minuman', 'makanan berat', 'snack')"
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
      description: "Ambil kombinasi menu (paket lengkap) yang pas dengan budget tertentu. Cocok untuk saran paket makan lengkap.",
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
    }
  ]
}
