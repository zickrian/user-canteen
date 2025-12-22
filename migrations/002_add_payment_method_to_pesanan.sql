-- Migration: Add payment_method column to pesanan table
-- This migration adds payment_method column to store the payment method used for each order

-- Add payment_method column to pesanan table
ALTER TABLE public.pesanan 
ADD COLUMN IF NOT EXISTS payment_method text CHECK (payment_method IS NULL OR payment_method = ANY (ARRAY['cash'::text, 'qris'::text, 'midtrans'::text]));

-- Add comment for documentation
COMMENT ON COLUMN public.pesanan.payment_method IS 'Metode pembayaran yang digunakan: cash, qris, atau midtrans';

