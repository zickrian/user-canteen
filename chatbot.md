hai aku ingin kamu terapkan perintah di bawah ini ya aku ingin me refactor code2 untuk chatbot nya agar dia lebih pintar dan mengerti di semua kondisi jadi dia abis di query langsung bisa tuh mencari menu makanan di supabase dan memberikan rekomendasi ke user dengan langsung ada tombol tambah agar memudahkan user ( di code kita sudah adaaa)



oke lakukan rekomendasi plan di bawah :

Planning Lengkap: Chatbot Kantin (Supabase Postgres) + Gemini 2.5 Flash + Tool Calling + Tombol
Target Perilaku Chatbot

Bisa basa-basi untuk sapaan / ngobrol ringan, dan mengarahkan ke pemesanan.

Hanya menjawab topik kantin/menu/pemesanan. Kalau user tanya di luar itu → tolak halus + arahkan kembali.

Kalau user minta rekomendasi tapi kurang spesifik → chatbot tanya balik dengan tombol quick reply (pagi/siang/snack/minuman + budget opsional).

Kalau user tanya yang butuh data (harga/menu/termurah/termahal/list/budget) → chatbot WAJIB panggil tool (API) untuk baca database.

Kalau hasil pencarian kosong → jawab tegas: “Tidak ada menu yang sesuai.” (boleh tambah saran kecil, tapi jangan mengarang menu).

Mendukung semua query contoh:

“rekomenin menu dong”

“menu di kios A apa aja”

“termurah di kios A”

“termahal dari semua kios”

“minuman di bawah 8000”

“rekomendasi makanan+minuman budget 20k, carikan kombinasi”

A. Arsitektur (wajib)

AI tidak pegang token Supabase.
Buat Backend Tools API (boleh Supabase Edge Functions atau server sendiri) yang:

pegang SUPABASE_SERVICE_ROLE_KEY (server-only)

query Postgres (read-only)

return JSON yang rapi untuk AI

Flow:
User UI → Chat Server (Gemini) → (tool call) Tools API → Supabase Postgres → Tools API → Gemini → UI

B. Database Supabase: persiapan query (recommended)
B1) Buat VIEW agregasi rating menu

Buat view v_menu_stats supaya semua query gampang dan konsisten:

Fields yang wajib keluar:

menu.id, menu.kantin_id, menu.nama_menu, menu.harga, menu.tersedia, menu.kategori_menu, menu.total_sold

avg_rating (rata-rata dari tabel rating)

rating_count

View ini dipakai semua endpoint tools.

B2) Standardisasi kategori

Pastikan kategori_menu jsonb punya field yang bisa difilter (contoh: type: makan_pagi|makan_siang|snack|minuman).
Kalau belum konsisten, buat mapping di backend.

C. Tools API (endpoint yang harus dibuat)

