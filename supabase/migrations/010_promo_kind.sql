-- Voucher = redeemable on Rewards; Promotion = marketing display on home.

ALTER TABLE promotions
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'VOUCHER'
  CHECK (kind IN ('VOUCHER', 'PROMOTION'));

COMMENT ON COLUMN promotions.kind IS
  'VOUCHER = redeemable code for Rewards/checkout; PROMOTION = home page marketing offer.';
