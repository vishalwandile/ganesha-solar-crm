-- Ganesha Solar Services CRM — PostgreSQL schema (V1)
-- Mirrors src/data/mockData.js exactly: 6 categories, each with its own
-- fixed set of sub-stages and allowed status values.
--
-- Designed to run on Supabase (or any plain Postgres 14+).
-- Run with: psql "$DATABASE_URL" -f schema.sql

-- ============================================================
-- 0. Extensions
-- ============================================================
create extension if not exists "pgcrypto"; -- for gen_random_uuid()

-- ============================================================
-- 1. Enums
-- ============================================================
create type team_name as enum ('Admin', 'Installation', 'Sales', 'Office', 'Account', 'Loan');

create type overall_status as enum ('New', 'In Progress', 'Completed', 'On Hold');

create type category_key as enum (
  'name_change',
  'rooftop_solar',
  'pm_suryaghar',
  'finance',
  'installation',
  'closure'
);

create type payment_mode as enum ('Cash', 'Bank Transfer', 'Cheque', 'UPI');

create type document_type as enum ('Aadhaar', 'Electricity Bill', 'Bank Passbook');

-- ============================================================
-- 2. Users & teams
-- ============================================================
create table users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  username text not null unique,
  password_hash text not null,
  team team_name not null,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- Per-user, per-category edit permission. Admin assigns these individually
-- (per the "flexible: admin assigns who can edit what" decision).
-- A user with no row for a category cannot edit it, but can still view it.
create table user_category_permissions (
  user_id uuid not null references users(id) on delete cascade,
  category category_key not null,
  can_edit boolean not null default true,
  primary key (user_id, category)
);

-- ============================================================
-- 3. Stage definitions (reference/config table)
-- ============================================================
-- Mirrors CATEGORY_DEFS in mockData.js. Kept as data (not hardcoded in app
-- logic) so the sub-stage list/order/options can be tweaked without a
-- code deploy. options is the exact allowed value set for that sub-stage.
create table stage_definitions (
  category category_key not null,
  sub_stage_key text not null,
  label text not null,
  sort_order int not null,
  options text[] not null, -- e.g. {'Pending','Completed'} or {'Approved','Rejected'}
  primary key (category, sub_stage_key)
);

create table category_definitions (
  category category_key primary key,
  label text not null,
  owner_team team_name not null,
  is_optional boolean not null default false,
  sort_order int not null
);

insert into category_definitions (category, label, owner_team, is_optional, sort_order) values
  ('name_change',    'Name Change',    'Office',             true,  1),
  ('rooftop_solar',  'Rooftop Solar',  'Office',             false, 2),
  ('pm_suryaghar',   'PM Suryaghar',   'Office',             false, 3),
  ('finance',        'Finance',        'Account',            false, 4),
  ('installation',   'Installation',   'Installation',       false, 5),
  ('closure',        'Closure',        'Office',             false, 6);

insert into stage_definitions (category, sub_stage_key, label, sort_order, options) values
  ('name_change', 'doc_received',   'Document Received',    1, array['Pending','Completed']),
  ('name_change', 'app_submitted',  'Application Submitted',2, array['Pending','Completed']),
  ('name_change', 'demand',         'Demand',                3, array['Pending','Completed']),
  ('name_change', 'application',    'Application',           4, array['Approved','Rejected']),

  ('rooftop_solar', 'app_submitted','Application Submitted', 1, array['Pending','Completed']),

  ('pm_suryaghar', 'application',            'Application',                    1, array['Pending','Completed']),
  ('pm_suryaghar', 'bank_verification',      'Bank Details Verification',      2, array['Pending','Completed']),
  ('pm_suryaghar', 'installation_uploaded',  'Installation Details Uploaded',  3, array['Pending','Completed']),
  ('pm_suryaghar', 'discom_inspection',      'Inspection from DISCOM',         4, array['Pending','Completed']),
  ('pm_suryaghar', 'subsidy_request',        'Subsidy Request',                5, array['Pending','Claimed']),
  ('pm_suryaghar', 'subsidy',                'Subsidy',                        6, array['Pending','Disbursed']),

  ('finance', 'bank_loan', 'Bank Loan', 1, array['Not Applicable','Request Submitted','Completed','Rejected']),

  ('installation', 'fabrication_material', 'Fabrication Material Dispatched', 1, array['No','Yes']),
  ('installation', 'fabrication_work',     'Fabrication Work',                2, array['Pending','Completed']),
  ('installation', 'panel_installation',   'Solar Panel Installation',        3, array['Pending','Completed']),
  ('installation', 'wiring',               'Wiring',                          4, array['Pending','Completed']),
  ('installation', 'release_order',        'Release Order',                   5, array['Pending','Completed']),
  ('installation', 'meter_installation',   'Meter Installation',              6, array['Pending','Completed']),

  ('closure', 'project_closed', 'Project Closed', 1, array['No','Yes']);

