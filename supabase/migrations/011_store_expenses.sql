-- Shared store expenses (admin finance log)

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
