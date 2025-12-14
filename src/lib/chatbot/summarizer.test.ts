/**
 * Property-Based Tests untuk Summarizer
 * **Feature: kantin-chatbot-gateway**
 */

import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';
import { generateFallbackResponse, cleanMarkdown, OUT_OF_SCOPE_TEMPLATE } from './summarizer';
import { IntentType } from './intentExtractor';

// Mock GoogleGenAI
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

describe('Summarizer', () => {
  /**
   * **Feature: kantin-chatbot-gateway, Property 3: Empty Result Fallback**
   * For any valid intent query that returns empty results, the system SHALL provide
   * fallback suggestions (popular menus, alternative keywords, or budget adjustment)
   * instead of an empty response.
   * **Validates: Requirements 1.5**
   */
  describe('Property 3: Empty Result Fallback', () => {
    const validIntents: IntentType[] = [
      'ASK_MENU_INFO',
      'SEARCH_MENU',
      'RECOMMEND_BUDGET',
      'BUNDLE_RECOMMEND',
      'ASK_CANTEEN_INFO',
    ];

    it('should provide non-empty fallback for all valid intents', () => {
      for (const intent of validIntents) {
        const fallback = generateFallbackResponse(intent);

        // Fallback should never be empty
        expect(fallback).toBeTruthy();
        expect(fallback.length).toBeGreaterThan(0);

        // Fallback should not be generic error
        expect(fallback).not.toContain('error');
        expect(fallback).not.toContain('Error');
      }
    });

    it('should provide budget-related suggestion for RECOMMEND_BUDGET with budget', () => {
      fc.assert(
        fc.property(fc.integer({ min: 5000, max: 100000 }), (budget) => {
          const fallback = generateFallbackResponse('RECOMMEND_BUDGET', budget);

          // Should mention budget or price-related suggestion
          expect(fallback.length).toBeGreaterThan(0);
          // Should contain helpful suggestion
          expect(fallback).toMatch(/budget|harga|menu|coba/i);
        }),
        { numRuns: 100 }
      );
    });

    it('should provide budget-related suggestion for BUNDLE_RECOMMEND with budget', () => {
      fc.assert(
        fc.property(fc.integer({ min: 5000, max: 100000 }), (budget) => {
          const fallback = generateFallbackResponse('BUNDLE_RECOMMEND', budget);

          // Should mention budget or paket-related suggestion
          expect(fallback.length).toBeGreaterThan(0);
          expect(fallback).toMatch(/budget|paket|coba/i);
        }),
        { numRuns: 100 }
      );
    });

    it('should provide search-related suggestion for SEARCH_MENU with kategori', () => {
      const kategoriOptions = [['pedas'], ['dingin'], ['makanan', 'pedas'], ['minuman']];

      for (const kategori of kategoriOptions) {
        const fallback = generateFallbackResponse('SEARCH_MENU', null, kategori);

        // Should provide helpful suggestion
        expect(fallback.length).toBeGreaterThan(0);
        expect(fallback).toMatch(/cari|kata kunci|kategori|menu/i);
      }
    });

    it('should return OUT_OF_SCOPE template for OUT_OF_SCOPE intent', () => {
      const fallback = generateFallbackResponse('OUT_OF_SCOPE');

      // Should return the standard template
      expect(fallback).toBe(OUT_OF_SCOPE_TEMPLATE);
    });

    it('should always provide actionable suggestions', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...validIntents),
          fc.option(fc.integer({ min: 5000, max: 100000 }), { nil: null }),
          fc.option(fc.array(fc.constantFrom('pedas', 'dingin', 'makanan', 'minuman'), { minLength: 0, maxLength: 2 }), {
            nil: undefined,
          }),
          (intent, budget, kategori) => {
            const fallback = generateFallbackResponse(intent, budget, kategori);

            // Should always have content
            expect(fallback.length).toBeGreaterThan(10);

            // Should be friendly (contain emoji or polite words)
            const isFriendly =
              fallback.includes('😊') ||
              fallback.includes('💰') ||
              fallback.includes('🍱') ||
              fallback.includes('🏪') ||
              fallback.toLowerCase().includes('coba') ||
              fallback.toLowerCase().includes('mau') ||
              fallback.toLowerCase().includes('ya');

            expect(isFriendly).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Unit tests for cleanMarkdown
   */
  describe('cleanMarkdown', () => {
    it('should remove bold markdown', () => {
      expect(cleanMarkdown('**bold text**')).toBe('bold text');
    });

    it('should remove italic markdown', () => {
      expect(cleanMarkdown('*italic text*')).toBe('italic text');
      expect(cleanMarkdown('_italic text_')).toBe('italic text');
    });

    it('should remove code blocks', () => {
      expect(cleanMarkdown('```code block```')).toBe('');
    });

    it('should remove inline code', () => {
      expect(cleanMarkdown('`inline code`')).toBe('inline code');
    });

    it('should remove headers', () => {
      expect(cleanMarkdown('# Header')).toBe('Header');
      expect(cleanMarkdown('## Header 2')).toBe('Header 2');
    });

    it('should handle mixed markdown', () => {
      const input = '**Bold** and *italic* with `code`';
      const expected = 'Bold and italic with code';
      expect(cleanMarkdown(input)).toBe(expected);
    });
  });

  /**
   * Unit tests for OUT_OF_SCOPE_TEMPLATE
   */
  describe('OUT_OF_SCOPE_TEMPLATE', () => {
    it('should contain expected content', () => {
      expect(OUT_OF_SCOPE_TEMPLATE).toContain('menu kantin');
      expect(OUT_OF_SCOPE_TEMPLATE).toContain('makanan/minuman');
      expect(OUT_OF_SCOPE_TEMPLATE).toContain('harga');
      expect(OUT_OF_SCOPE_TEMPLATE).toContain('rekomendasi');
      expect(OUT_OF_SCOPE_TEMPLATE).toContain('jam buka');
    });

    it('should end with a question to guide user', () => {
      expect(OUT_OF_SCOPE_TEMPLATE).toMatch(/\?$/);
    });
  });
});