-- ============================================================
-- 4. Customers
-- ============================================================
create table customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  consumer_number text not null unique,
  mobile text not null,
  email text,
  address text,
  village text,
  taluka text,
  district text,
  pin text,
  electricity_connection_no text,
  solar_capacity_kw numeric(5,2),
  solar_module text,
  inverter text,
  total_due numeric(12,2) not null default 150000,
  subsidy_amount numeric(12,2),
  subsidy_received_date date,
  overall_status overall_status not null default 'New',
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_customers_name on customers using gin (to_tsvector('simple', name));
create index idx_customers_consumer_number on customers (consumer_number);
create index idx_customers_mobile on customers (mobile);

-- ============================================================
-- 5. Per-customer category tracking
-- ============================================================
-- One row per customer per applicable category. Absence of a row for an
-- optional category (e.g. name_change) means "not applicable" for that
-- customer, matching the frontend's `data == null` convention.
create table customer_categories (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  category category_key not null,
  rejection_reason text, -- shown when a sub-stage in this category is Rejected
  notes text,            -- free-text "why is this stuck" field
  extra jsonb not null default '{}'::jsonb, -- category-specific extras, e.g.
                                             -- finance: {"bank_name": "...", "loan_amount": 200000,
                                             --           "amount_received": 0, "received_date": null}
  updated_at timestamptz not null default now(),
  updated_by uuid references users(id),
  unique (customer_id, category)
);

-- One row per customer per sub-stage. value must be one of
-- stage_definitions.options for that (category, sub_stage_key) — enforce
-- in the application layer (Postgres check constraints can't easily
-- reference another table's array column).
create table customer_sub_stages (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  category category_key not null,
  sub_stage_key text not null,
  value text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references users(id),
  unique (customer_id, category, sub_stage_key),
  foreign key (category, sub_stage_key) references stage_definitions (category, sub_stage_key)
);

create index idx_customer_sub_stages_customer on customer_sub_stages (customer_id);

-- ============================================================
-- 6. Documents & photos
-- ============================================================
create table documents (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  doc_type document_type not null,
  file_name text not null,
  file_url text not null, -- Supabase Storage object path/URL
  uploaded_by uuid references users(id),
  uploaded_at timestamptz not null default now()
);

create table photos (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  file_url text not null,
  caption text,
  uploaded_by uuid references users(id),
  uploaded_at timestamptz not null default now()
);

-- ============================================================
-- 7. Payments
-- ============================================================
create table payments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  mode payment_mode not null,
  paid_on date not null,
  created_by uuid references users(id),
  created_at timestamptz not null default now()
);

create index idx_payments_customer on payments (customer_id);

-- ============================================================
-- 8. Activity history / audit trail
-- ============================================================
create table activity_log (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  action text not null, -- human-readable, e.g. "Fabrication work marked completed"
  performed_by uuid references users(id),
  created_at timestamptz not null default now()
);

create index idx_activity_log_customer on activity_log (customer_id, created_at desc);

-- ============================================================
-- 9. Notifications
-- ============================================================
-- Triggered only on stage status changes, per the V1 decision.
create table notifications (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id) on delete cascade,
  category category_key,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_notifications_unread on notifications (is_read, created_at desc);

-- ============================================================
-- 10. updated_at trigger helper
-- ============================================================
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_customers_updated_at
  before update on customers
  for each row execute function set_updated_at();

create trigger trg_customer_categories_updated_at
  before update on customer_categories
  for each row execute function set_updated_at();

create trigger trg_customer_sub_stages_updated_at
  before update on customer_sub_stages
  for each row execute function set_updated_at();
