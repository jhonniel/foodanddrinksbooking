-- Mix & match: combine multiple flavors into one drink.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS allows_mix_match BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mix_max_flavors INT NOT NULL DEFAULT 2
    CHECK (mix_max_flavors BETWEEN 2 AND 4);

CREATE TABLE IF NOT EXISTS product_mix_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  candidate_product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  UNIQUE (product_id, candidate_product_id),
  CHECK (product_id <> candidate_product_id)
);

CREATE INDEX IF NOT EXISTS idx_product_mix_candidates_product
  ON product_mix_candidates (product_id, sort_order);

CREATE TABLE IF NOT EXISTS order_item_mix_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  component_product_id UUID NOT NULL REFERENCES products(id),
  component_name TEXT NOT NULL,
  slot_index INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_order_item_mix_components_item
  ON order_item_mix_components (order_item_id);

ALTER TABLE product_mix_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_item_mix_components ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read mix candidates" ON product_mix_candidates;
CREATE POLICY "Anyone can read mix candidates" ON product_mix_candidates
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Staff manage mix candidates" ON product_mix_candidates;
CREATE POLICY "Staff manage mix candidates" ON product_mix_candidates
  FOR ALL USING (is_staff_or_above());

DROP POLICY IF EXISTS "Anyone can read mix components" ON order_item_mix_components;
CREATE POLICY "Anyone can read mix components" ON order_item_mix_components
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Staff manage mix components" ON order_item_mix_components;
CREATE POLICY "Staff manage mix components" ON order_item_mix_components
  FOR ALL USING (is_staff_or_above());
