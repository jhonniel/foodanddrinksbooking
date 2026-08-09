-- Storage buckets for product images, avatars, and delivery proof photos.
-- Run in Supabase SQL editor after 001–004.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'product-images',
    'product-images',
    true,
    5242880,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  ),
  (
    'avatars',
    'avatars',
    true,
    2097152,
    ARRAY['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'delivery-proofs',
    'delivery-proofs',
    false,
    5242880,
    ARRAY['image/jpeg', 'image/png', 'image/webp']
  )
ON CONFLICT (id) DO NOTHING;

-- Idempotent policy refresh
DROP POLICY IF EXISTS "Public read product images" ON storage.objects;
DROP POLICY IF EXISTS "Staff upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Staff update product images" ON storage.objects;
DROP POLICY IF EXISTS "Staff delete product images" ON storage.objects;
DROP POLICY IF EXISTS "Public read avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users upload own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users update own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Staff/drivers read delivery proofs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload delivery proofs" ON storage.objects;

-- Public read for product images
CREATE POLICY "Public read product images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');

CREATE POLICY "Staff upload product images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'product-images'
    AND (is_staff_or_above() OR auth.role() = 'service_role')
  );

CREATE POLICY "Staff update product images"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'product-images'
    AND (is_staff_or_above() OR auth.role() = 'service_role')
  );

CREATE POLICY "Staff delete product images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'product-images'
    AND (is_staff_or_above() OR auth.role() = 'service_role')
  );

-- Avatars: public read, owner write
CREATE POLICY "Public read avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Users upload own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR is_staff_or_above()
      OR auth.role() = 'service_role'
    )
  );

CREATE POLICY "Users update own avatar"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR is_staff_or_above()
      OR auth.role() = 'service_role'
    )
  );

-- Delivery proofs: private — staff/drivers only
CREATE POLICY "Staff/drivers read delivery proofs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'delivery-proofs'
    AND (is_staff_or_above() OR auth.role() = 'authenticated')
  );

CREATE POLICY "Authenticated upload delivery proofs"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'delivery-proofs'
    AND auth.role() IN ('authenticated', 'service_role')
  );

-- Prefer Unsplash URLs so seeded catalog images work without static files
UPDATE categories SET image_url = CASE slug
  WHEN 'soda-flavors' THEN 'https://images.unsplash.com/photo-1625772299848-391b6a87d7b3?w=600&h=400&fit=crop'
  WHEN 'iced-coffee' THEN 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=600&h=400&fit=crop'
  WHEN 'matcha' THEN 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?w=600&h=400&fit=crop'
  WHEN 'specials' THEN 'https://images.unsplash.com/photo-1546173159-315724a31696?w=600&h=400&fit=crop'
  ELSE image_url
END;

UPDATE products SET image_url = CASE slug
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
END;
