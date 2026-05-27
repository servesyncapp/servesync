-- ════════════════════════════════════════════════════════════════════════════
-- ServeSync — order_intents migration
-- Purpose : Server-side tender tracking. Created when a customer shows item
--           interest on a tap page; resolved by the server as ordered/dismissed.
-- Run in  : Supabase Dashboard → SQL Editor → Run
-- Safe    : Uses IF NOT EXISTS / OR REPLACE throughout — re-runnable.
-- ════════════════════════════════════════════════════════════════════════════


-- ── 1. Table ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.order_intents (
  id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Restaurant this intent belongs to (hard multi-tenant boundary)
  restaurant_id uuid         NOT NULL REFERENCES public.restaurants(id)    ON DELETE CASCADE,

  -- Server fields:
  --   server_id    → future: UUID once we wire the tap URL to a servers row
  --   server_label → current: text name from ?server= URL param (e.g. "isaac")
  server_id     uuid         REFERENCES public.servers(id)                 ON DELETE SET NULL,
  server_label  text,

  -- The featured item the customer expressed interest in
  item_id       uuid         NOT NULL REFERENCES public.featured_items(id) ON DELETE CASCADE,

  -- Optional link to the NFC tap_event that originated this session
  tap_event_id  uuid         REFERENCES public.tap_events(id)              ON DELETE SET NULL,

  -- Table the customer is sitting at (carried from the tap URL / input)
  table_label   text,

  -- Lifecycle status
  status        text         NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending','ordered','dismissed','expired')),

  -- Timestamps
  created_at    timestamptz  NOT NULL DEFAULT now(),
  updated_at    timestamptz  NOT NULL DEFAULT now(),

  -- Resolution
  resolved_at   timestamptz,
  resolved_by   uuid         REFERENCES auth.users(id)                     ON DELETE SET NULL
);

COMMENT ON TABLE public.order_intents IS
  'Tracks customer item-interest events from tap pages so servers can mark them ordered or dismiss them.';


-- ── 2. Indexes ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS order_intents_restaurant_id_idx ON public.order_intents (restaurant_id);
CREATE INDEX IF NOT EXISTS order_intents_server_id_idx     ON public.order_intents (server_id);
CREATE INDEX IF NOT EXISTS order_intents_item_id_idx       ON public.order_intents (item_id);
CREATE INDEX IF NOT EXISTS order_intents_status_idx        ON public.order_intents (status);
CREATE INDEX IF NOT EXISTS order_intents_created_at_idx    ON public.order_intents (created_at DESC);


-- ── 3. updated_at auto-trigger ────────────────────────────────────────────────
-- Shared helper — create once, reuse across tables.

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS order_intents_updated_at ON public.order_intents;
CREATE TRIGGER order_intents_updated_at
  BEFORE UPDATE ON public.order_intents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ── 4. Enable RLS ─────────────────────────────────────────────────────────────

ALTER TABLE public.order_intents ENABLE ROW LEVEL SECURITY;


-- ── 5. RLS Policies ───────────────────────────────────────────────────────────

-- 5a. ServeSync platform admin — unrestricted
DROP POLICY IF EXISTS "admin_all" ON public.order_intents;
CREATE POLICY "admin_all"
  ON public.order_intents FOR ALL
  USING (public.is_serveSync_admin());

-- 5b. Manager/staff in restaurant_users — read their restaurant's intents
DROP POLICY IF EXISTS "manager_read_own" ON public.order_intents;
CREATE POLICY "manager_read_own"
  ON public.order_intents FOR SELECT
  USING (public.user_manages_restaurant(restaurant_id));

-- 5c. Manager/staff in restaurant_users — update (resolve) their restaurant's intents
DROP POLICY IF EXISTS "manager_update_own" ON public.order_intents;
CREATE POLICY "manager_update_own"
  ON public.order_intents FOR UPDATE
  USING (public.user_manages_restaurant(restaurant_id));

-- 5d. Server users linked via servers.user_id — read intents for their restaurant
--     (covers server-role accounts NOT present in restaurant_users)
DROP POLICY IF EXISTS "server_read_own" ON public.order_intents;
CREATE POLICY "server_read_own"
  ON public.order_intents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.servers s
      WHERE s.restaurant_id = order_intents.restaurant_id
        AND s.user_id = auth.uid()
        AND s.active  = true
    )
  );

-- 5e. Server users linked via servers.user_id — update (resolve) intents
DROP POLICY IF EXISTS "server_update_own" ON public.order_intents;
CREATE POLICY "server_update_own"
  ON public.order_intents FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.servers s
      WHERE s.restaurant_id = order_intents.restaurant_id
        AND s.user_id = auth.uid()
        AND s.active  = true
    )
  );

-- 5f. Public (anon) insert — customer tap page
--     Guards: restaurant must be active AND item must belong to that restaurant and be active.
--     server_id / tap_event_id are nullable; the frontend passes text server_label only.
DROP POLICY IF EXISTS "public_insert" ON public.order_intents;
CREATE POLICY "public_insert"
  ON public.order_intents FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.id = restaurant_id AND r.active = true
    )
    AND
    EXISTS (
      SELECT 1 FROM public.featured_items fi
      WHERE fi.id     = item_id
        AND fi.restaurant_id = restaurant_id
        AND fi.active = true
    )
  );


-- ── 6. Realtime ───────────────────────────────────────────────────────────────
-- REPLICA IDENTITY FULL is required so UPDATE change events carry the old row,
-- which lets Supabase realtime deliver the diff correctly.
-- The supabase_realtime publication line makes the table subscribe-able.
-- After running this, also enable the table in:
--   Supabase Dashboard → Database → Replication → Tables → toggle order_intents

ALTER TABLE public.order_intents REPLICA IDENTITY FULL;

-- Only add to publication if it isn't already a member (avoids duplicate-member error)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND tablename = 'order_intents'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.order_intents;
  END IF;
END
$$;


-- ── 7. Verify ─────────────────────────────────────────────────────────────────
-- Should return table_exists = true, policy_count >= 6, trigger_count = 1

SELECT
  to_regclass('public.order_intents') IS NOT NULL AS table_exists,
  (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'order_intents') AS policy_count,
  (SELECT COUNT(*) FROM information_schema.triggers WHERE event_object_table = 'order_intents') AS trigger_count;
