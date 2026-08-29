-- Run once in Supabase → SQL Editor if you see errors about missing
-- promotions.kind, promotions.redemption_mode, voucher_claims, store_expenses,
-- or orders.scheduled_at, or orders.cod_cash_amount.
-- Safe to re-run (uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).

-- 007: voucher claims
CREATE TABLE IF NOT EXISTS voucher_claims (
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

-- 008: optional voucher expiry
ALTER TABLE promotions
  ALTER COLUMN ends_at DROP NOT NULL;

-- 009: redemption mode
ALTER TABLE promotions
  ADD COLUMN IF NOT EXISTS redemption_mode TEXT NOT NULL DEFAULT 'CLAIM'
  CHECK (redemption_mode IN ('CLAIM', 'MANUAL'));

-- 010: voucher vs home promotion kind
ALTER TABLE promotions
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'VOUCHER'
  CHECK (kind IN ('VOUCHER', 'PROMOTION'));

-- 011: store expenses
CREATE TABLE IF NOT EXISTS store_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category TEXT NOT NULL CHECK (
    category IN (
      'RENT',
      'UTILITIES',
      'PAYROLL',
      'SUPPLIES',
      'MARKETING',
      'DELIVERY',
      'MAINTENANCE',
      'OTHER'
    )
  ),
  amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
  notes TEXT,
  incurred_at TIMESTAMPTZ NOT NULL,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_store_expenses_incurred
  ON store_expenses (incurred_at DESC);

ALTER TABLE store_expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff manage store expenses" ON store_expenses;
CREATE POLICY "Staff manage store expenses" ON store_expenses
  FOR ALL USING (is_staff_or_above());

DROP TRIGGER IF EXISTS tr_store_expenses_updated ON store_expenses;
CREATE TRIGGER tr_store_expenses_updated
  BEFORE UPDATE ON store_expenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 012: scheduled orders (order for later)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_orders_scheduled_at
  ON orders (scheduled_at)
  WHERE scheduled_at IS NOT NULL;

-- 013: QR Ph payment method
ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'QRPH';

-- 014: COD cash amount (for driver change preparation)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS cod_cash_amount DECIMAL(10, 2) NULL;

-- 015: delivery pricing (₱30 first 1 km, ₱10/km after)
UPDATE app_settings
SET value = COALESCE(value, '{}'::jsonb) || '{"baseFee": 30, "baseKm": 1, "perKmFee": 10}'::jsonb
WHERE key = 'delivery';
