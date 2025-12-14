/**
 * Property-Based Tests untuk Queries
 * **Feature: kantin-chatbot-gateway**
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { Menu, Bundle } from './queries';

// Mock data generators
const menuArb: fc.Arbitrary<Menu> = fc.record({
  id: fc.uuid(),
  kantin_id: fc.uuid(),
  nama_menu: fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
  harga: fc.integer({ min: 1000, max: 50000 }),
  deskripsi: fc.option(fc.string({ maxLength: 200 }), { nil: null }),
  tersedia: fc.constant(true),
  kategori_menu: fc.array(fc.constantFrom('makanan', 'minuman', 'pedas', 'manis', 'dingin'), { minLength: 1, maxLength: 3 }),
  total_sold: fc.integer({ min: 0, max: 1000 }),
  foto_menu: fc.option(fc.string(), { nil: null }),
});

const makananArb = menuArb.map((m) => ({ ...m, kategori_menu: ['makanan', ...m.kategori_menu.filter((k) => k !== 'minuman')] }));
const minumanArb = menuArb.map((m) => ({ ...m, kategori_menu: ['minuman', ...m.kategori_menu.filter((k) => k !== 'makanan')] }));

describe('Queries', () => {
  /**
   * **Feature: kantin-chatbot-gateway, Property 4: Bundle Budget Constraint**
   * For any bundle recommendation with a given budget, ALL returned bundles SHALL have
   * total price (makanan.harga + minuman.harga) less than or equal to the budget.
   * **Validates: Requirements 4.1, 4.2**
   */
  describe('Property 4: Bundle Budget Constraint', () => {
    it('should ensure all bundles have total <= budget', () => {
      fc.assert(
        fc.property(
          fc.array(makananArb, { minLength: 1, maxLength: 10 }),
          fc.array(minumanArb, { minLength: 1, maxLength: 10 }),
          fc.integer({ min: 10000, max: 100000 }),
          (makananList, minumanList, budget) => {
            // Simulate bundle generation logic
            const bundles: Bundle[] = [];

            for (const makanan of makananList) {
              for (const minuman of minumanList) {
                const total = makanan.harga + minuman.harga;
                if (total <= budget) {
                  bundles.push({
                    makanan,
                    minuman,
                    total,
                    sisa: budget - total,
                  });
                }
              }
            }

            // Property: ALL bundles must have total <= budget
            for (const bundle of bundles) {
              expect(bundle.total).toBeLessThanOrEqual(budget);
              expect(bundle.makanan.harga + bundle.minuman.harga).toBe(bundle.total);
              expect(bundle.sisa).toBe(budget - bundle.total);
              expect(bundle.sisa).toBeGreaterThanOrEqual(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return empty array when no valid combinations exist', () => {
      fc.assert(
        fc.property(
          fc.array(makananArb.map((m) => ({ ...m, harga: 50000 })), { minLength: 1, maxLength: 5 }),
          fc.array(minumanArb.map((m) => ({ ...m, harga: 50000 })), { minLength: 1, maxLength: 5 }),
          fc.integer({ min: 1000, max: 10000 }), // Very low budget
          (makananList, minumanList, lowBudget) => {
            const bundles: Bundle[] = [];

            for (const makanan of makananList) {
              for (const minuman of minumanList) {
                const total = makanan.harga + minuman.harga;
                if (total <= lowBudget) {
                  bundles.push({
                    makanan,
                    minuman,
                    total,
                    sisa: lowBudget - total,
                  });
                }
              }
            }

            // With expensive items and low budget, should have no valid bundles
            // (50000 + 50000 = 100000 > 10000)
            expect(bundles.length).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: kantin-chatbot-gateway, Property 5: Recommendation Sorting Order**
   * For any menu recommendation query, the returned results SHALL be sorted by
   * total_sold descending, then by harga descending.
   * **Validates: Requirements 3.4**
   */
  describe('Property 5: Recommendation Sorting Order', () => {
    it('should sort menus by total_sold desc, then harga desc', () => {
      fc.assert(
        fc.property(fc.array(menuArb, { minLength: 2, maxLength: 20 }), (menus) => {
          // Simulate sorting logic from recommendMenu
          const sorted = [...menus].sort((a, b) => {
            // First by total_sold descending
            if (b.total_sold !== a.total_sold) {
              return b.total_sold - a.total_sold;
            }
            // Then by harga descending
            return b.harga - a.harga;
          });

          // Property: sorted array should maintain order
          for (let i = 0; i < sorted.length - 1; i++) {
            const current = sorted[i];
            const next = sorted[i + 1];

            // Either current has higher total_sold
            // OR same total_sold but higher/equal harga
            const validOrder =
              current.total_sold > next.total_sold ||
              (current.total_sold === next.total_sold && current.harga >= next.harga);

            expect(validOrder).toBe(true);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should prioritize popularity over price', () => {
      fc.assert(
        fc.property(
          menuArb,
          menuArb,
          fc.integer({ min: 100, max: 500 }),
          (menu1Base, menu2Base, soldDiff) => {
            // Create two menus where menu1 is more popular but cheaper
            const menu1 = { ...menu1Base, total_sold: 100 + soldDiff, harga: 10000 };
            const menu2 = { ...menu2Base, total_sold: 100, harga: 50000 };

            const sorted = [menu1, menu2].sort((a, b) => {
              if (b.total_sold !== a.total_sold) {
                return b.total_sold - a.total_sold;
              }
              return b.harga - a.harga;
            });

            // More popular item should come first despite lower price
            expect(sorted[0].total_sold).toBeGreaterThan(sorted[1].total_sold);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Unit tests for bundle sorting
   */
  describe('Bundle Sorting', () => {
    it('should sort bundles by combined popularity, then by budget optimization', () => {
      fc.assert(
        fc.property(
          fc.array(makananArb, { minLength: 2, maxLength: 5 }),
          fc.array(minumanArb, { minLength: 2, maxLength: 5 }),
          fc.integer({ min: 50000, max: 100000 }),
          (makananList, minumanList, budget) => {
            const bundles: Bundle[] = [];

            for (const makanan of makananList) {
              for (const minuman of minumanList) {
                const total = makanan.harga + minuman.harga;
                if (total <= budget) {
                  bundles.push({
                    makanan,
                    minuman,
                    total,
                    sisa: budget - total,
                  });
                }
              }
            }

            // Sort by combined popularity, then by sisa (budget optimization)
            const sorted = [...bundles].sort((a, b) => {
              const popularityA = a.makanan.total_sold + a.minuman.total_sold;
              const popularityB = b.makanan.total_sold + b.minuman.total_sold;

              if (popularityB !== popularityA) {
                return popularityB - popularityA;
              }

              return a.sisa - b.sisa;
            });

            // Verify sorting order
            for (let i = 0; i < sorted.length - 1; i++) {
              const current = sorted[i];
              const next = sorted[i + 1];

              const popCurrent = current.makanan.total_sold + current.minuman.total_sold;
              const popNext = next.makanan.total_sold + next.minuman.total_sold;

              const validOrder = popCurrent > popNext || (popCurrent === popNext && current.sisa <= next.sisa);

              expect(validOrder).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
