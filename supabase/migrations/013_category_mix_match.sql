-- Category-level mix & match (all drinks in category can combine flavors).

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS allows_mix_match BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mix_max_flavors INT NOT NULL DEFAULT 2
    CHECK (mix_max_flavors BETWEEN 2 AND 4);

CREATE TABLE IF NOT EXISTS category_mix_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  candidate_product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  UNIQUE (category_id, candidate_product_id)
);

CREATE INDEX IF NOT EXISTS idx_category_mix_candidates_category
  ON category_mix_candidates (category_id, sort_order);

ALTER TABLE category_mix_candidates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read category mix candidates" ON category_mix_candidates;
CREATE POLICY "Anyone can read category mix candidates" ON category_mix_candidates
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Staff manage category mix candidates" ON category_mix_candidates;
CREATE POLICY "Staff manage category mix candidates" ON category_mix_candidates
  FOR ALL USING (is_staff_or_above());
