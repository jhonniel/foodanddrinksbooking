-- Claimable vouchers (promotions) — one claim per customer per voucher.
-- Admin sets custom promo_code, usage_limit (max claims), and ends_at on promotions.

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

COMMENT ON TABLE voucher_claims IS
  'Customer claims of admin-created promotion vouchers. usage_limit on promotions caps total claims.';