Buat base URL: /tools/*

Tool 1 — search_menu

Tujuan: cari/rekomendasi menu berdasarkan query + filter.
Input JSON:

kantin_id? (uuid)

query? (string)

kategori? (string: makan_pagi | makan_siang | snack | minuman)

max_price? (number)

min_rating? (number)

only_available (boolean, default true)

sort (string: rating_desc | price_asc | price_desc | best_seller_desc)

limit (number, default 10)

Output JSON:

items: [{id, kantin_id, nama_menu, harga, avg_rating, rating_count, total_sold}]

Tool 2 — list_menu_by_kantin

Input: kantin_id, optional only_available, sort, limit
Output: list menu untuk kios/kantin tertentu

Tool 3 — get_cheapest

Input: kantin_id?, limit
Output: daftar termurah (kios tertentu atau global)

Tool 4 — get_priciest

Input: kantin_id?, limit
Output: daftar termahal (kios tertentu atau global)

Tool 5 — list_under_price

Input: max_price, optional kantin_id, optional kategori, limit
Output: semua menu <= max_price

Tool 6 — recommend_combo_under_budget

Tujuan: kombinasi makanan+minuman <= budget
Input:

budget (number)

kantin_id?

limit (default 10)

prefer_sort (total_asc | rating_desc | best_seller_desc)

Output:

combos: [{ makanan: {...}, minuman: {...}, total }]

Aturan:

“makanan” harus kategori makan_pagi/makan_siang/snack (sesuai definisi kamu)

“minuman” kategori minuman

total <= budget

kalau kosong return combos: []

D. Chat Server (Gemini) + Function Calling
D1) Daftarkan Tools (function definitions)

Setiap tool di atas jadi “function” yang bisa dipanggil Gemini.

D2) System Prompt (aturan perilaku ketat)

Masukkan aturan berikut (wajib):

Kamu adalah “Asisten Kantin”. Hanya boleh menjawab hal terkait kantin/menu/pemesanan.

Jika user menyapa/obrol ringan: jawab ramah + tawarkan bantuan memilih menu.

Jika pertanyaan tidak terkait kantin: tolak halus (“Maaf aku hanya bantu soal menu/pesanan di kantin.”).

Jika butuh data (harga/menu/termurah/termahal/list/budget) WAJIB panggil tool. Jangan mengarang.

Jika hasil tool kosong: jawab “Tidak ada menu yang sesuai.” (jangan mengarang).

Jika permintaan “rekomenin menu” masih ambigu: tanyakan preferensi dengan tombol (kategori + budget).

Selalu tampilkan menu dengan format: Nama Menu — RpX — Rating Y (N ulasan) — (Kantin/Kios: ...)

D3) Router Intent (di prompt)

Aturan pemilihan tool:

“menu di kios/kantin X” → list_menu_by_kantin

“termurah/termahal” → get_cheapest/get_priciest

“di bawah harga” → list_under_price

“budget X makanan+minuman” → recommend_combo_under_budget

“rekomendasi umum / menu mirip” → search_menu

“hai/halo” → tidak panggil tool

E. UI Tombol (Quick Replies)

Untuk kondisi ambigu “rekomenin menu dong”, UI harus tampilkan tombol:

Makan pagi

Makan siang

Snack

Minuman
Tambahan tombol opsional:

“Budget 10k”

“Budget 20k”

“Tanpa budget”

Implementasi:

Saat user klik tombol, kirim message text sama persis (misal “Minuman”) atau payload structured.

Chat server menambahkan ke prompt bahwa itu “pilihan kategori”.

F. Security (wajib)

Tools API pakai service role key di server saja.

Tools API hanya mengizinkan query SELECT / view v_menu_stats.

Rate limit endpoint tools.

Logging: simpan user_id, query, tool_called, result_count.

G. Acceptance Tests (wajib lulus)

Buat script test atau checklist manual:

G1) Smalltalk

User: “hai”

Bot: “Halo! Mau pesan apa hari ini? Aku bisa bantu rekomendasi menu 😊”

Bot tidak memanggil tool

G2) Out of scope

User: “jelasin teori relativitas”

Bot: “Maaf aku khusus bantu soal menu/pesanan kantin. Kamu mau cari menu apa?”

Bot tidak memanggil tool

G3) Ambiguous recommend

User: “rekomenin menu dong”

Bot: minta preferensi + tampil tombol kategori

Bot belum panggil tool

G4) Menu by kantin

User: “menu di kios A apa aja”

Bot panggil list_menu_by_kantin(kantin_id=A)

Jika kosong → “Tidak ada menu yang sesuai.”

G5) Cheapest/Priciest

User: “yang termurah di kios A?”

Bot panggil get_cheapest(kantin_id=A)

User: “yang termahal dari semua kios?”

Bot panggil get_priciest()

G6) Under price

User: “minuman di bawah 8000 ada ga”

Bot panggil list_under_price(max_price=8000, kategori=minuman)

jika kosong jawab tidak ada

G7) Combo under budget

User: “kasih list rekomendasi makanan dan minuman budget 20k”

Bot panggil recommend_combo_under_budget(budget=20000)

return combos, tampilkan 5–10 opsi

H. Deliverables (yang harus dibuat)

SQL untuk v_menu_stats

Tools API (6 endpoint) — Edge Functions atau backend

Chat server Gemini + tool definitions + system prompt

UI quick replies

Test checklist + sample conversations