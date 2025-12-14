-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.cashout (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  kantin_id uuid NOT NULL,
  amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'transferred'::text])),
  cashout_type text NOT NULL DEFAULT 'bank'::text CHECK (cashout_type = ANY (ARRAY['bank'::text, 'gopay'::text, 'shopeefood'::text, 'dana'::text, 'ovo'::text, 'linkaja'::text, 'qris'::text, 'other'::text])),
  destination_number text,
  destination_name text,
  requested_at timestamp with time zone DEFAULT now(),
  transferred_at timestamp with time zone,
  transferred_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT cashout_pkey PRIMARY KEY (id),
  CONSTRAINT cashout_transferred_by_fkey FOREIGN KEY (transferred_by) REFERENCES auth.users(id),
  CONSTRAINT cashout_kantin_id_fkey FOREIGN KEY (kantin_id) REFERENCES public.kantin(id)
);
CREATE TABLE public.detail_pesanan (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  pesanan_id uuid NOT NULL,
  menu_id uuid NOT NULL,
  jumlah integer NOT NULL,
  harga_satuan numeric NOT NULL,
  subtotal numeric NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT detail_pesanan_pkey PRIMARY KEY (id),
  CONSTRAINT detail_pesanan_pesanan_id_fkey FOREIGN KEY (pesanan_id) REFERENCES public.pesanan(id)
);
CREATE TABLE public.kantin (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  nama_kantin text,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'aktif'::text, 'ditolak'::text])),
  foto_profil text,
  jam_buka text,
  jam_tutup text,
  buka_tutup boolean DEFAULT true,
  balance numeric DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT kantin_pkey PRIMARY KEY (id),
  CONSTRAINT kantin_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.menu (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  kantin_id uuid NOT NULL,
  nama_menu text NOT NULL,
  harga numeric NOT NULL,
  foto_menu text,
  deskripsi text,
  tersedia boolean DEFAULT true,
  kategori_menu jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (validate_menu_categories(kategori_menu)),
  total_sold integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT menu_pkey PRIMARY KEY (id),
  CONSTRAINT menu_kantin_id_fkey FOREIGN KEY (kantin_id) REFERENCES public.kantin(id)
);
CREATE TABLE public.pembayaran (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  pesanan_id uuid NOT NULL UNIQUE,
  midtrans_order_id text NOT NULL UNIQUE,
  midtrans_transaction_id text,
  gross_amount numeric NOT NULL,
  payment_type text,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'settlement'::text, 'expire'::text, 'cancel'::text, 'deny'::text])),
  email_pelanggan text,
  nomor_meja text,
  tipe_pesanan text CHECK (tipe_pesanan = ANY (ARRAY['dine_in'::text, 'take_away'::text])),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT pembayaran_pkey PRIMARY KEY (id),
  CONSTRAINT pembayaran_pesanan_id_fkey FOREIGN KEY (pesanan_id) REFERENCES public.pesanan(id)
);
CREATE TABLE public.pesanan (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  kantin_id uuid NOT NULL,
  nomor_antrian integer NOT NULL,
  nama_pemesan text NOT NULL,
  email text,
  nomor_meja text,
  tipe_pesanan text CHECK (tipe_pesanan IS NULL OR (tipe_pesanan = ANY (ARRAY['dine_in'::text, 'take_away'::text]))),
  catatan text,
  total_harga numeric NOT NULL,
  status text NOT NULL DEFAULT 'menunggu'::text CHECK (status = ANY (ARRAY['menunggu'::text, 'diproses'::text, 'selesai'::text])),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT pesanan_pkey PRIMARY KEY (id),
  CONSTRAINT pesanan_kantin_id_fkey FOREIGN KEY (kantin_id) REFERENCES public.kantin(id)
);
CREATE TABLE public.rating (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  pesanan_id uuid NOT NULL,
  menu_id uuid NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  komentar text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT rating_pkey PRIMARY KEY (id),
  CONSTRAINT rating_pesanan_id_fkey FOREIGN KEY (pesanan_id) REFERENCES public.pesanan(id),
  CONSTRAINT rating_menu_id_fkey FOREIGN KEY (menu_id) REFERENCES public.menu(id)
);
CREATE TABLE public.users (
  id uuid NOT NULL,
  email text NOT NULL UNIQUE,
  role text NOT NULL DEFAULT 'kios'::text CHECK (role = ANY (ARRAY['admin'::text, 'kios'::text])),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);