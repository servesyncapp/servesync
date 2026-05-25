-- ════════════════════════════════════════════════════════════════════════════
-- ServeSync — Picoso's Mexican Kitchen demo seed (curated featured items)
-- Run in: Supabase Dashboard → SQL Editor → Run
-- Safe to re-run: upserts on slug, items wiped + re-inserted each run.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 0. Schema migrations (idempotent — skip if already applied) ───────────────

-- Promo / deal columns on featured_items
ALTER TABLE public.featured_items
  ADD COLUMN IF NOT EXISTS promo_label    text,
  ADD COLUMN IF NOT EXISTS original_price numeric(8,2),
  ADD COLUMN IF NOT EXISTS special_price  numeric(8,2),
  ADD COLUMN IF NOT EXISTS savings_text   text;

-- Social proof / scarcity columns on featured_items
ALTER TABLE public.featured_items
  ADD COLUMN IF NOT EXISTS rating         numeric(2,1),
  ADD COLUMN IF NOT EXISTS nightly_orders int,
  ADD COLUMN IF NOT EXISTS is_limited     boolean default false;

-- Server name column on item_requests
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

-- ── 2. Wipe existing featured items for Picoso's ─────────────────────────────
DELETE FROM public.featured_items
WHERE restaurant_id = (
  SELECT id FROM public.restaurants WHERE slug = 'picosos'
);

-- ── 3. Seed curated featured items ───────────────────────────────────────────
-- 5 items max — focused, not a full menu.
-- image_url: null for now; replace with real CDN URLs when photos are ready.
-- Combo pricing: $35.98 à la carte → $32.99 special ($2.99 OFF, matches ribbon PNG).

INSERT INTO public.featured_items (
  restaurant_id,
  category, name, description,
  price, original_price, special_price,
  promo_label, savings_text,
  image_url, sort_order, active,
  rating, nightly_orders, is_limited
)
SELECT
  r.id,
  v.cat, v.nm, v.dsc,
  v.price::numeric,
  v.orig::numeric,
  v.special::numeric,
  v.promo, v.savings,
  v.img, v.ord, true,
  v.rating::numeric,
  v.nightly_ord::int,
  v.limited::boolean
FROM
  (SELECT id FROM public.restaurants WHERE slug = 'picosos') AS r
  CROSS JOIN (VALUES

    -- 1. ServeSync Special — combo deal (the hero card)
    (
      'top_seller',
      'Brisket Queso + Margarita Pitcher',
      'Hatch green chile queso with slow-cooked brisket, paired with a house margarita pitcher. The perfect combo for the whole table.',
      NULL,           -- price (unused when special_price is set)
      '35.98',        -- original_price (à la carte sum)
      '32.99',        -- special_price ($35.98 - $2.99 = $32.99)
      'ServeSync Special',
      '$2.99 OFF',    -- matches ribbon PNG asset
      '/images/featured-brisket-margarita.jpg', -- image_url
      1,
      '4.9',          -- rating
      24,             -- nightly_orders
      'true'          -- is_limited
    ),

    -- 2. White Queso
    (
      'appetizer',
      'White Queso',
      'Creamy, warm white queso made with hatch green chiles.',
      '8.99', NULL, NULL,
      NULL, NULL,
      NULL, 2,
      NULL, NULL, 'false'
    ),

    -- 3. Picoso Skillet
    (
      'appetizer',
      'Picoso Skillet',
      'Melted jack cheese with your choice of protein, topped with fresh pico de gallo and served with flour tortillas.',
      '12.99', NULL, NULL,
      NULL, NULL,
      NULL, 3,
      NULL, NULL, 'false'
    ),

    -- 4. Birria Taco Plate
    (
      'appetizer',
      'Birria Taco Plate',
      'Slow-cooked brisket with Monterey jack cheese, onions and cilantro sealed in corn tortillas with scratch-made birria sauce.',
      '19.99', NULL, NULL,
      NULL, NULL,
      NULL, 4,
      NULL, NULL, 'false'
    ),

    -- 5. Picoso's Sopapilla
    (
      'daily_special',
      'Picoso''s Sopapilla',
      'Bite-size sopapillas served with homemade buttery honey, cinnamon, and sugar dipping sauce.',
      '5.99', NULL, NULL,
      NULL, NULL,
      NULL, 5,
      NULL, NULL, 'false'
    )

  ) AS v(cat, nm, dsc, price, orig, special, promo, savings, img, ord, rating, nightly_ord, limited);

-- ── Verify ────────────────────────────────────────────────────────────────────
-- Should return 1 row with item_count = 5, promo_count = 1
SELECT
  r.name,
  r.slug,
  r.address,
  COUNT(fi.id)   AS item_count,
  SUM(CASE WHEN fi.promo_label IS NOT NULL THEN 1 ELSE 0 END) AS promo_count
FROM public.restaurants r
LEFT JOIN public.featured_items fi
  ON fi.restaurant_id = r.id AND fi.active = true
WHERE r.slug = 'picosos'
GROUP BY r.name, r.slug, r.address;
