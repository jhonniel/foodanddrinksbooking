-- Island Coolers — Complete Database Schema
-- Run this in Supabase SQL Editor or via supabase db push

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_role AS ENUM (
  'CUSTOMER',
  'STAFF',
  'MANAGER',
  'ADMIN',
  'SUPER_ADMIN',
  'DRIVER'
);

CREATE TYPE order_status AS ENUM (
  'PENDING',
  'CONFIRMED',
  'PREPARING',
  'READY',
  'ASSIGNED',
  'PICKED_UP',
  'OUT_FOR_DELIVERY',
  'ARRIVED',
  'DELIVERED',
  'CANCELLED'
);

CREATE TYPE order_type AS ENUM ('DELIVERY', 'PICKUP');

CREATE TYPE payment_status AS ENUM (
  'PENDING',
  'PAID',
  'FAILED',
  'REFUNDED',
  'CANCELLED'
);

CREATE TYPE payment_method AS ENUM (
  'COD',
  'GCASH',
  'CARD',
  'ONLINE'
);

CREATE TYPE driver_status AS ENUM (
  'ONLINE',
  'OFFLINE',
  'BUSY',
  'SUSPENDED'
);

CREATE TYPE delivery_status AS ENUM (
  'PENDING',
  'ASSIGNED',
  'ACCEPTED',
  'PICKED_UP',
  'IN_TRANSIT',
  'ARRIVED',
  'DELIVERED',
  'CANCELLED'
);

CREATE TYPE points_transaction_type AS ENUM (
  'EARNED',
  'REDEEMED',
  'ADJUSTED',
  'EXPIRED',
  'BONUS'
);

CREATE TYPE reward_type AS ENUM (
  'POINTS_DISCOUNT',
  'PERCENTAGE_DISCOUNT',
  'FIXED_DISCOUNT',
  'FREE_PRODUCT',
  'PROMOTIONAL'
);

CREATE TYPE promotion_type AS ENUM (
  'PERCENTAGE',
  'FIXED',
  'FREE_ITEM',
  'BUY_X_GET_Y',
  'PROMO_CODE'
);

CREATE TYPE inventory_unit AS ENUM (
  'g',
  'ml',
  'pcs',
  'kg',
  'L'
);

CREATE TYPE inventory_tx_type AS ENUM (
  'PURCHASE',
  'ADJUSTMENT',
  'DEDUCTION',
  'RETURN',
  'WASTE'
);

CREATE TYPE notification_type AS ENUM (
  'ORDER',
  'DELIVERY',
  'POINTS',
  'REWARD',
  'PROMOTION',
  'SYSTEM',
  'INVENTORY'
);

-- ============================================================
-- CORE TABLES
-- ============================================================

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  role user_role NOT NULL DEFAULT 'CUSTOMER',
  is_active BOOLEAN NOT NULL DEFAULT true,
  points_balance INTEGER NOT NULL DEFAULT 0,
  lifetime_points INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT 'Home',
  full_address TEXT NOT NULL,
  barangay TEXT,
  city TEXT,
  province TEXT,
  postal_code TEXT,
  latitude DECIMAL(10, 7),
  longitude DECIMAL(10, 7),
  delivery_instructions TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_addresses_customer ON addresses(customer_id);

-- ============================================================
-- CATALOG
-- ============================================================

CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  image_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES categories(id),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  base_price DECIMAL(10, 2) NOT NULL,
  image_url TEXT,
  sku TEXT,
  is_available BOOLEAN NOT NULL DEFAULT true,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  is_best_seller BOOLEAN NOT NULL DEFAULT false,
  is_new BOOLEAN NOT NULL DEFAULT false,
  preparation_time_minutes INTEGER DEFAULT 10,
  rating DECIMAL(3, 2) DEFAULT 4.5,
  review_count INTEGER DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_available ON products(is_available);
CREATE INDEX idx_products_featured ON products(is_featured) WHERE is_featured = true;
CREATE INDEX idx_products_best_seller ON products(is_best_seller) WHERE is_best_seller = true;

