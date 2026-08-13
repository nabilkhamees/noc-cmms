-- Stage 5 migration: track who uploaded a work order's report
-- Run this in Supabase: Project → SQL Editor → New query → paste → Run

alter table work_orders add column if not exists report_uploaded_by text references users(id);
alter table equipment add column if not exists report_uploaded_by text references users(id);
