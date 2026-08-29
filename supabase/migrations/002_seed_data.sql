-- Island Coolers Seed Data

-- Loyalty settings
INSERT INTO loyalty_settings (points_per_peso, peso_per_point, min_redemption_points)
VALUES (0.025, 0.1, 100);

-- Categories
INSERT INTO categories (id, name, slug, description, image_url, sort_order) VALUES
  ('a1000001-0001-4000-8000-000000000001', 'Soda Flavors', 'soda-flavors', 'Refreshing fruit-forward sodas', '/images/categories/soda.jpg', 1),
  ('a1000001-0001-4000-8000-000000000002', 'Iced Coffee', 'iced-coffee', 'Cold brew and iced coffee classics', '/images/categories/coffee.jpg', 2),
  ('a1000001-0001-4000-8000-000000000003', 'Matcha', 'matcha', 'Premium ceremonial matcha drinks', '/images/categories/matcha.jpg', 3),
  ('a1000001-0001-4000-8000-000000000004', 'Specials', 'specials', 'Limited-time seasonal creations', '/images/categories/specials.jpg', 4);

-- Products
INSERT INTO products (id, category_id, name, slug, description, base_price, image_url, is_available, is_featured, is_best_seller, is_new, rating, review_count) VALUES
  ('b2000001-0001-4000-8000-000000000001', 'a1000001-0001-4000-8000-000000000001', 'Berry Soda', 'berry-soda', 'Sparkling berry blend with a tropical twist', 85.00, '/images/products/berry-soda.jpg', true, true, true, false, 4.8, 124),
  ('b2000001-0001-4000-8000-000000000002', 'a1000001-0001-4000-8000-000000000001', 'Mango Sparkle', 'mango-sparkle', 'Ripe mango soda with a citrus kick', 85.00, '/images/products/mango-sparkle.jpg', true, true, true, false, 4.7, 98),
  ('b2000001-0001-4000-8000-000000000003', 'a1000001-0001-4000-8000-000000000001', 'Lychee Fizz', 'lychee-fizz', 'Delicate lychee sparkling cooler', 90.00, '/images/products/lychee-fizz.jpg', true, false, true, true, 4.9, 76),
  ('b2000001-0001-4000-8000-000000000004', 'a1000001-0001-4000-8000-000000000001', 'Passion Punch', 'passion-punch', 'Tangy passionfruit soda sensation', 90.00, '/images/products/passion-punch.jpg', true, false, false, false, 4.6, 54),
  ('b2000001-0001-4000-8000-000000000005', 'a1000001-0001-4000-8000-000000000002', 'Classic Iced Coffee', 'classic-iced-coffee', 'Smooth cold brew over ice', 95.00, '/images/products/iced-coffee.jpg', true, true, true, false, 4.8, 210),
  ('b2000001-0001-4000-8000-000000000006', 'a1000001-0001-4000-8000-000000000002', 'Caramel Cold Brew', 'caramel-cold-brew', 'Cold brew with house caramel drizzle', 110.00, '/images/products/caramel-cold-brew.jpg', true, true, true, false, 4.9, 185),
  ('b2000001-0001-4000-8000-000000000007', 'a1000001-0001-4000-8000-000000000002', 'Vanilla Latte Ice', 'vanilla-latte-ice', 'Iced latte with Madagascar vanilla', 115.00, '/images/products/vanilla-latte.jpg', true, false, false, false, 4.5, 67),
  ('b2000001-0001-4000-8000-000000000008', 'a1000001-0001-4000-8000-000000000003', 'Matcha Latte', 'matcha-latte', 'Ceremonial grade matcha with creamy milk', 120.00, '/images/products/matcha-latte.jpg', true, true, true, false, 4.9, 156),
  ('b2000001-0001-4000-8000-000000000009', 'a1000001-0001-4000-8000-000000000003', 'Iced Matcha', 'iced-matcha', 'Refreshing iced ceremonial matcha', 110.00, '/images/products/iced-matcha.jpg', true, false, true, false, 4.7, 89),
  ('b2000001-0001-4000-8000-000000000010', 'a1000001-0001-4000-8000-000000000003', 'Strawberry Matcha', 'strawberry-matcha', 'Matcha layered with fresh strawberry', 130.00, '/images/products/strawberry-matcha.jpg', true, true, false, true, 4.8, 72),
  ('b2000001-0001-4000-8000-000000000011', 'a1000001-0001-4000-8000-000000000004', 'Island Sunset', 'island-sunset', 'Layered tropical soda special', 100.00, '/images/products/island-sunset.jpg', true, true, false, true, 4.9, 41),
  ('b2000001-0001-4000-8000-000000000012', 'a1000001-0001-4000-8000-000000000004', 'Coco Matcha Chill', 'coco-matcha-chill', 'Coconut milk matcha cooler', 135.00, '/images/products/coco-matcha.jpg', true, false, false, true, 4.6, 28);

