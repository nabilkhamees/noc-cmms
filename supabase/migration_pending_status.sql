-- Stage 8 migration: technician close/pending workflow
-- Run this in Supabase: Project → SQL Editor → New query → paste → Run

alter table work_orders add column if not exists pending_reason text;

-- No change needed to the status column itself — it's a free-text field
-- in this schema (not a Postgres enum), so the new "Pending" status
-- value used by the app works without any table change here.
