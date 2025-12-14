# Requirements Document

## Introduction

Sistem chatbot kantin berbasis Next.js dengan arsitektur Gateway Read-Only. Chatbot memproses pesan user di backend, mengekstrak intent dan parameter, melakukan query ke Supabase (read-only), lalu mengirim hasil ke Gemini AI untuk dirangkum menjadi jawaban natural. Bot hanya menjawab topik seputar kantin (menu, harga, rekomendasi, jam buka).

## Glossary

- **Chatbot**: Asisten AI yang menjawab pertanyaan user tentang menu kantin
- **Intent**: Maksud/tujuan dari pesan user (ASK_MENU_INFO, SEARCH_MENU, dll)
- **Gateway Read-Only**: Arsitektur dimana backend Next.js menjadi gateway untuk query database read-only
- **Supabase**: Database PostgreSQL yang menyimpan data kantin dan menu
- **Gemini**: Google AI model untuk merangkum data menjadi jawaban natural
- **Budget**: Batas harga maksimal yang diinginkan user
- **Bundle**: Paket kombinasi makanan + minuman dalam budget tertentu
- **Kategori Menu**: Label pada menu seperti "makanan", "minuman", "pedas", "manis"

## Requirements

### Requirement 1

**User Story:** As a user, I want to chat with the canteen bot, so that I can get information about menu, prices, and recommendations.

#### Acceptance Criteria

1. WHEN a user sends a message to /api/chat THEN the system SHALL extract intent and parameters from the message
2. WHEN the extracted intent is OUT_OF_SCOPE THEN the system SHALL return a polite rejection template
3. WHEN the extracted intent is valid (ASK_MENU_INFO, SEARCH_MENU, RECOMMEND_BUDGET, BUNDLE_RECOMMEND, ASK_CANTEEN_INFO) THEN the system SHALL query Supabase and return relevant data
4. WHEN query results are available THEN the system SHALL send results to Gemini for natural language summarization
5. WHEN query results are empty THEN the system SHALL provide fallback suggestions (popular menus, alternative keywords, or budget adjustment)

### Requirement 2

**User Story:** As a system administrator, I want the chatbot to only answer canteen-related topics, so that the bot stays focused and secure.

#### Acceptance Criteria

1. THE system SHALL only respond to topics: menu/harga/deskripsi/kategori/ketersediaan/jam buka
2. WHEN a user asks about non-canteen topics THEN the system SHALL return: "Aku khusus bantu soal menu kantin (makanan/minuman, harga, rekomendasi, jam buka). Mau cari menu apa atau budget berapa?"
3. THE system SHALL never fabricate menu data or prices not from database
4. THE system SHALL use server-only environment variables (no NEXT_PUBLIC_ for secrets)

### Requirement 3

**User Story:** As a user, I want to search menus by various criteria, so that I can find what I want easily.

#### Acceptance Criteria

1. WHEN a user mentions budget (e.g., "20k", "20rb", "Rp 20.000", "20000") THEN the system SHALL extract budget as integer (20000)
2. WHEN a user mentions category keywords (pedas/pedes, es/dingin, kopi, teh, makanan, minuman) THEN the system SHALL map to standard categories
3. WHEN a user searches with keyword THEN the system SHALL search in nama_menu and deskripsi fields
4. WHEN a user asks for recommendations THEN the system SHALL sort by total_sold desc, then harga desc

### Requirement 4

**User Story:** As a user, I want to get bundle recommendations (food + drink combo), so that I can order a complete meal within my budget.

#### Acceptance Criteria

1. WHEN a user asks for bundle/paket/combo with budget THEN the system SHALL find makanan + minuman combinations within budget
2. WHEN generating bundles THEN the system SHALL return top 3 combinations sorted by popularity and budget optimization
3. WHEN no valid bundle combinations exist THEN the system SHALL suggest increasing budget or show individual items

### Requirement 5

**User Story:** As a user, I want to ask about canteen operating hours, so that I know when the canteen is open.

#### Acceptance Criteria

1. WHEN a user asks about "jam buka/jam tutup/buka nggak" THEN the system SHALL query kantin table for jam_buka, jam_tutup, buka_tutup
2. WHEN kantin data is available THEN the system SHALL format operating hours in human-readable format

### Requirement 6

**User Story:** As a developer, I want the API to have proper error handling and logging, so that issues can be debugged easily.

#### Acceptance Criteria

1. THE system SHALL log intent, parameters, and query result count (not full data) for debugging
2. WHEN an error occurs THEN the system SHALL return appropriate error message without exposing secrets
3. THE system SHALL implement basic rate limiting on /api/chat endpoint
4. THE system SHALL validate request payload (kantin_id as UUID, message as non-empty string)

### Requirement 7

**User Story:** As a user, I want to see menu information in a consistent format, so that I can easily compare options.

#### Acceptance Criteria

1. WHEN displaying menu list THEN the system SHALL format as: "Nama — Rp X"
2. WHEN displaying menu detail THEN the system SHALL show: nama, harga, deskripsi, status tersedia
3. WHEN displaying bundle THEN the system SHALL format as: "Paket N: makanan + minuman = total"