CREATE TABLE product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  alt_text TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE product_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  is_required BOOLEAN NOT NULL DEFAULT true,
  min_selections INTEGER NOT NULL DEFAULT 1,
  max_selections INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE product_option_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  option_id UUID NOT NULL REFERENCES product_options(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price_adjustment DECIMAL(10, 2) NOT NULL DEFAULT 0,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_available BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE product_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  is_available BOOLEAN NOT NULL DEFAULT true,
  is_global BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INVENTORY
-- ============================================================

CREATE TABLE inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sku TEXT,
  unit inventory_unit NOT NULL DEFAULT 'pcs',
  current_quantity DECIMAL(12, 3) NOT NULL DEFAULT 0,
  minimum_stock DECIMAL(12, 3) NOT NULL DEFAULT 0,
  cost_per_unit DECIMAL(10, 2) DEFAULT 0,
  supplier TEXT,
  last_restocked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE inventory_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id),
  type inventory_tx_type NOT NULL,
  quantity DECIMAL(12, 3) NOT NULL,
  previous_quantity DECIMAL(12, 3) NOT NULL,
  new_quantity DECIMAL(12, 3) NOT NULL,
  reference_type TEXT,
  reference_id UUID,
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_inventory_tx_item ON inventory_transactions(inventory_item_id);

CREATE TABLE product_recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id),
  quantity_required DECIMAL(12, 3) NOT NULL,
  option_value_id UUID REFERENCES product_option_values(id),
  addon_id UUID REFERENCES product_addons(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(product_id, inventory_item_id, option_value_id, addon_id)
);

CREATE TABLE inventory_deductions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  deducted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(order_id)
);

-- ============================================================
-- ORDERS
-- ============================================================

CREATE SEQUENCE order_number_seq START 10000;

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE DEFAULT ('IC' || nextval('order_number_seq')::TEXT),
  customer_id UUID NOT NULL REFERENCES profiles(id),
  status order_status NOT NULL DEFAULT 'PENDING',
  order_type order_type NOT NULL DEFAULT 'DELIVERY',
  subtotal DECIMAL(10, 2) NOT NULL,
  delivery_fee DECIMAL(10, 2) NOT NULL DEFAULT 0,
  discount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  points_discount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  tax DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total DECIMAL(10, 2) NOT NULL,
  payment_status payment_status NOT NULL DEFAULT 'PENDING',
  payment_method payment_method,
  delivery_address_id UUID REFERENCES addresses(id),
  delivery_address_snapshot JSONB,
  delivery_instructions TEXT,
  driver_id UUID REFERENCES profiles(id),
  promotion_id UUID,
  points_earned INTEGER NOT NULL DEFAULT 0,
  points_used INTEGER NOT NULL DEFAULT 0,
  estimated_prep_minutes INTEGER DEFAULT 15,
  idempotency_key TEXT UNIQUE,
  notes TEXT,
  cancelled_reason TEXT,
  confirmed_at TIMESTAMPTZ,
  preparing_at TIMESTAMPTZ,
  ready_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created ON orders(created_at DESC);
CREATE INDEX idx_orders_driver ON orders(driver_id) WHERE driver_id IS NOT NULL;

CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  product_name TEXT NOT NULL,
  product_image_url TEXT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(10, 2) NOT NULL,
  total_price DECIMAL(10, 2) NOT NULL,
  special_instructions TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_order_items_order ON order_items(order_id);

CREATE TABLE order_item_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  option_name TEXT NOT NULL,
  value_name TEXT NOT NULL,
  price_adjustment DECIMAL(10, 2) NOT NULL DEFAULT 0
);

CREATE TABLE order_item_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  addon_name TEXT NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_status order_status,
  to_status order_status NOT NULL,
  changed_by UUID REFERENCES profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_order_status_history ON order_status_history(order_id);

-- ============================================================
-- PAYMENTS
-- ============================================================

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id),
  provider TEXT NOT NULL,
  provider_transaction_id TEXT,
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'PHP',
  status payment_status NOT NULL DEFAULT 'PENDING',
  method payment_method NOT NULL,
  metadata JSONB DEFAULT '{}',
  idempotency_key TEXT UNIQUE,
  paid_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_order ON payments(order_id);

-- ============================================================
-- DRIVERS & DELIVERY
-- ============================================================

CREATE TABLE drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  vehicle_type TEXT NOT NULL DEFAULT 'Motorcycle',
  vehicle_number TEXT,
  license_number TEXT,
  status driver_status NOT NULL DEFAULT 'OFFLINE',
  rating DECIMAL(3, 2) DEFAULT 5.0,
  total_deliveries INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE driver_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  latitude DECIMAL(10, 7) NOT NULL,
  longitude DECIMAL(10, 7) NOT NULL,
  heading DECIMAL(5, 2),
  speed DECIMAL(6, 2),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_driver_locations_driver ON driver_locations(driver_id, recorded_at DESC);

