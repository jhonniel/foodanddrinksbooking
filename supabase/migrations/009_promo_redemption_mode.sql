-- How customers redeem a voucher: CLAIM (Rewards tap) or MANUAL (Cart promo code).

ALTER TABLE promotions
  ADD COLUMN IF NOT EXISTS redemption_mode TEXT NOT NULL DEFAULT 'CLAIM'
  CHECK (redemption_mode IN ('CLAIM', 'MANUAL'));

COMMENT ON COLUMN promotions.redemption_mode IS
  'CLAIM = customer taps Claim on Rewards; MANUAL = customer enters promo_code in Cart.';
