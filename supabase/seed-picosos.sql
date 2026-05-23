-- ════════════════════════════════════════════════════════════════════════════
-- ServeSync — Picoso's Mexican Kitchen demo seed
-- Run in: Supabase Dashboard → SQL Editor → Run
-- Safe to re-run: restaurant upserts on slug, items are wiped + re-inserted.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 0. Add server_label to item_requests (skip if already done) ──────────────
ALTER TABLE public.item_requests
  ADD COLUMN IF NOT EXISTS server_label text;

-- ── 1. Upsert Picoso's restaurant ────────────────────────────────────────────
INSERT INTO public.restaurants (name, slug, address, active)
VALUES (
  'Picoso''s Mexican Kitchen',
  'picosos',
  '7611 Milwaukee Ave, Lubbock, TX',
  true
)
ON CONFLICT (slug) DO UPDATE
  SET name    = EXCLUDED.name,
      address = EXCLUDED.address,
      active  = EXCLUDED.active;

-- ── 2. Clear previous featured items for Picoso's (safe re-seed) ─────────────
DELETE FROM public.featured_items
WHERE restaurant_id = (
  SELECT id FROM public.restaurants WHERE slug = 'picosos'
);

-- ── 3. Seed featured items ────────────────────────────────────────────────────
INSERT INTO public.featured_items
  (restaurant_id, category, name, description, price, sort_order, active)
SELECT
  r.id,
  v.cat,
  v.nm,
  v.dsc,
  v.price::numeric,
  v.ord,
  true
FROM
  (SELECT id FROM public.restaurants WHERE slug = 'picosos') AS r
  CROSS JOIN (VALUES
    ('appetizer', 'White Queso',
     'Creamy, warm white queso made with hatch green chiles.',
     8.99, 1),
    ('appetizer', 'Brisket Queso',
     'Hatch green chile queso with slow-cooked brisket.',
     14.99, 2),
    ('appetizer', 'Picoso Skillet',
     'Melted jack cheese with your choice of protein, topped with fresh pico de gallo and served with flour tortillas.',
     12.99, 3),
    ('appetizer', 'Taquitos',
     'Four golden crispy taquitos drizzled with cilantro crema, topped with fresh guacamole and pico de gallo.',
     10.99, 4),
    ('appetizer', 'Birria Taco Plate',
     'Slow-cooked brisket with Monterey jack cheese, onions and cilantro sealed in corn tortillas with scratch-made birria sauce.',
     19.99, 5),
    ('appetizer', 'Picoso''s Sopapilla',
     'Bite-size sopapillas served with homemade buttery honey, cinnamon, and sugar dipping sauce.',
     5.99, 6),
    ('drink', 'Mango Mule Mocktail',
     'Bright, refreshing mango mule mocktail.',
     7.99, 7),
    ('drink', 'Lavender Lemonade Mocktail',
     'A refreshing lavender lemonade mocktail.',
     7.99, 8)
  ) AS v(cat, nm, dsc, price, ord);

-- ── Verify ────────────────────────────────────────────────────────────────────
SELECT r.name, r.slug, r.address, COUNT(fi.id) AS item_count
FROM public.restaurants r
LEFT JOIN public.featured_items fi ON fi.restaurant_id = r.id AND fi.active
WHERE r.slug = 'picosos'
GROUP BY r.name, r.slug, r.address;
