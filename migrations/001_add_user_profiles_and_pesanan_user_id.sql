-- Migration: Add user_profiles table and user_id to pesanan
-- This migration adds support for customer authentication and order history

-- 1. Create user_profiles table to store customer data
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid NOT NULL PRIMARY KEY,
  email text NOT NULL UNIQUE,
  full_name text,
  avatar_url text,
  phone text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- 2. Add user_id column to pesanan table for order history
ALTER TABLE public.pesanan 
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- 3. Add user_id column to pembayaran table
ALTER TABLE public.pembayaran 
ADD COLUMN IF NOT EXISTS payer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- 4. Create index for faster queries on user_id
CREATE INDEX IF NOT EXISTS idx_pesanan_user_id ON public.pesanan(user_id);
CREATE INDEX IF NOT EXISTS idx_pembayaran_payer_id ON public.pembayaran(payer_id);

-- 5. Create function to automatically create user_profile when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', '')
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, user_profiles.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, user_profiles.avatar_url),
    updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Create trigger to call the function when a new user is created
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 7. Enable Row Level Security (RLS) on user_profiles
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- 8. Create RLS policies for user_profiles
-- Users can read their own profile
CREATE POLICY "Users can view own profile"
  ON public.user_profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON public.user_profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- Users can insert their own profile (via trigger)
CREATE POLICY "Users can insert own profile"
  ON public.user_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- 9. Grant necessary permissions
GRANT SELECT, UPDATE ON public.user_profiles TO authenticated;
GRANT SELECT ON public.user_profiles TO anon;

-- 10. Add comment for documentation
COMMENT ON TABLE public.user_profiles IS 'Stores customer profile information linked to auth.users';
COMMENT ON COLUMN public.pesanan.user_id IS 'Links order to authenticated customer for order history';
