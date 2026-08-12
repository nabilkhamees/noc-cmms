-- Example data: sample equipment + work orders, so the app isn't empty
-- when demoing. Safe to re-run (uses fixed IDs with ON CONFLICT DO
-- NOTHING) — running it twice won't create duplicates.
-- Run this in Supabase: Project → SQL Editor → New query → paste → Run
-- (Run this AFTER schema.sql, so the b90/auto sites and their rooms
-- already exist.)

-- ── Equipment ──────────────────────────────────────────────────────
insert into equipment (id, site_id, room_id, code, name, type, status, install_year, make, model, serial, barcode, category, account, charge_dept, notes, location)
values
  ('b90-eq1', 'b90', 'b90-r2', 'B90-R2-EQ001', 'cummins 1.1mva_gen_1', 'Generator', 'Online', 2019, 'Cummins', 'C1100D5', 'CMS-1100-88214', '5901234123457', 'Equipment', 'Facilities Power', 'Datacenter Ops', 'generator 1' || chr(10) || 'cummins 1.1mva' || chr(10) || 'at left', 'B90, Smart Village'),
  ('b90-eq2', 'b90', 'b90-r1', 'B90-R1-EQ002', 'APC Smart-UPS 40kVA', 'UPS', 'Online', 2021, 'APC', 'SURT40KRMXLI', 'APC-40K-55021', '5901234123464', 'Equipment', 'Facilities Power', 'Datacenter Ops', 'Primary UPS for server hall A, rack row 1', 'B90, Smart Village'),
  ('b90-eq3', 'b90', 'b90-r1', 'B90-R1-EQ003', 'CRAC Unit 02', 'Cooling', 'Offline', 2018, 'Liebert', 'PDX-30kW', 'LBT-PDX-77310', '5901234123471', 'Equipment', 'Facilities Cooling', 'Datacenter Ops', 'Compressor tripped on high pressure — awaiting parts', 'B90, Smart Village'),
  ('auto-eq1', 'auto', 'auto-r2', 'AUTO-R2-EQ001', 'cummins 400kva_gen_1', 'Generator', 'Online', 2020, 'Cummins', 'C400D5', 'CMS-400-22190', '5901234123488', 'Equipment', 'Facilities Power', 'Datacenter Ops', 'generator 1 — main yard', 'Auto, Alexandria'),
  ('auto-eq2', 'auto', 'auto-r1', 'AUTO-R1-EQ002', 'APC Smart-UPS 20kVA', 'UPS', 'Online', 2022, 'APC', 'SURT20KRMXLI', 'APC-20K-90142', '5901234123495', 'Equipment', 'Facilities Power', 'Datacenter Ops', 'Secondary UPS, rack row 1', 'Auto, Alexandria')
on conflict (id) do nothing;

-- ── Parts ──────────────────────────────────────────────────────────
insert into parts (id, equipment_id, name, installed_date, lifetime_months) values
  ('b90-p1', 'b90-eq1', 'Fuel filter', '2025-11-02', 6),
  ('b90-p2', 'b90-eq1', 'Coolant pump', '2024-05-10', 24),
  ('b90-p3', 'b90-eq2', 'Battery bank', '2023-01-15', 36),
  ('b90-p4', 'b90-eq3', 'Compressor', '2022-09-01', 60),
  ('auto-p1', 'auto-eq1', 'Fuel filter', '2025-12-01', 6),
  ('auto-p2', 'auto-eq2', 'Battery bank', '2023-06-01', 36)
on conflict (id) do nothing;

-- ── Preventive maintenance schedule ────────────────────────────────
insert into pm_schedule (id, equipment_id, date, type, mop, assigned_to, status) values
  ('b90-pm1', 'b90-eq1', '2026-08-05', 'Preventive', 'MOP-GEN-Monthly-v3.pdf', 'u3', 'Open'),
  ('b90-pm2', 'b90-eq1', '2026-08-12', 'Preventive', 'MOP-GEN-Monthly-v3.pdf', 'u3', 'Open'),
  ('b90-pm3', 'b90-eq2', '2026-08-20', 'Preventive', 'MOP-UPS-Quarterly-v2.pdf', 'u3', 'Open'),
  ('b90-pm4', 'b90-eq3', '2026-07-28', 'Corrective', null, 'u3', 'Late'),
  ('auto-pm1', 'auto-eq1', '2026-08-10', 'Preventive', 'MOP-GEN-Monthly-v3.pdf', 'u3', 'Open'),
  ('auto-pm2', 'auto-eq2', '2026-08-18', 'Preventive', 'MOP-UPS-Quarterly-v2.pdf', 'u3', 'Open')
