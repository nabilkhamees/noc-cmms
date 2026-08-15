-- Stage 7 migration: real file storage for report uploads
-- Run this in Supabase: Project → SQL Editor → New query → paste → Run

-- Create the storage bucket that report files (PDF/Word) get uploaded
-- into. Public = true means anyone with the exact file URL can view it
-- (no login required to open the link) — the URLs themselves are long,
-- random, and only ever shared inside the app to signed-in users, which
-- is a reasonable tradeoff for an internal tool. Uploading and deleting
-- still require being logged in (see policies below).
insert into storage.buckets (id, name, public)
values ('reports', 'reports', true)
on conflict (id) do nothing;

create policy "authenticated upload - reports"
  on storage.objects for insert
  with check (bucket_id = 'reports' and auth.role() = 'authenticated');

create policy "public read - reports"
  on storage.objects for select
  using (bucket_id = 'reports');

create policy "authenticated delete - reports"
  on storage.objects for delete
  using (bucket_id = 'reports' and auth.role() = 'authenticated');

-- Store the actual file URL alongside the filename that's already there.
alter table equipment add column if not exists report_url text;
alter table work_orders add column if not exists report_url text;