CREATE TABLE delivery_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES orders(id),
  driver_id UUID REFERENCES drivers(id),
  status delivery_status NOT NULL DEFAULT 'PENDING',
  customer_latitude DECIMAL(10, 7),
  customer_longitude DECIMAL(10, 7),
  store_latitude DECIMAL(10, 7),
  store_longitude DECIMAL(10, 7),
  estimated_arrival TIMESTAMPTZ,
  distance_km DECIMAL(6, 2),
  delivery_fee DECIMAL(10, 2),
  delivery_pin TEXT,
  proof_photo_url TEXT,
  proof_signature_url TEXT,
  assigned_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  picked_up_at TIMESTAMPTZ,
  arrived_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_delivery_orders_driver ON delivery_orders(driver_id);
CREATE INDEX idx_delivery_orders_status ON delivery_orders(status);

-- ============================================================
-- LOYALTY
-- ============================================================

CREATE TABLE loyalty_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  points_per_peso DECIMAL(6, 4) NOT NULL DEFAULT 1.0,
  peso_per_point DECIMAL(6, 4) NOT NULL DEFAULT 0.1,
  min_redemption_points INTEGER NOT NULL DEFAULT 100,
  points_expiry_days INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  type reward_type NOT NULL,
  points_required INTEGER NOT NULL,
  discount_value DECIMAL(10, 2),
  free_product_id UUID REFERENCES products(id),
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  max_redemptions INTEGER,
  current_redemptions INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE points_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES profiles(id),
  order_id UUID REFERENCES orders(id),
  reward_id UUID REFERENCES rewards(id),
  type points_transaction_type NOT NULL,
  points INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  description TEXT,
  idempotency_key TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_points_tx_customer ON points_transactions(customer_id, created_at DESC);

CREATE TABLE reward_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES profiles(id),
  reward_id UUID NOT NULL REFERENCES rewards(id),
  order_id UUID REFERENCES orders(id),
  points_spent INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PROMOTIONS
-- ============================================================

CREATE TABLE promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  promo_code TEXT UNIQUE,
  type promotion_type NOT NULL,
  discount_value DECIMAL(10, 2) NOT NULL,
  min_order_amount DECIMAL(10, 2) DEFAULT 0,
  max_discount DECIMAL(10, 2),
  usage_limit INTEGER,
  usage_count INTEGER NOT NULL DEFAULT 0,
  per_customer_limit INTEGER DEFAULT 1,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE promotion_usages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id UUID NOT NULL REFERENCES promotions(id),
  customer_id UUID NOT NULL REFERENCES profiles(id),
  order_id UUID NOT NULL REFERENCES orders(id),
  discount_applied DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE voucher_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id UUID NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (promotion_id, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_voucher_claims_customer
  ON voucher_claims (customer_id);

CREATE INDEX IF NOT EXISTS idx_voucher_claims_promotion
  ON voucher_claims (promotion_id);

-- ============================================================
-- ENGAGEMENT
-- ============================================================

CREATE TABLE favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(customer_id, product_id)
);

CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES profiles(id),
  product_id UUID NOT NULL REFERENCES products(id),
  order_id UUID REFERENCES orders(id),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications(user_id) WHERE is_read = false;

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  metadata JSONB DEFAULT '{}',
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);

CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_profiles_updated BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_addresses_updated BEFORE UPDATE ON addresses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_categories_updated BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_products_updated BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_inventory_updated BEFORE UPDATE ON inventory_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_orders_updated BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_payments_updated BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_drivers_updated BEFORE UPDATE ON drivers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_delivery_updated BEFORE UPDATE ON delivery_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_rewards_updated BEFORE UPDATE ON rewards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_promotions_updated BEFORE UPDATE ON promotions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'CUSTOMER')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Record order status changes
CREATE OR REPLACE FUNCTION log_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO order_status_history (order_id, from_status, to_status)
    VALUES (NEW.id, OLD.status, NEW.status);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_order_status_change
  AFTER UPDATE OF status ON orders
  FOR EACH ROW EXECUTE FUNCTION log_order_status_change();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_option_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_item_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_item_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE points_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reward_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Helper: get current user role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_staff_or_above()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('STAFF', 'MANAGER', 'ADMIN', 'SUPER_ADMIN')
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_admin_or_above()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('ADMIN', 'SUPER_ADMIN')
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Profiles
CREATE POLICY "Users can read own profile" ON profiles
  FOR SELECT USING (id = auth.uid() OR is_staff_or_above());
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (id = auth.uid());
CREATE POLICY "Admins can manage profiles" ON profiles
  FOR ALL USING (is_admin_or_above());

