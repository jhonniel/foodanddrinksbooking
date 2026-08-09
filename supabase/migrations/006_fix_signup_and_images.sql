-- Fix Auth signup: "Database error saving/creating new user"
-- Cause: handle_new_user trigger often fails under RLS without search_path.
-- Run in Supabase SQL Editor, then try Register again.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, phone, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NULLIF(NEW.raw_user_meta_data->>'phone', ''),
    'CUSTOMER'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    phone = COALESCE(EXCLUDED.phone, public.profiles.phone),
    updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Ensure trigger exists (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill any auth users missing a profile
INSERT INTO public.profiles (id, email, full_name, phone, role)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
  NULLIF(u.raw_user_meta_data->>'phone', ''),
  'CUSTOMER'
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- Fix catalog images (seed used local paths that are not in the Vercel build)
UPDATE public.categories SET image_url = CASE slug
  WHEN 'soda-flavors' THEN 'https://images.unsplash.com/photo-1625772299848-391b6a87d7b3?w=600&h=400&fit=crop'
  WHEN 'iced-coffee' THEN 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=600&h=400&fit=crop'
  WHEN 'matcha' THEN 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?w=600&h=400&fit=crop'
  WHEN 'specials' THEN 'https://images.unsplash.com/photo-1546173159-315724a31696?w=600&h=400&fit=crop'
  ELSE image_url
END;

UPDATE public.products SET image_url = CASE slug
  WHEN 'berry-soda' THEN 'https://images.unsplash.com/photo-1625772299848-391b6a87d7b3?w=600&h=600&fit=crop'
  WHEN 'mango-sparkle' THEN 'https://images.unsplash.com/photo-1546173159-315724a31696?w=600&h=600&fit=crop'
  WHEN 'lychee-fizz' THEN 'https://images.unsplash.com/photo-1622597467836-f3285f2131b8?w=600&h=600&fit=crop'
  WHEN 'passion-punch' THEN 'https://images.unsplash.com/photo-1497534446932-c925b458314e?w=600&h=600&fit=crop'
  WHEN 'classic-iced-coffee' THEN 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=600&h=600&fit=crop'
  WHEN 'caramel-cold-brew' THEN 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?w=600&h=600&fit=crop'
  WHEN 'vanilla-latte-ice' THEN 'https://images.unsplash.com/photo-1578314675249-a69196f55f98?w=600&h=600&fit=crop'
  WHEN 'matcha-latte' THEN 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?w=600&h=600&fit=crop'
  WHEN 'iced-matcha' THEN 'https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=600&h=600&fit=crop'
  WHEN 'strawberry-matcha' THEN 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=600&h=600&fit=crop'
  WHEN 'island-sunset' THEN 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=600&h=600&fit=crop'
  WHEN 'coco-matcha-chill' THEN 'https://images.unsplash.com/photo-1515823064-d6e0c04616a5?w=600&h=600&fit=crop'
  ELSE image_url
END
WHERE image_url IS NULL OR image_url LIKE '/%';
