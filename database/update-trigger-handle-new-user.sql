-- =============================================================================
-- UPDATE TRIGGER: handle_new_user
-- =============================================================================
-- Copy kode di bawah ini dan paste ke Supabase SQL Editor, lalu klik RUN
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_nama_kantin TEXT;
  v_jam_buka TEXT;
  v_jam_tutup TEXT;
BEGIN
  -- Insert ke public.users
  INSERT INTO public.users (id, email, role)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'role', 'kios'))
  ON CONFLICT (id) DO NOTHING;

  -- Buat kantin pending untuk non-admin
  IF NOT EXISTS (SELECT 1 FROM public.admins WHERE user_id = NEW.id) THEN
    -- Ambil data dari metadata registrasi (nama_kantin, jam_buka, jam_tutup)
    v_nama_kantin := COALESCE(
      NEW.raw_user_meta_data->>'nama_kantin',
      CONCAT('Kios ', SPLIT_PART(NEW.email, '@', 1))
    );
    v_jam_buka := COALESCE(NEW.raw_user_meta_data->>'jam_buka', '08:00');
    v_jam_tutup := COALESCE(NEW.raw_user_meta_data->>'jam_tutup', '17:00');
    
    INSERT INTO public.kantin (
      user_id,
      nama_kantin,
      status,
      jam_buka,
      jam_tutup,
      buka_tutup
    )
    VALUES (
      NEW.id,
      v_nama_kantin,
      'pending',
      v_jam_buka,
      v_jam_tutup,
      true
    )
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END $$;
