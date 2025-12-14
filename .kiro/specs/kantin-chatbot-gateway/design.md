# Design Document: Kantin Chatbot Gateway

## Overview

Implementasi chatbot kantin menggunakan arsitektur Gateway Read-Only. Backend Next.js (`/api/chat`) menerima pesan user, mengekstrak intent dan parameter, melakukan query ke Supabase (read-only), lalu mengirim hasil ke Gemini AI untuk dirangkum menjadi jawaban natural.

Arsitektur ini menghilangkan ketergantungan pada MCP (Model Context Protocol) yang sering gagal, dan menggunakan direct Supabase queries yang lebih reliable.

## Architecture

```
┌─────────────┐     POST /api/chat      ┌──────────────────┐
│   Frontend  │ ──────────────────────► │  Next.js API     │
│  (Chat UI)  │                         │  Route Handler   │
└─────────────┘                         └────────┬─────────┘
                                                 │
                                    ┌────────────┼────────────┐
                                    │            │            │
                                    ▼            ▼            ▼
                              ┌──────────┐ ┌──────────┐ ┌──────────┐
                              │  Intent  │ │ Supabase │ │  Gemini  │
                              │ Extractor│ │  Query   │ │   AI     │
                              └──────────┘ └──────────┘ └──────────┘
```

### Flow:
1. Frontend kirim `{ kantin_id, message }` ke `/api/chat`
2. Backend extract intent + parameters dari message
3. Jika OUT_OF_SCOPE → return template penolakan
4. Jika valid intent → query Supabase sesuai intent
5. Kirim hasil query ke Gemini untuk dirangkum
6. Return `{ reply, debug? }` ke frontend

## Components and Interfaces

### 1. API Route Handler (`/api/chat/route.ts`)

```typescript
interface ChatRequest {
  kantin_id: string;  // UUID kantin
  message: string;    // Pesan user
}

interface ChatResponse {
  reply: string;      // Jawaban chatbot
  debug?: {           // Optional debug info (non-production)
    intent: string;
    budget: number | null;
    kategori: string[];
  };
}
```

### 2. Intent Extractor (`lib/chatbot/intentExtractor.ts`)

```typescript
type IntentType = 
  | 'ASK_MENU_INFO'      // Tanya harga/info menu spesifik
  | 'SEARCH_MENU'        // Cari menu dengan keyword
  | 'RECOMMEND_BUDGET'   // Rekomendasi dengan budget
  | 'BUNDLE_RECOMMEND'   // Paket makanan+minuman
  | 'ASK_CANTEEN_INFO'   // Jam buka/tutup
  | 'OUT_OF_SCOPE';      // Di luar topik

interface ExtractedIntent {
  intent: IntentType;
  kantin_id: string;
  menu_name: string | null;
  budget: number | null;
  kategori: string[];
  limit: number;
}

function extractIntent(message: string, kantinId: string): ExtractedIntent;
```

### 3. Supabase Query Functions (`lib/chatbot/queries.ts`)

```typescript
// Semua fungsi menggunakan supabaseAdmin (server-only, bypass RLS)

function getKantinInfo(kantinId: string): Promise<KantinInfo>;
function findMenuByName(kantinId: string, menuName: string, limit?: number): Promise<Menu[]>;
function searchMenu(kantinId: string, params: SearchParams): Promise<Menu[]>;
function recommendMenu(kantinId: string, budget: number, kategori?: string[], limit?: number): Promise<Menu[]>;
function recommendBundle(kantinId: string, budget: number, preferensi?: string[]): Promise<Bundle[]>;
```

### 4. Gemini Summarizer (`lib/chatbot/summarizer.ts`)

```typescript
interface SummarizerInput {
  userMessage: string;
  intent: IntentType;
  queryResult: any;
  kantinInfo?: KantinInfo;
}

function summarizeWithGemini(input: SummarizerInput): Promise<string>;
```

## Data Models

### Menu
```typescript
interface Menu {
  id: string;
  kantin_id: string;
  nama_menu: string;
  harga: number;
  deskripsi: string | null;
  tersedia: boolean;
  kategori_menu: string[];  // ["makanan", "pedas"] atau ["minuman", "dingin"]
  total_sold: number;
  foto_menu: string | null;
}
```

### Kantin
```typescript
interface KantinInfo {
  id: string;
  nama_kantin: string;
  jam_buka: string | null;
  jam_tutup: string | null;
  buka_tutup: boolean;
  status: 'pending' | 'aktif' | 'ditolak';
}
```

### Bundle
```typescript
interface Bundle {
  makanan: Menu;
  minuman: Menu;
  total: number;
  sisa: number;  // budget - total
}
```

### Intent Extraction Rules

| Pattern | Intent |
|---------|--------|
| "jam buka/jam tutup/buka nggak" | ASK_CANTEEN_INFO |
| "harga/berapa" + nama menu | ASK_MENU_INFO |
| "makan+minum/paket/combo" + budget | BUNDLE_RECOMMEND |
| "rekomendasi/saran/enak apa" | RECOMMEND_BUDGET |
| "cari/yang ..." | SEARCH_MENU |
| Lainnya | OUT_OF_SCOPE |

### Budget Extraction Rules

| Input | Output |
|-------|--------|
| "20k" | 20000 |
| "20rb" | 20000 |
| "Rp 20.000" | 20000 |
| "20000" | 20000 |

### Kategori Mapping

