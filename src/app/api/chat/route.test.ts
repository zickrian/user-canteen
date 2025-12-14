/**
 * Property-Based Tests untuk Chat API Route
 * **Feature: kantin-chatbot-gateway**
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

// Mock modules before importing route
vi.mock('@/lib/supabaseAdmin', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            ilike: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
              })),
            })),
            lte: vi.fn(() => ({
              order: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
                })),
              })),
            })),
            contains: vi.fn(() => ({
              lte: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
                })),
              })),
            })),
            order: vi.fn(() => ({
              limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
            })),
          })),
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
    })),
  },
}));

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn(() => ({
    models: {
      generateContent: vi.fn(() =>
        Promise.resolve({
          text: 'Mocked AI response',
        })
      ),
    },
  })),
}));

// UUID validation regex (same as in route.ts - supports all UUID versions)
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Helper to create mock request
function createMockRequest(body: any): Request {
  return new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// Generators
const validUuidArb = fc.uuid();
const invalidUuidArb = fc.string({ minLength: 1, maxLength: 50 }).filter((s) => !UUID_REGEX.test(s));
const nonEmptyStringArb = fc.string({ minLength: 1, maxLength: 200 }).filter((s) => s.trim().length > 0);
const emptyStringArb = fc.constantFrom('', '   ', '\t', '\n');

describe('Chat API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * **Feature: kantin-chatbot-gateway, Property 6: Input Validation Rejection**
   * For any request with invalid payload (non-UUID kantin_id, empty message, missing required fields),
   * the system SHALL return a 400 error with appropriate message without processing the request.
   * **Validates: Requirements 6.4**
   */
  describe('Property 6: Input Validation Rejection', () => {
    it('should reject requests with invalid kantin_id (non-UUID)', async () => {
      const { POST } = await import('./route');

      await fc.assert(
        fc.asyncProperty(invalidUuidArb, nonEmptyStringArb, async (invalidId, message) => {
          const req = createMockRequest({ kantin_id: invalidId, message });
          const response = await POST(req as any);
          const data = await response.json();

          expect(response.status).toBe(400);
          expect(data.error).toBeDefined();
          expect(data.code).toBe('INVALID_KANTIN_ID');
        }),
        { numRuns: 100 }
      );
    });

    it('should reject requests with empty message', async () => {
      const { POST } = await import('./route');

      await fc.assert(
        fc.asyncProperty(validUuidArb, emptyStringArb, async (kantinId, emptyMessage) => {
          const req = createMockRequest({ kantin_id: kantinId, message: emptyMessage });
          const response = await POST(req as any);
          const data = await response.json();

          expect(response.status).toBe(400);
          expect(data.error).toBeDefined();
        }),
        { numRuns: 100 }
      );
    });

    it('should reject requests with missing kantin_id', async () => {
      const { POST } = await import('./route');

      await fc.assert(
        fc.asyncProperty(nonEmptyStringArb, async (message) => {
          const req = createMockRequest({ message });
          const response = await POST(req as any);
          const data = await response.json();

          expect(response.status).toBe(400);
          expect(data.error).toBeDefined();
          expect(data.code).toBe('MISSING_KANTIN_ID');
        }),
        { numRuns: 100 }
      );
    });

    it('should reject requests with missing message', async () => {
      const { POST } = await import('./route');

      // Use a fixed valid UUID to avoid UUID validation issues
      const validKantinId = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
      const req = createMockRequest({ kantin_id: validKantinId });
      const response = await POST(req as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
      expect(data.code).toBe('MISSING_MESSAGE');
    });
  });

  /**
   * **Feature: kantin-chatbot-gateway, Property 2: Out-of-Scope Rejection Consistency**
   * For any user message that does not match any valid intent pattern, the system SHALL return
   * the exact rejection template.
   * **Validates: Requirements 1.2, 2.2**
   */
  describe('Property 2: Out-of-Scope Rejection Consistency', () => {
    const OUT_OF_SCOPE_TEMPLATE =
      'Aku khusus bantu soal menu kantin (makanan/minuman, harga, rekomendasi, jam buka). Mau cari menu apa atau budget berapa?';

    // Messages that should be out of scope (avoid words that trigger valid intents)
    const outOfScopeMessages = [
      'apa kabar',
      'siapa presiden indonesia',
      'cuaca hari ini',
      'ceritakan tentang dirimu',
      'hello world',
      'test',
      'hai',
    ];

    it('should return exact rejection template for out-of-scope messages', async () => {
      const { POST } = await import('./route');

      // Use a valid UUID format
      const validKantinId = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

      for (const message of outOfScopeMessages) {
        const req = createMockRequest({
          kantin_id: validKantinId,
          message,
        });
        const response = await POST(req as any);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.reply).toBe(OUT_OF_SCOPE_TEMPLATE);
        expect(data.debug?.intent).toBe('OUT_OF_SCOPE');
      }
    });
  });

  /**
   * **Feature: kantin-chatbot-gateway, Property 7: Error Response Safety**
   * For any error that occurs during processing, the error response SHALL NOT contain
   * sensitive information (API keys, database credentials, internal paths).
   * **Validates: Requirements 6.2**
   */
  describe('Property 7: Error Response Safety', () => {
    const sensitivePatterns = [
      /api[_-]?key/i,
      /secret/i,
      /password/i,
      /credential/i,
      /supabase/i,
      /gemini/i,
      /service[_-]?role/i,
      /anon[_-]?key/i,
      /process\.env/i,
      /node_modules/i,
      /\.ts$/i,
      /at\s+\w+\s+\(/i, // Stack trace pattern
    ];

    it('should not expose sensitive information in error responses', async () => {
      const { POST } = await import('./route');

      // Test with invalid JSON
      const invalidReq = new Request('http://localhost/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json',
      });

      const response = await POST(invalidReq as any);
      const data = await response.json();

      expect(response.status).toBe(400);

      // Check that error message doesn't contain sensitive info
      const errorStr = JSON.stringify(data);
      for (const pattern of sensitivePatterns) {
        expect(errorStr).not.toMatch(pattern);
      }
    });

    it('should return safe error message for any error', async () => {
      const { POST } = await import('./route');

      await fc.assert(
        fc.asyncProperty(validUuidArb, nonEmptyStringArb, async (kantinId, message) => {
          const req = createMockRequest({ kantin_id: kantinId, message });
          const response = await POST(req as any);
          const data = await response.json();

          // Check response doesn't contain sensitive patterns
          const responseStr = JSON.stringify(data);
          for (const pattern of sensitivePatterns) {
            expect(responseStr).not.toMatch(pattern);
          }
        }),
        { numRuns: 50 }
      );
    });
  });
});