-- Addresses
CREATE POLICY "Customers manage own addresses" ON addresses
  FOR ALL USING (customer_id = auth.uid());
CREATE POLICY "Staff can read addresses" ON addresses
  FOR SELECT USING (is_staff_or_above());

-- Catalog (public read)
CREATE POLICY "Anyone can read active categories" ON categories
  FOR SELECT USING (is_active = true OR is_staff_or_above());
CREATE POLICY "Staff manage categories" ON categories
  FOR ALL USING (is_staff_or_above());

CREATE POLICY "Anyone can read available products" ON products
  FOR SELECT USING (is_available = true OR is_staff_or_above());
CREATE POLICY "Staff manage products" ON products
  FOR ALL USING (is_staff_or_above());

CREATE POLICY "Anyone can read product images" ON product_images FOR SELECT USING (true);
CREATE POLICY "Staff manage product images" ON product_images FOR ALL USING (is_staff_or_above());

CREATE POLICY "Anyone can read product options" ON product_options FOR SELECT USING (true);
CREATE POLICY "Staff manage product options" ON product_options FOR ALL USING (is_staff_or_above());

CREATE POLICY "Anyone can read option values" ON product_option_values FOR SELECT USING (true);
CREATE POLICY "Staff manage option values" ON product_option_values FOR ALL USING (is_staff_or_above());

CREATE POLICY "Anyone can read addons" ON product_addons FOR SELECT USING (true);
CREATE POLICY "Staff manage addons" ON product_addons FOR ALL USING (is_staff_or_above());

-- Inventory (staff only)
CREATE POLICY "Staff manage inventory" ON inventory_items FOR ALL USING (is_staff_or_above());
CREATE POLICY "Staff manage inventory tx" ON inventory_transactions FOR ALL USING (is_staff_or_above());
CREATE POLICY "Staff manage recipes" ON product_recipes FOR ALL USING (is_staff_or_above());

-- Orders
CREATE POLICY "Customers read own orders" ON orders
  FOR SELECT USING (customer_id = auth.uid() OR is_staff_or_above() OR driver_id = auth.uid());
CREATE POLICY "Customers create orders" ON orders
  FOR INSERT WITH CHECK (customer_id = auth.uid());
CREATE POLICY "Staff update orders" ON orders
  FOR UPDATE USING (is_staff_or_above() OR driver_id = auth.uid());

CREATE POLICY "Order items via order access" ON order_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM orders o WHERE o.id = order_id AND (o.customer_id = auth.uid() OR is_staff_or_above() OR o.driver_id = auth.uid()))
  );
CREATE POLICY "Customers insert order items" ON order_items
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM orders o WHERE o.id = order_id AND o.customer_id = auth.uid())
  );

CREATE POLICY "Order item options access" ON order_item_options
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE oi.id = order_item_id AND (o.customer_id = auth.uid() OR is_staff_or_above())
    )
  );
CREATE POLICY "Order item options insert" ON order_item_options
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Order item addons access" ON order_item_addons
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE oi.id = order_item_id AND (o.customer_id = auth.uid() OR is_staff_or_above())
    )
  );
CREATE POLICY "Order item addons insert" ON order_item_addons
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Order status history read" ON order_status_history
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM orders o WHERE o.id = order_id AND (o.customer_id = auth.uid() OR is_staff_or_above()))
  );

-- Payments
CREATE POLICY "Customers read own payments" ON payments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM orders o WHERE o.id = order_id AND (o.customer_id = auth.uid() OR is_staff_or_above()))
  );
CREATE POLICY "Staff manage payments" ON payments
  FOR ALL USING (is_staff_or_above());

-- Drivers
CREATE POLICY "Drivers read own record" ON drivers
  FOR SELECT USING (profile_id = auth.uid() OR is_staff_or_above());
CREATE POLICY "Drivers update own status" ON drivers
  FOR UPDATE USING (profile_id = auth.uid() OR is_staff_or_above());
CREATE POLICY "Admins manage drivers" ON drivers
  FOR ALL USING (is_admin_or_above());

CREATE POLICY "Drivers update own location" ON driver_locations
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM drivers d WHERE d.id = driver_id AND d.profile_id = auth.uid())
  );
