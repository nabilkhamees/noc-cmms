-- Stage 6 migration: floors (optional level above rooms, for sites with
-- more than one floor). Run this in Supabase: Project → SQL Editor →
-- New query → paste → Run

create table if not exists floors (
  id text primary key,
  site_id text references sites(id) on delete cascade,
  name text not null,
  created_at timestamptz default now()
);

alter table floors enable row level security;

create policy "authenticated read/write - floors" on floors for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Rooms can optionally belong to a floor. Existing rooms simply have no
-- floor (null) — nothing changes for a single-floor site, since floors
-- only show up in the Assets view once at least one exists for that site.
alter table rooms add column if not exists floor_id text references floors(id) on delete set null;
