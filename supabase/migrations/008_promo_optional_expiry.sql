-- Allow promotions/vouchers with no expiration (null ends_at = never expires).

ALTER TABLE promotions
  ALTER COLUMN ends_at DROP NOT NULL;

COMMENT ON COLUMN promotions.ends_at IS
  'When the voucher expires. NULL means it does not expire.';