CREATE POLICY "Staff/drivers read locations" ON driver_locations
  FOR SELECT USING (
    is_staff_or_above() OR
    EXISTS (SELECT 1 FROM drivers d WHERE d.id = driver_id AND d.profile_id = auth.uid())
  );

-- Delivery
CREATE POLICY "Delivery access" ON delivery_orders
  FOR SELECT USING (
    is_staff_or_above() OR
    EXISTS (SELECT 1 FROM drivers d WHERE d.id = driver_id AND d.profile_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM orders o WHERE o.id = order_id AND o.customer_id = auth.uid())
  );
CREATE POLICY "Staff/drivers update delivery" ON delivery_orders
  FOR UPDATE USING (
    is_staff_or_above() OR
    EXISTS (SELECT 1 FROM drivers d WHERE d.id = driver_id AND d.profile_id = auth.uid())
  );
CREATE POLICY "Staff create delivery" ON delivery_orders
  FOR INSERT WITH CHECK (is_staff_or_above());

-- Loyalty
CREATE POLICY "Anyone read loyalty settings" ON loyalty_settings FOR SELECT USING (true);
CREATE POLICY "Admins manage loyalty settings" ON loyalty_settings FOR ALL USING (is_admin_or_above());

CREATE POLICY "Anyone read active rewards" ON rewards
  FOR SELECT USING (is_active = true OR is_staff_or_above());
CREATE POLICY "Staff manage rewards" ON rewards FOR ALL USING (is_staff_or_above());

CREATE POLICY "Customers read own points" ON points_transactions
  FOR SELECT USING (customer_id = auth.uid() OR is_staff_or_above());

CREATE POLICY "Customers read own redemptions" ON reward_redemptions
  FOR SELECT USING (customer_id = auth.uid() OR is_staff_or_above());

-- Promotions
CREATE POLICY "Anyone read active promotions" ON promotions
  FOR SELECT USING (is_active = true OR is_staff_or_above());
CREATE POLICY "Staff manage promotions" ON promotions FOR ALL USING (is_staff_or_above());

-- Favorites
CREATE POLICY "Customers manage favorites" ON favorites
  FOR ALL USING (customer_id = auth.uid());

-- Reviews
CREATE POLICY "Anyone read reviews" ON reviews FOR SELECT USING (true);
CREATE POLICY "Customers create reviews" ON reviews
  FOR INSERT WITH CHECK (customer_id = auth.uid());

-- Notifications
CREATE POLICY "Users manage own notifications" ON notifications
  FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Staff create notifications" ON notifications
  FOR INSERT WITH CHECK (is_staff_or_above());

-- Audit
CREATE POLICY "Admins read audit logs" ON audit_logs
  FOR SELECT USING (is_admin_or_above());

-- Settings
CREATE POLICY "Anyone read app settings" ON app_settings FOR SELECT USING (true);
CREATE POLICY "Admins manage settings" ON app_settings FOR ALL USING (is_admin_or_above());

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE delivery_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE driver_locations;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE order_status_history;
-- Island Coolers Seed Data

-- Loyalty settings
INSERT INTO loyalty_settings (points_per_peso, peso_per_point, min_redemption_points)
VALUES (1.0, 0.1, 100);

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
-- Harden public signup: always create CUSTOMER profiles.
-- Staff/driver roles must be assigned by admins (service role / admin UI).

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, phone, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NULLIF(NEW.raw_user_meta_data->>'phone', ''),
    'CUSTOMER'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Prevent non-admins from escalating their own role via client updates
CREATE OR REPLACE FUNCTION prevent_self_role_escalation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF NOT is_admin_or_above() THEN
      RAISE EXCEPTION 'Only admins can change user roles';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_prevent_role_escalation ON profiles;
CREATE TRIGGER tr_prevent_role_escalation
  BEFORE UPDATE OF role ON profiles
  FOR EACH ROW EXECUTE FUNCTION prevent_self_role_escalation();
-- Maintenance mode setting + allow service-role role updates (auth.uid() is null).

INSERT INTO app_settings (key, value, updated_at)
VALUES ('maintenance_mode', 'false'::jsonb, NOW())
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION prevent_self_role_escalation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    -- Service role / backend (no JWT) may change roles.
    -- Authenticated non-admins may not escalate.
    IF auth.uid() IS NOT NULL AND NOT is_admin_or_above() THEN
      RAISE EXCEPTION 'Only admins can change user roles';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
