-- Stage 2 migration: real authentication
-- Run this in Supabase: Project → SQL Editor → New query → paste → Run
-- (Run this AFTER schema.sql has already been run once — this only adds
-- to what's there, it doesn't recreate tables.)

-- ── 1. Add an email column so app profiles can be linked to real logins ──
alter table users add column if not exists email text unique;

-- Fill in the email for the account already used to set up this project.
-- Update the other three rows yourself (see instructions below) once you
-- know each teammate's email, or edit them from the app's Users & Roles
-- page after this migration runs (Admin only).
update users set email = 'nabilkhamees0@gmail.com' where id = 'u1';

-- ── 2. Replace the old "anyone with the anon key" policies ──────────
-- Previously every table allowed full read/write to anyone holding the
-- public anon key. Now we require an actual logged-in (authenticated)
-- Supabase Auth session for every read and write.

drop policy if exists "public read/write - users" on users;
drop policy if exists "public read/write - sites" on sites;
drop policy if exists "public read/write - rooms" on rooms;
drop policy if exists "public read/write - racks" on racks;
drop policy if exists "public read/write - equipment" on equipment;
drop policy if exists "public read/write - parts" on parts;
drop policy if exists "public read/write - pm_schedule" on pm_schedule;
drop policy if exists "public read/write - work_orders" on work_orders;

create policy "authenticated read/write - users" on users for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated read/write - sites" on sites for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated read/write - rooms" on rooms for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated read/write - racks" on racks for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated read/write - equipment" on equipment for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated read/write - parts" on parts for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated read/write - pm_schedule" on pm_schedule for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated read/write - work_orders" on work_orders for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Note: this still doesn't restrict WHICH authenticated user can do WHAT
-- (that's still enforced in the app's UI by role, same as before). Truly
-- enforcing "only Admins can delete a site" at the database level too is
-- a further tightening step you can add later (policies that check the
-- signed-in user's role via a join back to the users table).
