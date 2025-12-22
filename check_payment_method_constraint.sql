-- Script to check payment_method constraint in pesanan table

-- Check constraint definition
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'pesanan'::regclass
AND conname LIKE '%payment%';

-- Check column definition
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'pesanan' 
AND column_name = 'payment_method';

-- Test valid values (should all work)
-- INSERT INTO pesanan (kantin_id, nomor_antrian, nama_pemesan, total_harga, payment_method) 
-- VALUES 
--   ('00000000-0000-0000-0000-000000000000'::uuid, 1, 'Test', 1000, 'cash'),
--   ('00000000-0000-0000-0000-000000000000'::uuid, 2, 'Test', 1000, 'qris'),
--   ('00000000-0000-0000-0000-000000000000'::uuid, 3, 'Test', 1000, 'midtrans'),
--   ('00000000-0000-0000-0000-000000000000'::uuid, 4, 'Test', 1000, NULL);

-- Check recent orders with payment_method
SELECT 
    id,
    payment_method,
    created_at
FROM pesanan
WHERE payment_method IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;