-- Product options (Size, Ice, Sweetness for all drinks)
DO $$
DECLARE
  pid UUID;
  size_opt UUID;
  ice_opt UUID;
  sweet_opt UUID;
BEGIN
  FOR pid IN SELECT id FROM products LOOP
    INSERT INTO product_options (id, product_id, name, display_name, is_required, sort_order)
    VALUES (gen_random_uuid(), pid, 'size', 'Size', true, 1) RETURNING id INTO size_opt;

    INSERT INTO product_option_values (option_id, name, price_adjustment, is_default, sort_order) VALUES
      (size_opt, 'Regular', 0, true, 1),
      (size_opt, 'Large', 20, false, 2);

    INSERT INTO product_options (id, product_id, name, display_name, is_required, sort_order)
    VALUES (gen_random_uuid(), pid, 'ice', 'Ice', true, 2) RETURNING id INTO ice_opt;

    INSERT INTO product_option_values (option_id, name, price_adjustment, is_default, sort_order) VALUES
      (ice_opt, 'Regular', 0, true, 1),
      (ice_opt, 'Less Ice', 0, false, 2),
      (ice_opt, 'No Ice', 0, false, 3);

    INSERT INTO product_options (id, product_id, name, display_name, is_required, sort_order)
    VALUES (gen_random_uuid(), pid, 'sweetness', 'Sweetness', true, 3) RETURNING id INTO sweet_opt;

    INSERT INTO product_option_values (option_id, name, price_adjustment, is_default, sort_order) VALUES
      (sweet_opt, '100%', 0, true, 1),
      (sweet_opt, '75%', 0, false, 2),
      (sweet_opt, '50%', 0, false, 3),
      (sweet_opt, '25%', 0, false, 4),
      (sweet_opt, '0%', 0, false, 5);
  END LOOP;
END $$;

-- Global add-ons
INSERT INTO product_addons (id, product_id, name, description, price, is_global, sort_order) VALUES
  ('c3000001-0001-4000-8000-000000000001', NULL, 'Extra Pearls', 'Chewy tapioca pearls', 15.00, true, 1),
  ('c3000001-0001-4000-8000-000000000002', NULL, 'Lychee Jelly', 'Sweet lychee jelly cubes', 15.00, true, 2),
  ('c3000001-0001-4000-8000-000000000003', NULL, 'Extra Shot', 'Extra espresso or matcha shot', 25.00, true, 3),
  ('c3000001-0001-4000-8000-000000000004', NULL, 'Whipped Cream', 'House whipped cream topping', 20.00, true, 4),
  ('c3000001-0001-4000-8000-000000000005', NULL, 'Extra Syrup', 'Additional flavored syrup', 10.00, true, 5);

-- Inventory
INSERT INTO inventory_items (id, name, sku, unit, current_quantity, minimum_stock, cost_per_unit, supplier) VALUES
  ('d4000001-0001-4000-8000-000000000001', 'Coffee Beans', 'INV-COFFEE', 'g', 5000, 500, 0.85, 'Local Roasters Co'),
  ('d4000001-0001-4000-8000-000000000002', 'Matcha Powder', 'INV-MATCHA', 'g', 2000, 200, 2.50, 'Kyoto Imports'),
  ('d4000001-0001-4000-8000-000000000003', 'Milk', 'INV-MILK', 'ml', 20000, 2000, 0.05, 'Fresh Farms'),
  ('d4000001-0001-4000-8000-000000000004', 'Soda Syrup', 'INV-SODA', 'ml', 10000, 1000, 0.12, 'Flavor House'),
  ('d4000001-0001-4000-8000-000000000005', 'Fruit Syrup', 'INV-FRUIT', 'ml', 8000, 800, 0.15, 'Flavor House'),
  ('d4000001-0001-4000-8000-000000000006', 'Pearls', 'INV-PEARLS', 'g', 3000, 300, 0.20, 'Boba Supply'),
  ('d4000001-0001-4000-8000-000000000007', 'Jelly', 'INV-JELLY', 'g', 2500, 250, 0.18, 'Boba Supply'),
  ('d4000001-0001-4000-8000-000000000008', 'Ice', 'INV-ICE', 'g', 50000, 5000, 0.01, 'In-house'),
  ('d4000001-0001-4000-8000-000000000009', 'Cups', 'INV-CUPS', 'pcs', 2000, 200, 2.00, 'Packaging Pro'),
  ('d4000001-0001-4000-8000-000000000010', 'Lids', 'INV-LIDS', 'pcs', 2000, 200, 0.50, 'Packaging Pro'),
  ('d4000001-0001-4000-8000-000000000011', 'Straws', 'INV-STRAWS', 'pcs', 3000, 300, 0.30, 'Packaging Pro');