on conflict (id) do nothing;

-- ── Work orders — mirror the PM schedule above ─────────────────────
insert into work_orders (id, code, site_id, equipment_id, equipment_name, description, summary, priority, type, assigned_to, status, mop, due_date, suggested_start, instructions, est_labor)
values
  ('wo91', 91, 'b90', 'b90-eq1', 'cummins 1.1mva_gen_1', 'Preventive maintenance — cummins 1.1mva_gen_1', 'Preventive maintenance — cummins 1.1mva_gen_1', 'High', 'Preventive', 'u3', 'Open', 'MOP-GEN-Monthly-v3.pdf', '2026-08-05', '2026-08-05',
   '["Inspect cummins 1.1mva_gen_1 per MOP-GEN-Monthly-v3.pdf","Check fluid levels / connections","Record meter reading before starting","Perform preventive tasks per MOP","Take a photo for each step and attach to Files","Sign off and complete work order"]'::jsonb, '2.0h'),
  ('wo92', 92, 'b90', 'b90-eq1', 'cummins 1.1mva_gen_1', 'Preventive maintenance — cummins 1.1mva_gen_1', 'Preventive maintenance — cummins 1.1mva_gen_1', 'High', 'Preventive', 'u3', 'Open', 'MOP-GEN-Monthly-v3.pdf', '2026-08-12', '2026-08-12',
   '["Inspect cummins 1.1mva_gen_1 per MOP-GEN-Monthly-v3.pdf","Check fluid levels / connections","Record meter reading before starting","Perform preventive tasks per MOP","Take a photo for each step and attach to Files","Sign off and complete work order"]'::jsonb, '2.0h'),
  ('wo93', 93, 'b90', 'b90-eq2', 'APC Smart-UPS 40kVA', 'Preventive maintenance — APC Smart-UPS 40kVA', 'Preventive maintenance — APC Smart-UPS 40kVA', 'High', 'Preventive', 'u3', 'Open', 'MOP-UPS-Quarterly-v2.pdf', '2026-08-20', '2026-08-20',
   '["Inspect APC Smart-UPS 40kVA per MOP-UPS-Quarterly-v2.pdf","Check fluid levels / connections","Record meter reading before starting","Perform preventive tasks per MOP","Take a photo for each step and attach to Files","Sign off and complete work order"]'::jsonb, '2.0h'),
  ('wo94', 94, 'b90', 'b90-eq3', 'CRAC Unit 02', 'Corrective maintenance — CRAC Unit 02', 'Corrective maintenance — CRAC Unit 02', 'Highest', 'Corrective', 'u3', 'Late', null, '2026-07-28', '2026-07-28',
   '["Inspect CRAC Unit 02","Check fluid levels / connections","Record meter reading before starting","Perform corrective tasks per MOP","Take a photo for each step and attach to Files","Sign off and complete work order"]'::jsonb, '2.0h'),
  ('wo95', 95, 'auto', 'auto-eq1', 'cummins 400kva_gen_1', 'Preventive maintenance — cummins 400kva_gen_1', 'Preventive maintenance — cummins 400kva_gen_1', 'High', 'Preventive', 'u3', 'Open', 'MOP-GEN-Monthly-v3.pdf', '2026-08-10', '2026-08-10',
   '["Inspect cummins 400kva_gen_1 per MOP-GEN-Monthly-v3.pdf","Check fluid levels / connections","Record meter reading before starting","Perform preventive tasks per MOP","Take a photo for each step and attach to Files","Sign off and complete work order"]'::jsonb, '2.0h'),
  ('wo96', 96, 'auto', 'auto-eq2', 'APC Smart-UPS 20kVA', 'Preventive maintenance — APC Smart-UPS 20kVA', 'Preventive maintenance — APC Smart-UPS 20kVA', 'High', 'Preventive', 'u3', 'Open', 'MOP-UPS-Quarterly-v2.pdf', '2026-08-18', '2026-08-18',
   '["Inspect APC Smart-UPS 20kVA per MOP-UPS-Quarterly-v2.pdf","Check fluid levels / connections","Record meter reading before starting","Perform preventive tasks per MOP","Take a photo for each step and attach to Files","Sign off and complete work order"]'::jsonb, '2.0h')
on conflict (id) do nothing;
