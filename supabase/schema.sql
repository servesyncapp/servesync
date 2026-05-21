-- ================================================================
-- ServeSync MVP — Database Schema + RLS
-- Paste into: Supabase Dashboard → SQL Editor → Run
-- ================================================================

-- ── Tables ──────────────────────────────────────────────────────

create table public.restaurants (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text unique not null,
  logo_url   text,
  address    text,
  timezone   text default 'America/Chicago',
  active     boolean default true,
  created_at timestamptz default now()
);

create table public.restaurant_users (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete cascade,
  restaurant_id uuid references public.restaurants(id) on delete cascade,
  role          text check (role in ('manager', 'staff')) default 'staff',
  created_at    timestamptz default now(),
  unique(user_id, restaurant_id)
);

create table public.servers (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid references public.restaurants(id) on delete cascade,
  user_id       uuid references auth.users(id) on delete set null,
  name          text not null,
  active        boolean default true,
  created_at    timestamptz default now()
);

create table public.nfc_bracelets (
  id            uuid primary key default gen_random_uuid(),
  bracelet_code text unique not null,  -- maps to /tap/:braceletCode
  server_id     uuid references public.servers(id) on delete set null,
  restaurant_id uuid references public.restaurants(id) on delete cascade,
  active        boolean default true,
  created_at    timestamptz default now()
);

create table public.campaigns (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid references public.restaurants(id) on delete cascade,
  name          text not null,
  description   text,
  start_date    date,
  end_date      date,
  active        boolean default true,
  created_at    timestamptz default now()
);

create table public.featured_items (
  id            uuid primary key default gen_random_uuid(),
  campaign_id   uuid references public.campaigns(id) on delete cascade,
  restaurant_id uuid references public.restaurants(id) on delete cascade,
  category      text check (category in ('appetizer','drink','top_seller','daily_special','upsell')) not null,
  name          text not null,
  description   text,
  price         numeric(8,2),
  image_url     text,
  sort_order    int default 0,
  active        boolean default true,
  created_at    timestamptz default now()
);

create table public.tap_events (
  id            uuid primary key default gen_random_uuid(),
  bracelet_id   uuid references public.nfc_bracelets(id) on delete set null,
  server_id     uuid references public.servers(id) on delete set null,
  restaurant_id uuid references public.restaurants(id) on delete cascade,
  session_id    text,
  user_agent    text,
  tapped_at     timestamptz default now()
);

create table public.click_events (
  id               uuid primary key default gen_random_uuid(),
  tap_event_id     uuid references public.tap_events(id) on delete set null,
  bracelet_id      uuid references public.nfc_bracelets(id) on delete set null,
  server_id        uuid references public.servers(id) on delete set null,
  restaurant_id    uuid references public.restaurants(id) on delete cascade,
  featured_item_id uuid references public.featured_items(id) on delete set null,
  action           text check (action in ('want_this','ask_server','join_rewards')) not null,
  session_id       text,
  clicked_at       timestamptz default now()
);

create table public.customer_requests (
  id               uuid primary key default gen_random_uuid(),
  restaurant_id    uuid references public.restaurants(id) on delete cascade,
  server_id        uuid references public.servers(id) on delete cascade,
  bracelet_id      uuid references public.nfc_bracelets(id) on delete set null,
  featured_item_id uuid references public.featured_items(id) on delete set null,
  item_name        text,
  action           text check (action in ('want_this','ask_server')) not null,
  session_id       text,
  handled          boolean default false,
  handled_at       timestamptz,
  created_at       timestamptz default now()
);

create table public.daily_sales_reports (
  id               uuid primary key default gen_random_uuid(),
  restaurant_id    uuid references public.restaurants(id) on delete cascade,
  campaign_id      uuid references public.campaigns(id) on delete set null,
  featured_item_id uuid references public.featured_items(id) on delete set null,
  item_name        text,
  report_date      date not null,
  units_sold       int default 0,
  total_revenue    numeric(10,2) default 0,
  notes            text,
  reported_by      uuid references auth.users(id) on delete set null,
  created_at       timestamptz default now()
);

create table public.rewards_customers (
  id                 uuid primary key default gen_random_uuid(),
  restaurant_id      uuid references public.restaurants(id) on delete cascade,
  email              text,
  phone              text,
  first_name         text,
  opt_in_at          timestamptz default now(),
  source_bracelet_id uuid references public.nfc_bracelets(id) on delete set null,
  visit_count        int default 1,
  last_seen          timestamptz default now()
);

-- ── Enable RLS on every table ────────────────────────────────────

alter table public.restaurants        enable row level security;
alter table public.restaurant_users   enable row level security;
alter table public.servers            enable row level security;
alter table public.nfc_bracelets      enable row level security;
alter table public.campaigns          enable row level security;
alter table public.featured_items     enable row level security;
alter table public.tap_events         enable row level security;
alter table public.click_events       enable row level security;
alter table public.customer_requests  enable row level security;
alter table public.daily_sales_reports enable row level security;
alter table public.rewards_customers  enable row level security;

