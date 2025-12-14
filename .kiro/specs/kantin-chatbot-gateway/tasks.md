# Implementation Plan

- [x] 1. Setup project structure and dependencies
  - [x] 1.1 Create chatbot module directory structure (`src/lib/chatbot/`)
    - Create folders: `src/lib/chatbot/`
    - _Requirements: 1.1_
  - [x] 1.2 Install fast-check for property-based testing
    - Run `npm install --save-dev fast-check`
    - _Requirements: Testing Strategy_
  - [x] 1.3 Update environment variables documentation
    - Ensure `.env.local` has GEMINI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (server-only)
    - _Requirements: 2.4_

- [x] 2. Implement Intent Extractor
  - [x] 2.1 Create intent extractor module (`src/lib/chatbot/intentExtractor.ts`)
    - Implement `extractIntent(message, kantinId)` function
    - Implement budget extraction (20k, 20rb, Rp X, raw number)
    - Implement kategori mapping (pedas→pedas, es→dingin, etc.)
    - Implement intent detection rules (ASK_MENU_INFO, SEARCH_MENU, RECOMMEND_BUDGET, BUNDLE_RECOMMEND, ASK_CANTEEN_INFO, OUT_OF_SCOPE)
    - _Requirements: 1.1, 3.1, 3.2_
  - [x] 2.2 Write property test for intent extraction
    - **Property 1: Intent and Parameter Extraction Consistency**
    - **Validates: Requirements 1.1, 3.1, 3.2**

- [x] 3. Implement Supabase Query Functions
  - [x] 3.1 Create queries module (`src/lib/chatbot/queries.ts`)
    - Implement `getKantinInfo(kantinId)` - get kantin jam buka/tutup
    - Implement `findMenuByName(kantinId, menuName, limit)` - search by name
    - Implement `searchMenu(kantinId, params)` - search with filters (keyword, max_price, kategori)
    - Implement `recommendMenu(kantinId, budget, kategori, limit)` - recommendations sorted by popularity
    - Implement `recommendBundle(kantinId, budget, preferensi)` - makanan+minuman combos
    - All functions use `supabaseAdmin` (server-only)
    - _Requirements: 1.3, 3.3, 3.4, 4.1, 4.2, 5.1_
  - [x] 3.2 Write property test for bundle budget constraint
    - **Property 4: Bundle Budget Constraint**
    - **Validates: Requirements 4.1, 4.2**
  - [x] 3.3 Write property test for recommendation sorting
    - **Property 5: Recommendation Sorting Order**
    - **Validates: Requirements 3.4**

- [x] 4. Implement Output Formatters
  - [x] 4.1 Create formatters module (`src/lib/chatbot/formatters.ts`)
    - Implement `formatMenuList(menus)` - "Nama — Rp X" format
    - Implement `formatMenuDetail(menu)` - nama, harga, deskripsi, tersedia
    - Implement `formatBundle(bundles)` - "Paket N: makanan + minuman = total"
    - Implement `formatKantinInfo(kantin)` - jam buka/tutup readable
    - _Requirements: 7.1, 7.2, 7.3, 5.2_
  - [x] 4.2 Write property test for output format consistency
    - **Property 8: Output Format Consistency**
    - **Validates: Requirements 7.1, 7.2, 7.3**

- [x] 5. Checkpoint - Make sure all tests pass
  - All 47 tests pass ✓

- [x] 6. Implement Gemini Summarizer
  - [x] 6.1 Create summarizer module (`src/lib/chatbot/summarizer.ts`)
    - Implement `summarizeWithGemini(input)` function
    - Create system prompt for canteen-only responses
    - Handle empty results with fallback suggestions
    - Clean markdown from Gemini output
    - _Requirements: 1.4, 1.5, 2.1, 2.3_
  - [x] 6.2 Write property test for empty result fallback
    - **Property 3: Empty Result Fallback**
    - **Validates: Requirements 1.5**

- [x] 7. Implement API Route Handler
  - [x] 7.1 Create chat API route (`src/app/api/chat/route.ts`)
    - Implement POST handler
    - Validate request payload (kantin_id as UUID, message as non-empty string)
    - Integrate intent extractor, queries, summarizer
    - Return OUT_OF_SCOPE template for invalid intents
    - Add logging (intent, params, result count)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 6.1, 6.4_
  - [x] 7.2 Write property test for input validation
    - **Property 6: Input Validation Rejection**
    - **Validates: Requirements 6.4**
  - [x] 7.3 Write property test for out-of-scope rejection
    - **Property 2: Out-of-Scope Rejection Consistency**
    - **Validates: Requirements 1.2, 2.2**
  - [x] 7.4 Write property test for error response safety
    - **Property 7: Error Response Safety**
    - **Validates: Requirements 6.2**

- [x] 8. Update Frontend Chat Component
  - [x] 8.1 Update AIAssistant component to use new `/api/chat` endpoint
    - Replace existing API calls with new `/api/chat` endpoint
    - Handle new response format `{ reply, debug? }`
    - Remove MCP-related fallback logic
    - _Requirements: 1.1_

- [ ] 9. Cleanup and Migration
  - [ ] 9.1 Remove old MCP-related files (optional)
    - Mark `src/lib/mcp.ts` as deprecated or remove
    - Mark `src/lib/mcpFunctions.ts` as deprecated or remove
    - Update `src/app/api/gemini/ask/route.ts` to redirect to new endpoint
    - _Requirements: Architecture simplification_

- [x] 10. Final Checkpoint - Make sure all tests pass
  - All 47 tests pass ✓
  - Build successful ✓

