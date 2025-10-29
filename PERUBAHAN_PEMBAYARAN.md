# 📋 SUMMARY PERUBAHAN SISTEM PEMBAYARAN

## 🎯 Yang Sudah Diperbaiki

### 1. **Database - Tabel Pembayaran Baru** 
   - File: `database/ADD_PEMBAYARAN_TABLE.sql`
   - Menambahkan tabel `pembayaran` untuk tracking transaksi Midtrans
   - Menambahkan tabel `rating` untuk user bisa rate makanan
   - Auto-trigger saat pembayaran settlement → pesanan status berubah ke `diproses`

### 2. **API - Create Payment Endpoint**
   - File: `src/app/api/midtrans/create-payment/route.ts`
   - ✅ Membuat pesanan di database
   - ✅ Membuat detail pesanan
   - ✅ Membuat record pembayaran (baru)
   - ✅ Menggunakan UUID untuk pesanan ID
   - ✅ Menggunakan string untuk Midtrans Order ID
   - ✅ Error handling yang lebih baik dengan pesan detail

### 3. **API - Status Payment Endpoint**
   - File: `src/app/api/midtrans/status/[orderId]/route.ts`
   - ✅ Query pembayaran berdasarkan Midtrans Order ID
   - ✅ Update status pembayaran di database
   - ✅ Return pesanan ID untuk redirect ke struk
   - ✅ Trigger otomatis update pesanan status

### 4. **Frontend - Checkout Page**
   - File: `src/app/checkout/page.tsx`
   - ✅ Hapus nominal harga dari quantity section (sudah selesai di step 1)
   - ✅ Track separate order ID dan Midtrans Order ID
   - ✅ Polling setiap 3 detik untuk status pembayaran
   - ✅ Redirect ke E-Struk (halaman rating) saat pembayaran berhasil
   - ✅ Better error handling dengan alert

### 5. **Documentation**
   - File: `SETUP_PEMBAYARAN.md` - Step-by-step setup guide
   - File: `PERUBAHAN_PEMBAYARAN.md` - File ini

## 🔄 Flow Pembayaran (Terbaru)

```
┌─────────────────────────────────────────────────────────────┐
│ USER CHECKOUT                                               │
├─────────────────────────────────────────────────────────────┤
│ 1. Form checkout → Klik Bayar                              │
│ 2. POST /api/midtrans/create-payment                       │
│    - Create pesanan (UUID) + detail_pesanan               │
│    - Create pembayaran record (Midtrans Order ID)         │
│    - Create Midtrans transaction (QRIS)                   │
│ 3. Return QR Code → Display di halaman checkout           │
├─────────────────────────────────────────────────────────────┤
│ USER PEMBAYARAN                                             │
├─────────────────────────────────────────────────────────────┤
│ 4. Scan QR dengan e-wallet                                 │
│ 5. Bayar (OVO/Dana/GCASH/dll)                             │
│ 6. Midtrans proses & update status                        │
├─────────────────────────────────────────────────────────────┤
│ FRONTEND POLLING                                            │
├─────────────────────────────────────────────────────────────┤
│ 7. Setiap 3 detik:                                        │
│    GET /api/midtrans/status/{midtransOrderId}            │
│    - Query Midtrans API status                           │
│    - Update pembayaran record status di DB               │
│    - Trigger otomatis update pesanan status             │
│ 8. Jika status settlement:                                │
│    - Set paymentStatus = 'success'                       │
│    - Redirect ke /struk/{pesananId}                     │
│ 9. Di E-Struk halaman:                                   │
│    - Show pesanan detail                                │
│    - User bisa rate makanan (insert ke tabel rating)    │
│    - Print struk                                         │
└─────────────────────────────────────────────────────────────┘
```

## 📊 Database Structure (Baru)

### Tabel `pembayaran`
```
id                    UUID (PK)
pesanan_id            UUID (FK → pesanan.id) UNIQUE
midtrans_order_id     TEXT UNIQUE
midtrans_transaction_id TEXT (nullable)
gross_amount          NUMERIC
payment_type          TEXT (e.g., 'qris')
status                TEXT ('pending'|'settlement'|'expire'|'cancel'|'deny')
email_pelanggan       TEXT
nomor_meja            TEXT
tipe_pesanan          TEXT ('dine_in'|'take_away')
created_at            TIMESTAMPTZ
updated_at            TIMESTAMPTZ
```

### Tabel `rating`
```
id                UUID (PK)
pesanan_id        UUID (FK → pesanan.id)
menu_id           UUID (FK → menu.id)
rating            INTEGER (1-5)
komentar          TEXT (nullable)
created_at        TIMESTAMPTZ
updated_at        TIMESTAMPTZ
```

## ✅ Checklist Implementasi

- [x] Buat tabel pembayaran & rating
- [x] Update create-payment API
- [x] Update status API
- [x] Update checkout page (frontend)
- [x] Add proper error handling
- [x] Auto-trigger pesanan status update
- [x] Documentation

## 🚀 Cara Test

### 1. **Run SQL Script Dulu**
   ```
   1. Buka Supabase Dashboard
   2. SQL Editor → New Query
   3. Copy database/ADD_PEMBAYARAN_TABLE.sql
   4. Klik Run
   ```

### 2. **Test Checkout**
   ```
   1. http://localhost:3000
   2. Pilih Kantin → Pilih Menu
   3. Checkout → Fill form → Klik "Bayar dengan QRIS"
   4. QR Code tampil
   5. Scan dengan e-wallet (test mode)
   6. Pembayaran selesai
   7. Redirect ke E-Struk dengan rating form
   ```

### 3. **Test Rating**
   ```
   1. Di halaman E-Struk
   2. Rating 1-5 untuk setiap item
   3. Klik Submit Rating
   4. Rating tersimpan di database
   ```

## ⚠️ Penting!

1. **HARUS jalankan SQL script dulu** (database/ADD_PEMBAYARAN_TABLE.sql)
2. Environment variables sudah benar:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `MIDTRANS_SERVER_KEY`
   - `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY`

3. Jika error saat checkout:
   - Check browser console (F12) untuk error detail
   - Check Supabase dashboard untuk data yang tersimpan
   - Pastikan SQL script berhasil dijalankan

## 🔗 Related Files

- `src/app/checkout/page.tsx` - Checkout halaman
- `src/app/struk/[pesanan-id]/page.tsx` - E-Struk halaman (rating page)
- `src/app/api/midtrans/create-payment/route.ts` - Create payment API
- `src/app/api/midtrans/status/[orderId]/route.ts` - Check payment status
- `database/ADD_PEMBAYARAN_TABLE.sql` - Database schema baru
- `SETUP_PEMBAYARAN.md` - Setup guide

---

**Status**: ✅ Ready to Test!

Hubungi developer jika ada issues atau pertanyaan!
