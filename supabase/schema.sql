-- NOC/CMMS database schema
-- Run this whole file in Supabase: Project → SQL Editor → New query → paste → Run

-- ── Users ──────────────────────────────────────────────────────────
create table users (
  id text primary key,
  name text not null,
  role text not null check (role in ('Admin', 'Manager', 'Technician')),
  initials text not null,
  created_at timestamptz default now()
);

-- ── Sites ──────────────────────────────────────────────────────────
create table sites (
  id text primary key,
  name text not null,
  loc text,
  cap numeric default 0,        -- total capacity (kW)
  load numeric default 0,       -- current load (kW)
  it_load numeric default 0,    -- current IT load (kW)
  created_at timestamptz default now()
);

-- ── Rooms (belong to a site) ──────────────────────────────────────
create table rooms (
  id text primary key,
  site_id text references sites(id) on delete cascade,
  name text not null,
  grid_w integer default 8,
  grid_h integer default 5,
  created_at timestamptz default now()
);

-- ── Racks (belong to a room) ──────────────────────────────────────
create table racks (
  id text primary key,
  site_id text references sites(id) on delete cascade,
  room_id text references rooms(id) on delete set null,
  name text not null,
  created_at timestamptz default now()
);

-- ── Equipment ──────────────────────────────────────────────────────
create table equipment (
  id text primary key,
  site_id text references sites(id) on delete cascade,
  room_id text references rooms(id) on delete set null,
  rack_id text references racks(id) on delete set null,
  code text not null,
  name text not null,
  type text,
  status text default 'Online',
  install_year integer,
  make text,
  model text,
  serial text,
  barcode text,
  category text,
  account text,
  charge_dept text,
  notes text,
  location text,
  report text,               -- uploaded report filename
  pos_x integer,             -- floor-plan grid position (Room Designer)
  pos_y integer,
  custom_fields jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);

-- ── Parts (belong to equipment) ───────────────────────────────────
create table parts (
  id text primary key,
  equipment_id text references equipment(id) on delete cascade,
  name text not null,
  installed_date date,
  lifetime_months integer,
  created_at timestamptz default now()
);

-- ── Preventive maintenance schedule (belongs to equipment) ────────
create table pm_schedule (
  id text primary key,
  equipment_id text references equipment(id) on delete cascade,
  date date,
  type text,             -- Preventive / Corrective
  mop text,              -- MOP document reference
  assigned_to text references users(id),
  status text default 'Open',
  created_at timestamptz default now()
);

-- ── Work orders ────────────────────────────────────────────────────
create table work_orders (
  id text primary key,
  code integer,
  site_id text references sites(id) on delete cascade,
  equipment_id text references equipment(id) on delete set null,
  equipment_name text,
  description text,
  summary text,
  priority text,
  type text,
  assigned_to text references users(id),
  status text default 'Open',
  mop text,
  due_date date,
  suggested_start date,
  report text,
  instructions jsonb default '[]'::jsonb,
  est_labor text,
  act_labor text,
  completed_by text,
  date_completed date,
  created_at timestamptz default now()
);

-- ── Row Level Security ─────────────────────────────────────────────
-- Turned on for every table so the public anon key (embedded in the
-- built frontend) can only do what these policies allow. For this demo
-- we allow full read/write to anyone holding the anon key — good
-- enough for an internal demo behind a private link, NOT for a public
-- production app. Tightening this (e.g. requiring real login) is part
-- of Stage 2.

alter table users enable row level security;
alter table sites enable row level security;
alter table rooms enable row level security;
alter table racks enable row level security;
alter table equipment enable row level security;
alter table parts enable row level security;
alter table pm_schedule enable row level security;
alter table work_orders enable row level security;

create policy "public read/write - users" on users for all using (true) with check (true);
create policy "public read/write - sites" on sites for all using (true) with check (true);
create policy "public read/write - rooms" on rooms for all using (true) with check (true);
create policy "public read/write - racks" on racks for all using (true) with check (true);
create policy "public read/write - equipment" on equipment for all using (true) with check (true);
create policy "public read/write - parts" on parts for all using (true) with check (true);
create policy "public read/write - pm_schedule" on pm_schedule for all using (true) with check (true);
create policy "public read/write - work_orders" on work_orders for all using (true) with check (true);

-- ── Seed data — mirrors the current in-app demo data ───────────────
insert into users (id, name, role, initials) values
  ('u1', 'Nabil Khames', 'Admin', 'NK'),
  ('u2', 'Mostafa Hemdan', 'Manager', 'MH'),
  ('u3', 'Ehab Asmawy', 'Technician', 'EA'),
  ('u5', 'Abdelrahman Brikaa', 'Manager', 'AB');

insert into sites (id, name, loc, cap, load, it_load) values
  ('b90', 'B90', 'Smart Village', 1800, 750, 495),
  ('auto', 'Auto', 'Alexandria', 1800, 750, 460);

insert into rooms (id, site_id, name, grid_w, grid_h) values
  ('b90-r1', 'b90', 'Server Hall A', 8, 5),
  ('b90-r2', 'b90', 'Power & Gen Yard', 6, 4),
  ('auto-r1', 'auto', 'Server Hall A', 8, 5),
  ('auto-r2', 'auto', 'Power & Gen Yard', 6, 4);

-- Equipment, parts, and PM rows are left for the app to create going
-- forward once it's wired up to Supabase — the app will read whatever
-- exists here and write new records back the same way.
