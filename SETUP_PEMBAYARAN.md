# 🔧 SETUP PEMBAYARAN MIDTRANS - LANGKAH DEMI LANGKAH

## ⚠️ PENTING: Jalankan SQL Script Dulu!

Sebelum melakukan checkout, pastikan Anda sudah menjalankan SQL script untuk menambahkan tabel pembayaran.

### Langkah 1: Buka Supabase Dashboard
1. Buka https://app.supabase.com
2. Login dengan akun Anda
3. Pilih project e-kantin

### Langkah 2: Buka SQL Editor
1. Di sidebar kiri, klik **SQL Editor**
2. Klik **+ New Query**

### Langkah 3: Copy-Paste Script SQL
1. Buka file: `database/ADD_PEMBAYARAN_TABLE.sql`
2. Copy semua script
3. Paste di SQL Editor yang sudah dibuka di Supabase
4. Klik **Run** (tombol biru di kanan atas)
5. Tunggu sampai selesai (biasanya 5-10 detik)

### Langkah 4: Verifikasi
Jika sukses, Anda akan melihat pesan:
```
Execute successful
```

Jika ada error, silakan hubungi developer dan share screenshot error-nya.

## ✅ Setelah SQL Script Dijalankan

Sekarang Anda bisa test checkout:

1. **Buka aplikasi** http://localhost:3000
2. **Pilih Kantin** → Pilih menu → **Checkout**
3. **Isi form** dengan data Anda
4. **Klik tombol Bayar** → akan muncul QR code QRIS
5. **Scan QR** dengan e-wallet Anda (OVO, GCash, Dana, dll)
6. **Pembayaran akan berhasil** dan akan redirect ke halaman E-Struk

## 🐛 Troubleshooting

### Error: "Gagal menyimpan pesanan"
- Pastikan SQL script sudah dijalankan
- Cek browser console (F12) untuk error details
- Bagikan error detail ke developer

### Error: "Payment record not found"
- Kemungkinan tabel pembayaran belum dibuat
- Ulangi Langkah 1-4 di atas

### QR Code tidak muncul
- Pastikan API Key Midtrans sudah benar di `.env.local`
- Check browser console untuk error

## 📝 Struktur Database Baru

Script SQL di atas membuat tabel:

### Tabel `pembayaran`
- Menyimpan data pembayaran dari Midtrans
- Link ke pesanan
- Track status pembayaran (pending, settlement, expired, dll)

### Tabel `rating`
- Untuk rating makanan di halaman E-Struk
- Sudah siap digunakan

### Trigger Otomatis
- Saat pembayaran `settlement` → pesanan otomatis status `diproses`
- Saat pembayaran `expired/cancel/deny` → pesanan otomatis status `menunggu`

## 🔗 Flow Pembayaran

```
1. User checkout → Create pesanan + pembayaran record
2. Midtrans QR Code ditampilkan
3. User scan & bayar
4. Midtrans webhook update status
5. Aplikasi polling status setiap 3 detik
6. Status berubah ke `settlement` → Pesanan jadi `diproses` → Redirect ke E-Struk
7. Di E-Struk user bisa rating makanan
```

## 💡 Catatan

- Jangan ubah script SQL itu sendiri
- Jika ada kolom yang sudah ada, script akan skip (aman untuk dijalankan berkali-kali)
- RLS Policy sudah dikonfigurasi dengan aman

Hubungi developer jika ada pertanyaan! 🚀