| Input | Standard Category |
|-------|-------------------|
| pedes/pedas/cabe | pedas |
| es/dingin | dingin |
| kopi | kopi |
| teh | teh |
| makanan | makanan |
| minuman | minuman |



## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Intent and Parameter Extraction Consistency

*For any* user message containing known patterns (budget patterns like "20k/20rb/Rp X", category keywords like "pedas/dingin/kopi", intent keywords like "jam buka/rekomendasi/cari"), the extractIntent function SHALL correctly identify the intent type and extract all parameters with correct values.

**Validates: Requirements 1.1, 3.1, 3.2**

### Property 2: Out-of-Scope Rejection Consistency

*For any* user message that does not match any valid intent pattern, the system SHALL return the exact rejection template: "Aku khusus bantu soal menu kantin (makanan/minuman, harga, rekomendasi, jam buka). Mau cari menu apa atau budget berapa?"

**Validates: Requirements 1.2, 2.2**

### Property 3: Empty Result Fallback

*For any* valid intent query that returns empty results, the system SHALL provide fallback suggestions (popular menus, alternative keywords, or budget adjustment) instead of an empty response.

**Validates: Requirements 1.5**

### Property 4: Bundle Budget Constraint

*For any* bundle recommendation with a given budget, ALL returned bundles SHALL have total price (makanan.harga + minuman.harga) less than or equal to the budget.

**Validates: Requirements 4.1, 4.2**

### Property 5: Recommendation Sorting Order

*For any* menu recommendation query, the returned results SHALL be sorted by total_sold descending, then by harga descending.

**Validates: Requirements 3.4**

### Property 6: Input Validation Rejection

*For any* request with invalid payload (non-UUID kantin_id, empty message, missing required fields), the system SHALL return a 400 error with appropriate message without processing the request.

**Validates: Requirements 6.4**

### Property 7: Error Response Safety

*For any* error that occurs during processing, the error response SHALL NOT contain sensitive information (API keys, database credentials, internal paths).

**Validates: Requirements 6.2**

### Property 8: Output Format Consistency

*For any* menu data, the formatting functions SHALL produce output containing all required fields:
- Menu list: "Nama — Rp X" format
- Menu detail: nama, harga, deskripsi, status tersedia
- Bundle: "Paket N: makanan + minuman = total" format

**Validates: Requirements 7.1, 7.2, 7.3**

## Error Handling

### Error Categories

1. **Validation Errors (400)**
   - Invalid kantin_id format
   - Empty or missing message
   - Invalid JSON payload

2. **Not Found Errors (404)**
   - Kantin not found
   - No menus available

3. **Server Errors (500)**
   - Database connection failure
   - Gemini API failure
   - Unexpected errors

### Error Response Format

```typescript
interface ErrorResponse {
  error: string;      // User-friendly message
  code?: string;      // Error code for debugging
}
```

### Fallback Strategy

1. Jika Gemini gagal → return raw data dengan format sederhana
2. Jika database gagal → return error message dengan saran retry
3. Jika intent tidak jelas → return template penolakan dengan contoh pertanyaan

## Testing Strategy

### Property-Based Testing Library

Menggunakan **fast-check** untuk property-based testing di TypeScript/JavaScript.

```bash
npm install --save-dev fast-check
```

### Test Structure

```
src/
├── lib/
│   └── chatbot/
│       ├── intentExtractor.ts
│       ├── intentExtractor.test.ts      # Unit + Property tests
│       ├── queries.ts
│       ├── queries.test.ts              # Unit + Property tests
│       ├── summarizer.ts
│       ├── formatters.ts
│       └── formatters.test.ts           # Unit + Property tests
└── app/
    └── api/
        └── chat/
            ├── route.ts
            └── route.test.ts            # Integration tests
```

### Property-Based Test Requirements

1. Setiap property test HARUS menjalankan minimal 100 iterasi
2. Setiap property test HARUS di-tag dengan format: `**Feature: kantin-chatbot-gateway, Property {number}: {property_text}**`
3. Setiap correctness property HARUS diimplementasi oleh SATU property-based test

### Unit Test Coverage

Unit tests akan mencakup:
- Specific examples untuk setiap intent type
- Edge cases (empty input, special characters, very long messages)
- Integration points antara komponen

### Test Data Generators

```typescript
// Generator untuk budget patterns
const budgetPatternArb = fc.oneof(
  fc.integer({ min: 1000, max: 100000 }).map(n => `${n/1000}k`),
  fc.integer({ min: 1000, max: 100000 }).map(n => `${n/1000}rb`),
  fc.integer({ min: 1000, max: 100000 }).map(n => `Rp ${n.toLocaleString('id-ID')}`),
  fc.integer({ min: 1000, max: 100000 }).map(n => `${n}`)
);

// Generator untuk kategori keywords
const kategoriKeywordArb = fc.constantFrom(
  'pedas', 'pedes', 'cabe',
  'es', 'dingin',
  'kopi', 'teh',
  'makanan', 'minuman'
);

// Generator untuk menu data
const menuArb = fc.record({
  id: fc.uuid(),
  nama_menu: fc.string({ minLength: 1, maxLength: 50 }),
  harga: fc.integer({ min: 1000, max: 100000 }),
  deskripsi: fc.option(fc.string({ maxLength: 200 })),
  tersedia: fc.boolean(),
  kategori_menu: fc.array(fc.constantFrom('makanan', 'minuman', 'pedas', 'manis', 'dingin')),
  total_sold: fc.integer({ min: 0, max: 1000 })
});
```
