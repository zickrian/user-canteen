/**
 * Property-Based Tests untuk Intent Extractor
 * **Feature: kantin-chatbot-gateway**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  extractIntent,
  extractBudget,
  extractKategori,
  detectIntent,
  IntentType,
} from './intentExtractor';

// Test data generators
const budgetKArb = fc.integer({ min: 1, max: 100 }).map((n) => ({ input: `${n}k`, expected: n * 1000 }));
const budgetRbArb = fc.integer({ min: 1, max: 100 }).map((n) => ({ input: `${n}rb`, expected: n * 1000 }));
const budgetRpArb = fc.integer({ min: 1000, max: 100000 }).map((n) => ({
  input: `Rp ${n.toLocaleString('id-ID')}`,
  expected: n,
}));
const budgetRawArb = fc.integer({ min: 1000, max: 100000 }).map((n) => ({ input: `${n}`, expected: n }));

// Kategori keywords sesuai dengan database (Minuman, Makan Pagi, Makan Siang)
const kategoriKeywords = [
  { input: 'pedas', expected: 'pedas' },
  { input: 'pedes', expected: 'pedas' },
  { input: 'minuman', expected: 'Minuman' },
  { input: 'minum', expected: 'Minuman' },
  { input: 'es', expected: 'Minuman' },
  { input: 'jus', expected: 'Minuman' },
  { input: 'kopi', expected: 'Minuman' },
  { input: 'teh', expected: 'Minuman' },
  { input: 'sarapan', expected: 'Makan Pagi' },
  { input: 'siang', expected: 'Makan Siang' },
];

const kantinIdArb = fc.uuid();

describe('Intent Extractor', () => {
  /**
   * **Feature: kantin-chatbot-gateway, Property 1: Intent and Parameter Extraction Consistency**
   * For any user message containing known patterns (budget patterns like "20k/20rb/Rp X",
   * category keywords like "pedas/dingin/kopi", intent keywords like "jam buka/rekomendasi/cari"),
   * the extractIntent function SHALL correctly identify the intent type and extract all parameters
   * with correct values.
   * **Validates: Requirements 1.1, 3.1, 3.2**
   */
  describe('Property 1: Intent and Parameter Extraction Consistency', () => {
    it('should correctly extract budget from "Xk" pattern', () => {
      fc.assert(
        fc.property(budgetKArb, ({ input, expected }) => {
          const result = extractBudget(input);
          expect(result).toBe(expected);
        }),
        { numRuns: 100 }
      );
    });

    it('should correctly extract budget from "Xrb" pattern', () => {
      fc.assert(
        fc.property(budgetRbArb, ({ input, expected }) => {
          const result = extractBudget(input);
          expect(result).toBe(expected);
        }),
        { numRuns: 100 }
      );
    });

    it('should correctly extract budget from "Rp X" pattern', () => {
      fc.assert(
        fc.property(budgetRpArb, ({ input, expected }) => {
          const result = extractBudget(input);
          expect(result).toBe(expected);
        }),
        { numRuns: 100 }
      );
    });

    it('should correctly extract budget from raw number pattern', () => {
      fc.assert(
        fc.property(budgetRawArb, ({ input, expected }) => {
          const result = extractBudget(input);
          expect(result).toBe(expected);
        }),
        { numRuns: 100 }
      );
    });

    it('should correctly map kategori keywords to standard categories', () => {
      for (const { input, expected } of kategoriKeywords) {
        const result = extractKategori(`mau yang ${input}`);
        expect(result).toContain(expected);
      }
    });

    it('should detect ASK_CANTEEN_INFO intent for jam buka/tutup patterns', () => {
      const patterns = ['jam buka', 'jam tutup', 'buka nggak', 'buka tidak', 'kapan buka'];
      for (const pattern of patterns) {
        const result = detectIntent(pattern);
        expect(result).toBe('ASK_CANTEEN_INFO');
      }
    });

    it('should detect BUNDLE_RECOMMEND intent for paket/combo patterns', () => {
      const patterns = ['makan dan minum', 'makanan + minuman', 'paket', 'combo', 'bundle'];
      for (const pattern of patterns) {
        const result = detectIntent(pattern);
        expect(result).toBe('BUNDLE_RECOMMEND');
      }
    });

    it('should detect RECOMMEND_BUDGET intent for recommendation patterns', () => {
      const patterns = ['rekomendasi', 'rekomen', 'saran', 'enak apa', 'yang enak', 'populer', 'laris'];
      for (const pattern of patterns) {
        const result = detectIntent(pattern);
        expect(result).toBe('RECOMMEND_BUDGET');
      }
    });

    it('should detect SEARCH_MENU intent for search patterns', () => {
      const patterns = ['cari nasi goreng', 'ada ayam bakar'];
      for (const pattern of patterns) {
        const result = detectIntent(pattern);
        expect(result).toBe('SEARCH_MENU');
      }
    });

    it('should extract all parameters correctly in combined message', () => {
      fc.assert(
        fc.property(kantinIdArb, fc.integer({ min: 10, max: 50 }), (kantinId, budgetK) => {
          const message = `rekomendasi minuman dingin budget ${budgetK}k`;
          const result = extractIntent(message, kantinId);

          expect(result.intent).toBe('RECOMMEND_BUDGET');
          expect(result.kantin_id).toBe(kantinId);
          expect(result.budget).toBe(budgetK * 1000);
          expect(result.kategori).toContain('Minuman');
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Unit tests for edge cases
   */
  describe('Edge Cases', () => {
    it('should return null for messages without budget', () => {
      expect(extractBudget('mau makan enak')).toBeNull();
    });

    it('should return empty array for messages without kategori', () => {
      // "makan" sekarang di-map ke "Makan Pagi", jadi gunakan pesan tanpa keyword
      expect(extractKategori('enak banget')).toEqual([]);
    });

    it('should handle empty message', () => {
      const result = extractIntent('', 'test-id');
      expect(result.intent).toBe('OUT_OF_SCOPE');
    });

    it('should handle special characters in message', () => {
      const result = extractIntent('harga nasi goreng???', 'test-id');
      expect(result.intent).toBe('ASK_MENU_INFO');
    });
  });
});
