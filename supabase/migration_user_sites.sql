-- Stage 4 migration: assign users to one or more sites
-- Run this in Supabase: Project → SQL Editor → New query → paste → Run

create table if not exists user_sites (
  user_id text references users(id) on delete cascade,
  site_id text references sites(id) on delete cascade,
  primary key (user_id, site_id)
);

alter table user_sites enable row level security;

create policy "authenticated read/write - user_sites" on user_sites for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Nobody is assigned to anything yet — assign your team to sites from
-- the app's Users & Roles page (Admin only). Until a user has at least
-- one site assigned, the app shows them every site (so nobody's screen
-- goes blank by default); assigning specific sites narrows what they see.
