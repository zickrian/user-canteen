/**
 * Output Formatters untuk Chatbot Kantin
 * Format data menjadi string yang mudah dibaca
 */

import { Menu, KantinInfo, Bundle } from './queries';

/**
 * Format harga ke format Rupiah
 */
export function formatPrice(price: number): string {
  return `Rp ${price.toLocaleString('id-ID')}`;
}

/**
 * Format menu list: "Nama — Rp X"
 */
export function formatMenuList(menus: Menu[]): string {
  if (menus.length === 0) {
    return 'Tidak ada menu yang ditemukan.';
  }

  return menus
    .map((menu) => `${menu.nama_menu} — ${formatPrice(menu.harga)}`)
    .join('\n');
}

/**
 * Format menu detail: nama, harga, deskripsi, status tersedia
 */
export function formatMenuDetail(menu: Menu): string {
  const lines: string[] = [
    `📍 ${menu.nama_menu}`,
    `💰 ${formatPrice(menu.harga)}`,
  ];

  if (menu.deskripsi) {
    lines.push(`📝 ${menu.deskripsi}`);
  }

  lines.push(`✅ ${menu.tersedia ? 'Tersedia' : 'Tidak tersedia'}`);

  if (menu.kategori_menu && menu.kategori_menu.length > 0) {
    lines.push(`🏷️ ${menu.kategori_menu.join(', ')}`);
  }

  if (menu.total_sold > 0) {
    lines.push(`🔥 Terjual ${menu.total_sold}x`);
  }

  return lines.join('\n');
}

/**
 * Format multiple menu details
 */
export function formatMenuDetails(menus: Menu[]): string {
  if (menus.length === 0) {
    return 'Tidak ada menu yang ditemukan.';
  }

  return menus.map(formatMenuDetail).join('\n\n');
}

/**
 * Format bundle: "Paket N: makanan + minuman = total"
 */
export function formatBundle(bundles: Bundle[]): string {
  if (bundles.length === 0) {
    return 'Tidak ada paket yang sesuai dengan budget.';
  }

  return bundles
    .map((bundle, index) => {
      const paketNum = index + 1;
      return `Paket ${paketNum}: ${bundle.makanan.nama_menu} + ${bundle.minuman.nama_menu} = ${formatPrice(bundle.total)}`;
    })
    .join('\n');
}

/**
 * Format bundle with details
 */
export function formatBundleDetails(bundles: Bundle[]): string {
  if (bundles.length === 0) {
    return 'Tidak ada paket yang sesuai dengan budget.';
  }

  return bundles
    .map((bundle, index) => {
      const paketNum = index + 1;
      const lines = [
        `🍱 Paket ${paketNum}:`,
        `  🍽️ ${bundle.makanan.nama_menu} (${formatPrice(bundle.makanan.harga)})`,
        `  🥤 ${bundle.minuman.nama_menu} (${formatPrice(bundle.minuman.harga)})`,
        `  💰 Total: ${formatPrice(bundle.total)}`,
      ];

      if (bundle.sisa > 0) {
        lines.push(`  💵 Sisa: ${formatPrice(bundle.sisa)}`);
      }

      return lines.join('\n');
    })
    .join('\n\n');
}

/**
 * Format kantin info: jam buka/tutup readable
 */
export function formatKantinInfo(kantin: KantinInfo): string {
  const lines: string[] = [`🏪 ${kantin.nama_kantin}`];

  if (kantin.buka_tutup) {
    lines.push('✅ Status: Buka');
  } else {
    lines.push('❌ Status: Tutup');
  }

  if (kantin.jam_buka && kantin.jam_tutup) {
    lines.push(`🕐 Jam operasional: ${kantin.jam_buka} - ${kantin.jam_tutup}`);
  } else if (kantin.jam_buka) {
    lines.push(`🕐 Buka mulai: ${kantin.jam_buka}`);
  } else if (kantin.jam_tutup) {
    lines.push(`🕐 Tutup pukul: ${kantin.jam_tutup}`);
  } else {
    lines.push('🕐 Jam operasional tidak tersedia');
  }

  return lines.join('\n');
}

/**
 * Format operating hours only
 */
export function formatOperatingHours(kantin: KantinInfo): string {
  if (kantin.jam_buka && kantin.jam_tutup) {
    return `${kantin.jam_buka} - ${kantin.jam_tutup}`;
  } else if (kantin.jam_buka) {
    return `Buka mulai ${kantin.jam_buka}`;
  } else if (kantin.jam_tutup) {
    return `Tutup pukul ${kantin.jam_tutup}`;
  }
  return 'Jam operasional tidak tersedia';
}
