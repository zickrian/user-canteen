/**
 * Property-Based Tests untuk Formatters
 * **Feature: kantin-chatbot-gateway**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  formatPrice,
  formatMenuList,
  formatMenuDetail,
  formatBundle,
  formatKantinInfo,
} from './formatters';
import { Menu, KantinInfo, Bundle } from './queries';

// Test data generators
const menuArb: fc.Arbitrary<Menu> = fc.record({
  id: fc.uuid(),
  kantin_id: fc.uuid(),
  nama_menu: fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
  harga: fc.integer({ min: 1000, max: 100000 }),
  deskripsi: fc.option(fc.string({ maxLength: 200 }), { nil: null }),
  tersedia: fc.boolean(),
  kategori_menu: fc.array(fc.constantFrom('makanan', 'minuman', 'pedas', 'manis', 'dingin'), { minLength: 0, maxLength: 3 }),
  total_sold: fc.integer({ min: 0, max: 1000 }),
  foto_menu: fc.option(fc.string(), { nil: null }),
});

const kantinInfoArb: fc.Arbitrary<KantinInfo> = fc.record({
  id: fc.uuid(),
  nama_kantin: fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
  jam_buka: fc.option(fc.constantFrom('07:00', '08:00', '09:00'), { nil: null }),
  jam_tutup: fc.option(fc.constantFrom('17:00', '18:00', '21:00'), { nil: null }),
  buka_tutup: fc.boolean(),
  status: fc.constantFrom('pending', 'aktif', 'ditolak'),
});

const bundleArb: fc.Arbitrary<Bundle> = fc.record({
  makanan: menuArb,
  minuman: menuArb,
  total: fc.integer({ min: 2000, max: 200000 }),
  sisa: fc.integer({ min: 0, max: 50000 }),
});

describe('Formatters', () => {
  /**
   * **Feature: kantin-chatbot-gateway, Property 8: Output Format Consistency**
   * For any menu data, the formatting functions SHALL produce output containing all required fields:
   * - Menu list: "Nama — Rp X" format
   * - Menu detail: nama, harga, deskripsi, status tersedia
   * - Bundle: "Paket N: makanan + minuman = total" format
   * **Validates: Requirements 7.1, 7.2, 7.3**
   */
  describe('Property 8: Output Format Consistency', () => {
    it('should format menu list as "Nama — Rp X"', () => {
      fc.assert(
        fc.property(fc.array(menuArb, { minLength: 1, maxLength: 5 }), (menus) => {
          const result = formatMenuList(menus);

          for (const menu of menus) {
            // Check that each menu appears in format "Nama — Rp X"
            expect(result).toContain(menu.nama_menu);
            expect(result).toContain('Rp');
            expect(result).toContain('—');
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should format menu detail with nama, harga, deskripsi, tersedia', () => {
      fc.assert(
        fc.property(menuArb, (menu) => {
          const result = formatMenuDetail(menu);

          // Must contain nama
          expect(result).toContain(menu.nama_menu);

          // Must contain harga with Rp
          expect(result).toContain('Rp');

          // Must contain tersedia status
          expect(result).toMatch(/Tersedia|Tidak tersedia/);

          // If deskripsi exists, should be included
          if (menu.deskripsi) {
            expect(result).toContain(menu.deskripsi);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should format bundle as "Paket N: makanan + minuman = total"', () => {
      fc.assert(
        fc.property(fc.array(bundleArb, { minLength: 1, maxLength: 3 }), (bundles) => {
          const result = formatBundle(bundles);

          for (let i = 0; i < bundles.length; i++) {
            const bundle = bundles[i];
            // Check format "Paket N: makanan + minuman = total"
            expect(result).toContain(`Paket ${i + 1}`);
            expect(result).toContain(bundle.makanan.nama_menu);
            expect(result).toContain(bundle.minuman.nama_menu);
            expect(result).toContain('+');
            expect(result).toContain('=');
            expect(result).toContain('Rp');
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should format kantin info with nama and status', () => {
      fc.assert(
        fc.property(kantinInfoArb, (kantin) => {
          const result = formatKantinInfo(kantin);

          // Must contain nama kantin
          expect(result).toContain(kantin.nama_kantin);

          // Must contain status (Buka/Tutup)
          expect(result).toMatch(/Buka|Tutup/);

          // If jam_buka and jam_tutup exist, should show operating hours
          if (kantin.jam_buka && kantin.jam_tutup) {
            expect(result).toContain(kantin.jam_buka);
            expect(result).toContain(kantin.jam_tutup);
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Unit tests for edge cases
   */
  describe('Edge Cases', () => {
    it('should handle empty menu list', () => {
      const result = formatMenuList([]);
      expect(result).toBe('Tidak ada menu yang ditemukan.');
    });

    it('should handle empty bundle list', () => {
      const result = formatBundle([]);
      expect(result).toBe('Tidak ada paket yang sesuai dengan budget.');
    });

    it('should format price correctly', () => {
      expect(formatPrice(20000)).toBe('Rp 20.000');
      expect(formatPrice(1000)).toBe('Rp 1.000');
      expect(formatPrice(100000)).toBe('Rp 100.000');
    });
  });
});