-- ── Helper functions ─────────────────────────────────────────────

create or replace function public.user_manages_restaurant(rid uuid)
returns boolean language sql security definer as $$
  select exists (
    select 1 from public.restaurant_users
    where user_id = auth.uid() and restaurant_id = rid
  );
$$;

create or replace function public.is_serveSync_admin()
returns boolean language sql security definer as $$
  select coalesce((auth.jwt()->'app_metadata'->>'role') = 'admin', false);
$$;

-- ── RLS Policies ─────────────────────────────────────────────────

-- restaurants
create policy "admin_all"          on public.restaurants for all using (public.is_serveSync_admin());
create policy "manager_read_own"   on public.restaurants for select using (public.user_manages_restaurant(id));
-- Required for the public /tap/:restaurantSlug page (no auth)
create policy "public_read_active" on public.restaurants for select using (active = true);

-- restaurant_users
create policy "admin_all"          on public.restaurant_users for all using (public.is_serveSync_admin());
create policy "self_read"          on public.restaurant_users for select using (user_id = auth.uid());

-- servers
create policy "admin_all"          on public.servers for all using (public.is_serveSync_admin());
create policy "manager_all_own"    on public.servers for all using (public.user_manages_restaurant(restaurant_id));

-- nfc_bracelets
create policy "admin_all"          on public.nfc_bracelets for all using (public.is_serveSync_admin());
create policy "manager_all_own"    on public.nfc_bracelets for all using (public.user_manages_restaurant(restaurant_id));
create policy "public_read_active" on public.nfc_bracelets for select using (active = true);

-- campaigns
create policy "admin_all"          on public.campaigns for all using (public.is_serveSync_admin());
create policy "manager_all_own"    on public.campaigns for all using (public.user_manages_restaurant(restaurant_id));

-- featured_items
create policy "admin_all"          on public.featured_items for all using (public.is_serveSync_admin());
create policy "manager_all_own"    on public.featured_items for all using (public.user_manages_restaurant(restaurant_id));
create policy "public_read_active" on public.featured_items for select using (active = true);

-- tap_events
create policy "admin_all"          on public.tap_events for all using (public.is_serveSync_admin());
create policy "public_insert"      on public.tap_events for insert with check (true);
create policy "manager_read_own"   on public.tap_events for select using (public.user_manages_restaurant(restaurant_id));

-- click_events
create policy "admin_all"          on public.click_events for all using (public.is_serveSync_admin());
create policy "public_insert"      on public.click_events for insert with check (true);
create policy "manager_read_own"   on public.click_events for select using (public.user_manages_restaurant(restaurant_id));

-- customer_requests
create policy "admin_all"          on public.customer_requests for all using (public.is_serveSync_admin());
create policy "public_insert"      on public.customer_requests for insert with check (true);
create policy "manager_read_own"   on public.customer_requests for select using (public.user_manages_restaurant(restaurant_id));
create policy "server_read_own"    on public.customer_requests for select using (
  exists (select 1 from public.servers s where s.id = server_id and s.user_id = auth.uid())
);
create policy "server_mark_handled" on public.customer_requests for update using (
  exists (select 1 from public.servers s where s.id = server_id and s.user_id = auth.uid())
);

-- daily_sales_reports
create policy "admin_all"          on public.daily_sales_reports for all using (public.is_serveSync_admin());
create policy "manager_all_own"    on public.daily_sales_reports for all using (public.user_manages_restaurant(restaurant_id));

-- rewards_customers
create policy "admin_all"          on public.rewards_customers for all using (public.is_serveSync_admin());
create policy "public_insert"      on public.rewards_customers for insert with check (true);
create policy "manager_read_own"   on public.rewards_customers for select using (public.user_manages_restaurant(restaurant_id));

-- ── Seed data (run after schema) ─────────────────────────────────
--
-- insert into public.restaurants (name, slug) values ('The Test Kitchen', 'test-kitchen');
--
-- insert into public.servers (restaurant_id, name)
--   select id, 'Alex' from public.restaurants where slug = 'test-kitchen';
--
-- insert into public.nfc_bracelets (bracelet_code, server_id, restaurant_id)
--   select 'demo-001', s.id, r.id
--   from public.servers s
--   join public.restaurants r on s.restaurant_id = r.id
--   where r.slug = 'test-kitchen';
--
-- insert into public.featured_items (restaurant_id, category, name, description, price, sort_order)
--   select r.id, 'appetizer', 'Crispy Calamari', 'Lightly fried, served with marinara.', 13.00, 1
--   from public.restaurants r where r.slug = 'test-kitchen';
--
-- Then visit: /tap/demo-001
