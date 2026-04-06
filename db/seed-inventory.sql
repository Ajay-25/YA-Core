-- Seed catalog: T-Shirts (by size, ₹320/piece) and Cloth (Blue/White, ₹50/meter).
-- Idempotent: skips rows that already match item_name + variant.
-- Run in Neon SQL Editor or: psql "$DATABASE_URL" -f db/seed-inventory.sql

INSERT INTO inventory_items (item_name, variant, current_quantity, unit_price, unit_type, total_received)
SELECT v.item_name, v.variant, 0, v.unit_price, v.unit_type, 0
FROM (VALUES
  ('T-Shirt', 'S',     320::numeric, 'piece'::text),
  ('T-Shirt', 'M',     320::numeric, 'piece'),
  ('T-Shirt', 'L',     320::numeric, 'piece'),
  ('T-Shirt', 'XL',    320::numeric, 'piece'),
  ('T-Shirt', 'XXL',   320::numeric, 'piece'),
  ('T-Shirt', 'XXXL',  320::numeric, 'piece'),
  ('Cloth',   'Blue',   50::numeric, 'meter'),
  ('Cloth',   'White',  50::numeric, 'meter')
) AS v(item_name, variant, unit_price, unit_type)
WHERE NOT EXISTS (
  SELECT 1 FROM inventory_items i
  WHERE i.item_name = v.item_name AND COALESCE(i.variant, '') = v.variant
);
