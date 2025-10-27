-- Tabel untuk menyimpan data kantin
CREATE TABLE IF NOT EXISTS kantins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nama TEXT NOT NULL,
  foto_url TEXT,
  status TEXT CHECK (status IN ('buka', 'tutup')) DEFAULT 'tutup',
  makan_pagi BOOLEAN DEFAULT false,
  makan_siang BOOLEAN DEFAULT false,
  snack BOOLEAN DEFAULT false,
  minuman BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE kantins ENABLE ROW LEVEL SECURITY;

-- Policy untuk membaca data (public access)
CREATE POLICY "Enable read access for all users" 
ON kantins FOR SELECT 
USING (true);

-- Policy untuk insert (jika diperlukan nanti)
CREATE POLICY "Enable insert for authenticated users only" 
ON kantins FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

-- Contoh data dummy (opsional)
INSERT INTO kantins (nama, foto_url, status, makan_pagi, makan_siang, snack, minuman) VALUES
  ('Kantin Sederhana', 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400', 'buka', true, true, false, true),
  ('Warung Bu Tini', 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400', 'buka', true, true, true, true),
  ('Kantin Jaya', 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=400', 'tutup', false, true, false, true),
  ('Depot Merdeka', 'https://images.unsplash.com/photo-1547573854-74d2a71d0826?w=400', 'buka', true, false, true, true),
  ('Kantin Sehat', 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400', 'buka', true, true, false, true),
  ('Warung Pojok', 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400', 'buka', false, true, true, true);
