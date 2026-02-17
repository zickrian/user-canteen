# Kantin Terdaftar - E-Kantin App

Aplikasi web minimalis untuk mencari dan menemukan kantin terdaftar dengan desain hitam-putih yang aesthetic.

## 🚀 Fitur

- **Pencarian Kantin** - Cari kantin berdasarkan nama atau menu
- **Filter Waktu Makan** - Filter berdasarkan Makan Pagi, Makan Siang, atau Snack
- **Daftar Kantin** - Tampilan kartu dengan informasi kantin
- **Status Real-time** - Lihat status buka/tutup kantin
- **Responsive Design** - Optimal di desktop dan mobile

## 🛠️ Teknologi

- **Next.js 16** - React Framework
- **TypeScript** - Type Safety
- **Tailwind CSS 4** - Styling
- **Supabase** - Database & Backend
- **Cerebras AI (gpt-oss-120b)** - AI Chatbot
- **Lucide React** - Icons

## 📦 Instalasi

1. Clone repository ini
2. Install dependencies:
   ```bash
   npm install
   ```

3. Setup environment variables:
   File `.env.local` sudah dibuat dengan konfigurasi:
   ```
   SUPABASE_URL=https://krvehrwfaokhscsxjlsm.supabase.co
   SUPABASE_ANON_KEY=your_anon_key
   CEREBRAS_API_KEY=your_cerebras_api_key
   ```
   
   **Catatan:** Aplikasi ini sekarang menggunakan Cerebras AI (model gpt-oss-120b) untuk chatbot. 
   Dapatkan API key Cerebras di: https://cerebras.ai/

4. Setup database di Supabase:
   - Buka Supabase Dashboard: https://supabase.com/dashboard/project/krvehrwfaokhscsxjlsm
   - Pergi ke SQL Editor
   - Jalankan script dari file `supabase-schema.sql`

5. Jalankan development server:
   ```bash
   npm run dev
   ```

6. Buka browser di [http://localhost:3000](http://localhost:3000)

## 🗄️ Struktur Database

Tabel `kantins`:
- `id` - UUID (Primary Key)
- `nama` - Nama kantin
- `foto_url` - URL foto kantin
- `status` - Status buka/tutup
- `makan_pagi` - Tersedia untuk makan pagi
- `makan_siang` - Tersedia untuk makan siang
- `snack` - Tersedia untuk snack
- `created_at` - Timestamp

## 🎨 Desain

Aplikasi menggunakan tema hitam-putih dengan:
- Font Geist Sans untuk tampilan modern
- Border hitam tebal untuk aesthetic
- Shadow effect pada hover
- Rounded corners untuk card
- Minimalist & clean interface

## 📱 Responsive

- Desktop: Grid 4 kolom
- Tablet: Grid 2-3 kolom  
- Mobile: Grid 1-2 kolom

## 🔒 Security

- Row Level Security (RLS) diaktifkan
- Public read access untuk data kantin
- Authenticated users only untuk insert data

## 📝 License

MIT License - Bebas digunakan untuk project pribadi maupun komersial.

