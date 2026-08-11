-- Stage 3 migration: custom equipment classifications
-- Run this in Supabase: Project → SQL Editor → New query → paste → Run
-- (Run this AFTER schema.sql and migration_auth.sql have already been run.)

create table if not exists equipment_types (
  id text primary key,
  name text not null unique,
  created_at timestamptz default now()
);

alter table equipment_types enable row level security;

create policy "authenticated read/write - equipment_types" on equipment_types for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- The app already ships with Generator, UPS, Cooling, Rack PDU, Switch,
-- Panel Board, Rectifier, and Equipment built in — nothing to seed here.
-- Any classification a user types into "Add custom classification" in
-- the app gets saved into this table and becomes available for every
-- other asset from then on.