-- Sample recipes
INSERT INTO product_recipes (product_id, inventory_item_id, quantity_required) VALUES
  ('b2000001-0001-4000-8000-000000000005', 'd4000001-0001-4000-8000-000000000001', 18),
  ('b2000001-0001-4000-8000-000000000005', 'd4000001-0001-4000-8000-000000000003', 150),
  ('b2000001-0001-4000-8000-000000000005', 'd4000001-0001-4000-8000-000000000008', 200),
  ('b2000001-0001-4000-8000-000000000005', 'd4000001-0001-4000-8000-000000000009', 1),
  ('b2000001-0001-4000-8000-000000000005', 'd4000001-0001-4000-8000-000000000010', 1),
  ('b2000001-0001-4000-8000-000000000008', 'd4000001-0001-4000-8000-000000000002', 5),
  ('b2000001-0001-4000-8000-000000000008', 'd4000001-0001-4000-8000-000000000003', 200),
  ('b2000001-0001-4000-8000-000000000008', 'd4000001-0001-4000-8000-000000000008', 150),
  ('b2000001-0001-4000-8000-000000000008', 'd4000001-0001-4000-8000-000000000009', 1),
  ('b2000001-0001-4000-8000-000000000008', 'd4000001-0001-4000-8000-000000000010', 1),
  ('b2000001-0001-4000-8000-000000000001', 'd4000001-0001-4000-8000-000000000004', 50),
  ('b2000001-0001-4000-8000-000000000001', 'd4000001-0001-4000-8000-000000000005', 30),
  ('b2000001-0001-4000-8000-000000000001', 'd4000001-0001-4000-8000-000000000008', 200),
  ('b2000001-0001-4000-8000-000000000001', 'd4000001-0001-4000-8000-000000000009', 1),
  ('b2000001-0001-4000-8000-000000000001', 'd4000001-0001-4000-8000-000000000010', 1);

-- Rewards
INSERT INTO rewards (id, name, description, type, points_required, discount_value, is_active, sort_order) VALUES
  ('e5000001-0001-4000-8000-000000000001', '₱10 OFF', 'Get ₱10 off your next order', 'POINTS_DISCOUNT', 100, 10.00, true, 1),
  ('e5000001-0001-4000-8000-000000000002', '₱25 OFF', 'Get ₱25 off your next order', 'POINTS_DISCOUNT', 250, 25.00, true, 2),
  ('e5000001-0001-4000-8000-000000000003', '₱50 OFF', 'Get ₱50 off your next order', 'POINTS_DISCOUNT', 500, 50.00, true, 3),
  ('e5000001-0001-4000-8000-000000000004', 'Free Drink', 'Redeem a free Regular drink', 'FREE_PRODUCT', 1000, NULL, true, 4);

-- Promotions
INSERT INTO promotions (id, name, description, promo_code, type, discount_value, min_order_amount, starts_at, ends_at, is_active) VALUES
  ('f6000001-0001-4000-8000-000000000001', 'Welcome Offer', '10% off your first order', 'WELCOME10', 'PERCENTAGE', 10, 100, NOW() - INTERVAL '1 day', NOW() + INTERVAL '90 days', true),
  ('f6000001-0001-4000-8000-000000000002', 'Summer Cool', '₱30 off orders over ₱200', 'SUMMER30', 'FIXED', 30, 200, NOW() - INTERVAL '1 day', NOW() + INTERVAL '60 days', true);

-- App settings
INSERT INTO app_settings (key, value) VALUES
  ('store', '{"name":"Island Coolers","address":"123 Beach Road, Cebu City","phone":"+63 917 123 4567","lat":10.3157,"lng":123.8854,"hours":"9:00 AM - 9:00 PM"}'),
  ('delivery', '{"fee":49,"free_above":500,"radius_km":10,"estimated_minutes":30}'),
  ('proof_of_delivery', '{"enabled":true,"require_pin":true,"require_photo":false,"require_signature":false}'),
  ('inventory_strategy', '{"deduct_on":"DELIVERED","reserve_on_order":false}');
